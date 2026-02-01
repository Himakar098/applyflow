import { EllipsisVertical, Pencil, Trash } from "lucide-react";

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
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-white px-6 py-10 text-center shadow-sm">
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
    <div className="overflow-hidden rounded-xl border bg-white shadow-sm shadow-slate-900/5">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead>Role</TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Applied</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.map((job) => (
            <TableRow key={job.id} className="hover:bg-muted/40">
              <TableCell className="font-medium">{job.title}</TableCell>
              <TableCell>{job.company}</TableCell>
              <TableCell className="text-muted-foreground">
                {job.location || "—"}
              </TableCell>
              <TableCell>
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
              <TableCell className="text-sm text-muted-foreground">
                {job.appliedDate
                  ? new Date(job.appliedDate).toLocaleDateString()
                  : "—"}
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <EllipsisVertical className="h-4 w-4" />
                      <span className="sr-only">Actions</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-36">
                    <DropdownMenuItem onClick={() => onEdit(job)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
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
