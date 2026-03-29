"use client";

import Link from "next/link";
import { motion } from "framer-motion";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { betaConfig, getBetaPrimaryCta } from "@/lib/beta/config";

const easeOut = [0.16, 1, 0.3, 1] as const;

const container = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: { staggerChildren: 0.12, duration: 0.45, ease: easeOut },
  },
};

const item = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: easeOut } },
};

export function LandingHero() {
  const primary = getBetaPrimaryCta();

  return (
    <section className="relative overflow-hidden pb-16 pt-16">
      <div className="absolute -top-36 left-1/2 h-[360px] w-[360px] -translate-x-1/2 rounded-full bg-primary/15 blur-[120px]" />
      <div className="absolute right-[-140px] top-12 h-[280px] w-[280px] rounded-full bg-emerald-400/20 blur-[120px]" />
      <div className="absolute bottom-[-140px] left-[-140px] h-[280px] w-[280px] rounded-full bg-accent/30 blur-[120px]" />

      <div className="container relative z-10">
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="mx-auto max-w-3xl space-y-6 text-center"
        >
          <motion.div variants={item}>
            <Badge className="rounded-full" variant="secondary">
              {betaConfig.enabled ? betaConfig.label : "ApplyFlow"}
            </Badge>
          </motion.div>
          <motion.h1
            variants={item}
            className="text-4xl font-semibold leading-tight text-foreground sm:text-5xl lg:text-6xl"
          >
            One workspace for your entire job search.
          </motion.h1>
          <motion.p variants={item} className="text-base text-muted-foreground sm:text-lg">
            Import your resume, get matched roles, generate tailored application content,
            and track every application in one place.
          </motion.p>
          <motion.div variants={item} className="flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link href={primary.href}>{primary.label}</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/login">Login</Link>
            </Button>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
