"""Copia els fitxers del lloc web a una carpeta (per defecte _site) per publicar-los."""
import os
import shutil
import sys

out = sys.argv[1] if len(sys.argv) > 1 else "_site"
FILES = [
    "index.html", "app.js", "kb.js", "logic.js", "preprocess.js", "ranking.js", "symptoms.js",
    "ml-worker.js", "gemma-worker.js", "sw.js", "manifest.webmanifest",
]
DIRS = ["icons", "vendor", "models"]

shutil.rmtree(out, ignore_errors=True)
os.makedirs(out)
for f in FILES:
    shutil.copy(f, out)
for d in DIRS:
    if not os.path.isdir(d):
        raise SystemExit(f"Falta la carpeta {d}: executa abans tools/vendor.mjs i tools/fetch_models.py")
    shutil.copytree(d, os.path.join(out, d))
open(os.path.join(out, ".nojekyll"), "w").close()
total = sum(os.path.getsize(os.path.join(r, f)) for r, _, fs in os.walk(out) for f in fs)
print(f"Lloc a {out}: {total / 1e6:.1f} MB")
