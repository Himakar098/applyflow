export function getIdTokenFromRequest(req: Request): string | null {
  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.replace("Bearer ", "").trim();
  return token || null;
}
