// Prova el detector de símptomes amb fotos que no ha vist mai (Node + onnxruntime-node, mateix codi que l'app).
// 1) Les 108 fotos de plantes de la prova d'identificació, gairebé totes sanes: quantes donen una falsa alarma.
// 2) Fotos de Wikipedia de plagues, fongs i fulles malmeses: quantes en troba.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import sharp from "sharp";
import { SIZE, toCHW, l2normalize, f16ToF32 } from "../preprocess.js";
import { loadSignModel, detectSigns, SIGNS } from "../symptoms.js";
import { fetchPhotos, SYMPTOM_PHOTOS } from "./photos.mjs";

const ortMod = await import("onnxruntime-node");
const ort = ortMod.default ?? ortMod;
const man = JSON.parse(readFileSync("models/manifest.json", "utf8"));
if (!man.symptoms) { console.log("No hi ha detector de símptomes al manifest."); process.exit(0); }
const model = loadSignModel(JSON.parse(readFileSync(man.symptoms.model, "utf8")));
const session = await ort.InferenceSession.create(man.flora.model_fp32);

async function embed(file) {
  const { data } = await sharp(file).resize(SIZE, SIZE, { fit: "fill" }).removeAlpha().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = await session.run({ [session.inputNames[0]]: new ort.Tensor("float32", toCHW(data, "unit"), [1, 3, SIZE, SIZE]) });
  const t = out[session.outputNames[0]];
  return l2normalize(t.type === "float16" ? f16ToF32(t.data) : Float32Array.from(t.data));
}
const fmt = (signs) => signs.map((s) => `${SIGNS[s.id].label}${s.level === "maybe" ? "?" : ""} ${Math.round(s.p * 100)}%`).join(", ") || "—";
const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : "—");

console.log(`Detector: ${model.classes.length - 1} classes (${model.classes.filter((c) => c !== "sana").join(", ")})`);
console.log("Llindars «es veu»: " + Object.entries(model.sure).map(([k, v]) => `${k} ${v == null ? "—" : v.toFixed(2)}`).join(", "));

// 1. Plantes (falses alarmes)
const plants = await fetchPhotos(".test-photos");
let fpSure = 0, fpMaybe = 0;
const plantRows = [];
for (const ph of plants) {
  const signs = detectSigns(model, [await embed(ph.file)]);
  const sure = signs.filter((s) => s.level === "sure");
  if (sure.length) fpSure++;
  else if (signs.length) fpMaybe++;
  if (signs.length) console.log(`  ${sure.length ? "!" : "?"} ${ph.title.padEnd(26)} ${fmt(signs)}`);
  plantRows.push({ photo: ph.title, signs });
}
console.log(`Plantes: ${plants.length} fotos · amb algun «es veu»: ${fpSure} (${pct(fpSure, plants.length)}) · només «potser»: ${fpMaybe} (${pct(fpMaybe, plants.length)})`);

// 2. Símptomes (encerts)
const sym = await fetchPhotos(".test-photos/simptomes", SYMPTOM_PHOTOS);
const byClass = {};
const symRows = [];
for (const ph of sym) {
  const signs = detectSigns(model, [await embed(ph.file)]);
  const known = model.classes.includes(ph.expected);
  const hit = signs.find((s) => s.id === ph.expected);
  const mark = !known ? "·" : hit?.level === "sure" ? "✔" : hit ? "≈" : "✘";
  console.log(`  ${mark} ${ph.title.padEnd(26)} esperat ${SIGNS[ph.expected]?.label || ph.expected}${known ? "" : " (fora del detector)"} → ${fmt(signs)}`);
  if (known) {
    const c = (byClass[ph.expected] ||= { n: 0, sure: 0, any: 0 });
    c.n++; c.sure += hit?.level === "sure" ? 1 : 0; c.any += hit ? 1 : 0;
  }
  symRows.push({ photo: ph.title, expected: ph.expected, signs });
}
const tot = Object.values(byClass).reduce((a, c) => ({ n: a.n + c.n, sure: a.sure + c.sure, any: a.any + c.any }), { n: 0, sure: 0, any: 0 });
console.log(`Símptomes: ${tot.n} fotos · trobats segur: ${tot.sure} (${pct(tot.sure, tot.n)}) · segur o potser: ${tot.any} (${pct(tot.any, tot.n)})`);
for (const [k, c] of Object.entries(byClass)) console.log(`  ${k.padEnd(13)} ${c.sure}/${c.n} segur · ${c.any}/${c.n} amb «potser»`);
mkdirSync("ci-artifacts", { recursive: true });
writeFileSync("ci-artifacts/symptom-results.json", JSON.stringify({ plants: plantRows, symptoms: symRows, byClass }, null, 1));
