"""Descarrega els models (revisions fixades) i els prepara per a la web.

Ús: python tools/fetch_models.py --out models [--cache .model-cache]

Sortida a --out:
  flora-fp16.onnx, flora-fp32.onnx   BioCLIP 2.5 destil·lat (FastViT), entrada 'image' [1,3,224,224]
  flora-taxa-f16.bin                 taula d'embeddings [n, dim] en float16
  flora-taxa.json                    noms científics, en el mateix ordre
  houseplants.onnx                   ViT de 47 plantes d'interior (quantitzat)
  houseplants-labels.json            etiquetes en ordre d'id
  manifest.json                      mides, sha256 i procedència
"""
import argparse
import hashlib
import json
import os
import shutil
import sys
import time
import urllib.request

import numpy as np

FLORA = {
    "repo": "crazedcodernate/bioclip-2.5-mobile-fastvit",
    "rev": "29b474ea2a5d72b4646f036ead9441e0a22a5c62",
    "license": "MIT",
}
HOUSE = {
    "repo": "onnx-community/house-plant-image-detection-ONNX",
    "rev": "24d519d5ce1dd1a44b159b4e1bef012d01f30b95",
    "license": "Apache-2.0",
    "variant": os.environ.get("HOUSE_VARIANT", "onnx/model_quantized.onnx"),
}


def download(repo, rev, path, cache_dir):
    url = f"https://huggingface.co/{repo}/resolve/{rev}/{path}"
    target = os.path.join(cache_dir, repo.replace("/", "__"), rev, path)
    if os.path.exists(target) and os.path.getsize(target) > 0:
        return target
    os.makedirs(os.path.dirname(target), exist_ok=True)
    for attempt in range(4):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "salut-plantes-build"})
            with urllib.request.urlopen(req, timeout=300) as res, open(target + ".part", "wb") as f:
                shutil.copyfileobj(res, f, length=1 << 20)
            os.replace(target + ".part", target)
            print(f"  descarregat {repo}/{path} ({os.path.getsize(target) / 1e6:.1f} MB)")
            return target
        except Exception as err:  # noqa: BLE001
            print(f"  intent {attempt + 1} fallit per {path}: {err}", file=sys.stderr)
            time.sleep(5 * (attempt + 1))
    raise SystemExit(f"No s'ha pogut descarregar {url}")


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="models")
    ap.add_argument("--cache", default=".model-cache")
    ap.add_argument("--eval-variants", action="store_true", help="descarrega altres variants per comparar-les als tests")
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)
    os.makedirs(args.cache, exist_ok=True)

    print("BioCLIP 2.5 (flora):")
    fp16 = download(FLORA["repo"], FLORA["rev"], "flora_student_fp16.onnx", args.cache)
    fp32 = download(FLORA["repo"], FLORA["rev"], "flora_student_fp32.onnx", args.cache)
    table = download(FLORA["repo"], FLORA["rev"], "taxa_table.npy", args.cache)
    labels = download(FLORA["repo"], FLORA["rev"], "taxa_labels.json", args.cache)
    readme = download(FLORA["repo"], FLORA["rev"], "README.md", args.cache)

    shutil.copyfile(fp16, os.path.join(args.out, "flora-fp16.onnx"))
    shutil.copyfile(fp32, os.path.join(args.out, "flora-fp32.onnx"))
    t = np.load(table).astype(np.float32)
    norms = np.linalg.norm(t, axis=1, keepdims=True)
    t = t / np.maximum(norms, 1e-8)
    t.astype("<f2").tofile(os.path.join(args.out, "flora-taxa-f16.bin"))
    names = [str(e["scientific"]) if isinstance(e, dict) else str(e) for e in json.load(open(labels, encoding="utf-8"))]
    if len(names) != t.shape[0]:
        raise SystemExit(f"Taula ({t.shape[0]}) i noms ({len(names)}) no quadren")
    json.dump(names, open(os.path.join(args.out, "flora-taxa.json"), "w", encoding="utf-8"), ensure_ascii=False)
    print(f"  taula {t.shape[0]} x {t.shape[1]}")

    print("Plantes d'interior:")
    house = download(HOUSE["repo"], HOUSE["rev"], HOUSE["variant"], args.cache)
    config = download(HOUSE["repo"], HOUSE["rev"], "config.json", args.cache)
    shutil.copyfile(house, os.path.join(args.out, "houseplants.onnx"))
    id2label = json.load(open(config, encoding="utf-8"))["id2label"]
    house_labels = [id2label[str(i)] for i in range(len(id2label))]
    json.dump(house_labels, open(os.path.join(args.out, "houseplants-labels.json"), "w", encoding="utf-8"), ensure_ascii=False)
    print(f"  {len(house_labels)} classes, variant {HOUSE['variant']}")

    if args.eval_variants:
        variants = {}
        for v in ["onnx/model.onnx", "onnx/model_fp16.onnx", "onnx/model_q4.onnx", "onnx/model_quantized.onnx"]:
            variants[v] = download(HOUSE["repo"], HOUSE["rev"], v, args.cache)
        json.dump({"house": variants}, open(os.path.join(args.cache, "eval.json"), "w"), indent=1)

    files = {}
    for name in ["flora-fp16.onnx", "flora-fp32.onnx", "flora-taxa-f16.bin", "flora-taxa.json", "houseplants.onnx", "houseplants-labels.json"]:
        p = os.path.join(args.out, name)
        files[f"models/{name}"] = {"bytes": os.path.getsize(p), "sha256": sha256(p)}
    # La mida del runtime de WASM també es fa servir per mostrar el progrés.
    for wasm in ["vendor/ort/ort-wasm-simd-threaded.asyncify.wasm", "vendor/ort/ort-wasm-simd-threaded.wasm"]:
        src = os.path.join("node_modules/onnxruntime-web/dist", os.path.basename(wasm))
        if os.path.exists(src):
            files[wasm] = {"bytes": os.path.getsize(src)}

    manifest = {
        "version": f"{FLORA['rev'][:7]}-{HOUSE['rev'][:7]}",
        "flora": {
            "model_fp16": "models/flora-fp16.onnx",
            "model_fp32": "models/flora-fp32.onnx",
            "table": "models/flora-taxa-f16.bin",
            "names": "models/flora-taxa.json",
            "dim": int(t.shape[1]),
            "count": int(t.shape[0]),
            "count_original": int(t.shape[0]),
            "source": f"https://huggingface.co/{FLORA['repo']}/tree/{FLORA['rev']}",
            "license": FLORA["license"],
        },
        "house": {
            "model": "models/houseplants.onnx",
            "labels": "models/houseplants-labels.json",
            "count": len(house_labels),
            "source": f"https://huggingface.co/{HOUSE['repo']}/tree/{HOUSE['rev']}",
            "license": HOUSE["license"],
        },
        "files": files,
    }
    json.dump(manifest, open(os.path.join(args.out, "manifest.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    shutil.copyfile(readme, os.path.join(args.out, "FLORA-MODEL-CARD.md"))
    total = sum(v["bytes"] for v in files.values())
    print(f"Fet: {total / 1e6:.1f} MB a {args.out}")


if __name__ == "__main__":
    main()
