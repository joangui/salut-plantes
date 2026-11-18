// Worker de l'anàlisi avançada: Gemma 4 E2B al dispositiu amb Transformers.js i WebGPU.
// Els fitxers del model es descarreguen un cop de Hugging Face (revisió fixada)
// i Transformers.js els desa a la memòria cau del navegador per funcionar sense connexió.
import { AutoProcessor, Gemma4ForConditionalGeneration, RawImage, TextStreamer, env } from "./vendor/transformers/transformers.min.js";

const BASE = new URL("./", self.location.href).href;
const MODEL_ID = "onnx-community/gemma-4-E2B-it-ONNX";
const REVISION = "6f21c99d7e18237f8d2ce92aadfdbfeba877f63a";

env.allowLocalModels = false;
env.useBrowserCache = true;
env.backends.onnx.wasm.wasmPaths = {
  mjs: new URL("vendor/ort/ort-wasm-simd-threaded.asyncify.mjs", BASE).href,
  wasm: new URL("vendor/ort/ort-wasm-simd-threaded.asyncify.wasm", BASE).href,
};

let processor = null;
let model = null;
let loading = null;
let dtype = null;

const post = (msg) => self.postMessage(msg);

async function pickDtype() {
  if (!self.navigator?.gpu) throw new Error("no-webgpu");
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw new Error("no-webgpu");
  return adapter.features.has("shader-f16") ? "q4f16" : "q4";
}

async function load() {
  if (model) return { dtype };
  if (loading) return loading;
  loading = (async () => {
    dtype = await pickDtype();
    const files = new Map();
    const progress_callback = (p) => {
      if (p.status === "progress" && p.file) {
        files.set(p.file, { loaded: p.loaded || 0, total: p.total || 0 });
        let loaded = 0, total = 0;
        for (const f of files.values()) { loaded += f.loaded; total += f.total; }
        post({ type: "progress", loaded, total });
      }
    };
    processor = await AutoProcessor.from_pretrained(MODEL_ID, { revision: REVISION, progress_callback });
    model = await Gemma4ForConditionalGeneration.from_pretrained(MODEL_ID, {
      revision: REVISION, dtype, device: "webgpu", progress_callback,
    });
    return { dtype };
  })();
  try {
    return await loading;
  } catch (err) {
    loading = null;
    model = null;
    throw err;
  }
}

async function analyze(images, prompt, maxTokens) {
  await load();
  const raws = await Promise.all(images.map((b) => RawImage.fromBlob(b)));
  const messages = [{ role: "user", content: [...raws.map(() => ({ type: "image" })), { type: "text", text: prompt }] }];
  const text = processor.apply_chat_template(messages, { enable_thinking: false, add_generation_prompt: true });
  const inputs = await processor(text, raws, null, { add_special_tokens: false });
  let partial = "";
  const streamer = new TextStreamer(processor.tokenizer, {
    skip_prompt: true,
    skip_special_tokens: true,
    callback_function: (t) => { partial += t; post({ type: "token", text: partial }); },
  });
  const out = await model.generate({ ...inputs, max_new_tokens: maxTokens || 600, do_sample: false, streamer });
  const decoded = processor.batch_decode(out.slice(null, [inputs.input_ids.dims.at(-1), null]), { skip_special_tokens: true });
  return decoded[0] || partial;
}

async function cachedState() {
  // Comprova si el model ja és a la memòria cau de Transformers.js.
  try {
    const cache = await caches.open("transformers-cache");
    const keys = await cache.keys();
    const hits = keys.filter((r) => r.url.includes(MODEL_ID) && r.url.includes(REVISION)).length;
    return { cachedFiles: hits };
  } catch {
    return { cachedFiles: 0 };
  }
}

self.onmessage = async (e) => {
  const { id, type } = e.data || {};
  try {
    if (type === "support") {
      let ok = false, f16 = false;
      try { f16 = (await pickDtype()) === "q4f16"; ok = true; } catch { ok = false; }
      post({ id, type: "result", result: { ok, f16, ...(await cachedState()) } });
    } else if (type === "load") {
      post({ id, type: "result", result: await load() });
    } else if (type === "analyze") {
      const text = await analyze(e.data.images, e.data.prompt, e.data.maxTokens);
      post({ id, type: "result", result: { text } });
    } else if (type === "clear") {
      model = null; processor = null; loading = null;
      try { await caches.delete("transformers-cache"); } catch { /* res a fer */ }
      post({ id, type: "result", result: true });
    }
  } catch (err) {
    post({ id, type: "error", message: String(err?.message || err) });
  }
};
