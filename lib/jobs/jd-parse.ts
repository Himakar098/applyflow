export type ParsedJD = {
  roleTitleGuess: string;
  companyGuess: string;
  keywords: string[];
  requirements: { mustHave: string[]; niceToHave: string[] };
  techStack: string[];
};

const techDictionary = [
  "Python",
  "Java",
  "JavaScript",
  "TypeScript",
  "C#",
  "C++",
  "Go",
  "Rust",
  "SQL",
  "Bash",
  "React",
  "Next.js",
  "Node.js",
  "Express",
  "Django",
  "Flask",
  "FastAPI",
  "Spring",
  ".NET",
  "AWS",
  "Azure",
  "GCP",
  "Docker",
  "Kubernetes",
  "Terraform",
  "CI/CD",
  "GitHub Actions",
  "PostgreSQL",
  "MySQL",
  "SQL Server",
  "MongoDB",
  "Redis",
  "Firestore",
  "BigQuery",
  "Snowflake",
  "Databricks",
  "Power BI",
  "Tableau",
  "Looker",
  "Airflow",
  "dbt",
  "Kafka",
  "Spark",
  "PyTorch",
  "TensorFlow",
  "scikit-learn",
  "OpenAI",
  "LangChain",
];

const stopwords = new Set([
  "the",
  "and",
  "with",
  "from",
  "that",
  "this",
  "will",
  "you",
  "your",
  "for",
  "our",
  "are",
  "have",
  "has",
  "about",
  "other",
  "into",
  "than",
  "after",
  "before",
  "using",
  "use",
  "team",
  "role",
  "work",
  "they",
  "them",
  "their",
  "an",
  "a",
  "of",
  "in",
  "to",
  "we",
]);

export function normalizeKeywords(words: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  words.forEach((w) => {
    const clean = w.trim();
    if (!clean) return;
    const key = clean.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(clean);
  });
  return out;
}

function extractTitle(lines: string[]): string {
  for (const line of lines.slice(0, 6)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.length <= 80 && !trimmed.includes(".")) {
      return trimmed;
    }
  }
  for (const line of lines.slice(0, 20)) {
    const m = trimmedMatch(line, /(Role|Position|Job Title|Title)\s*:\s*(.+)/i);
    if (m) return m;
  }
  return "";
}

function extractCompany(lines: string[]): string {
  for (const line of lines.slice(0, 20)) {
    const m =
      trimmedMatch(line, /(Company)\s*:\s*(.+)/i) ||
      trimmedMatch(line, /About\s+([A-Z][A-Za-z0-9&'\- ]{2,})/) ||
      trimmedMatch(line, /Join\s+([A-Z][A-Za-z0-9&'\- ]{2,})/) ||
      trimmedMatch(line, /at\s+([A-Z][A-Za-z0-9&'\- ]{2,})/);
    if (m) return m;
  }
  return "";
}

function trimmedMatch(line: string, regex: RegExp): string | null {
  const m = line.match(regex);
  if (!m) return null;
  return m[2] || m[1] || null;
}

function extractTech(jobText: string): string[] {
  const found: string[] = [];
  techDictionary.forEach((tech) => {
    const pattern = new RegExp(`\\b${escapeRegex(tech)}\\b`, "i");
    if (pattern.test(jobText)) {
      found.push(tech);
    }
  });
  return normalizeKeywords(found);
}

function escapeRegex(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractKeywords(jobText: string): string[] {
  const tokens = jobText
    .toLowerCase()
    .split(/[^a-z0-9+.#-]+/g)
    .filter((w) => w.length >= 4 && !stopwords.has(w));
  const freq: Record<string, number> = {};
  tokens.forEach((t) => {
    freq[t] = (freq[t] ?? 0) + 1;
  });
  const top = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([w]) => w);
  return normalizeKeywords(top);
}

function extractRequirements(jobText: string) {
  const lines = jobText.split(/\r?\n/);
  const mustHave: string[] = [];
  const niceToHave: string[] = [];

  let current: "must" | "nice" | null = null;
  lines.forEach((raw) => {
    const line = raw.trim();
    const lower = line.toLowerCase();
    if (/requirements|must have|what you'?ll bring|qualifications/.test(lower)) {
      current = "must";
      return;
    }
    if (/nice to have|preferred|bonus/.test(lower)) {
      current = "nice";
      return;
    }

    const isBullet = /^[-*•]\s+/.test(line);
    if (isBullet && current) {
      const text = line.replace(/^[-*•]\s+/, "").trim();
      if (current === "must") mustHave.push(text);
      if (current === "nice") niceToHave.push(text);
    }
  });

  return {
    mustHave: normalizeKeywords(mustHave),
    niceToHave: normalizeKeywords(niceToHave),
  };
}

export function heuristicParseJD(jobText: string): ParsedJD {
  const lines = jobText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const roleTitleGuess = extractTitle(lines);
  const companyGuess = extractCompany(lines);
  const keywords = extractKeywords(jobText);
  const requirements = extractRequirements(jobText);
  const techStack = extractTech(jobText);

  return {
    roleTitleGuess,
    companyGuess,
    keywords,
    requirements,
    techStack,
  };
}
