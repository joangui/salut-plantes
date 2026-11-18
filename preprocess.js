// Funcions pures compartides pel worker del navegador i pels tests de Node.

export const SIZE = 224;

// rgba: píxels RGBA d'una imatge ja redimensionada a SIZE×SIZE.
// mode "unit": RGB en 0..1 (model BioCLIP, la normalització és dins el graf).
// mode "vit": (x - 0.5) / 0.5, com el ViTImageProcessor del model d'interior.
export function toCHW(rgba, mode = "unit") {
  const n = SIZE * SIZE;
  const out = new Float32Array(3 * n);
  for (let i = 0; i < n; i++) {
    const r = rgba[4 * i] / 255;
    const g = rgba[4 * i + 1] / 255;
    const b = rgba[4 * i + 2] / 255;
    if (mode === "vit") {
      out[i] = r * 2 - 1;
      out[n + i] = g * 2 - 1;
      out[2 * n + i] = b * 2 - 1;
    } else {
      out[i] = r;
      out[n + i] = g;
      out[2 * n + i] = b;
    }
  }
  return out;
}

export function l2normalize(v) {
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i] * v[i];
  const k = s > 0 ? 1 / Math.sqrt(s) : 0;
  const out = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = v[i] * k;
  return out;
}

export function meanVectors(vectors) {
  const d = vectors[0].length;
  const out = new Float32Array(d);
  for (const v of vectors) for (let i = 0; i < d; i++) out[i] += v[i];
  for (let i = 0; i < d; i++) out[i] /= vectors.length;
  return out;
}

export function cosine(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

/* ---- float16 ---- */

let F16_TABLE = null;
function f16Table() {
  if (F16_TABLE) return F16_TABLE;
  F16_TABLE = new Float32Array(65536);
  for (let h = 0; h < 65536; h++) {
    const sign = h & 0x8000 ? -1 : 1;
    const exp = (h >> 10) & 0x1f;
    const frac = h & 0x3ff;
    let v;
    if (exp === 0) v = frac * 2 ** -24;
    else if (exp === 31) v = frac ? NaN : Infinity;
    else v = (1 + frac / 1024) * 2 ** (exp - 15);
    F16_TABLE[h] = sign * v;
  }
  return F16_TABLE;
}

export function f16ToF32(u16) {
  const t = f16Table();
  const out = new Float32Array(u16.length);
  for (let i = 0; i < u16.length; i++) out[i] = t[u16[i]];
  return out;
}

const F32 = new Float32Array(1);
const U32 = new Uint32Array(F32.buffer);
export function f32ToF16Bits(value) {
  F32[0] = value;
  const x = U32[0];
  const sign = (x >>> 16) & 0x8000;
  let exp = ((x >>> 23) & 0xff) - 127 + 15;
  let mant = x & 0x7fffff;
  if (exp <= 0) {
    if (exp < -10) return sign;
    mant = (mant | 0x800000) >> (1 - exp);
    return sign | ((mant + 0x1000) >> 13);
  }
  if (exp >= 31) return sign | 0x7c00;
  const h = sign | (exp << 10) | ((mant + 0x1000) >> 13);
  return h;
}

export function f32ArrayToF16(arr) {
  const out = new Uint16Array(arr.length);
  for (let i = 0; i < arr.length; i++) out[i] = f32ToF16Bits(arr[i]);
  return out;
}

/* ---- puntuacions ---- */

// table: Float32Array [n * dim], files normalitzades. emb: vector normalitzat.
export function similarities(table, dim, emb) {
  const n = table.length / dim;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    const off = i * dim;
    for (let j = 0; j < dim; j++) s += table[off + j] * emb[j];
    out[i] = s;
  }
  return out;
}

// Softmax sobre totes les classes amb un factor d'escala (logit scale de CLIP).
export function topKSoftmax(scores, k = 5, scale = 1) {
  let max = -Infinity;
  for (let i = 0; i < scores.length; i++) if (scores[i] * scale > max) max = scores[i] * scale;
  let sum = 0;
  const exps = new Float64Array(scores.length);
  for (let i = 0; i < scores.length; i++) { exps[i] = Math.exp(scores[i] * scale - max); sum += exps[i]; }
  const idx = Array.from(scores.keys()).sort((a, b) => scores[b] - scores[a]).slice(0, k);
  return idx.map((i) => ({ i, p: exps[i] / sum, s: scores[i] }));
}
