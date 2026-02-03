"use client";

import { motion } from "framer-motion";

import { AuthGuard } from "@/components/auth/auth-guard";
import { Sidebar } from "@/components/layout/sidebar";
import { UserNav } from "@/components/layout/user-nav";
import { useAuth } from "@/lib/auth/auth-provider";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-[#f7f9fb]">
        <Sidebar />
        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b bg-white/80 backdrop-blur-xl">
            <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  ApplyFlow
                </p>
                <h1 className="text-xl font-semibold text-foreground">
                  Your application cockpit
                </h1>
                <p className="text-sm text-muted-foreground">
                  Keep your pipeline organized and interview-ready.
                </p>
              </div>
              <UserNav user={user} />
            </div>
          </header>
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
              className="mx-auto w-full max-w-screen-2xl space-y-6"
            >
              {children}
            </motion.div>
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
