// Lògica pura de l'informe (sense DOM): la fan servir l'app i els tests de Node.
import { SIGNS, signSymptoms } from "./symptoms.js";
import {
  SYMPTOMS, SYMPTOM_BY_ID, STATUS, HOUSEPLANT_SCI,
  plantInfo, normSci, diagnose, scoreToStatus,
} from "./kb.js";

export const SETTINGS = { indoors: "A dins de casa", pot: "A fora, en test", ground: "A fora, al terra" };
const SETTINGS_EN = { indoors: "indoors", pot: "outdoors in a pot", ground: "outdoors in the ground" };
const CONF_RANK = { low: 0, medium: 1, high: 2 };
const STATUS_MAX = { healthy: 95, minor_issues: 79, needs_attention: 59, critical: 34 };

const str = (v) => (typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim());
const arr = (v) => (Array.isArray(v) ? v.map(str).filter(Boolean) : str(v) ? [str(v)] : []);
const norm = (v) => str(v).toLowerCase().replace(/[\s-]+/g, "_");
const speciesKey = (sci) => normSci(sci).split(" ").slice(0, 2).join(" ");

export function listJoin(items) {
  if (items.length < 2) return items.join("");
  return items.slice(0, -1).join(", ") + " i " + items.at(-1);
}

// Per sota d'aquest cosinus, el model botànic sovint s'equivoca encara que estigui segur.
export const COS_HIGH = 0.6;

export function confidenceFromP(p, cos = null) {
  if (p >= 0.5 && (cos == null || cos >= COS_HIGH)) return "high";
  if (p >= 0.2) return "medium";
  return "low";
}

// Confiança d'un candidat: si el confirma el model d'interior, no cal mirar el cosinus.
export const candidateConfidence = (c) => confidenceFromP(c.p, c.src === "flora" ? c.cos : null);

// Pes del model de plantes d'interior segons on és la planta; la resta és del model botànic.
// Ajustat amb la prova de CI amb fotos reals (tools/ci_light.mjs).
export const HOUSE_WEIGHT = { indoors: 0.65, "": 0.5, pot: 0.25, ground: 0 };

// Combina el model botànic amb el de plantes d'interior (probabilitats ja calibrades).
export function mergeCandidates(res, setting, weights = HOUSE_WEIGHT) {
  const flora = res.flora || [];
  const house = res.house || [];
  const wh = house.length ? (weights[setting] ?? 0) : 0;
  const out = new Map();
  const add = (sci, p, src, cos) => {
    const k = speciesKey(sci);
    const prev = out.get(k);
    if (!prev) { out.set(k, cos == null ? { sci, p, src } : { sci, p, src, cos }); return; }
    prev.p += p;
    if (prev.src !== src) prev.src = "both";
  };
  for (const c of flora) add(c.sci, (1 - wh) * c.p, "flora", c.cos);
  if (wh > 0) {
    for (const h of house) {
      let sci = HOUSEPLANT_SCI[h.label] || h.label;
      if (!sci.includes(" ")) {
        // Etiqueta de gènere («Begonia»): va a l'espècie d'aquest gènere que vegi el model botànic.
        const f = flora.find((c) => speciesKey(c.sci).split(" ")[0] === speciesKey(sci));
        if (f) sci = f.sci;
      }
      add(sci, wh * h.p, "house");
    }
  }
  return [...out.values()].sort((a, b) => b.p - a.p);
}

/* ---------- IA avançada (Gemma) ----------
   La IA només tria codis: quina planta de la llista, quins símptomes veu, l'estat i si hi ha plagues.
   Tot el text de l'informe surt de la guia en català, perquè Gemma E2B sovint respon en castellà. */

const AI_SYMPTOMS = SYMPTOMS.filter((s) => s.en);

// Candidats que veu la IA: els més probables (com a mínim un 3 %), en ordre alfabètic i sense
// percentatges, perquè triï pel que veu. Amb percentatges, Gemma triava sempre el primer.
export function aiCandidates(cands) {
  return cands.slice(0, 5).filter((c, i) => i === 0 || c.p >= 0.03).sort((a, b) => a.sci.localeCompare(b.sci));
}

export function buildGemmaPrompt(ctx, cands) {
  const n = ctx.photoCount;
  const list = aiCandidates(cands).map((c, i) => `${i + 1}. ${c.sci}`).join("\n");
  const owner = ctx.symptoms.length ? ctx.symptoms.map((id) => SYMPTOM_BY_ID[id]?.en).filter(Boolean).join("; ") : "nothing";
  const codes = AI_SYMPTOMS.map((s) => `${s.id} = ${s.en}`).join("\n");
  return [
    `You are an expert horticulturist and plant pathologist. ${n === 1 ? "The photo shows" : `The ${n} photos show`} one plant. Look closely.`,
    `Reply with ONE JSON object only. No markdown, no explanations, no other text.`,
    ``,
    `Possible identifications from a plant model, in alphabetical order (any of them can be wrong):`,
    list || "(none)",
    ``,
    `Context: it grows ${SETTINGS_EN[ctx.setting] || "in an unknown place"}; location ${ctx.location || "unknown"}; date ${ctx.iso}. The owner also reports: ${owner}.`,
    ``,
    `Symptom codes you may use:`,
    codes,
    ``,
    `JSON format:`,
    `{"candidate": 1, "other": "", "id_confidence": "high", "symptoms": ["code"], "health": "healthy", "pests": "none_seen"}`,
    ``,
    `Rules:`,
    `- "candidate": the number of the option that matches the plant you see, or 0 if none matches. Do not just pick the first one.`,
    `- "other": only when candidate is 0, the scientific name (Genus species) of the plant.`,
    `- "id_confidence": high, medium or low.`,
    `- "symptoms": only codes from the list that you can clearly see in the photos. Use [] if the plant looks healthy.`,
    `- "health": healthy, minor_issues, needs_attention or critical.`,
    `- "pests": found, none_seen or unclear.`,
  ].join("\n");
}

export function firstJsonObject(text) {
  let depth = 0, inStr = false, esc = false, start = -1;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === "\"") inStr = false;
      continue;
    }
    if (ch === "\"") { if (depth > 0) inStr = true; continue; }
    if (ch === "{") { if (depth === 0) start = i; depth++; }
    else if (ch === "}" && depth > 0) {
      depth--;
      if (depth === 0) {
        try { return JSON.parse(text.slice(start, i + 1)); } catch { start = -1; }
      }
    }
  }
  return null;
}

// Noms que Gemma fa servir de vegades en lloc dels codis de símptoma (problemes o noms en anglès).
const SYMPTOM_ALIASES = {
  oidi: "pols_blanca", oid: "pols_blanca", powdery_mildew: "pols_blanca", mildew: "pols_blanca",
  aphid: "pugo", aphids: "pugo", mealybug: "cotonosa", mealybugs: "cotonosa", cotonet: "cotonosa",
  closca: "closques", scale: "closques", scale_insects: "closques",
  aranya: "teles", spider_mites: "teles", mites: "teles", whitefly: "mosca_blanca", whiteflies: "mosca_blanca",
  gnats: "mosquits", fungus_gnats: "mosquits", fumagina: "melassa", honeydew: "melassa", sooty_mould: "melassa", sooty_mold: "melassa",
  caterpillar: "erugues", caterpillars: "erugues", cargols: "rastres", snails: "rastres", slugs: "rastres",
  minador: "galeries", leaf_miner: "galeries", clorosi: "grogues_noves", chlorosis: "grogues_noves",
  sunburn: "cremades", pansida: "pansides", wilting: "pansides", taques_fong: "taques", leaf_spots: "taques",
};

// Accepta el codi exacte, un àlies o un prefix inequívoc («pols» → «pols_blanca»).
function matchCode(raw, ids, aliases = null) {
  const c = norm(raw);
  if (!c) return null;
  if (ids.includes(c)) return c;
  if (aliases?.[c] && ids.includes(aliases[c])) return aliases[c];
  if (c.length < 3) return null;
  const hits = ids.filter((id) => id.startsWith(c) || c.startsWith(id));
  return hits.length === 1 ? hits[0] : null;
}

export function parseGemma(text) {
  const o = firstJsonObject(text || "");
  if (!o || typeof o !== "object" || Array.isArray(o)) return null;
  const ids = AI_SYMPTOMS.map((s) => s.id);
  const symptoms = [...new Set(arr(o.symptoms).map((c) => matchCode(c, ids, SYMPTOM_ALIASES)).filter(Boolean))];
  const health = matchCode(o.health, Object.keys(STATUS));
  const pests = matchCode(o.pests, ["found", "none_seen", "unclear"]) || "unclear";
  const idConf = matchCode(o.id_confidence ?? o.confidence, ["high", "medium", "low"]) || "low";
  const cand = Number.parseInt(o.candidate, 10);
  return {
    candidate: Number.isFinite(cand) && cand >= 0 ? cand : 0,
    other: str(o.other).replace(/[*_`]/g, ""),
    idConf,
    symptoms,
    health,
    pests,
  };
}

const PEST_SIGNS = new Set(["pugo", "cotonosa", "closques", "mosca_blanca", "aranya", "galeries", "erugues", "cargols"]);
const lower1 = (t) => t.charAt(0).toLowerCase() + t.slice(1);

// Resum de salut, sempre amb text de la guia en català.
function healthSummary({ problems, seen, userCount, checked, aiHealth }) {
  if (!seen.length && !problems.length) {
    if (userCount) return "Els símptomes que has marcat no apunten a cap problema concret. Vigila com evoluciona la planta els propers dies.";
    if (aiHealth && aiHealth !== "healthy") return "La IA hi veu algun problema, però cap dels que coneix la guia. Mira la planta de prop i marca el que hi vegis.";
    if (checked) return "A les fotos no s'hi veuen plagues, fongs ni fulles malmeses: la planta sembla sana. Revisa de tant en tant el revers de les fulles i els brots tendres.";
    return "Sense poder revisar les fotos, la valoració només té en compte el que has marcat.";
  }
  const parts = [];
  if (seen.length) parts.push(`A les fotos s'hi veu: ${listJoin(seen)}.`);
  if (problems.length) {
    const names = listJoin(problems.slice(0, 3).map((p) => p.name.toLowerCase()));
    const worst = problems[0].severity;
    const lead = worst === "high" ? "Cal actuar de pressa" : worst === "moderate" ? "Convé actuar aquesta setmana" : "No és greu, però convé corregir-ho";
    parts.push(`${seen.length ? "El" : "Pel que has marcat, el"} més probable és ${names}. ${lead}: comença pels passos marcats com a «Ara».`);
  } else {
    parts.push("No apunta a cap problema concret: vigila com evoluciona.");
  }
  return parts.join(" ");
}

// run: { cands, ai, symptoms, date } · forcedSci: planta triada per la persona.
export function compose(run, forcedSci = null) {
  const cands = run.cands || [];
  const ai = run.ai;

  // Identificació: el model botànic proposa; la IA, si n'hi ha, ho comprova pel seu compte.
  let sci = "", conf = "low";
  const top = cands[0];
  const extra = [];
  const atMost = (c, max) => (CONF_RANK[c] > CONF_RANK[max] ? max : c);
  if (forcedSci) { sci = forcedSci; conf = "user"; }
  else if (top) {
    sci = top.sci;
    conf = candidateConfidence(top);
    const opts = ai ? aiCandidates(cands) : [];
    const pick = ai?.candidate >= 1 ? opts[ai.candidate - 1] : null;
    if (pick && speciesKey(pick.sci) === speciesKey(top.sci)) {
      // Coincideixen: la IA pot pujar la confiança (fins a «mitjana» si el model botànic dubtava molt).
      const both = Math.max(CONF_RANK[conf], CONF_RANK[ai.idConf]);
      conf = Object.keys(CONF_RANK)[conf === "low" ? Math.min(both, 1) : both];
    } else if (pick) {
      // No coincideixen: mana la IA si està segura i el model botànic no ho està del tot.
      if (ai.idConf !== "low" && top.p < 0.9) { sci = pick.sci; conf = ai.idConf === "high" ? "medium" : "low"; }
      else conf = atMost(conf, "medium");
    } else if (ai && ai.candidate === 0) {
      // Cap opció no li encaixa: es manté la planta, amb menys confiança, i es mostra la proposta de la IA.
      conf = atMost(conf, "medium");
      if (ai.other && ai.idConf !== "low") extra.push(ai.other);
    }
  } else if (ai?.other && ai.idConf !== "low") {
    sci = ai.other;
    conf = "low";
  }
  const info = plantInfo(sci);
  const key = speciesKey(sci);
  const alts = [...extra.map((x) => ({ sci: x })), ...cands]
    .filter((c, i, all) => speciesKey(c.sci) !== key && all.findIndex((d) => speciesKey(d.sci) === speciesKey(c.sci)) === i)
    .slice(0, 2)
    .map((c) => { const i = plantInfo(c.sci); return i.ca ? `${i.ca} (${i.sci})` : c.sci; });

  // Salut: el que es veu a les fotos, el que diu la IA (si n'hi ha) i el que has marcat tu.
  const dismissed = run.dismissed || [];
  const confirmed = run.confirmed || [];
  const signs = (run.signs || [])
    .filter((x) => !dismissed.includes(x.id))
    .map((x) => (confirmed.includes(x.id) ? { ...x, level: "sure" } : x));
  const sure = signs.filter((x) => x.level === "sure");
  const maybe = signs.filter((x) => x.level === "maybe");
  const photoSymptoms = signSymptoms(sure);
  const aiSymptoms = ai?.symptoms || [];
  const userSymptoms = run.symptoms || [];
  const all = [...new Set([...userSymptoms, ...photoSymptoms, ...aiSymptoms])];
  const dx = diagnose({ symptoms: all, group: info.group, date: run.date });
  const codes = (list) => new Set(list.length ? diagnose({ symptoms: list, group: info.group, date: run.date }).problems.map((p) => p.code) : []);
  const fromPhoto = codes(photoSymptoms), fromAi = codes(aiSymptoms), fromUser = codes(userSymptoms);
  for (const p of dx.problems) {
    p.from = [fromPhoto.has(p.code) && "foto", fromAi.has(p.code) && "ia", fromUser.has(p.code) && "tu"].filter(Boolean);
    if (!p.from.length) p.from = [photoSymptoms.length && "foto", aiSymptoms.length && "ia", userSymptoms.length && "tu"].filter(Boolean);
  }

  let score = dx.score;
  if (ai?.health && STATUS_MAX[ai.health] != null) score = Math.min(score, STATUS_MAX[ai.health]);
  const status = scoreToStatus(score);

  // Plagues
  const checked = !!run.signsReady || !!ai;
  const maybePests = maybe.filter((x) => PEST_SIGNS.has(x.id));
  let pests, pestNote;
  if (dx.pests.length) {
    pests = "found";
    const names = listJoin(dx.pests.map((p) => p.name.toLowerCase()));
    const by = dx.pests.some((p) => p.from.includes("foto")) ? "A les fotos s'hi veu" : dx.pests.some((p) => p.from.includes("ia")) ? "La IA hi veu" : "Pel que has marcat";
    pestNote = `${by}: ${names}.`;
  } else if (maybePests.length || ai?.pests === "found") {
    pests = "unclear";
    pestNote = maybePests.length
      ? `Potser hi ha ${listJoin(maybePests.map((x) => SIGNS[x.id].label))}: mira-ho de prop, sobretot el revers de les fulles.`
      : "La IA hi veu bestioles, però no sap de quina plaga es tracta: revisa el revers de les fulles i els brots tendres.";
  } else if (checked) {
    pests = "none_seen";
    pestNote = "A les fotos no se'n veuen. Revisa també el revers de les fulles i els brots tendres, que és on s'amaguen.";
  } else {
    pests = "unmarked";
    pestNote = "Revisa el revers de les fulles i els brots tendres, que és on s'amaguen.";
  }

  // Què es veu a les fotos: primer el detector i després el que hi afegeix la IA.
  const seen = sure.map((x) => SIGNS[x.id].label);
  const covered = new Set(photoSymptoms);
  for (const id of aiSymptoms) if (!covered.has(id)) seen.push(lower1(SYMPTOM_BY_ID[id].label));

  const displayName = info.ca || info.genusCa || "";
  const summary = healthSummary({ problems: dx.problems, seen, userCount: userSymptoms.length, checked, aiHealth: ai?.health });
  return { run, sci: info.sci || sci, info, displayName, conf, alts, dx, score, status, pests, pestNote, summary, seen: sure, maybe, checked };
}
