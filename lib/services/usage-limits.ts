import { FieldValue, type Firestore } from "firebase-admin/firestore";

type LimitKind = "tailored_pack" | "bullet_rewrite" | "resume_extract" | "jd_parse" | "other";

export function getUtcDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function getLimitsFromEnv() {
  const toNumber = (val: string | undefined, fallback: number) => {
    const parsed = Number(val);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  };

  return {
    tailoredPackLimit: toNumber(process.env.DAILY_TAILORED_PACK_LIMIT, 10),
    bulletRewriteLimit: toNumber(process.env.DAILY_BULLET_REWRITE_LIMIT, 30),
    resumeExtractLimit: toNumber(process.env.DAILY_RESUME_EXTRACT_LIMIT, 10),
    jdParseLimit: toNumber(process.env.DAILY_JD_PARSE_LIMIT, 80),
    totalLimit: toNumber(process.env.DAILY_TOTAL_AI_LIMIT, 50),
  };
}

type UsageResult =
  | { allowed: true; dateKey: string; counts: Counts; limits: Limits }
  | {
    allowed: false;
    dateKey: string;
    counts: Counts;
    limits: Limits;
    limitType: "tailored_pack" | "bullet_rewrite" | "resume_extract" | "jd_parse" | "total";
  };

type Counts = {
  tailoredPackCount: number;
  bulletRewriteCount: number;
  resumeExtractCount: number;
  jdParseCount: number;
  totalCount: number;
};

type Limits = ReturnType<typeof getLimitsFromEnv>;

export async function checkAndIncrementUsage(params: {
  uid: string;
  kind: LimitKind;
  increment: number;
  adminDb: Firestore;
}): Promise<UsageResult> {
  const { uid, kind, increment, adminDb } = params;
  const limits = getLimitsFromEnv();
  const dateKey = getUtcDateKey();
  const usageRef = adminDb.collection("users").doc(uid).collection("usage").doc(dateKey);

  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(usageRef);
    const data = snap.data() || {};

    const counts: Counts = {
      tailoredPackCount: Number(data.tailoredPackCount ?? 0),
      bulletRewriteCount: Number(data.bulletRewriteCount ?? 0),
      resumeExtractCount: Number(data.resumeExtractCount ?? 0),
      jdParseCount: Number(data.jdParseCount ?? 0),
      totalCount: Number(data.totalCount ?? 0),
    };

    const next: Counts = { ...counts };
    if (kind === "tailored_pack") {
      next.tailoredPackCount += increment;
    }
    if (kind === "bullet_rewrite") {
      next.bulletRewriteCount += increment;
    }
    if (kind === "resume_extract") {
      next.resumeExtractCount += increment;
    }
    if (kind === "jd_parse") {
      next.jdParseCount += increment;
    }
    // All AI calls count toward total
    next.totalCount += increment;

    if (next.tailoredPackCount > limits.tailoredPackLimit) {
      return { allowed: false, limitType: "tailored_pack", dateKey, counts, limits };
    }
    if (next.bulletRewriteCount > limits.bulletRewriteLimit) {
      return { allowed: false, limitType: "bullet_rewrite", dateKey, counts, limits };
    }
    if (next.resumeExtractCount > limits.resumeExtractLimit) {
      return { allowed: false, limitType: "resume_extract", dateKey, counts, limits };
    }
    if (next.jdParseCount > limits.jdParseLimit) {
      return { allowed: false, limitType: "jd_parse", dateKey, counts, limits };
    }
    if (next.totalCount > limits.totalLimit) {
      return { allowed: false, limitType: "total", dateKey, counts, limits };
    }

    const updates: Record<string, unknown> = {
      date: dateKey,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (kind === "tailored_pack") {
      updates.tailoredPackCount = FieldValue.increment(increment);
    }
    if (kind === "bullet_rewrite") {
      updates.bulletRewriteCount = FieldValue.increment(increment);
    }
    if (kind === "resume_extract") {
      updates.resumeExtractCount = FieldValue.increment(increment);
    }
    if (kind === "jd_parse") {
      updates.jdParseCount = FieldValue.increment(increment);
    }
    updates.totalCount = FieldValue.increment(increment);

    tx.set(usageRef, updates, { merge: true });

    return { allowed: true, dateKey, counts: next, limits };
  });
}
