export async function parseResumeText(file: File): Promise<string> {
  if (!file) return "";
  if (!file.type.includes("pdf") && !file.type.includes("text")) {
    return "";
  }

  try {
    const raw = await file.text();
    return raw.slice(0, 8000);
  } catch (error) {
    console.error("Failed to read resume file", error);
    return "";
  }
}
