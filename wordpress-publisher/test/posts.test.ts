import { describe, expect, it, vi } from "vitest";
import { createPost } from "../src/posts.ts";
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
