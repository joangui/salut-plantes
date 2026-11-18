// Prova manual de l'anàlisi avançada: Gemma 4 E2B a CPU (Node) amb el mateix prompt que l'app.
// Lent (diversos minuts) i descarrega uns 3,7 GB: només s'executa a mà des de GitHub Actions.
import { AutoProcessor, Gemma4ForConditionalGeneration, RawImage, env } from "@huggingface/transformers";
import { buildGemmaPrompt, parseGemma } from "../logic.js";
import { fetchPhotos, PHOTOS } from "./photos.mjs";

const MODEL_ID = "onnx-community/gemma-4-E2B-it-ONNX";
const REVISION = "6f21c99d7e18237f8d2ce92aadfdbfeba877f63a";
if (process.env.HF_CACHE_DIR) env.cacheDir = process.env.HF_CACHE_DIR;

PHOTOS.splice(0, PHOTOS.length,
  ["Lemon", "Citrus × limon", "pot"],
  ["Aphid", "aphids", "pot"],
  ["Powdery_mildew", "powdery mildew", "pot"],
  ["Monstera_deliciosa", "Monstera deliciosa", "indoors"],
);
const photos = await fetchPhotos();

let t = Date.now();
const processor = await AutoProcessor.from_pretrained(MODEL_ID, { revision: REVISION });
const model = await Gemma4ForConditionalGeneration.from_pretrained(MODEL_ID, { revision: REVISION, dtype: "q4", device: "cpu" });
console.log(`Model carregat en ${((Date.now() - t) / 1000).toFixed(0)} s`);

for (const ph of photos) {
  t = Date.now();
  const image = await RawImage.read(ph.file);
  const prompt = buildGemmaPrompt({ symptoms: [], photoCount: 1, location: "Barcelona", iso: "2026-11-18", setting: ph.setting }, []);
  const messages = [{ role: "user", content: [{ type: "image" }, { type: "text", text: prompt }] }];
  const text = processor.apply_chat_template(messages, { enable_thinking: false, add_generation_prompt: true });
  const inputs = await processor(text, [image], null, { add_special_tokens: false });
  const out = await model.generate({ ...inputs, max_new_tokens: 600, do_sample: false });
  const decoded = processor.batch_decode(out.slice(null, [inputs.input_ids.dims.at(-1), null]), { skip_special_tokens: true })[0];
  console.log(`\n=== ${ph.title} (esperat: ${ph.expected}) · ${((Date.now() - t) / 1000).toFixed(0)} s`);
  console.log(decoded);
  console.log("Interpretat:", JSON.stringify(parseGemma(decoded), null, 1));
}
