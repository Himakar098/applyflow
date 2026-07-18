import { z } from "zod";

import { isCredentialFreeHttpUrl } from "@/lib/security/url-policy";

const HttpUrlSchema = z.string().trim().url().max(2_000).refine(
  isCredentialFreeHttpUrl,
  "Only credential-free HTTP and HTTPS URLs are supported",
);

const ImportedRowSchema = z.object({
  company: z.string().trim().min(1).max(200),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(40).max(100_000),
  location: z.string().trim().max(300).optional(),
  sourceUrl: HttpUrlSchema.optional(),
  applicationUrl: HttpUrlSchema.optional(),
});

export type ImportedCsvJob = z.infer<typeof ImportedRowSchema>;

function parseRows(input: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (char === '"') {
      if (quoted && input[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && input[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (quoted) throw new Error("CSV contains an unclosed quoted field");
  row.push(field);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function key(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const aliases: Record<string, keyof ImportedCsvJob> = {
  company: "company",
  employer: "company",
  title: "title",
  role: "title",
  jobtitle: "title",
  description: "description",
  jobdescription: "description",
  location: "location",
  sourceurl: "sourceUrl",
  joburl: "sourceUrl",
  applicationurl: "applicationUrl",
  applyurl: "applicationUrl",
};

export function parseJobCsv(input: string): ImportedCsvJob[] {
  if (Buffer.byteLength(input, "utf8") > 1_000_000) throw new Error("CSV exceeds the 1 MB import limit");
  const rows = parseRows(input.replace(/^\uFEFF/, ""));
  if (rows.length < 2) throw new Error("CSV must include a header and at least one job");
  if (rows.length > 101) throw new Error("CSV imports are limited to 100 jobs at a time");

  const headers = rows[0].map((header) => aliases[key(header)]);
  for (const required of ["company", "title", "description"] as const) {
    if (!headers.includes(required)) throw new Error(`CSV is missing the required ${required} column`);
  }

  return rows.slice(1).map((values, rowIndex) => {
    const candidate: Partial<Record<keyof ImportedCsvJob, string>> = {};
    headers.forEach((header, columnIndex) => {
      if (header) candidate[header] = values[columnIndex]?.trim() ?? "";
    });
    const parsed = ImportedRowSchema.safeParse(candidate);
    if (!parsed.success) {
      throw new Error(`CSV row ${rowIndex + 2} is invalid: ${parsed.error.issues[0]?.message ?? "unknown error"}`);
    }
    return parsed.data;
  });
}
