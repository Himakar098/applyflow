import { getAuthHeader } from "@/lib/firebase/getIdToken";

const MAX_TEXT_LENGTH = 12_000;

function normalizeText(text: string) {
  return text.replace(/\s+/g, " ").trim().slice(0, MAX_TEXT_LENGTH);
}

export async function extractResumeText(file: File): Promise<string> {
  if (!file) return "";

  try {
    const headers = await getAuthHeader();
    if (!headers) {
      throw new Error("auth_required");
    }

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/resume/extract", {
      method: "POST",
      headers,
      body: formData,
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const message = (data as { error?: string }).error || "Unable to extract resume";
      throw new Error(message);
    }

    const data = (await res.json()) as { text?: string };
    return normalizeText(data.text ?? "");
  } catch (error) {
    console.error("Failed to extract resume file", error);
    return "";
  }
}
