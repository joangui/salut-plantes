// Lògica pura de l'informe (sense DOM): la fan servir l'app i els tests de Node.
import {
  SYMPTOM_BY_ID, STATUS, PROBLEMS, HOUSEPLANT_SCI,
  plantInfo, normSci, diagnose, basicSummary, scoreToStatus,
} from "./kb.js";

export const SETTINGS = { indoors: "A dins de casa", pot: "A fora, en test", ground: "A fora, al terra" };
const SETTINGS_EN = { indoors: "indoors", pot: "outdoors in a pot", ground: "outdoors in the ground" };

const str = (v) => (typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim());
const arr = (v) => (Array.isArray(v) ? v.map(str).filter(Boolean) : str(v) ? [str(v)] : []);
const norm = (v) => str(v).toLowerCase().replace(/[\s-]+/g, "_");
const speciesKey = (sci) => normSci(sci).split(" ").slice(0, 2).join(" ");

export function listJoin(items) {
  if (items.length < 2) return items.join("");
  return items.slice(0, -1).join(", ") + " i " + items.at(-1);
}

export function confidenceFromP(p) {
  if (p >= 0.5) return "high";
  if (p >= 0.2) return "medium";
  return "low";
}

// Combina el model botànic amb el de plantes d'interior.
// El d'interior sempre tria una de les seves 47 classes, així que només compta quan té sentit.
export function mergeCandidates(res, setting) {
  const list = (res.flora || []).map((c) => ({ sci: c.sci, p: c.p, src: "flora" }));
  const floraTop = list[0]?.p || 0;
  const h = res.house?.[0];
  if (h) {
    let w = 0;
    if (setting === "indoors") w = 1;
    else if (setting === "" && h.p >= 0.85 && floraTop < 0.35) w = 0.8;
    else if (setting === "pot" && h.p >= 0.95 && floraTop < 0.15) w = 0.5;
    if (w > 0) for (const c of res.house) list.push({ sci: HOUSEPLANT_SCI[c.label] || c.label, p: c.p * w, src: "house" });
  }
  const best = new Map();
  for (const c of list) {
    const k = speciesKey(c.sci);
    const prev = best.get(k);
    if (!prev || c.p > prev.p) best.set(k, c);
  }
  return [...best.values()].sort((a, b) => b.p - a.p);
}

export function buildGemmaPrompt(ctx, cands) {
  const codes = Object.entries(PROBLEMS).map(([k, p]) => `${k} = ${p.gemma}`).join("; ");
  const hint = cands.slice(0, 5).map((c) => {
    const info = plantInfo(c.sci);
    return `${c.sci}${info.ca ? ` (${info.ca})` : ""} ${Math.round(c.p * 100)}%`;
  }).join(", ");
  const sy = ctx.symptoms.length ? ctx.symptoms.map((id) => SYMPTOM_BY_ID[id]?.label).filter(Boolean).join("; ") : "none";
  const n = ctx.photoCount;
  return [
    `You are an expert horticulturist and plant pathologist. ${n === 1 ? "The photo shows" : `The ${n} photos show`} one plant. Look closely and reply with ONE JSON object only: no markdown and no other text.`,
    `Context: location ${ctx.location || "unknown"}; date ${ctx.iso}; where it grows: ${SETTINGS_EN[ctx.setting] || "unknown"}; symptoms ticked by the owner (in Catalan): ${sy}.`,
    `An offline identification model suggests: ${hint || "nothing"}. It is often wrong and it does not know citrus trees or many garden and house plants, so trust your own eyes.`,
    `Tasks: 1) identify the plant; 2) judge its health from what is visible and from the ticked symptoms; 3) list only problems you can see or that the ticked symptoms support, using these codes: ${codes}.`,
    `JSON shape: {"scientific_name":"Genus species","common_name_ca":"nom en català","confidence":"high|medium|low","status":"healthy|minor_issues|needs_attention|critical","score":0-100,"summary_ca":"2 or 3 sentences","pests":"found|none_seen|unclear","pest_note_ca":"1 sentence","problems":["code"],"observations_ca":["short sentence"]}`,
    `Score bands: healthy 80-100, minor_issues 60-79, needs_attention 35-59, critical 0-34. Write summary_ca, pest_note_ca and observations_ca in Catalan (català), not in Spanish. If the photos do not show a plant, leave scientific_name empty and explain it in summary_ca.`,
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

export function parseGemma(text) {
  const o = firstJsonObject(text || "");
  if (!o || typeof o !== "object" || Array.isArray(o)) return null;
  const conf = ["high", "medium", "low"].includes(norm(o.confidence)) ? norm(o.confidence) : "low";
  let score = Number(o.score);
  score = o.score == null || o.score === "" || !Number.isFinite(score) ? null : Math.round(Math.max(0, Math.min(100, score)));
  const status = STATUS[norm(o.status)] ? norm(o.status) : score == null ? null : scoreToStatus(score);
  return {
    sci: str(o.scientific_name).replace(/[*_`]/g, ""),
    commonCa: str(o.common_name_ca),
    conf,
    status,
    score,
    summary: str(o.summary_ca),
    pests: ["found", "none_seen", "unclear"].includes(norm(o.pests)) ? norm(o.pests) : "unclear",
    pestNote: str(o.pest_note_ca),
    problems: [...new Set(arr(o.problems).map(norm))].filter((c) => PROBLEMS[c]),
    observations: arr(o.observations_ca).slice(0, 5),
  };
}

// run: { cands, ai, symptoms, date } · forcedSci: planta triada per la persona.
export function compose(run, forcedSci = null) {
  const cands = run.cands || [];
  const ai = run.ai;
  let sci, conf;
  if (forcedSci) { sci = forcedSci; conf = "user"; }
  else if (ai?.sci && ai.conf !== "low") { sci = ai.sci; conf = ai.conf; }
  else if (cands.length) { sci = cands[0].sci; conf = confidenceFromP(cands[0].p); }
  else { sci = ai?.sci || ""; conf = "low"; }
  const info = plantInfo(sci);
  const key = speciesKey(sci);
  const alts = cands.filter((c) => speciesKey(c.sci) !== key).slice(0, 2)
    .map((c) => { const i = plantInfo(c.sci); return i.ca ? `${i.ca} (${c.sci})` : c.sci; });
  const dx = diagnose({ symptoms: [...run.symptoms], extraProblems: ai?.problems || [], group: info.group, date: run.date });

  let score = dx.score;
  if (ai?.score != null) score = run.symptoms.length ? Math.min(ai.score, dx.score) : ai.score;
  const status = scoreToStatus(score);

  let pests, pestNote;
  const pestNames = listJoin(dx.pests.map((p) => p.name.toLowerCase()));
  if (ai) {
    pests = dx.pests.length && ai.pests !== "found" ? "found" : ai.pests;
    pestNote = ai.pestNote || (dx.pests.length ? `Has marcat: ${pestNames}.` : "");
  } else if (dx.pests.length) {
    pests = "found";
    pestNote = `Pel que has marcat: ${pestNames}.`;
  } else {
    pests = "unmarked";
    pestNote = "Revisa el revers de les fulles i els brots tendres, que és on s'amaguen.";
  }

  const displayName = info.ca || ai?.commonCa || info.genusCa || "";
  const summary = ai?.summary || basicSummary({ name: displayName, problems: dx.problems, symptomsCount: run.symptoms.length });
  return { run, sci: info.sci || sci, info, displayName, conf, alts, dx, score, status, pests, pestNote, summary, observations: ai?.observations || [] };
}
