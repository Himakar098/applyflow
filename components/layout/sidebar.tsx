"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Briefcase,
  Files,
  LayoutDashboard,
  MessageSquareWarning,
  Menu,
  MoreHorizontal,
  Puzzle,
  Search,
  Settings,
  Sparkles,
  Target,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const links = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "Resume Manager", href: "/resume", icon: Files },
  { label: "Job Tracker", href: "/jobs", icon: Briefcase },
  { label: "Recommendations", href: "/recommendations", icon: Target },
  { label: "Search", href: "/search", icon: Search },
  { label: "Extensions", href: "/extensions", icon: Puzzle },
  { label: "Feedback", href: "/feedback", icon: MessageSquareWarning },
  { label: "Settings", href: "/settings", icon: Settings },
];

const primaryMobileLinks = [
  { label: "Home", href: "/dashboard", icon: LayoutDashboard },
  { label: "Jobs", href: "/jobs", icon: Briefcase },
  { label: "Resumes", href: "/resume", icon: Files },
  { label: "Search", href: "/search", icon: Search },
  { label: "More", href: "#more", icon: MoreHorizontal },
];

const secondaryMobileLinks = [
  { label: "Recommendations", href: "/recommendations", icon: Target },
  { label: "Extensions", href: "/extensions", icon: Puzzle },
  { label: "Feedback", href: "/feedback", icon: MessageSquareWarning },
  { label: "Settings", href: "/settings", icon: Settings },
];

const isLinkActive = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

function NavLinks({ onSelect }: { onSelect?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="space-y-1">
      {links.map((link) => {
        const Icon = link.icon;
        const isActive = isLinkActive(pathname, link.href);
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
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      <aside className="hidden w-64 flex-col border-r border-white/40 bg-white/70 px-4 py-6 backdrop-blur-2xl lg:flex">
        <Link href="/dashboard" className="mb-6 flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-primary via-primary to-emerald-500 text-white shadow-lg shadow-primary/30">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">ApplyFlow</p>
            <p className="text-xs text-muted-foreground">Career OS</p>
          </div>
        </Link>
        <NavLinks />
        <div className="mt-auto space-y-3">
          <div className="rounded-xl border border-dashed border-primary/20 bg-white/70 px-3 py-3 text-xs text-muted-foreground">
            Daily mission: polish profile, save two roles, and ship one tailored pack.
          </div>
          <Button asChild className="w-full">
            <Link href="/jobs?new=1">New application</Link>
          </Button>
        </div>
      </aside>
      <div className="flex items-center justify-between border-b border-white/40 bg-white/70 px-4 py-3 backdrop-blur-2xl lg:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-primary via-primary to-emerald-500 text-white shadow-lg shadow-primary/30">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">ApplyFlow</p>
            <p className="text-xs text-muted-foreground">Career OS</p>
          </div>
        </div>
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              aria-label="Open navigation menu"
              aria-expanded={mobileMenuOpen}
            >
              <Menu className="h-4 w-4" />
              <span className="sr-only">Open navigation menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72">
            <SheetHeader>
              <SheetTitle>Navigation</SheetTitle>
              <SheetDescription className="sr-only">
                Mobile navigation drawer for ApplyFlow.
              </SheetDescription>
            </SheetHeader>
            <div className="mt-6">
              <NavLinks onSelect={() => setMobileMenuOpen(false)} />
              <Button asChild className="mt-6 w-full">
                <Link href="/jobs?new=1" onClick={() => setMobileMenuOpen(false)}>
                  New application
                </Link>
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/55 bg-white/85 px-2 pb-[calc(env(safe-area-inset-bottom)+0.35rem)] pt-2 backdrop-blur-2xl lg:hidden"
        aria-label="Mobile navigation"
      >
        <div className="mx-auto grid w-full max-w-xl grid-cols-5 gap-1">
          {primaryMobileLinks.map((link) => {
            const Icon = link.icon;
            const active = isLinkActive(pathname, link.href);

            // Handle the "More" menu
            if (link.href === "#more") {
              return (
                <DropdownMenu key={link.href}>
                  <DropdownMenuTrigger asChild>
                    <button
                      className={cn(
                        "flex flex-col items-center justify-center rounded-xl px-2 py-2 text-[11px] font-medium transition-all",
                        "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                      aria-label="More options"
                    >
                      <Icon className="mb-1 h-4 w-4" />
                      {link.label}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    {secondaryMobileLinks.map((secondaryLink) => {
                      const SecondaryIcon = secondaryLink.icon;
                      return (
                        <DropdownMenuItem key={secondaryLink.href} asChild>
                          <Link
                            href={secondaryLink.href}
                            className="flex gap-2 cursor-pointer"
                          >
                            <SecondaryIcon className="h-4 w-4" />
                            {secondaryLink.label}
                          </Link>
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            }

            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex flex-col items-center justify-center rounded-xl px-2 py-2 text-[11px] font-medium transition-all",
                  active
                    ? "bg-primary/10 text-primary ring-1 ring-primary/20"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="mb-1 h-4 w-4" />
                {link.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
