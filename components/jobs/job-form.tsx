"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { JobApplication, JobDraft, JobStatus } from "@/lib/types";

const statuses: JobStatus[] = [
  "applied",
  "interview",
  "ghosted",
  "rejected",
  "offer",
];

const sources = [
  "LinkedIn",
  "Indeed",
  "SEEK",
  "AngelList",
  "Company site",
  "Referral",
  "Other",
];

const jobSchema = z.object({
  company: z.string().min(2, "Add the company name"),
  title: z.string().min(2, "Add the job title"),
  location: z.string().optional(),
  source: z.string().optional(),
  status: z.enum(statuses),
  appliedDate: z.string().optional(),
  notes: z.string().optional(),
});

type JobFormValues = z.infer<typeof jobSchema>;

type JobFormProps = {
  defaultValues?: Partial<JobApplication>;
  onSubmit: (values: JobDraft) => Promise<void>;
  onCancel?: () => void;
  submitting?: boolean;
};

export function JobForm({
  defaultValues,
  onSubmit,
  onCancel,
  submitting,
}: JobFormProps) {
  const form = useForm<JobFormValues>({
    resolver: zodResolver(jobSchema),
    defaultValues: {
      company: "",
      title: "",
      location: "",
      source: "LinkedIn",
      status: "applied",
      appliedDate: new Date().toISOString().slice(0, 10),
      notes: "",
      ...defaultValues,
    },
  });

  useEffect(() => {
    if (defaultValues) {
      form.reset({
        company: defaultValues.company ?? "",
        title: defaultValues.title ?? "",
        location: defaultValues.location ?? "",
        source: defaultValues.source ?? "LinkedIn",
        status: (defaultValues.status as JobStatus) ?? "applied",
        appliedDate: defaultValues.appliedDate ?? "",
        notes: defaultValues.notes ?? "",
      });
    }
  }, [defaultValues, form]);

  const handleSubmit = async (values: JobFormValues) => {
    await onSubmit({
      ...values,
    });
    if (!defaultValues) {
      form.reset({
        company: "",
        title: "",
        location: "",
        source: "LinkedIn",
        status: "applied",
        appliedDate: new Date().toISOString().slice(0, 10),
        notes: "",
      });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <FormField
            control={form.control}
            name="company"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Company</FormLabel>
                <FormControl>
                  <Input placeholder="Linear" {...field} disabled={submitting} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Job title</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Product Designer"
                    {...field}
                    disabled={submitting}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <FormField
            control={form.control}
            name="location"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Location</FormLabel>
                <FormControl>
                  <Input placeholder="Remote, SF, NYC" {...field} disabled={submitting} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="source"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Source</FormLabel>
                <Select
                  disabled={submitting}
                  value={field.value}
                  onValueChange={field.onChange}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select source" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {sources.map((source) => (
                      <SelectItem key={source} value={source}>
                        {source}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select
                  disabled={submitting}
                  value={field.value}
                  onValueChange={field.onChange}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {statuses.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <FormField
            control={form.control}
            name="appliedDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Applied date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} disabled={submitting} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Add notes, links, recruiter info..."
                    className="resize-none"
                    rows={3}
                    {...field}
                    disabled={submitting}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="flex items-center justify-end gap-3">
          {onCancel ? (
            <Button
              type="button"
              variant="ghost"
              onClick={onCancel}
              disabled={submitting}
            >
              Cancel
            </Button>
          ) : null}
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving..." : defaultValues ? "Update" : "Add job"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
