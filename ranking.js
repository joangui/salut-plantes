// Ordena les espècies del model botànic. Opcionalment dona més pes a les plantes de la guia
// (les que es cultiven o creixen a Catalunya), perquè el model coneix moltes espècies exòtiques.
import { PLANTS, GENUS, normSci } from "./kb.js";

export const FLORA_SCALE = 100;
// Pes extra per a espècies i gèneres de la guia (ajustat amb les proves de CI amb fotos reals).
export const FLORA_PRIOR = { species: 10, genus: 3 };
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

// Logaritme del pes de cada fila (0 = sense canvi).
export function floraPrior(names, { species = 10, genus = 3 } = {}) {
  const m = floraMembership(names);
  const out = new Float32Array(names.length);
  for (let i = 0; i < m.length; i++) out[i] = m[i] === 2 ? Math.log(species) : m[i] === 1 ? Math.log(genus) : 0;
  return out;
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
  for (let i = 0; i < n; i++) if (logits[i] !== -Infinity) sum += Math.exp(logits[i] - max);
  const idx = [];
  for (let i = 0; i < n; i++) if (logits[i] !== -Infinity) idx.push(i);
  idx.sort((a, b) => logits[b] - logits[a]);
  return idx.slice(0, k).map((i) => ({ i, p: Math.exp(logits[i] - max) / sum, s: sims[i] }));
}
