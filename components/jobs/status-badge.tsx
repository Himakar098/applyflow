import { Badge } from "@/components/ui/badge";
import type { JobStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const styles: Record<JobStatus, string> = {
  applied: "bg-sky-50 text-sky-800 ring-1 ring-sky-100",
  interview: "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100",
  rejected: "bg-rose-50 text-rose-700 ring-1 ring-rose-100",
  ghosted: "bg-amber-50 text-amber-800 ring-1 ring-amber-100",
  offer: "bg-indigo-50 text-indigo-800 ring-1 ring-indigo-100",
};

const labels: Record<JobStatus, string> = {
  applied: "Applied",
  interview: "Interview",
  rejected: "Rejected",
  ghosted: "Ghosted",
  offer: "Offer",
};

export function StatusBadge({ status }: { status: JobStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn("border-transparent px-2.5 py-1 text-xs", styles[status])}
    >
      {labels[status]}
    </Badge>
  );
}
