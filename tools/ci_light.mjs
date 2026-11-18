// Prova la identificació amb els models reals i fotos reals (Node + onnxruntime-node).
// Compara estratègies per triar la que fa servir l'app. Mateix preprocessament que el navegador.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import sharp from "sharp";
import { SIZE, toCHW, l2normalize, f16ToF32, f32ArrayToF16, similarities, cosine } from "../preprocess.js";
import { HOUSEPLANT_SCI, normSci } from "../kb.js";
import { mergeCandidates } from "../logic.js";
import { fetchPhotos } from "./photos.mjs";
import { floraPrior, floraMembership, rankFlora } from "../ranking.js";

const ortMod = await import("onnxruntime-node");
const ort = ortMod.default ?? ortMod;

const man = JSON.parse(readFileSync("models/manifest.json", "utf8"));
const dim = man.flora.dim;
const asU16 = (buf) => new Uint16Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
const table = f16ToF32(asU16(readFileSync(man.flora.table)));
const names = JSON.parse(readFileSync(man.flora.names, "utf8"));
const nOrig = man.flora.count_original || names.length;
const houseLabels = JSON.parse(readFileSync(man.house.labels, "utf8"));
console.log(`Taula: ${names.length} espècies (${names.length - nOrig} afegides de la guia, plantilla ${man.flora.extra_template || "—"})`);

const flora32 = await ort.InferenceSession.create(man.flora.model_fp32);
const flora16 = await ort.InferenceSession.create(man.flora.model_fp16).catch(() => null);
const houseSessions = { "desplegat": await ort.InferenceSession.create(man.house.model) };
if (existsSync(".model-cache/eval.json")) {
  const ev = JSON.parse(readFileSync(".model-cache/eval.json", "utf8"));
  for (const [k, path] of Object.entries(ev.house || {})) houseSessions[k] = await ort.InferenceSession.create(path);
}

async function run(session, data) {
  const name = session.inputNames[0];
  let out;
  try {
    out = await session.run({ [name]: new ort.Tensor("float32", data, [1, 3, SIZE, SIZE]) });
  } catch (err) {
    if (!/float16|type/i.test(err.message)) throw err;
    out = await session.run({ [name]: new ort.Tensor("float16", f32ArrayToF16(data), [1, 3, SIZE, SIZE]) });
  }
  const t = out[session.outputNames[0]];
  return t.type === "float16" ? f16ToF32(t.data) : Float32Array.from(t.data);
}
const softmax = (v) => { const m = Math.max(...v); const e = v.map((x) => Math.exp(x - m)); const s = e.reduce((a, b) => a + b, 0); return e.map((x) => x / s); };
const key2 = (s) => normSci(s).split(" ").slice(0, 2).join(" ");
const genus = (s) => normSci(s).split(" ")[0];
const matches = (sci, expected) => (expected.split(" ").length === 1 ? genus(sci) === genus(expected) : key2(sci) === key2(expected));

// Estratègies d'ordenació a comparar
const membership = floraMembership(names);
console.log(`A la guia: ${membership.filter((m) => m === 2).length} espècies i ${membership.filter((m) => m === 1).length} més del mateix gènere`);
const strategies = {
  "original (4.271)": { rows: nOrig, prior: null },
  "ampliada": { rows: names.length, prior: null },
  "ampliada + preferència suau (×3, ×1,5)": { rows: names.length, prior: floraPrior(names, { species: 3, genus: 1.5 }) },
  "ampliada + preferència (×10, ×3)": { rows: names.length, prior: floraPrior(names, { species: 10, genus: 3 }) },
  "ampliada + preferència forta (×30, ×5)": { rows: names.length, prior: floraPrior(names, { species: 30, genus: 5 }) },
  "només la guia": { rows: names.length, prior: Float32Array.from(membership, (m) => (m > 0 ? 0 : -Infinity)) },
};

const photos = await fetchPhotos();
const tally = Object.fromEntries(Object.keys(strategies).map((k) => [k, { sp: 0, ge: 0 }]));
const houseTally = Object.fromEntries(Object.keys(houseSessions).map((k) => [k, { ok: 0, n: 0, maxp: 0, margin: 0 }]));
const rows = [];
let f16cos = [];
for (const ph of photos) {
  const { data } = await sharp(ph.file).resize(SIZE, SIZE, { fit: "fill" }).removeAlpha().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const emb = l2normalize(await run(flora32, toCHW(data, "unit")));
  if (flora16) f16cos.push(cosine(emb, l2normalize(await run(flora16, toCHW(data, "unit")))));
  const sims = similarities(table, dim, emb);
  const detail = {};
  for (const [k, st] of Object.entries(strategies)) {
    const top = rankFlora(sims.subarray(0, st.rows), st.prior ? st.prior.slice(0, st.rows) : null, 3).map((c) => ({ sci: names[c.i], p: c.p }));
    tally[k].sp += matches(top[0].sci, ph.expected) && ph.expected.split(" ").length > 1 ? 1 : 0;
    tally[k].ge += genus(top[0].sci) === genus(ph.expected) ? 1 : 0;
    detail[k] = top;
  }
  const expectedIdx = names.findIndex((n) => key2(n) === key2(ph.expected));
  const expectedCos = expectedIdx >= 0 ? sims[expectedIdx] : null;
  const houseOut = {};
  for (const [k, s] of Object.entries(houseSessions)) {
    const logits = Array.from(await run(s, toCHW(data, "vit")));
    const p = softmax(logits);
    const order = p.map((v, i) => i).sort((a, b) => p[b] - p[a]);
    houseOut[k] = { label: houseLabels[order[0]], p: p[order[0]], margin: logits[order[0]] - logits[order[1]] };
    if (ph.setting === "indoors") {
      const t = houseTally[k];
      t.n++; t.maxp += p[order[0]]; t.margin += logits[order[0]] - logits[order[1]];
      if (matches(HOUSEPLANT_SCI[houseLabels[order[0]]] || "", ph.expected)) t.ok++;
    }
  }
  const pick = detail["ampliada + preferència (×10, ×3)"];
  const h = houseOut["desplegat"];
  const cands = mergeCandidates({ flora: pick, house: [{ label: h.label, p: h.p, margin: h.margin }] }, ph.setting);
  rows.push({ photo: ph.title, expected: ph.expected, detail, house: houseOut, final: cands[0] });
  const ok = (sci) => (matches(sci, ph.expected) ? "✔" : genus(sci) === genus(ph.expected) ? "≈" : "✘");
  console.log(`${ph.title.padEnd(24)} esperat ${ph.expected}${expectedIdx < 0 ? " (no és a la taula)" : ` · cos esperat ${expectedCos.toFixed(3)}`}`);
  for (const k of ["original (4.271)", "ampliada", "ampliada + preferència (×10, ×3)", "només la guia"]) {
    console.log(`   ${ok(detail[k][0].sci)} ${k.padEnd(34)} ${detail[k].map((c) => `${c.sci} ${(c.p * 100).toFixed(0)}%`).join(" | ")}`);
  }
  console.log(`   interior: ${Object.entries(houseOut).map(([k, h]) => `${k.replace("onnx/", "")}: ${h.label} ${(h.p * 100).toFixed(0)}% Δ${h.margin.toFixed(2)}`).join(" · ")}`);
}

const n = photos.length;
const nSp = photos.filter((p) => p.expected.split(" ").length > 1).length;
console.log(`\nFotos: ${n} (${nSp} amb espècie concreta)`);
for (const [k, t] of Object.entries(tally)) console.log(`  ${k.padEnd(40)} espècie ${((100 * t.sp) / nSp).toFixed(0)}% · gènere ${((100 * t.ge) / n).toFixed(0)}%`);
console.log("Model d'interior (fotos d'interior):");
for (const [k, t] of Object.entries(houseTally)) if (t.n) console.log(`  ${k.padEnd(28)} encerts ${t.ok}/${t.n} · prob. màx. mitjana ${(t.maxp / t.n).toFixed(2)} · marge mitjà ${(t.margin / t.n).toFixed(2)}`);
if (f16cos.length) console.log(`fp16 vs fp32 (cosinus mitjà): ${(f16cos.reduce((a, b) => a + b, 0) / f16cos.length).toFixed(4)}`);
mkdirSync("ci-artifacts", { recursive: true });
writeFileSync("ci-artifacts/light-results.json", JSON.stringify({ tally, houseTally, rows }, null, 1));
