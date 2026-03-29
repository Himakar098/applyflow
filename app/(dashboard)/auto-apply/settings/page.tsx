"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertCircle, CheckCircle2, Save } from "lucide-react";

interface AutoApplyConfig {
  enabled: boolean;
  minScore: number;
  maxApplicationsPerDay: number;
  filters: {
    locations: string[];
    workModes: string[];
    excludeCompanies: string[];
    excludeKeywords: string[];
    industries?: string[];
    salaryRange?: { min: number; max: number };
  };
  attachResume: boolean;
  attachOtherDocs: boolean;
  autoSubmit: boolean;
  notifyOnTasksPending: boolean;
  weeklyReviewEmail: boolean;
}

const WORK_MODES = [
  { value: "remote", label: "Remote" },
  { value: "hybrid", label: "Hybrid" },
  { value: "on-site", label: "On-Site" },
];

const DEFAULT_CONFIG: AutoApplyConfig = {
  enabled: false,
  minScore: 70,
  maxApplicationsPerDay: 5,
  filters: {
    locations: [],
    workModes: ["remote"],
    excludeCompanies: [],
    excludeKeywords: ["unpaid", "intern"],
    industries: [],
  },
  attachResume: true,
  attachOtherDocs: false,
  autoSubmit: false,
  notifyOnTasksPending: true,
  weeklyReviewEmail: true,
};

export default function AutoApplySettingsPage() {
  const { user } = useAuth();
  const [config, setConfig] = useState<AutoApplyConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const fetchConfig = useCallback(async () => {
    if (!user?.uid) return;

    try {
      const db = getFirestore();
      const docRef = doc(db, `users/${user.uid}/settings`, "auto-apply");
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        setConfig(docSnap.data() as AutoApplyConfig);
      }
    } catch (error) {
      console.error("Error fetching config:", error);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    if (user?.uid) {
      fetchConfig();
    }
  }, [fetchConfig, user?.uid]);

  const handleSave = async () => {
    if (!user?.uid) return;

    setSaving(true);

    try {
      const db = getFirestore();
      const docRef = doc(db, `users/${user.uid}/settings`, "auto-apply");
      await setDoc(docRef, config);

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error("Error saving config:", error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-2xl">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Auto-Apply Settings</h1>
        <p className="text-gray-600">
          Configure how ApplyFlow will automatically apply to jobs on your behalf
        </p>
      </div>

      {/* Enable/Disable */}
      <Card className="border-2 border-blue-200 bg-blue-50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Auto-Apply Status</CardTitle>
              <CardDescription>
                Enable or disable automatic job applications
              </CardDescription>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) =>
                  setConfig({ ...config, enabled: e.target.checked })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </CardHeader>
      </Card>

      {/* Scoring Threshold */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Scoring Threshold</CardTitle>
          <CardDescription>
            Only apply to jobs with a match score above this threshold
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="mb-2 block">
              Minimum Match Score: <span className="font-bold">{config.minScore}</span>/100
            </Label>
            <input
              type="range"
              min="50"
              max="100"
              step="5"
              value={config.minScore}
              onChange={(e) =>
                setConfig({ ...config, minScore: parseInt(e.target.value) })
              }
              className="w-full"
            />
            <p className="text-xs text-gray-500 mt-2">
              Higher scores mean more selective matching
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Daily Limit */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daily Application Limit</CardTitle>
          <CardDescription>
            Maximum number of applications per day
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="daily-limit">Applications per day</Label>
            <Input
              id="daily-limit"
              type="number"
              min="1"
              max="50"
              value={config.maxApplicationsPerDay}
              onChange={(e) =>
                setConfig({
                  ...config,
                  maxApplicationsPerDay: parseInt(e.target.value) || 5,
                })
              }
            />
            <p className="text-xs text-gray-500">
              Recommended: 5-10 to avoid appearing as spam
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Work Mode Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Work Mode Preferences</CardTitle>
          <CardDescription>
            Which work arrangements do you prefer?
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {WORK_MODES.map((mode) => (
            <div key={mode.value} className="flex items-center gap-2">
              <Checkbox
                id={mode.value}
                checked={config.filters.workModes.includes(mode.value)}
                onCheckedChange={(checked) => {
                  const modes = checked
                    ? [...config.filters.workModes, mode.value]
                    : config.filters.workModes.filter((m) => m !== mode.value);
                  setConfig({
                    ...config,
                    filters: { ...config.filters, workModes: modes },
                  });
                }}
              />
              <Label htmlFor={mode.value} className="cursor-pointer">
                {mode.label}
              </Label>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* File Upload Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">File Upload</CardTitle>
          <CardDescription>
            What should we auto-attach to applications?
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="attach-resume"
              checked={config.attachResume}
              onCheckedChange={(checked) =>
                setConfig({ ...config, attachResume: Boolean(checked) })
              }
            />
            <Label htmlFor="attach-resume" className="cursor-pointer">
              Auto-attach resume
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="attach-docs"
              checked={config.attachOtherDocs}
              onCheckedChange={(checked) =>
                setConfig({ ...config, attachOtherDocs: Boolean(checked) })
              }
            />
            <Label htmlFor="attach-docs" className="cursor-pointer">
              Auto-attach other documents (cover letter, transcript, etc.)
            </Label>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-xs text-yellow-800">
            <AlertCircle className="w-4 h-4 inline mr-1" />
            <span>
              Note: Due to browser security, we may need you to manually upload
              files or complete challenges (CAPTCHAs, MFA)
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Submission Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Form Submission</CardTitle>
          <CardDescription>
            How should we handle form submission?
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded p-3 text-xs text-red-800 mb-4">
            <AlertCircle className="w-4 h-4 inline mr-1" />
            <strong>Important:</strong> Only enable auto-submit if you&apos;re
            comfortable with applications being submitted automatically
          </div>
          <div className="flex items-start gap-2">
            <Checkbox
              id="auto-submit"
              checked={config.autoSubmit}
              onCheckedChange={(checked) =>
                setConfig({ ...config, autoSubmit: Boolean(checked) })
              }
            />
            <div>
              <Label htmlFor="auto-submit" className="cursor-pointer font-medium">
                Auto-submit forms
              </Label>
              <p className="text-xs text-gray-600 mt-1">
                Automatically click submit if form is fully filled and no
                challenges detected
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notifications</CardTitle>
          <CardDescription>
            How should we notify you about your applications?
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Checkbox
              id="notify-tasks"
              checked={config.notifyOnTasksPending}
              onCheckedChange={(checked) =>
                setConfig({
                  ...config,
                  notifyOnTasksPending: Boolean(checked),
                })
              }
            />
            <Label htmlFor="notify-tasks" className="cursor-pointer">
              Notify me when manual tasks are pending
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="weekly-email"
              checked={config.weeklyReviewEmail}
              onCheckedChange={(checked) =>
                setConfig({ ...config, weeklyReviewEmail: Boolean(checked) })
              }
            />
            <Label htmlFor="weekly-email" className="cursor-pointer">
              Send weekly summary email
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex gap-2 justify-between sticky bottom-0 bg-white p-4 border-t rounded-b-lg">
        <div>
          {saved && (
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-sm font-medium">Settings saved</span>
            </div>
          )}
        </div>
        <Button
          onClick={handleSave}
          disabled={saving}
          size="lg"
          className="gap-2"
        >
          <Save className="w-4 h-4" />
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </div>

      {/* Help Section */}
      <Card className="bg-blue-50 border-blue-200 mt-12">
        <CardHeader>
          <CardTitle className="text-sm">Best Practices</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-700 space-y-2">
          <ul className="list-disc pl-5 space-y-1">
            <li>Start with a higher score threshold (80+) to test the system</li>
            <li>Begin with 3-5 applications per day to monitor results</li>
            <li>Enable auto-submit only once you&apos;re confident in the system</li>
            <li>Check pending tasks daily to complete CAPTCHAs and uploads</li>
            <li>Record application outcomes to improve future recommendations</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
