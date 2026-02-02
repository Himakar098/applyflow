import { z } from "zod";

export const KeywordListSchema = z
  .array(z.string().min(1).max(40))
  .min(10)
  .max(30);

export const TailoredPackSchema = z.object({
  resumeBullets: z.array(z.string().min(5)).min(6).max(10),
  coverLetter: z.string().min(80).max(5000),
  keywordsUsed: z.array(z.string().min(1).max(60)).max(40),
  matchNotes: z.array(z.string().min(5).max(240)).min(5).max(10),
});

export type TailoredPack = z.infer<typeof TailoredPackSchema>;

export const JobParseSchema = z.object({
  roleTitleGuess: z.string().min(1).max(120),
  companyGuess: z.string().min(1).max(160).optional().nullable(),
  keywords: z.array(z.string().min(1).max(60)).min(5).max(40),
  requirements: z.object({
    mustHave: z.array(z.string().min(2).max(240)).max(30),
    niceToHave: z.array(z.string().min(2).max(240)).max(30),
  }),
  techStack: z.array(z.string().min(1).max(80)).max(40),
});

export type JobParseResult = z.infer<typeof JobParseSchema>;
