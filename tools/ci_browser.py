"""Prova de punta a punta al navegador (Chromium sense GPU, per tant amb WASM).

Comprova la primera anàlisi (descàrrega de models) i una segona anàlisi sense connexió.
Ús: python tools/ci_browser.py _site
"""
import functools
import http.server
import json
import os
import sys
import threading

from playwright.sync_api import sync_playwright

SITE = sys.argv[1] if len(sys.argv) > 1 else "_site"
PHOTOS = ".test-photos"
OUT = "ci-artifacts"
PORT = 8765
os.makedirs(OUT, exist_ok=True)


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


Quiet.extensions_map = {
    **http.server.SimpleHTTPRequestHandler.extensions_map,
    ".mjs": "text/javascript", ".js": "text/javascript", ".wasm": "application/wasm",
    ".webmanifest": "application/manifest+json", ".woff2": "font/woff2",
}
handler = functools.partial(Quiet, directory=SITE)
server = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), handler)
threading.Thread(target=server.serve_forever, daemon=True).start()


def report(page):
    return page.evaluate("""() => ({
      name: document.querySelector('#sheets .binomial')?.textContent,
      common: document.querySelector('#sheets .common')?.textContent,
      stamp: document.querySelector('#sheets .stamp')?.textContent,
      status: document.querySelector('#sheets .status-pill')?.textContent,
      issues: document.querySelectorAll('#sheets .issue').length,
      tips: document.querySelectorAll('#sheets .tip').length,
      notes: [...document.querySelectorAll('#notes .pnote')].map(n => n.textContent),
      took: document.querySelector('#status-text')?.textContent,
    })""")


problems = []
with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={"width": 1280, "height": 900})
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.goto(f"http://127.0.0.1:{PORT}/")
    page.wait_for_function("document.querySelector('#models-chip').textContent.includes('Cal descarregar')", timeout=60000)
    print("Estat inicial:", page.inner_text("#models-chip"))

    page.click("#set-ground")
    page.click("#sym-pugo")
    page.set_input_files("#file-input", os.path.join(PHOTOS, "Olive.jpg"))
    page.wait_for_function("document.querySelectorAll('.slot.filled').length === 1")
    page.click("#analyze")
    page.wait_for_function("document.querySelector('#status-text').textContent.startsWith('Informe llest')", timeout=300000)
    r1 = report(page)
    print("Primera anàlisi:", json.dumps(r1, ensure_ascii=False))
    page.screenshot(path=os.path.join(OUT, "1-informe.png"), full_page=True)

    page.wait_for_function("navigator.serviceWorker.controller !== null", timeout=60000)
    page.wait_for_function("document.querySelector('#models-chip').textContent.includes('sense connexió')", timeout=60000)

    ctx.set_offline(True)
    page.reload()
    page.wait_for_function("document.querySelector('#net-chip').textContent.includes('Sense connexió')", timeout=30000)
    page.wait_for_function("document.querySelector('#models-chip').textContent.includes('sense connexió')", timeout=60000)
    page.click("#set-indoors")
    page.set_input_files("#file-input", os.path.join(PHOTOS, "Monstera_deliciosa.jpg"))
    page.wait_for_function("document.querySelectorAll('.slot.filled').length === 1")
    page.click("#analyze")
    page.wait_for_function("document.querySelector('#status-text').textContent.startsWith('Informe llest')", timeout=300000)
    r2 = report(page)
    print("Sense connexió:", json.dumps(r2, ensure_ascii=False))
    page.screenshot(path=os.path.join(OUT, "2-sense-connexio.png"), full_page=True)

    page.set_viewport_size({"width": 390, "height": 844})
    page.screenshot(path=os.path.join(OUT, "3-mobil.png"), full_page=True)

    real_errors = [e for e in errors if "favicon" not in e]
    if real_errors:
        print("Errors a la consola:", real_errors)
        problems.append("errors a la consola")
    if not r1["name"] or not r2["name"]:
        problems.append("informe buit")
    browser.close()

server.shutdown()
print("PROBLEMES:", problems or "cap")
sys.exit(1 if problems else 0)
