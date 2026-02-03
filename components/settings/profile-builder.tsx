"use client";

import { Plus, Trash } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import type { Certification, Education, Profile, Project, WorkExperience } from "@/lib/types";
import { cn } from "@/lib/utils";

type ProfileBuilderProps = {
  profile: Profile;
  onChange: (profile: Profile) => void;
  className?: string;
};

function commaList(value: string) {
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

export function ProfileBuilder({ profile, onChange, className }: ProfileBuilderProps) {
  const update = (patch: Partial<Profile>) => onChange({ ...profile, ...patch });

  const updateSkills = (key: keyof Profile["skills"], value: string) => {
    update({
      skills: {
        ...profile.skills,
        [key]: commaList(value),
      },
    });
  };

  const updateWork = (index: number, patch: Partial<WorkExperience>) => {
    const next = [...profile.workExperience];
    next[index] = { ...next[index], ...patch };
    update({ workExperience: next });
  };

  const removeWork = (index: number) => {
    const next = [...profile.workExperience];
    next.splice(index, 1);
    update({ workExperience: next });
  };

  const updateProject = (index: number, patch: Partial<Project>) => {
    const next = [...profile.projects];
    next[index] = { ...next[index], ...patch };
    update({ projects: next });
  };

  const removeProject = (index: number) => {
    const next = [...profile.projects];
    next.splice(index, 1);
    update({ projects: next });
  };

  const updateEducation = (index: number, patch: Partial<Education>) => {
    const next = [...profile.education];
    next[index] = { ...next[index], ...patch };
    update({ education: next });
  };

  const removeEducation = (index: number) => {
    const next = [...profile.education];
    next.splice(index, 1);
    update({ education: next });
  };

  const updateCertification = (index: number, patch: Partial<Certification>) => {
    const next = [...profile.certifications];
    next[index] = { ...next[index], ...patch };
    update({ certifications: next });
  };

  const removeCertification = (index: number) => {
    const next = [...profile.certifications];
    next.splice(index, 1);
    update({ certifications: next });
  };

  return (
    <Card className={cn("surface-card", className)}>
      <CardHeader>
        <CardTitle>Profile builder</CardTitle>
        <CardDescription>
          Capture your career details manually if you don&apos;t have a resume handy.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Full name</Label>
            <Input
              placeholder="e.g., Priya Raman"
              value={profile.fullName ?? ""}
              onChange={(e) => update({ fullName: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              placeholder="e.g., priya@email.com"
              value={profile.email ?? ""}
              onChange={(e) => update({ email: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input
              placeholder="e.g., +1 555 123 4567"
              value={profile.phone ?? ""}
              onChange={(e) => update({ phone: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Current location</Label>
            <Input
              placeholder="e.g., Austin, TX"
              value={profile.location ?? ""}
              onChange={(e) => update({ location: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Visa status</Label>
            <Input
              placeholder="e.g., Citizen / PR / Work visa"
              value={profile.visaStatus ?? ""}
              onChange={(e) => update({ visaStatus: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Target roles</Label>
            <Input
              placeholder="e.g., Product Manager, Data Analyst"
              value={profile.targetRoles.join(", ")}
              onChange={(e) => update({ targetRoles: commaList(e.target.value) })}
            />
          </div>
          <div className="space-y-2">
            <Label>Preferred locations</Label>
            <Input
              placeholder="e.g., Remote, Sydney, Singapore"
              value={profile.preferredLocations.join(", ")}
              onChange={(e) => update({ preferredLocations: commaList(e.target.value) })}
            />
          </div>
          <div className="space-y-2">
            <Label>Work mode preference</Label>
            <Input
              placeholder="e.g., remote, hybrid, onsite"
              value={(profile.preferredWorkModes ?? []).join(", ")}
              onChange={(e) => update({ preferredWorkModes: commaList(e.target.value) })}
            />
          </div>
          <div className="space-y-2">
            <Label>Seniority preference</Label>
            <Input
              placeholder="e.g., entry, mid, senior"
              value={(profile.preferredSeniority ?? []).join(", ")}
              onChange={(e) => update({ preferredSeniority: commaList(e.target.value) })}
            />
          </div>
          <div className="space-y-2">
            <Label>Years of experience (approx)</Label>
            <Input
              type="number"
              min={0}
              placeholder="e.g., 5"
              value={profile.yearsExperienceApprox ?? ""}
              onChange={(e) => update({ yearsExperienceApprox: e.target.value ? Number(e.target.value) : undefined })}
            />
          </div>
          <div className="space-y-2">
            <Label>Hobbies</Label>
            <Input
              placeholder="e.g., Climbing, Photography"
              value={(profile.hobbies ?? []).join(", ")}
              onChange={(e) => update({ hobbies: commaList(e.target.value) })}
            />
          </div>
          <div className="space-y-2">
            <Label>LinkedIn</Label>
            <Input
              placeholder="e.g., https://linkedin.com/in/..."
              value={profile.linkedin ?? ""}
              onChange={(e) => update({ linkedin: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>GitHub</Label>
            <Input
              placeholder="e.g., https://github.com/..."
              value={profile.github ?? ""}
              onChange={(e) => update({ github: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Portfolio</Label>
            <Input
              placeholder="e.g., https://yourportfolio.com"
              value={profile.portfolio ?? ""}
              onChange={(e) => update({ portfolio: e.target.value })}
            />
          </div>
        </div>

        <Separator />

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Languages</Label>
            <Input
              placeholder="e.g., TypeScript, Python"
              value={profile.skills.languages.join(", ")}
              onChange={(e) => updateSkills("languages", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Tools</Label>
            <Input
              placeholder="e.g., Figma, Jira, dbt"
              value={profile.skills.tools.join(", ")}
              onChange={(e) => updateSkills("tools", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Cloud</Label>
            <Input
              placeholder="e.g., AWS, GCP, Azure"
              value={profile.skills.cloud.join(", ")}
              onChange={(e) => updateSkills("cloud", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Databases</Label>
            <Input
              placeholder="e.g., PostgreSQL, MongoDB"
              value={profile.skills.databases.join(", ")}
              onChange={(e) => updateSkills("databases", e.target.value)}
            />
          </div>
        </div>

        <Separator />

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Work experience</p>
              <p className="text-xs text-muted-foreground">
                Add roles with bullet points and tools used.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                update({
                  workExperience: [
                    ...profile.workExperience,
                    { company: "", role: "", bullets: [], tools: [] },
                  ],
                })
              }
            >
              <Plus className="mr-1 h-4 w-4" />
              Add experience
            </Button>
          </div>
          <div className="space-y-3">
            {profile.workExperience.map((exp, idx) => (
              <Card key={`exp-${idx}`} className="border-dashed">
                <CardContent className="space-y-3 pt-4">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline">Role {idx + 1}</Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeWork(idx)}
                    >
                      <Trash className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Company</Label>
                      <Input
                        placeholder="e.g., Stripe"
                        value={exp.company}
                        onChange={(e) => updateWork(idx, { company: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Role</Label>
                      <Input
                        placeholder="e.g., Senior Engineer"
                        value={exp.role}
                        onChange={(e) => updateWork(idx, { role: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Start date</Label>
                      <Input
                        type="date"
                        value={exp.startDate ?? ""}
                        onChange={(e) => updateWork(idx, { startDate: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>End date</Label>
                      <Input
                        type="date"
                        value={exp.endDate ?? ""}
                        onChange={(e) => updateWork(idx, { endDate: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Bullets</Label>
                    <Textarea
                      className="min-h-[100px]"
                      placeholder="One bullet per line"
                      value={exp.bullets.join("\n")}
                      onChange={(e) =>
                        updateWork(idx, { bullets: e.target.value.split("\n").map((b) => b.trim()).filter(Boolean) })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tools</Label>
                    <Input
                      placeholder="e.g., React, Node.js, AWS"
                      value={(exp.tools ?? []).join(", ")}
                      onChange={(e) =>
                        updateWork(idx, { tools: commaList(e.target.value) })
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
            {profile.workExperience.length === 0 ? (
              <p className="text-sm text-muted-foreground">Add at least one experience.</p>
            ) : null}
          </div>
        </section>

        <Separator />

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Projects</p>
              <p className="text-xs text-muted-foreground">Add side projects with stack and impact.</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                update({
                  projects: [
                    ...profile.projects,
                    { title: "", stack: [], bullets: [], impact: "" },
                  ],
                })
              }
            >
              <Plus className="mr-1 h-4 w-4" />
              Add project
            </Button>
          </div>
          <div className="space-y-3">
            {profile.projects.map((project, idx) => (
              <Card key={`proj-${idx}`} className="border-dashed">
                <CardContent className="space-y-3 pt-4">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline">Project {idx + 1}</Badge>
                    <Button size="sm" variant="ghost" onClick={() => removeProject(idx)}>
                      <Trash className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input
                      placeholder="e.g., Analytics Dashboard"
                      value={project.title}
                      onChange={(e) => updateProject(idx, { title: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Stack</Label>
                    <Input
                      placeholder="e.g., Next.js, Supabase, Tailwind"
                      value={project.stack.join(", ")}
                      onChange={(e) => updateProject(idx, { stack: commaList(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Impact (optional)</Label>
                    <Textarea
                      placeholder="e.g., Reduced reporting time by 30%"
                      value={project.impact ?? ""}
                      onChange={(e) => updateProject(idx, { impact: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Bullets</Label>
                    <Textarea
                      className="min-h-[100px]"
                      placeholder="One bullet per line"
                      value={project.bullets.join("\n")}
                      onChange={(e) =>
                        updateProject(idx, { bullets: e.target.value.split("\n").map((b) => b.trim()).filter(Boolean) })
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
            {profile.projects.length === 0 ? (
              <p className="text-sm text-muted-foreground">Add at least two projects to boost readiness.</p>
            ) : null}
          </div>
        </section>

        <Separator />

        <section className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Education</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  update({
                    education: [
                      ...profile.education,
                      { institution: "", degree: "", field: "", startDate: "", endDate: "" },
                    ],
                  })
                }
              >
                <Plus className="mr-1 h-4 w-4" />
                Add education
              </Button>
            </div>
            <div className="space-y-3">
              {profile.education.map((edu, idx) => (
                <Card key={`edu-${idx}`} className="border-dashed">
                  <CardContent className="space-y-3 pt-4">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline">Program {idx + 1}</Badge>
                      <Button size="sm" variant="ghost" onClick={() => removeEducation(idx)}>
                        <Trash className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                    <Input
                      placeholder="Institution"
                      value={edu.institution}
                      onChange={(e) => updateEducation(idx, { institution: e.target.value })}
                    />
                    <Input
                      placeholder="Degree"
                      value={edu.degree}
                      onChange={(e) => updateEducation(idx, { degree: e.target.value })}
                    />
                    <Input
                      placeholder="Field (optional)"
                      value={edu.field ?? ""}
                      onChange={(e) => updateEducation(idx, { field: e.target.value })}
                    />
                    <div className="grid gap-3 md:grid-cols-2">
                      <Input
                        type="date"
                        value={edu.startDate ?? ""}
                        onChange={(e) => updateEducation(idx, { startDate: e.target.value })}
                      />
                      <Input
                        type="date"
                        value={edu.endDate ?? ""}
                        onChange={(e) => updateEducation(idx, { endDate: e.target.value })}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Certifications</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  update({
                    certifications: [
                      ...profile.certifications,
                      { name: "", issuer: "", year: "", url: "" },
                    ],
                  })
                }
              >
                <Plus className="mr-1 h-4 w-4" />
                Add certification
              </Button>
            </div>
            <div className="space-y-3">
              {profile.certifications.map((cert, idx) => (
                <Card key={`cert-${idx}`} className="border-dashed">
                  <CardContent className="space-y-3 pt-4">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline">Certification {idx + 1}</Badge>
                      <Button size="sm" variant="ghost" onClick={() => removeCertification(idx)}>
                        <Trash className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                    <Input
                      placeholder="Name"
                      value={cert.name}
                      onChange={(e) => updateCertification(idx, { name: e.target.value })}
                    />
                    <Input
                      placeholder="Issuer"
                      value={cert.issuer ?? ""}
                      onChange={(e) => updateCertification(idx, { issuer: e.target.value })}
                    />
                    <Input
                      placeholder="Year"
                      value={cert.year ?? ""}
                      onChange={(e) => updateCertification(idx, { year: e.target.value })}
                    />
                    <Input
                      placeholder="URL"
                      value={cert.url ?? ""}
                      onChange={(e) => updateCertification(idx, { url: e.target.value })}
                    />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      </CardContent>
    </Card>
  );
}
