// Copia ONNX Runtime Web i Transformers.js (versions fixades a package.json) a vendor/.
// Ús: node tools/vendor.mjs [carpeta_de_sortida]
import { cpSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";

const out = process.argv[2] || ".";
const ortDist = "node_modules/onnxruntime-web/dist";
const ortFiles = [
  "ort.webgpu.min.mjs",
  "ort.wasm.min.mjs",
  "ort-wasm-simd-threaded.asyncify.mjs",
  "ort-wasm-simd-threaded.asyncify.wasm",
  "ort-wasm-simd-threaded.mjs",
  "ort-wasm-simd-threaded.wasm",
];

mkdirSync(join(out, "vendor/ort"), { recursive: true });
mkdirSync(join(out, "vendor/transformers"), { recursive: true });
for (const f of ortFiles) cpSync(join(ortDist, f), join(out, "vendor/ort", f));
cpSync("node_modules/@huggingface/transformers/dist/transformers.min.js", join(out, "vendor/transformers/transformers.min.js"));
cpSync("node_modules/@huggingface/transformers/LICENSE", join(out, "vendor/transformers/LICENSE"));

const ortVersion = JSON.parse(readFileSync("node_modules/onnxruntime-web/package.json", "utf8")).version;
const tjsVersion = JSON.parse(readFileSync("node_modules/@huggingface/transformers/package.json", "utf8")).version;
writeFileSync(join(out, "vendor/ort/LICENSE"), `ONNX Runtime Web ${ortVersion}
MIT License

Copyright (c) Microsoft Corporation

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`);
console.log(`vendor: onnxruntime-web ${ortVersion}, transformers.js ${tjsVersion}`);
