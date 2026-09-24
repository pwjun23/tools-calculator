import { describe, expect, it, vi } from "vitest";
import {
  addSeoMeta,
  createPost,
  formatDateGmtAsKst,
  kstToUtc,
  schedulePost,
  toWpDateGmt,
  updatePost,
} from "./posts";
import type { WpClient } from "./client";
import type { ResolvedConfig } from "./types";

describe("kstToUtc", () => {
  it("KST 오전 9시는 UTC 0시다", () => {
    const utc = kstToUtc("2026-09-28 09:00", new Date("2026-09-01T00:00:00.000Z"));
    expect(utc.toISOString()).toBe("2026-09-28T00:00:00.000Z");
  });

  it("형식이 잘못되면 에러를 던진다", () => {
    expect(() => kstToUtc("2026/09/28 09:00")).toThrow(/형식/);
  });

  it("과거 시각이면 에러를 던진다", () => {
    const now = new Date("2026-09-28T00:00:00.000Z");
    expect(() => kstToUtc("2026-09-28 08:00", now)).toThrow(/과거/);
  });
});

describe("toWpDateGmt", () => {
  it("초 단위, Z 없는 형식으로 만든다", () => {
    expect(toWpDateGmt(new Date("2026-09-28T00:00:00.000Z"))).toBe("2026-09-28T00:00:00");
  });
});

describe("formatDateGmtAsKst", () => {
  it("Z 없는 WordPress date_gmt를 한국시간 문자열로 바꾼다", () => {
    expect(formatDateGmtAsKst("2026-09-24T16:25:00")).toBe("2026-09-25 01:25");
  });

  it("자정을 넘어 날짜가 바뀌는 경우도 처리한다", () => {
    expect(formatDateGmtAsKst("2026-09-28T15:00:00")).toBe("2026-09-29 00:00");
  });
});

function clientReturning(responses: unknown[]): WpClient {
  const queue = [...responses];
  const request = vi.fn(async () => queue.shift());
  return { request: request as never };
}

const config: ResolvedConfig = {
  baseUrl: "https://molespapa.com/wp-json/wp/v2",
  username: "editor",
  appPassword: "x",
  defaultCategory: "부동산",
  defaultTags: ["계산기", "금융"],
};

describe("createPost", () => {
  it("category/tags를 id로 바꿔 /posts에 POST하고, 기본 상태는 draft다", async () => {
    const client = clientReturning([
      [{ id: 9, name: "부동산" }],
      [{ id: 1, name: "계산기" }],
      [{ id: 2, name: "금융" }],
      { id: 123, link: "https://molespapa.com/?p=123", status: "draft" },
    ]);

    const result = await createPost(client, config, { title: "글 제목", contentHtml: "<p>본문</p>" });

    expect(result).toEqual({ id: 123, url: "https://molespapa.com/?p=123", status: "draft" });
    expect((client.request as ReturnType<typeof vi.fn>).mock.calls[3][0]).toMatchObject({
      method: "POST",
      path: "/posts",
      body: { title: "글 제목", content: "<p>본문</p>", status: "draft", categories: [9], tags: [1, 2] },
    });
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

    await createPost(client, config, { title: "t", contentHtml: "c", status: "publish" });

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
    expect(body.meta).toEqual({ _yoast_wpseo_focuskw: "전세", _yoast_wpseo_metadesc: "전세 설명" });
  });
});

describe("updatePost", () => {
  it("바뀐 필드만 PATCH 본문에 담아 /posts/{id}에 보낸다", async () => {
    const client = clientReturning([{ id: 123, link: "u", status: "draft", meta: {} }]);

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
  });

  it("응답에 메타가 반영 안 되어 있으면 mu-plugin 설치를 안내하는 경고를 반환한다", async () => {
    const client = clientReturning([{ id: 123, link: "u", status: "publish", meta: {} }]);

    const result = await addSeoMeta(client, config, 123, {
      focusKeyword: "전세",
      metaDescription: "설명",
    });

    expect(result.warning).toMatch(/mu-plugin/);
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
