// Ordena les espècies del model botànic i calibra el model de plantes d'interior.
// Els valors es trien amb la prova de CI amb fotos reals (tools/ci_light.mjs).
import { PLANTS, GENUS, normSci } from "./kb.js";

export const FLORA_SCALE = 100;
// Pes relatiu de cada fila de la taula. El model coneix 4.300 espècies, moltes d'exòtiques,
// mentre que la gent fotografia sobretot plantes de jardí, balcó i casa: les de la guia.
// Amb 108 fotos reals, un pes fort millora les plantes de la guia (32 % → ~50 % d'encerts)
// sense fer perdre les de fora que el model reconeix bé. other = 0 vol dir «només la guia».
export const FLORA_PRIOR = { species: 1000, genus: 3, other: 1 };
// El model d'interior dona probabilitats molt planes (~10 %). La temperatura les fa comparables.
export const HOUSE_TEMP = 0.35;

const key2 = (s) => normSci(s).split(" ").slice(0, 2).join(" ");
const KB_SPECIES = new Set(PLANTS.flatMap((p) => [p.sci, ...p.aliases]).map(key2));
const KB_GENERA = new Set(Object.keys(GENUS).map((g) => g.toLowerCase()));

// 2 = espècie de la guia, 1 = gènere de la guia, 0 = altres
export function floraMembership(names) {
  const out = new Uint8Array(names.length);
  for (let i = 0; i < names.length; i++) {
    const k = normSci(names[i]);
    out[i] = KB_SPECIES.has(k.split(" ").slice(0, 2).join(" ")) ? 2 : KB_GENERA.has(k.split(" ")[0]) ? 1 : 0;
  }
  return out;
}

// Logaritme del pes de cada fila (0 = sense canvi, -Infinity = descartada).
export function floraPrior(names, { species = 1, genus = 1, other = 1 } = {}) {
  const m = floraMembership(names);
  const w = [Math.log(other), Math.log(genus), Math.log(species)];
  return Float32Array.from(m, (v) => w[v]);
}

// sims: cosinus de la foto amb cada fila; prior: Float32Array o null. Torna [{ i, p, s }].
export function rankFlora(sims, prior, k = 5, scale = FLORA_SCALE) {
  const n = sims.length;
  const logits = new Float64Array(n);
  let max = -Infinity;
  for (let i = 0; i < n; i++) {
    const v = sims[i] * scale + (prior ? prior[i] : 0);
    logits[i] = v;
    if (v > max) max = v;
  }
  let sum = 0;
  const idx = [];
  for (let i = 0; i < n; i++) {
    if (logits[i] === -Infinity) continue;
    sum += Math.exp(logits[i] - max);
    idx.push(i);
  }
  idx.sort((a, b) => logits[b] - logits[a]);
  return idx.slice(0, k).map((i) => ({ i, p: Math.exp(logits[i] - max) / sum, s: sims[i] }));
}

// Probabilitats calibrades del model d'interior a partir dels logits.
export function houseProbs(logits, temp = HOUSE_TEMP) {
  let max = -Infinity;
  for (const v of logits) if (v / temp > max) max = v / temp;
  const e = Array.from(logits, (v) => Math.exp(v / temp - max));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / s);
}
