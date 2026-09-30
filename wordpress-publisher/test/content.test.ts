import { describe, expect, it, vi } from "vitest";
import { buildFinalContentHtml, validateImages } from "../src/content.ts";
import type { WpClient } from "../src/client.ts";

const dryRunClient: WpClient = { dryRun: true, request: vi.fn() as never };

describe("validateImages", () => {
  it("이미지가 없으면 통과한다", () => {
    expect(() => validateImages(undefined)).not.toThrow();
  });

  it("alt 텍스트가 없는 이미지가 있으면 인덱스와 url을 포함한 에러를 던진다", () => {
    expect(() =>
      validateImages([{ url: "https://x.com/a.png", alt: "" }]),
    ).toThrow(/images\[0\].*https:\/\/x\.com\/a\.png/);
  });
});

describe("buildFinalContentHtml", () => {
  it("추가 옵션이 없으면 본문을 그대로 돌려준다", async () => {
    const html = await buildFinalContentHtml(dryRunClient, { contentHtml: "<p>본문</p>" });
    expect(html).toBe("<p>본문</p>");
  });

  it("images를 본문 뒤에 alt와 함께 붙인다", async () => {
    const html = await buildFinalContentHtml(dryRunClient, {
      contentHtml: "<p>본문</p>",
      images: [{ url: "https://x.com/a.png", alt: "설명" }],
    });
    expect(html).toContain('<img src="https://x.com/a.png" alt="설명"');
  });

  it("caption이 있으면 figure/figcaption으로 감싼다", async () => {
    const html = await buildFinalContentHtml(dryRunClient, {
      contentHtml: "<p>본문</p>",
      images: [{ url: "https://x.com/a.png", alt: "설명", caption: "사진 설명" }],
    });
    expect(html).toContain("<figcaption>사진 설명</figcaption>");
  });

  it("alt 없는 이미지가 있으면 에러를 던진다", async () => {
    await expect(
      buildFinalContentHtml(dryRunClient, {
        contentHtml: "<p>본문</p>",
        images: [{ url: "https://x.com/a.png", alt: "" }],
      }),
    ).rejects.toThrow(/alt/);
  });

  it("{{image}} 마커가 있으면 그 자리에 이미지를 끼워넣는다", async () => {
    const html = await buildFinalContentHtml(dryRunClient, {
      contentHtml: "<p>첫 문단</p>{{image}}<p>둘째 문단</p>",
      images: [{ url: "https://x.com/a.png", alt: "설명" }],
    });
    expect(html).toBe(
      '<p>첫 문단</p><img src="https://x.com/a.png" alt="설명" loading="lazy" /><p>둘째 문단</p>',
    );
  });

  it("마커가 여러 개면 순서대로 채운다", async () => {
    const html = await buildFinalContentHtml(dryRunClient, {
      contentHtml: "A{{image}}B{{image}}C",
      images: [
        { url: "https://x.com/1.png", alt: "1" },
        { url: "https://x.com/2.png", alt: "2" },
      ],
    });
    expect(html).toBe(
      'A<img src="https://x.com/1.png" alt="1" loading="lazy" />B<img src="https://x.com/2.png" alt="2" loading="lazy" />C',
    );
  });

  it("이미지가 마커보다 많으면 남는 이미지를 본문 끝에 붙인다", async () => {
    const html = await buildFinalContentHtml(dryRunClient, {
      contentHtml: "A{{image}}B",
      images: [
        { url: "https://x.com/1.png", alt: "1" },
        { url: "https://x.com/2.png", alt: "2" },
      ],
    });
    expect(html).toBe(
      'A<img src="https://x.com/1.png" alt="1" loading="lazy" />B\n\n<img src="https://x.com/2.png" alt="2" loading="lazy" />',
    );
  });

  it("마커가 이미지보다 많으면 에러를 던진다", async () => {
    await expect(
      buildFinalContentHtml(dryRunClient, {
        contentHtml: "{{image}}{{image}}",
        images: [{ url: "https://x.com/1.png", alt: "1" }],
      }),
    ).rejects.toThrow(/마커\(2개\).*images 배열\(1개\)/);
  });

  it("calculator 슬러그가 있으면 해당 계산기 링크를 CTA로 붙인다", async () => {
    const html = await buildFinalContentHtml(dryRunClient, {
      contentHtml: "<p>본문</p>",
      calculator: "salary",
    });
    expect(html).toContain("https://tools.molespapa.com/salary");
    expect(html).toContain("연봉 계산기");
  });

  it("모르는 calculator 슬러그면 에러를 던진다", async () => {
    await expect(
      buildFinalContentHtml(dryRunClient, { contentHtml: "<p>본문</p>", calculator: "없는거" }),
    ).rejects.toThrow(/없는거/);
  });

  it("{{calculator}} 마커가 있으면 그 자리에 CTA를 끼워넣고 끝에는 중복해서 붙이지 않는다", async () => {
    const html = await buildFinalContentHtml(dryRunClient, {
      contentHtml: "<p>앞 문단</p>{{calculator}}<p>뒷 문단</p>",
      calculator: "salary",
    });
    expect(html).toBe(
      '<p>앞 문단</p><p><strong>연봉 계산기</strong>로 직접 계산해보세요 → <a href="https://tools.molespapa.com/salary" target="_blank" rel="noopener">https://tools.molespapa.com/salary</a></p><p>뒷 문단</p>',
    );
  });

  it("{{calculator}} 마커는 있는데 calculator 필드가 없으면 에러를 던진다", async () => {
    await expect(
      buildFinalContentHtml(dryRunClient, { contentHtml: "<p>{{calculator}}</p>" }),
    ).rejects.toThrow(/\{\{calculator\}\}/);
  });

  it("internalLinks를 직접 주면 그 목록으로 관련 글 섹션을 만들고 검색하지 않는다", async () => {
    const request = vi.fn();
    const client: WpClient = { dryRun: false, request: request as never };

    const html = await buildFinalContentHtml(client, {
      contentHtml: "<p>본문</p>",
      internalLinks: [{ url: "https://molespapa.com/?p=1", anchorText: "관련 글 1" }],
    });

    expect(html).toContain("함께 보면 좋은 글");
    expect(html).toContain("관련 글 1");
    expect(request).not.toHaveBeenCalled();
  });

  it("internalLinks 없이 seo.relatedKeywords만 있으면 검색해서 채운다", async () => {
    const request = vi.fn().mockResolvedValueOnce([
      { id: 9, link: "https://molespapa.com/?p=9", title: "검색된 글" },
    ]);
    const client: WpClient = { dryRun: false, request: request as never };

    const html = await buildFinalContentHtml(client, {
      contentHtml: "<p>본문</p>",
      seo: { relatedKeywords: ["전세"] },
    });

    expect(request).toHaveBeenCalledOnce();
    expect(html).toContain("검색된 글");
  });
});
