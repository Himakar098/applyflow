# Job Agent deterministic evaluations

This suite executes the real, side-effect-free Job Agent domain path against adversarial fixtures:

1. structured requirement extraction;
2. deterministic eligibility gating;
3. weighted fit scoring;
4. generated-text and evidence-grounding validation;
5. visa and work-right answer policy;
6. explicit autofill approval and single-use final-submission approval.

The runner does not call live employer portals or spend AI tokens. Text samples in `cases.jsonl` are truthfulness and relevance probes; they do not replace the real domain execution. Every case still runs the production extraction, eligibility, scoring, truthfulness, answer and approval functions. The suite fails if any of the nine requested evaluation categories is absent.

Run from the repository root:

```bash
npm run eval
```

The command exits non-zero when a check fails and writes a machine-readable report to `evals/results/latest.json`. Reports are ignored by Git; only `evals/results/.gitignore` is committed.

## Adding a case

Add one JSON object per line to `cases.jsonl`. Each object needs a unique `id`, a raw job `description`, and expected extraction, eligibility and fit results. Optional probes cover truthfulness, resume grounding, cover-letter relevance, visa answers and insufficient evidence. Keep ranges meaningful: do not copy the current score simply to make an eval pass.

All URLs use the reserved `.test` domain, timestamps are fixed, and approval identifiers are deterministic so repeated runs produce the same result.

