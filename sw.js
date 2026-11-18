// Service worker: fa que l'app funcioni sense connexió.
// L'app es desa al primer accés; els models es desen la primera vegada que es fan servir.
const VERSION = "2026-11-18.2";
const SHELL_CACHE = `salut-plantes-shell-${VERSION}`;
const MODEL_CACHE = "salut-plantes-models-v1";

const SHELL = [
  "./",
  "index.html",
  "app.js",
  "kb.js",
  "logic.js",
  "preprocess.js",
  "ranking.js",
  "ml-worker.js",
  "gemma-worker.js",
  "manifest.webmanifest",
  "icons/favicon.svg",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/apple-touch-icon.png",
  "vendor/fonts/libre-caslon-display-400.woff2",
  "vendor/fonts/libre-caslon-text-400.woff2",
  "vendor/fonts/libre-caslon-text-400-italic.woff2",
  "vendor/fonts/libre-caslon-text-700.woff2",
  "vendor/fonts/libre-franklin-400.woff2",
  "vendor/fonts/libre-franklin-500.woff2",
  "vendor/fonts/libre-franklin-600.woff2",
  "vendor/fonts/libre-franklin-700.woff2",
  "vendor/fonts/courier-prime-400.woff2",
  "vendor/fonts/courier-prime-700.woff2",
  "vendor/ort/ort.webgpu.min.mjs",
  "vendor/ort/ort.wasm.min.mjs",
  "vendor/ort/ort-wasm-simd-threaded.asyncify.mjs",
  "vendor/ort/ort-wasm-simd-threaded.mjs",
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    await cache.addAll(SHELL);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith("salut-plantes-shell-") && key !== SHELL_CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone()).catch(() => {});
  return res;
}

// Respon de seguida amb la versió desada i l'actualitza en segon pla.
async function staleWhileRevalidate(event, cacheName, fallbackKey) {
  const cache = await caches.open(cacheName);
  const key = fallbackKey || event.request;
  const hit = await cache.match(key, { ignoreSearch: true });
  const update = fetch(event.request).then((res) => {
    if (res.ok) cache.put(key, res.clone()).catch(() => {});
    return res;
  }).catch(() => null);
  if (hit) {
    event.waitUntil(update);
    return hit;
  }
  const res = await update;
  return res || new Response("Sense connexió", { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } });
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Hugging Face: ho gestiona Transformers.js
  if (url.pathname.includes("/models/") || url.pathname.endsWith(".wasm")) {
    event.respondWith(cacheFirst(req, MODEL_CACHE));
  } else if (req.mode === "navigate") {
    event.respondWith(staleWhileRevalidate(event, SHELL_CACHE, "index.html"));
  } else {
    event.respondWith(staleWhileRevalidate(event, SHELL_CACHE));
  }
});
