import { PDFParse } from "pdf-parse";
import * as mammoth from "mammoth";

import { HttpError } from "@/lib/auth/verify-id-token";

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB
const MAX_TEXT_LENGTH = 60_000;

export async function extractResumeText(file: File): Promise<string> {
  if (!file) {
    throw new HttpError(400, "Resume file is required");
  }

  if (file.size > MAX_FILE_BYTES) {
    throw new HttpError(400, "File too large (max 5MB)");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const lowerName = file.name.toLowerCase();

  let text: string | undefined;

  if (file.type.includes("pdf") || lowerName.endsWith(".pdf")) {
    const parser = new PDFParse({ data: buffer });
    const parsed = await parser.getText();
    await parser.destroy();
    text = parsed.text;
  } else if (
    file.type.includes("officedocument") ||
    lowerName.endsWith(".docx")
  ) {
    const result = await mammoth.extractRawText({ buffer });
    text = result.value;
  } else {
    throw new HttpError(400, "Unsupported file type. Upload PDF or DOCX.");
  }

  if (!text) {
    throw new HttpError(400, "Could not extract text from file");
  }

  return text.slice(0, MAX_TEXT_LENGTH).trim();
}
