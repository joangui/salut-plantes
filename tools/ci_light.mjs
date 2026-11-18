// Prova la identificació amb els models reals i fotos reals (Node + onnxruntime-node).
// 1) Busca els paràmetres de l'app: pes de les plantes de la guia, temperatura i pes del model d'interior.
// 2) Mostra com funciona la configuració que fa servir l'app, foto per foto.
// Mateix preprocessament i mateix codi d'ordenació que el navegador.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import sharp from "sharp";
import { SIZE, toCHW, l2normalize, f16ToF32, f32ArrayToF16, similarities, cosine } from "../preprocess.js";
import { normSci } from "../kb.js";
import { mergeCandidates, confidenceFromP, HOUSE_WEIGHT } from "../logic.js";
import { fetchPhotos } from "./photos.mjs";
import { FLORA_PRIOR, HOUSE_TEMP, floraPrior, floraMembership, rankFlora, houseProbs } from "../ranking.js";

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
const houseSession = await ort.InferenceSession.create(man.house.model);

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

const key2 = (s) => normSci(s).split(" ").slice(0, 2).join(" ");
const genus = (s) => normSci(s).split(" ")[0];
const isGenus = (s) => normSci(s).split(" ").length === 1;
const matches = (sci, expected) => !!sci && (isGenus(expected) ? genus(sci) === genus(expected) : key2(sci) === key2(expected));
const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : "—").padStart(4);

/* ---------- 1. Inferència, una vegada per foto ---------- */

const photos = await fetchPhotos();
const items = [];
const f16cos = [];
for (const ph of photos) {
  const { data: rgba } = await sharp(ph.file).resize(SIZE, SIZE, { fit: "fill" }).removeAlpha().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const emb = l2normalize(await run(flora32, toCHW(rgba, "unit")));
  if (flora16) f16cos.push(cosine(emb, l2normalize(await run(flora16, toCHW(rgba, "unit")))));
  const m = floraMembership([ph.expected])[0];
  items.push({
    ...ph,
    sims: similarities(table, dim, emb),
    logits: await run(houseSession, toCHW(rgba, "vit")),
    guia: m === 2 || (isGenus(ph.expected) && m >= 1),
    inTable: names.some((n) => matches(n, ph.expected)),
  });
}
const N = items.length;
const nGuia = items.filter((it) => it.guia).length;
console.log(`Fotos: ${N} (${nGuia} de plantes de la guia, ${N - nGuia} de fora; ${items.filter((it) => !it.inTable).length} sense l'espècie a la taula)`);

/* ---------- 2. Pes de les plantes de la guia (només el model botànic) ---------- */

const floraGrid = [];
for (const S of [1, 10, 30, 100, 300, 1000, 3000]) for (const G of [1, 3, 10, 30, 100]) if (G <= S) floraGrid.push({ species: S, genus: G, other: 1 });
for (const S of [1, 3, 10, 30]) floraGrid.push({ species: S, genus: 1, other: 0 });
const cfgName = (c) => (c.other === 0 ? `només guia (espècie ×${c.species})` : `espècie ×${c.species}, gènere ×${c.genus}`);
const sameCfg = (a, b) => a.species === b.species && a.genus === b.genus && (a.other ?? 1) === (b.other ?? 1);
if (!floraGrid.some((c) => sameCfg(c, FLORA_PRIOR))) floraGrid.push({ other: 1, ...FLORA_PRIOR });

const floraTops = floraGrid.map((cfg) => {
  const prior = floraPrior(names, cfg);
  return items.map((it) => rankFlora(it.sims, prior, 8).map(({ i, p, s }) => ({ sci: names[i], p, cos: s })));
});

console.log("\nModel botànic sol, primera opció (guia: espècie · entre les 3 primeres | fora: espècie):");
const floraRows = floraGrid.map((cfg, k) => {
  let g1 = 0, g3 = 0, f1 = 0;
  items.forEach((it, j) => {
    const top = floraTops[k][j];
    if (it.guia) { g1 += matches(top[0].sci, it.expected); g3 += top.slice(0, 3).some((c) => matches(c.sci, it.expected)); }
    else f1 += matches(top[0].sci, it.expected);
  });
  return { cfg, g1, g3, f1 };
});
for (const r of floraRows) {
  const mark = sameCfg(r.cfg, FLORA_PRIOR) ? " ← app" : "";
  console.log(`  ${cfgName(r.cfg).padEnd(30)} guia ${pct(r.g1, nGuia)} · top-3 ${pct(r.g3, nGuia)} | fora ${pct(r.f1, N - nGuia)}${mark}`);
}

/* ---------- 3. Model d'interior: temperatura i pes segons on és la planta ---------- */

const temps = [...new Set([1, 0.5, 0.35, 0.25, HOUSE_TEMP])];
const houseTops = Object.fromEntries(temps.map((T) => [T, items.map((it) => {
  const p = houseProbs(it.logits, T);
  return p.map((v, i) => ({ label: houseLabels[i], p: v })).sort((a, b) => b.p - a.p).slice(0, 3);
})]));
const wIn = [0.5, 0.65, 0.8], wUnk = [0, 0.2, 0.35, 0.5], wPot = [0, 0.15, 0.25, 0.4];

function evaluate(k, T, W) {
  let real = 0, unk = 0, guia = 0, fora = 0;
  items.forEach((it, j) => {
    const res = { flora: floraTops[k][j], house: houseTops[T][j] };
    const a = matches(mergeCandidates(res, it.setting, W)[0]?.sci, it.expected);
    const b = matches(mergeCandidates(res, "", W)[0]?.sci, it.expected);
    real += a; unk += b;
    if (it.guia) guia += a; else fora += a;
  });
  return { real, unk, guia, fora };
}

const joint = [];
floraGrid.forEach((cfg, k) => {
  for (const T of temps) for (const a of wIn) for (const b of wUnk) for (const c of wPot) {
    const W = { indoors: a, "": b, pot: c, ground: 0 };
    joint.push({ cfg, T, W, ...evaluate(k, T, W) });
  }
});
joint.sort((x, y) => y.real + y.unk - (x.real + x.unk) || y.real - x.real);
const fmtW = (W) => `interior ${W.indoors} · ? ${W[""]} · test ${W.pot}`;
console.log(`\nCombinació dels dos models (${joint.length} provades). Encerts amb el lloc real | amb el lloc «no ho sé»:`);
for (const r of joint.slice(0, 15)) {
  console.log(`  ${cfgName(r.cfg).padEnd(30)} T ${String(r.T).padEnd(4)} ${fmtW(r.W).padEnd(34)} real ${pct(r.real, N)} (guia ${pct(r.guia, nGuia)}, fora ${pct(r.fora, N - nGuia)}) | ? ${pct(r.unk, N)}`);
}
const appK = floraGrid.findIndex((c) => sameCfg(c, FLORA_PRIOR));
const appScore = evaluate(appK, HOUSE_TEMP, HOUSE_WEIGHT);
const rank = joint.filter((r) => r.real + r.unk > appScore.real + appScore.unk).length + 1;
console.log(`  App: ${cfgName(FLORA_PRIOR)} · T ${HOUSE_TEMP} · ${fmtW(HOUSE_WEIGHT)} → real ${pct(appScore.real, N)} (guia ${pct(appScore.guia, nGuia)}, fora ${pct(appScore.fora, N - nGuia)}) | ? ${pct(appScore.unk, N)} · posició ${rank}`);

/* ---------- 4. La configuració de l'app, foto per foto ---------- */

console.log("\nApp, foto per foto (lloc real):");
const conf = { high: [0, 0], medium: [0, 0], low: [0, 0] };
const capped = { 0.45: [0, 0], 0.5: [0, 0], 0.55: [0, 0], 0.6: [0, 0] };
const rows = [];
items.forEach((it, j) => {
  const cands = mergeCandidates({ flora: floraTops[appK][j], house: houseTops[HOUSE_TEMP][j] }, it.setting, HOUSE_WEIGHT);
  const top = cands[0];
  const ok = matches(top.sci, it.expected);
  const c = confidenceFromP(top.p);
  conf[c][0] += ok; conf[c][1]++;
  for (const t of Object.keys(capped)) {
    if (c === "high" && (top.src !== "flora" || top.cos >= Number(t))) { capped[t][0] += ok; capped[t][1]++; }
  }
  const mark = ok ? "✔" : genus(top.sci) === genus(it.expected) ? "≈" : "✘";
  const list = cands.slice(0, 3).map((x) => `${x.sci} ${Math.round(x.p * 100)}%${x.src === "flora" ? "" : x.src === "house" ? " [int]" : " [els dos]"}`).join(" | ");
  console.log(`  ${mark} ${it.title.padEnd(26)} ${(it.guia ? "" : "(fora) ") + it.expected}${it.inTable ? "" : " [no és a la taula]"} → ${list} · cos ${top.cos?.toFixed(3) ?? "—"} · ${c}`);
  rows.push({ photo: it.title, expected: it.expected, setting: it.setting, guia: it.guia, ok, top: cands.slice(0, 3), confidence: c });
});
console.log("\nConfiança que mostra l'app i encerts reals:");
for (const [k, [ok, n]] of Object.entries(conf)) console.log(`  ${k.padEnd(7)} ${String(n).padStart(3)} fotos · encerts ${pct(ok, n)}`);
for (const [t, [ok, n]] of Object.entries(capped)) console.log(`  alta només si cos ≥ ${t} (o ho confirma el model d'interior): ${n} fotos · encerts ${pct(ok, n)}`);
if (f16cos.length) console.log(`fp16 vs fp32 (cosinus mitjà): ${(f16cos.reduce((a, b) => a + b, 0) / f16cos.length).toFixed(4)}`);

mkdirSync("ci-artifacts", { recursive: true });
writeFileSync("ci-artifacts/light-results.json", JSON.stringify({
  app: { prior: FLORA_PRIOR, temp: HOUSE_TEMP, weights: HOUSE_WEIGHT, score: appScore },
  best: joint.slice(0, 15).map(({ cfg, T, W, real, unk, guia, fora }) => ({ cfg, T, W, real, unk, guia, fora })),
  flora: floraRows,
  rows,
}, null, 1));
