import { describe, expect, it } from "vitest";

import {
  groundedApplicationContentSchema,
  isCanonicalApplicationContentSelection,
} from "@/lib/job-agent/server/generated-documents";

const grounded = (text: string) => ({ text, evidenceClaimIds: ["claim-1"] });

const canonical = groundedApplicationContentSchema.parse({
  summary: grounded("Canonical summary."),
  skills: ["TypeScript", "Node.js", "React", "SQL"].map((name) => ({
    name,
    evidenceClaimIds: ["claim-1"],
  })),
  sections: [
    { heading: "Experience", title: "Role", bullets: [grounded("Canonical role evidence.")] },
    { heading: "Project", title: "Project", bullets: [grounded("Canonical project evidence.")] },
  ],
  education: [],
  coverLetterParagraphs: [
    grounded("Canonical opening."),
    grounded("Canonical evidence."),
    grounded("Canonical close."),
  ],
  selectionCriteria: [],
});

describe("model factual grounding", () => {
  it("rejects fabricated prose even when it cites a valid claim ID", () => {
    const fabricated = structuredClone(canonical);
    fabricated.coverLetterParagraphs[1].text = "I generated millions in unsupported revenue.";
    expect(isCanonicalApplicationContentSelection(fabricated, canonical)).toBe(false);
    expect(isCanonicalApplicationContentSelection(canonical, canonical)).toBe(true);
  });
});

