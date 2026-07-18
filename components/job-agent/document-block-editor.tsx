"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Save, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";

type GroundedText = { text: string; evidenceClaimIds: string[] };

export type GroundedContent = {
  summary: GroundedText;
  skills: Array<{ name: string; evidenceClaimIds: string[] }>;
  sections: Array<{
    heading: string;
    title: string;
    subtitle?: string;
    bullets: GroundedText[];
  }>;
  education: Array<{
    degree: string;
    institution: string;
    period?: string;
    evidenceClaimIds: string[];
  }>;
  coverLetterParagraphs: GroundedText[];
  selectionCriteria: Array<{
    criterion: string;
    response: GroundedText;
    confidence: number;
    factsNeedingConfirmation: string[];
  }>;
};

function moveItem<T>(values: T[], index: number, direction: -1 | 1) {
  const destination = index + direction;
  if (destination < 0 || destination >= values.length) return values;
  const next = [...values];
  [next[index], next[destination]] = [next[destination], next[index]];
  return next;
}

function BlockControls({
  index,
  length,
  canRemove,
  onMove,
  onRemove,
}: {
  index: number;
  length: number;
  canRemove: boolean;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex shrink-0 gap-1">
      <Button type="button" size="icon" variant="ghost" className="h-8 w-8" disabled={index === 0} onClick={() => onMove(-1)} aria-label="Move block up">
        <ArrowUp className="h-4 w-4" />
      </Button>
      <Button type="button" size="icon" variant="ghost" className="h-8 w-8" disabled={index === length - 1} onClick={() => onMove(1)} aria-label="Move block down">
        <ArrowDown className="h-4 w-4" />
      </Button>
      <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-red-700" disabled={!canRemove} onClick={onRemove} aria-label="Remove block">
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

function EditableGroup<T>({
  title,
  description,
  values,
  minimum,
  label,
  onChange,
}: {
  title: string;
  description: string;
  values: T[];
  minimum: number;
  label: (value: T) => string;
  onChange: (values: T[]) => void;
}) {
  return (
    <section className="space-y-2 rounded-xl border p-4">
      <div>
        <h4 className="font-medium">{title}</h4>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {values.length === 0 ? <p className="text-sm text-muted-foreground">No blocks selected.</p> : null}
      {values.map((value, index) => (
        <div key={`${label(value)}-${index}`} className="flex items-start justify-between gap-3 rounded-lg bg-muted/30 px-3 py-2">
          <p className="min-w-0 text-sm leading-5">{label(value)}</p>
          <BlockControls
            index={index}
            length={values.length}
            canRemove={values.length > minimum}
            onMove={(direction) => onChange(moveItem(values, index, direction))}
            onRemove={() => onChange(values.filter((_, valueIndex) => valueIndex !== index))}
          />
        </div>
      ))}
    </section>
  );
}

export function DocumentBlockEditor({
  content,
  busy,
  onCancel,
  onSave,
}: {
  content: GroundedContent;
  busy: boolean;
  onCancel: () => void;
  onSave: (content: GroundedContent) => Promise<void>;
}) {
  const [draft, setDraft] = useState<GroundedContent>(() => structuredClone(content));

  return (
    <div className="space-y-4 rounded-xl border border-blue-200 bg-blue-50/40 p-4">
      <div>
        <h3 className="font-semibold">Edit evidence-backed blocks</h3>
        <p className="text-sm text-muted-foreground">
          Reorder or remove exact generated blocks. Text is locked so an edit cannot introduce an unsupported claim.
        </p>
      </div>
      <section className="rounded-xl border bg-background p-4">
        <h4 className="font-medium">Resume summary</h4>
        <p className="mt-1 text-sm leading-6">{draft.summary.text}</p>
        <p className="mt-2 text-xs text-muted-foreground">Required and locked to its verified evidence.</p>
      </section>
      <EditableGroup
        title="Skills"
        description="At least four grounded skills must remain."
        values={draft.skills}
        minimum={4}
        label={(skill) => skill.name}
        onChange={(skills) => setDraft((current) => ({ ...current, skills }))}
      />
      <EditableGroup
        title="Experience and project sections"
        description="At least two complete evidence-backed sections must remain."
        values={draft.sections}
        minimum={2}
        label={(section) => `${section.heading}: ${section.title}`}
        onChange={(sections) => setDraft((current) => ({ ...current, sections }))}
      />
      <EditableGroup
        title="Education"
        description="Optional blocks can be removed or reordered."
        values={draft.education}
        minimum={0}
        label={(education) => `${education.degree}, ${education.institution}`}
        onChange={(education) => setDraft((current) => ({ ...current, education }))}
      />
      <EditableGroup
        title="Cover-letter paragraphs"
        description="At least three exact grounded paragraphs must remain."
        values={draft.coverLetterParagraphs}
        minimum={3}
        label={(paragraph) => paragraph.text}
        onChange={(coverLetterParagraphs) => setDraft((current) => ({ ...current, coverLetterParagraphs }))}
      />
      <EditableGroup
        title="Selection criteria"
        description="Optional complete responses can be removed or reordered."
        values={draft.selectionCriteria}
        minimum={0}
        label={(criterion) => criterion.criterion}
        onChange={(selectionCriteria) => setDraft((current) => ({ ...current, selectionCriteria }))}
      />
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
          <X className="mr-2 h-4 w-4" /> Cancel
        </Button>
        <Button type="button" onClick={() => void onSave(draft)} disabled={busy}>
          <Save className="mr-2 h-4 w-4" /> Save selected blocks
        </Button>
      </div>
    </div>
  );
}
