"use client";

import { Clock3, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export type GenerationItem = {
  id: string;
  jobTitle: string;
  company: string;
  jobDescription: string;
  output?: { resumeBullets: string[]; coverLetter: string };
  createdAt?: string | null;
};

type Props = {
  items: GenerationItem[];
  loading?: boolean;
  onSelect: (item: GenerationItem) => void;
  onRefresh?: () => void;
  onRegenerate?: (item: GenerationItem) => void;
};

export function GenerationHistory({
  items,
  loading,
  onSelect,
  onRefresh,
  onRegenerate,
}: Props) {
  return (
    <Card className="border-0 bg-white shadow-sm shadow-slate-900/5">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Recent generations</CardTitle>
        {onRefresh ? (
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, idx) => (
              <Skeleton key={idx} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            No generations yet. Generate a tailored pack to see it here.
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-start justify-between rounded-lg border px-3 py-2 hover:bg-muted/60"
              >
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">
                    {item.jobTitle} @ {item.company}
                  </p>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {item.jobDescription || "No job description"}
                  </p>
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Clock3 className="h-3 w-3" />
                    {item.createdAt
                      ? new Date(item.createdAt).toLocaleString()
                      : "Pending"}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => onSelect(item)}>
                    Load
                  </Button>
                  {onRegenerate ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onRegenerate(item)}
                    >
                      Regenerate
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
