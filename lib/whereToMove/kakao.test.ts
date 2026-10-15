import { describe, expect, it } from "vitest";
import { buildMemoTemplate, sendKakaoMemo } from "./kakao";

describe("buildMemoTemplate", () => {
  it("텍스트 템플릿과 버튼", () => {
    expect(JSON.parse(buildMemoTemplate("안녕", "https://x.test/a"))).toEqual({
      object_type: "text", text: "안녕", link: { web_url: "https://x.test/a", mobile_web_url: "https://x.test/a" }, button_title: "실거래 보기",
    });
  });
});

describe("sendKakaoMemo", () => {
  it("Bearer 토큰과 template_object로 보낸다", async () => {
    const seen: { url: string; init: RequestInit }[] = [];
    const fake = (async (url: string, init: RequestInit) => { seen.push({ url, init }); return new Response('{"result_code":0}', { status: 200 }); }) as unknown as typeof fetch;
    await sendKakaoMemo("tok", "msg", "https://x.test", fake);
    expect(seen[0].url).toBe("https://kapi.kakao.com/v2/api/talk/memo/default/send");
    expect((seen[0].init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
    expect(String(seen[0].init.body)).toContain("template_object=");
  });

  it("동의 거부(403) 같은 실패는 상태 코드를 담아 throw", async () => {
    const fake = (async () => new Response('{"code":-402,"msg":"insufficient scopes"}', { status: 403 })) as unknown as typeof fetch;
    await expect(sendKakaoMemo("tok", "msg", "https://x.test", fake)).rejects.toThrow(/403/);
  });
});
