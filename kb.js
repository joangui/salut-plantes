// Base de coneixement de «Salut de les plantes».
// Tot el text que veu la persona surt d'aquí, en català.
// Sense dependències del navegador: també s'importa als tests de Node.

/* ------------------------------------------------------------------ */
/* Temporades (hemisferi nord)                                         */
/* ------------------------------------------------------------------ */

export const SEASON_LABEL = { hivern: "Hivern", primavera: "Primavera", estiu: "Estiu", tardor: "Tardor" };

export function seasonFor(date = new Date()) {
  const m = date.getMonth();
  if (m === 11 || m <= 1) return "hivern";
  if (m <= 4) return "primavera";
  if (m <= 7) return "estiu";
  return "tardor";
}

/* ------------------------------------------------------------------ */
/* Símptomes que la persona pot marcar                                 */
/* ------------------------------------------------------------------ */

export const SYMPTOM_GROUPS = [
  { id: "fulles", label: "A les fulles" },
  { id: "bestioles", label: "Bestioles i rastres" },
  { id: "substrat", label: "Substrat, tija i creixement" },
];

export const SYMPTOMS = [
  { id: "grogues_velles", group: "fulles", label: "Fulles velles grogues" , en: "older, lower leaves turning yellow" },
  { id: "grogues_noves", group: "fulles", label: "Fulles noves grogues amb nervis verds" , en: "young leaves yellow with green veins" },
  { id: "puntes_seques", group: "fulles", label: "Puntes o vores seques" , en: "dry brown leaf tips or edges" },
  { id: "taques", group: "fulles", label: "Taques marrons, negres o ataronjades" , en: "brown, black or orange spots on leaves" },
  { id: "pols_blanca", group: "fulles", label: "Pols blanca com farina" , en: "white powdery coating on leaves" },
  { id: "pansides", group: "fulles", label: "Fulles pansides" , en: "wilting, drooping leaves" },
  { id: "cauen", group: "fulles", label: "Cauen moltes fulles" , en: "many leaves falling off" },
  { id: "cremades", group: "fulles", label: "Zones descolorides pel sol" , en: "bleached or scorched patches from too much sun" },
  { id: "forats", group: "fulles", label: "Forats o vores rosegades" , en: "holes or chewed leaf edges" },
  { id: "galeries", group: "fulles", label: "Línies sinuoses dins la fulla" , en: "winding pale trails inside leaves" },
  { id: "arrugades", group: "fulles", label: "Fulles noves arrugades o enrotllades" , en: "young leaves curled or crinkled" },
  { id: "pugo", group: "bestioles", label: "Insectes petits verds o negres als brots" , en: "aphids: small green, black or yellow insects on shoots" },
  { id: "cotonosa", group: "bestioles", label: "Boletes blanques com de cotó" , en: "mealybugs: white cottony clusters" },
  { id: "closques", group: "bestioles", label: "Closques marrons a tiges o fulles" , en: "scale insects: brown bumps or shells on stems or leaves" },
  { id: "teles", group: "bestioles", label: "Teles fines i puntets clars" , en: "spider mites: fine webbing and tiny pale speckles" },
  { id: "mosca_blanca", group: "bestioles", label: "Mosquetes blanques que volen" , en: "whitefly: tiny white flies under leaves" },
  { id: "mosquits", group: "bestioles", label: "Mosquits petits al voltant del test" , en: "small gnats around the potting soil" },
  { id: "melassa", group: "bestioles", label: "Fulles enganxoses o amb pols negra" , en: "sticky leaves or black sooty mould" },
  { id: "erugues", group: "bestioles", label: "Erugues o excrements petits" , en: "caterpillars or their droppings" },
  { id: "rastres", group: "bestioles", label: "Rastres brillants de cargols" , en: "shiny slime trails from snails or slugs" },
  { id: "substrat_moll", group: "substrat", label: "El substrat sempre està moll" , en: "soil soaked or waterlogged" },
  { id: "substrat_sec", group: "substrat", label: "El substrat està molt sec" , en: "soil very dry and pulling away from the pot" },
  { id: "tija_tova", group: "substrat", label: "Base de la tija tova o fosca" , en: "soft, dark or rotting stem base" },
  { id: "arrels_fora", group: "substrat", label: "Surten arrels pels forats del test" , en: "roots growing out of the pot" },
  { id: "allargada", group: "substrat", label: "S'estira cap a la llum, pàl·lida" , en: "leggy, pale growth stretching towards light" },
  { id: "no_creix", group: "substrat", label: "Fa mesos que no creix" , en: "" },
];

export const SYMPTOM_BY_ID = Object.fromEntries(SYMPTOMS.map((s) => [s.id, s]));

/* ------------------------------------------------------------------ */
/* Etiquetes                                                           */
/* ------------------------------------------------------------------ */

export const STATUS = {
  healthy: { label: "Sana", token: "good", icon: "i-check" },
  minor_issues: { label: "Problemes lleus", token: "warning", icon: "i-alert" },
  needs_attention: { label: "Cal atenció", token: "serious", icon: "i-alert" },
  critical: { label: "Crítica", token: "critical", icon: "i-stop" },
};

export const SEVERITY = {
  low: { label: "Lleu", token: "warning", icon: "i-alert", penalty: 9 },
  moderate: { label: "Moderada", token: "serious", icon: "i-alert", penalty: 18 },
  high: { label: "Greu", token: "critical", icon: "i-stop", penalty: 34 },
};

export const KIND = {
  plaga: "Plaga", malaltia: "Malaltia", reg: "Reg", nutricio: "Nutrició",
  llum: "Llum", entorn: "Entorn", arrels: "Arrels",
};

export const WHEN = { ara: "Ara", setmana: "Aquesta setmana", sempre: "Sempre" };

export const CATEGORY = {
  reg: "Reg", llum: "Llum", adob: "Adob", plagues: "Plagues", malalties: "Malalties",
  poda: "Poda", substrat: "Substrat", entorn: "Entorn", temporada: "Temporada",
};

export const ADJUST = {
  more: ["↑", "Més"], less: ["↓", "Menys"], same: ["=", "Igual"], unclear: ["?", "No se sap"],
};

export const CONFIDENCE = { high: "Confiança alta", medium: "Confiança mitjana", low: "Confiança baixa" };

/* ------------------------------------------------------------------ */
/* Problemes, com es detecten i què cal fer                            */
/* ------------------------------------------------------------------ */
// match(s): s és un Set amb els símptomes marcats; torna una confiança 0–1.
// adjust: com cal canviar reg, llum i adob si el problema hi és.

const T = (when, cat, title, detail, products = []) => ({ when, cat, title, detail, products });

export const PROBLEMS = {
  excess_reg: {
    name: "Excés de reg", kind: "reg", severity: "moderate",
    gemma: "overwatering: soil stays wet, yellow or soft leaves",
    explain: "El substrat no s'asseca i les arrels s'ofeguen; per això les fulles es tornen grogues o toves.",
    match: (s) => s.has("substrat_moll")
      ? (["grogues_velles", "pansides", "tija_tova", "mosquits", "cauen"].some((k) => s.has(k)) ? 0.9 : 0.6) : 0,
    adjust: { water: "less" },
    tips: [
      T("ara", "reg", "Deixa de regar fins que s'assequi", "No tornis a regar fins que els 3–5 cm de dalt del substrat estiguin secs, i buida l'aigua del plat."),
      T("setmana", "substrat", "Millora el drenatge", "Comprova que el test tingui forats. Si el substrat fa olor de resclosit, trasplanta amb substrat nou i perlita.", ["Perlita", "Substrat per a plantes verdes"]),
      T("sempre", "reg", "Rega segons la sequedat, no pel calendari", "Abans de regar, enfonsa un dit al substrat: si encara està humit, espera."),
    ],
  },
  manca_aigua: {
    name: "Falta d'aigua", kind: "reg", severity: "moderate",
    gemma: "underwatering: dry soil, wilting, crispy edges",
    explain: "La planta perd més aigua de la que rep: es pansa i les vores s'assequen.",
    match: (s) => s.has("substrat_sec")
      ? (["pansides", "puntes_seques", "cauen"].some((k) => s.has(k)) ? 0.9 : 0.5) : 0,
    adjust: { water: "more" },
    tips: [
      T("ara", "reg", "Rega a fons", "Rega fins que l'aigua surti pels forats. Si el substrat no l'absorbeix, submergeix el test 15 minuts en una galleda."),
      T("sempre", "reg", "Fes regs més regulars", "A l'estiu, revisa el substrat cada 2–3 dies. A l'exterior, una capa d'escorça manté la humitat.", ["Escorça de pi per encoixinar"]),
    ],
  },
  pansida: {
    name: "Planta pansida", kind: "reg", severity: "moderate",
    gemma: "wilting with no clear cause",
    explain: "Les fulles es pansen per falta d'aigua, per excés d'aigua o per calor; cal mirar el substrat per saber-ho.",
    match: (s) => (s.has("pansides") && !["substrat_moll", "substrat_sec", "tija_tova"].some((k) => s.has(k)) ? 0.6 : 0),
    tips: [
      T("ara", "reg", "Comprova el substrat abans de regar", "Si està sec, rega a fons. Si està moll, no reguis: deixa'l assecar i mira si les arrels estan toves."),
      T("sempre", "entorn", "Protegeix-la de la calor forta", "A l'estiu es pot pansir a les hores de més sol encara que tingui aigua; si al vespre es recupera, no és greu."),
    ],
  },
  podridura: {
    name: "Podridura d'arrels o del coll", kind: "arrels", severity: "high",
    gemma: "root or stem rot: soft dark stem base",
    explain: "Fongs del substrat ataquen les arrels o la base de la tija, gairebé sempre per excés d'aigua.",
    match: (s) => s.has("tija_tova") ? (s.has("substrat_moll") ? 0.95 : 0.8) : 0,
    adjust: { water: "less" },
    tips: [
      T("ara", "malalties", "Revisa les arrels", "Treu la planta del test. Les arrels sanes són fermes i clares; talla les toves i fosques amb tisores netes."),
      T("ara", "substrat", "Trasplanta amb substrat nou", "Fes servir un test net amb forats i substrat drenant, i no reguis fins al cap d'uns dies.", ["Substrat drenant", "Fongs beneficiosos (Trichoderma)"]),
      T("sempre", "reg", "Rega menys", "Deixa assecar bé el substrat entre regs."),
    ],
  },
  manca_nutrients: {
    name: "Falta de nutrients", kind: "nutricio", severity: "low",
    gemma: "nutrient deficiency: older leaves evenly yellow, weak growth",
    explain: "Les fulles velles es tornen grogues de manera uniforme; sovint és falta de nitrogen.",
    match: (s) => (s.has("grogues_velles") && !s.has("substrat_moll") ? 0.7 : 0) || (s.has("no_creix") && s.size === 1 ? 0.45 : 0),
    adjust: { feeding: "more" },
    tips: [
      T("setmana", "adob", "Adoba la planta", "Fes servir un adob equilibrat a la dosi de l'etiqueta durant la primavera i l'estiu.", ["Adob líquid equilibrat"]),
      T("sempre", "substrat", "Renova el substrat", "Si fa més de dos anys que no la trasplantes, canvia-li el substrat a la primavera."),
    ],
  },
  clorosi: {
    name: "Clorosi fèrrica", kind: "nutricio", severity: "moderate",
    gemma: "iron chlorosis: young leaves yellow with green veins",
    explain: "Les fulles noves surten grogues amb els nervis verds: la planta no pot absorbir el ferro, sovint per l'aigua calcària.",
    match: (s) => (s.has("grogues_noves") ? 0.85 : 0),
    adjust: { feeding: "more" },
    tips: [
      T("setmana", "adob", "Aporta quelat de ferro", "Aplica quelat de ferro EDDHA amb el reg, seguint l'etiqueta. En 2–3 setmanes les fulles noves haurien de sortir verdes.", ["Quelat de ferro EDDHA"]),
      T("sempre", "reg", "Rega amb aigua menys calcària", "L'aigua de l'aixeta de Barcelona és molt calcària. Si pots, rega amb aigua de pluja o filtrada."),
      T("sempre", "substrat", "Fes servir substrat àcid", "Cítrics, camèlies, gardènies i hortènsies agraeixen un substrat per a plantes acidòfiles.", ["Substrat per a acidòfiles"]),
    ],
  },
  puntes_seques: {
    name: "Puntes seques", kind: "entorn", severity: "low",
    gemma: "dry leaf tips from dry air or salt build-up",
    explain: "Ambient massa sec, reg irregular o massa sals de l'adob al substrat.",
    match: (s) => (s.has("puntes_seques") && !s.has("substrat_sec") ? 0.6 : 0),
    tips: [
      T("sempre", "entorn", "Augmenta la humitat", "Allunya-la de la calefacció i agrupa-la amb altres plantes, o posa el test sobre un plat amb pedres i aigua."),
      T("setmana", "substrat", "Renta les sals", "Un cop al mes, rega a fons perquè l'aigua arrossegui les sals, i no adobis de més."),
    ],
  },
  oidi: {
    name: "Oïdi", kind: "malaltia", severity: "moderate",
    gemma: "powdery mildew: white powder on leaves",
    explain: "Un fong que fa una capa blanca com de farina; prolifera amb calor i humitat ambiental.",
    match: (s) => (s.has("pols_blanca") ? 0.9 : 0),
    tips: [
      T("ara", "malalties", "Treu les fulles més afectades", "Llença-les a les escombraries, no al compost."),
      T("ara", "malalties", "Tracta amb sofre o bicarbonat de potassi", "Polvoritza al vespre, mai amb sol fort ni per sobre de 30 °C, perquè el sofre pot cremar. Repeteix cada 7–10 dies.", ["Sofre mullable", "Bicarbonat de potassi"]),
      T("sempre", "entorn", "Millora la ventilació", "Deixa espai entre plantes i rega al peu, sense mullar les fulles."),
    ],
  },
  taques_fong: {
    name: "Taques de fong", kind: "malaltia", severity: "moderate",
    gemma: "fungal leaf spots or rust: brown, black or orange spots",
    explain: "Taques marrons, negres o ataronjades (rovell) causades per fongs, sobretot amb humitat.",
    match: (s) => (s.has("taques") ? 0.7 : 0),
    tips: [
      T("ara", "malalties", "Retira les fulles tacades", "Treu-les i recull també les que hagin caigut, perquè la malaltia no s'escampi."),
      T("setmana", "malalties", "Tracta amb coure si és a l'exterior", "Aplica un fungicida de coure en un dia sense pluja, seguint l'etiqueta.", ["Fungicida de coure (oxiclorur o brou bordelès)"]),
      T("sempre", "reg", "No mullis les fulles", "Rega al peu i a primera hora del dia."),
    ],
  },
  pugo: {
    name: "Pugó", kind: "plaga", severity: "moderate",
    gemma: "aphids: small green or black insects on shoots",
    explain: "Insectes petits que xuclen la saba dels brots tendres, deformen les fulles noves i deixen melassa.",
    match: (s) => (s.has("pugo") ? 0.95 : s.has("arrugades") && s.has("melassa") ? 0.75 : s.has("arrugades") ? 0.55 : 0),
    tips: [
      T("ara", "plagues", "Fes-los caure amb aigua", "Dutxa els brots amb un raig d'aigua fort per desfer les colònies."),
      T("ara", "plagues", "Polvoritza sabó potàssic", "Al vespre, mulla bé les dues cares de les fulles. Repeteix cada 5–7 dies, tres vegades.", ["Sabó potàssic"]),
      T("setmana", "plagues", "Controla les formigues", "Les formigues protegeixen el pugó: posa una banda adhesiva al tronc o al voltant del test.", ["Banda adhesiva per a troncs"]),
      T("sempre", "plagues", "Deixa fer les marietes", "Marietes i crisopes se'l mengen; evita insecticides que les matin."),
    ],
  },
  cotonosa: {
    name: "Cotxinilla cotonosa", kind: "plaga", severity: "moderate",
    gemma: "mealybugs: white cottony clusters",
    explain: "Insectes coberts d'una cera blanca com de cotó que s'amaguen a les axil·les de les fulles.",
    match: (s) => (s.has("cotonosa") ? 0.95 : 0),
    tips: [
      T("ara", "plagues", "Neteja-les amb alcohol", "Passa un bastonet de cotó amb alcohol per cada boleta i aïlla la planta de les altres.", ["Alcohol de 96°"]),
      T("setmana", "plagues", "Polvoritza sabó potàssic", "Barreja'l amb una mica d'alcohol segons l'etiqueta i repeteix cada setmana fins que desapareguin.", ["Sabó potàssic"]),
      T("sempre", "plagues", "Revisa-la cada setmana", "Mira les axil·les de les fulles, i les arrels quan la trasplantis."),
    ],
  },
  closca: {
    name: "Cotxinilla de closca", kind: "plaga", severity: "moderate",
    gemma: "scale insects: brown shells stuck to stems or leaves",
    explain: "Petites closques marrons enganxades a tiges i fulles que xuclen la saba i fan melassa.",
    match: (s) => (s.has("closques") ? 0.95 : 0),
    tips: [
      T("ara", "plagues", "Raspalla-les", "Treu les closques amb un raspall de dents vell i aigua amb sabó."),
      T("setmana", "plagues", "Tracta amb oli de parafina", "Les ofega. Aplica'l fora de les hores de sol i repeteix al cap de 15 dies.", ["Oli de parafina", "Sabó potàssic"]),
    ],
  },
  aranya: {
    name: "Aranya vermella", kind: "plaga", severity: "moderate",
    gemma: "spider mites: fine webbing and pale speckles",
    explain: "Àcars minúsculs que fan puntets clars a les fulles i teles fines; els afavoreix l'ambient sec i calent.",
    match: (s) => (s.has("teles") ? 0.9 : 0),
    tips: [
      T("ara", "plagues", "Dutxa la planta", "Mulla bé les fulles per sota: els àcars no suporten la humitat."),
      T("setmana", "plagues", "Polvoritza sabó potàssic", "Insisteix al revers de les fulles cada 5 dies, tres vegades.", ["Sabó potàssic"]),
      T("sempre", "entorn", "Augmenta la humitat", "Allunya-la de la calefacció. A l'exterior hi ha àcars depredadors que la controlen.", ["Àcars depredadors (Phytoseiulus persimilis)"]),
    ],
  },
  mosca_blanca: {
    name: "Mosca blanca", kind: "plaga", severity: "moderate",
    gemma: "whitefly: tiny white flies under leaves",
    explain: "Mosques petites i blanques al revers de les fulles que xuclen la saba i fan melassa.",
    match: (s) => (s.has("mosca_blanca") ? 0.95 : 0),
    tips: [
      T("ara", "plagues", "Posa trampes grogues", "Les trampes adhesives grogues en capturen els adults.", ["Trampes cromàtiques grogues"]),
      T("setmana", "plagues", "Polvoritza sabó potàssic o neem", "Al revers de les fulles, al vespre, cada 5–7 dies.", ["Sabó potàssic", "Oli de neem"]),
    ],
  },
  mosquits: {
    name: "Mosquit del substrat", kind: "plaga", severity: "low",
    gemma: "fungus gnats around wet potting soil",
    explain: "Mosquits petits que crien al substrat humit; les larves poden danyar les arrels joves.",
    match: (s) => (s.has("mosquits") ? 0.9 : 0),
    adjust: { water: "less" },
    tips: [
      T("ara", "reg", "Deixa assecar el substrat", "Les larves necessiten humitat: espaia els regs."),
      T("ara", "plagues", "Posa una trampa groga", "Clava una trampa adhesiva al test per atrapar els adults.", ["Trampes cromàtiques grogues"]),
      T("setmana", "plagues", "Tracta el substrat", "Rega amb Bacillus thuringiensis israelensis o cobreix la superfície amb 1 cm de sorra.", ["Bacillus thuringiensis israelensis (Bti)", "Sorra"]),
    ],
  },
  fumagina: {
    name: "Fumagina", kind: "malaltia", severity: "low",
    gemma: "sooty mould: black powder on sticky leaves",
    explain: "Una pols negra que creix sobre la melassa d'insectes com el pugó, la cotxinilla o la mosca blanca.",
    match: (s) => (s.has("melassa") ? 0.8 : 0),
    tips: [
      T("setmana", "plagues", "Busca l'insecte que la causa", "Mira el revers de les fulles i les tiges; sense melassa, la fumagina desapareix."),
      T("setmana", "malalties", "Neteja les fulles", "Renta-les amb aigua i una mica de sabó potàssic.", ["Sabó potàssic"]),
    ],
  },
  cargols: {
    name: "Cargols i llimacs", kind: "plaga", severity: "moderate",
    gemma: "snails or slugs: chewed leaves and slime trails",
    explain: "Es mengen fulles i brots, sobretot de nit i quan ha plogut.",
    match: (s) => (s.has("rastres") ? 0.9 : s.has("forats") && !s.has("erugues") ? 0.4 : 0),
    tips: [
      T("ara", "plagues", "Recull-los al vespre", "Revisa la planta amb una llanterna després de ploure."),
      T("setmana", "plagues", "Fes servir fosfat fèrric", "És un esquer apte per a horts ecològics: escampa'n poc al voltant de la planta.", ["Esquer de fosfat fèrric"]),
    ],
  },
  erugues: {
    name: "Erugues", kind: "plaga", severity: "moderate",
    gemma: "caterpillars: chewed leaves, droppings, holes in stems",
    explain: "Larves de papallona que es mengen les fulles o fan galeries a les tiges, com la papallona del gerani.",
    match: (s) => (s.has("erugues") ? 0.9 : s.has("forats") ? 0.5 : 0),
    tips: [
      T("ara", "plagues", "Treu-les a mà", "Revisa fulles i tiges i retira'n les erugues i els ous."),
      T("setmana", "plagues", "Tracta amb Bacillus thuringiensis", "És un insecticida biològic que només afecta les erugues. Aplica'l al vespre i repeteix-ho al cap d'una setmana.", ["Bacillus thuringiensis var. kurstaki"]),
    ],
  },
  minador: {
    name: "Minador de fulles", kind: "plaga", severity: "low",
    gemma: "leaf miner: winding trails inside leaves",
    explain: "Larves que fan galeries sinuoses dins les fulles; als cítrics és molt habitual a l'estiu.",
    match: (s) => (s.has("galeries") ? 0.95 : 0),
    tips: [
      T("ara", "poda", "Retira les fulles més afectades", "Si n'hi ha poques, talla-les; en un arbre gran no cal."),
      T("sempre", "plagues", "Protegeix les brotades noves", "A l'estiu, polvoritza oli de neem sobre els brots tendres.", ["Oli de neem"]),
    ],
  },
  cremades: {
    name: "Cremades de sol", kind: "llum", severity: "low",
    gemma: "sunburn: bleached or brown patches on exposed leaves",
    explain: "Zones blanquinoses o marrons a les fulles més exposades, per massa sol o un canvi de lloc brusc.",
    match: (s) => (s.has("cremades") ? 0.8 : 0),
    adjust: { light: "less" },
    tips: [
      T("ara", "llum", "Fes-li ombra a les hores fortes", "Mou-la a un lloc amb sol de matí o posa-hi una malla d'ombreig a l'estiu."),
      T("sempre", "llum", "Acostuma-la al sol a poc a poc", "Quan la canviïs de lloc, fes-ho de mica en mica durant una o dues setmanes."),
    ],
  },
  manca_llum: {
    name: "Falta de llum", kind: "llum", severity: "low",
    gemma: "not enough light: stretched pale growth",
    explain: "La planta s'estira cap a la llum i fa tiges primes i fulles petites i pàl·lides.",
    match: (s) => (s.has("allargada") ? 0.85 : 0),
    adjust: { light: "more" },
    tips: [
      T("setmana", "llum", "Posa-la en un lloc més lluminós", "A prop d'una finestra sense sol directe fort, i gira el test cada setmana."),
      T("sempre", "poda", "Retalla les tiges allargades", "A la primavera, perquè rebrotin més compactes."),
    ],
  },
  test_petit: {
    name: "Test petit", kind: "arrels", severity: "low",
    gemma: "pot-bound: roots coming out of the pot",
    explain: "Les arrels omplen el test: la planta s'asseca de pressa i creix poc.",
    match: (s) => (s.has("arrels_fora") ? 0.8 : 0),
    tips: [
      T("setmana", "substrat", "Trasplanta-la a la primavera", "A un test 2–4 cm més ample i amb substrat nou.", ["Substrat de qualitat"]),
    ],
  },
  estres: {
    name: "Caiguda de fulles per estrès", kind: "entorn", severity: "low",
    gemma: "leaf drop from stress: moves, draughts, cold",
    explain: "Canvis de lloc, corrents d'aire, fred o un reg irregular poden fer caure fulles.",
    match: (s) => (s.has("cauen") && !s.has("substrat_moll") && !s.has("substrat_sec") ? 0.5 : 0),
    tips: [
      T("sempre", "entorn", "Evita els canvis bruscos", "Deixa-la en un lloc fix, amb bona llum, lluny de portes i calefaccions."),
    ],
  },
  fred: {
    name: "Danys per fred", kind: "entorn", severity: "moderate",
    gemma: "cold damage: dark, translucent or collapsed leaves after cold",
    explain: "Fulles fosques, translúcides o arrugades després d'una nit freda.",
    match: () => 0,
    tips: [
      T("ara", "entorn", "Protegeix-la del fred", "Les nits de gelada, entra-la a casa o cobreix-la amb una tela tèrmica.", ["Tela tèrmica"]),
      T("sempre", "poda", "No podis encara les parts danyades", "Espera la primavera: protegeixen la resta de la planta."),
    ],
  },
};

/* ------------------------------------------------------------------ */
/* Grups de cures                                                      */
/* ------------------------------------------------------------------ */

export const CARE_GROUPS = {
  citrics: {
    label: "Cítrics",
    care: {
      Llum: "Ple sol, com a mínim 6 hores al dia.",
      Reg: "Quan els 3 cm de dalt del substrat siguin secs; menys a l'hivern.",
      Substrat: "Drenant i lleugerament àcid, en un test amb forats.",
      Temperatura: "Aguanten fins a uns −3 °C; protegeix-los de gelades i vent fred.",
      Adob: "Adob per a cítrics amb ferro i magnesi, de març a octubre.",
    },
    season: {
      hivern: "Rega poc i no adobis. Si gela, cobreix-lo amb una tela tèrmica.",
      primavera: "Brota de nou: vigila el pugó als brots tendres i torna a adobar.",
      estiu: "Rega sovint i a fons, i vigila el minador a les fulles noves.",
      tardor: "Redueix el reg i l'adob a mesura que baixen les temperatures.",
    },
    watch: "A Catalunya, els problemes més freqüents són el pugó, el minador dels cítrics, la cotxinilla i la clorosi fèrrica per l'aigua calcària.",
  },
  mediterrania: {
    label: "Arbres i arbustos mediterranis",
    care: {
      Llum: "Ple sol.",
      Reg: "Resisteixen la sequera un cop arrelats; en test, rega quan el substrat sigui sec.",
      Substrat: "Drenant, encara que sigui pobre o calcari.",
      Temperatura: "Aguanten la calor i les glaçades lleugeres.",
      Adob: "Poc exigents: un adob d'alliberament lent a la primavera n'hi ha prou.",
    },
    season: {
      hivern: "Bon moment per a podes lleugeres, sempre fora dels dies de gelada.",
      primavera: "Vigila el pugó i la cotxinilla als brots nous.",
      estiu: "En test, rega abundantment però de manera espaiada.",
      tardor: "Redueix el reg i aprofita per treure branques seques.",
    },
    watch: "A l'olivera, vigila la cotxinilla negra (amb fumagina) i l'ull de gall, que fa taques rodones a les fulles.",
  },
  aromatiques: {
    label: "Aromàtiques",
    care: {
      Llum: "Ple sol.",
      Reg: "Romaní, lavanda i farigola volen poca aigua; alfàbrega i menta, el substrat lleugerament humit.",
      Substrat: "Drenant; en test, afegeix-hi sorra o perlita.",
      Temperatura: "Les mediterrànies aguanten el fred; l'alfàbrega pateix per sota de 10 °C.",
      Adob: "Poc: massa adob en redueix l'aroma.",
    },
    season: {
      hivern: "Rega molt poc. L'alfàbrega és anual i a l'hivern s'acaba.",
      primavera: "Pinça les puntes perquè es facin més frondoses.",
      estiu: "Talla les flors de l'alfàbrega perquè continuï fent fulles.",
      tardor: "Poda lleugera del romaní i la lavanda després de florir.",
    },
  },
  suculentes: {
    label: "Suculentes i cactus",
    care: {
      Llum: "Molta llum; el sol directe, si s'hi acostumen a poc a poc.",
      Reg: "Només quan el substrat sigui ben sec. A l'hivern, gairebé gens.",
      Substrat: "Per a cactus, o barreja amb molta sorra o perlita.",
      Temperatura: "Protegeix-les de les gelades i de la pluja persistent a l'hivern.",
      Adob: "Adob per a cactus un cop al mes a la primavera i l'estiu.",
    },
    season: {
      hivern: "Gairebé sense reg, i a cobert de la pluja.",
      primavera: "Bona època per trasplantar i fer esqueixos.",
      estiu: "Rega a fons però espaiat; a ple sol, vigila les cremades.",
      tardor: "Ves reduint el reg fins a l'hivern.",
    },
    watch: "El problema més habitual és l'excés de reg (tija tova i podridura), seguit de la cotxinilla cotonosa.",
  },
  palmeres: {
    label: "Palmeres",
    care: {
      Llum: "Sol les d'exterior; les d'interior, llum indirecta.",
      Reg: "Regular sense entollar; les d'exterior aguanten la sequera un cop arrelades.",
      Substrat: "Drenant.",
      Temperatura: "La majoria aguanten el fred suau de la costa.",
      Adob: "Adob per a palmeres a la primavera i l'estiu.",
    },
    season: {
      hivern: "Rega poc i no podis.",
      primavera: "Comença a adobar.",
      estiu: "Rega regularment, sobretot en test.",
      tardor: "Treu només les fulles completament seques.",
    },
    watch: "A Catalunya, el morrut roig i la papallona de les palmeres poden ser greus. Si les fulles centrals cauen o hi ha forats amb serradures, avisa un professional.",
  },
  coniferes: {
    label: "Coníferes",
    care: {
      Llum: "Sol.",
      Reg: "Poca aigua un cop arrelades.",
      Substrat: "Drenant.",
      Temperatura: "Molt resistents.",
      Adob: "Gairebé no en necessiten.",
    },
    season: {
      hivern: "Mira si hi ha nius de processionària a les branques dels pins.",
      primavera: "Rega els exemplars joves si no plou.",
      estiu: "Regs profunds i espaiats per als joves.",
      tardor: "No cal fer res especial.",
    },
    watch: "La processionària del pi fa nius de seda a l'hivern. No toquis les erugues, que són urticants; si n'hi ha, avisa un professional o l'ajuntament.",
  },
  fruiters: {
    label: "Fruiters",
    care: {
      Llum: "Ple sol.",
      Reg: "Regular a l'estiu, sobretot quan creix el fruit.",
      Substrat: "Fondo i drenant; en test, substrat ric.",
      Temperatura: "Molts necessiten fred a l'hivern per donar fruit.",
      Adob: "Adob orgànic a final d'hivern.",
    },
    season: {
      hivern: "Època de poda dels caducifolis, fora dels dies de gelada.",
      primavera: "Vigila el pugó als brots i l'oïdi.",
      estiu: "Rega i aclareix els fruits si n'hi ha massa.",
      tardor: "Recull les fulles caigudes si hi ha hagut malalties de fong.",
    },
  },
  arbres: {
    label: "Arbres ornamentals",
    care: {
      Llum: "Sol.",
      Reg: "Un cop arrelats, en tenen prou amb la pluja; els joves, regs profunds a l'estiu.",
      Substrat: "Fondo i drenant.",
      Temperatura: "Resistents al clima de la costa.",
      Adob: "No acostumen a necessitar-ne.",
    },
    season: {
      hivern: "Època de poda dels caducifolis.",
      primavera: "Vigila el pugó a les fulles noves.",
      estiu: "Rega els exemplars joves.",
      tardor: "Pots aprofitar la fulla caiguda com a encoixinat.",
    },
    watch: "Si és un arbre del carrer, qualsevol problema el gestiona l'ajuntament.",
  },
  flors: {
    label: "Flors i enfiladisses de balcó",
    care: {
      Llum: "Sol o semiombra; la majoria floreixen més amb sol.",
      Reg: "Regular, deixant assecar la capa de dalt entre regs; més sovint a l'estiu.",
      Substrat: "Universal de qualitat, amb bon drenatge.",
      Temperatura: "Protegeix les tropicals, com l'hibisc o la buguenvíl·lea jove, de les gelades.",
      Adob: "Adob per a plantes amb flor cada dues setmanes, a la primavera i l'estiu.",
    },
    season: {
      hivern: "Rega menys i retalla les tiges seques.",
      primavera: "Bona època per trasplantar i tornar a adobar.",
      estiu: "Rega a primera hora o al vespre i treu les flors pansides.",
      tardor: "Redueix el reg i protegeix les més delicades del fred.",
    },
    watch: "Als geranis, la papallona del gerani fa forats a les tiges, que s'acaben assecant.",
  },
  rosers: {
    label: "Rosers",
    care: {
      Llum: "Ple sol, mínim 6 hores.",
      Reg: "Al peu, sense mullar les fulles; 2–3 cops per setmana a l'estiu.",
      Substrat: "Ric i ben drenat.",
      Temperatura: "Molt resistents al fred.",
      Adob: "Adob per a rosers a la primavera i després de cada floració.",
    },
    season: {
      hivern: "Poda principal a final d'hivern, cap al febrer.",
      primavera: "Vigila el pugó als capolls.",
      estiu: "Treu les flors pansides per allargar la floració.",
      tardor: "Recull les fulles amb taques perquè la malaltia no torni.",
    },
    watch: "Problemes típics: pugó, oïdi, taca negra i rovell.",
  },
  horta: {
    label: "Hortalisses",
    care: {
      Llum: "Ple sol, 6–8 hores.",
      Reg: "Regular i al peu; el reg irregular fa esquerdar els fruits.",
      Substrat: "Ric en matèria orgànica i ben drenat.",
      Temperatura: "Les d'estiu, com la tomaquera o la pebrotera, no toleren el fred.",
      Adob: "Adob ric en potassi quan comença a florir.",
    },
    season: {
      hivern: "Temporada de cols, enciams i faves.",
      primavera: "Planta les tomaqueres i pebroteres quan ja no faci fred.",
      estiu: "Rega cada dia en test i vigila la mosca blanca i l'aranya vermella.",
      tardor: "Arrenca les plantes d'estiu acabades.",
    },
    watch: "A la tomaquera, vigila el mildiu (taques marrons), l'oïdi, la mosca blanca i la tuta, que fa galeries a les fulles.",
  },
  interior: {
    label: "Plantes d'interior",
    care: {
      Llum: "Llum indirecta i abundant; el sol directe pot cremar les fulles.",
      Reg: "Quan els 3–5 cm de dalt del substrat siguin secs. Buida el plat al cap de 15 minuts.",
      Substrat: "Per a plantes verdes, amb perlita o escorça.",
      Temperatura: "Entre 16 i 27 °C, lluny de calefaccions i corrents d'aire.",
      Adob: "Adob per a plantes verdes cada 2–4 setmanes, de primavera a estiu.",
    },
    season: {
      hivern: "Rega menys i no adobis. La calefacció asseca l'ambient: neteja les fulles amb un drap humit.",
      primavera: "Bona època per trasplantar si les arrels surten pel test.",
      estiu: "Allunya-la del sol directe de les finestres.",
      tardor: "Redueix el reg a mesura que hi ha menys llum.",
    },
    watch: "Problemes habituals: excés de reg, aranya vermella amb l'ambient sec i cotxinilla cotonosa.",
  },
  falgueres: {
    label: "Falgueres",
    care: {
      Llum: "Llum indirecta o semiombra.",
      Reg: "Substrat sempre lleugerament humit, mai entollat.",
      Substrat: "Ric i esponjós.",
      Temperatura: "Fresca i humida; lluny de la calefacció.",
      Adob: "Adob suau un cop al mes a la primavera i l'estiu.",
    },
    season: {
      hivern: "Polvoritza les fulles si hi ha calefacció.",
      primavera: "Bona època per dividir-la o trasplantar-la.",
      estiu: "Que no li falti aigua.",
      tardor: "Treu les fulles seques.",
    },
    watch: "Les puntes marrons solen indicar un ambient massa sec.",
  },
  orquidies: {
    label: "Orquídies",
    care: {
      Llum: "Llum indirecta intensa, sense sol directe.",
      Reg: "Submergeix el test 10 minuts quan les arrels es vegin platejades, i escorre-ho bé.",
      Substrat: "Escorça per a orquídies, mai terra.",
      Temperatura: "18–28 °C; una nit una mica més fresca afavoreix la floració.",
      Adob: "Adob per a orquídies a mitja dosi cada 2–3 regs.",
    },
    season: {
      hivern: "Rega una mica menys.",
      primavera: "Trasplanta-la, si cal, quan acabi de florir.",
      estiu: "Protegeix-la del sol directe.",
      tardor: "Unes nits més fresques l'ajuden a treure vares noves.",
    },
    watch: "Les arrels toves i marrons indiquen excés de reg.",
  },
  temporada: {
    label: "Bulboses i plantes de temporada",
    care: {
      Llum: "Molta llum.",
      Reg: "Moderat mentre floreixen; després, deixa assecar les fulles.",
      Substrat: "Drenant.",
      Temperatura: "Fresca.",
      Adob: "Poc.",
    },
    season: {
      hivern: "Moltes floreixen ara o acaben de brotar.",
      primavera: "Després de florir, deixa que les fulles s'assequin soles.",
      estiu: "Els bulbs reposen.",
      tardor: "Època de plantar bulbs de primavera.",
    },
    watch: "És normal que s'assequin després de florir.",
  },
  generic: {
    label: "Planta",
    care: {
      Llum: "Depèn de l'espècie: la majoria volen molta llum; les d'interior, sense sol directe.",
      Reg: "Quan la capa de dalt del substrat sigui seca, sense deixar el test entollat.",
      Substrat: "De qualitat i amb bon drenatge.",
      Temperatura: "Protegeix-la de gelades i canvis bruscos.",
      Adob: "Equilibrat, a la primavera i l'estiu.",
    },
    season: {
      hivern: "Rega menys i no adobis.",
      primavera: "Bona època per trasplantar i tornar a adobar.",
      estiu: "Vigila que no li falti aigua.",
      tardor: "Ves reduint el reg.",
    },
  },
};

/* ------------------------------------------------------------------ */
/* Plantes amb nom català                                              */
/* ------------------------------------------------------------------ */
// [nom científic, nom català, grup, sinònims]

const P = (sci, ca, group, aliases = []) => ({ sci, ca, group, aliases });

export const PLANTS = [
  // Mediterranis
  P("Olea europaea", "Olivera", "mediterrania"),
  P("Ceratonia siliqua", "Garrofer", "mediterrania"),
  P("Quercus ilex", "Alzina", "mediterrania"),
  P("Quercus suber", "Surera", "mediterrania"),
  P("Quercus coccifera", "Garric", "mediterrania"),
  P("Quercus pubescens", "Roure martinenc", "arbres"),
  P("Quercus robur", "Roure pènol", "arbres"),
  P("Laurus nobilis", "Llorer", "mediterrania"),
  P("Nerium oleander", "Baladre", "mediterrania"),
  P("Pistacia lentiscus", "Llentiscle", "mediterrania"),
  P("Arbutus unedo", "Arboç", "mediterrania"),
  P("Myrtus communis", "Murtra", "mediterrania"),
  P("Rhamnus alaternus", "Aladern", "mediterrania"),
  P("Pittosporum tobira", "Pitòspor", "mediterrania"),
  P("Viburnum tinus", "Marfull", "mediterrania"),
  P("Spartium junceum", "Ginesta", "mediterrania"),
  P("Cistus albidus", "Estepa blanca", "mediterrania"),
  P("Cistus monspeliensis", "Estepa negra", "mediterrania"),
  P("Buxus sempervirens", "Boix", "mediterrania"),
  P("Euonymus japonicus", "Evònim", "mediterrania"),
  P("Lonicera implexa", "Lligabosc", "mediterrania"),
  P("Carpobrotus edulis", "Bàlsam", "suculentes"),
  // Coníferes
  P("Pinus halepensis", "Pi blanc", "coniferes"),
  P("Pinus pinea", "Pi pinyer", "coniferes"),
  P("Pinus nigra", "Pinassa", "coniferes"),
  P("Pinus sylvestris", "Pi roig", "coniferes"),
  P("Pinus pinaster", "Pinastre", "coniferes"),
  P("Cupressus sempervirens", "Xiprer", "coniferes"),
  P("Cupressus arizonica", "Xiprer d'Arizona", "coniferes"),
  P("Juniperus communis", "Ginebre", "coniferes"),
  P("Juniperus oxycedrus", "Càdec", "coniferes"),
  P("Juniperus phoenicea", "Savina", "coniferes"),
  P("Taxus baccata", "Teix", "coniferes"),
  P("Cedrus atlantica", "Cedre de l'Atles", "coniferes"),
  P("Cedrus deodara", "Cedre de l'Himàlaia", "coniferes"),
  P("Abies alba", "Avet", "coniferes"),
  // Arbres de carrer i parcs
  P("Platanus × hispanica", "Plàtan", "arbres", ["Platanus × acerifolia", "Platanus hispanica", "Platanus acerifolia"]),
  P("Celtis australis", "Lledoner", "arbres"),
  P("Ulmus minor", "Om", "arbres"),
  P("Ulmus pumila", "Om de Sibèria", "arbres"),
  P("Populus alba", "Àlber", "arbres"),
  P("Populus nigra", "Pollancre", "arbres"),
  P("Fraxinus angustifolia", "Freixe de fulla petita", "arbres"),
  P("Tilia platyphyllos", "Til·ler", "arbres"),
  P("Robinia pseudoacacia", "Robínia", "arbres"),
  P("Melia azedarach", "Mèlia", "arbres"),
  P("Jacaranda mimosifolia", "Jacaranda", "arbres"),
  P("Tipuana tipu", "Tipuana", "arbres"),
  P("Styphnolobium japonicum", "Sòfora", "arbres", ["Sophora japonica"]),
  P("Brachychiton populneus", "Braquiquiton", "arbres"),
  P("Schinus molle", "Pebrer bord", "arbres"),
  P("Ailanthus altissima", "Ailant", "arbres"),
  P("Morus alba", "Morera blanca", "arbres"),
  P("Morus nigra", "Morera negra", "fruiters"),
  P("Magnolia grandiflora", "Magnòlia", "arbres"),
  P("Cercis siliquastrum", "Arbre de l'amor", "arbres"),
  P("Acacia dealbata", "Mimosa", "arbres"),
  P("Ligustrum lucidum", "Troana", "arbres"),
  P("Ficus microcarpa", "Llorer d'Índies", "arbres"),
  P("Prunus cerasifera", "Mirabolà", "arbres"),
  // Palmeres
  P("Phoenix canariensis", "Palmera canària", "palmeres"),
  P("Phoenix dactylifera", "Palmera datilera", "palmeres"),
  P("Washingtonia robusta", "Washingtònia", "palmeres"),
  P("Washingtonia filifera", "Washingtònia", "palmeres"),
  P("Chamaerops humilis", "Margalló", "palmeres"),
  P("Cycas revoluta", "Cica", "palmeres"),
  // Fruiters
  P("Ficus carica", "Figuera", "fruiters"),
  P("Prunus dulcis", "Ametller", "fruiters"),
  P("Prunus persica", "Presseguer", "fruiters"),
  P("Prunus avium", "Cirerer", "fruiters"),
  P("Prunus domestica", "Prunera", "fruiters"),
  P("Prunus armeniaca", "Albercoquer", "fruiters"),
  P("Malus domestica", "Pomera", "fruiters"),
  P("Pyrus communis", "Perera", "fruiters"),
  P("Cydonia oblonga", "Codonyer", "fruiters"),
  P("Punica granatum", "Magraner", "fruiters"),
  P("Eriobotrya japonica", "Nesprer", "fruiters"),
  P("Diospyros kaki", "Caqui", "fruiters"),
  P("Juglans regia", "Noguera", "fruiters"),
  P("Corylus avellana", "Avellaner", "fruiters"),
  P("Castanea sativa", "Castanyer", "fruiters"),
  P("Vitis vinifera", "Vinya", "fruiters"),
  P("Persea americana", "Alvocater", "fruiters"),
  // Cítrics
  P("Citrus × limon", "Llimoner", "citrics", ["Citrus limon"]),
  P("Citrus × sinensis", "Taronger", "citrics", ["Citrus sinensis"]),
  P("Citrus × aurantium", "Taronger amarg", "citrics", ["Citrus aurantium"]),
  P("Citrus reticulata", "Mandariner", "citrics"),
  P("Citrus × paradisi", "Aranger", "citrics", ["Citrus paradisi"]),
  P("Citrus japonica", "Kumquat", "citrics", ["Fortunella japonica", "Fortunella margarita"]),
  // Balcó i jardí
  P("Bougainvillea glabra", "Buguenvíl·lea", "flors"),
  P("Bougainvillea spectabilis", "Buguenvíl·lea", "flors"),
  P("Jasminum officinale", "Gessamí", "flors"),
  P("Trachelospermum jasminoides", "Gessamí estrellat", "flors"),
  P("Hedera helix", "Heura", "flors"),
  P("Wisteria sinensis", "Glicina", "flors"),
  P("Plumbago auriculata", "Plumbago", "flors"),
  P("Lonicera japonica", "Lligabosc del Japó", "flors"),
  P("Parthenocissus quinquefolia", "Parra verge", "flors"),
  P("Parthenocissus tricuspidata", "Parra verge", "flors"),
  P("Pelargonium × hortorum", "Gerani", "flors", ["Pelargonium zonale", "Pelargonium hortorum"]),
  P("Pelargonium peltatum", "Gitaneta", "flors"),
  P("Pelargonium graveolens", "Malvarosa", "aromatiques"),
  P("Petunia × atkinsiana", "Petúnia", "flors", ["Petunia hybrida", "Petunia × hybrida"]),
  P("Hibiscus rosa-sinensis", "Hibisc", "flors"),
  P("Hibiscus syriacus", "Hibisc de Síria", "flors"),
  P("Lantana camara", "Lantana", "flors"),
  P("Argyranthemum frutescens", "Margarida", "flors"),
  P("Dianthus caryophyllus", "Clavell", "flors"),
  P("Tagetes erecta", "Clavell de moro", "flors"),
  P("Tagetes patula", "Clavell de moro", "flors"),
  P("Calendula officinalis", "Boixac", "flors"),
  P("Viola × wittrockiana", "Pensament", "flors"),
  P("Hydrangea macrophylla", "Hortènsia", "flors"),
  P("Camellia japonica", "Camèlia", "flors"),
  P("Gardenia jasminoides", "Gardènia", "flors"),
  P("Strelitzia reginae", "Ocell del paradís", "flors"),
  P("Agapanthus africanus", "Agapant", "flors"),
  P("Agapanthus praecox", "Agapant", "flors"),
  P("Rosa", "Roser", "rosers"),
  // Aromàtiques
  P("Salvia rosmarinus", "Romaní", "aromatiques", ["Rosmarinus officinalis"]),
  P("Lavandula angustifolia", "Lavanda", "aromatiques"),
  P("Lavandula latifolia", "Espígol", "aromatiques"),
  P("Lavandula stoechas", "Tomaní", "aromatiques"),
  P("Lavandula dentata", "Lavanda dentada", "aromatiques"),
  P("Thymus vulgaris", "Farigola", "aromatiques"),
  P("Salvia officinalis", "Sàlvia", "aromatiques"),
  P("Origanum vulgare", "Orenga", "aromatiques"),
  P("Origanum majorana", "Marduix", "aromatiques"),
  P("Ocimum basilicum", "Alfàbrega", "aromatiques"),
  P("Mentha spicata", "Menta", "aromatiques"),
  P("Mentha × piperita", "Menta pebrera", "aromatiques", ["Mentha piperita"]),
  P("Mentha suaveolens", "Mentastre", "aromatiques"),
  P("Melissa officinalis", "Tarongina", "aromatiques"),
  P("Aloysia citrodora", "Marialluïsa", "aromatiques", ["Aloysia citriodora"]),
  P("Petroselinum crispum", "Julivert", "aromatiques"),
  P("Coriandrum sativum", "Coriandre", "aromatiques"),
  P("Allium schoenoprasum", "Cibulet", "aromatiques"),
  P("Foeniculum vulgare", "Fonoll", "aromatiques"),
  P("Ruta graveolens", "Ruda", "aromatiques"),
  P("Santolina chamaecyparissus", "Espernallac", "aromatiques"),
  // Hort
  P("Solanum lycopersicum", "Tomaquera", "horta"),
  P("Capsicum annuum", "Pebrotera", "horta"),
  P("Solanum melongena", "Albergínia", "horta"),
  P("Solanum tuberosum", "Patatera", "horta"),
  P("Fragaria × ananassa", "Maduixera", "horta", ["Fragaria ananassa"]),
  P("Fragaria vesca", "Maduixera silvestre", "horta"),
  P("Cucurbita pepo", "Carbassera", "horta"),
  P("Cucumis sativus", "Cogombre", "horta"),
  P("Lactuca sativa", "Enciam", "horta"),
  P("Phaseolus vulgaris", "Mongetera", "horta"),
  P("Pisum sativum", "Pèsol", "horta"),
  P("Allium cepa", "Ceba", "horta"),
  P("Allium sativum", "All", "horta"),
  P("Brassica oleracea", "Col", "horta"),
  // Suculentes
  P("Aloe vera", "Àloe vera", "suculentes"),
  P("Aloe arborescens", "Àloe arborescent", "suculentes"),
  P("Agave americana", "Atzavara", "suculentes"),
  P("Opuntia ficus-indica", "Figuera de moro", "suculentes"),
  P("Crassula ovata", "Arbre de jade", "suculentes"),
  P("Kalanchoe blossfeldiana", "Kalanxoe", "suculentes"),
  P("Schlumbergera truncata", "Cactus de Nadal", "suculentes"),
  P("Beaucarnea recurvata", "Pota d'elefant", "suculentes"),
  P("Euphorbia milii", "Corona d'espines", "suculentes"),
  P("Yucca gigantea", "Iuca", "suculentes", ["Yucca elephantipes"]),
  // Interior
  P("Monstera deliciosa", "Costella d'Adam", "interior"),
  P("Epipremnum aureum", "Potus", "interior"),
  P("Philodendron hederaceum", "Filodendre", "interior"),
  P("Spathiphyllum wallisii", "Espatifil·lum", "interior"),
  P("Zamioculcas zamiifolia", "Zamioculca", "interior"),
  P("Dracaena trifasciata", "Llengua de sogra", "interior", ["Sansevieria trifasciata"]),
  P("Dracaena fragrans", "Tronc del Brasil", "interior"),
  P("Dracaena marginata", "Dràcena", "interior"),
  P("Ficus elastica", "Ficus de goma", "interior"),
  P("Ficus lyrata", "Ficus lira", "interior"),
  P("Ficus benjamina", "Ficus benjamina", "interior"),
  P("Chlorophytum comosum", "Cinta", "interior"),
  P("Schefflera arboricola", "Xeflera", "interior"),
  P("Anthurium andraeanum", "Anturi", "interior"),
  P("Pilea peperomioides", "Pilea", "interior"),
  P("Maranta leuconeura", "Maranta", "interior"),
  P("Aspidistra elatior", "Aspidistra", "interior"),
  P("Pachira aquatica", "Pachira", "interior"),
  P("Saintpaulia ionantha", "Violeta africana", "interior"),
  P("Hypoestes phyllostachya", "Hipoestes", "interior"),
  P("Howea forsteriana", "Kèntia", "interior"),
  P("Chamaedorea elegans", "Palmera de saló", "interior"),
  P("Dypsis lutescens", "Areca", "interior"),
  P("Euphorbia pulcherrima", "Flor de Nadal", "interior"),
  P("Tradescantia zebrina", "Amor d'home", "interior"),
  P("Tradescantia fluminensis", "Amor d'home", "interior"),
  P("Nephrolepis exaltata", "Falguera de Boston", "falgueres"),
  P("Asplenium nidus", "Falguera niu d'ocell", "falgueres"),
  P("Adiantum capillus-veneris", "Capil·lera", "falgueres"),
  P("Phalaenopsis amabilis", "Orquídia papallona", "orquidies"),
  // Temporada
  P("Cyclamen persicum", "Ciclamen", "temporada"),
  P("Narcissus pseudonarcissus", "Narcís", "temporada"),
  P("Hyacinthus orientalis", "Jacint", "temporada"),
  P("Convallaria majalis", "Lliri de maig", "temporada"),
  P("Iris germanica", "Lliri blau", "temporada"),
];

// Noms de gènere i grup de cures per gènere (per a espècies sense fitxa pròpia).
export const GENUS = {
  Abies: ["Avet", "coniferes"], Acacia: ["Acàcia", "arbres"], Acer: ["Auró", "arbres"],
  Adiantum: ["Capil·lera", "falgueres"], Aeonium: [null, "suculentes"], Agapanthus: ["Agapant", "flors"],
  Agave: ["Atzavara", "suculentes"], Aglaonema: ["Aglaonema", "interior"], Ailanthus: ["Ailant", "arbres"],
  Alocasia: ["Alocàsia", "interior"], Aloe: ["Àloe", "suculentes"], Allium: ["All", "horta"],
  Alnus: ["Vern", "arbres"], Anthurium: ["Anturi", "interior"], Arbutus: ["Arboç", "mediterrania"],
  Asparagus: ["Esparreguera", "interior"], Aspidistra: ["Aspidistra", "interior"], Asplenium: ["Falzia", "falgueres"],
  Beaucarnea: ["Pota d'elefant", "suculentes"], Begonia: ["Begònia", "interior"], Betula: ["Bedoll", "arbres"],
  Bougainvillea: ["Buguenvíl·lea", "flors"], Brachychiton: ["Braquiquiton", "arbres"], Brassica: ["Col", "horta"],
  Buxus: ["Boix", "mediterrania"], Calathea: ["Calatea", "interior"], Calendula: ["Boixac", "flors"],
  Camellia: ["Camèlia", "flors"], Capsicum: ["Pebrotera", "horta"], Carpobrotus: ["Bàlsam", "suculentes"],
  Castanea: ["Castanyer", "fruiters"], Cedrus: ["Cedre", "coniferes"], Celtis: ["Lledoner", "arbres"],
  Ceratonia: ["Garrofer", "mediterrania"], Cercis: ["Arbre de l'amor", "arbres"], Chamaedorea: ["Palmera de saló", "interior"],
  Chamaerops: ["Margalló", "palmeres"], Chlorophytum: ["Cinta", "interior"], Chrysanthemum: ["Crisantem", "temporada"],
  Cistus: ["Estepa", "mediterrania"], Citrus: ["Cítric", "citrics"], Convallaria: ["Lliri de maig", "temporada"],
  Corylus: ["Avellaner", "fruiters"], Crassula: ["Crassula", "suculentes"], Ctenanthe: ["Ctenanthe", "interior"],
  Cucumis: ["Cogombre", "horta"], Cucurbita: ["Carbassera", "horta"], Cupressus: ["Xiprer", "coniferes"],
  Cycas: ["Cica", "palmeres"], Cyclamen: ["Ciclamen", "temporada"], Cydonia: ["Codonyer", "fruiters"],
  Dianthus: ["Clavell", "flors"], Dieffenbachia: ["Difenbàquia", "interior"], Diospyros: ["Caqui", "fruiters"],
  Dracaena: ["Dràcena", "interior"], Dypsis: ["Areca", "interior"], Echeveria: ["Echeveria", "suculentes"],
  Epipremnum: ["Potus", "interior"], Erica: ["Bruc", "mediterrania"], Eriobotrya: ["Nesprer", "fruiters"],
  Eucalyptus: ["Eucaliptus", "arbres"], Euonymus: ["Evònim", "mediterrania"], Euphorbia: ["Lletrera", "suculentes"],
  Fagus: ["Faig", "arbres"], Ficus: ["Ficus", "interior"], Fragaria: ["Maduixera", "horta"],
  Fraxinus: ["Freixe", "arbres"], Gardenia: ["Gardènia", "flors"], Gazania: ["Gazània", "flors"],
  Genista: ["Ginesta", "mediterrania"], Goeppertia: ["Calatea", "interior"], Haworthia: ["Haworthia", "suculentes"],
  Hedera: ["Heura", "flors"], Hibiscus: ["Hibisc", "flors"], Howea: ["Kèntia", "interior"],
  Hyacinthus: ["Jacint", "temporada"], Hydrangea: ["Hortènsia", "flors"], Iris: ["Lliri", "temporada"],
  Jacaranda: ["Jacaranda", "arbres"], Jasminum: ["Gessamí", "flors"], Juglans: ["Noguera", "fruiters"],
  Juniperus: ["Ginebre", "coniferes"], Kalanchoe: ["Kalanxoe", "suculentes"], Lactuca: ["Enciam", "horta"],
  Lantana: ["Lantana", "flors"], Laurus: ["Llorer", "mediterrania"], Lavandula: ["Lavanda", "aromatiques"],
  Ligustrum: ["Troana", "arbres"], Lilium: ["Lliri", "temporada"], Lonicera: ["Lligabosc", "flors"],
  Magnolia: ["Magnòlia", "arbres"], Malus: ["Pomera", "fruiters"], Maranta: ["Maranta", "interior"],
  Melia: ["Mèlia", "arbres"], Melissa: ["Tarongina", "aromatiques"], Mentha: ["Menta", "aromatiques"],
  Monstera: ["Costella d'Adam", "interior"], Morus: ["Morera", "arbres"], Myrtus: ["Murtra", "mediterrania"],
  Narcissus: ["Narcís", "temporada"], Nephrolepis: ["Falguera", "falgueres"], Nerium: ["Baladre", "mediterrania"],
  Ocimum: ["Alfàbrega", "aromatiques"], Olea: ["Olivera", "mediterrania"], Opuntia: ["Figuera de moro", "suculentes"],
  Origanum: ["Orenga", "aromatiques"], Pachira: ["Pachira", "interior"], Parthenocissus: ["Parra verge", "flors"],
  Pelargonium: ["Gerani", "flors"], Peperomia: ["Peperòmia", "interior"], Persea: ["Alvocater", "fruiters"],
  Petunia: ["Petúnia", "flors"], Phalaenopsis: ["Orquídia", "orquidies"], Phaseolus: ["Mongetera", "horta"],
  Philodendron: ["Filodendre", "interior"], Phoenix: ["Palmera", "palmeres"], Pilea: ["Pilea", "interior"],
  Pinus: ["Pi", "coniferes"], Pistacia: ["Llentiscle", "mediterrania"], Pittosporum: ["Pitòspor", "mediterrania"],
  Platanus: ["Plàtan", "arbres"], Populus: ["Pollancre", "arbres"], Prunus: [null, "fruiters"],
  Punica: ["Magraner", "fruiters"], Pyrus: ["Perera", "fruiters"], Quercus: ["Roure o alzina", "mediterrania"],
  Rhamnus: ["Aladern", "mediterrania"], Robinia: ["Robínia", "arbres"], Rosa: ["Roser", "rosers"],
  Rosmarinus: ["Romaní", "aromatiques"], Rubus: ["Esbarzer", "fruiters"], Saintpaulia: ["Violeta africana", "interior"],
  Salix: ["Salze", "arbres"], Salvia: ["Sàlvia", "aromatiques"], Sansevieria: ["Llengua de sogra", "interior"],
  Schefflera: ["Xeflera", "interior"], Schinus: ["Pebrer bord", "arbres"], Schlumbergera: ["Cactus de Nadal", "suculentes"],
  Sedum: ["Crespinell", "suculentes"], Solanum: [null, "horta"], Spartium: ["Ginesta", "mediterrania"],
  Spathiphyllum: ["Espatifil·lum", "interior"], Strelitzia: ["Ocell del paradís", "flors"], Styphnolobium: ["Sòfora", "arbres"],
  Tagetes: ["Clavell de moro", "flors"], Taxus: ["Teix", "coniferes"], Thuja: ["Tuia", "coniferes"],
  Thymus: ["Farigola", "aromatiques"], Tilia: ["Til·ler", "arbres"], Tipuana: ["Tipuana", "arbres"],
  Trachelospermum: ["Gessamí estrellat", "flors"], Trachycarpus: [null, "palmeres"], Tradescantia: ["Amor d'home", "interior"],
  Tulipa: ["Tulipa", "temporada"], Ulmus: ["Om", "arbres"], Viburnum: ["Marfull", "mediterrania"],
  Viola: ["Viola", "flors"], Vitis: ["Vinya", "fruiters"], Washingtonia: ["Washingtònia", "palmeres"],
  Wisteria: ["Glicina", "flors"], Yucca: ["Iuca", "suculentes"], Zamioculcas: ["Zamioculca", "interior"],
  Cactaceae: [null, "suculentes"],
};

// Etiquetes del model de plantes d'interior (47 classes) → nom científic.
export const HOUSEPLANT_SCI = {
  "African Violet (Saintpaulia ionantha)": "Saintpaulia ionantha",
  "Aloe Vera": "Aloe vera",
  "Anthurium (Anthurium andraeanum)": "Anthurium andraeanum",
  "Areca Palm (Dypsis lutescens)": "Dypsis lutescens",
  "Asparagus Fern (Asparagus setaceus)": "Asparagus setaceus",
  "Begonia (Begonia spp.)": "Begonia",
  "Bird of Paradise (Strelitzia reginae)": "Strelitzia reginae",
  "Birds Nest Fern (Asplenium nidus)": "Asplenium nidus",
  "Boston Fern (Nephrolepis exaltata)": "Nephrolepis exaltata",
  "Calathea": "Calathea",
  "Cast Iron Plant (Aspidistra elatior)": "Aspidistra elatior",
  "Chinese Money Plant (Pilea peperomioides)": "Pilea peperomioides",
  "Chinese evergreen (Aglaonema)": "Aglaonema",
  "Christmas Cactus (Schlumbergera bridgesii)": "Schlumbergera truncata",
  "Chrysanthemum": "Chrysanthemum",
  "Ctenanthe": "Ctenanthe",
  "Daffodils (Narcissus spp.)": "Narcissus pseudonarcissus",
  "Dracaena": "Dracaena marginata",
  "Dumb Cane (Dieffenbachia spp.)": "Dieffenbachia",
  "Elephant Ear (Alocasia spp.)": "Alocasia",
  "English Ivy (Hedera helix)": "Hedera helix",
  "Hyacinth (Hyacinthus orientalis)": "Hyacinthus orientalis",
  "Iron Cross begonia (Begonia masoniana)": "Begonia",
  "Jade plant (Crassula ovata)": "Crassula ovata",
  "Kalanchoe": "Kalanchoe blossfeldiana",
  "Lilium (Hemerocallis)": "Lilium",
  "Lily of the valley (Convallaria majalis)": "Convallaria majalis",
  "Money Tree (Pachira aquatica)": "Pachira aquatica",
  "Monstera Deliciosa (Monstera deliciosa)": "Monstera deliciosa",
  "Orchid": "Phalaenopsis amabilis",
  "Parlor Palm (Chamaedorea elegans)": "Chamaedorea elegans",
  "Peace lily": "Spathiphyllum wallisii",
  "Poinsettia (Euphorbia pulcherrima)": "Euphorbia pulcherrima",
  "Polka Dot Plant (Hypoestes phyllostachya)": "Hypoestes phyllostachya",
  "Ponytail Palm (Beaucarnea recurvata)": "Beaucarnea recurvata",
  "Pothos (Ivy arum)": "Epipremnum aureum",
  "Prayer Plant (Maranta leuconeura)": "Maranta leuconeura",
  "Rattlesnake Plant (Calathea lancifolia)": "Goeppertia insignis",
  "Rubber Plant (Ficus elastica)": "Ficus elastica",
  "Sago Palm (Cycas revoluta)": "Cycas revoluta",
  "Schefflera": "Schefflera arboricola",
  "Snake plant (Sanseviera)": "Dracaena trifasciata",
  "Tradescantia": "Tradescantia zebrina",
  "Tulip": "Tulipa",
  "Venus Flytrap": "Dionaea muscipula",
  "Yucca": "Yucca gigantea",
  "ZZ Plant (Zamioculcas zamiifolia)": "Zamioculcas zamiifolia",
};

/* ------------------------------------------------------------------ */
/* Cerca de plantes                                                    */
/* ------------------------------------------------------------------ */

export function normSci(name) {
  return String(name || "")
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/[×✕]/g, " ").replace(/\s+x\s+/gi, " ")
    .replace(/\b(subsp|ssp|var|f)\.\s*/gi, "")
    .toLowerCase().replace(/[^a-z\s-]/g, " ").replace(/\s+/g, " ").trim();
}

const PLANT_INDEX = new Map();
for (const p of PLANTS) {
  for (const n of [p.sci, ...p.aliases]) PLANT_INDEX.set(normSci(n), p);
}

function genusOf(sci) {
  const g = String(sci || "").trim().split(/\s+/)[0] || "";
  return g.charAt(0).toUpperCase() + g.slice(1).toLowerCase();
}

// Informació per mostrar d'un nom científic: nom català, grup i cures.
export function plantInfo(sci) {
  const clean = String(sci || "").trim();
  const key = normSci(clean);
  let entry = PLANT_INDEX.get(key);
  if (!entry) {
    // Prova amb les dues primeres paraules (gènere + espècie).
    const two = key.split(" ").slice(0, 2).join(" ");
    entry = PLANT_INDEX.get(two);
  }
  const genus = genusOf(entry ? entry.sci : clean);
  const g = GENUS[genus];
  const group = entry?.group || g?.[1] || "generic";
  const caName = entry?.ca || null;
  const genusCa = !entry && g?.[0] ? g[0] : null;
  return {
    sci: entry ? entry.sci : clean,
    ca: caName,
    genusCa,
    group,
    groupLabel: CARE_GROUPS[group]?.label || CARE_GROUPS.generic.label,
    known: !!entry,
  };
}

// Llista per al selector «No és aquesta planta?»
export function pickerOptions() {
  const seen = new Set();
  const out = [];
  for (const p of PLANTS) {
    const label = `${p.ca} — ${p.sci}`;
    if (seen.has(label)) continue;
    seen.add(label);
    out.push({ label, sci: p.sci });
  }
  return out.sort((a, b) => a.label.localeCompare(b.label, "ca"));
}

/* ------------------------------------------------------------------ */
/* Diagnòstic                                                          */
/* ------------------------------------------------------------------ */

const WHEN_ORDER = { ara: 0, setmana: 1, sempre: 2 };
const SEV_ORDER = { high: 0, moderate: 1, low: 2 };

export function scoreToStatus(score) {
  if (score >= 80) return "healthy";
  if (score >= 60) return "minor_issues";
  if (score >= 35) return "needs_attention";
  return "critical";
}

// symptoms: Array d'ids marcats. extraProblems: codis que ha vist la IA.
export function diagnose({ symptoms = [], extraProblems = [], group = "generic", date = new Date() } = {}) {
  const s = new Set(symptoms);
  const found = new Map();
  for (const [code, p] of Object.entries(PROBLEMS)) {
    const c = p.match(s);
    if (c >= 0.5) found.set(code, { code, confidence: c, source: "symptoms" });
  }
  for (const code of extraProblems) {
    if (!PROBLEMS[code]) continue;
    const prev = found.get(code);
    found.set(code, { code, confidence: Math.max(prev?.confidence || 0, 0.75), source: prev ? "both" : "ai" });
  }
  // Si hi ha podridura, l'excés de reg ja hi queda inclòs.
  if (found.has("podridura") && found.has("excess_reg")) found.delete("excess_reg");
  // La fumagina sense un insecte identificat ja apunta a buscar-lo.
  const problems = [...found.values()]
    .map((f) => ({ ...f, ...PROBLEMS[f.code] }))
    .sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity] || b.confidence - a.confidence);

  let score = 92;
  for (const p of problems) score -= SEVERITY[p.severity].penalty * Math.min(1, p.confidence + 0.1);
  if (problems.length >= 3) score -= 6;
  score = Math.max(5, Math.min(95, Math.round(score)));
  const status = scoreToStatus(score);

  const adjust = { water: "same", light: "same", feeding: "same" };
  for (const p of problems) for (const [k, v] of Object.entries(p.adjust || {})) adjust[k] = v;

  const seen = new Set();
  const tips = [];
  for (const p of problems) {
    for (const t of p.tips) {
      if (seen.has(t.title)) continue;
      seen.add(t.title);
      tips.push({ ...t, problem: p.code, sev: p.severity });
    }
  }
  tips.sort((a, b) => WHEN_ORDER[a.when] - WHEN_ORDER[b.when] || SEV_ORDER[a.sev] - SEV_ORDER[b.sev]);

  const careGroup = CARE_GROUPS[group] || CARE_GROUPS.generic;
  const season = seasonFor(date);
  const seasonal = careGroup.season?.[season];
  if (seasonal) tips.push({ when: "sempre", cat: "temporada", title: `${SEASON_LABEL[season]}: què toca ara`, detail: seasonal, products: [] });

  const pests = problems.filter((p) => p.kind === "plaga");
  return { problems, tips: tips.slice(0, 8), score, status, adjust, pests, season };
}

// Resum en català quan no hi ha IA.
export function basicSummary({ name, problems, symptomsCount }) {
  if (!symptomsCount && !problems.length) {
    return `Has indicat que no hi veus cap símptoma, així que la valoració és bona. Revisa de tant en tant el revers de les fulles i els brots tendres.`;
  }
  if (!problems.length) {
    return `Els símptomes que has marcat no apunten a cap problema concret. Vigila com evoluciona la planta els propers dies.`;
  }
  const names = problems.slice(0, 3).map((p) => p.name.toLowerCase());
  const list = names.length > 1 ? names.slice(0, -1).join(", ") + " i " + names.at(-1) : names[0];
  const worst = problems[0];
  const lead = worst.severity === "high" ? "Cal actuar de pressa" : worst.severity === "moderate" ? "Convé actuar aquesta setmana" : "No és greu, però convé corregir-ho";
  return `Pel que has marcat, el més probable és ${list}. ${lead}: comença pels passos marcats com a «Ara».`;
}
