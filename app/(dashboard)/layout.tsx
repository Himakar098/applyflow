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
      <div className="flex min-h-screen bg-transparent">
        <Sidebar />
        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-white/40 bg-white/70 backdrop-blur-2xl">
            <div className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div className="space-y-1">
                <div className="chip">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Career mission active
                </div>
                <h1 className="text-xl font-semibold text-foreground">
                  ApplyFlow workspace
                </h1>
                <p className="text-sm text-muted-foreground">
                  Build your profile, unlock matches, and move from search to offer faster.
                </p>
              </div>
              <UserNav user={user} />
            </div>
          </header>
          <main className="flex-1 px-4 py-6 pb-28 sm:px-6 sm:pb-8 lg:px-8 lg:pb-6">
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
