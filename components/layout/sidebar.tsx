"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Briefcase,
  Files,
  LayoutDashboard,
  Menu,
  Settings,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const links = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "Resume Manager", href: "/resume", icon: Files },
  { label: "Job Tracker", href: "/jobs", icon: Briefcase },
  { label: "Settings", href: "/settings", icon: Settings },
];

function NavLinks({ onSelect }: { onSelect?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="space-y-1">
      {links.map((link) => {
        const Icon = link.icon;
        const isActive = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={onSelect}
            className={cn(
              "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
              isActive
                ? "bg-primary/10 text-primary ring-1 ring-primary/20"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function Sidebar() {
  return (
    <>
      <aside className="hidden w-64 flex-col border-r bg-white/80 px-4 py-6 backdrop-blur-xl lg:flex">
        <Link href="/dashboard" className="mb-6 flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-white shadow-lg shadow-primary/20">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">ApplyFlow</p>
            <p className="text-xs text-muted-foreground">AI job workspace</p>
          </div>
        </Link>
        <NavLinks />
        <div className="mt-auto space-y-3">
          <div className="rounded-xl border border-dashed border-primary/20 bg-primary/5 px-3 py-3 text-xs text-muted-foreground">
            Keep every application ATS-safe and on-brand.
          </div>
          <Button asChild className="w-full">
            <Link href="/jobs?new=1">New application</Link>
          </Button>
        </div>
      </aside>
      <div className="flex items-center justify-between border-b bg-white/80 px-4 py-3 backdrop-blur-xl lg:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-white shadow-lg shadow-primary/20">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">ApplyFlow</p>
            <p className="text-xs text-muted-foreground">AI job workspace</p>
          </div>
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon">
              <Menu className="h-4 w-4" />
              <span className="sr-only">Open menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72">
            <SheetHeader>
              <SheetTitle>Navigation</SheetTitle>
            </SheetHeader>
            <div className="mt-6">
              <NavLinks />
              <Button asChild className="mt-6 w-full">
                <Link href="/jobs?new=1">New application</Link>
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
