import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { humanize } from "@/lib/job-agent/client";

const positive = new Set([
  "eligible",
  "apply_now",
  "approved_for_autofill",
  "ready_to_submit",
  "submission_approved",
  "submitted",
  "verified",
]);
const warning = new Set([
  "needs_review",
  "apply_with_tailoring",
  "review_first",
  "ready_for_review",
  "autofill_paused",
  "needs-confirmation",
]);
const negative = new Set([
  "ineligible",
  "do_not_apply",
  "failed",
  "rejected",
  "withdrawn",
  "prohibited-from-inference",
]);

export function StatusPill({ value, className }: { value?: string | null; className?: string }) {
  const normalized = (value ?? "not_set").toLowerCase();
  return (
    <Badge
      variant="outline"
      className={cn(
        "whitespace-nowrap",
        positive.has(normalized) && "border-emerald-300 bg-emerald-50 text-emerald-800",
        warning.has(normalized) && "border-amber-300 bg-amber-50 text-amber-800",
        negative.has(normalized) && "border-red-300 bg-red-50 text-red-800",
        className,
      )}
    >
      {humanize(value)}
    </Badge>
  );
}

