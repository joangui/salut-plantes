// Salut de les plantes — interfície i orquestració.
import {
  SYMPTOMS, SYMPTOM_GROUPS, STATUS, SEVERITY, KIND, WHEN, CATEGORY, ADJUST, CONFIDENCE,
  CARE_GROUPS, plantInfo, pickerOptions,
} from "./kb.js";
import { SETTINGS, listJoin, mergeCandidates, buildGemmaPrompt, parseGemma, compose } from "./logic.js";

const MAX_PHOTOS = 3;
const MAX_EDGE = 1600;
const HINTS = ["Planta sencera", "Fulla de prop", "Danys o bestioles"];
const GEMMA_BYTES = 3.4e9;
const GEMMA_ID = "onnx-community/gemma-4-E2B-it-ONNX";
const GEMMA_REV = "6f21c99d7e18237f8d2ce92aadfdbfeba877f63a";
const SVGNS = "http://www.w3.org/2000/svg";
const $ = (sel, root = document) => root.querySelector(sel);
const reduceMotion = !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const state = {
  photos: Array(MAX_PHOTOS).fill(null),
  pickTarget: -1,
  setting: "",
  symptoms: new Set(),
  busy: false,
  ml: { ready: false, backend: null, missing: 0, total: 0, downloading: false },
  ai: { supported: null, f16: false, enabled: false, cached: false, loaded: false, loading: false },
  last: null,
  timer: null,
};
const reportUrls = new Set();

/* ---------- utilitats ---------- */

const nf = new Intl.NumberFormat("ca", { maximumFractionDigits: 1 });

function el(tag, props, ...kids) {
  const n = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === "class") n.className = v;
      else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? "" : String(v));
    }
  }
  for (const c of kids.flat()) {
    if (c == null || c === false || c === "") continue;
    n.append(c instanceof Node ? c : String(c));
  }
  return n;
}
function svgEl(tag, attrs) {
  const n = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs || {})) n.setAttribute(k, String(v));
  return n;
}
function icon(id) {
  const s = svgEl("svg", { class: "ico", "aria-hidden": "true", focusable: "false" });
  s.append(svgEl("use", { href: "#" + id }));
  return s;
}
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* sense emmagatzematge */ } },
};
function bytes(n) {
  if (!n) return "0 MB";
  if (n >= 1e9) return `${nf.format(n / 1e9)} GB`;
  return `${nf.format(Math.max(1, Math.round(n / 1e6)))} MB`;
}
function fmtTime(sec) {
  sec = Math.max(0, Math.round(sec));
  return sec < 60 ? `${sec} s` : `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}
function todayLabel() {
  return new Date().toLocaleDateString("ca", { day: "numeric", month: "short", year: "numeric" });
}

/* ---------- workers ---------- */

function makeRpc(url) {
  let worker = null;
  let seq = 0;
  const pending = new Map();
  let onEvent = null;
  function ensure() {
    if (worker) return worker;
    worker = new Worker(url, { type: "module" });
    worker.onmessage = (e) => {
      const m = e.data || {};
      if (m.id && pending.has(m.id)) {
        const p = pending.get(m.id);
        pending.delete(m.id);
        if (m.type === "error") p.reject(new Error(m.message));
        else p.resolve(m.result);
      } else if (onEvent) {
        onEvent(m);
      }
    };
    worker.onerror = (e) => {
      for (const p of pending.values()) p.reject(new Error(e.message || "worker"));
      pending.clear();
    };
    return worker;
  }
  return {
    call(type, payload = {}, events = null) {
      const w = ensure();
      const id = ++seq;
      onEvent = events;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        w.postMessage({ id, type, ...payload });
      });
    },
    stop() {
      if (!worker) return;
      worker.terminate();
      worker = null;
      for (const p of pending.values()) p.reject(new Error("stopped"));
      pending.clear();
    },
  };
}

const ml = makeRpc(new URL("./ml-worker.js", import.meta.url));
const gemma = makeRpc(new URL("./gemma-worker.js", import.meta.url));

/* ---------- estat sense connexió ---------- */

function renderNet() {
  const chip = $("#net-chip");
  const online = navigator.onLine;
  chip.dataset.state = online ? "online" : "offline";
  chip.textContent = "";
  chip.append(el("span", { class: "dot", "aria-hidden": "true" }), online ? "Amb connexió" : "Sense connexió");
}

function renderModelsChip() {
  const box = $("#models-chip");
  box.textContent = "";
  const m = state.ml;
  if (m.downloading) {
    box.append(el("span", null, "Descarregant els models…"));
    return;
  }
  if (m.ready) {
    box.dataset.state = "ready";
    box.append(icon("i-check"), el("span", null, "Llesta per funcionar sense connexió"));
  } else if (m.total) {
    box.dataset.state = "missing";
    box.append(
      el("span", null, `Cal descarregar ${bytes(m.missing)} un cop`),
      el("button", { type: "button", class: "link-btn", id: "prepare-btn", onclick: () => prepareModels() }, "Descarrega-ho ara"),
    );
  } else {
    box.append(el("span", null, "Comprovant els models…"));
  }
}

async function refreshModelStatus() {
  try {
    const r = await ml.call("status");
    Object.assign(state.ml, { ready: r.ready, backend: r.backend, missing: r.missing, total: r.total });
  } catch {
    Object.assign(state.ml, { ready: false, total: 0 });
  }
  renderModelsChip();
  renderHow();
}

async function prepareModels() {
  if (state.ml.downloading) return;
  state.ml.downloading = true;
  renderModelsChip();
  const bar = progressBar($("#models-progress"));
  try {
    await ml.call("prepare", { parts: ["flora", "house"] }, (m) => { if (m.type === "progress") bar.set(m.loaded, m.total); });
    try { await navigator.storage?.persist?.(); } catch { /* opcional */ }
  } catch (err) {
    say(navigator.onLine ? `No s'han pogut descarregar els models: ${err.message}` : "No hi ha connexió. Connecta't a internet per descarregar els models el primer cop.");
  } finally {
    bar.done();
    state.ml.downloading = false;
    await refreshModelStatus();
  }
}

function progressBar(host) {
  host.textContent = "";
  host.hidden = false;
  const fill = el("span", { class: "bar-fill" });
  const label = el("span", { class: "bar-label" }, "0 %");
  host.append(el("span", { class: "bar", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": "100" }, fill), label);
  return {
    set(loaded, total) {
      const pct = total ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
      fill.style.width = pct + "%";
      host.querySelector(".bar").setAttribute("aria-valuenow", String(pct));
      label.textContent = total ? `${pct} % · ${bytes(loaded)} de ${bytes(total)}` : `${bytes(loaded)}`;
    },
    done() { host.hidden = true; host.textContent = ""; },
  };
}

/* ---------- instal·lació ---------- */

let installEvent = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  installEvent = e;
  $("#install-btn").hidden = false;
});
$("#install-btn").addEventListener("click", async () => {
  if (!installEvent) return;
  installEvent.prompt();
  try { await installEvent.userChoice; } catch { /* res */ }
  installEvent = null;
  $("#install-btn").hidden = true;
});
function iosHint() {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone;
  $("#ios-hint").hidden = !(ios && !standalone);
}

/* ---------- fotos ---------- */

const fileInput = $("#file-input");

function compact() {
  const filled = state.photos.filter(Boolean);
  state.photos = Array.from({ length: MAX_PHOTOS }, (_, i) => filled[i] || null);
}

function renderSlots(focusId) {
  const wrap = $("#slots");
  wrap.textContent = "";
  for (let i = 0; i < MAX_PHOTOS; i++) {
    const p = state.photos[i];
    const num = i + 1;
    const slot = el("div", { class: "slot" + (p && p.loading ? " loading" : p ? " filled" : "") });
    if (p && p.loading) {
      slot.append(el("span", { class: "slot-wait" }, "Preparant…"));
    } else if (p) {
      slot.append(
        el("button", { type: "button", class: "slot-btn", id: `slot-${num}-replace`, "aria-label": `Canvia la foto ${num}`, onclick: () => pick(i) }, el("img", { src: p.url, alt: "" })),
        el("button", { type: "button", class: "slot-remove", id: `slot-${num}-remove`, "aria-label": `Treu la foto ${num}`, onclick: () => removePhoto(i) }, icon("i-x")));
    } else {
      slot.append(el("button", { type: "button", class: "slot-btn", id: `slot-${num}-add`, "aria-label": `Afegeix la foto ${num}: ${HINTS[i]}`, onclick: () => pick(i) },
        icon("i-plus"), el("span", null, "Afegeix foto")));
    }
    const cap = p && !p.loading
      ? el("figcaption", { class: "slot-cap" }, el("b", null, `Foto ${num}`))
      : el("figcaption", { class: "slot-cap" }, el("b", null, String(num)), HINTS[i]);
    wrap.append(el("figure", { class: "slot-wrap", "data-index": String(i) }, slot, cap));
  }
  if (focusId) document.getElementById(focusId)?.focus();
}

function pick(i) {
  if (state.busy) return;
  state.pickTarget = i;
  fileInput.click();
}
fileInput.addEventListener("change", () => {
  const files = fileInput.files;
  const target = state.pickTarget;
  state.pickTarget = -1;
  if (files?.length) addFiles(files, target);
  fileInput.value = "";
});

function removePhoto(i) {
  if (state.busy) return;
  releasePhoto(state.photos[i]);
  state.photos[i] = null;
  compact();
  const firstEmpty = state.photos.findIndex((p) => !p);
  renderSlots(firstEmpty >= 0 ? `slot-${firstEmpty + 1}-add` : null);
  updateButton();
}
function releasePhoto(p) {
  if (p?.url && !reportUrls.has(p.url)) URL.revokeObjectURL(p.url);
}

const isHeic = (f) => /hei[cf]/i.test(f.type || "") || /\.hei[cf]$/i.test(f.name || "");
const isImageFile = (f) => !!f && (/^image\//i.test(f.type || "") || /\.(jpe?g|png|webp|gif|heic|heif|avif|bmp)$/i.test(f.name || ""));

async function addFiles(list, target = -1) {
  if (state.busy) { say("Espera que acabi l'anàlisi per canviar les fotos."); return; }
  const files = [...(list || [])].filter(isImageFile);
  if (!files.length) { say("Aquests fitxers no són fotos. Afegeix imatges JPEG, PNG o WebP."); return; }
  const targets = [];
  if (target >= 0 && state.photos[target] && !state.photos[target].loading) targets.push(target);
  for (let i = 0; i < MAX_PHOTOS; i++) if (!state.photos[i] && !targets.includes(i)) targets.push(i);
  if (!targets.length) { say("Ja hi ha tres fotos. Treu-ne una per afegir-ne una altra."); return; }
  const skipped = files.length - targets.length;
  const jobs = files.slice(0, targets.length).map((file, k) => {
    const i = targets[k];
    const prev = state.photos[i];
    const token = { loading: true };
    state.photos[i] = token;
    return processFile(file).then((photo) => {
      const idx = state.photos.indexOf(token);
      if (idx === -1) { URL.revokeObjectURL(photo.url); return; }
      state.photos[idx] = photo;
      releasePhoto(prev);
    }, () => {
      const idx = state.photos.indexOf(token);
      if (idx !== -1) state.photos[idx] = prev && !prev.loading ? prev : null;
      say(isHeic(file)
        ? `«${file.name}» és una foto HEIC d'iPhone que aquest navegador no pot llegir. Desa-la com a JPEG o fes-ne una captura de pantalla.`
        : `No s'ha pogut llegir «${file.name}». Fes servir una foto JPEG, PNG o WebP.`);
    }).finally(() => { compact(); renderSlots(); updateButton(); });
  });
  if (skipped > 0) say(`Només hi caben tres fotos: ${skipped === 1 ? "n'ha quedat una fora" : `n'han quedat ${skipped} fora`}.`);
  compact();
  renderSlots();
  updateButton();
  await Promise.all(jobs);
}

async function processFile(file) {
  if (file.size > 60 * 1024 * 1024) throw new Error("massa gran");
  const src = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = src;
    await img.decode();
    const w0 = img.naturalWidth, h0 = img.naturalHeight;
    if (!w0 || !h0) throw new Error("buida");
    const k = Math.min(1, MAX_EDGE / Math.max(w0, h0));
    const w = Math.max(1, Math.round(w0 * k)), h = Math.max(1, Math.round(h0 * k));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const g = canvas.getContext("2d");
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, w, h);
    g.imageSmoothingQuality = "high";
    g.drawImage(img, 0, 0, w, h);
    const blob = await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("codificació"))), "image/jpeg", 0.9));
    return { blob, url: URL.createObjectURL(blob) };
  } finally {
    URL.revokeObjectURL(src);
  }
}

let sayTimer = null;
function say(text) {
  const m = $("#intake-msg");
  m.textContent = text;
  m.hidden = !text;
  clearTimeout(sayTimer);
  if (text) sayTimer = setTimeout(() => { m.hidden = true; m.textContent = ""; }, 10000);
}

const hasFiles = (e) => !!(e.dataTransfer && [...(e.dataTransfer.types || [])].includes("Files"));
let dragDepth = 0;
window.addEventListener("dragenter", (e) => { if (!hasFiles(e)) return; e.preventDefault(); dragDepth++; document.body.classList.add("dragging"); });
window.addEventListener("dragover", (e) => { if (!hasFiles(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = "copy"; });
window.addEventListener("dragleave", (e) => { if (!hasFiles(e)) return; dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) document.body.classList.remove("dragging"); });
window.addEventListener("drop", (e) => {
  if (!hasFiles(e)) return;
  e.preventDefault();
  dragDepth = 0;
  document.body.classList.remove("dragging");
  const fig = e.target?.closest?.(".slot-wrap");
  addFiles(e.dataTransfer.files, fig ? Number(fig.dataset.index) : -1);
});
document.addEventListener("paste", (e) => {
  const files = [...(e.clipboardData?.files || [])].filter(isImageFile);
  if (!files.length) return;
  e.preventDefault();
  addFiles(files);
});

/* ---------- símptomes i context ---------- */

function renderSymptoms() {
  const host = $("#symptoms");
  host.textContent = "";
  for (const g of SYMPTOM_GROUPS) {
    const chips = SYMPTOMS.filter((s) => s.group === g.id).map((s) =>
      el("button", {
        type: "button", class: "chip small", id: `sym-${s.id}`, "aria-pressed": String(state.symptoms.has(s.id)),
        onclick: (e) => {
          if (state.symptoms.has(s.id)) state.symptoms.delete(s.id); else state.symptoms.add(s.id);
          e.currentTarget.setAttribute("aria-pressed", String(state.symptoms.has(s.id)));
          updateSymptomCount();
        },
      }, s.label));
    host.append(el("div", { class: "sym-group", role: "group", "aria-label": g.label }, el("p", { class: "sym-label" }, g.label), el("div", { class: "chips" }, chips)));
  }
  updateSymptomCount();
}
function updateSymptomCount() {
  const n = state.symptoms.size;
  $("#sym-count").textContent = n ? `${n} marcat${n > 1 ? "s" : ""}` : "opcional";
  $("#sym-clear").hidden = !n;
}
$("#sym-clear").addEventListener("click", () => { state.symptoms.clear(); renderSymptoms(); });

const locInput = $("#loc");
const savedLoc = store.get("sp.loc");
locInput.value = savedLoc == null ? "Barcelona" : savedLoc;
locInput.addEventListener("change", () => store.set("sp.loc", locInput.value.trim()));

const settingChips = [...document.querySelectorAll("[data-setting]")];
function setSetting(v) {
  state.setting = SETTINGS[v] ? v : "";
  settingChips.forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.setting === state.setting)));
  store.set("sp.setting", state.setting);
}
settingChips.forEach((c) => c.addEventListener("click", () => setSetting(c.getAttribute("aria-pressed") === "true" ? "" : c.dataset.setting)));
setSetting(store.get("sp.setting") || "");

/* ---------- IA avançada ---------- */

const aiToggle = $("#ai-toggle");
aiToggle.addEventListener("change", () => {
  state.ai.enabled = aiToggle.checked;
  store.set("sp.ai", state.ai.enabled ? "1" : "");
  renderAi();
});

async function checkAiSupport() {
  let ok = false, f16 = false;
  try {
    const adapter = await navigator.gpu?.requestAdapter?.();
    ok = !!adapter;
    f16 = !!adapter?.features?.has?.("shader-f16");
  } catch { ok = false; }
  state.ai.supported = ok;
  state.ai.f16 = f16;
  try {
    const cache = await caches.open("transformers-cache");
    const keys = await cache.keys();
    state.ai.cached = keys.filter((r) => r.url.includes(GEMMA_ID) && r.url.includes(GEMMA_REV)).length >= 5;
  } catch { state.ai.cached = false; }
  if (!ok) { state.ai.enabled = false; aiToggle.checked = false; }
  else if (store.get("sp.ai") === "1") { state.ai.enabled = true; aiToggle.checked = true; }
  aiToggle.disabled = !ok;
  renderAi();
}

function renderAi() {
  const st = $("#ai-status");
  st.textContent = "";
  const a = state.ai;
  if (a.supported === null) { st.append("Comprovant si aquest dispositiu la pot fer servir…"); return; }
  if (!a.supported) {
    st.append("No disponible en aquest dispositiu: cal un ordinador amb un navegador compatible amb WebGPU, com Chrome o Edge.");
    return;
  }
  if (a.loading) { st.append("Descarregant i preparant la IA…"); return; }
  if (a.loaded) { st.append(icon("i-check"), " Llesta. Funciona sense connexió."); return; }
  if (a.cached) {
    st.append("Ja descarregada. Es carregarà a la memòria en la primera anàlisi.");
    return;
  }
  st.append(
    `Cal descarregar ${bytes(GEMMA_BYTES)} un cop; després funciona sense connexió. `,
    el("button", { type: "button", class: "link-btn", id: "ai-download", onclick: () => loadAi() }, "Descarrega-la ara"),
  );
}

async function loadAi() {
  if (state.ai.loading || state.ai.loaded) return;
  if (!navigator.onLine && !state.ai.cached) { say("Cal connexió per descarregar la IA el primer cop."); return; }
  state.ai.loading = true;
  renderAi();
  const bar = progressBar($("#ai-progress"));
  try {
    await gemma.call("load", {}, (m) => { if (m.type === "progress") bar.set(m.loaded, m.total); });
    state.ai.loaded = true;
    state.ai.cached = true;
    try { await navigator.storage?.persist?.(); } catch { /* opcional */ }
  } catch (err) {
    say(`No s'ha pogut preparar la IA: ${friendlyAiError(err)}`);
  } finally {
    bar.done();
    state.ai.loading = false;
    renderAi();
  }
}

function friendlyAiError(err) {
  const m = String(err?.message || err);
  if (/no-webgpu/.test(m)) return "aquest navegador no té WebGPU.";
  if (/memory|alloc|OOM|device.*lost/i.test(m)) return "el dispositiu s'ha quedat sense memòria. Tanca altres pestanyes i torna-ho a provar.";
  if (/fetch|network|Failed to/i.test(m)) return "no s'han pogut descarregar els fitxers. Comprova la connexió.";
  return m;
}

/* ---------- botó d'analitzar ---------- */

const analyzeBtn = $("#analyze");
function updateButton() {
  const n = state.photos.filter((p) => p?.blob).length;
  const loading = state.photos.some((p) => p?.loading);
  if (state.busy) { analyzeBtn.disabled = true; analyzeBtn.textContent = "Analitzant…"; return; }
  analyzeBtn.textContent = n === 0 ? "Afegeix una foto per començar" : `Analitza ${n === 1 ? "la foto" : `les ${n} fotos`}`;
  analyzeBtn.disabled = n === 0 || loading;
}
analyzeBtn.addEventListener("click", () => analyze());
$("#stop").addEventListener("click", () => { gemma.stop(); state.ai.loaded = false; });

/* ---------- pintar l'informe ---------- */

function field(k, v) { return el("div", null, el("dt", null, k), el("dd", null, v)); }

function renderGauge(score) {
  const box = el("div", { class: "gauge", role: "img", "aria-label": `Puntuació de salut: ${score} de 100` });
  const r = 37, c = 2 * Math.PI * r;
  const ring = svgEl("svg", { viewBox: "0 0 96 96", class: "ring", "aria-hidden": "true", focusable: "false" });
  const fill = svgEl("circle", {
    cx: 48, cy: 48, r, class: "ring-fill", transform: "rotate(-90 48 48)",
    "stroke-dasharray": c.toFixed(2), "stroke-dashoffset": (c * (1 - score / 100)).toFixed(2),
  });
  fill.style.setProperty("--c", c.toFixed(2) + "px");
  ring.append(svgEl("circle", { cx: 48, cy: 48, r, class: "ring-track" }), fill);
  box.append(ring, el("span", { class: "gauge-num" }, el("strong", null, String(score)), el("small", null, "de 100")));
  return box;
}

function mount(photos, illustration) {
  const shown = photos.slice(0, 3);
  const m = el("div", { class: "mount", "data-count": String(illustration ? 1 : shown.length) });
  if (illustration) {
    m.append(el("figure", { class: "mounted" }, document.getElementById("tpl-illus").content.firstElementChild.cloneNode(true)));
  } else {
    shown.forEach((p, i) => m.append(el("figure", { class: "mounted" },
      el("img", { src: p.url, alt: `Foto ${i + 1}` }),
      shown.length > 1 ? el("figcaption", { class: "pnum" }, String(i + 1)) : null)));
  }
  return m;
}

function renderSheet(report, opts = {}) {
  const { run, info, dx } = report;
  const example = !!opts.example;
  const st = STATUS[report.status];
  const id = `plant-${run.id}`;
  const sheet = el("article", { class: "sheet", "aria-labelledby": id });
  sheet.style.setProperty("--st", `var(--${st.token})`);

  // Capçalera: fotos + etiqueta d'herbari
  const stampText = example ? "Exemple" : report.conf === "user" ? "Triada per tu" : CONFIDENCE[report.conf] || "Identificada";
  const title = el("h3", { class: "binomial" + (report.sci ? " is-italic" : ""), id }, report.sci || "Planta sense identificar");
  const common = report.displayName
    ? el("p", { class: "common" }, report.displayName, !info.ca && info.genusCa ? el("span", { class: "muted" }, " (gènere)") : null)
    : el("p", { class: "common muted" }, "Sense nom català a la nostra llista");
  const fields = el("dl", { class: "det-fields" },
    report.alts.length && !example ? field("També podria ser", report.alts.join("; ")) : null,
    run.photos.length > 1 ? field("Fotos", listJoin(run.photos.map((_, i) => String(i + 1)))) : null,
    run.place ? field("Lloc", run.place) : null,
    field("Revisada", example ? "Informe d'exemple" : `al dispositiu, ${run.dateLabel}`),
    field("Mètode", example ? "—" : run.ai ? "IA Gemma 4 i model botànic" : "Model botànic i símptomes"),
  );
  const fix = example ? null : el("button", { type: "button", class: "link-btn fix-btn", onclick: () => openPicker(sheet, report) }, "No és aquesta planta?");
  const det = el("div", { class: "det" }, el("span", { class: "stamp" }, stampText), title, common, fields, fix);
  sheet.append(el("div", { class: "sheet-top" }, mount(run.photos, example), det));

  // Salut
  const pestsState = { found: ["i-bug", "Plagues detectades."], none_seen: ["i-check", "No s'hi veuen plagues."], unclear: ["i-question", "No es pot saber si hi ha plagues."], unmarked: ["i-question", "No has marcat cap plaga."] }[report.pests];
  const healthText = el("div", { class: "health-text" },
    el("p", { class: "status-pill" }, icon(st.icon), st.label),
    el("p", { class: "summary" }, report.summary),
    el("p", { class: "pests", "data-p": report.pests }, icon(pestsState[0]), el("span", null, el("strong", null, pestsState[1]), report.pestNote ? " " + report.pestNote : "")),
    el("p", { class: "basis" }, example ? "" : run.ai ? "Valoració de la IA a partir de les fotos i dels símptomes marcats." : "Valoració a partir dels símptomes que has marcat: el model bàsic identifica la planta, però no n'avalua la salut a la foto."),
  );
  sheet.append(el("div", { class: "health" }, renderGauge(report.score), healthText));

  // Què cal canviar
  const adj = el("ul", { class: "adjust", "aria-label": "Què cal canviar" });
  for (const [k, label, ic] of [["water", "Reg", "i-drop"], ["light", "Llum", "i-sun"], ["feeding", "Adob", "i-sprout"]]) {
    const v = dx.adjust[k] || "same";
    adj.append(el("li", { class: "adj", "data-v": v }, icon(ic),
      el("span", { class: "adj-k" }, label, el("span", { class: "sr" }, ":")),
      el("span", { class: "adj-v" }, el("span", { class: "adj-g", "aria-hidden": "true" }, ADJUST[v][0]), " ", ADJUST[v][1])));
  }
  sheet.append(adj);

  // Què li passa
  const issues = dx.problems.length
    ? el("ul", { class: "issues" }, dx.problems.map((p) => {
      const sev = SEVERITY[p.severity];
      const li = el("li", { class: "issue" },
        el("div", { class: "issue-head" },
          el("span", { class: "issue-name" }, p.name),
          el("span", { class: "tag" }, KIND[p.kind]),
          el("span", { class: "tag" }, icon(sev.icon), el("span", { class: "sr" }, "Gravetat: "), sev.label)),
        el("p", { class: "issue-ev" }, p.explain),
        p.source === "ai" ? el("p", { class: "issue-src" }, "Ho ha vist la IA a la foto.") : p.source === "both" ? el("p", { class: "issue-src" }, "Ho ha vist la IA i ho has marcat tu.") : null);
      li.style.setProperty("--st", `var(--${sev.token})`);
      return li;
    }))
    : el("p", { class: "empty" }, run.ai ? "La IA no hi veu cap problema." : run.symptoms.length ? "Els símptomes marcats no apunten a cap problema concret." : "No has marcat cap símptoma.");
  sheet.append(el("section", { class: "part" }, el("h4", null, "Què li passa"), issues));

  // Què cal fer
  if (dx.tips.length) {
    sheet.append(el("section", { class: "part" }, el("h4", null, "Què cal fer"),
      el("ol", { class: "tips" }, dx.tips.map((t) => el("li", { class: "tip", "data-when": t.when },
        el("div", { class: "tip-body" },
          el("p", { class: "tip-meta" }, el("span", { class: "when" }, WHEN[t.when]), el("span", { class: "cat" }, CATEGORY[t.cat] || "")),
          el("p", { class: "tip-title" }, t.title),
          el("p", { class: "tip-detail" }, t.detail),
          t.products?.length ? el("ul", { class: "products", "aria-label": "Productes" }, t.products.map((x) => el("li", null, x))) : null)))),
      el("p", { class: "label-note" }, "Llegeix sempre l'etiqueta dels productes i fes-los servir com indica.")));
  }

  // Cures
  const group = CARE_GROUPS[info.group] || CARE_GROUPS.generic;
  sheet.append(el("section", { class: "part" },
    el("h4", null, "Cures bàsiques ", el("span", { class: "h4-note" }, `· ${group.label.toLowerCase()}`)),
    el("dl", { class: "care" }, Object.entries(group.care).map(([k, v]) => field(k, v))),
    group.watch ? el("p", { class: "watch" }, icon("i-alert"), el("span", null, group.watch)) : null));
  return sheet;
}

/* ---------- selector de planta ---------- */

function openPicker(sheet, report) {
  const det = sheet.querySelector(".det");
  if (det.querySelector(".picker")) { det.querySelector(".picker input").focus(); return; }
  const listId = `plants-${report.run.id}`;
  const opts = pickerOptions();
  const input = el("input", { type: "text", list: listId, id: `pick-${report.run.id}`, placeholder: "Escriu el nom: llimoner, potus…", autocomplete: "off" });
  const datalist = el("datalist", { id: listId }, opts.map((o) => el("option", { value: o.label })));
  const apply = () => {
    const v = input.value.trim();
    if (!v) return;
    const hit = opts.find((o) => o.label.toLowerCase() === v.toLowerCase())
      || opts.find((o) => o.label.toLowerCase().includes(v.toLowerCase()));
    const sci = hit ? hit.sci : v;
    const next = compose(report.run, sci);
    state.last = next;
    sheet.replaceWith(renderSheet(next));
    setStatus(`Informe actualitzat per a ${next.displayName || next.sci}.`);
  };
  const picker = el("div", { class: "picker" },
    el("label", { for: input.id }, "Quina planta és?"),
    el("div", { class: "picker-row" }, input, datalist,
      el("button", { type: "button", class: "ghost", onclick: apply }, "Aplica"),
      el("button", { type: "button", class: "link-btn", onclick: () => picker.remove() }, "Cancel·la")));
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); apply(); } });
  det.append(picker);
  input.focus();
}

/* ---------- l'anàlisi ---------- */

function setStatus(t) { $("#status-text").textContent = t; }
function startTimer() {
  const t0 = Date.now();
  const tick = () => { $("#elapsed").textContent = fmtTime((Date.now() - t0) / 1000); };
  tick();
  state.timer = setInterval(tick, 1000);
  return t0;
}
function stopTimer() { clearInterval(state.timer); state.timer = null; $("#elapsed").textContent = ""; }

function resetReport() {
  $("#sheets").textContent = "";
  $("#notes").textContent = "";
  $("#example-note").hidden = true;
  for (const u of reportUrls) if (!state.photos.some((p) => p?.url === u)) URL.revokeObjectURL(u);
  reportUrls.clear();
}

function note(text) { $("#notes").append(el("p", { class: "pnote" }, text)); }

function showPending(photos) {
  const det = el("div", { class: "det" },
    el("p", { class: "binomial typing" }, "Identificant"),
    el("p", { class: "common muted", id: "pending-line" }, "Preparant…"));
  $("#sheets").append(el("article", { class: "sheet pending", id: "pending", "aria-busy": "true" },
    el("div", { class: "sheet-top" }, mount(photos, false), det),
    el("div", { class: "skel", "aria-hidden": "true" }, el("span", { style: "width:92%" }), el("span", { style: "width:74%" }), el("span", { style: "width:83%" }))));
}
function pendingLine(t) { const n = $("#pending-line"); if (n) n.textContent = t; }

function scrollToReport() {
  const r = $("#report");
  if (r.getBoundingClientRect().top > window.innerHeight * 0.55) r.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
}

async function analyze() {
  if (state.busy) return;
  const photos = state.photos.filter((p) => p?.blob);
  if (!photos.length) return;
  state.busy = true;
  updateButton();
  resetReport();
  photos.forEach((p) => reportUrls.add(p.url));
  const now = new Date();
  const run = {
    id: now.getTime().toString(36),
    photos,
    symptoms: [...state.symptoms],
    setting: state.setting,
    place: [locInput.value.trim(), SETTINGS[state.setting]].filter(Boolean).join(" · "),
    location: locInput.value.trim(),
    date: now,
    iso: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`,
    dateLabel: todayLabel(),
    cands: [],
    ai: null,
  };
  showPending(photos);
  scrollToReport();
  const t0 = startTimer();

  // 1. Identificació amb el model botànic
  let res = null;
  try {
    const useHouse = run.setting !== "ground";
    setStatus(state.ml.ready ? "Identificant la planta" : "Preparant els models (només el primer cop)");
    const bar = state.ml.ready ? null : progressBar($("#run-progress"));
    res = await ml.call("classify", { images: photos.map((p) => p.blob), useHouse }, (m) => {
      if (m.type === "progress" && bar) { bar.set(m.loaded, m.total); pendingLine(`Descarregant els models: ${bytes(m.loaded)} de ${bytes(m.total)}`); }
    });
    bar?.done();
    run.cands = mergeCandidates(res, run.setting);
    run.backend = res.backend;
    if (photos.length > 1 && res.minPair < 0.55) {
      const names = res.perPhoto.map((p, i) => { const inf = plantInfo(p.sci); return `foto ${i + 1}: ${inf.ca || p.sci}`; });
      note(`Les fotos podrien ser de plantes diferents (${names.join("; ")}). L'informe les tracta com una sola planta; per a plantes diferents, analitza-les per separat.`);
    }
  } catch (err) {
    $("#run-progress").hidden = true;
    note(navigator.onLine
      ? `No s'ha pogut fer servir el model botànic (${err.message}).`
      : "Encara no tens els models descarregats i no hi ha connexió. Connecta't un cop per descarregar-los; després l'app funciona sense connexió.");
  }
  if (!state.ml.ready) refreshModelStatus();

  // 2. IA avançada
  if (state.ai.enabled && state.ai.supported) {
    try {
      setStatus(state.ai.loaded ? "La IA està mirant les fotos" : "Carregant la IA");
      pendingLine(state.ai.loaded ? "La IA està mirant les fotos. Pot trigar un minut o dos." : "Carregant la IA a la memòria del dispositiu…");
      $("#stop").hidden = false;
      const bar = state.ai.cached ? null : progressBar($("#run-progress"));
      state.ai.loading = !state.ai.loaded;
      const out = await gemma.call("analyze", { images: photos.map((p) => p.blob), prompt: buildGemmaPrompt({ ...run, photoCount: photos.length }, run.cands), maxTokens: 160 }, (m) => {
        if (m.type === "progress") { bar?.set(m.loaded, m.total); pendingLine(`Descarregant la IA: ${bytes(m.loaded)} de ${bytes(m.total)}`); }
        if (m.type === "token") { setStatus("La IA està escrivint l'informe"); pendingLine("La IA està escrivint l'informe…"); }
      });
      bar?.done();
      state.ai.loaded = true;
      state.ai.cached = true;
      run.ai = parseGemma(out.text);
      if (!run.ai) note("La IA ha respost en un format inesperat; es mostra l'informe bàsic.");
    } catch (err) {
      $("#run-progress").hidden = true;
      if (String(err.message) === "stopped") note("Has aturat la IA; es mostra l'informe bàsic.");
      else note(`La IA no ha pogut acabar (${friendlyAiError(err)}). Es mostra l'informe bàsic.`);
    } finally {
      state.ai.loading = false;
      $("#stop").hidden = true;
      renderAi();
    }
  }

  // 3. Informe
  document.getElementById("pending")?.remove();
  if (!run.cands.length && !run.ai) {
    setStatus("");
    $("#sheets").append(el("div", { class: "error-card", role: "alert" },
      el("p", null, el("strong", null, "No s'ha pogut identificar la planta."), " Torna-ho a provar quan tinguis connexió per descarregar els models."),
      el("button", { type: "button", class: "ghost", onclick: () => analyze() }, "Torna-ho a provar")));
  } else {
    const report = compose(run);
    state.last = report;
    $("#sheets").append(renderSheet(report));
    setStatus(`Informe llest en ${fmtTime((Date.now() - t0) / 1000)}`);
  }
  stopTimer();
  state.busy = false;
  updateButton();
}

/* ---------- exemple ---------- */

function renderExample() {
  resetReport();
  $("#example-note").hidden = false;
  const run = {
    id: "exemple", photos: [], symptoms: ["pugo", "arrugades", "melassa"], setting: "pot",
    place: "Balcó assolellat · A fora, en test", date: new Date(), dateLabel: todayLabel(),
    cands: [{ sci: "Citrus × limon", p: 0.8 }], ai: null,
  };
  const report = compose(run);
  report.conf = "high";
  report.summary = "Llimoner jove en test amb moltes fulles velles sanes. Els brots nous estan arrugats i enganxosos: hi ha una colònia de pugó que encara és a temps de controlar.";
  $("#sheets").append(renderSheet(report, { example: true }));
}

/* ---------- com funciona ---------- */

async function renderHow() {
  const host = $("#storage");
  if (!host) return;
  let used = "";
  try {
    const est = await navigator.storage?.estimate?.();
    if (est?.usage) used = `Ara ocupa ${bytes(est.usage)} en aquest dispositiu.`;
  } catch { /* opcional */ }
  host.textContent = used;
}
$("#clear-data").addEventListener("click", async () => {
  const btn = $("#clear-data");
  if (btn.dataset.confirm !== "1") {
    btn.dataset.confirm = "1";
    btn.textContent = "Segur? Toca de nou per esborrar";
    setTimeout(() => { btn.dataset.confirm = ""; btn.textContent = "Esborra els models descarregats"; }, 5000);
    return;
  }
  btn.dataset.confirm = "";
  btn.textContent = "Esborra els models descarregats";
  try { await ml.call("clear"); } catch { /* res */ }
  try { await caches.delete("transformers-cache"); } catch { /* res */ }
  ml.stop();
  gemma.stop();
  Object.assign(state.ai, { loaded: false, cached: false });
  await refreshModelStatus();
  renderAi();
  say("S'han esborrat els models. Es tornaran a descarregar quan calgui.");
});

/* ---------- inici ---------- */

window.addEventListener("online", renderNet);
window.addEventListener("offline", renderNet);
renderNet();
renderSlots();
renderSymptoms();
updateButton();
renderExample();
renderModelsChip();
iosHint();
refreshModelStatus();
checkAiSupport();

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("./sw.js").catch(() => { /* sense mode fora de línia */ });
}
