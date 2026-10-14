"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  createSessionCookieValue,
  isValidLogin,
} from "@/lib/whereToMove/session";

export async function login(formData: FormData): Promise<{ error?: string }> {
  const user = String(formData.get("user") ?? "");
  const pass = String(formData.get("password") ?? "");

  if (!isValidLogin(user, pass)) {
    return { error: "아이디 또는 비밀번호가 올바르지 않습니다." };
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, await createSessionCookieValue(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // 카카오톡 링크(다른 사이트)에서 들어올 때도 쿠키가 실리도록 lax 를 쓴다.
    sameSite: "lax",
    path: "/whereToMove",
    maxAge: SESSION_MAX_AGE,
  });

  redirect("/whereToMove");
}
