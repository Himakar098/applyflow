"use client";

import { useEffect, useRef, useState } from "react";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { Download, Loader2, UploadCloud } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { fetchDocuments, saveDocumentRecord } from "@/app/actions/documents";
import { useAuth } from "@/lib/auth/auth-provider";
import { storage } from "@/lib/firebase/client";
import type { DocumentRecord } from "@/lib/types";

const allowedTypes: Array<DocumentRecord["type"]> = ["transcript", "degree", "certification", "other"];

type DocumentVaultProps = {
  className?: string;
};

export function DocumentVault({ className }: DocumentVaultProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { user, token, refreshToken } = useAuth();
  const { toast } = useToast();

  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedType, setSelectedType] = useState<DocumentRecord["type"]>("transcript");

  const loadDocuments = async () => {
    try {
      const idToken = token ?? (await refreshToken());
      if (!idToken) {
        setLoading(false);
        return;
      }
      const data = await fetchDocuments(idToken);
      setDocuments(data);
    } catch (error) {
      console.error(error);
      toast({
        title: "Unable to load documents",
        description: "Check Storage/Firestore permissions.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    if (!["pdf", "png", "jpeg", "jpg"].some((type) => file.type.toLowerCase().includes(type))) {
      toast({
        title: "Unsupported file",
        description: "Upload PDF, PNG, or JPG files.",
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

    try {
      setUploading(true);
      const idToken = token ?? (await refreshToken());
      if (!idToken) throw new Error("auth");

      const storagePath = `users/${user.uid}/documents/${Date.now()}-${file.name}`;
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(storageRef);

      const record = await saveDocumentRecord(idToken, {
        fileName: file.name,
        downloadUrl,
        type: selectedType,
        uploadedAt: new Date().toISOString(),
      });

      setDocuments((prev) => [record, ...prev]);
      toast({ title: "Document uploaded", description: "Stored securely in your vault." });
    } catch (error) {
      console.error(error);
      toast({
        title: "Upload failed",
        description: "Try again. Ensure Firebase Storage is configured.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Document vault</CardTitle>
        <CardDescription>Store transcripts, degrees, and certifications alongside your profile.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-2 md:col-span-2">
            <Label>Upload file</Label>
            <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-border px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <UploadCloud className="h-4 w-4 text-primary" />
                <span>PDF, PNG, or JPG up to 10MB</span>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,image/png,image/jpeg,application/pdf"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  {uploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    "Choose file"
                  )}
                </Button>
                <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  Browse
                </Button>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as DocumentRecord["type"])}
              disabled={uploading}
            >
              {allowedTypes.map((type) => (
                <option key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Stored documents</p>
          </div>
          {loading ? (
            <Skeleton className="h-24 w-full rounded-xl" />
          ) : documents.length === 0 ? (
            <p className="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
              No documents yet. Upload transcripts, degrees, or certifications.
            </p>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                >
                  <div className="space-y-0.5">
                    <p className="font-medium text-foreground">{doc.fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      Uploaded {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleString() : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs capitalize">
                      {doc.type}
                    </Badge>
                    <Button asChild size="sm" variant="ghost">
                      <a href={doc.downloadUrl} target="_blank" rel="noreferrer">
                        <Download className="mr-1 h-4 w-4" />
                        Download
                      </a>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
