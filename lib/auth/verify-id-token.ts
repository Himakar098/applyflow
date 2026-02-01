import { adminAuth } from "@/lib/firebase/admin";

export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function verifyIdToken(req: Request) {
  const authHeader =
    req.headers.get("authorization") ?? req.headers.get("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    throw new HttpError(401, "Missing Authorization header");
  }

  const token = authHeader.replace("Bearer", "").trim();
  if (!token) {
    throw new HttpError(401, "Invalid Authorization header");
  }

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return { uid: decoded.uid, token, decoded };
  } catch {
    throw new HttpError(401, "Invalid or expired token");
  }
}
