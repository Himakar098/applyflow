"use client";

import Link from "next/link";
import { Menu, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { getBetaPrimaryCta } from "@/lib/beta/config";
import { siteConfig } from "@/lib/site-config";

const navLinks = [
  { label: "Product", href: "/#benefits" },
  { label: "Pricing", href: "/pricing" },
  { label: "Resources", href: "/resources" },
  { label: "Extension", href: "/browser-extension" },
  { label: "About", href: "/about" },
];

export function MarketingNav() {
  const primaryCta = getBetaPrimaryCta();

  return (
    <header className="sticky top-0 z-40 border-b border-white/40 bg-white/70 backdrop-blur-2xl">
      <div className="container flex items-center justify-between py-4">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-primary via-primary to-emerald-500 text-white shadow-lg shadow-primary/30">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{siteConfig.name}</p>
            <p className="text-xs text-muted-foreground">{siteConfig.companyName}</p>
          </div>
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground lg:flex">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} className="transition hover:text-foreground">
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-3 lg:flex">
          <Button asChild>
            <Link href={primaryCta.href}>{primaryCta.label}</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/login">Login</Link>
          </Button>
        </div>
        <div className="flex items-center gap-2 lg:hidden">
          <Button asChild size="sm">
            <Link href={primaryCta.href}>{primaryCta.label}</Link>
          </Button>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon">
                <Menu className="h-4 w-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle>{siteConfig.name}</SheetTitle>
                <SheetDescription>{siteConfig.companyName}</SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <nav className="space-y-2 text-sm">
                  {navLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="block rounded-lg px-3 py-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  ))}
                </nav>
                <div className="space-y-2">
                  <Button asChild className="w-full">
                    <Link href={primaryCta.href}>{primaryCta.label}</Link>
                  </Button>
                  <Button asChild variant="outline" className="w-full">
                    <Link href="/login">Login</Link>
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  const footerColumns = [
    {
      title: "Product",
      links: [
        { label: "Overview", href: "/#benefits" },
        { label: "Core modules", href: "/#features" },
        { label: "Pricing", href: "/pricing" },
        { label: "Browser Extension", href: "/browser-extension" },
        { label: "Resources", href: "/resources" },
      ],
    },
    {
      title: "Company",
      links: [
        { label: "About", href: "/about" },
        { label: "Omnari Group", href: siteConfig.companyUrl },
        { label: "Product page", href: siteConfig.productOverviewUrl },
        { label: "Support", href: `mailto:${siteConfig.supportEmail}` },
      ],
    },
    {
      title: "Legal",
      links: [
        { label: "Privacy", href: "/privacy" },
        { label: "Terms", href: "/terms" },
        { label: "Cookies", href: "/cookies" },
        { label: "Support", href: `mailto:${siteConfig.supportEmail}` },
      ],
    },
    {
      title: "Access",
      links: [
        { label: "Login", href: "/login" },
        { label: "Create account", href: "/register" },
        { label: "Forgot password", href: "/forgot-password" },
      ],
    },
  ];

  return (
    <footer className="border-t border-white/40 bg-white/70 py-12 backdrop-blur-2xl">
      <div className="container space-y-10">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-primary via-primary to-emerald-500 text-white shadow-lg shadow-primary/30">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{siteConfig.name}</p>
              <p className="text-xs text-muted-foreground">{siteConfig.companyName}</p>
            </div>
          </div>
          <p className="max-w-xl text-sm text-muted-foreground">
            {siteConfig.name} is developed by {siteConfig.companyName}. It combines
            profile setup, matched roles, tailored materials, and application
            tracking in one workspace.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-4">
          {footerColumns.map((column) => (
            <div key={column.title} className="hidden space-y-3 lg:block">
              <p className="text-sm font-semibold text-foreground">{column.title}</p>
              <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                {column.links.map((link) => (
                  <Link key={link.label} href={link.href} className="transition hover:text-foreground">
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-3 lg:hidden">
          {footerColumns.map((column) => (
            <details key={column.title} className="rounded-2xl border border-white/50 bg-white/70 px-4 py-3">
              <summary className="cursor-pointer text-sm font-semibold text-foreground">
                {column.title}
              </summary>
              <div className="mt-3 flex flex-col gap-2 text-sm text-muted-foreground">
                {column.links.map((link) => (
                  <Link key={link.label} href={link.href} className="transition hover:text-foreground">
                    {link.label}
                  </Link>
                ))}
              </div>
            </details>
          ))}
        </div>

        <div className="flex flex-col gap-2 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} {siteConfig.companyName}. All rights reserved.</p>
          <p>
            Contact: <Link href={`mailto:${siteConfig.supportEmail}`} className="font-semibold text-primary">{siteConfig.supportEmail}</Link>
          </p>
        </div>
      </div>
    </footer>
  );
}

export function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      <MarketingNav />
      <main className="space-y-16 pb-20 md:space-y-20 md:pb-24">{children}</main>
      <MarketingFooter />
    </div>
  );
}
