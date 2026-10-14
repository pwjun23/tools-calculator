import { hashPassword } from "@/lib/admin/session";

export const SESSION_COOKIE = "wtm_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 180; // 180일

// 아이디·비밀번호가 바뀌면 쿠키 값도 바뀌어 기존 세션이 모두 풀린다.
export async function createSessionCookieValue(): Promise<string> {
  const user = process.env.GIMPO_USER;
  const pass = process.env.GIMPO_PASS;
  if (!user || !pass) {
    throw new Error("GIMPO_USER/GIMPO_PASS 환경변수가 설정되어 있지 않습니다.");
  }
  return hashPassword(`whereToMove:${user}:${pass}`);
}

export async function isValidSessionCookie(
  value: string | undefined,
): Promise<boolean> {
  if (!value || !process.env.GIMPO_USER || !process.env.GIMPO_PASS) return false;
  return value === (await createSessionCookieValue());
}

export function isValidLogin(user: string, pass: string): boolean {
  const expectedUser = process.env.GIMPO_USER;
  const expectedPass = process.env.GIMPO_PASS;
  if (!expectedUser || !expectedPass) return false;
  return user === expectedUser && pass === expectedPass;
}
