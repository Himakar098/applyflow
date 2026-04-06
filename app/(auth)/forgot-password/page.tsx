"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { sendPasswordResetEmail } from "firebase/auth";
import { motion } from "framer-motion";
import { Loader2, Mail } from "lucide-react";
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
import { getBetaPrimaryCta } from "@/lib/beta/config";
import { auth } from "@/lib/firebase/client";
import { siteConfig } from "@/lib/site-config";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
});

type FormValues = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { toast } = useToast();
  const primaryCta = getBetaPrimaryCta();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (values: FormValues) => {
    form.clearErrors();
    try {
      await sendPasswordResetEmail(auth, values.email);
      toast({
        title: "Reset link sent",
        description: "Check your inbox for a password reset link.",
      });
      router.push("/login");
    } catch (error) {
      console.error(error);
      toast({
        title: "Unable to send reset link",
        description: "Check the email address and try again.",
        variant: "destructive",
      });
    }
  };

  const isSubmitting = form.formState.isSubmitting;

  return (
    <AuthShell
      title="Reset your password"
      description="We will email you a secure link to reset your password."
      backLink={{ href: "/login", label: "Back to sign in" }}
      footer={
        <div className="flex w-full items-center justify-between text-muted-foreground">
          <span>
            Need an account?{" "}
            <Link href={primaryCta.href} className="font-medium text-primary underline-offset-4 hover:underline">
              {primaryCta.label}
            </Link>
          </span>
          <Link
            href={`mailto:${siteConfig.supportEmail}`}
            className="text-xs font-medium text-primary underline-offset-4 hover:underline"
          >
            Contact support
          </Link>
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
            <p>Enter the email you used to sign up. If the account exists, a reset link will be sent.</p>
          </div>
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="you@email.com" autoComplete="email" disabled={isSubmitting} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isSubmitting} size="lg">
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending link...
                </>
              ) : (
                "Send reset link"
              )}
            </Button>
          </form>
        </Form>
      </motion.div>
    </AuthShell>
  );
}
