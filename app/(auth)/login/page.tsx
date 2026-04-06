"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { signInWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import { motion } from "framer-motion";
import { Loader2, Mail, ShieldCheck } from "lucide-react";
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
import { betaConfig, getBetaPrimaryCta } from "@/lib/beta/config";
import { auth, googleProvider } from "@/lib/firebase/client";
import { siteConfig } from "@/lib/site-config";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type FormValues = z.infer<typeof schema>;

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";
  const { toast } = useToast();
  const primaryCta = getBetaPrimaryCta();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (values: FormValues) => {
    form.clearErrors();
    try {
      await signInWithEmailAndPassword(auth, values.email, values.password);
      await trackAnalyticsEvent("login_completed", { method: "password" });
      toast({ title: "Welcome back", description: "You are signed in." });
      router.push(next);
    } catch (error) {
      console.error(error);
      toast({
        title: "Unable to sign in",
        description: "Check your credentials and try again.",
        variant: "destructive",
      });
    }
  };

  const handleGoogle = async () => {
    if (betaConfig.accessMode !== "open") return;

    try {
      await signInWithPopup(auth, googleProvider);
      await trackAnalyticsEvent("login_completed", { method: "google" });
      toast({ title: "Signed in with Google" });
      router.push(next);
    } catch (error) {
      console.error(error);
      toast({
        title: "Google sign-in failed",
        description: "Please try again or use email and password.",
        variant: "destructive",
      });
    }
  };

  const isSubmitting = form.formState.isSubmitting;

  return (
    <AuthShell
      title="Sign in"
      description={
        betaConfig.accessMode === "waitlist"
          ? "Existing users can sign in. New access requests are handled separately."
          : betaConfig.accessMode === "invite"
            ? "Existing users can sign in. New accounts still require an invite code."
            : "Access your profile, matched roles, tailored materials, and tracker."
      }
      footer={
        <div className="flex w-full items-center justify-between text-muted-foreground">
          <div className="flex items-center gap-2 text-xs">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Secure sign-in
          </div>
          <span>
            New here?{" "}
            <Link href={primaryCta.href} className="font-medium text-primary underline-offset-4 hover:underline">
              {primaryCta.label}
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
        <div className="rounded-xl border border-dashed border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
          <div className="flex items-start gap-2">
            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p>
              {betaConfig.accessMode === "open"
                ? "Use email and password, or continue with Google if you prefer."
                : `Use your existing account. Need help accessing the app? Email ${siteConfig.supportEmail}.`}
            </p>
          </div>
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3.5">
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
                      autoComplete="current-password"
                      disabled={isSubmitting}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex items-center justify-end">
              <Link href="/forgot-password" className="text-xs font-medium text-primary underline-offset-4 hover:underline">
                Forgot password?
              </Link>
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting} size="lg">
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing you in...
                </>
              ) : (
                "Continue"
              )}
            </Button>
          </form>
        </Form>
        <div className="space-y-3 pt-1">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={isSubmitting || betaConfig.accessMode !== "open"}
            onClick={handleGoogle}
          >
            {betaConfig.accessMode === "open" ? "Continue with Google" : "Google sign-in unavailable"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            By continuing, you agree to our{" "}
            <Link href="/privacy" className="underline underline-offset-4 hover:text-foreground">
              privacy policy
            </Link>{" "}
            and{" "}
            <Link href="/terms" className="underline underline-offset-4 hover:text-foreground">
              terms
            </Link>
            .
          </p>
        </div>
      </motion.div>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-background text-sm text-muted-foreground">
          Loading sign-in...
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
