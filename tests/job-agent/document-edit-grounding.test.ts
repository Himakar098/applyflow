import { describe, expect, it } from "vitest";

import {
  groundedApplicationContentSchema,
  isCanonicalApplicationContentSelection,
} from "@/lib/job-agent/server/generated-documents";

const grounded = (text: string, evidenceClaimIds = ["skills-verified"]) => ({
  text,
  evidenceClaimIds,
});

const canonical = groundedApplicationContentSchema.parse({
  summary: grounded("Canonical grounded summary."),
  skills: ["TypeScript", "Node.js", "React", "SQL"].map((name) => ({
    name,
    evidenceClaimIds: ["skills-verified"],
  })),
  sections: [
    { heading: "Experience", title: "Norwood Systems", bullets: [grounded("Canonical role evidence.")] },
    { heading: "Project", title: "The Liquid Audit", bullets: [grounded("Canonical project evidence.")] },
  ],
  education: [],
  coverLetterParagraphs: [
    grounded("Canonical opening."),
    grounded("Canonical evidence."),
    grounded("Canonical close."),
  ],
  selectionCriteria: [],
});

describe("document draft edit boundary", () => {
  it("allows exact canonical selection/reordering", () => {
    const reordered = structuredClone(canonical);
    reordered.skills.reverse();
    reordered.sections.reverse();
    reordered.coverLetterParagraphs.reverse();
    expect(isCanonicalApplicationContentSelection(reordered, canonical)).toBe(true);
  });

  it.each([
    "i built a nuclear reactor",
    "i hold a phd from oxford university",
    "i am a surgeon",
  ])("rejects new prose even with an otherwise valid claim id: %s", (fabrication) => {
    const edited = structuredClone(canonical);
    edited.coverLetterParagraphs[1] = grounded(fabrication);
    expect(isCanonicalApplicationContentSelection(edited, canonical)).toBe(false);
  });

  it("rejects duplicating an exact canonical block", () => {
    const duplicated = structuredClone(canonical);
    duplicated.skills[1] = duplicated.skills[0];
    expect(isCanonicalApplicationContentSelection(duplicated, canonical)).toBe(false);
  });
});
