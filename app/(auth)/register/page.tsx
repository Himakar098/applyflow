"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { signInWithCustomToken } from "firebase/auth";
import { motion } from "framer-motion";
import { Loader2, ShieldCheck } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { AuthShell } from "@/components/auth/auth-shell";
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
import { useToast } from "@/hooks/use-toast";
import { trackAnalyticsEvent } from "@/lib/analytics/client";
import { betaConfig } from "@/lib/beta/config";
import { auth } from "@/lib/firebase/client";
import { siteConfig } from "@/lib/site-config";

const schema = z
  .object({
    fullName: z.string().min(2, "Enter your name"),
    email: z.string().email("Enter a valid email"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
    inviteCode: z.string().optional(),
  })
  .refine((val) => val.password === val.confirmPassword, {
    message: "Passwords must match",
    path: ["confirmPassword"],
  })
  .refine((val) => (betaConfig.accessMode === "invite" ? Boolean(val.inviteCode?.trim()) : true), {
    message: "Invite code is required",
    path: ["inviteCode"],
  });

type FormValues = z.infer<typeof schema>;

export default function RegisterPage() {
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
      inviteCode: "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    form.clearErrors();
    try {
      if (betaConfig.accessMode === "waitlist") {
        router.push("/waitlist");
        return;
      }

      const registerRes = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: values.fullName,
          email: values.email,
          password: values.password,
          inviteCode: values.inviteCode?.trim() || undefined,
        }),
      });
      const registerData = await registerRes.json().catch(() => null);
      if (!registerRes.ok || !registerData?.ok || !registerData?.customToken) {
        throw new Error(registerData?.error || "registration_failed");
      }

      await signInWithCustomToken(auth, registerData.customToken);
      await trackAnalyticsEvent("signup_completed", { method: "password" });
      toast({
        title: "Account created",
        description: "Welcome to ApplyFlow. Let’s set up your workspace.",
      });
      router.push("/dashboard");
    } catch (error) {
      console.error(error);
      const code = error instanceof Error ? error.message : "";
      if (code === "waitlist_only") {
        router.push("/waitlist");
        return;
      }

      const descriptionByCode: Record<string, string> = {
        invalid_invite_code: "Your invite code is invalid.",
        email_in_use: "This email is already in use. Try signing in instead.",
        rate_limited: "Too many attempts. Please wait a few minutes and try again.",
      };
      toast({
        title: "Unable to create your account",
        description: descriptionByCode[code] || "Please try again or use a different email.",
        variant: "destructive",
      });
    }
  };

  const isSubmitting = form.formState.isSubmitting;

  return (
    <AuthShell
      title={betaConfig.accessMode === "waitlist" ? "Request access" : "Create your account"}
      description={
        betaConfig.accessMode === "waitlist"
          ? "Access requests are reviewed in stages."
          : betaConfig.accessMode === "invite"
            ? "Use your invite code, then finish account setup."
            : "Set up your profile, review matched roles, and track applications in one place."
      }
      backLink={{ href: "/login", label: "Back to sign in" }}
      footer={
        <div className="flex w-full items-center justify-between text-muted-foreground">
          <div className="flex items-center gap-2 text-xs">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Secure account setup
          </div>
          <span>
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
              Sign in
            </Link>
          </span>
        </div>
      }
    >
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="space-y-4"
      >
        {betaConfig.accessMode === "waitlist" ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-dashed border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
              Registration is currently capped. Request access and we will follow up when space opens.
            </div>
            <Button asChild className="w-full" size="lg">
              <Link href="/waitlist">Request access</Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href="/browser-extension">View extension guide</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="rounded-xl border border-dashed border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
              {betaConfig.accessMode === "invite"
                ? "Enter your invite code and finish account setup. Resume import and profile setup happen after sign-up."
                : `Create your account first. Need help before you start? Email ${siteConfig.supportEmail}.`}
            </div>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3.5">
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Full name"
                          autoComplete="name"
                          disabled={isSubmitting}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {betaConfig.accessMode === "invite" ? (
                  <FormField
                    control={form.control}
                    name="inviteCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Invite code</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter your invite code"
                            autoComplete="one-time-code"
                            disabled={isSubmitting}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : null}
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="work@email.com"
                          autoComplete="email"
                          disabled={isSubmitting}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="••••••••"
                          autoComplete="new-password"
                          disabled={isSubmitting}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="••••••••"
                          autoComplete="new-password"
                          disabled={isSubmitting}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={isSubmitting} size="lg">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating account...
                    </>
                  ) : (
                    "Create account"
                  )}
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  By creating an account, you agree to our{" "}
                  <Link href="/privacy" className="underline underline-offset-4 hover:text-foreground">
                    privacy policy
                  </Link>{" "}
                  and{" "}
                  <Link href="/terms" className="underline underline-offset-4 hover:text-foreground">
                    terms
                  </Link>
                  .
                </p>
              </form>
            </Form>
          </>
        )}
      </motion.div>
    </AuthShell>
  );
}
