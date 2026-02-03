import OpenAI from "openai";
import { z } from "zod";

import {
  JobParseSchema,
  KeywordListSchema,
  TailoredPackSchema,
  type JobParseResult,
  type TailoredPack,
} from "@/lib/ai/schemas";
import { HttpError } from "@/lib/auth/verify-id-token";

const openaiApiKey = process.env.OPENAI_API_KEY;
const openaiClient = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;

type ProfileJson = Record<string, unknown>;
type Style = "ats" | "impact" | "leadership" | "entry";
type Tone = "formal" | "friendly" | "direct";

const STYLE_GUIDANCE: Record<Style, string> = {
  ats: "ATS-safe, concise, align keywords, avoid fluff, format bullets as Action — impact — tools.",
  impact: "Lean into measurable outcomes and scope while staying truthful.",
  leadership: "Emphasize ownership, stakeholders, strategy, and team impact without inventing reports.",
  entry: "Highlight projects, coursework, fundamentals, learning mindset; avoid senior claims.",
};

const TONE_GUIDANCE: Record<Tone, string> = {
  formal: "Professional and neutral.",
  friendly: "Warm but concise.",
  direct: "Concise, confident, minimal filler.",
};

function safeParseJson<T = unknown>(content: string): T | null {
  try {
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

async function repairJsonToSchema(
  broken: string,
  schemaHint: string,
): Promise<Record<string, unknown> | null> {
  if (!openaiClient) return null;
  try {
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
  } catch (error) {
    handleOpenAIError(error);
  }
}

function ensureClient() {
  if (!openaiClient) {
    throw new HttpError(503, "AI_NOT_CONFIGURED");
  }
}

function handleOpenAIError(error: unknown): never {
  const err = error as { status?: number; code?: string };
  if (err?.status === 401 || err?.code === "invalid_api_key") {
    throw new HttpError(503, "AI_NOT_CONFIGURED");
  }
  throw error as Error;
}

function dedupeStrings(values: string[], limit: number) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const val of values) {
    const trimmed = val.trim();
    if (!trimmed) continue;
    if (seen.has(trimmed.toLowerCase())) continue;
    seen.add(trimmed.toLowerCase());
    result.push(trimmed);
    if (result.length >= limit) break;
  }
  return result;
}

async function extractKeywords(jobDescription: string): Promise<string[]> {
  ensureClient();
  const schemaHint =
    "Return an object {\"keywords\": string[]} with 15-25 keywords (skills, tools, requirements).";

  try {
    const completion = await openaiClient!.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Extract key skills, tools, and requirements from the job description. Return ONLY JSON matching {\"keywords\": string[]}. Keep 15-25 items, no sentences.",
        },
        {
          role: "user",
          content: jobDescription.slice(0, 6000),
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 400,
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = safeParseJson(raw);
    const validated = z
      .object({ keywords: KeywordListSchema })
      .safeParse(parsed);
    if (validated.success) return validated.data.keywords;

    const repaired = await repairJsonToSchema(raw, schemaHint);
    const repairedValidated = z
      .object({ keywords: KeywordListSchema })
      .safeParse(repaired);
    if (repairedValidated.success) return repairedValidated.data.keywords;
  } catch (error) {
    const err = error as { status?: number; code?: string };
    if (err?.status === 401 || err?.code === "invalid_api_key") {
      throw new HttpError(503, "AI_NOT_CONFIGURED");
    }
    console.error("keyword extraction failed, using heuristic", error);
  }

  // Fallback heuristic: pick frequent words (rough)
  const words = jobDescription
    .toLowerCase()
    .split(/[^a-z0-9+.#-]+/g)
    .filter((w) => w.length > 2 && w.length <= 30);
  const freq: Record<string, number> = {};
  for (const w of words) {
    freq[w] = (freq[w] ?? 0) + 1;
  }
  const sorted = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .map(([w]) => w);

  return dedupeStrings(sorted, 20);
}

export async function extractProfile(resumeText: string): Promise<{
  profileJson: ProfileJson;
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number; model?: string | null };
  model?: string | null;
}> {
  ensureClient();

  let completion;
  try {
    completion = await openaiClient!.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            [
              "You are an ATS-safe resume parser. Extract ONLY what exists in the text. Do NOT fabricate employers, dates, or metrics.",
              "Return a structured profile JSON with keys:",
              "- contact: { name, email, phone, location }",
              "- targetRoles: string[]",
              "- preferredLocations: string[]",
              "- yearsExperienceApprox: number",
              "- skills: { languages:[], tools:[], cloud:[], databases:[] }",
              "- workExperience: array of { company, role, startDate, endDate, bullets:[], tools:[] }",
              "- projects: array of { title, stack:[], impact: string, bullets:[] }",
              "- experience (legacy): array of {company, title, startDate, endDate, achievements: []}",
              "- education, certifications, headline, summary",
              "Use null or empty arrays when data is missing.",
            ].join("\n"),
        },
        {
          role: "user",
          content: `Resume text (max 60k chars):\n${resumeText.slice(0, 60000)}`,
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 900,
    });
  } catch (error) {
    handleOpenAIError(error);
  }

  const raw = completion!.choices[0]?.message?.content ?? "{}";
  const parsed = safeParseJson<ProfileJson>(raw);

  const usage = {
    promptTokens: completion!.usage?.prompt_tokens ?? undefined,
    completionTokens: completion!.usage?.completion_tokens ?? undefined,
    totalTokens: completion!.usage?.total_tokens ?? undefined,
    model: completion!.model ?? null,
  };

  if (parsed) return { profileJson: parsed, usage, model: completion!.model ?? null };

  const repaired = await repairJsonToSchema(
    raw,
    "contact, headline, skills, experience, education, certifications, projects",
  );
  if (repaired) return { profileJson: repaired, usage, model: completion!.model ?? null };

  throw new HttpError(500, "Unable to parse profile JSON");
}

type GenerateOptions = {
  profileJson: ProfileJson;
  jobTitle: string;
  company: string;
  jobDescription: string;
  style?: Style;
  tone?: Tone;
  focusKeywords?: string[];
};

export async function generateTailoredPack(options: GenerateOptions): Promise<{
  pack: TailoredPack;
  keywords: string[];
  usage?: { model: string; promptTokens: number; completionTokens: number; totalTokens: number };
  model?: string;
}> {
  ensureClient();

  const {
    profileJson,
    jobTitle,
    company,
    jobDescription,
    style: styleInput,
    tone: toneInput,
    focusKeywords = [],
  } = options;

  const style: Style = ["ats", "impact", "leadership", "entry"].includes(
    styleInput as Style,
  )
    ? (styleInput as Style)
    : "ats";
  const tone: Tone = ["formal", "friendly", "direct"].includes(toneInput as Tone)
    ? (toneInput as Tone)
    : "formal";

  const sanitizedFocus = dedupeStrings(
    focusKeywords
      .map((k) => k.toString().slice(0, 40))
      .filter((k) => k.trim().length > 0),
    30,
  );

  const jdKeywords = await extractKeywords(jobDescription);
  const keywords = dedupeStrings([...jdKeywords, ...sanitizedFocus], 30);

  const schemaHint =
    '{"resumeBullets": string[], "coverLetter": string, "keywordsUsed": string[], "matchNotes": string[]}';

  let completion;
  try {
    completion = await openaiClient!.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are an ATS-safe career assistant. Use ONLY provided profile data; do NOT invent employers, dates, or metrics. Return JSON ONLY.",
        },
        {
          role: "user",
          content: [
            `Profile JSON: ${JSON.stringify(profileJson).slice(0, 60000)}`,
            `Job Title: ${jobTitle}`,
            `Company: ${company}`,
            `Job Description: ${jobDescription.slice(0, 12000)}`,
            `Style: ${style} -> ${STYLE_GUIDANCE[style]}`,
            `Tone: ${tone} -> ${TONE_GUIDANCE[tone]}`,
            `Target keywords (15-25): ${keywords.join(", ")}`,
            `Focus keywords (must keep if present): ${sanitizedFocus.join(", ") || "none"}`,
            "Constraints:",
            "- 6-10 resume bullets, ATS-safe, truthful, avoid fabricated metrics.",
            "- Cover letter 180-260 words, concise, no fake claims.",
            "- keywordsUsed must be a subset of target keywords.",
            "- matchNotes: 5-8 short bullets mapping profile strengths to JD needs.",
            `Return JSON exactly matching: ${schemaHint}`,
          ].join("\n"),
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 1200,
    });
  } catch (error) {
    handleOpenAIError(error);
  }

  const raw = completion!.choices[0]?.message?.content ?? "{}";

  const validatePack = (candidate: unknown): TailoredPack | null => {
    const parsed = TailoredPackSchema.safeParse(candidate);
    if (parsed.success) return parsed.data;
    return null;
  };

  const initial = validatePack(safeParseJson(raw));
  if (initial) {
    return {
      pack: {
        ...initial,
        keywordsUsed: dedupeStrings(
          initial.keywordsUsed.filter((k) => keywords.includes(k)),
          30,
        ),
      },
      keywords,
      usage: {
        model: completion!.model ?? "unknown",
        promptTokens: completion!.usage?.prompt_tokens ?? 0,
        completionTokens: completion!.usage?.completion_tokens ?? 0,
        totalTokens: completion!.usage?.total_tokens ?? 0,
      },
      model: completion!.model ?? undefined,
    };
  }

  const repaired = await repairJsonToSchema(raw, schemaHint);
  const fixed = validatePack(repaired);
  if (fixed) {
    return {
      pack: {
        ...fixed,
        keywordsUsed: dedupeStrings(
          fixed.keywordsUsed.filter((k) => keywords.includes(k)),
          30,
        ),
      },
      keywords,
      usage: {
        model: completion!.model ?? "unknown",
        promptTokens: completion!.usage?.prompt_tokens ?? 0,
        completionTokens: completion!.usage?.completion_tokens ?? 0,
        totalTokens: completion!.usage?.total_tokens ?? 0,
      },
      model: completion!.model ?? undefined,
    };
  }

  throw new HttpError(500, "model_output_invalid");
}

export async function refineMatchReasons(params: {
  job: {
    title: string;
    company: string;
    location?: string;
    description?: string;
  };
  profile: {
    targetRoles: string[];
    preferredLocations: string[];
    preferredWorkModes?: string[];
    preferredSeniority?: string[];
    skills: {
      languages: string[];
      tools: string[];
      cloud: string[];
      databases: string[];
    };
    projects: { title: string; stack: string[]; impact?: string }[];
    workExperience: { company: string; role: string; tools?: string[] }[];
  };
  reasons: string[];
}): Promise<{ reasons: string[]; usage?: { model: string; promptTokens: number; completionTokens: number; totalTokens: number }; model?: string }> {
  ensureClient();
  let completion;
  try {
    completion = await openaiClient!.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a career copilot. Improve the match explanation. Return ONLY JSON {\"reasons\": string[]} with 3-5 short bullets. No fabricated claims.",
        },
        {
          role: "user",
          content: [
            `Job: ${JSON.stringify(params.job)}`,
            `Profile: ${JSON.stringify(params.profile)}`,
            `Current reasons: ${JSON.stringify(params.reasons)}`,
          ].join("\n"),
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 300,
    });
  } catch (error) {
    handleOpenAIError(error);
  }

  const raw = completion!.choices[0]?.message?.content ?? "{}";
  const parsed = safeParseJson<{ reasons?: string[] }>(raw);
  const reasons =
    parsed?.reasons && Array.isArray(parsed.reasons)
      ? parsed.reasons.filter(Boolean).slice(0, 5)
      : params.reasons;

  return {
    reasons,
    usage: {
      model: completion!.model ?? "gpt-4o-mini",
      promptTokens: completion!.usage?.prompt_tokens ?? 0,
      completionTokens: completion!.usage?.completion_tokens ?? 0,
      totalTokens: completion!.usage?.total_tokens ?? 0,
    },
    model: completion!.model ?? "gpt-4o-mini",
  };
}

export async function parseJobDescription(jobDescription: string): Promise<JobParseResult> {
  ensureClient();

  let completion;
  try {
    completion = await openaiClient!.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Extract a clean summary of the job description. Return JSON only: {roleTitleGuess, companyGuess, keywords[], requirements:{mustHave[],niceToHave[]}, techStack[]}. Do not add prose.",
        },
        {
          role: "user",
          content: jobDescription.slice(0, 12000),
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 600,
    });
  } catch (error) {
    handleOpenAIError(error);
  }

  const raw = completion!.choices[0]?.message?.content ?? "{}";
  const parsed = safeParseJson(raw);
  const validated = JobParseSchema.safeParse(parsed);
  if (validated.success) return validated.data;

  const repaired = await repairJsonToSchema(
    raw,
    '{"roleTitleGuess": string, "companyGuess": string, "keywords": [], "requirements": {"mustHave":[],"niceToHave":[]}, "techStack":[]}',
  );
  const repairedValidated = JobParseSchema.safeParse(repaired);
  if (repairedValidated.success) return repairedValidated.data;

  throw new HttpError(500, "Unable to parse job description");
}

type BulletMode = "tighten" | "metric" | "ats" | "leadership";

export async function tuneBullet(options: {
  bullet: string;
  mode: BulletMode;
  profileJson: ProfileJson;
  jobDescription: string;
}): Promise<{ bullet: string; usage?: { model?: string | null; promptTokens?: number; completionTokens?: number; totalTokens?: number } }> {
  ensureClient();

  const { bullet, mode, profileJson, jobDescription } = options;

  const modeInstruction: Record<BulletMode, string> = {
    tighten: "Make concise, keep facts, remove filler.",
    metric: "Add a realistic metric grounded in the provided profile; do NOT invent employers.",
    ats: "Align with ATS keywords from the JD; keep plain text.",
    leadership: "Highlight ownership, stakeholders, and impact while staying truthful.",
  };

  let completion;
  try {
    completion = await openaiClient!.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Rewrite the bullet following the instruction. Use only data present in the profile JSON; do NOT invent companies, roles, dates, or tools. Return JSON {bullet: string}.",
        },
        {
          role: "user",
          content: [
            `Profile: ${JSON.stringify(profileJson).slice(0, 12000)}`,
            `Job Description: ${jobDescription.slice(0, 4000)}`,
            `Mode: ${mode} -> ${modeInstruction[mode]}`,
            `Bullet: ${bullet}`,
            "Return JSON only.",
          ].join("\n"),
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 200,
    });
  } catch (error) {
    handleOpenAIError(error);
  }

  const raw = completion!.choices[0]?.message?.content ?? "{}";
  const usage = {
    promptTokens: completion!.usage?.prompt_tokens ?? undefined,
    completionTokens: completion!.usage?.completion_tokens ?? undefined,
    totalTokens: completion!.usage?.total_tokens ?? undefined,
    model: completion!.model ?? null,
  };

  const parsed = safeParseJson<{ bullet?: string }>(raw);
  if (parsed?.bullet) return { bullet: parsed.bullet, usage };

  const repaired = await repairJsonToSchema(raw, '{"bullet": "text"}');
  if (repaired?.bullet) return { bullet: String(repaired.bullet), usage };

  throw new HttpError(500, "Unable to refine bullet");
}

type BulletAction = "tighten" | "add_metric" | "ats" | "leadership";

export async function rewriteBullet(options: {
  action: BulletAction;
  bullet: string;
  jobKeywords?: string[];
  profileJson?: ProfileJson;
}): Promise<{
  bullet: string;
  usage?: { model?: string | null; promptTokens?: number; completionTokens?: number; totalTokens?: number };
  model?: string | null;
}> {
  ensureClient();

  const { action, bullet, jobKeywords = [], profileJson = {} } = options;

  const actionPrompt: Record<BulletAction, string> = {
    tighten: "Make concise, keep facts, remove filler.",
    add_metric:
      "Add a realistic metric grounded in profile. If no metric exists, add a placeholder like (~X%) without fabrication.",
    ats: "Align with ATS keywords, keep plain text and simple verbs.",
    leadership: "Highlight ownership, stakeholders, and impact while staying truthful.",
  };

  let completion;
  try {
    completion = await openaiClient!.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Rewrite the bullet following the instruction. Return JSON {\"bullet\": \"...\"}. Do NOT invent new companies, degrees, tools, or achievements.",
        },
        {
          role: "user",
          content: [
            `Action: ${action}`,
            `Instruction: ${actionPrompt[action]}`,
            `Job keywords: ${jobKeywords.join(", ") || "none"}`,
            `Profile JSON (truncated): ${JSON.stringify(profileJson).slice(0, 12000)}`,
            `Bullet: ${bullet}`,
          ].join("\n"),
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 220,
    });
  } catch (error) {
    handleOpenAIError(error);
  }

  const raw = completion!.choices[0]?.message?.content ?? "{}";
  const usage = {
    promptTokens: completion!.usage?.prompt_tokens ?? undefined,
    completionTokens: completion!.usage?.completion_tokens ?? undefined,
    totalTokens: completion!.usage?.total_tokens ?? undefined,
    model: completion!.model ?? null,
  };

  const parsed = safeParseJson<{ bullet?: string }>(raw);
  if (parsed?.bullet) return { bullet: parsed.bullet, usage, model: completion!.model ?? null };

  const repaired = await repairJsonToSchema(raw, '{"bullet":"text"}');
  if (repaired?.bullet) return { bullet: String(repaired.bullet), usage, model: completion!.model ?? null };

  throw new HttpError(500, "Unable to rewrite bullet");
}
