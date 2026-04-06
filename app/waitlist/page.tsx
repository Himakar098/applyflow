"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Sparkles } from "lucide-react";

import { MarketingShell } from "@/components/marketing/marketing-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

export default function WaitlistPage() {
  const { toast } = useToast();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [website, setWebsite] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const submit = async () => {
    try {
      setSubmitting(true);
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          email,
          notes,
          website,
          source: "public_waitlist_page",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data?.error === "rate_limited") {
          throw new Error("Too many requests. Please wait a few minutes and try again.");
        }
        throw new Error(data.error || "Unable to join waitlist");
      }
      setSubmitted(true);
      toast({ title: "Access request received", description: "We will reach out when capacity opens." });
    } catch (error) {
      toast({
        title: "Unable to submit access request",
        description: error instanceof Error ? error.message : "Try again later.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <MarketingShell>
      <section className="container grid gap-6 pt-6 lg:grid-cols-[1.1fr,0.9fr]">
        <div className="space-y-4">
          <Badge className="rounded-full" variant="secondary">
            Access requests
          </Badge>
          <h1 className="text-4xl font-semibold text-foreground sm:text-5xl">
            Request access to ApplyFlow.
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            If registrations are being paced, use this form and Omnari Group will follow up when access opens.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="surface-card p-5">
              <p className="text-sm font-semibold text-foreground">Best for users who want</p>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li>Profile-driven recommendations</li>
                <li>Structured job tracking</li>
                <li>Assisted apply on supported career pages</li>
              </ul>
            </div>
            <div className="surface-card p-5">
              <p className="text-sm font-semibold text-foreground">What access includes</p>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li>Core dashboard + recommendations</li>
                <li>Apply Assistant workflow</li>
                <li>Browser extension for supported sites</li>
              </ul>
            </div>
          </div>
        </div>

        <Card className="surface-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Request access
            </CardTitle>
            <CardDescription>We only need enough information to follow up.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {submitted ? (
                <div className="space-y-4 rounded-2xl border border-primary/20 bg-primary/5 p-4">
                <p className="text-sm font-semibold text-foreground">Your request has been recorded.</p>
                <p className="text-sm text-muted-foreground">
                  We will contact you when access opens for your cohort.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button asChild>
                    <Link href="/">Back to home</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/browser-extension">View extension guide</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full name</Label>
                  <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
                </div>
                <div className="hidden">
                  <Label htmlFor="website">Website</Label>
                  <Input id="website" value={website} onChange={(e) => setWebsite(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">What are you hoping to use ApplyFlow for?</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Example: job search in Perth, business analyst roles, company career pages."
                    className="min-h-[120px]"
                  />
                </div>
                <Button onClick={submit} disabled={submitting} className="w-full">
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "Request access"
                  )}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </section>
    </MarketingShell>
  );
}
