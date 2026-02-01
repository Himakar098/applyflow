"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { getProfile, updateProfile } from "@/app/actions/profile";
import { useAuth } from "@/lib/auth/auth-provider";
import type { Profile } from "@/lib/types";

const schema = z.object({
  fullName: z.string().min(2, "Enter your name"),
  preferredTitles: z.string().optional(),
  preferredLocations: z.string().optional(),
  visaStatus: z.string().min(1, "Select a status"),
});

type FormValues = z.infer<typeof schema>;

export default function SettingsPage() {
  const { token, refreshToken, user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: "",
      preferredTitles: "",
      preferredLocations: "",
      visaStatus: "Not set",
    },
  });

  const loadProfile = async () => {
    try {
      const idToken = token ?? (await refreshToken());
      if (!idToken) return;
      const profile = await getProfile(idToken, user?.email);
      form.reset({
        fullName: profile.fullName,
        preferredTitles: profile.preferredTitles.join(", "),
        preferredLocations: profile.preferredLocations.join(", "),
        visaStatus: profile.visaStatus || "Not set",
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Unable to load profile",
        description: "Check your Firebase configuration.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = async (values: FormValues) => {
    try {
      const idToken = token ?? (await refreshToken());
      if (!idToken) return;
      const payload: Partial<Profile> = {
        fullName: values.fullName,
        preferredTitles: values.preferredTitles
          ? values.preferredTitles.split(",").map((t) => t.trim()).filter(Boolean)
          : [],
        preferredLocations: values.preferredLocations
          ? values.preferredLocations.split(",").map((l) => l.trim()).filter(Boolean)
          : [],
        visaStatus: values.visaStatus,
        email: user?.email ?? undefined,
      };
      await updateProfile(idToken, payload);
      toast({ title: "Profile updated" });
    } catch (error) {
      console.error(error);
      toast({
        title: "Unable to save profile",
        description: "Try again later.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Settings
        </p>
        <h2 className="text-2xl font-semibold text-foreground">Profile & preferences</h2>
        <p className="text-sm text-muted-foreground">
          Your information powers tailored job recommendations and follow-ups.
        </p>
      </div>

      <Card className="border-0 bg-white shadow-sm shadow-slate-900/5">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Keep your candidate details organized.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full name</FormLabel>
                      <FormControl>
                        <Input placeholder="Alex Rivera" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="preferredTitles"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Preferred job titles</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Product Manager, Senior Designer"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="preferredLocations"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Preferred locations</FormLabel>
                      <FormControl>
                        <Input placeholder="Remote, San Francisco, Sydney" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="visaStatus"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Visa status</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Not set">Not set</SelectItem>
                          <SelectItem value="Citizen / PR">Citizen / PR</SelectItem>
                          <SelectItem value="Work visa">Work visa</SelectItem>
                          <SelectItem value="Visa sponsorship">Visa sponsorship</SelectItem>
                          <SelectItem value="Student visa">Student visa</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-fit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save preferences"
                  )}
                </Button>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
