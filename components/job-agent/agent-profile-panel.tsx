"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { KeyRound, Loader2, Save, ShieldCheck } from "lucide-react";

import { StatusPill } from "@/components/job-agent/status-pill";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { jobAgentRequest } from "@/lib/job-agent/client";
import type { CandidateClaim, CandidateProfile } from "@/lib/job-agent/schemas";

type PrivateContact = { email?: string | null; phone?: string | null; address?: string | null };
type ProfilePayload = {
  profile: CandidateProfile;
  privateContact?: PrivateContact | null;
  completeness?: number;
  persisted?: boolean;
};

const lines = (values: string[]) => values.join("\n");
const parseLines = (value: string) => value.split("\n").map((item) => item.trim()).filter(Boolean);

function updateClaim(
  claims: CandidateClaim[],
  predicate: (claim: CandidateClaim) => boolean,
  value: CandidateClaim["value"],
): CandidateClaim[] {
  const today = new Date().toISOString().slice(0, 10);
  return claims.map((claim) =>
    predicate(claim)
      ? { ...claim, value, status: "user-entered", lastConfirmedAt: today }
      : claim,
  );
}

function personalClaimValue(profile: CandidateProfile, field: "firstName" | "lastName") {
  const claim = profile.claims.find((candidate) =>
    candidate.category === "personal" && candidate.field === field,
  );
  return typeof claim?.value === "string" ? claim.value : "";
}

function setPersonalClaim(
  profile: CandidateProfile,
  field: "firstName" | "lastName",
  value: string,
): CandidateProfile {
  const trimmed = value.trim();
  const id = field === "firstName" ? "personal-given-name" : "personal-family-name";
  const existingIndex = profile.claims.findIndex((claim) =>
    claim.category === "personal" && claim.field === field,
  );
  if (!trimmed) {
    return {
      ...profile,
      claims: existingIndex >= 0
        ? profile.claims.filter((_, index) => index !== existingIndex)
        : profile.claims,
    };
  }
  const claim: CandidateClaim = {
    id: existingIndex >= 0 ? profile.claims[existingIndex].id : id,
    category: "personal",
    field,
    value,
    status: "user-entered",
    source: "Candidate-entered Job Agent profile",
    sensitive: true,
    lastConfirmedAt: new Date().toISOString().slice(0, 10),
  };
  const claims = [...profile.claims];
  if (existingIndex >= 0) claims[existingIndex] = claim;
  else claims.push(claim);
  return { ...profile, claims };
}

export function AgentProfilePanel() {
  const { toast } = useToast();
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [contact, setContact] = useState<PrivateContact>({});
  const [completeness, setCompleteness] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingLegalClaimIds, setPendingLegalClaimIds] = useState<Set<string>>(new Set());
  const [legalChangesConfirmed, setLegalChangesConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await jobAgentRequest<ProfilePayload>("/api/job-agent/profile");
      setProfile(payload.profile);
      setContact(payload.privateContact ?? {});
      setCompleteness(payload.completeness ?? 0);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load the Job Agent profile");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const hasPrivateContact = Boolean(contact.email || contact.phone || contact.address);
      const payload = await jobAgentRequest<ProfilePayload>("/api/job-agent/profile", {
        method: "PUT",
        body: JSON.stringify({
          profile,
          ...(hasPrivateContact ? { privateContact: contact } : {}),
          ...(legalChangesConfirmed && pendingLegalClaimIds.size
            ? { confirmedClaimIds: [...pendingLegalClaimIds] }
            : {}),
        }),
      });
      setProfile(payload.profile);
      setContact(payload.privateContact ?? contact);
      setCompleteness(payload.completeness ?? completeness);
      setPendingLegalClaimIds(new Set());
      setLegalChangesConfirmed(false);
      toast({ title: "Job Agent profile saved", description: "Updated claims are marked as user-entered and remain reviewable." });
    } catch (saveError) {
      toast({ title: "Profile save failed", description: saveError instanceof Error ? saveError.message : "Try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const claimCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const claim of profile?.claims ?? []) counts[claim.status] = (counts[claim.status] ?? 0) + 1;
    return counts;
  }, [profile?.claims]);

  if (loading) return <Skeleton className="h-[42rem] w-full rounded-xl" />;
  if (error || !profile) {
    return <Card className="border-red-200 bg-red-50"><CardHeader><CardTitle>Job Agent profile unavailable</CardTitle><CardDescription>{error}</CardDescription></CardHeader></Card>;
  }

  const setWorkRight = <K extends keyof CandidateProfile["workRights"]>(key: K, value: CandidateProfile["workRights"][K]) => {
    const field = key === "sponsorshipAnswer" ? "requiresSponsorship" : String(key);
    const legalClaimIds = profile.claims
      .filter((claim) => claim.category === "work-rights" && claim.field === field)
      .map((claim) => claim.id);
    if (legalClaimIds.length) {
      setPendingLegalClaimIds((existing) => new Set([...existing, ...legalClaimIds]));
      setLegalChangesConfirmed(false);
    }
    setProfile((current) => {
      if (!current) return current;
      let claims = current.claims;
      if (key === "visa") claims = updateClaim(claims, (claim) => claim.field === field, String(value));
      if (key === "australianCitizen") claims = updateClaim(claims, (claim) => claim.field === field, value as boolean);
      if (key === "australianPermanentResident") claims = updateClaim(claims, (claim) => claim.field === field, value as boolean);
      if (key === "fullWorkingRights") claims = updateClaim(claims, (claim) => claim.field === field, value as boolean);
      if (key === "visaSubclass") claims = updateClaim(claims, (claim) => claim.field === field, String(value));
      if (key === "securityClearance") claims = updateClaim(claims, (claim) => claim.field === field, value ? String(value) : "None");
      if (key === "sponsorshipAnswer") claims = updateClaim(claims, (claim) => claim.field === field, value ? String(value) : "Not provided");
      return { ...current, workRights: { ...current.workRights, [key]: value }, claims };
    });
  };

  const setDriverLicence = (value: boolean) => {
    const legalClaimIds = profile.claims
      .filter((claim) => claim.category === "licence" && claim.field === "australianDriverLicence")
      .map((claim) => claim.id);
    setPendingLegalClaimIds((existing) => new Set([...existing, ...legalClaimIds]));
    setLegalChangesConfirmed(false);
    setProfile((current) => {
      if (!current) return current;
      return {
        ...current,
        licences: { ...current.licences, australianDriverLicence: value },
        claims: updateClaim(current.claims, (claim) => claim.field === "australianDriverLicence", value),
      };
    });
  };

  return (
    <Card className="surface-card">
      <CardHeader>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div><CardTitle>Job Agent truth profile</CardTitle><CardDescription>This structured profile is the source of truth for eligibility, documents, answers, and browser autofill.</CardDescription></div>
          <div className="min-w-56 space-y-2"><div className="flex justify-between text-xs"><span>Completeness</span><strong>{completeness}%</strong></div><Progress value={completeness} /></div>
        </div>
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="flex flex-wrap gap-2">
          {(["verified", "user-entered", "needs-confirmation", "prohibited-from-inference"] as const).map((status) => <StatusPill key={status} value={`${status}: ${claimCounts[status] ?? 0}`} />)}
        </div>

        <section className="space-y-4">
          <div><h3 className="font-semibold">Identity and location</h3><p className="text-sm text-muted-foreground">Only non-sensitive identity data belongs in the checked-in profile.</p></div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="space-y-2"><Label htmlFor="agent-name">Preferred name</Label><Input id="agent-name" value={profile.preferredName} onChange={(event) => setProfile({ ...profile, preferredName: event.target.value })} /></div>
            <div className="space-y-2"><Label htmlFor="agent-first-name">Legal/given first name</Label><Input id="agent-first-name" autoComplete="given-name" value={personalClaimValue(profile, "firstName")} placeholder="Enter it yourself" onChange={(event) => setProfile(setPersonalClaim(profile, "firstName", event.target.value))} /><p className="text-xs text-muted-foreground">Used for portal autofill only after you save it.</p></div>
            <div className="space-y-2"><Label htmlFor="agent-last-name">Legal/family name</Label><Input id="agent-last-name" autoComplete="family-name" value={personalClaimValue(profile, "lastName")} placeholder="Enter it yourself" onChange={(event) => setProfile(setPersonalClaim(profile, "lastName", event.target.value))} /><p className="text-xs text-muted-foreground">Never inferred from your preferred name.</p></div>
            <div className="space-y-2"><Label htmlFor="agent-city">City</Label><Input id="agent-city" value={profile.location.city} onChange={(event) => setProfile({ ...profile, location: { ...profile.location, city: event.target.value } })} /></div>
            <div className="space-y-2"><Label htmlFor="agent-state">State</Label><Input id="agent-state" value={profile.location.state} onChange={(event) => setProfile({ ...profile, location: { ...profile.location, state: event.target.value } })} /></div>
            <div className="space-y-2"><Label htmlFor="agent-availability">Notice period</Label><Input id="agent-availability" value={profile.availability.noticePeriod ?? ""} placeholder="Needs confirmation" onChange={(event) => setProfile({ ...profile, availability: { ...profile.availability, noticePeriod: event.target.value || null }, claims: updateClaim(profile.claims, (claim) => claim.field === "noticePeriod", event.target.value || "Not provided") })} /></div>
          </div>
        </section>

        <section className="space-y-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
          <div className="flex gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 text-primary" /><div><h3 className="font-semibold">Work rights and legal facts</h3><p className="text-sm text-muted-foreground">Never change these to “Yes” unless you can personally confirm the claim.</p></div></div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2"><Label htmlFor="agent-visa">Visa</Label><Input id="agent-visa" value={profile.workRights.visa} onChange={(event) => setWorkRight("visa", event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="agent-subclass">Visa subclass</Label><Input id="agent-subclass" value={profile.workRights.visaSubclass} onChange={(event) => setWorkRight("visaSubclass", event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="agent-clearance">Security clearance</Label><Input id="agent-clearance" value={profile.workRights.securityClearance ?? ""} placeholder="None" onChange={(event) => setWorkRight("securityClearance", event.target.value || null)} /></div>
            <div className="space-y-2"><Label htmlFor="agent-sponsorship">Sponsorship answer</Label><Input id="agent-sponsorship" value={profile.workRights.sponsorshipAnswer ?? ""} placeholder="Needs confirmation" onChange={(event) => setWorkRight("sponsorshipAnswer", event.target.value || null)} /></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { id: "full-rights", label: "Full working rights under current visa conditions", checked: profile.workRights.fullWorkingRights, change: (value: boolean) => setWorkRight("fullWorkingRights", value) },
              { id: "citizen", label: "Australian citizen", checked: profile.workRights.australianCitizen, change: (value: boolean) => setWorkRight("australianCitizen", value) },
              { id: "resident", label: "Australian permanent resident", checked: profile.workRights.australianPermanentResident, change: (value: boolean) => setWorkRight("australianPermanentResident", value) },
              { id: "driver-licence", label: "Australian driver licence", checked: profile.licences.australianDriverLicence, change: setDriverLicence },
            ].map((item) => (
              <div key={item.id} className="flex items-start gap-2 rounded-lg border bg-white p-3"><Checkbox id={item.id} checked={item.checked} onCheckedChange={(checked) => item.change(checked === true)} /><Label htmlFor={item.id} className="font-normal leading-5">{item.label}</Label></div>
            ))}
          </div>
          {pendingLegalClaimIds.size ? (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3">
              <Checkbox id="confirm-legal-changes" checked={legalChangesConfirmed} onCheckedChange={(checked) => setLegalChangesConfirmed(checked === true)} />
              <Label htmlFor="confirm-legal-changes" className="font-normal leading-5 text-amber-950">I personally confirm the changed visa, work-rights, residency, citizenship, clearance, sponsorship, or licence facts are accurate. These answers can affect legal eligibility.</Label>
            </div>
          ) : null}
        </section>

        <section className="space-y-4">
          <div><h3 className="font-semibold">Preferences and evidence</h3><p className="text-sm text-muted-foreground">One item per line. Salary is confirmed for each opportunity.</p></div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2"><Label htmlFor="salary-min">Minimum salary (AUD)</Label><Input id="salary-min" type="number" min={0} step={1000} value={profile.salaryPreference.minimum} onChange={(event) => setProfile({ ...profile, salaryPreference: { ...profile.salaryPreference, minimum: Number(event.target.value) }, claims: updateClaim(profile.claims, (claim) => claim.id === profile.salaryPreference.claimId, `${Number(event.target.value)}-${profile.salaryPreference.maximum} AUD plus super`) })} /></div>
            <div className="space-y-2"><Label htmlFor="salary-max">Maximum salary (AUD)</Label><Input id="salary-max" type="number" min={0} step={1000} value={profile.salaryPreference.maximum} onChange={(event) => setProfile({ ...profile, salaryPreference: { ...profile.salaryPreference, maximum: Number(event.target.value) }, claims: updateClaim(profile.claims, (claim) => claim.id === profile.salaryPreference.claimId, `${profile.salaryPreference.minimum}-${Number(event.target.value)} AUD plus super`) })} /></div>
            <div className="flex items-end"><div className="flex w-full items-start gap-2 rounded-lg border p-3"><Checkbox id="full-time" checked={profile.availability.fullTime} onCheckedChange={(checked) => setProfile({ ...profile, availability: { ...profile.availability, fullTime: checked === true }, claims: updateClaim(profile.claims, (claim) => claim.field === "fullTime", checked === true) })} /><Label htmlFor="full-time" className="font-normal">Available full-time</Label></div></div>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-2"><Label htmlFor="preferred-roles">Preferred roles</Label><Textarea id="preferred-roles" className="min-h-48" value={lines(profile.preferredRoles)} onChange={(event) => setProfile({ ...profile, preferredRoles: parseLines(event.target.value) })} /></div>
            <div className="space-y-2"><Label htmlFor="profile-skills">Skills</Label><Textarea id="profile-skills" className="min-h-48" value={lines(profile.skills)} onChange={(event) => setProfile({ ...profile, skills: parseLines(event.target.value) })} /></div>
            <div className="space-y-2"><Label htmlFor="excluded-requirements">Excluded requirements</Label><Textarea id="excluded-requirements" className="min-h-48" value={lines(profile.excludedRequirements)} onChange={(event) => setProfile({ ...profile, excludedRequirements: parseLines(event.target.value) })} /></div>
          </div>
        </section>

        <section className="space-y-4 rounded-xl border border-dashed p-4">
          <div className="flex gap-3"><KeyRound className="mt-0.5 h-5 w-5 text-primary" /><div><h3 className="font-semibold">Private contact details</h3><p className="text-sm text-muted-foreground">Optional. These values are server-only and encrypted at rest when ENCRYPTION_KEY is configured. They are never included in seed data.</p></div></div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2"><Label htmlFor="private-email">Email</Label><Input id="private-email" type="email" autoComplete="email" value={contact.email ?? ""} onChange={(event) => setContact({ ...contact, email: event.target.value || null })} /></div>
            <div className="space-y-2"><Label htmlFor="private-phone">Phone</Label><Input id="private-phone" type="tel" autoComplete="tel" value={contact.phone ?? ""} onChange={(event) => setContact({ ...contact, phone: event.target.value || null })} /></div>
            <div className="space-y-2"><Label htmlFor="private-address">Address</Label><Input id="private-address" autoComplete="street-address" value={contact.address ?? ""} onChange={(event) => setContact({ ...contact, address: event.target.value || null })} /></div>
          </div>
        </section>

        <div className="flex justify-end"><Button onClick={save} disabled={saving || (pendingLegalClaimIds.size > 0 && !legalChangesConfirmed)}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save Job Agent profile</Button></div>
      </CardContent>
    </Card>
  );
}
