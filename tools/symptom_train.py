"""Entrena el detector de símptomes que fa servir l'app (i compara codificadors d'imatge).

El detector és una capa lineal (regressió logística) sobre l'embedding d'un codificador d'imatge:
- «bioclip»: el que l'app ja calcula per identificar la planta (cap descàrrega extra);
- «dino» / «dino_int8»: DINOv2-small (Apache 2.0), un codificador general que veu millor textures
  i colors (pols blanca, taques, insectes), a canvi d'una descàrrega petita.

Fonts (tools/symptom_sources.json): iNaturalist (només fotos CC0, CC BY i CC BY-SA), PlantDoc
(CC BY 4.0) i Wikimedia Commons. A la memòria cau de CI només hi ha miniatures i embeddings.

Amb --compare, avalua tots els codificadors amb validació creuada i amb fotos independents de
Wikipedia (108 plantes, gairebé totes sanes, i fotos de plagues i fongs) i ho escriu a la sortida.

Surt: models/symptoms.json (+ el codificador si cal) i les entrades corresponents del manifest.
Ús: python tools/symptom_train.py --models models --cache .symptom-cache [--compare]
"""
import argparse
import hashlib
import io
import json
import os
import re
import shutil
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
IMG_SIDE = 512
SURE = 0.9    # precisió mínima per dir «es veu a la foto»
MAYBE = 0.7   # precisió mínima per dir «potser»
FLOOR_SURE, FLOOR_MAYBE = 0.5, 0.3  # probabilitat mínima, encara que la classe sigui fàcil
MIN_CLASS = 60
DINO_REPO = "onnx-community/dinov2-small"
DINO_FILES = {"dino": "onnx/model.onnx", "dino_int8": "onnx/model_int8.onnx"}

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


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


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
    """label i value poden portar alternatives separades per «|»."""
    global _terms
    if _terms is None:
        _terms = get_json(f"{API}/controlled_terms").get("results", [])
    labels = [x.lower() for x in label.split("|")]
    values = [x.lower() for x in value.split("|")]
    for t in _terms:
        if t.get("label", "").lower() in labels:
            for v in t.get("values", []):
                if v.get("label", "").lower() in values:
                    return t["id"], v["id"]
    return None, None


def inat_items(spec, licenses, created_before):
    tid = taxon_id(spec["taxon"])
    if not tid:
        print(f"  ! no trobo el tàxon {spec['taxon']}")
        return []
    params = {"taxon_id": tid, "photos": "true", "photo_license": licenses, "per_page": 200, "created_d2": created_before}
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


# ---------- miniatures a la memòria cau ----------

def img_path(cache_dir, key):
    return os.path.join(cache_dir, "img", hashlib.sha1(key.encode()).hexdigest() + ".jpg")


def cache_images(items, cache_dir, plantdoc):
    os.makedirs(os.path.join(cache_dir, "img"), exist_ok=True)
    todo = [it for it in items if not os.path.exists(img_path(cache_dir, it["key"]))]
    print(f"Imatges: {len(items) - len(todo)} a la memòria cau, {len(todo)} per baixar")
    if any("zip" in it for it in todo):
        plantdoc.load()

    def fetch(it):
        try:
            data = plantdoc.read(it["zip"]) if "zip" in it else get_bytes(it["url"])
            if not data:
                return False
            im = ImageOps.exif_transpose(Image.open(io.BytesIO(data))).convert("RGB")
            im.thumbnail((IMG_SIDE, IMG_SIDE), Image.BICUBIC)
            im.save(img_path(cache_dir, it["key"]), "JPEG", quality=88)
            return True
        except Exception:  # noqa: BLE001
            return False

    with ThreadPoolExecutor(16) as pool:
        ok = sum(pool.map(fetch, todo))
    if todo:
        print(f"  baixades {ok}/{len(todo)}")


# ---------- codificadors d'imatge ----------

MEAN = np.array([0.485, 0.456, 0.406], np.float32)[:, None, None]
STD = np.array([0.229, 0.224, 0.225], np.float32)[:, None, None]


def to_chw(im):
    return (np.asarray(im.convert("RGB").resize((SIZE, SIZE), Image.BICUBIC), dtype=np.float32) / 255.0).transpose(2, 0, 1)


class Encoder:
    def __init__(self, name, path):
        self.name, self.path = name, path
        self.s = ort.InferenceSession(path, providers=["CPUExecutionProvider"])
        self.inp = self.s.get_inputs()[0].name
        outs = [o.name for o in self.s.get_outputs()]
        self.out = "last_hidden_state" if "last_hidden_state" in outs else outs[0]
        self.dino = name.startswith("dino")

    def __call__(self, im):
        x = to_chw(im)
        if self.dino:
            h = self.s.run([self.out], {self.inp: ((x - MEAN) / STD)[None]})[0][0]
            return np.concatenate([h[0], h[1:].mean(0)]).astype(np.float32)
        e = self.s.run([self.out], {self.inp: x[None]})[0][0].astype(np.float32)
        return e / (np.linalg.norm(e) + 1e-12)


def dino_path(name, cache_dir):
    path = os.path.join(cache_dir, "models", os.path.basename(DINO_FILES[name]).replace("model", "dinov2-small"))
    if os.path.exists(path) and not os.path.exists(path + ".rev"):
        with open(path + ".rev", "w") as f:
            f.write(get_json(f"https://huggingface.co/api/models/{DINO_REPO}", pause=0.2).get("sha", "main"))
    if not os.path.exists(path):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        rev = get_json(f"https://huggingface.co/api/models/{DINO_REPO}", pause=0.2).get("sha", "main")
        print(f"  DINOv2-small ({DINO_REPO}) revisió {rev}")
        with open(path + ".rev", "w") as f:
            f.write(rev)
        data = get_bytes(f"https://huggingface.co/{DINO_REPO}/resolve/{rev}/{DINO_FILES[name]}")
        if not data:
            raise RuntimeError(f"no s'ha pogut baixar {DINO_FILES[name]}")
        with open(path, "wb") as f:
            f.write(data)
    return path


def load_cache(path):
    if not os.path.exists(path):
        return {}
    z = np.load(path, allow_pickle=False)
    return {k: v for k, v in zip(z["keys"].tolist(), z["emb"])}


def save_cache(path, cache):
    keys = sorted(cache)
    np.savez_compressed(path, keys=np.array(keys), emb=np.stack([cache[k] for k in keys]))


def features(enc, items, cache_dir):
    path = os.path.join(cache_dir, f"feat-{enc.name}-{sha256(enc.path)[:12]}.npz")
    cache = load_cache(path)
    todo = [it for it in items if it["key"] not in cache and os.path.exists(img_path(cache_dir, it["key"]))]
    t0 = time.time()
    for i, it in enumerate(todo):
        cache[it["key"]] = enc(Image.open(img_path(cache_dir, it["key"]))).astype(np.float16)
        if (i + 1) % 1000 == 0:
            print(f"  {enc.name}: {i + 1}/{len(todo)}")
    if todo:
        save_cache(path, cache)
        print(f"  {enc.name}: {len(todo)} embeddings nous en {time.time() - t0:.0f} s ({1000 * (time.time() - t0) / len(todo):.0f} ms per foto)")
    return cache


# ---------- fotos independents (Wikipedia, com tools/photos.mjs) ----------

def wiki_lists(photos_js="tools/photos.mjs"):
    src = open(photos_js, encoding="utf8").read()
    out = {}
    for name in ["PHOTOS", "SYMPTOM_PHOTOS"]:
        block = src[src.index(f"export const {name} = ["):]
        block = block[:block.index("];")]
        out[name] = re.findall(r'\["([^"]+)", "([^"]+)"', block)
    return out


def wiki_photo(title, folder):
    os.makedirs(folder, exist_ok=True)
    path = os.path.join(folder, re.sub(r"[^\w-]", "_", title, flags=re.ASCII) + ".jpg")
    if not os.path.exists(path):
        meta = get_json(f"https://en.wikipedia.org/api/rest_v1/page/summary/{urllib.parse.quote(title)}", pause=0.2)
        url = (meta.get("thumbnail") or meta.get("originalimage") or {}).get("source")
        data = get_bytes(url) if url else None
        if not data:
            return None
        with open(path, "wb") as f:
            f.write(data)
    return path


# ---------- entrenament i mètriques ----------

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


def train_eval(X, y, groups, classes, Cs, verbose=True):
    from sklearn.linear_model import LogisticRegression
    from sklearn.metrics import log_loss
    from sklearn.model_selection import StratifiedGroupKFold

    mu, sd = X.mean(0), X.std(0) + 1e-6
    Xs = (X - mu) / sd
    folds = list(StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=0).split(Xs, y, groups))
    best = None
    for C in Cs:
        oof = np.zeros((len(y), len(classes)))
        for tr, te in folds:
            m = LogisticRegression(C=C, class_weight="balanced", max_iter=3000)
            m.fit(Xs[tr], y[tr])
            oof[te] = m.predict_proba(Xs[te])
        oof /= oof.sum(1, keepdims=True)
        ll = log_loss(y, oof, labels=list(range(len(classes))))
        if verbose:
            print(f"    C={C}: log-loss {ll:.3f}, encerts {float((oof.argmax(1) == y).mean()):.1%}")
        if best is None or ll < best[1]:
            best = (C, ll, oof)
    C, ll, oof = best
    sure, maybe, metrics = {}, {}, {}
    for k, cls in enumerate(classes):
        if cls == "sana":
            continue
        pos = y == k
        t1, p1, r1 = pick_threshold(oof[:, k], pos, SURE)
        t2, p2, r2 = pick_threshold(oof[:, k], pos, MAYBE)
        # Amb el mínim, es recalcula la precisió i l'abast reals del llindar.
        def at(t, floor):
            if t is None:
                return None, 0.0, 0.0
            t = max(t, floor)
            sel = oof[:, k] >= t
            return t, float((sel & pos).sum() / max(sel.sum(), 1)), float((sel & pos).sum() / max(pos.sum(), 1))
        t1, p1, r1 = at(t1, FLOOR_SURE)
        t2, p2, r2 = at(t2, FLOOR_MAYBE)
        sure[cls], maybe[cls] = t1, t2
        conf = np.bincount(oof[pos].argmax(1), minlength=len(classes))
        top = [f"{classes[j]} {conf[j]}" for j in np.argsort(-conf) if j != k and conf[j]][:2]
        metrics[cls] = {"n": int(pos.sum()), "sure": [t1, round(p1, 3), round(r1, 3)], "maybe": [t2, round(p2, 3), round(r2, 3)], "confused": top}
    sana = np.where(y == 0)[0]
    fp = float(np.mean([any(sure[c] is not None and oof[i, k] >= sure[c] for k, c in enumerate(classes) if c != "sana") for i in sana])) if len(sana) else 0.0
    final = LogisticRegression(C=C, class_weight="balanced", max_iter=5000).fit(Xs, y)
    W = final.coef_ / sd
    b = final.intercept_ - (final.coef_ * (mu / sd)).sum(1)
    return {"C": C, "logloss": ll, "acc": float((oof.argmax(1) == y).mean()), "sure": sure, "maybe": maybe,
            "metrics": metrics, "fp_sana": fp, "W": W, "b": b}


def probs(model, f):
    z = model["W"] @ f + model["b"]
    z = np.exp(z - z.max())
    return z / z.sum()


def detect(model, classes, f):
    p = probs(model, f)
    out = []
    for k, c in enumerate(classes):
        if c == "sana":
            continue
        if model["sure"].get(c) is not None and p[k] >= model["sure"][c]:
            out.append((c, "sure", float(p[k])))
        elif model["maybe"].get(c) is not None and p[k] >= model["maybe"][c]:
            out.append((c, "maybe", float(p[k])))
    return out


def independent(enc, model, classes, wiki):
    plants = [(t, wiki_photo(t, ".test-photos")) for t, _ in wiki["PHOTOS"]]
    syms = [(t, e, wiki_photo(t, os.path.join(".test-photos", "simptomes"))) for t, e in wiki["SYMPTOM_PHOTOS"]]
    fp_sure = fp_maybe = n_plants = 0
    for t, path in plants:
        if not path:
            continue
        n_plants += 1
        d = detect(model, classes, enc(Image.open(path)))
        fp_sure += any(lv == "sure" for _, lv, _ in d)
        fp_maybe += bool(d) and not any(lv == "sure" for _, lv, _ in d)
    hit_sure = hit_any = n_sym = 0
    rows = []
    for t, e, path in syms:
        if not path or e not in classes:
            continue
        n_sym += 1
        d = detect(model, classes, enc(Image.open(path)))
        lv = next((lv for c, lv, _ in d if c == e), None)
        hit_sure += lv == "sure"
        hit_any += lv is not None
        rows.append(f"{'✔' if lv == 'sure' else '≈' if lv else '✘'} {t} ({e}) → " + (", ".join(f"{c}{'?' if l == 'maybe' else ''} {p:.0%}" for c, l, p in d) or "—"))
    return {"plants": n_plants, "fp_sure": fp_sure, "fp_maybe": fp_maybe, "symptoms": n_sym, "hit_sure": hit_sure, "hit_any": hit_any, "rows": rows}


# ---------- principal ----------

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--models", default="models")
    ap.add_argument("--cache", default=".symptom-cache")
    ap.add_argument("--sources", default="tools/symptom_sources.json")
    ap.add_argument("--compare", action="store_true")
    args = ap.parse_args()
    os.makedirs(args.cache, exist_ok=True)
    src = json.load(open(args.sources))
    man_path = os.path.join(args.models, "manifest.json")
    man = json.load(open(man_path))
    bioclip_path = os.path.join(args.models, "flora-fp32.onnx")
    chosen = src.get("encoder", "bioclip")

    # 1. Llista de fotos per classe
    plantdoc = PlantDoc(src["plantdoc_zip"], [tuple(r) for r in src["plantdoc_rules"]])
    items = {}
    for cls, spec in src["classes"].items():
        got = []
        for s in spec.get("inat", []):
            part = inat_items(s, src["inat_licenses"], src.get("created_before", "2026-11-01"))
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

    all_items = [it for v in items.values() for it in v]
    cache_images(all_items, args.cache, plantdoc)

    # 2. Codificadors a provar
    names = ["bioclip", "dino_int8", "dino"] if args.compare else [chosen]
    encoders = {n: Encoder(n, bioclip_path if n == "bioclip" else dino_path(n, args.cache)) for n in names}
    wiki = wiki_lists() if args.compare else None
    results = {}
    for n, enc in encoders.items():
        print(f"\n== Codificador: {n} ==")
        feats = features(enc, all_items, args.cache)
        classes = ["sana"] + [c for c in items if c != "sana" and sum(it["key"] in feats for it in items[c]) >= MIN_CLASS]
        X, y, groups = [], [], []
        for k, cls in enumerate(classes):
            for it in items[cls]:
                if it["key"] in feats:
                    X.append(feats[it["key"]].astype(np.float32))
                    y.append(k)
                    groups.append(it["group"])
        X, y = np.stack(X), np.array(y)
        print("  Fotos per classe: " + ", ".join(f"{c} {int((y == k).sum())}" for k, c in enumerate(classes)))
        r = train_eval(X, y, groups, classes, [0.003, 0.01, 0.03])
        r["classes"], r["dim"] = classes, int(X.shape[1])
        for cls, m in r["metrics"].items():
            t1, p1, r1 = m["sure"]
            t2, p2, r2 = m["maybe"]
            f = lambda t, p, rr: f"{rr:.0%}" if t is not None else "—"
            print(f"  {cls:13s} {m['n']:4d} · troba (90 %) {f(t1, p1, r1):>4s} · troba (60 %) {f(t2, p2, r2):>4s} · es confon amb: {', '.join(m['confused']) or '—'}")
        rec90 = np.mean([m["sure"][2] for m in r["metrics"].values()])
        rec60 = np.mean([m["maybe"][2] for m in r["metrics"].values()])
        print(f"  RESUM {n}: encerts {r['acc']:.1%} · troba mitjà {rec90:.0%} (90 %) / {rec60:.0%} (60 %) · sanes amb falsa alarma {r['fp_sana']:.1%}")
        r["rec90"], r["rec60"] = float(rec90), float(rec60)
        if wiki:
            ind = independent(enc, r, classes, wiki)
            for row in ind["rows"]:
                print("   " + row)
            print(f"  INDEPENDENT {n}: símptomes {ind['hit_sure']}/{ind['symptoms']} segurs, {ind['hit_any']}/{ind['symptoms']} amb «potser» · plantes sanes amb falsa alarma: {ind['fp_sure']}/{ind['plants']} segura, {ind['fp_maybe']}/{ind['plants']} «potser»")
            r["independent"] = {k: v for k, v in ind.items() if k != "rows"}
        results[n] = r

    if args.compare:
        print("\n== Comparació ==")
        for n, r in results.items():
            ind = r.get("independent", {})
            print(f"  {n:10s} CV encerts {r['acc']:.1%} · troba {r['rec90']:.0%}/{r['rec60']:.0%} · indep. {ind.get('hit_sure', 0)}+{ind.get('hit_any', 0) - ind.get('hit_sure', 0)}/{ind.get('symptoms', 0)} · falses alarmes {ind.get('fp_sure', 0)}/{ind.get('fp_maybe', 0)} de {ind.get('plants', 0)}")

    # 3. Model final amb el codificador triat
    r = results[chosen]
    out = {
        "version": 2, "encoder": chosen, "dim": r["dim"], "classes": r["classes"],
        "W": [[float(f"{v:.5g}") for v in row] for row in r["W"]],
        "b": [float(f"{v:.6g}") for v in r["b"]],
        "sure": r["sure"], "maybe": r["maybe"], "metrics": r["metrics"], "C": r["C"],
    }
    path = os.path.join(args.models, "symptoms.json")
    with open(path, "w") as f:
        json.dump(out, f, separators=(",", ":"))
    entry = {"model": "models/symptoms.json", "classes": r["classes"], "encoder": chosen}
    rev_file = encoders[chosen].path + ".rev"
    if os.path.exists(rev_file):
        entry["encoder_source"] = f"{DINO_REPO}@{open(rev_file).read().strip()}"
    files = {"models/symptoms.json": path}
    if chosen.startswith("dino"):
        enc_dst = os.path.join(args.models, os.path.basename(encoders[chosen].path))
        shutil.copyfile(encoders[chosen].path, enc_dst)
        entry["encoder_model"] = f"models/{os.path.basename(enc_dst)}"
        files[entry["encoder_model"]] = enc_dst
    man["symptoms"] = entry
    for k, p in files.items():
        man.setdefault("files", {})[k] = {"bytes": os.path.getsize(p), "sha256": sha256(p)}
    with open(man_path, "w") as f:
        json.dump(man, f, indent=1)
    print(f"\nDesat {path} ({os.path.getsize(path) / 1024:.0f} KB, {len(r['classes'])} classes, codificador {chosen})")


if __name__ == "__main__":
    main()
