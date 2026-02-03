"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

import { ResumeList } from "@/components/resume/resume-list";
import { ResumeUploader } from "@/components/resume/resume-uploader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { fetchResumes as fetchResumesAction } from "@/app/actions/resumes";
import { useAuth } from "@/lib/auth/auth-provider";
import type { ResumeRecord } from "@/lib/types";

export default function ResumePage() {
  const { token, refreshToken } = useAuth();
  const { toast } = useToast();
  const [resumes, setResumes] = useState<ResumeRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const loadResumes = async () => {
    try {
      const idToken = token ?? (await refreshToken());
      if (!idToken) return;
      const data = await fetchResumesAction(idToken);
      setResumes(data);
    } catch (error) {
      console.error(error);
      toast({
        title: "Unable to load resumes",
        description: "Check Firebase Storage and Firestore permissions.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadResumes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const latestResume = useMemo(() => {
    return [...resumes].sort((a, b) =>
      a.uploadedAt > b.uploadedAt ? -1 : 1,
    )[0];
  }, [resumes]);

  return (
    <div className="space-y-6">
      <div className="surface-panel hero-panel p-6 md:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
              Resumes
            </p>
            <h2 className="text-3xl font-semibold text-foreground">
              Manage your resume library
            </h2>
            <p className="text-sm text-muted-foreground">
              Upload PDFs, store them securely, and prepare for AI optimizations.
            </p>
          </div>
          <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary">
            ATS-safe storage
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <ResumeUploader
            onUploaded={(record) => setResumes((prev) => [record, ...prev])}
          />
        </div>
        <div className="lg:col-span-2">
          <Card className="surface-card">
            <CardHeader>
              <CardTitle>Extracted text preview</CardTitle>
              <CardDescription>
                Best-effort text extraction from your uploaded PDF. Scanned images may not extract.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-28 w-full rounded-xl" />
              ) : latestResume ? (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-3 rounded-xl border border-white/60 bg-white/70 px-4 py-3"
                >
                  <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                    <Sparkles className="h-4 w-4" />
                    Extracted text (best-effort)
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {latestResume.parsedText
                      ? `${latestResume.parsedText.slice(0, 4000)}`
                      : "No text extracted yet. Try re-extracting a text-based PDF."}
                  </p>
                  {latestResume.parsedText ? (
                    <div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigator.clipboard.writeText(latestResume.parsedText ?? "")}
                      >
                        Copy preview
                      </Button>
                    </div>
                  ) : null}
                </motion.div>
              ) : (
                <div className="rounded-xl border border-dashed px-4 py-10 text-center">
                  <p className="text-sm text-muted-foreground">
                    Upload a resume to see parsed text here.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div>
        {loading ? (
          <Skeleton className="h-40 w-full rounded-xl" />
        ) : (
          <ResumeList
            resumes={resumes}
            onDeleted={(id) => setResumes((prev) => prev.filter((resume) => resume.id !== id))}
          />
        )}
      </div>
    </div>
  );
}
