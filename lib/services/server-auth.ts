import { adminAuth } from "@/lib/firebase/admin";

export async function requireUserId(idToken?: string | null): Promise<string> {
  if (!idToken) {
    throw new Error("No auth token provided.");
  }

  const decoded = await adminAuth.verifyIdToken(idToken);
  return decoded.uid;
}
