#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

function loadDotEnvFile(fileName) {
  const filePath = path.resolve(process.cwd(), fileName);
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (!key || key in process.env) continue;

    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadDotEnvFile(".env");
loadDotEnvFile(".env.local");

const checks = [];

function addCheck(name, ok, detail, severity = "error") {
  checks.push({ name, ok, detail, severity });
}

function asBool(value) {
  return ["1", "true", "yes", "on"].includes(String(value ?? "").toLowerCase());
}

const env = process.env;

addCheck(
  "NEXT_PUBLIC_SITE_URL",
  /^https:\/\/[^/]+/.test(env.NEXT_PUBLIC_SITE_URL || ""),
  `set a public https URL, got ${env.NEXT_PUBLIC_SITE_URL || "<empty>"}`,
);
addCheck(
  "NEXT_PUBLIC_SUPPORT_EMAIL",
  env.NEXT_PUBLIC_SUPPORT_EMAIL === "support@omnari.world",
  `expected support@omnari.world, got ${env.NEXT_PUBLIC_SUPPORT_EMAIL || "<empty>"}`,
);
addCheck(
  "NEXT_PUBLIC_PUBLIC_BETA",
  !asBool(env.NEXT_PUBLIC_PUBLIC_BETA),
  `expected false-like value for public release, got ${env.NEXT_PUBLIC_PUBLIC_BETA || "<empty>"}`,
  "warn",
);

const mode = env.BETA_ACCESS_MODE || env.NEXT_PUBLIC_BETA_ACCESS_MODE || "open";
const validMode = ["open", "waitlist", "invite"].includes(mode);
addCheck("BETA_ACCESS_MODE", validMode, `expected open|waitlist|invite, got ${mode}`);
addCheck(
  "NEXT_PUBLIC_BETA_ACCESS_MODE (explicit)",
  Boolean((env.NEXT_PUBLIC_BETA_ACCESS_MODE || "").trim()),
  `set explicit value open|waitlist|invite, got ${env.NEXT_PUBLIC_BETA_ACCESS_MODE || "<empty>"}`,
);
addCheck(
  "BETA_ACCESS_MODE (explicit)",
  Boolean((env.BETA_ACCESS_MODE || "").trim()),
  `set explicit value open|waitlist|invite, got ${env.BETA_ACCESS_MODE || "<empty>"}`,
);
addCheck(
  "BETA mode parity",
  env.BETA_ACCESS_MODE === env.NEXT_PUBLIC_BETA_ACCESS_MODE,
  `BETA_ACCESS_MODE=${env.BETA_ACCESS_MODE || "<empty>"} NEXT_PUBLIC_BETA_ACCESS_MODE=${env.NEXT_PUBLIC_BETA_ACCESS_MODE || "<empty>"}`,
);
if (mode === "invite") {
  addCheck(
    "BETA_INVITE_CODES",
    Boolean((env.BETA_INVITE_CODES || "").trim()),
    "required when invite mode is enabled",
  );
}

addCheck(
  "Firebase Admin credentials",
  Boolean(
    env.FIREBASE_ADMIN_CREDENTIAL ||
      env.FIREBASE_ADMIN_CREDENTIALS ||
      (env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY),
  ),
  "set FIREBASE_ADMIN_CREDENTIAL (recommended) or FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY",
);
addCheck(
  "Firebase client vars",
  Boolean(
    env.NEXT_PUBLIC_FIREBASE_API_KEY &&
      env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN &&
      env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
      env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET &&
      env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID &&
      env.NEXT_PUBLIC_FIREBASE_APP_ID,
  ),
  "required NEXT_PUBLIC_FIREBASE_* variables must be set",
);

addCheck(
  "SENTRY_DSN",
  Boolean((env.SENTRY_DSN || "").trim()),
  "recommended for production error capture",
  "warn",
);
addCheck(
  "NEXT_PUBLIC_SENTRY_DSN",
  Boolean((env.NEXT_PUBLIC_SENTRY_DSN || "").trim()),
  "recommended for client-side error capture",
  "warn",
);
addCheck(
  "HEALTHCHECK_SECRET",
  Boolean((env.HEALTHCHECK_SECRET || "").trim()),
  "recommended for protected deep health checks",
  "warn",
);

console.log("ApplyFlow public-readiness check");
console.log("--------------------------------");
for (const check of checks) {
  const prefix = check.ok ? "PASS" : check.severity === "warn" ? "WARN" : "FAIL";
  console.log(`${prefix}  ${check.name} :: ${check.detail}`);
}

const hasHardFail = checks.some((check) => !check.ok && check.severity !== "warn");
if (hasHardFail) {
  process.exit(1);
}

console.log("All required launch checks passed.");
