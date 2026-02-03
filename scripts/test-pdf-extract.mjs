import fs from "node:fs";
import path from "node:path";

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: node scripts/test-pdf-extract.mjs /path/to/file.pdf");
  process.exit(1);
}

const buffer = fs.readFileSync(path.resolve(filePath));

globalThis.DOMMatrix ??= class DOMMatrix {};
globalThis.Path2D ??= class Path2D {};
globalThis.ImageData ??= class ImageData {};
globalThis.HTMLCanvasElement ??= class HTMLCanvasElement {};

process.env.PDFJS_DISABLE_WORKER = "true";
const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
if (pdfjsLib?.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = undefined;
}

const loadingTask = pdfjsLib.getDocument({ data: buffer, useWorker: false });
const doc = await loadingTask.promise;
const texts = [];
for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
  const page = await doc.getPage(pageNum);
  const content = await page.getTextContent();
  const pageText = content.items.map((item) => item?.str ?? "").join(" ");
  texts.push(pageText);
}
await doc.cleanup?.();

const text = texts.join(" ").replace(/\s+/g, " ").trim();
console.log(`Extracted length: ${text.length}`);
console.log(text.slice(0, 200));
