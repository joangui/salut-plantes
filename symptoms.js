// Detector de símptomes a les fotos (sense DOM; el fan servir el worker, l'informe i els tests).
// És una capa lineal sobre l'embedding que el model botànic ja calcula per identificar la planta.
// El model (models/symptoms.json) s'entrena a CI amb fotos obertes: tools/symptom_train.py.

// Què vol dir cada classe del detector, en els símptomes de la guia (kb.js).
export const SIGNS = {
  pugo: { label: "pugó", symptoms: ["pugo"] },
  cotonosa: { label: "cotonet", symptoms: ["cotonosa"] },
  closques: { label: "cotxinilla", symptoms: ["closques"] },
  mosca_blanca: { label: "mosca blanca", symptoms: ["mosca_blanca"] },
  aranya: { label: "aranya vermella", symptoms: ["teles"] },
  oidi: { label: "oïdi (pols blanca)", symptoms: ["pols_blanca"] },
  taques: { label: "taques a les fulles", symptoms: ["taques"] },
  galeries: { label: "galeries de minador", symptoms: ["galeries"] },
  erugues: { label: "erugues", symptoms: ["erugues"] },
  cargols: { label: "cargols o llimacs", symptoms: ["rastres"] },
  melassa: { label: "melassa o fumagina", symptoms: ["melassa"] },
  grogues: { label: "fulles grogues", symptoms: ["grogues_velles"] },
  seques: { label: "fulles seques o cremades", symptoms: ["puntes_seques"] },
  pansida: { label: "planta pansida", symptoms: ["pansides"] },
};

const MAX_MAYBE = 3;

// Prepara el model llegit del JSON (files de pesos en Float32Array).
export function loadSignModel(json) {
  if (!json?.classes?.length) return null;
  return { ...json, W: json.W.map((row) => Float32Array.from(row)), b: Float32Array.from(json.b) };
}

// Probabilitat de cada classe per a un embedding normalitzat.
export function signProbs(model, emb) {
  const C = model.classes.length;
  const z = new Float64Array(C);
  let max = -Infinity;
  for (let k = 0; k < C; k++) {
    const w = model.W[k];
    let s = model.b[k];
    for (let i = 0; i < emb.length; i++) s += w[i] * emb[i];
    z[k] = s;
    if (s > max) max = s;
  }
  let sum = 0;
  for (let k = 0; k < C; k++) { z[k] = Math.exp(z[k] - max); sum += z[k]; }
  for (let k = 0; k < C; k++) z[k] /= sum;
  return z;
}

// Què es veu a les fotos: per a cada classe, la foto on es veu més.
// level «sure»: es veu (≥ 90 % d'encerts a les proves); «maybe»: potser, val la pena mirar-ho.
export function detectSigns(model, embeds) {
  if (!model || !embeds?.length) return [];
  const probs = embeds.map((e) => signProbs(model, e));
  const out = [];
  model.classes.forEach((cls, k) => {
    if (!SIGNS[cls]) return;
    let p = 0, photo = 0;
    probs.forEach((pr, j) => { if (pr[k] > p) { p = pr[k]; photo = j; } });
    const sure = model.sure?.[cls], maybe = model.maybe?.[cls];
    const level = sure != null && p >= sure ? "sure" : maybe != null && p >= maybe ? "maybe" : null;
    if (level) out.push({ id: cls, p: Math.round(p * 1000) / 1000, level, photo });
  });
  out.sort((a, b) => (a.level === b.level ? b.p - a.p : a.level === "sure" ? -1 : 1));
  let maybes = 0;
  return out.filter((s) => s.level === "sure" || ++maybes <= MAX_MAYBE);
}

// Símptomes de la guia que corresponen als senyals vistos (només els segurs).
export function signSymptoms(signs, dismissed = []) {
  const out = new Set();
  for (const s of signs || []) {
    if (s.level !== "sure" || dismissed.includes(s.id)) continue;
    for (const id of SIGNS[s.id]?.symptoms || []) out.add(id);
  }
  return [...out];
}
