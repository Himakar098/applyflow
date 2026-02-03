import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

type ServiceAccountConfig = {
  projectId?: string;
  clientEmail?: string;
  privateKey?: string;
  storageBucket?: string;
};

function normalizeBucketName(value?: string) {
  if (!value) return undefined;
  if (value.includes(".firebasestorage.app")) {
    return value.replace(".firebasestorage.app", ".appspot.com");
  }
  return value;
}

function parseAdminCredential(): ServiceAccountConfig | null {
  // Prefer singular; keep plural as backwards-compatible fallback
  const raw =
    process.env.FIREBASE_ADMIN_CREDENTIAL ??
    process.env.FIREBASE_ADMIN_CREDENTIALS;
  if (!raw) return null;

  try {
    const json =
      raw.trim().startsWith("{")
        ? raw
        : Buffer.from(raw, "base64").toString("utf-8");
    const parsed = JSON.parse(json);
    return {
      projectId: parsed.project_id,
      clientEmail: parsed.client_email,
      privateKey: parsed.private_key?.replace(/\\n/g, "\n"),
      storageBucket: parsed.storage_bucket ?? parsed.storageBucket,
    };
  } catch {
    return null;
  }
}

const parsedFromJson = parseAdminCredential();

const projectId =
  parsedFromJson?.projectId ?? process.env.FIREBASE_PROJECT_ID ?? undefined;
const clientEmail =
  parsedFromJson?.clientEmail ?? process.env.FIREBASE_CLIENT_EMAIL ?? undefined;
const privateKey =
  parsedFromJson?.privateKey ??
  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const storageBucket =
  parsedFromJson?.storageBucket ?? process.env.FIREBASE_STORAGE_BUCKET;

const adminBucketName = normalizeBucketName(storageBucket);

const adminApp =
  getApps().length === 0
    ? initializeApp({
        credential:
          projectId && clientEmail && privateKey
            ? cert({
                projectId,
                clientEmail,
                privateKey,
              })
            : undefined,
        storageBucket: adminBucketName,
      })
    : getApps()[0];

export const adminDb = getFirestore(adminApp);
export const adminAuth = getAuth(adminApp);
export const adminStorage = getStorage(adminApp);
export const adminStorageBucketName = adminBucketName;
