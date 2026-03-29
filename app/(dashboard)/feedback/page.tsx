"use client";

import { useState } from "react";
import { Loader2, MessageSquareWarning } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeader } from "@/lib/firebase/getIdToken";

export default function FeedbackPage() {
  const { toast } = useToast();
  const [type, setType] = useState("bug");
  const [priority, setPriority] = useState("normal");
  const [page, setPage] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    try {
      const headers = await getAuthHeader();
      if (!headers) throw new Error("Please sign in again");

      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ type, priority, page, message }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error || "Unable to send feedback");

      setMessage("");
      toast({
        title: "Feedback sent",
        description: "Thanks — this was added to the beta support queue.",
      });
    } catch (error) {
      const description = error instanceof Error ? error.message : "Unable to send feedback";
      toast({ title: "Send failed", description, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Support</p>
        <h2 className="text-2xl font-semibold text-foreground">Beta feedback</h2>
        <p className="text-sm text-muted-foreground">
          Report bugs, ask questions, or suggest improvements. We triage this queue daily.
        </p>
      </div>

      <Card className="surface-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquareWarning className="h-4 w-4" />
            Submit feedback
          </CardTitle>
          <CardDescription>Include steps, expected result, and actual result for bugs.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bug">Bug report</SelectItem>
                  <SelectItem value="question">Question</SelectItem>
                  <SelectItem value="idea">Idea</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Page (optional)</Label>
            <Input
              placeholder="e.g., /recommendations"
              value={page}
              onChange={(event) => setPage(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Message</Label>
            <Textarea
              placeholder="What happened? What did you expect?"
              rows={7}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
          </div>
          <Button onClick={submit} disabled={submitting || message.trim().length < 10}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              "Send feedback"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
