// Worker que identifica plantes al dispositiu amb ONNX Runtime Web.
// Models: BioCLIP 2.5 destil·lat (4.271 espècies + les de la guia) i un classificador de plantes d'interior (47 classes).
import { SIZE, toCHW, l2normalize, meanVectors, cosine, f16ToF32, f32ArrayToF16, similarities } from "./preprocess.js";
import { FLORA_PRIOR, floraPrior, rankFlora, houseProbs } from "./ranking.js";

const BASE = new URL("./", self.location.href).href;
const MODEL_CACHE = "salut-plantes-models-v1";

let ort = null;
let backend = null; // "webgpu" | "wasm"
let hasF16 = false;
let manifest = null;
const sessions = {};
let taxa = null;
let taxaDim = 1024;
let names = null;
let prior = null;
let houseLabels = null;

const post = (msg) => self.postMessage(msg);

/* ---------- descàrregues amb memòria cau ---------- */

async function openCache() {
  try { return self.caches ? await caches.open(MODEL_CACHE) : null; } catch { return null; }
}

async function isCached(path) {
  const cache = await openCache();
  if (!cache) return false;
  return !!(await cache.match(new URL(path, BASE).href));
}

// Descarrega (o llegeix de la memòria cau) i informa del progrés.
async function getBytes(path, onBytes) {
  const url = new URL(path, BASE).href;
  const cache = await openCache();
  if (cache) {
    const hit = await cache.match(url);
    if (hit) {
      const buf = await hit.arrayBuffer();
      onBytes?.(buf.byteLength, true);
      return buf;
    }
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No s'ha pogut descarregar ${path} (${res.status})`);
  let buf;
  if (res.body && onBytes) {
    const reader = res.body.getReader();
    const chunks = [];
    let got = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      got += value.byteLength;
      onBytes(value.byteLength, false);
    }
    const all = new Uint8Array(got);
    let off = 0;
    for (const c of chunks) { all.set(c, off); off += c.byteLength; }
    buf = all.buffer;
  } else {
    buf = await res.arrayBuffer();
    onBytes?.(buf.byteLength, false);
  }
  if (cache) {
    try {
      await cache.put(url, new Response(buf.slice(0), { headers: { "content-type": res.headers.get("content-type") || "application/octet-stream" } }));
    } catch { /* sense espai: es farà servir igualment */ }
  }
  return buf;
}

async function getJSON(path) {
  const buf = await getBytes(path);
  return JSON.parse(new TextDecoder().decode(buf));
}

/* ---------- ONNX Runtime ---------- */

async function initRuntime() {
  if (ort) return;
  let adapter = null;
  if (self.navigator?.gpu) {
    try { adapter = await navigator.gpu.requestAdapter(); } catch { adapter = null; }
  }
  backend = adapter ? "webgpu" : "wasm";
  hasF16 = !!adapter?.features?.has?.("shader-f16");
  const variant = backend === "webgpu" ? ".asyncify" : "";
  ort = await import(new URL(backend === "webgpu" ? "vendor/ort/ort.webgpu.min.mjs" : "vendor/ort/ort.wasm.min.mjs", BASE).href);
  const wasmPath = `vendor/ort/ort-wasm-simd-threaded${variant}.wasm`;
  ort.env.wasm.wasmPaths = {
    mjs: new URL(`vendor/ort/ort-wasm-simd-threaded${variant}.mjs`, BASE).href,
    wasm: new URL(wasmPath, BASE).href,
  };
  ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 2) : 1;
  ort.env.wasm.proxy = false;
  manifest = await getJSON("models/manifest.json");
}

function plan(parts) {
  const files = [];
  const wasmVariant = backend === "webgpu" ? ".asyncify" : "";
  files.push(`vendor/ort/ort-wasm-simd-threaded${wasmVariant}.wasm`);
  if (parts.includes("flora")) {
    files.push(floraModelPath(), manifest.flora.table, manifest.flora.names);
  }
  if (parts.includes("house")) files.push(manifest.house.model, manifest.house.labels);
  return files;
}

function floraModelPath() {
  return backend === "webgpu" && hasF16 ? manifest.flora.model_fp16 : manifest.flora.model_fp32;
}

function sizeOf(path) {
  return manifest?.files?.[path]?.bytes || 0;
}

async function createSession(path, buf) {
  const providers = backend === "webgpu" ? ["webgpu", "wasm"] : ["wasm"];
  try {
    return await ort.InferenceSession.create(new Uint8Array(buf), { executionProviders: providers, graphOptimizationLevel: "all" });
  } catch (err) {
    if (backend !== "webgpu") throw err;
    // Si la GPU falla, torna a provar amb WASM.
    return await ort.InferenceSession.create(new Uint8Array(buf), { executionProviders: ["wasm"], graphOptimizationLevel: "all" });
  }
}

async function prepare(parts, reportProgress = true) {
  await initRuntime();
  const files = plan(parts);
  const total = files.reduce((a, f) => a + sizeOf(f), 0);
  let loaded = 0;
  const onBytes = (n) => {
    loaded += n;
    if (reportProgress) post({ type: "progress", loaded: Math.min(loaded, total), total });
  };
  const wasmVariant = backend === "webgpu" ? ".asyncify" : "";
  if (!ort.env.wasm.wasmBinary) {
    ort.env.wasm.wasmBinary = await getBytes(`vendor/ort/ort-wasm-simd-threaded${wasmVariant}.wasm`, onBytes);
  }
  if (parts.includes("flora") && !sessions.flora) {
    const modelPath = floraModelPath();
    const [modelBuf, tableBuf, namesBuf] = await Promise.all([
      getBytes(modelPath, onBytes),
      getBytes(manifest.flora.table, onBytes),
      getBytes(manifest.flora.names, onBytes),
    ]);
    taxaDim = manifest.flora.dim;
    taxa = f16ToF32(new Uint16Array(tableBuf));
    names = JSON.parse(new TextDecoder().decode(namesBuf));
    prior = floraPrior(names, FLORA_PRIOR);
    sessions.flora = await createSession(modelPath, modelBuf);
    sessions.floraIsF16 = modelPath === manifest.flora.model_fp16;
  }
  if (parts.includes("house") && !sessions.house) {
    const [modelBuf, labelsBuf] = await Promise.all([
      getBytes(manifest.house.model, onBytes),
      getBytes(manifest.house.labels, onBytes),
    ]);
    houseLabels = JSON.parse(new TextDecoder().decode(labelsBuf));
    sessions.house = await createSession(manifest.house.model, modelBuf);
  }
  return { backend, f16: hasF16 };
}

/* ---------- imatges ---------- */

async function pixels(blob) {
  const bmp = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(SIZE, SIZE);
  const g = canvas.getContext("2d", { willReadFrequently: true });
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = "high";
  g.drawImage(bmp, 0, 0, SIZE, SIZE);
  bmp.close?.();
  return g.getImageData(0, 0, SIZE, SIZE).data;
}

function inputTensor(session, data) {
  const name = session.inputNames[0];
  const meta = session.inputMetadata?.find?.((m) => m.name === name) || session.inputMetadata?.[0];
  const wantsF16 = meta?.type === "float16";
  const tensor = wantsF16
    ? new ort.Tensor("float16", f32ArrayToF16(data), [1, 3, SIZE, SIZE])
    : new ort.Tensor("float32", data, [1, 3, SIZE, SIZE]);
  return { [name]: tensor };
}

async function runVector(session, data) {
  const out = await session.run(inputTensor(session, data));
  const t = out[session.outputNames[0]];
  const values = t.type === "float16" ? (t.data instanceof Uint16Array ? f16ToF32(t.data) : Float32Array.from(t.data)) : Float32Array.from(t.data);
  return values;
}

async function classify(images, useHouse) {
  // La primera anàlisi ho descarrega tot, perquè després l'app funcioni sense connexió.
  await prepare(["flora", "house"], true);
  const t0 = performance.now();
  const embeds = [];
  const houseRuns = [];
  for (const blob of images) {
    const rgba = await pixels(blob);
    embeds.push(l2normalize(await runVector(sessions.flora, toCHW(rgba, "unit"))));
    if (useHouse) houseRuns.push(houseProbs(await runVector(sessions.house, toCHW(rgba, "vit"))));
  }
  const mean = l2normalize(meanVectors(embeds));
  const flora = rankFlora(similarities(taxa, taxaDim, mean), prior, 8)
    .map(({ i, p, s }) => ({ sci: names[i], p, cos: s }));
  const perPhoto = embeds.map((e) => {
    const [top] = rankFlora(similarities(taxa, taxaDim, e), prior, 1);
    return { sci: names[top.i], p: top.p };
  });
  let minPair = 1;
  for (let a = 0; a < embeds.length; a++) for (let b = a + 1; b < embeds.length; b++) minPair = Math.min(minPair, cosine(embeds[a], embeds[b]));
  let house = [];
  if (useHouse && houseRuns.length) {
    const avg = houseRuns[0].map((_, k) => houseRuns.reduce((acc, p) => acc + p[k], 0) / houseRuns.length);
    house = avg.map((p, k) => ({ label: houseLabels[k], p })).sort((a, b) => b.p - a.p).slice(0, 3);
  }
  return { backend, flora, perPhoto, minPair, house, ms: Math.round(performance.now() - t0) };
}

/* ---------- missatges ---------- */

self.onmessage = async (e) => {
  const { id, type } = e.data || {};
  try {
    if (type === "status") {
      await initRuntime();
      const files = plan(["flora", "house"]);
      const cached = await Promise.all(files.map(isCached));
      const total = files.reduce((a, f) => a + sizeOf(f), 0);
      const missing = files.filter((_, i) => !cached[i]).reduce((a, f) => a + sizeOf(f), 0);
      post({ id, type: "result", result: { backend, f16: hasF16, total, missing, ready: missing === 0 } });
    } else if (type === "prepare") {
      const r = await prepare(e.data.parts || ["flora", "house"], true);
      post({ id, type: "result", result: r });
    } else if (type === "classify") {
      const r = await classify(e.data.images, !!e.data.useHouse);
      post({ id, type: "result", result: r });
    } else if (type === "clear") {
      if (self.caches) await caches.delete(MODEL_CACHE);
      post({ id, type: "result", result: true });
    }
  } catch (err) {
    post({ id, type: "error", message: String(err?.message || err) });
  }
};
