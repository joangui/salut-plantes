# Salut de les plantes

App web en català per identificar una planta o un arbre amb fotos, revisar-ne la salut i saber què cal fer.
Tot funciona al dispositiu: no cal cap compte, les fotos no surten del mòbil o de l'ordinador i, després de la primera anàlisi, l'app funciona **sense connexió**.

**Obre-la:** https://joangui.github.io/salut-plantes/

## Com funciona

L'app combina models petits que corren al navegador amb una guia de cures escrita per a Catalunya.

| Part | Què fa | Mida (un sol cop) | On funciona |
|---|---|---|---|
| Identificació | [BioCLIP 2.5 mobile](https://huggingface.co/crazedcodernate/bioclip-2.5-mobile-fastvit), destil·lat de BioCLIP 2.5, compara la foto amb 4.372 espècies: les 4.271 del model i 101 plantes de la guia que hi faltaven (cítrics, gerani, buguenvíl·lea…). Dona preferència a les plantes de la guia, que són les dels jardins, balcons i cases. Un [segon model](https://huggingface.co/onnx-community/house-plant-image-detection-ONNX) reconeix 47 plantes d'interior i pesa més si dius que la planta és a dins. | ~150 MB | Mòbil i ordinador |
| Salut | Els símptomes que marques passen per regles i una guia de problemes, cures i tractaments amb productes que es troben a Catalunya (`kb.js`). | inclosa | Mòbil i ordinador |
| IA avançada (opcional) | [Gemma 4 E2B](https://huggingface.co/onnx-community/gemma-4-E2B-it-ONNX) mira les fotos, comprova la planta entre les opcions del model botànic i marca els símptomes que hi veu. Tot el text de l'informe surt de la guia en català. | ~3,4 GB | Ordinadors amb WebGPU (Chrome, Edge, Safari 26) |

Els models s'executen amb [ONNX Runtime Web](https://onnxruntime.ai/) (WebGPU si n'hi ha, si no WASM) i [Transformers.js](https://huggingface.co/docs/transformers.js). Un *service worker* desa l'app i els models al navegador.

## Instal·lar-la al mòbil o a l'ordinador

1. Obre l'enllaç amb connexió i fes una primera anàlisi (o toca «Descarrega-ho ara»).
2. Instal·la-la: a l'iPhone, **Comparteix → Afegeix a la pantalla d'inici**; a Android, **menú → Instal·la l'app**; a l'ordinador, la icona d'instal·lar de la barra d'adreces.
3. A partir d'aquí funciona sense connexió.

## Límits que cal conèixer

- En una prova amb 108 fotos de Wikipedia (90 de plantes de la guia i 18 de fora), l'app encerta l'espècie a la primera en unes 2 de cada 3, i gairebé sempre en les plantes d'interior. Falla més amb fotos de fruits o d'arbres sencers i amb plantes que el model coneix poc, com els cítrics. Per això l'informe mostra alternatives i deixa corregir la planta amb «No és aquesta planta?». La prova es repeteix a cada canvi (`tools/ci_light.mjs`).
- La IA avançada és un model petit: detecta bé símptomes clars, com el pugó o l'oïdi, però ajuda poc a identificar la planta. Com que sovint respon en castellà o en anglès, només tria codis i l'app hi posa el text en català.
- Sense la IA avançada, la salut es valora amb els símptomes que marques; la foto només serveix per identificar la planta.
- No serveix per decidir si una planta és comestible o tòxica.

## Desenvolupament

```bash
npm ci                                   # Transformers.js 4.3.2 i ONNX Runtime Web (versions fixades)
python tools/fetch_models.py --out models  # models de Hugging Face a revisions fixades
node tools/vendor.mjs .                  # copia les biblioteques a vendor/
node tools/test_logic.mjs                # tests de la guia i la lògica
node tools/ci_light.mjs                  # identificació amb fotos reals i ajust dels paràmetres (Node)
python tools/assemble.py _site && python -m http.server -d _site 8000
```

Fitxers principals: `index.html` (interfície), `app.js` (pantalla), `logic.js` (informe), `kb.js` (guia en català), `ml-worker.js` (models botànics), `gemma-worker.js` (IA avançada), `sw.js` (sense connexió).

## Publicació

Cada canvi a `main` executa `.github/workflows/deploy.yml`: descarrega els models, passa els tests (inclosa una prova al navegador sense connexió) i publica a GitHub Pages. Cal tenir **Settings → Pages → Source: GitHub Actions**.

La prova de la IA avançada (`.github/workflows/gemma-check.yml`) descarrega 3,7 GB: s'executa quan canvia la part de la IA, o a mà.

## Llicències de tercers

- BioCLIP 2.5 mobile: MIT · Model de plantes d'interior: Apache 2.0 · Gemma 4 E2B (ONNX): Apache 2.0
- ONNX Runtime Web: MIT · Transformers.js: Apache 2.0
- Tipografies Libre Caslon, Libre Franklin i Courier Prime: SIL Open Font License 1.1 (`vendor/fonts/OFL.txt`)
