"use client";

import { useState } from "react";
import { AlertCircle, Check, Wand2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ProfileEditorProps = {
  value: string;
  onChange: (next: string) => void;
  onValidJson?: (parsed: unknown) => void;
};

export function ProfileEditor({ value, onChange, onValidJson }: ProfileEditorProps) {
  const [error, setError] = useState<string | null>(null);

  const formatJson = () => {
    try {
      const parsed = JSON.parse(value || "{}");
      const formatted = JSON.stringify(parsed, null, 2);
      onChange(formatted);
      setError(null);
      onValidJson?.(parsed);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid JSON";
      setError(message);
    }
  };

  const validateJson = () => {
    try {
      const parsed = JSON.parse(value || "{}");
      setError(null);
      onValidJson?.(parsed);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid JSON";
      setError(message);
    }
  };

  return (
    <Card className="surface-card">
      <CardHeader>
        <CardTitle>Profile JSON</CardTitle>
        <CardDescription>Edit the structured profile. Keep it ATS-safe.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={formatJson}>
            <Wand2 className="mr-2 h-4 w-4" /> Format JSON
          </Button>
          <Button size="sm" variant="outline" onClick={validateJson}>
            <Check className="mr-2 h-4 w-4" /> Validate JSON
          </Button>
          {error ? (
            <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-1 text-xs text-destructive">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-700">
              <Check className="h-4 w-4" />
              JSON looks good
            </div>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="profile-json">Profile JSON</Label>
          <Textarea
            id="profile-json"
            className="min-h-[360px] font-mono text-sm"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder='{"contact":{}, "experience":[], "skills":[]}'
          />
        </div>
      </CardContent>
    </Card>
  );
}
