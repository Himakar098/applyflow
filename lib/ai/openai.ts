import OpenAI from "openai";

import { HttpError } from "@/lib/auth/verify-id-token";

const openaiApiKey = process.env.OPENAI_API_KEY;
const openaiClient = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;

type ProfileJson = Record<string, unknown>;

function safeParseJson<T = unknown>(content: string): T | null {
  try {
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

async function repairJson(
  broken: string,
  schemaHint: string,
): Promise<Record<string, unknown> | null> {
  if (!openaiClient) return null;
  const completion = await openaiClient.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You are a JSON repair bot. Return ONLY valid JSON matching the expected schema. No prose.",
      },
      {
        role: "user",
        content: `Fix this JSON and ensure it matches: ${schemaHint}\n\n${broken}`,
      },
    ],
    response_format: { type: "json_object" },
  });

  const fixed = completion.choices[0]?.message?.content ?? "";
  return safeParseJson(fixed);
}

function ensureClient() {
  if (!openaiClient) {
    throw new HttpError(500, "OpenAI API key is not configured");
  }
}

export async function extractProfile(
  resumeText: string,
): Promise<ProfileJson> {
  ensureClient();

  const completion = await openaiClient!.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You are an ATS-safe resume parser. Extract ONLY what exists in the text. Do NOT fabricate employers, dates, or metrics. Return a structured profile JSON with keys: contact, headline, skills (array), experience (array of {company, title, startDate, endDate, achievements: []}), education (array), certifications (array), projects (array). Use null or empty arrays when data is missing.",
      },
      {
        role: "user",
        content: `Resume text (max 60k chars):\n${resumeText.slice(0, 60000)}`,
      },
    ],
    response_format: { type: "json_object" },
    max_tokens: 900,
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  const parsed = safeParseJson<ProfileJson>(raw);

  if (parsed) return parsed;

  const repaired = await repairJson(
    raw,
    "contact, headline, skills, experience, education, certifications, projects",
  );
  if (repaired) return repaired;

  throw new HttpError(500, "Unable to parse profile JSON");
}

export async function generateTailoredPack(options: {
  profileJson: ProfileJson;
  jobTitle: string;
  company: string;
  jobDescription: string;
}): Promise<{ resumeBullets: string[]; coverLetter: string }> {
  ensureClient();

  const { profileJson, jobTitle, company, jobDescription } = options;

  const completion = await openaiClient!.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You are an ATS-safe career assistant. Use ONLY provided profile data; do NOT invent employers, dates, or metrics. Return tailored resume bullets and a concise 1-page cover letter aligned to the job.",
      },
      {
        role: "user",
        content: `Profile JSON:\n${JSON.stringify(profileJson).slice(0, 60000)}\n\nJob Title: ${jobTitle}\nCompany: ${company}\nJob Description:\n${jobDescription.slice(
          0,
          60000,
        )}`,
      },
    ],
    response_format: { type: "json_object" },
    max_tokens: 1100,
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  const parsed = safeParseJson<{ resumeBullets: string[]; coverLetter: string }>(
    raw,
  );

  if (parsed?.resumeBullets && parsed.coverLetter) {
    return parsed;
  }

  const repaired = await repairJson(
    raw,
    "resumeBullets: string array, coverLetter: string",
  );
  if (
    repaired &&
    Array.isArray(repaired.resumeBullets) &&
    typeof repaired.coverLetter === "string"
  ) {
    return repaired as { resumeBullets: string[]; coverLetter: string };
  }

  throw new HttpError(500, "Unable to generate tailored pack");
}
