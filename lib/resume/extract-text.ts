import * as mammoth from "mammoth";

import { HttpError } from "@/lib/auth/verify-id-token";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_TEXT_LENGTH = 12_000;

function normalize(text: string) {
  return text.replace(/\s+/g, " ").trim().slice(0, MAX_TEXT_LENGTH);
}

function ensurePdfPolyfills() {
  const g: any = globalThis as any;
  if (typeof g.DOMMatrix === "undefined") g.DOMMatrix = class DOMMatrix {};
  if (typeof g.Path2D === "undefined") g.Path2D = class Path2D {};
  if (typeof g.ImageData === "undefined") g.ImageData = class ImageData {};
  if (typeof g.HTMLCanvasElement === "undefined") g.HTMLCanvasElement = class HTMLCanvasElement {};
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  ensurePdfPolyfills();
  process.env.PDFJS_DISABLE_WORKER = "true";
  const pdfjsLib: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
  if (pdfjsLib?.GlobalWorkerOptions) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = undefined;
  }
  const loadingTask = pdfjsLib.getDocument({
    data: buffer,
    useWorker: false,
  });
  const doc = await loadingTask.promise;
  const texts: string[] = [];
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items.map((item: any) => item?.str ?? "").join(" ");
    texts.push(pageText);
  }
  await doc.cleanup?.();
  return texts.join(" ");
}

export async function extractResumeText(file: File): Promise<string> {
  if (!file) {
    throw new HttpError(400, "Resume file is required");
  }

  if (file.size > MAX_FILE_BYTES) {
    throw new HttpError(400, "File too large (max 10MB)");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const lowerName = file.name.toLowerCase();

  let text: string | undefined;

  if (file.type.includes("pdf") || lowerName.endsWith(".pdf")) {
    text = await extractPdfText(buffer);
  } else if (
    file.type.includes("officedocument") ||
    lowerName.endsWith(".docx")
  ) {
    const result = await mammoth.extractRawText({ buffer });
    text = result.value;
  } else {
    throw new HttpError(400, "Unsupported file type. Upload PDF or DOCX.");
  }

  if (!text || text.startsWith("%PDF")) {
    throw new HttpError(400, "Could not extract readable text from file");
  }

  return normalize(text);
}
