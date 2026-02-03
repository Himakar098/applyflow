"use client";

import { useRef, useState } from "react";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { Loader2, UploadCloud } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { extractResumeText } from "@/lib/ai/resume";
import { saveResumeRecord } from "@/app/actions/resumes";
import { useAuth } from "@/lib/auth/auth-provider";
import { storage } from "@/lib/firebase/client";
import type { ResumeRecord } from "@/lib/types";

type ResumeUploaderProps = {
  onUploaded: (resume: ResumeRecord) => void;
};

export function ResumeUploader({ onUploaded }: ResumeUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [extractState, setExtractState] = useState<"idle" | "extracting" | "extracted" | "failed">("idle");
  const [extractedText, setExtractedText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState("");
  const [savingPaste, setSavingPaste] = useState(false);
  const [dailyLimitHit, setDailyLimitHit] = useState(false);
  const [extractWarning, setExtractWarning] = useState<string | null>(null);
  const { toast } = useToast();
  const { user, token, refreshToken } = useAuth();

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const isPdf = file.type.includes("pdf") || file.name.toLowerCase().endsWith(".pdf");
    const isDocx =
      file.type.includes("officedocument") || file.name.toLowerCase().endsWith(".docx");

    if (!isPdf && !isDocx) {
      toast({
        title: "Upload a resume file",
        description: "Supported formats: PDF or DOCX.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Max file size is 10MB.",
        variant: "destructive",
      });
      return;
    }

    if (!user) {
      toast({
        title: "Session required",
        description: "Sign in to upload and store resumes.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSelectedFile(file);
      setExtractedText("");
      setExtractState("extracting");
      setDailyLimitHit(false);
      setExtractWarning(null);
      setUploading(true);
      let extracted = "";
      let allowUploadWithoutExtract = false;
      try {
        extracted = await extractResumeText(file);
        setExtractedText(extracted);
        setExtractState("extracted");
      } catch (error) {
        const message = error instanceof Error ? error.message : "RESUME_EXTRACT_FAILED";
        if (message === "DAILY_LIMIT_REACHED") {
          setDailyLimitHit(true);
          setExtractWarning("Daily extraction limit reached. Upload saved without text extraction.");
          allowUploadWithoutExtract = true;
        } else if (message === "RESUME_EXTRACT_FAILED") {
          setExtractWarning("We couldn’t read text from this file. Upload saved without text extraction.");
          allowUploadWithoutExtract = true;
        } else {
          throw error;
        }
        setExtractState("failed");
      }

      const currentToken = token ?? (await refreshToken());
      const storagePath = `users/${user.uid}/resumes/${Date.now()}-${file.name}`;
      const storageRef = ref(storage, storagePath);

      await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(storageRef);

      const record = await saveResumeRecord(currentToken, {
        fileName: file.name,
        downloadUrl,
        status: "uploaded",
        uploadedAt: new Date().toISOString(),
        parsedText: extracted || undefined,
        storagePath,
      });

      onUploaded(record);
      toast({
        title: "Resume uploaded",
        description: allowUploadWithoutExtract
          ? "Stored securely. Text extraction will be skipped for this file."
          : "Stored securely and ready for optimization.",
      });
    } catch (error) {
      console.error(error);
      const message =
        error instanceof Error && error.message === "RESUME_EXTRACT_FAILED"
          ? "We couldn’t read text from this PDF. Try a text-based PDF (not scanned images)."
          : "Please try again. Ensure Firebase Storage is configured.";
      if (error instanceof Error && error.message === "DAILY_LIMIT_REACHED") {
        setDailyLimitHit(true);
      }
      toast({
        title: "Upload failed",
        description: message,
        variant: "destructive",
      });
      setExtractState("failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const reExtract = async () => {
    if (!selectedFile) return;
    try {
      setExtractState("extracting");
      setDailyLimitHit(false);
      setExtractWarning(null);
      const text = await extractResumeText(selectedFile);
      setExtractedText(text);
      setExtractState("extracted");
      toast({ title: "Re-extracted", description: "Updated preview from PDF." });
    } catch (error) {
      console.error(error);
      setExtractState("failed");
      const message =
        error instanceof Error && error.message === "RESUME_EXTRACT_FAILED"
          ? "We couldn’t read text from this PDF. Try a text-based PDF."
          : "Try again with a valid PDF.";
      if (error instanceof Error && error.message === "DAILY_LIMIT_REACHED") {
        setDailyLimitHit(true);
      }
      toast({ title: "Extract failed", description: message, variant: "destructive" });
    }
  };

  const savePastedText = async () => {
    if (!pastedText.trim()) {
      toast({ title: "Paste resume text", description: "Add text to save.", variant: "destructive" });
      return;
    }
    if (!user) {
      toast({
        title: "Session required",
        description: "Sign in to save resume text.",
        variant: "destructive",
      });
      return;
    }
    setSavingPaste(true);
    try {
      const currentToken = token ?? (await refreshToken());
      const record = await saveResumeRecord(currentToken, {
        fileName: "Pasted resume text",
        downloadUrl: "",
        status: "ready",
        uploadedAt: new Date().toISOString(),
        parsedText: pastedText.trim().slice(0, 12000),
      });
      onUploaded(record);
      setPastedText("");
      toast({ title: "Resume text saved" });
    } catch (error) {
      console.error(error);
      toast({ title: "Save failed", description: "Try again in a moment.", variant: "destructive" });
    } finally {
      setSavingPaste(false);
    }
  };

  return (
    <Card className="surface-card">
      <CardHeader className="pb-3">
        <CardTitle>Upload resume</CardTitle>
        <CardDescription>
          Store PDF resumes in Firebase Storage. Text extraction is best-effort and
          helps power tailoring.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-primary/30 bg-white/70 px-6 py-10 text-center">
          <UploadCloud className="h-8 w-8 text-primary" aria-hidden />
          <p className="mt-3 text-lg font-semibold text-foreground">
            Drop your PDF or browse files
          </p>
          <p className="text-sm text-muted-foreground">
            ATS-safe upload. We keep original formatting untouched.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={handleFileChange}
            className="hidden"
          />
          <div className="mt-4 flex gap-3">
            <Button
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                "Select PDF"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              Browse files
            </Button>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {dailyLimitHit ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Daily resume extraction limit reached. Try again tomorrow or increase the limit in your env config.
            </div>
          ) : null}
          {extractWarning ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {extractWarning}
            </div>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Image-only PDFs aren’t extractable—try exporting from Word/Google Docs.
          </p>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Status:{" "}
              {extractState === "idle"
                ? "Idle"
                : extractState === "extracting"
                  ? "Extracting..."
                  : extractState === "extracted"
                    ? "Extracted"
                    : "Failed"}
            </span>
            <span className="text-xs">
              {extractedText ? `${Math.min(extractedText.length, 4000)} chars` : "Preview"}
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={!selectedFile || uploading} onClick={() => fileInputRef.current?.click()}>
                Change file
              </Button>
              <Button size="sm" variant="ghost" disabled={!selectedFile || extractState === "extracting"} onClick={reExtract}>
                Re-extract
              </Button>
            </div>
          </div>
          <Textarea
            readOnly
            className="min-h-[180px] text-sm"
            value={extractedText ? extractedText.slice(0, 4000) : "No preview yet. Upload a PDF to extract text."}
          />
          <p className="text-xs text-muted-foreground">
            Best-effort text extraction. Scanned or image-only PDFs may show limited text.
          </p>
        </div>
        <div className="mt-6 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Or paste resume text</p>
            <Button size="sm" variant="outline" onClick={savePastedText} disabled={savingPaste}>
              {savingPaste ? "Saving..." : "Save text"}
            </Button>
          </div>
          <Textarea
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            className="min-h-[160px] text-sm"
            placeholder="Paste your resume text here. We'll save it to your profile for tailoring."
          />
          <p className="text-xs text-muted-foreground">
            We’ll store up to 12,000 characters. Use this if you don’t have a PDF or DOCX.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
