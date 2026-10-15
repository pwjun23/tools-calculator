/** Vercel Cron 은 Authorization: Bearer ${CRON_SECRET} 헤더를 붙여 호출한다. */
export function isCronAuthorized(authHeader: string | null, secret: string | undefined): boolean {
  if (!secret) return false;
  return authHeader === `Bearer ${secret}`;
}
