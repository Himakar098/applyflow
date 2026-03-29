import { adminAuth } from "@/lib/firebase/admin";
import { getServerBetaAccessMode } from "@/lib/beta/server";

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

    const requireApprovedUsers = ["1", "true", "yes", "on"].includes(
      (process.env.BETA_REQUIRE_APPROVED_USERS ?? "").toLowerCase(),
    );
    if (requireApprovedUsers && getServerBetaAccessMode() !== "open") {
      const hasAccess = Boolean((decoded as { betaApproved?: boolean }).betaApproved);
      if (!hasAccess) {
        throw new HttpError(403, "Beta access is not approved for this account");
      }
    }

    return { uid: decoded.uid, token, decoded };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(401, "Invalid or expired token");
  }
}
