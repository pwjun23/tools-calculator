/** WTM_ALLOWED_KAKAO_IDS(쉼표 구분)에 있는 카카오 회원번호만 허용한다. */
export function isAllowedKakaoId(id: string, raw: string | undefined): boolean {
  if (!id || !raw) return false;
  return raw.split(",").map((s) => s.trim()).filter(Boolean).includes(id);
}
