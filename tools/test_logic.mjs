// Tests de la base de coneixement i de la lògica de l'informe (Node, sense navegador).
import assert from "node:assert/strict";
import { SYMPTOMS, PROBLEMS, CARE_GROUPS, PLANTS, GENUS, HOUSEPLANT_SCI, plantInfo, diagnose, pickerOptions } from "../kb.js";
import { mergeCandidates, candidateConfidence, parseGemma, buildGemmaPrompt, compose, firstJsonObject } from "../logic.js";
import { SIGNS, loadSignModel, signProbs, detectSigns, signSymptoms } from "../symptoms.js";

let n = 0;
function test(name, fn) { fn(); n++; console.log(`ok ${n} - ${name}`); }

test("noms catalans i sinònims", () => {
  assert.equal(plantInfo("Citrus × limon").ca, "Llimoner");
  assert.equal(plantInfo("Citrus limon").ca, "Llimoner");
  assert.equal(plantInfo("Platanus × acerifolia").ca, "Plàtan");
  assert.equal(plantInfo("Platanus x hispanica").ca, "Plàtan");
  assert.equal(plantInfo("Rosmarinus officinalis").ca, "Romaní");
  assert.equal(plantInfo("Sansevieria trifasciata").ca, "Llengua de sogra");
  assert.equal(plantInfo("Monstera deliciosa").group, "interior");
});

test("gènere conegut sense espècie a la llista", () => {
  const i = plantInfo("Quercus faginea");
  assert.equal(i.ca, null);
  assert.equal(i.genusCa, "Roure o alzina");
  assert.equal(i.group, "mediterrania");
  assert.equal(plantInfo("Planta inventada").group, "generic");
});

test("tots els grups i problemes estan ben definits", () => {
  for (const p of PLANTS) assert.ok(CARE_GROUPS[p.group], `grup desconegut per a ${p.sci}`);
  for (const [g, v] of Object.entries(GENUS)) assert.ok(CARE_GROUPS[v[1]], `grup desconegut per al gènere ${g}`);
  for (const [k, p] of Object.entries(PROBLEMS)) {
    assert.ok(p.tips.length >= 1, `${k} sense consells`);
    assert.ok(p.name && p.explain && p.gemma, `${k} incomplet`);
  }
  for (const sci of Object.values(HOUSEPLANT_SCI)) assert.ok(plantInfo(sci).group !== "generic" || sci === "Dionaea muscipula", `sense grup: ${sci}`);
});

test("cada símptoma, sol, porta a un problema (excepte «no creix»)", () => {
  for (const s of SYMPTOMS) {
    const d = diagnose({ symptoms: [s.id] });
    if (s.id === "no_creix") continue;
    assert.ok(d.problems.length >= 1, `cap problema per a ${s.id}`);
  }
});

test("excés de reg", () => {
  const d = diagnose({ symptoms: ["substrat_moll", "grogues_velles"] });
  assert.equal(d.problems[0].code, "excess_reg");
  assert.equal(d.adjust.water, "less");
  assert.ok(d.score < 92);
});

test("la podridura substitueix l'excés de reg", () => {
  const d = diagnose({ symptoms: ["substrat_moll", "tija_tova"] });
  const codes = d.problems.map((p) => p.code);
  assert.ok(codes.includes("podridura"));
  assert.ok(!codes.includes("excess_reg"));
  assert.ok(["needs_attention", "critical"].includes(d.status));
});

test("sense símptomes: sana i amb consell de temporada", () => {
  const d = diagnose({ symptoms: [], group: "citrics", date: new Date(2026, 10, 18) });
  assert.equal(d.status, "healthy");
  assert.equal(d.tips.at(-1).cat, "temporada");
  assert.match(d.tips.at(-1).title, /Tardor/);
});

test("la IA afegeix problemes amb codis vàlids", () => {
  const d = diagnose({ symptoms: [], extraProblems: ["oidi", "inventat"] });
  assert.deepEqual(d.problems.map((p) => p.code), ["oidi"]);
  assert.equal(d.problems[0].source, "ai");
});

test("el model d'interior pesa segons on és la planta", () => {
  const W = { indoors: 0.65, "": 0.35, pot: 0.25, ground: 0 };
  const res = { flora: [{ sci: "Olea europaea", p: 0.6, cos: 0.6 }], house: [{ label: "Yucca", p: 0.9 }] };
  assert.deepEqual(mergeCandidates(res, "ground").map((c) => c.sci), ["Olea europaea"]);
  assert.equal(mergeCandidates(res, "", W)[0].sci, "Olea europaea");
  assert.equal(mergeCandidates(res, "indoors", W)[0].sci, "Yucca gigantea");
  assert.equal(mergeCandidates(res, "indoors", W)[1].cos, 0.6);
  const agree = mergeCandidates({ flora: [{ sci: "Epipremnum aureum", p: 0.5 }], house: [{ label: "Pothos (Ivy arum)", p: 0.8 }] }, "indoors", W);
  assert.equal(agree.length, 1);
  assert.equal(agree[0].src, "both");
  assert.ok(Math.abs(agree[0].p - (0.35 * 0.5 + 0.65 * 0.8)) < 1e-9);
  const genus = mergeCandidates({ flora: [{ sci: "Begonia maculata", p: 0.3 }], house: [{ label: "Begonia (Begonia spp.)", p: 0.7 }] }, "indoors", W);
  assert.equal(genus[0].sci, "Begonia maculata");
  assert.equal(genus[0].src, "both");
  assert.equal(mergeCandidates({ flora: [], house: [{ label: "Tulip", p: 0.9 }] }, "pot", W)[0].sci, "Tulipa");
});

test("la confiança alta demana una foto clara o la confirmació del model d'interior", () => {
  assert.equal(candidateConfidence({ sci: "Olea europaea", p: 0.95, cos: 0.65, src: "flora" }), "high");
  assert.equal(candidateConfidence({ sci: "Olea europaea", p: 0.95, cos: 0.55, src: "flora" }), "medium");
  assert.equal(candidateConfidence({ sci: "Ficus elastica", p: 0.55, cos: 0.55, src: "both" }), "high");
  assert.equal(candidateConfidence({ sci: "Ficus elastica", p: 0.1, src: "house" }), "low");
});

test("lectura de la resposta de Gemma (només codis)", () => {
  const raw = "Aquí tens:\n```json\n{\"candidate\": \"2\", \"other\": \"\", \"id_confidence\": \"High\", \"symptoms\": [\"pugo\", \"oid\", \"melassa\", \"inventat\", \"po\"], \"health\": \"needs attention\", \"pests\": \"found\"}\n```";
  const g = parseGemma(raw);
  assert.equal(g.candidate, 2);
  assert.equal(g.idConf, "high");
  assert.deepEqual(g.symptoms, ["pugo", "pols_blanca", "melassa"]);
  assert.equal(g.health, "needs_attention");
  assert.equal(g.pests, "found");
  assert.deepEqual(parseGemma('{"symptoms":["pols"],"health":"healthy"}').symptoms, ["pols_blanca"]);
  assert.deepEqual(parseGemma('{"symptoms":["Spider mites","oidi","whitefly"]}').symptoms, ["teles", "pols_blanca", "mosca_blanca"]);
  assert.equal(parseGemma("res de res"), null);
  assert.equal(firstJsonObject("{malament} {\"a\":1}").a, 1);
});

test("informe amb IA: candidat, símptomes vistos i text en català", () => {
  const run = {
    cands: [{ sci: "Artocarpus altilis", p: 0.6 }, { sci: "Citrus × limon", p: 0.3 }],
    ai: parseGemma('{"candidate":2,"id_confidence":"high","symptoms":["pugo","grogues_velles"],"health":"minor_issues","pests":"found"}'),
    symptoms: ["melassa"], date: new Date(2026, 10, 18),
  };
  const r = compose(run);
  assert.equal(r.displayName, "Llimoner");
  assert.equal(r.conf, "medium");
  assert.equal(r.info.group, "citrics");
  assert.equal(r.pests, "found");
  assert.match(r.pestNote, /La IA hi veu: pugó/);
  assert.match(r.summary, /^A les fotos s'hi veu: insectes petits verds o negres als brots i fulles velles/);
  assert.ok(r.score <= 79);
  const src = Object.fromEntries(r.dx.problems.map((p) => [p.code, p.from.join("+")]));
  assert.equal(src.pugo, "ia");
  assert.equal(src.fumagina, "tu");
  const fixed = compose(run, "Olea europaea");
  assert.equal(fixed.displayName, "Olivera");
  assert.equal(fixed.conf, "user");
});

test("informe amb IA: cap candidat encaixa i la IA en proposa un altre", () => {
  const run = { cands: [{ sci: "Monstera deliciosa", p: 0.99 }], ai: parseGemma('{"candidate":0,"other":"Fatsia japonica","id_confidence":"low","symptoms":[],"health":"healthy","pests":"none_seen"}'), symptoms: [], date: new Date() };
  assert.equal(compose(run).sci, "Monstera deliciosa");
  const run2 = { ...run, ai: { ...run.ai, idConf: "high" } };
  assert.equal(compose(run2).sci, "Monstera deliciosa");
  assert.equal(compose(run2).conf, "medium");
  assert.match(compose(run2).alts[0], /Fatsia japonica/);
  // Ordre alfabètic: l'opció 1 és Citrus encara que el model botànic prefereixi Persea (i Abies queda fora, < 3 %).
  const lemon = { cands: [{ sci: "Persea americana", p: 0.6 }, { sci: "Citrus × limon", p: 0.35 }, { sci: "Abies alba", p: 0.01 }], symptoms: [], date: new Date() };
  assert.match(buildGemmaPrompt({ symptoms: [], photoCount: 1, iso: "2026-11-18", setting: "" }, lemon.cands), /\n1\. Citrus × limon\n2\. Persea americana\n\n/);
  const pick = (json) => compose({ ...lemon, ai: parseGemma(json) });
  assert.equal(pick('{"candidate":1,"id_confidence":"high"}').displayName, "Llimoner");
  assert.equal(pick('{"candidate":1,"id_confidence":"high"}').conf, "medium");
  assert.equal(pick('{"candidate":1,"id_confidence":"medium"}').conf, "low");
  assert.equal(pick('{"candidate":1,"id_confidence":"low"}').sci, "Persea americana");
  assert.equal(pick('{"candidate":1,"id_confidence":"low"}').conf, "medium");
  assert.equal(pick('{"candidate":2,"id_confidence":"medium"}').sci, "Persea americana");
  assert.equal(pick('{"candidate":2,"id_confidence":"medium"}').conf, "high");
  assert.match(compose(run).summary, /^A les fotos no s'hi veu cap plaga ni malaltia clara/);
});

test("el prompt inclou candidats, codis i context", () => {
  const p = buildGemmaPrompt({ symptoms: ["pugo"], photoCount: 2, location: "Barcelona", iso: "2026-11-18", setting: "pot" }, [{ sci: "Olea europaea", p: 0.4 }]);
  assert.match(p, /\n1\. Olea europaea\n/);
  assert.ok(!/%/.test(p.split("Symptom codes")[0]));
  assert.match(p, /pols_blanca = white powdery coating/);
  assert.match(p, /outdoors in a pot/);
  assert.match(p, /The 2 photos show/);
  assert.match(p, /owner also reports: aphids/);
  assert.ok(!/no_creix/.test(p));
});

test("detector de símptomes: probabilitats, nivells i la foto on es veu", () => {
  // Model de joguina: 3 dimensions, classe 1 = pugó, classe 2 = taques.
  const model = loadSignModel({ classes: ["sana", "pugo", "taques"], W: [[0, 0, 0], [10, 0, 0], [0, 10, 0]], b: [0, 0, 0], sure: { pugo: 0.9, taques: 0.9 }, maybe: { pugo: 0.5, taques: 0.5 } });
  const p = signProbs(model, [1, 0, 0]);
  assert.ok(Math.abs(p.reduce((a, b) => a + b, 0) - 1) < 1e-9);
  assert.ok(p[1] > 0.99);
  const signs = detectSigns(model, [[0, 0, 0.1], [1, 0, 0], [0, 0.05, 0]]);
  assert.deepEqual(signs.map((x) => [x.id, x.level, x.photo]), [["pugo", "sure", 1]]);
  const weak = detectSigns(model, [[0, 0.12, 0]]);
  assert.deepEqual(weak.map((x) => [x.id, x.level]), [["taques", "maybe"]]);
  assert.deepEqual(detectSigns(null, [[1, 0, 0]]), []);
  assert.deepEqual(signSymptoms([...signs, ...weak]), ["pugo"]);
  assert.deepEqual(signSymptoms(signs, ["pugo"]), []);
  for (const [id, sg] of Object.entries(SIGNS)) for (const sym of sg.symptoms) assert.ok(SYMPTOMS.some((x) => x.id === sym), `${id} → ${sym}`);
});

test("informe amb el que es veu a les fotos", () => {
  const base = { cands: [{ sci: "Citrus × limon", p: 0.8 }], symptoms: [], date: new Date(2026, 10, 18), signsReady: true };
  const clean = compose({ ...base, signs: [] });
  assert.match(clean.summary, /^A les fotos no s'hi veu cap plaga ni malaltia clara/);
  assert.equal(clean.pests, "none_seen");
  assert.equal(clean.status, "healthy");
  const run = { ...base, signs: [{ id: "pugo", p: 0.95, level: "sure", photo: 0 }, { id: "closques", p: 0.4, level: "maybe", photo: 1 }] };
  const r = compose(run);
  assert.match(r.summary, /^A les fotos s'hi veu: pugó\. El més probable és pugó/);
  assert.equal(r.pests, "found");
  assert.match(r.pestNote, /^A les fotos s'hi veu: pugó/);
  assert.deepEqual(r.dx.problems.find((p) => p.code === "pugo").from, ["foto"]);
  assert.deepEqual(r.maybe.map((x) => x.id), ["closques"]);
  // La persona diu que no n'hi ha: desapareix de l'informe.
  const dismissed = compose({ ...run, dismissed: ["pugo"] });
  assert.ok(!dismissed.dx.problems.some((p) => p.code === "pugo"));
  assert.equal(dismissed.pests, "unclear");
  assert.match(dismissed.pestNote, /Potser hi ha cotxinilla/);
  // Confirma el «potser»: passa a comptar.
  const confirmed = compose({ ...run, confirmed: ["closques"] });
  assert.ok(confirmed.dx.problems.some((p) => p.code === "closca"));
  // Foto i persona alhora
  const both = compose({ ...run, symptoms: ["pugo"] });
  assert.deepEqual(both.dx.problems.find((p) => p.code === "pugo").from, ["foto", "tu"]);
});

test("el selector té noms únics i ordenats", () => {
  const o = pickerOptions();
  assert.ok(o.length > 150);
  assert.equal(new Set(o.map((x) => x.label)).size, o.length);
});

console.log(`\n${n} tests correctes`);
