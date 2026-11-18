// Fotos de prova: la imatge principal de l'article de Wikipedia de cada espècie.
// Només es fan servir als tests; no es publiquen.
import { mkdirSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const UA = { "User-Agent": "salut-plantes-ci/1.0 (https://github.com/joangui/salut-plantes)" };

// [article, espècie esperada, on és]
export const PHOTOS = [
  ["Olive", "Olea europaea", "ground"],
  ["Ceratonia_siliqua", "Ceratonia siliqua", "ground"],
  ["Quercus_ilex", "Quercus ilex", "ground"],
  ["Pinus_halepensis", "Pinus halepensis", "ground"],
  ["Pinus_pinea", "Pinus pinea", "ground"],
  ["Nerium", "Nerium oleander", "ground"],
  ["Rosemary", "Salvia rosmarinus", "pot"],
  ["Lavandula_angustifolia", "Lavandula angustifolia", "pot"],
  ["Common_fig", "Ficus carica", "ground"],
  ["Pomegranate", "Punica granatum", "ground"],
  ["Laurus_nobilis", "Laurus nobilis", "pot"],
  ["Platanus_×_hispanica", "Platanus × hispanica", "ground"],
  ["Celtis_australis", "Celtis australis", "ground"],
  ["Jacaranda_mimosifolia", "Jacaranda mimosifolia", "ground"],
  ["Bougainvillea", "Bougainvillea", "pot"],
  ["Pelargonium_zonale", "Pelargonium zonale", "pot"],
  ["Lemon", "Citrus × limon", "pot"],
  ["Basil", "Ocimum basilicum", "pot"],
  ["Tomato", "Solanum lycopersicum", "pot"],
  ["Opuntia_ficus-indica", "Opuntia ficus-indica", "ground"],
  ["Agave_americana", "Agave americana", "ground"],
  ["Phoenix_canariensis", "Phoenix canariensis", "ground"],
  ["Hedera_helix", "Hedera helix", "ground"],
  ["Monstera_deliciosa", "Monstera deliciosa", "indoors"],
  ["Epipremnum_aureum", "Epipremnum aureum", "indoors"],
  ["Dracaena_trifasciata", "Dracaena trifasciata", "indoors"],
  ["Spathiphyllum", "Spathiphyllum", "indoors"],
  ["Zamioculcas", "Zamioculcas zamiifolia", "indoors"],
  ["Ficus_elastica", "Ficus elastica", "indoors"],
  ["Crassula_ovata", "Crassula ovata", "indoors"],
  ["Aloe_vera", "Aloe vera", "indoors"],
  ["Chlorophytum_comosum", "Chlorophytum comosum", "indoors"],
];

export async function fetchPhotos(dir = ".test-photos") {
  mkdirSync(dir, { recursive: true });
  const out = [];
  for (const [title, expected, setting] of PHOTOS) {
    const file = join(dir, `${title.replace(/[^\w-]/g, "_")}.jpg`);
    if (!existsSync(file)) {
      try {
        const meta = await (await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, { headers: UA })).json();
        let url = meta.thumbnail?.source || meta.originalimage?.source;
        if (!url) throw new Error("sense imatge");
        if (url.includes("/thumb/")) url = url.replace(/\/\d+px-/, "/800px-");
        const res = await fetch(url, { headers: UA });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        writeFileSync(file, Buffer.from(await res.arrayBuffer()));
      } catch (err) {
        console.warn(`No s'ha pogut baixar la foto de ${title}: ${err.message}`);
        continue;
      }
    }
    out.push({ title, expected, setting, file });
  }
  return out;
}
