import { describe, expect, it, vi } from "vitest";
import { createClient, WpApiError } from "../src/client.ts";

function fakeFetch(status: number, body: unknown) {
  return vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  })) as unknown as typeof fetch;
}

describe("createClient", () => {
  it("Authorization 헤더를 Basic base64(username:password)로 붙인다", async () => {
    const fetchImpl = fakeFetch(200, { id: 1 });
    const client = createClient({
      baseUrl: "https://molespapa.com/wp-json/wp/v2",
      username: "editor",
      appPassword: "abcd efgh",
      fetchImpl,
    });

    await client.request({ method: "GET", path: "/posts/1" });

    const [, init] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0];
    const expected = "Basic " + Buffer.from("editor:abcd efgh").toString("base64");
    expect((init.headers as Record<string, string>).Authorization).toBe(expected);
  });

  it("실패 응답은 WpApiError로 던진다", async () => {
    const client = createClient({
      baseUrl: "https://molespapa.com/wp-json/wp/v2",
      username: "editor",
      appPassword: "x",
      fetchImpl: fakeFetch(403, { code: "rest_forbidden", message: "권한 없음" }),
    });

    await expect(
      client.request({ method: "POST", path: "/posts", body: { title: "t" } }),
    ).rejects.toMatchObject({ status: 403, code: "rest_forbidden" });
  });

  it("dryRun이면 fetch를 호출하지 않고 요청 내용만 반환한다", async () => {
    const fetchImpl = vi.fn();
    const client = createClient({
      baseUrl: "https://molespapa.com/wp-json/wp/v2",
      username: "editor",
      appPassword: "x",
      dryRun: true,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const result = await client.request({
      method: "POST",
      path: "/posts",
      body: { title: "t" },
    });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result).toEqual({
      dryRun: true,
      method: "POST",
      url: "https://molespapa.com/wp-json/wp/v2/posts",
      body: { title: "t" },
    });
    expect(client.dryRun).toBe(true);
  });

  it("에러 메시지에 비밀번호가 절대 포함되지 않는다", async () => {
    const client = createClient({
      baseUrl: "https://molespapa.com/wp-json/wp/v2",
      username: "editor",
      appPassword: "super-secret-password",
      fetchImpl: fakeFetch(500, { message: "서버 오류" }),
    });

    try {
      await client.request({ method: "GET", path: "/posts/1" });
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(WpApiError);
      expect((e as Error).message).not.toContain("super-secret-password");
    }
  });
});
