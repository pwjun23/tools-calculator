import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isValidSessionCookie } from "@/lib/admin/session";
import {
  SESSION_COOKIE as WTM_SESSION_COOKIE,
  isValidSessionCookie as isValidWtmSessionCookie,
} from "@/lib/whereToMove/session";

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

// /whereToMove 는 아이디/비밀번호(GIMPO_USER, GIMPO_PASS) 로그인 쿠키로 보호한다.
async function checkWhereToMove(request: NextRequest) {
  if (request.nextUrl.pathname === "/whereToMove/login") {
    return NextResponse.next();
  }

  const cookie = request.cookies.get(WTM_SESSION_COOKIE)?.value;
  if (await isValidWtmSessionCookie(cookie)) {
    return NextResponse.next();
  }

  return NextResponse.redirect(new URL("/whereToMove/login", request.url));
}

export const config = {
  matcher: ["/admin/:path*", "/whereToMove", "/whereToMove/:path*"],
};
