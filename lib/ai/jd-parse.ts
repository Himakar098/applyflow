import OpenAI from "openai";
import { z } from "zod";

import type { ParsedJD } from "@/lib/jobs/jd-parse";
import { HttpError } from "@/lib/auth/verify-id-token";

const openaiApiKey = process.env.OPENAI_API_KEY;
const useOpenAI = process.env.JD_PARSE_USE_OPENAI === "true" && !!openaiApiKey;
const client = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;

const ParsedJDSchema = z.object({
  roleTitleGuess: z.string().max(200).optional().nullable(),
  companyGuess: z.string().max(200).optional().nullable(),
  keywords: z.array(z.string().min(1).max(60)).max(40),
  requirements: z.object({
    mustHave: z.array(z.string().min(1).max(240)).max(50),
    niceToHave: z.array(z.string().min(1).max(240)).max(50),
  }),
  techStack: z.array(z.string().min(1).max(80)).max(40),
});

export async function refineParsedJD(input: {
  jobText: string;
  heuristic: ParsedJD;
}): Promise<ParsedJD> {
  if (!useOpenAI || !client) return input.heuristic;

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You are a JD parsing assistant. Return JSON only with keys roleTitleGuess, companyGuess, keywords[], requirements{mustHave[],niceToHave[]}, techStack[]. No prose.",
      },
      {
        role: "user",
        content: [
          "Job text:",
          input.jobText.slice(0, 12000),
          "",
          "Heuristic guess:",
          JSON.stringify(input.heuristic).slice(0, 4000),
        ].join("\n"),
      },
    ],
    response_format: { type: "json_object" },
    max_tokens: 600,
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  const parsed = ParsedJDSchema.safeParse(JSON.parse(raw));
  if (parsed.success) {
    return {
      roleTitleGuess: parsed.data.roleTitleGuess ?? "",
      companyGuess: parsed.data.companyGuess ?? "",
      keywords: parsed.data.keywords,
      requirements: parsed.data.requirements,
      techStack: parsed.data.techStack,
    };
  }

  // fallback to heuristic on validation failure
  return input.heuristic;
}
