// Tests de la base de coneixement i de la lògica de l'informe (Node, sense navegador).
import assert from "node:assert/strict";
import { SYMPTOMS, PROBLEMS, CARE_GROUPS, PLANTS, GENUS, HOUSEPLANT_SCI, plantInfo, diagnose, pickerOptions } from "../kb.js";
import { mergeCandidates, parseGemma, buildGemmaPrompt, compose, firstJsonObject } from "../logic.js";

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

test("el model d'interior només compta quan té sentit", () => {
  const res = { flora: [{ sci: "Olea europaea", p: 0.6 }], house: [{ label: "Yucca", p: 0.9 }] };
  assert.equal(mergeCandidates(res, "")[0].sci, "Olea europaea");
  assert.equal(mergeCandidates(res, "ground")[0].sci, "Olea europaea");
  assert.equal(mergeCandidates(res, "indoors")[0].sci, "Yucca gigantea");
  const weak = { flora: [{ sci: "Arum italicum", p: 0.1 }], house: [{ label: "Pothos (Ivy arum)", p: 0.93 }] };
  assert.equal(mergeCandidates(weak, "")[0].sci, "Epipremnum aureum");
});

test("lectura de la resposta de Gemma", () => {
  const raw = "Aquí tens:\n```json\n{\"scientific_name\":\"Citrus × limon\",\"common_name_ca\":\"llimoner\",\"confidence\":\"High\",\"status\":\"needs attention\",\"score\":\"48\",\"summary_ca\":\"Té pugó {als brots}.\",\"pests\":\"found\",\"pest_note_ca\":\"Pugó verd.\",\"problems\":[\"pugo\",\"Fumagina\",\"x\"],\"observations_ca\":[\"Brots arrugats\"]}\n```";
  const g = parseGemma(raw);
  assert.equal(g.sci, "Citrus × limon");
  assert.equal(g.conf, "high");
  assert.equal(g.status, "needs_attention");
  assert.equal(g.score, 48);
  assert.deepEqual(g.problems, ["pugo", "fumagina"]);
  assert.equal(g.summary, "Té pugó {als brots}.");
  assert.equal(parseGemma("res de res"), null);
  assert.equal(firstJsonObject("{malament} {\"a\":1}").a, 1);
});

test("informe compost amb IA i correcció de la persona", () => {
  const run = {
    cands: [{ sci: "Murraya paniculata", p: 0.3 }, { sci: "Olea europaea", p: 0.1 }],
    ai: parseGemma('{"scientific_name":"Citrus limon","confidence":"medium","status":"minor_issues","score":70,"summary_ca":"Bé.","pests":"none_seen","problems":[]}'),
    symptoms: ["pugo"], date: new Date(2026, 10, 18),
  };
  const r = compose(run);
  assert.equal(r.displayName, "Llimoner");
  assert.equal(r.info.group, "citrics");
  assert.equal(r.pests, "found");
  assert.ok(r.score <= 70);
  const fixed = compose(run, "Olea europaea");
  assert.equal(fixed.displayName, "Olivera");
  assert.equal(fixed.conf, "user");
});

test("el prompt inclou els codis i el context", () => {
  const p = buildGemmaPrompt({ symptoms: ["pugo"], photoCount: 2, location: "Barcelona", iso: "2026-11-18", setting: "pot" }, [{ sci: "Olea europaea", p: 0.4 }]);
  assert.match(p, /excess_reg = /);
  assert.match(p, /Olea europaea \(Olivera\) 40%/);
  assert.match(p, /outdoors in a pot/);
  assert.match(p, /The 2 photos show/);
});

test("el selector té noms únics i ordenats", () => {
  const o = pickerOptions();
  assert.ok(o.length > 150);
  assert.equal(new Set(o.map((x) => x.label)).size, o.length);
});

console.log(`\n${n} tests correctes`);
