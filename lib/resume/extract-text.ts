import * as mammoth from "mammoth";

import { HttpError } from "@/lib/auth/verify-id-token";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_TEXT_LENGTH = 12_000;

function normalize(text: string) {
  const cleaned = text
    .replace(/[^\x09\x0A\x0D\x20-\x7E]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.slice(0, MAX_TEXT_LENGTH);
}

function ensurePdfPolyfills() {
  const g = globalThis as Record<string, unknown>;
  if (typeof g.DOMMatrix === "undefined") g.DOMMatrix = class DOMMatrix {};
  if (typeof g.DOMMatrixReadOnly === "undefined") g.DOMMatrixReadOnly = g.DOMMatrix;
  if (typeof g.Path2D === "undefined") g.Path2D = class Path2D {};
  if (typeof g.ImageData === "undefined") g.ImageData = class ImageData {};
  if (typeof g.HTMLCanvasElement === "undefined") g.HTMLCanvasElement = class HTMLCanvasElement {};
}

// Ensure polyfills are registered before pdfjs loads.
ensurePdfPolyfills();

async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    ensurePdfPolyfills();
    process.env.PDFJS_DISABLE_WORKER = "true";
    type PdfTextItem = { str?: string };
    type PdfPage = { getTextContent: () => Promise<{ items: PdfTextItem[] }> };
    type PdfDoc = { numPages: number; getPage: (n: number) => Promise<PdfPage>; cleanup?: () => void | Promise<void> };
    type PdfJs = {
      GlobalWorkerOptions?: { workerSrc?: string };
      getDocument: (config: { data: Buffer; useWorker: boolean; disableFontFace: boolean }) => { promise: Promise<PdfDoc> };
    };

    const pdfjsLib = (await import("pdfjs-dist/legacy/build/pdf.mjs")) as unknown as { default?: PdfJs };
    const pdf = (pdfjsLib?.default ?? pdfjsLib) as PdfJs;
    if (pdf?.GlobalWorkerOptions) {
      pdf.GlobalWorkerOptions.workerSrc = undefined;
    }
    const loadingTask = pdf.getDocument({
      data: buffer,
      useWorker: false,
      disableFontFace: true,
    });
    const doc = await loadingTask.promise;
    const texts: string[] = [];
    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      const page = await doc.getPage(pageNum);
      const content = await page.getTextContent();
      const pageText = content.items.map((item) => item?.str ?? "").join(" ");
      texts.push(pageText);
    }
    await doc.cleanup?.();
    return texts.join(" ");
  } catch {
    throw new HttpError(400, "RESUME_EXTRACT_FAILED");
  }
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
    try {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } catch {
      throw new HttpError(400, "RESUME_EXTRACT_FAILED");
    }
  } else {
    throw new HttpError(400, "Unsupported file type. Upload PDF or DOCX.");
  }

  if (!text || text.startsWith("%PDF")) {
    throw new HttpError(400, "RESUME_EXTRACT_FAILED");
  }

  const normalized = normalize(text);
  const alnumCount = (normalized.match(/[a-zA-Z0-9]/g) || []).length;
  const ratio = normalized.length ? alnumCount / normalized.length : 0;
  if (normalized.length > 200 && ratio < 0.1) {
    throw new HttpError(400, "RESUME_EXTRACT_FAILED");
  }
  return normalized;
}
