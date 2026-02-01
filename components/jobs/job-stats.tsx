import { Briefcase, CheckCircle2, Clock, HandMetal } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { JobApplication } from "@/lib/types";

type StatCardProps = {
  title: string;
  value: number;
  icon: React.ReactNode;
  description: string;
};

function StatCard({ title, value, icon, description }: StatCardProps) {
  return (
    <Card className="border-0 bg-white shadow-sm shadow-slate-900/5">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold text-foreground">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

export function JobStats({ jobs }: { jobs: JobApplication[] }) {
  const applied = jobs.length;
  const interviewing = jobs.filter((j) => j.status === "interview").length;
  const offers = jobs.filter((j) => j.status === "offer").length;
  const stalled = jobs.filter((j) => j.status === "ghosted").length;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <StatCard
        title="Total applications"
        value={applied}
        description="Active submissions"
        icon={<Briefcase className="h-5 w-5 text-primary" />}
      />
      <StatCard
        title="Interviews"
        value={interviewing}
        description="In conversations"
        icon={<Clock className="h-5 w-5 text-amber-500" />}
      />
      <StatCard
        title="Offers"
        value={offers}
        description="Offers received"
        icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" />}
      />
      <StatCard
        title="Follow-ups"
        value={stalled}
        description="Pending responses"
        icon={<HandMetal className="h-5 w-5 text-indigo-500" />}
      />
    </div>
  );
}
