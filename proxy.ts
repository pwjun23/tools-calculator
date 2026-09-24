import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isValidSessionCookie } from "@/lib/admin/session";

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/admin/login") {
    return NextResponse.next();
  }

  const cookie = request.cookies.get("admin_session")?.value;
  if (await isValidSessionCookie(cookie)) {
    return NextResponse.next();
  }

  return NextResponse.redirect(new URL("/admin/login", request.url));
}

export const config = {
  matcher: ["/admin/:path*"],
};
