import Link from "next/link";
import { EllipsisVertical, ExternalLink, Pencil, Sparkles, Trash } from "lucide-react";

import { StatusBadge } from "@/components/jobs/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { JobApplication } from "@/lib/types";
import { cn } from "@/lib/utils";

type JobTableProps = {
  jobs: JobApplication[];
  onEdit: (job: JobApplication) => void;
  onDelete: (job: JobApplication) => void;
};

const sourceColors: Record<string, string> = {
  LinkedIn: "bg-[#ECF4FF] text-[#1D4ED8]",
  Indeed: "bg-[#FEE2E2] text-[#B91C1C]",
  SEEK: "bg-[#F3E8FF] text-[#6D28D9]",
  "Company site": "bg-[#E0F2FE] text-[#075985]",
  Referral: "bg-[#DCFCE7] text-[#15803D]",
  Other: "bg-[#F8FAFC] text-[#0F172A]",
  AngelList: "bg-[#FFF7ED] text-[#9A3412]",
};

export function JobTable({ jobs, onEdit, onDelete }: JobTableProps) {
  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-white/70 px-6 py-10 text-center shadow-sm">
        <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          No applications yet
        </div>
        <p className="mt-3 text-lg font-semibold text-foreground">
          Start tracking your pipeline
        </p>
        <p className="text-sm text-muted-foreground">
          Add your first application to see status, source, and follow-ups here.
        </p>
      </div>
    );
  }

  return (
    <div className="surface-card overflow-hidden">
      <Table responsive>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead>Role</TableHead>
            <TableHead>Company</TableHead>
            <TableHead className="hidden md:table-cell">Location</TableHead>
            <TableHead className="hidden sm:table-cell">Source</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden lg:table-cell">Applied</TableHead>
            <TableHead className="hidden lg:table-cell">Follow-up</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.map((job) => (
            <TableRow key={job.id} className="hover:bg-muted/40">
              <TableCell className="font-medium max-w-xs md:max-w-none truncate md:truncate-none">
                {job.title}
              </TableCell>
              <TableCell className="max-w-xs md:max-w-none truncate md:truncate-none">
                {job.company}
              </TableCell>
              <TableCell className="hidden md:table-cell text-muted-foreground">
                {job.location || "—"}
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <Badge
                  variant="outline"
                  className={cn(
                    "border-transparent text-xs font-semibold",
                    sourceColors[job.source || "Other"] || sourceColors.Other,
                  )}
                >
                  {job.source || "Other"}
                </Badge>
              </TableCell>
              <TableCell>
                <StatusBadge status={job.status} />
              </TableCell>
              <TableCell className="hidden lg:table-cell text-sm text-muted-foreground whitespace-nowrap">
                {job.appliedDate
                  ? new Date(job.appliedDate).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })
                  : "—"}
              </TableCell>
              <TableCell className="hidden lg:table-cell text-sm text-muted-foreground whitespace-nowrap">
                {job.followUpDate
                  ? new Date(job.followUpDate).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })
                  : "—"}
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label={`Actions for ${job.title}`}
                    >
                      <EllipsisVertical className="h-4 w-4" />
                      <span className="sr-only">Actions for {job.title}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-36">
                    <DropdownMenuItem onClick={() => onEdit(job)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={`/jobs/${job.id}`} className="flex items-center">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Workspace
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={`/tailor?jobId=${job.id}`} className="flex items-center">
                        <Sparkles className="mr-2 h-4 w-4 text-primary" />
                        Tailor
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onDelete(job)}>
                      <Trash className="mr-2 h-4 w-4 text-destructive" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
