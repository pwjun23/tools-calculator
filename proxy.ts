import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { isValidSessionCookie } from "@/lib/admin/session";

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/whereToMove")) {
    return checkWhereToMove(request);
  }

  if (request.nextUrl.pathname === "/admin/login") {
    return NextResponse.next();
  }

  const cookie = request.cookies.get("admin_session")?.value;
  if (await isValidSessionCookie(cookie)) {
    return NextResponse.next();
  }

  return NextResponse.redirect(new URL("/admin/login", request.url));
}

// /whereToMove 는 카카오 로그인(Better Auth) 세션 쿠키가 있어야 들어간다. 세션 검증은 페이지에서 한다.
function checkWhereToMove(request: NextRequest) {
  if (request.nextUrl.pathname === "/whereToMove/login") return NextResponse.next();
  if (getSessionCookie(request)) return NextResponse.next();
  return NextResponse.redirect(new URL("/whereToMove/login", request.url));
}

export const config = {
  matcher: ["/admin/:path*", "/whereToMove", "/whereToMove/:path*"],
};
