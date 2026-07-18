import {
  structuredJobSchema,
  type JobRequirement,
  type StructuredJob,
} from "./schemas";

export type ExtractJobInput = {
  id: string;
  description: string;
  sourceUrl?: string;
  applicationUrl?: string;
  extractedAt?: string;
};

type LineMatch = { value: string; excerpt: string };

const KNOWN_TECHNOLOGIES = [
  "Python",
  "JavaScript",
  "TypeScript",
  "Node.js",
  "React",
  "SQL",
  "Flutter",
  "Swift",
  "Azure",
  "AWS",
  "GCP",
  "REST APIs",
  "WebSockets",
  "Machine Learning",
  "Natural Language Processing",
  "Generative AI",
  "Power BI",
  "Tableau",
  "Excel",
  "Spark",
  "Docker",
  "Kubernetes",
  "Java",
  "Spring",
  "C#",
  ".NET",
  "PostgreSQL",
  "MongoDB",
] as const;

const SECTION_HEADINGS = new Set([
  "responsibilities",
  "key responsibilities",
  "what you will do",
  "what you'll do",
  "about the role",
  "requirements",
  "required skills",
  "essential criteria",
  "skills and experience",
  "preferred skills",
  "desirable criteria",
  "nice to have",
  "selection criteria",
  "application questions",
  "qualifications",
]);

function normaliseHeading(line: string): string {
  return line.replace(/[:\s]+$/g, "").trim().toLowerCase();
}

function isHeading(line: string): boolean {
  const normalised = normaliseHeading(line);
  return SECTION_HEADINGS.has(normalised)
    || (/^[A-Z][A-Za-z '&/-]{2,45}:?$/.test(line) && !/[.!?]$/.test(line));
}

function stripBullet(line: string): string {
  return line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim();
}

function findLabelledLine(lines: string[], labels: string[]): LineMatch | undefined {
  for (const line of lines) {
    for (const label of labels) {
      const match = line.match(new RegExp(`^${label}\\s*[:\\-]\\s*(.+)$`, "i"));
      if (match?.[1]) {
        return { value: match[1].trim(), excerpt: line };
      }
    }
  }
  return undefined;
}

function explicitText(match: LineMatch | undefined) {
  return match
    ? { value: match.value, source: "explicit" as const, excerpts: [match.excerpt], confidence: 1 }
    : undefined;
}

function unknownText() {
  return { value: null, source: "unknown" as const, excerpts: [], confidence: 0 };
}

function inferredText(value: string, excerpts: string[], confidence = 0.55) {
  return { value, source: "inferred" as const, excerpts, confidence };
}

function extractedList(values: string[], excerpts: string[], source: "explicit" | "inferred" | "unknown") {
  return {
    value: [...new Set(values)],
    source,
    excerpts: [...new Set(excerpts)],
    confidence: source === "explicit" ? 0.95 : source === "inferred" ? 0.65 : 0,
  };
}

function sectionItems(lines: string[], headings: string[]): { values: string[]; excerpts: string[] } {
  const targetHeadings = new Set(headings.map((heading) => heading.toLowerCase()));
  const values: string[] = [];
  const excerpts: string[] = [];
  let collecting = false;

  for (const line of lines) {
    const heading = normaliseHeading(line);
    if (targetHeadings.has(heading)) {
      collecting = true;
      continue;
    }
    if (collecting && isHeading(line)) {
      collecting = false;
      continue;
    }
    if (collecting) {
      const value = stripBullet(line);
      if (value) {
        values.push(value);
        excerpts.push(line);
      }
    }
  }
  return { values, excerpts };
}

function descriptionFragments(description: string): string[] {
  return description
    .split(/\r?\n/)
    .flatMap((line) => {
      const trimmed = line.trim();
      if (!trimmed) return [];
      if (/^\s*(?:[-*•]|\d+[.)])\s+/.test(line)) return [trimmed];
      return trimmed.split(/(?<=[.!?])\s+(?=[A-Z])/g);
    })
    .map((fragment) => fragment.trim())
    .filter(Boolean);
}

function includesTechnology(fragment: string, technology: string): boolean {
  const escaped = technology.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(fragment);
}

function findTechnologies(fragments: string[]): { technology: string; excerpt: string }[] {
  const found: { technology: string; excerpt: string }[] = [];
  for (const fragment of fragments) {
    for (const technology of KNOWN_TECHNOLOGIES) {
      if (includesTechnology(fragment, technology)) {
        found.push({ technology, excerpt: fragment });
      }
    }
  }
  return found.filter(
    (item, index, all) => all.findIndex((candidate) => candidate.technology === item.technology) === index,
  );
}

function importanceFor(fragment: string): JobRequirement["importance"] {
  if (/\b(?:must|required|essential|mandatory|minimum|need to|needs to)\b/i.test(fragment)) {
    return "required";
  }
  if (/\b(?:preferred|desirable|advantageous|nice to have|ideally)\b/i.test(fragment)) {
    return "preferred";
  }
  return "ambiguous";
}

function requirementCategories(fragment: string): JobRequirement["category"][] {
  const categories: JobRequirement["category"][] = [];
  if (/\b(?:Australian citizens?|Australian citizenship)\b/i.test(fragment)) categories.push("citizenship");
  if (/\b(?:permanent residents?|permanent residency)\b/i.test(fragment)) categories.push("permanent-residency");
  if (/\b(?:NV1|NV2|baseline clearance|security clearance|defence clearance)\b/i.test(fragment)) categories.push("security-clearance");
  if (/\b(?:Australian (?:driver'?s?|driving) licence|driver'?s? licence)\b/i.test(fragment)) categories.push("driver-licence");
  if (/\b(?:AHPRA|professional registration|CPA|Chartered Accountant|registered (?:engineer|nurse|teacher|psychologist|architect))\b/i.test(fragment)) categories.push("professional-registration");
  if (/\b(?:visa|work(?:ing)? rights?|sponsorship|right to work)\b/i.test(fragment)) categories.push("work-rights");
  if (/\b(?:PhD|doctorate|master'?s? degree|bachelor'?s? degree|degree|qualification)\b/i.test(fragment)) categories.push("education");
  if (/\b(?:\d+\+?\s+years?|experience)\b/i.test(fragment)) categories.push("experience");
  if (KNOWN_TECHNOLOGIES.some((technology) => includesTechnology(fragment, technology))) categories.push("skill");
  return [...new Set(categories)];
}

function extractRequirements(fragments: string[]): JobRequirement[] {
  const requirements: JobRequirement[] = [];
  for (const fragment of fragments) {
    const categories = requirementCategories(fragment);
    if (categories.length === 0) continue;
    const importance = importanceFor(fragment);
    for (const category of categories) {
      if (importance === "ambiguous" && category === "skill" && fragment.length > 240) continue;
      requirements.push({
        id: `requirement-${requirements.length + 1}`,
        category,
        text: stripBullet(fragment),
        importance,
        source: "explicit",
        excerpt: fragment,
      });
    }
  }
  return requirements;
}

function findDateField(lines: string[], labels: string[]) {
  return explicitText(findLabelledLine(lines, labels)) ?? unknownText();
}

function inferTitle(lines: string[]): ReturnType<typeof unknownText> | ReturnType<typeof inferredText> {
  const candidate = lines.find((line) => {
    const heading = normaliseHeading(line);
    return line.length <= 120
      && !SECTION_HEADINGS.has(heading)
      && !/^(?:company|location|salary|date|closing|application|job)\s*[:\-]/i.test(line)
      && !/^https?:\/\//i.test(line);
  });
  return candidate ? inferredText(stripBullet(candidate), [candidate], 0.5) : unknownText();
}

function inferCompany(lines: string[], inferredTitleValue: string | null) {
  if (inferredTitleValue) {
    const atMatch = inferredTitleValue.match(/\s+at\s+(.+)$/i);
    if (atMatch?.[1]) return inferredText(atMatch[1].trim(), [inferredTitleValue], 0.65);
  }
  const titleIndex = inferredTitleValue ? lines.findIndex((line) => stripBullet(line) === inferredTitleValue) : -1;
  const next = titleIndex >= 0 ? lines[titleIndex + 1] : undefined;
  if (
    next
    && next.length <= 100
    && !SECTION_HEADINGS.has(normaliseHeading(next))
    && !next.includes(":")
  ) {
    return inferredText(stripBullet(next), [next], 0.45);
  }
  return unknownText();
}

function inferLocation(fragments: string[]) {
  const excerpt = fragments.find((fragment) =>
    /\b(?:Perth|Western Australia|WA|Sydney|Melbourne|Brisbane|Adelaide|Canberra|Australia|remote|hybrid)\b/i.test(fragment),
  );
  if (!excerpt) return unknownText();
  const location = excerpt.match(/\b(?:Perth(?:,?\s*(?:WA|Western Australia))?|Western Australia|Sydney|Melbourne|Brisbane|Adelaide|Canberra|Australia-wide)\b/i)?.[0];
  return location ? inferredText(location, [excerpt], 0.6) : unknownText();
}

function inferWorkArrangement(fragments: string[]) {
  const excerpt = fragments.find((fragment) => /\b(?:remote|hybrid|on[ -]?site)\b/i.test(fragment));
  if (!excerpt) {
    return { value: "unknown" as const, source: "unknown" as const, excerpts: [], confidence: 0 };
  }
  const value = /\bremote\b/i.test(excerpt)
    ? "remote" as const
    : /\bhybrid\b/i.test(excerpt)
      ? "hybrid" as const
      : "onsite" as const;
  return { value, source: "explicit" as const, excerpts: [excerpt], confidence: 0.95 };
}

function inferEmploymentType(fragments: string[]) {
  const excerpt = fragments.find((fragment) =>
    /\b(?:full[ -]?time|part[ -]?time|contract|casual|internship|graduate program)\b/i.test(fragment),
  );
  if (!excerpt) return unknownText();
  const value = excerpt.match(/\b(?:full[ -]?time|part[ -]?time|contract|casual|internship|graduate program)\b/i)?.[0];
  return value ? { value, source: "explicit" as const, excerpts: [excerpt], confidence: 0.9 } : unknownText();
}

function inferSalary(fragments: string[]) {
  const excerpt = fragments.find((fragment) =>
    /(?:AUD|A\$|\$)\s?\d{2,3}(?:[,.]\d{3})*(?:\s*[-–]\s*(?:AUD|A\$|\$)?\s?\d{2,3}(?:[,.]\d{3})*)?/i.test(fragment),
  );
  if (!excerpt) return unknownText();
  const value = excerpt.match(/(?:AUD|A\$|\$)\s?\d{2,3}(?:[,.]\d{3})*(?:\s*[-–]\s*(?:AUD|A\$|\$)?\s?\d{2,3}(?:[,.]\d{3})*)?(?:\s*(?:plus|\+)?\s*super)?/i)?.[0];
  return value ? { value, source: "explicit" as const, excerpts: [excerpt], confidence: 0.95 } : unknownText();
}

function inferSeniority(title: string | null) {
  if (!title) return unknownText();
  const match = title.match(/\b(?:graduate|junior|associate|mid(?:-level)?|senior|lead|principal|head|director)\b/i);
  if (match) return inferredText(match[0], [title], 0.85);
  return inferredText("unspecified", [title], 0.4);
}

function inferIndustry(description: string) {
  const industries: [RegExp, string][] = [
    [/\b(?:healthcare|health care|clinical|hospital)\b/i, "Healthcare"],
    [/\b(?:hospitality|hotel|beverage|events)\b/i, "Hospitality"],
    [/\b(?:finance|banking|fintech)\b/i, "Financial services"],
    [/\b(?:mining|resources)\b/i, "Mining and resources"],
    [/\b(?:government|public sector)\b/i, "Government"],
    [/\b(?:software|SaaS|technology|artificial intelligence|machine learning)\b/i, "Technology"],
  ];
  for (const [pattern, industry] of industries) {
    const excerpt = descriptionFragments(description).find((fragment) => pattern.test(fragment));
    if (excerpt) return inferredText(industry, [excerpt], 0.65);
  }
  return unknownText();
}

export function extractJobDescription(input: ExtractJobInput): StructuredJob {
  if (!input.description.trim()) throw new Error("A job description is required.");
  const description = input.description;

  const lines = description.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const fragments = descriptionFragments(description);
  const labelledTitle = explicitText(findLabelledLine(lines, ["job title", "position", "role", "title"]));
  const title = labelledTitle ?? inferTitle(lines);
  const labelledCompany = explicitText(findLabelledLine(lines, ["company", "organisation", "organization", "employer"]));
  const company = labelledCompany ?? inferCompany(lines, title.value);
  const labelledLocation = explicitText(findLabelledLine(lines, ["location", "work location"]));
  const location = labelledLocation ?? inferLocation(fragments);

  const responsibilities = sectionItems(lines, [
    "responsibilities",
    "key responsibilities",
    "what you will do",
    "what you'll do",
    "about the role",
  ]);
  const requiredSection = sectionItems(lines, [
    "requirements",
    "required skills",
    "essential criteria",
    "skills and experience",
    "qualifications",
  ]);
  const preferredSection = sectionItems(lines, ["preferred skills", "desirable criteria", "nice to have"]);
  const selectionCriteria = sectionItems(lines, ["selection criteria"]);
  const applicationQuestionSection = sectionItems(lines, ["application questions"]);
  const requirements = extractRequirements(fragments);
  const technologies = findTechnologies(fragments);

  const requiredTechnologyMatches = technologies.filter((item) => {
    const relatedRequirement = requirements.find((requirement) => requirement.excerpt === item.excerpt);
    return relatedRequirement?.importance === "required"
      || requiredSection.excerpts.includes(item.excerpt);
  });
  const preferredTechnologyMatches = technologies.filter((item) => {
    const relatedRequirement = requirements.find((requirement) => requirement.excerpt === item.excerpt);
    return relatedRequirement?.importance === "preferred"
      || preferredSection.excerpts.includes(item.excerpt);
  });

  const byCategory = (category: JobRequirement["category"]) =>
    requirements.filter((requirement) => requirement.category === category);
  const listFromRequirements = (category: JobRequirement["category"]) => {
    const matching = byCategory(category);
    return extractedList(
      matching.map((item) => item.text),
      matching.map((item) => item.excerpt),
      matching.length > 0 ? "explicit" : "unknown",
    );
  };

  const redFlagRequirements = requirements.filter((requirement) =>
    ["citizenship", "permanent-residency", "security-clearance", "driver-licence"].includes(requirement.category)
      || /\b(?:unpaid|commission[- ]only|more than (?:5|five) years|principal|head of)\b/i.test(requirement.text),
  );

  const applicationQuestionValues = [
    ...applicationQuestionSection.values,
    ...fragments.filter((fragment) => /\?$/.test(fragment)),
  ];
  const applicationQuestionExcerpts = [
    ...applicationQuestionSection.excerpts,
    ...fragments.filter((fragment) => /\?$/.test(fragment)),
  ];

  return structuredJobSchema.parse({
    id: input.id,
    originalDescription: description,
    company,
    title,
    location,
    workArrangement: inferWorkArrangement(fragments),
    employmentType: explicitText(findLabelledLine(lines, ["employment type", "job type"])) ?? inferEmploymentType(fragments),
    salary: explicitText(findLabelledLine(lines, ["salary", "remuneration"])) ?? inferSalary(fragments),
    datePosted: findDateField(lines, ["date posted", "posted"]),
    closingDate: findDateField(lines, ["closing date", "applications close"]),
    sourceUrl: input.sourceUrl
      ? { value: input.sourceUrl, source: "explicit", excerpts: [input.sourceUrl], confidence: 1 }
      : unknownText(),
    applicationUrl: input.applicationUrl
      ? { value: input.applicationUrl, source: "explicit", excerpts: [input.applicationUrl], confidence: 1 }
      : unknownText(),
    responsibilities: extractedList(
      responsibilities.values,
      responsibilities.excerpts,
      responsibilities.values.length > 0 ? "explicit" : "unknown",
    ),
    requiredSkills: extractedList(
      requiredTechnologyMatches.map((item) => item.technology),
      requiredTechnologyMatches.map((item) => item.excerpt),
      requiredTechnologyMatches.length > 0 ? "explicit" : "unknown",
    ),
    preferredSkills: extractedList(
      preferredTechnologyMatches.map((item) => item.technology),
      preferredTechnologyMatches.map((item) => item.excerpt),
      preferredTechnologyMatches.length > 0 ? "explicit" : "unknown",
    ),
    requiredExperience: listFromRequirements("experience"),
    educationRequirements: listFromRequirements("education"),
    visaRequirements: listFromRequirements("work-rights"),
    citizenshipRequirements: listFromRequirements("citizenship"),
    securityClearanceRequirements: listFromRequirements("security-clearance"),
    driverLicenceRequirements: listFromRequirements("driver-licence"),
    industry: inferIndustry(description),
    seniority: inferSeniority(title.value),
    technologyStack: extractedList(
      technologies.map((item) => item.technology),
      technologies.map((item) => item.excerpt),
      technologies.length > 0 ? "explicit" : "unknown",
    ),
    selectionCriteria: extractedList(
      selectionCriteria.values,
      selectionCriteria.excerpts,
      selectionCriteria.values.length > 0 ? "explicit" : "unknown",
    ),
    applicationQuestions: extractedList(
      applicationQuestionValues,
      applicationQuestionExcerpts,
      applicationQuestionValues.length > 0 ? "explicit" : "unknown",
    ),
    potentialRedFlags: extractedList(
      redFlagRequirements.map((item) => item.text),
      redFlagRequirements.map((item) => item.excerpt),
      redFlagRequirements.length > 0 ? "explicit" : "unknown",
    ),
    requirements,
    extractedAt: input.extractedAt ?? "1970-01-01T00:00:00.000Z",
  });
}
