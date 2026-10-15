export const KAKAO_MEMO_URL = "https://kapi.kakao.com/v2/api/talk/memo/default/send";
export const LINK_URL = "https://tools.molespapa.com/whereToMove";

export function buildMemoTemplate(text: string, linkUrl: string): string {
  return JSON.stringify({
    object_type: "text",
    text,
    link: { web_url: linkUrl, mobile_web_url: linkUrl },
    button_title: "실거래 보기",
  });
}

/** 카카오톡 나에게 보내기. 실패하면 상태 코드와 응답 본문을 담아 throw. */
export async function sendKakaoMemo(accessToken: string, text: string, linkUrl: string, fetchFn: typeof fetch = fetch): Promise<void> {
  const res = await fetchFn(KAKAO_MEMO_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
    body: new URLSearchParams({ template_object: buildMemoTemplate(text, linkUrl) }).toString(),
  });
  if (!res.ok) throw new Error(`카카오톡 발송 실패 (${res.status}): ${(await res.text()).slice(0, 200)}`);
}
