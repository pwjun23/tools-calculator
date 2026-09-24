export async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function createSessionCookieValue(): Promise<string> {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    throw new Error("ADMIN_PASSWORD 환경변수가 설정되어 있지 않습니다.");
  }
  return hashPassword(password);
}

export async function isValidSessionCookie(
  value: string | undefined,
): Promise<boolean> {
  if (!value || !process.env.ADMIN_PASSWORD) return false;
  return value === (await createSessionCookieValue());
}
