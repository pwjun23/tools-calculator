import { describe, expect, it, vi } from "vitest";
import { bulkCreate, bulkUpdateMeta, parseBulkCreateRows, parseBulkMetaRows } from "./batch";
import type { WpClient } from "./client";
import type { ResolvedConfig } from "./types";

const config: ResolvedConfig = {
  baseUrl: "https://molespapa.com/wp-json/wp/v2",
  username: "e",
  appPassword: "p",
  defaultTags: [],
};

describe("parseBulkCreateRows", () => {
  it("JSON 배열을 그대로 읽는다", () => {
    const text = JSON.stringify([{ title: "t1", contentHtml: "<p>1</p>" }]);
    expect(parseBulkCreateRows(text, "json")).toEqual([{ title: "t1", contentHtml: "<p>1</p>" }]);
  });

  it("CSV는 content 컬럼에서 HTML을 직접 읽는다", () => {
    const csv = 'title,content,category,tags\n"글1","<p>본문1</p>",부동산,계산기;금융\n';
    expect(parseBulkCreateRows(csv, "csv")).toEqual([
      { title: "글1", contentHtml: "<p>본문1</p>", category: "부동산", tags: ["계산기", "금융"] },
    ]);
  });
});

describe("bulkCreate", () => {
  it("각 행마다 createPost를 호출하고 성공/실패를 리포트한다", async () => {
    const rows = [
      { title: "성공글", contentHtml: "<p>1</p>" },
      { title: "실패글", contentHtml: "<p>2</p>" },
    ];
    const request = vi
      .fn()
      .mockResolvedValueOnce({ id: 1, link: "u1", status: "draft" })
      .mockRejectedValueOnce(new Error("서버 오류"));
    const client = { request } as unknown as WpClient;

    const report = await bulkCreate(client, config, rows, {});

    expect(report.success).toBe(1);
    expect(report.failed).toBe(1);
    expect(report.items[1].status).toBe("error");
    expect(report.items[1].error).toBe("서버 오류");
  });
});

describe("parseBulkMetaRows", () => {
  it("JSON 배열을 그대로 읽는다", () => {
    const text = JSON.stringify([{ id: 5, metaDescription: "설명" }]);
    expect(parseBulkMetaRows(text, "json")).toEqual([{ id: 5, metaDescription: "설명" }]);
  });

  it("CSV에서 id/focus_keyword/meta_description을 읽는다", () => {
    const csv = "id,focus_keyword,meta_description\n123,전세,전세 설명\n";
    expect(parseBulkMetaRows(csv, "csv")).toEqual([
      { id: 123, focusKeyword: "전세", metaDescription: "전세 설명" },
    ]);
  });
});

describe("bulkUpdateMeta", () => {
  it("각 행마다 addSeoMeta를 호출하고 실패해도 계속한다", async () => {
    const rows = [
      { id: 1, metaDescription: "성공" },
      { id: 2, metaDescription: "실패" },
    ];
    const request = vi
      .fn()
      .mockResolvedValueOnce({ id: 1, link: "u", status: "publish", meta: { _yoast_wpseo_metadesc: "성공" } })
      .mockRejectedValueOnce(new Error("찾을 수 없음"));
    const client = { request } as unknown as WpClient;

    const report = await bulkUpdateMeta(client, config, rows);

    expect(report.success).toBe(1);
    expect(report.failed).toBe(1);
  });
});
