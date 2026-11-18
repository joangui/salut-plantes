// Prova la identificació amb els models reals i fotos reals (Node + onnxruntime-node).
// Fa servir el mateix preprocessament i la mateixa lògica que l'app.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import sharp from "sharp";
import { SIZE, toCHW, l2normalize, f16ToF32, f32ArrayToF16, similarities, topKSoftmax, cosine } from "../preprocess.js";
import { plantInfo, normSci } from "../kb.js";
import { mergeCandidates, confidenceFromP } from "../logic.js";
import { fetchPhotos } from "./photos.mjs";

const ortMod = await import("onnxruntime-node");
const ort = ortMod.default ?? ortMod;

const man = JSON.parse(readFileSync("models/manifest.json", "utf8"));
const asU16 = (buf) => new Uint16Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
const table = f16ToF32(asU16(readFileSync(man.flora.table)));
const names = JSON.parse(readFileSync(man.flora.names, "utf8"));
const houseLabels = JSON.parse(readFileSync(man.house.labels, "utf8"));

const flora32 = await ort.InferenceSession.create(man.flora.model_fp32);
const house = await ort.InferenceSession.create(man.house.model);
let flora16 = null;
try { flora16 = await ort.InferenceSession.create(man.flora.model_fp16); } catch (err) { console.log(`fp16 a CPU: no carrega (${err.message.split("\n")[0]})`); }
for (const [label, s] of [["flora fp32", flora32], ["flora fp16", flora16], ["house", house]]) {
  if (s) console.log(`${label}: entrades ${JSON.stringify(s.inputNames)} sortides ${JSON.stringify(s.outputNames)}`);
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
function softmax(v) {
  const m = Math.max(...v);
  const e = v.map((x) => Math.exp(x - m));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map((x) => x / s);
}
const key2 = (s) => normSci(s).split(" ").slice(0, 2).join(" ");
const genus = (s) => normSci(s).split(" ")[0];

const photos = await fetchPhotos();
const rows = [];
let sp = 0, ge = 0, top3 = 0, merged = 0, mergedGenus = 0, f16agree = [];
for (const ph of photos) {
  const { data } = await sharp(ph.file).resize(SIZE, SIZE, { fit: "fill" }).removeAlpha().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const emb = l2normalize(await run(flora32, toCHW(data, "unit")));
  if (flora16) f16agree.push(cosine(emb, l2normalize(await run(flora16, toCHW(data, "unit")))));
  const flora = topKSoftmax(similarities(table, man.flora.dim, emb), 5, 100).map(({ i, p, s }) => ({ sci: names[i], p, cos: s }));
  const hp = softmax(Array.from(await run(house, toCHW(data, "vit"))));
  const houseTop = hp.map((p, k) => ({ label: houseLabels[k], p })).sort((a, b) => b.p - a.p).slice(0, 3);
  const cands = mergeCandidates({ flora, house: houseTop }, ph.setting);
  const ok1 = key2(flora[0].sci) === key2(ph.expected);
  const okG = genus(flora[0].sci) === genus(ph.expected);
  const ok3 = flora.slice(0, 3).some((c) => key2(c.sci) === key2(ph.expected));
  const okM = key2(cands[0].sci) === key2(ph.expected) || (ph.expected.split(" ").length === 1 && genus(cands[0].sci) === genus(ph.expected));
  const okMG = genus(cands[0].sci) === genus(ph.expected);
  sp += ok1; ge += okG; top3 += ok3; merged += okM; mergedGenus += okMG;
  const row = {
    photo: ph.title, expected: ph.expected, setting: ph.setting,
    floraTop: flora.slice(0, 3).map((c) => `${c.sci} ${(c.p * 100).toFixed(0)}%`),
    houseTop: `${houseTop[0].label} ${(houseTop[0].p * 100).toFixed(0)}%`,
    final: `${cands[0].sci} (${plantInfo(cands[0].sci).ca || "—"}) ${(cands[0].p * 100).toFixed(0)}% ${confidenceFromP(cands[0].p)}`,
    ok: okM ? "✔" : okMG ? "≈" : "✘",
  };
  rows.push(row);
  console.log(`${row.ok} ${ph.title.padEnd(24)} → ${row.final}\n    flora: ${row.floraTop.join(" | ")}\n    interior: ${row.houseTop}`);
}
const n = rows.length;
const pct = (x) => `${((100 * x) / n).toFixed(0)}%`;
console.log(`\nFotos: ${n}`);
console.log(`Model botànic: espècie top-1 ${pct(sp)}, gènere top-1 ${pct(ge)}, espècie dins top-3 ${pct(top3)}`);
console.log(`Resultat final de l'app: espècie ${pct(merged)}, gènere ${pct(mergedGenus)}`);
if (f16agree.length) console.log(`fp16 vs fp32 (cosinus mitjà): ${(f16agree.reduce((a, b) => a + b, 0) / f16agree.length).toFixed(4)}`);
mkdirSync("ci-artifacts", { recursive: true });
writeFileSync("ci-artifacts/light-results.json", JSON.stringify({ rows, summary: { n, sp, ge, top3, merged, mergedGenus } }, null, 1));
