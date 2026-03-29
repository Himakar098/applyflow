"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  MessageCircle,
  ThumbsUp,
  ThumbsDown,
  Clock,
  AlertCircle,
} from "lucide-react";

interface JobOutcomeTrackerProps {
  jobId: string;
  jobTitle: string;
  company: string;
  appliedAt: string;
  currentOutcome?: string;
  onOutcomeRecorded?: () => void;
}

const OUTCOMES = [
  {
    value: "rejected",
    label: "Rejected",
    icon: ThumbsDown,
    color: "bg-red-100 text-red-800 hover:bg-red-200",
    description: "Application was rejected",
  },
  {
    value: "ghosted",
    label: "Ghosted",
    icon: Clock,
    color: "bg-gray-100 text-gray-800 hover:bg-gray-200",
    description: "No response after application",
  },
  {
    value: "interview",
    label: "Interview",
    icon: MessageCircle,
    color: "bg-blue-100 text-blue-800 hover:bg-blue-200",
    description: "Got an interview request",
  },
  {
    value: "offer",
    label: "Offer",
    icon: ThumbsUp,
    color: "bg-green-100 text-green-800 hover:bg-green-200",
    description: "Received a job offer",
  },
];

export default function JobOutcomeTracker({
  jobId,
  jobTitle,
  company,
  appliedAt,
  currentOutcome,
  onOutcomeRecorded,
}: JobOutcomeTrackerProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [selectedOutcome, setSelectedOutcome] = useState<string | null>(
    currentOutcome || null
  );
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const daysAgo = Math.floor(
    (Date.now() - new Date(appliedAt).getTime()) / (1000 * 60 * 60 * 24)
  );

  const handleSubmit = async () => {
    if (!selectedOutcome || !user?.uid) return;

    setLoading(true);

    try {
      const response = await fetch("/api/applications/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await user.getIdToken()}`,
        },
        body: JSON.stringify({
          jobId,
          outcome: selectedOutcome,
          notes,
        }),
      });

      if (response.ok) {
        setSubmitted(true);
        setOpen(false);
        onOutcomeRecorded?.();

        // Reset form after animation
        setTimeout(() => {
          setSelectedOutcome(null);
          setNotes("");
          setSubmitted(false);
        }, 2000);
      }
    } catch (error) {
      console.error("Error recording outcome:", error);
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800 flex items-center gap-2">
        <span className="text-lg">✓</span>
        <span>Outcome recorded successfully</span>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {currentOutcome ? (
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <Badge variant="secondary" className="font-normal">
              {OUTCOMES.find((o) => o.value === currentOutcome)?.label}
            </Badge>
            Update
          </Button>
        ) : daysAgo >= 14 ? (
          <div className="inline-flex items-center gap-2 p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded">
            <AlertCircle className="w-4 h-4 text-yellow-600" />
            <div className="flex-1">
              <p className="text-sm text-yellow-800">
                <span className="font-medium">Update application status?</span>
                <span className="text-xs ml-2">Applied {daysAgo} days ago</span>
              </p>
            </div>
            <Button size="sm" variant="ghost">
              Report Status
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="sm">
            Record Outcome
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record Application Outcome</DialogTitle>
          <DialogDescription>
            Let us know what happened with your application to {company} so we
            can improve recommendations.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Job Info */}
          <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
            <p className="text-sm font-medium text-gray-900">{jobTitle}</p>
            <p className="text-xs text-gray-600">{company}</p>
            <p className="text-xs text-gray-500 mt-1">
              Applied {new Date(appliedAt).toLocaleDateString()}
            </p>
          </div>

          {/* Outcome Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-700">
              What was the outcome?
            </label>
            <div className="grid grid-cols-2 gap-2">
              {OUTCOMES.map((outcome) => {
                const Icon = outcome.icon;
                return (
                  <button
                    key={outcome.value}
                    onClick={() => setSelectedOutcome(outcome.value)}
                    className={`p-3 rounded-lg border-2 text-center transition-all ${
                      selectedOutcome === outcome.value
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <Icon className="w-5 h-5 mx-auto mb-1" />
                    <p className="text-xs font-medium">{outcome.label}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {outcome.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-700">
              Additional Notes (Optional)
            </label>
            <Textarea
              placeholder="E.g., Rejected due to insufficient experience, Interview scheduled for next week, etc."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="text-sm"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!selectedOutcome || loading}
            >
              {loading ? "Saving..." : "Record Outcome"}
            </Button>
          </div>
        </div>

        {/* Help Text */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
          <p className="font-medium mb-1">Why we ask:</p>
          <p>
            Your feedback helps us understand which types of jobs lead to
            interviews and offers, so we can make better recommendations.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
