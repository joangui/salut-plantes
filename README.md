# Salut de les plantes

App web en català per identificar una planta o un arbre amb fotos, revisar-ne la salut i saber què cal fer.
Tot funciona al dispositiu: no cal cap compte, les fotos no surten del mòbil o de l'ordinador i, després de la primera anàlisi, l'app funciona **sense connexió**.

**Obre-la:** https://joangui.github.io/salut-plantes/

## Com funciona

L'app combina models petits que corren al navegador amb una guia de cures escrita per a Catalunya.

| Part | Què fa | Mida (un sol cop) | On funciona |
|---|---|---|---|
| Identificació | [BioCLIP 2.5 mobile](https://huggingface.co/crazedcodernate/bioclip-2.5-mobile-fastvit), destil·lat de BioCLIP 2.5, compara la foto amb 4.271 espècies de plantes. Un [segon model](https://huggingface.co/onnx-community/house-plant-image-detection-ONNX) reconeix 47 plantes d'interior habituals. | ~150 MB | Mòbil i ordinador |
| Salut | Els símptomes que marques passen per regles i una guia de problemes, cures i tractaments amb productes que es troben a Catalunya (`kb.js`). | inclosa | Mòbil i ordinador |
| IA avançada (opcional) | [Gemma 4 E2B](https://huggingface.co/onnx-community/gemma-4-E2B-it-ONNX) mira les fotos, confirma la planta i detecta problemes. Els consells continuen sortint de la guia. | ~3,4 GB | Ordinadors amb WebGPU (Chrome, Edge, Safari 26) |

Els models s'executen amb [ONNX Runtime Web](https://onnxruntime.ai/) (WebGPU si n'hi ha, si no WASM) i [Transformers.js](https://huggingface.co/docs/transformers.js). Un *service worker* desa l'app i els models al navegador.

## Instal·lar-la al mòbil o a l'ordinador

1. Obre l'enllaç amb connexió i fes una primera anàlisi (o toca «Descarrega-ho ara»).
2. Instal·la-la: a l'iPhone, **Comparteix → Afegeix a la pantalla d'inici**; a Android, **menú → Instal·la l'app**; a l'ordinador, la icona d'instal·lar de la barra d'adreces.
3. A partir d'aquí funciona sense connexió.

## Límits que cal conèixer

- El model botànic es va entrenar amb plantes silvestres (iNaturalist): no coneix els cítrics ni algunes plantes de jardí, i es pot confondre entre espècies del mateix gènere. Per això l'informe mostra alternatives i deixa corregir la planta amb «No és aquesta planta?».
- Sense la IA avançada, la salut es valora amb els símptomes que marques; la foto només serveix per identificar la planta.
- No serveix per decidir si una planta és comestible o tòxica.

## Desenvolupament

```bash
npm ci                                   # Transformers.js 4.3.2 i ONNX Runtime Web (versions fixades)
python tools/fetch_models.py --out models  # models de Hugging Face a revisions fixades
node tools/vendor.mjs .                  # copia les biblioteques a vendor/
node tools/test_logic.mjs                # tests de la guia i la lògica
node tools/ci_light.mjs                  # identificació amb fotos reals (Node)
python tools/assemble.py _site && python -m http.server -d _site 8000
```

Fitxers principals: `index.html` (interfície), `app.js` (pantalla), `logic.js` (informe), `kb.js` (guia en català), `ml-worker.js` (models botànics), `gemma-worker.js` (IA avançada), `sw.js` (sense connexió).

## Publicació

Cada canvi a `main` executa `.github/workflows/deploy.yml`: descarrega els models, passa els tests (inclosa una prova al navegador sense connexió) i publica a GitHub Pages. Cal tenir **Settings → Pages → Source: GitHub Actions**.

La prova de la IA avançada (`.github/workflows/gemma-check.yml`) s'executa a mà perquè descarrega 3,7 GB.

## Llicències de tercers

- BioCLIP 2.5 mobile: MIT · Model de plantes d'interior: Apache 2.0 · Gemma 4 E2B (ONNX): Apache 2.0
- ONNX Runtime Web: MIT · Transformers.js: Apache 2.0
- Tipografies Libre Caslon, Libre Franklin i Courier Prime: SIL Open Font License 1.1 (`vendor/fonts/OFL.txt`)
