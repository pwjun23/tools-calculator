import { describe, expect, it, vi } from "vitest";
import { createPost, addSeoMeta, updatePost, schedulePost } from "../src/posts.ts";
import type { WpClient } from "../src/client.ts";
import type { ResolvedConfig } from "../src/types.ts";

const config: ResolvedConfig = {
  baseUrl: "https://molespapa.com/wp-json/wp/v2",
  username: "editor",
  appPassword: "x",
  defaultCategory: "부동산",
  defaultTags: ["계산기", "금융"],
};

// dryRun이면 실제 client.ts와 같은 불변 규칙을 지킨다: request()는 큐에 든 값과 무관하게
// 항상 { dryRun: true, ... } 를 돌려준다. dryRun=false일 때만 큐(responses)를 순서대로 소비한다.
function clientReturning(responses: unknown[], dryRun = false): WpClient {
  const queue = [...responses];
  const request = vi.fn(async (req: { method: string; path: string; body?: unknown }) => {
    if (dryRun) {
      return { dryRun: true, method: req.method, url: `https://molespapa.com/wp-json/wp/v2${req.path}`, body: req.body };
    }
    return queue.shift();
  });
  return { dryRun, request: request as never };
}

describe("createPost", () => {
  it("category/tags를 id로 바꿔 /posts에 POST하고, 기본 상태는 draft다", async () => {
    const client = clientReturning([
      [{ id: 9, name: "부동산" }], // category lookup
      [{ id: 1, name: "계산기" }], // tag lookup
      [{ id: 2, name: "금융" }], // tag lookup
      { id: 123, link: "https://molespapa.com/?p=123", status: "draft" },
    ]);

    const result = await createPost(client, config, {
      title: "글 제목",
      contentHtml: "<p>본문</p>",
    });

    expect(result).toEqual({ id: 123, url: "https://molespapa.com/?p=123", status: "draft" });
    expect((client.request as ReturnType<typeof vi.fn>).mock.calls[3][0]).toMatchObject({
      method: "POST",
      path: "/posts",
      body: {
        title: "글 제목",
        content: "<p>본문</p>",
        status: "draft",
        categories: [9],
        tags: [1, 2],
      },
    });
  });

  it("category/tags를 지정하지 않으면 config의 기본값을 쓴다", async () => {
    const client = clientReturning([
      [{ id: 9, name: "부동산" }],
      [{ id: 1, name: "계산기" }],
      [{ id: 2, name: "금융" }],
      { id: 1, link: "u", status: "draft" },
    ]);

    await createPost(client, config, { title: "t", contentHtml: "c" });

    const call = (client.request as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.path).toContain("categories?search=");
  });

  it("opts.publish가 true면 status: publish를 보낸다", async () => {
    const client = clientReturning([
      [{ id: 9, name: "부동산" }],
      [{ id: 1, name: "계산기" }],
      [{ id: 2, name: "금융" }],
      { id: 1, link: "u", status: "publish" },
    ]);

    await createPost(client, config, { title: "t", contentHtml: "c" }, { publish: true });

    const body = (client.request as ReturnType<typeof vi.fn>).mock.calls[3][0].body;
    expect(body.status).toBe("publish");
  });

  it("opts.publish가 없으면 입력에 status: publish가 있어도 draft로 낮춘다", async () => {
    const client = clientReturning([
      [{ id: 9, name: "부동산" }],
      [{ id: 1, name: "계산기" }],
      [{ id: 2, name: "금융" }],
      { id: 1, link: "u", status: "draft" },
    ]);

    await createPost(client, config, {
      title: "t",
      contentHtml: "c",
      status: "publish",
    });

    const body = (client.request as ReturnType<typeof vi.fn>).mock.calls[3][0].body;
    expect(body.status).toBe("draft");
  });

  it("seo가 있으면 meta에 야스트 필드를 담는다", async () => {
    const client = clientReturning([
      [{ id: 9, name: "부동산" }],
      [{ id: 1, name: "계산기" }],
      [{ id: 2, name: "금융" }],
      { id: 1, link: "u", status: "draft" },
    ]);

    await createPost(client, config, {
      title: "t",
      contentHtml: "c",
      seo: { focusKeyword: "전세", metaDescription: "전세 설명" },
    });

    const body = (client.request as ReturnType<typeof vi.fn>).mock.calls[3][0].body;
    expect(body.meta).toEqual({
      _yoast_wpseo_focuskw: "전세",
      _yoast_wpseo_metadesc: "전세 설명",
    });
  });

  it("dry-run이면 실제 id 0으로 미리보기 결과를 반환한다", async () => {
    const client = clientReturning([], true);

    const result = await createPost(client, config, { title: "t", contentHtml: "c" });

    expect(result).toEqual({ id: 0, url: "(dry-run)", status: "draft" });
  });
});

describe("updatePost", () => {
  it("바뀐 필드만 PATCH 본문에 담아 /posts/{id}에 보낸다", async () => {
    const client = clientReturning([
      { id: 123, link: "u", status: "draft", meta: {} },
    ]);

    await updatePost(client, config, 123, { title: "새 제목" });

    expect((client.request as ReturnType<typeof vi.fn>).mock.calls[0][0]).toEqual({
      method: "POST",
      path: "/posts/123",
      body: { title: "새 제목" },
    });
  });

  it("opts.publish 없이 status를 patch에 넣으면 draft로 강제한다", async () => {
    const client = clientReturning([{ id: 1, link: "u", status: "draft", meta: {} }]);

    await updatePost(client, config, 1, { status: "publish" });

    const body = (client.request as ReturnType<typeof vi.fn>).mock.calls[0][0].body;
    expect(body.status).toBe("draft");
  });

  it("dry-run이면 실제 요청 없이 미리보기 결과를 반환한다", async () => {
    const client = clientReturning([], true);

    const result = await updatePost(client, config, 5, { title: "t" });

    expect(result).toEqual({ id: 5, url: "(dry-run)", status: "(변경 없음)" });
  });
});

describe("addSeoMeta", () => {
  it("meta 필드로 얇게 위임하고, 응답에 값이 반영됐으면 경고가 없다", async () => {
    const client = clientReturning([
      {
        id: 123,
        link: "u",
        status: "publish",
        meta: { _yoast_wpseo_focuskw: "전세", _yoast_wpseo_metadesc: "설명" },
      },
    ]);

    const result = await addSeoMeta(client, config, 123, {
      focusKeyword: "전세",
      metaDescription: "설명",
    });

    expect(result.warning).toBeUndefined();
    const body = (client.request as ReturnType<typeof vi.fn>).mock.calls[0][0].body;
    expect(body.meta).toEqual({
      _yoast_wpseo_focuskw: "전세",
      _yoast_wpseo_metadesc: "설명",
    });
  });

  it("응답에 메타가 반영 안 되어 있으면 mu-plugin 설치를 안내하는 경고를 반환한다", async () => {
    const client = clientReturning([{ id: 123, link: "u", status: "publish", meta: {} }]);

    const result = await addSeoMeta(client, config, 123, {
      focusKeyword: "전세",
      metaDescription: "설명",
    });

    expect(result.warning).toMatch(/mu-plugin/);
  });

  it("dry-run이면 반영 여부를 확인하지 않고 경고 없이 미리보기 결과를 반환한다", async () => {
    const client = clientReturning([], true);

    const result = await addSeoMeta(client, config, 123, { focusKeyword: "전세" });

    expect(result.warning).toBeUndefined();
    expect(result.id).toBe(123);
  });
});

describe("schedulePost", () => {
  it("status: future와 date_gmt를 포함해 createPost와 같은 방식으로 등록한다", async () => {
    const client = clientReturning([
      [{ id: 9, name: "부동산" }],
      [{ id: 1, name: "계산기" }],
      [{ id: 2, name: "금융" }],
      { id: 1, link: "u", status: "future" },
    ]);

    const now = new Date("2026-09-01T00:00:00.000Z");
    await schedulePost(
      client,
      config,
      { title: "t", contentHtml: "c", publishAtKst: "2026-09-28 09:00" },
      { now },
    );

    const body = (client.request as ReturnType<typeof vi.fn>).mock.calls[3][0].body;
    expect(body.status).toBe("future");
    expect(body.date_gmt).toBe("2026-09-28T00:00:00");
  });

  it("과거 시각이면 요청 없이 에러를 던진다", async () => {
    const client = clientReturning([]);
    const now = new Date("2026-10-01T00:00:00.000Z");

    await expect(
      schedulePost(
        client,
        config,
        { title: "t", contentHtml: "c", publishAtKst: "2026-09-28 09:00" },
        { now },
      ),
    ).rejects.toThrow(/과거/);
    expect(client.request).not.toHaveBeenCalled();
  });
});
