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
  const { toast } = useToast();
  const { user, token, refreshToken } = useAuth();

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.includes("pdf")) {
      toast({
        title: "Upload a PDF resume",
        description: "Only PDF uploads are allowed for ATS safety.",
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
      setExtractState("extracting");
      setUploading(true);
      const extracted = await extractResumeText(file);
      if (!extracted) {
        setExtractState("failed");
        throw new Error("Failed to extract text");
      }
      setExtractedText(extracted);
      setExtractState("extracted");

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
        parsedText: extracted,
      });

      onUploaded(record);
      toast({
        title: "Resume uploaded",
        description: "Stored securely and ready for optimization.",
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Upload failed",
        description: "Please try again. Ensure Firebase Storage is configured.",
        variant: "destructive",
      });
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
      const text = await extractResumeText(selectedFile);
      if (!text) throw new Error("Failed to extract text");
      setExtractedText(text);
      setExtractState("extracted");
      toast({ title: "Re-extracted", description: "Updated preview from PDF." });
    } catch (error) {
      console.error(error);
      setExtractState("failed");
      toast({ title: "Extract failed", description: "Try again with a valid PDF.", variant: "destructive" });
    }
  };

  return (
    <Card className="border-0 bg-white shadow-sm shadow-slate-900/5">
      <CardHeader className="pb-3">
        <CardTitle>Upload resume</CardTitle>
        <CardDescription>
          Store PDF resumes in Firebase Storage. ApplyFlow will parse text and
          prep for future AI optimization.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-primary/30 bg-primary/5 px-6 py-10 text-center">
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
        </div>
      </CardContent>
    </Card>
  );
}
