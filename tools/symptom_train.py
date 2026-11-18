"""Entrena el detector de símptomes que fa servir l'app.

L'app ja calcula l'embedding BioCLIP 2.5 de cada foto per identificar la planta. Una capa lineal
(regressió logística) sobre aquest mateix embedding reconeix plagues, fongs i fulles malmeses:
no cal cap descàrrega ni gaire càlcul més al mòbil. BioCLIP 2 representa bé les malalties de les
plantes (l'article de BioCLIP 2 ho mesura amb PlantVillage).

Fonts (tools/symptom_sources.json): iNaturalist (només fotos CC0, CC BY i CC BY-SA), PlantDoc
(CC BY 4.0) i Wikimedia Commons. No es guarden les imatges, només els embeddings (memòria cau de CI).

Surt: models/symptoms.json (pesos, llindars i mètriques) i l'entrada corresponent al manifest.

Ús: python tools/symptom_train.py --models models --cache .symptom-cache
"""
import argparse
import hashlib
import io
import json
import os
import tempfile
import time
import urllib.parse
import urllib.request
import zipfile
from concurrent.futures import ThreadPoolExecutor

import numpy as np
import onnxruntime as ort
from PIL import Image, ImageOps

UA = {"User-Agent": "salut-plantes-ci/1.0 (https://github.com/joangui/salut-plantes)"}
API = "https://api.inaturalist.org/v1"
COMMONS = "https://commons.wikimedia.org/w/api.php"
SIZE = 224
SURE = 0.9    # precisió mínima per dir «es veu a la foto»
MAYBE = 0.6   # precisió mínima per dir «potser»
MIN_CLASS = 60

_last = [0.0]


def get_json(url, pause=1.0, tries=4):
    for k in range(tries):
        wait = _last[0] + pause - time.time()
        if wait > 0:
            time.sleep(wait)
        _last[0] = time.time()
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                return json.load(r)
        except Exception as err:  # noqa: BLE001
            if k == tries - 1:
                print(f"  ! {url[:120]}: {err}")
                return {}
            time.sleep(4 * (k + 1))
    return {}


def get_bytes(url, tries=3):
    for k in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                return r.read()
        except Exception:  # noqa: BLE001
            time.sleep(2 * (k + 1))
    return None


# ---------- iNaturalist ----------

_taxa = {}
_terms = None


def taxon_id(name):
    if name not in _taxa:
        d = get_json(f"{API}/taxa?q={urllib.parse.quote(name)}&per_page=30&is_active=true")
        hits = [t for t in d.get("results", []) if t.get("name", "").lower() == name.lower()]
        _taxa[name] = hits[0]["id"] if hits else None
    return _taxa[name]


def term_ids(label, value):
    global _terms
    if _terms is None:
        _terms = get_json(f"{API}/controlled_terms").get("results", [])
    for t in _terms:
        if t.get("label", "").lower() == label.lower():
            for v in t.get("values", []):
                if v.get("label", "").lower() == value.lower():
                    return t["id"], v["id"]
    return None, None


def inat_items(spec, licenses):
    tid = taxon_id(spec["taxon"])
    if not tid:
        print(f"  ! no trobo el tàxon {spec['taxon']}")
        return []
    params = {"taxon_id": tid, "photos": "true", "photo_license": licenses, "per_page": 200}
    if spec.get("grade", "research") != "any":
        params["quality_grade"] = "research"
    if spec.get("captive"):
        params["captive"] = "true"
    if spec.get("annotation"):
        term, value = term_ids(*spec["annotation"])
        if not term:
            print(f"  ! no trobo l'anotació {spec['annotation']}")
            return []
        params.update(term_id=term, term_value_id=value)
    allowed = set(licenses.split(","))
    out, page = [], 1
    while len(out) < spec["n"] and page <= spec["n"] // 200 + 3:
        params["page"] = page
        d = get_json(f"{API}/observations?{urllib.parse.urlencode(params)}")
        results = d.get("results", [])
        for obs in results:
            photo = next((p for p in obs.get("photos", []) if (p.get("license_code") or "").lower() in allowed), None)
            if not photo or not photo.get("url"):
                continue
            url = photo["url"].replace("/square.", "/medium.")
            out.append({"key": f"inat:{photo['id']}", "url": url, "group": f"inat-obs:{obs['id']}"})
            if len(out) >= spec["n"]:
                break
        if len(results) < 200:
            break
        page += 1
    return out


# ---------- Wikimedia Commons ----------

def commons_titles(cat, depth=1, seen=None):
    seen = seen if seen is not None else set()
    if cat in seen:
        return []
    seen.add(cat)
    files, subcats, cont = [], [], {}
    while True:
        q = {"action": "query", "list": "categorymembers", "cmtitle": f"Category:{cat}", "cmtype": "file|subcat",
             "cmlimit": "500", "format": "json", **cont}
        d = get_json(f"{COMMONS}?{urllib.parse.urlencode(q)}", pause=0.2)
        for m in d.get("query", {}).get("categorymembers", []):
            if m.get("ns") == 6:
                files.append(m["title"])
            elif m.get("ns") == 14:
                subcats.append(m["title"].split(":", 1)[1])
        if "continue" not in d:
            break
        cont = d["continue"]
    if depth > 0:
        for sc in subcats:
            files += commons_titles(sc, depth - 1, seen)
    return files


def commons_items(categories):
    titles = []
    for cat in categories:
        t = commons_titles(cat)
        print(f"    Commons «{cat}»: {len(t)} fitxers")
        titles += t
    titles = list(dict.fromkeys(titles))
    out = []
    for i in range(0, len(titles), 50):
        q = {"action": "query", "prop": "imageinfo", "iiprop": "url|mime", "iiurlwidth": "500",
             "titles": "|".join(titles[i:i + 50]), "format": "json"}
        d = get_json(f"{COMMONS}?{urllib.parse.urlencode(q)}", pause=0.2)
        for p in d.get("query", {}).get("pages", {}).values():
            ii = (p.get("imageinfo") or [{}])[0]
            if ii.get("mime") in ("image/jpeg", "image/png") and ii.get("thumburl"):
                out.append({"key": f"commons:{p['title']}", "url": ii["thumburl"], "group": f"commons:{p['title']}"})
    return out


# ---------- PlantDoc ----------

class PlantDoc:
    def __init__(self, url, rules):
        self.url, self.rules, self.zip, self.by_class = url, rules, None, None

    def load(self):
        if self.zip is None:
            path = os.path.join(tempfile.gettempdir(), "plantdoc.zip")
            if not os.path.exists(path):
                print("  Descarregant PlantDoc…")
                data = get_bytes(self.url)
                if not data:
                    raise RuntimeError("no s'ha pogut baixar PlantDoc")
                with open(path, "wb") as f:
                    f.write(data)
            self.zip = zipfile.ZipFile(path)
            self.by_class = {}
            for name in sorted(self.zip.namelist()):
                parts = name.split("/")
                if len(parts) < 4 or not name.lower().endswith((".jpg", ".jpeg", ".png")):
                    continue
                folder = parts[-2].lower()
                target = "sana"
                for kw, cls in self.rules:
                    if kw in folder:
                        target = cls
                        break
                if target:
                    self.by_class.setdefault(target, []).append(name)
        return self

    def items(self, cls, n):
        names = self.by_class.get(cls, [])
        rng = np.random.default_rng(7)
        pick = [names[i] for i in sorted(rng.permutation(len(names))[:n])]
        # El mateix original pot donar diversos retalls: s'agrupen pel nom del fitxer.
        return [{"key": f"plantdoc:{p}", "zip": p, "group": "plantdoc:" + os.path.basename(p).split(".")[0][:24]} for p in pick]

    def read(self, name):
        return self.zip.read(name)


# ---------- imatges i embeddings ----------

def to_input(data):
    im = Image.open(io.BytesIO(data))
    im = ImageOps.exif_transpose(im).convert("RGB").resize((SIZE, SIZE), Image.BICUBIC)
    return (np.asarray(im, dtype=np.float32) / 255.0).transpose(2, 0, 1)


def embed_all(items, session, cache, plantdoc):
    todo = [it for it in items if it["key"] not in cache]
    print(f"Embeddings: {len(items) - len(todo)} a la memòria cau, {len(todo)} per calcular")
    name = session.get_inputs()[0].name

    def fetch(it):
        try:
            data = plantdoc.read(it["zip"]) if "zip" in it else get_bytes(it["url"])
            return it, (to_input(data) if data else None)
        except Exception:  # noqa: BLE001
            return it, None

    done = 0
    with ThreadPoolExecutor(16) as pool:
        for it, x in pool.map(fetch, todo):
            if x is None:
                continue
            out = session.run(None, {name: x[None]})[0][0].astype(np.float32)
            cache[it["key"]] = (out / (np.linalg.norm(out) + 1e-12)).astype(np.float16)
            done += 1
            if done % 500 == 0:
                print(f"  {done}/{len(todo)}")
    return cache


def load_cache(path):
    if not os.path.exists(path):
        return {}
    z = np.load(path, allow_pickle=False)
    return {k: v for k, v in zip(z["keys"].tolist(), z["emb"])}


def save_cache(path, cache):
    keys = sorted(cache)
    np.savez_compressed(path, keys=np.array(keys), emb=np.stack([cache[k] for k in keys]))


# ---------- entrenament ----------

def pick_threshold(scores, pos, target):
    order = np.argsort(-scores)
    s, p = scores[order], pos[order]
    tp = np.cumsum(p)
    fp = np.cumsum(~p)
    prec = tp / np.maximum(tp + fp, 1)
    ok = np.where((prec >= target) & (tp >= 5))[0]
    if not len(ok):
        return None, 0.0, 0.0
    i = ok.max()
    return float(s[i]), float(prec[i]), float(tp[i] / max(p.sum(), 1))


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--models", default="models")
    ap.add_argument("--cache", default=".symptom-cache")
    ap.add_argument("--sources", default="tools/symptom_sources.json")
    args = ap.parse_args()
    os.makedirs(args.cache, exist_ok=True)
    src = json.load(open(args.sources))
    man_path = os.path.join(args.models, "manifest.json")
    man = json.load(open(man_path))
    model_path = os.path.join(args.models, "flora-fp32.onnx")
    cache_path = os.path.join(args.cache, f"emb-{sha256(model_path)[:12]}.npz")

    # 1. Llista de fotos per classe
    plantdoc = PlantDoc(src["plantdoc_zip"], [tuple(r) for r in src["plantdoc_rules"]])
    items = {}
    for cls, spec in src["classes"].items():
        got = []
        for s in spec.get("inat", []):
            part = inat_items(s, src["inat_licenses"])
            print(f"  {cls}: iNaturalist {s['taxon']}{' ' + '/'.join(s['annotation']) if s.get('annotation') else ''}{' (cultivades)' if s.get('captive') else ''}: {len(part)}")
            got += part
        if spec.get("commons"):
            part = commons_items(spec["commons"])
            print(f"  {cls}: Commons: {len(part)}")
            got += part
        n_pd = spec.get("plantdoc_healthy") if cls == "sana" else spec.get("plantdoc")
        if n_pd:
            part = plantdoc.load().items(cls, n_pd)
            print(f"  {cls}: PlantDoc: {len(part)}")
            got += part
        seen = set()
        items[cls] = [it for it in got if not (it["key"] in seen or seen.add(it["key"]))]

    # 2. Embeddings
    all_items = [it for v in items.values() for it in v]
    cache = load_cache(cache_path)
    if any(it["key"] not in cache for it in all_items):
        if any("zip" in it and it["key"] not in cache for it in all_items):
            plantdoc.load()
        session = ort.InferenceSession(model_path, providers=["CPUExecutionProvider"])
        cache = embed_all(all_items, session, cache, plantdoc)
        save_cache(cache_path, cache)

    classes = ["sana"] + [c for c in items if c != "sana" and sum(it["key"] in cache for it in items[c]) >= MIN_CLASS]
    dropped = [c for c in items if c not in classes]
    if dropped:
        print(f"Classes sense prou fotos (< {MIN_CLASS}), fora del detector: {', '.join(dropped)}")
    X, y, groups = [], [], []
    for k, cls in enumerate(classes):
        for it in items[cls]:
            if it["key"] in cache:
                X.append(cache[it["key"]].astype(np.float32))
                y.append(k)
                groups.append(it["group"])
    X, y = np.stack(X), np.array(y)
    print("Fotos per classe: " + ", ".join(f"{c} {int((y == k).sum())}" for k, c in enumerate(classes)))

    # 3. Model i validació creuada (5 parts, sense repetir observació entre parts)
    from sklearn.linear_model import LogisticRegression
    from sklearn.metrics import log_loss
    from sklearn.model_selection import StratifiedGroupKFold

    mu, sd = X.mean(0), X.std(0) + 1e-6
    Xs = (X - mu) / sd
    folds = list(StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=0).split(Xs, y, groups))

    def oof_probs(C):
        oof = np.zeros((len(y), len(classes)))
        for tr, te in folds:
            m = LogisticRegression(C=C, class_weight="balanced", max_iter=3000)
            m.fit(Xs[tr], y[tr])
            oof[te] = m.predict_proba(Xs[te])
        return oof / oof.sum(1, keepdims=True)

    best = None
    for C in [0.01, 0.03, 0.1, 0.3]:
        oof = oof_probs(C)
        ll = log_loss(y, oof, labels=list(range(len(classes))))
        acc = float((oof.argmax(1) == y).mean())
        print(f"C={C}: log-loss {ll:.3f}, encerts {acc:.1%}")
        if best is None or ll < best[1]:
            best = (C, ll, oof)
    C, _, oof = best

    # 4. Llindars per classe
    sure, maybe, metrics = {}, {}, {}
    print(f"\nLlindars (C={C}). «Es veu»: precisió ≥ {SURE:.0%}; «potser»: ≥ {MAYBE:.0%}.")
    for k, cls in enumerate(classes):
        if cls == "sana":
            continue
        pos = y == k
        t1, p1, r1 = pick_threshold(oof[:, k], pos, SURE)
        t2, p2, r2 = pick_threshold(oof[:, k], pos, MAYBE)
        sure[cls], maybe[cls] = t1, t2
        conf = np.bincount(oof[pos].argmax(1), minlength=len(classes))
        top = [f"{classes[j]} {conf[j]}" for j in np.argsort(-conf) if j != k and conf[j]][:2]
        metrics[cls] = {"n": int(pos.sum()), "sure": [t1, round(p1, 3), round(r1, 3)], "maybe": [t2, round(p2, 3), round(r2, 3)]}
        fmt = lambda t, p, r: f"llindar {t:.2f} → precisió {p:.0%}, troba {r:.0%}" if t is not None else "no arriba"
        print(f"  {cls:13s} {int(pos.sum()):4d} fotos · es veu: {fmt(t1, p1, r1)} · potser: {fmt(t2, p2, r2)} · es confon amb: {', '.join(top) or '—'}")
    sana = y == 0
    fp_sure = float(np.mean([any(sure[c] is not None and oof[i, k] >= sure[c] for k, c in enumerate(classes) if c != "sana") for i in np.where(sana)[0]]))
    print(f"Fotos de plantes sanes amb algun «es veu» (validació creuada): {fp_sure:.1%}")

    # 5. Model final, amb l'estandardització dins els pesos: logits = W·e + b
    final = LogisticRegression(C=C, class_weight="balanced", max_iter=5000).fit(Xs, y)
    W = final.coef_ / sd
    b = final.intercept_ - (final.coef_ * (mu / sd)).sum(1)
    out = {
        "version": 1,
        "dim": int(X.shape[1]),
        "classes": classes,
        "W": [[float(f"{v:.5g}") for v in row] for row in W],
        "b": [float(f"{v:.6g}") for v in b],
        "sure": sure,
        "maybe": maybe,
        "metrics": metrics,
        "counts": {c: int((y == k).sum()) for k, c in enumerate(classes)},
        "C": C,
    }
    path = os.path.join(args.models, "symptoms.json")
    with open(path, "w") as f:
        json.dump(out, f, separators=(",", ":"))
    man["symptoms"] = {"model": "models/symptoms.json", "classes": classes}
    man.setdefault("files", {})["models/symptoms.json"] = {"bytes": os.path.getsize(path), "sha256": sha256(path)}
    with open(man_path, "w") as f:
        json.dump(man, f, indent=1)
    print(f"\nDesat {path} ({os.path.getsize(path) / 1024:.0f} KB, {len(classes)} classes)")


if __name__ == "__main__":
    main()
