// Fotos de prova: la imatge principal de l'article de Wikipedia de cada espècie.
// Només es fan servir als tests; no es publiquen.
import { mkdirSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
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
  // Més plantes de la guia
  ["Pistacia_lentiscus", "Pistacia lentiscus", "ground"],
  ["Arbutus_unedo", "Arbutus unedo", "ground"],
  ["Myrtus_communis", "Myrtus communis", "ground"],
  ["Pittosporum_tobira", "Pittosporum tobira", "ground"],
  ["Viburnum_tinus", "Viburnum tinus", "ground"],
  ["Quercus_suber", "Quercus suber", "ground"],
  ["Spartium_junceum", "Spartium junceum", "ground"],
  ["Cupressus_sempervirens", "Cupressus sempervirens", "ground"],
  ["Chamaerops_humilis", "Chamaerops humilis", "ground"],
  ["Washingtonia_robusta", "Washingtonia robusta", "ground"],
  ["Melia_azedarach", "Melia azedarach", "ground"],
  ["Robinia_pseudoacacia", "Robinia pseudoacacia", "ground"],
  ["Ailanthus_altissima", "Ailanthus altissima", "ground"],
  ["Magnolia_grandiflora", "Magnolia grandiflora", "ground"],
  ["Cercis_siliquastrum", "Cercis siliquastrum", "ground"],
  ["Tipuana_tipu", "Tipuana tipu", "ground"],
  ["Prunus_dulcis", "Prunus dulcis", "ground"],
  ["Loquat", "Eriobotrya japonica", "ground"],
  ["Vitis_vinifera", "Vitis vinifera", "ground"],
  ["Carpobrotus_edulis", "Carpobrotus edulis", "ground"],
  ["Plumbago_auriculata", "Plumbago auriculata", "ground"],
  ["Lantana_camara", "Lantana camara", "ground"],
  ["Wisteria_sinensis", "Wisteria sinensis", "ground"],
  ["Trachelospermum_jasminoides", "Trachelospermum jasminoides", "ground"],
  ["Agapanthus_praecox", "Agapanthus praecox", "ground"],
  ["Hibiscus_rosa-sinensis", "Hibiscus rosa-sinensis", "pot"],
  ["Strelitzia_reginae", "Strelitzia reginae", "pot"],
  ["Hydrangea_macrophylla", "Hydrangea macrophylla", "pot"],
  ["Camellia_japonica", "Camellia japonica", "pot"],
  ["Dianthus_caryophyllus", "Dianthus caryophyllus", "pot"],
  ["Petunia", "Petunia", "pot"],
  ["Rose", "Rosa", "pot"],
  ["Thymus_vulgaris", "Thymus vulgaris", "pot"],
  ["Salvia_officinalis", "Salvia officinalis", "pot"],
  ["Spearmint", "Mentha spicata", "pot"],
  ["Aloysia_citrodora", "Aloysia citrodora", "pot"],
  ["Capsicum_annuum", "Capsicum annuum", "pot"],
  ["Lettuce", "Lactuca sativa", "ground"],
  ["Cyclamen_persicum", "Cyclamen persicum", "pot"],
  ["Philodendron_hederaceum", "Philodendron hederaceum", "indoors"],
  ["Ficus_lyrata", "Ficus lyrata", "indoors"],
  ["Ficus_benjamina", "Ficus benjamina", "indoors"],
  ["Schefflera_arboricola", "Schefflera arboricola", "indoors"],
  ["Anthurium_andraeanum", "Anthurium andraeanum", "indoors"],
  ["Pilea_peperomioides", "Pilea peperomioides", "indoors"],
  ["Maranta_leuconeura", "Maranta leuconeura", "indoors"],
  ["Aspidistra_elatior", "Aspidistra elatior", "indoors"],
  ["Chamaedorea_elegans", "Chamaedorea elegans", "indoors"],
  ["Howea_forsteriana", "Howea forsteriana", "indoors"],
  ["Dypsis_lutescens", "Dypsis lutescens", "indoors"],
  ["Dracaena_fragrans", "Dracaena fragrans", "indoors"],
  ["Poinsettia", "Euphorbia pulcherrima", "indoors"],
  ["Tradescantia_zebrina", "Tradescantia zebrina", "indoors"],
  ["Phalaenopsis", "Phalaenopsis", "indoors"],
  ["Nephrolepis_exaltata", "Nephrolepis exaltata", "indoors"],
  ["Kalanchoe_blossfeldiana", "Kalanchoe blossfeldiana", "indoors"],
  ["Schlumbergera", "Schlumbergera", "indoors"],
  ["Saintpaulia", "Saintpaulia", "indoors"],
  // Plantes que no són a la guia (per veure que la preferència no les amaga)
  ["Papaver_rhoeas", "Papaver rhoeas", "ground"],
  ["Smilax_aspera", "Smilax aspera", "ground"],
  ["Centranthus_ruber", "Centranthus ruber", "ground"],
  ["Oxalis_pes-caprae", "Oxalis pes-caprae", "ground"],
  ["Echium_vulgare", "Echium vulgare", "ground"],
  ["Silybum_marianum", "Silybum marianum", "ground"],
  ["Dittrichia_viscosa", "Dittrichia viscosa", "ground"],
  ["Taraxacum_officinale", "Taraxacum officinale", "ground"],
  ["Malva_sylvestris", "Malva sylvestris", "ground"],
  ["Borage", "Borago officinalis", "ground"],
  ["Convolvulus_arvensis", "Convolvulus arvensis", "ground"],
  ["Portulaca_oleracea", "Portulaca oleracea", "ground"],
  ["Urtica_dioica", "Urtica dioica", "ground"],
  ["Arundo_donax", "Arundo donax", "ground"],
  ["Bellis_perennis", "Bellis perennis", "ground"],
  ["Euphorbia_characias", "Euphorbia characias", "ground"],
  ["Rubus_ulmifolius", "Rubus ulmifolius", "ground"],
  ["Ricinus", "Ricinus communis", "ground"],
];

export async function fetchPhotos(dir = ".test-photos") {
  mkdirSync(dir, { recursive: true });
  const out = [];
  for (const [title, expected, setting] of PHOTOS) {
    const file = join(dir, `${title.replace(/[^\w-]/g, "_")}.jpg`);
    if (!existsSync(file)) {
      try {
        const meta = await (await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, { headers: UA })).json();
        // Wikimedia només accepta mides de miniatura estàndard: fem servir la que torna l'API.
        const url = meta.thumbnail?.source || meta.originalimage?.source;
        if (!url) throw new Error("sense imatge");
        let res = await fetch(url, { headers: UA });
        if (res.status === 429) { await sleep(3000); res = await fetch(url, { headers: UA }); }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        writeFileSync(file, Buffer.from(await res.arrayBuffer()));
        await sleep(150);
      } catch (err) {
        console.warn(`No s'ha pogut baixar la foto de ${title}: ${err.message}`);
        continue;
      }
    }
    out.push({ title, expected, setting, file });
  }
  return out;
}
