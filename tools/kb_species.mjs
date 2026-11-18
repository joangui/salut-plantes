// Escriu en JSON les espècies i els gèneres de la guia (per ampliar la taula del model).
import { PLANTS, GENUS } from "../kb.js";

const species = [...new Set(PLANTS.map((p) => p.sci))].sort();
console.log(JSON.stringify({ species, genera: Object.keys(GENUS).sort() }, null, 1));
