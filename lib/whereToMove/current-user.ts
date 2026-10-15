import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";

/** 로그인 사용자. 없으면 로그인 화면으로 보낸다. */
export async function requireUser(): Promise<{ id: string; name: string }> {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) redirect("/whereToMove/login");
  return { id: s.user.id, name: s.user.name };
}
