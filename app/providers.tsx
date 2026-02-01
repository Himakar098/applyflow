"use client";

import { ReactNode } from "react";

import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/lib/auth/auth-provider";

type ProvidersProps = {
  children: ReactNode;
};

export function Providers({ children }: ProvidersProps) {
  return (
    <AuthProvider>
      {children}
      <Toaster />
    </AuthProvider>
  );
}
