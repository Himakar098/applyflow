import { NextRequest, NextResponse } from "next/server";
import { getServerBetaAccessMode } from "@/lib/beta/server";

export function proxy(req: NextRequest) {
  const mode = getServerBetaAccessMode();
  const { pathname } = req.nextUrl;

  if (pathname === "/register" && mode === "waitlist") {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = "/waitlist";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/register", "/waitlist"],
};
