"""Afegeix a la taula del model botànic les plantes de la guia que no hi són.

El model mòbil compara la foto amb una taula d'embeddings de text fets amb el codificador
de text del seu mestre, BioCLIP 2.5 (ViT-H/14). Aquí fem servir el mateix codificador per
calcular els embeddings de les plantes cultivades que falten (cítrics, geranis, plantes
d'interior...). Primer comprovem quina plantilla de text reprodueix millor la taula original.

Ús: python tools/extend_taxa.py --models models --species .kb-species.json --cache .taxa-cache
"""
import argparse
import hashlib
import json
import os
import re
import unicodedata

import numpy as np

TEACHER = "hf-hub:imageomics/bioclip-2.5-vith14"
VERSION = "v1"


def norm2(name):
    s = unicodedata.normalize("NFKD", str(name))
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = re.sub(r"[×✕]", " ", s)
    s = re.sub(r"\s+x\s+", " ", s, flags=re.I)
    s = re.sub(r"[^a-zA-Z\s-]", " ", s).lower()
    return " ".join(s.split()[:2])


def text_name(sci):
    return " ".join(sci.replace("×", " ").split())


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def compute(missing, sample_names, sample_rows):
    import torch
    import open_clip
    from open_clip.zero_shot_metadata import OPENAI_IMAGENET_TEMPLATES

    torch.set_num_threads(os.cpu_count() or 4)
    model, _, _ = open_clip.create_model_and_transforms(TEACHER)
    tokenizer = open_clip.get_tokenizer(TEACHER)
    model.eval()

    @torch.no_grad()
    def encode(texts):
        out = []
        for i in range(0, len(texts), 64):
            e = model.encode_text(tokenizer(texts[i:i + 64]))
            out.append(torch.nn.functional.normalize(e, dim=-1).float().numpy())
        return np.concatenate(out)

    def embed(names, template):
        if template == "openai80":
            per = [encode([t(n) for t in OPENAI_IMAGENET_TEMPLATES]) for n in names]
            emb = np.stack([p.mean(0) for p in per])
        else:
            emb = encode([template.format(n) for n in names])
        return emb / np.linalg.norm(emb, axis=1, keepdims=True)

    candidates = ["{}", "a photo of {}", "a photo of {}.", "openai80"]
    scores = {}
    texts = [text_name(n) for n in sample_names]
    for tpl in candidates:
        e = embed(texts, tpl)
        scores[tpl] = float(np.mean(np.sum(e * sample_rows, axis=1)))
        print(f"  plantilla {tpl!r}: cosinus mitjà amb la taula original {scores[tpl]:.4f}")
    best = max(scores, key=scores.get)
    print(f"  plantilla triada: {best!r}")
    extra = embed([text_name(n) for n in missing], best) if missing else np.zeros((0, sample_rows.shape[1]), np.float32)
    return extra.astype(np.float32), best, scores


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--models", default="models")
    ap.add_argument("--species", default=".kb-species.json")
    ap.add_argument("--cache", default=".taxa-cache")
    args = ap.parse_args()

    man_path = os.path.join(args.models, "manifest.json")
    man = json.load(open(man_path, encoding="utf-8"))
    dim = man["flora"]["dim"]
    names = json.load(open(os.path.join(args.models, "flora-taxa.json"), encoding="utf-8"))
    table = np.fromfile(os.path.join(args.models, "flora-taxa-f16.bin"), dtype="<f2").astype(np.float32).reshape(-1, dim)
    original = man["flora"].get("count_original", len(names))
    names, table = names[:original], table[:original]

    kb = json.load(open(args.species, encoding="utf-8"))
    have = {norm2(n) for n in names}
    missing = [s for s in kb["species"] if norm2(s) not in have]
    print(f"Espècies de la guia: {len(kb['species'])}; ja a la taula: {len(kb['species']) - len(missing)}; a afegir: {len(missing)}")

    key = hashlib.sha256(json.dumps([VERSION, missing]).encode()).hexdigest()[:16]
    cache_file = os.path.join(args.cache, f"extra-{key}.npz")
    if os.path.exists(cache_file):
        data = np.load(cache_file, allow_pickle=False)
        extra, template = data["emb"].astype(np.float32), str(data["template"])
        print(f"  de la memòria cau ({template!r})")
    else:
        rng = np.random.default_rng(0)
        idx = np.sort(rng.choice(len(names), size=min(48, len(names)), replace=False))
        extra, template, _ = compute(missing, [names[i] for i in idx], table[idx])
        os.makedirs(args.cache, exist_ok=True)
        np.savez(cache_file, emb=extra.astype(np.float16), template=np.array(template))

    full = np.concatenate([table, extra]).astype("<f2")
    full.tofile(os.path.join(args.models, "flora-taxa-f16.bin"))
    json.dump(names + missing, open(os.path.join(args.models, "flora-taxa.json"), "w", encoding="utf-8"), ensure_ascii=False)
    man["flora"].update({"count": int(full.shape[0]), "count_original": int(original), "extra_template": template})
    for f in ["flora-taxa-f16.bin", "flora-taxa.json"]:
        p = os.path.join(args.models, f)
        man["files"][f"models/{f}"] = {"bytes": os.path.getsize(p), "sha256": sha256(p)}
    json.dump(man, open(man_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"Taula final: {full.shape[0]} espècies ({len(missing)} afegides)")


if __name__ == "__main__":
    main()
