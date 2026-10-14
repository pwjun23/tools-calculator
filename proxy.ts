import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isValidSessionCookie } from "@/lib/admin/session";

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/whereToMove")) {
    return checkBasicAuth(request);
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

// /whereToMove 는 아이디/비밀번호(Basic 인증)로 보호한다. (GIMPO_USER, GIMPO_PASS)
function checkBasicAuth(request: NextRequest) {
  const user = process.env.GIMPO_USER;
  const pass = process.env.GIMPO_PASS;
  if (!user || !pass) {
    return new NextResponse("인증 설정이 없습니다.", { status: 503 });
  }

  const header = request.headers.get("authorization") || "";
  if (header.startsWith("Basic ")) {
    try {
      const [u, ...rest] = atob(header.slice(6)).split(":");
      if (u === user && rest.join(":") === pass) return NextResponse.next();
    } catch {}
  }

  return new NextResponse("로그인이 필요합니다.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="whereToMove", charset="UTF-8"' },
  });
}

export const config = {
  matcher: ["/admin/:path*", "/whereToMove", "/whereToMove/:path*"],
};
