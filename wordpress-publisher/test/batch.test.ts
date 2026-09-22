import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bulkCreate, parseBulkCreateRows, bulkUpdateMeta, parseBulkMetaRows } from "../src/batch.ts";
import type { WpClient } from "../src/client.ts";
import type { ResolvedConfig } from "../src/types.ts";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "wp-batch-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const config: ResolvedConfig = {
  baseUrl: "https://molespapa.com/wp-json/wp/v2",
  username: "e",
  appPassword: "p",
  defaultTags: [],
};

describe("parseBulkCreateRows", () => {
  it("JSON 배열을 그대로 읽는다", () => {
    const file = join(dir, "posts.json");
    writeFileSync(file, JSON.stringify([{ title: "t1", contentHtml: "<p>1</p>" }]), "utf8");

    expect(parseBulkCreateRows(file)).toEqual([{ title: "t1", contentHtml: "<p>1</p>" }]);
  });

  it("CSV의 content_file 경로를 CSV 파일 기준 상대경로로 읽는다", () => {
    writeFileSync(join(dir, "post1.html"), "<p>본문1</p>", "utf8");
    const csv = join(dir, "posts.csv");
    writeFileSync(
      csv,
      "title,content_file,category,tags\n" + '"글1",post1.html,부동산,계산기;금융\n',
      "utf8",
    );

    expect(parseBulkCreateRows(csv)).toEqual([
      {
        title: "글1",
        contentHtml: "<p>본문1</p>",
        category: "부동산",
        tags: ["계산기", "금융"],
      },
    ]);
  });
});

describe("bulkCreate", () => {
  it("각 행마다 createPost를 호출하고 성공/실패를 리포트한다", async () => {
    const file = join(dir, "posts.json");
    writeFileSync(
      file,
      JSON.stringify([
        { title: "성공글", contentHtml: "<p>1</p>" },
        { title: "실패글", contentHtml: "<p>2</p>" },
      ]),
      "utf8",
    );

    const request = vi
      .fn()
      .mockResolvedValueOnce({ id: 1, link: "u1", status: "draft" })
      .mockRejectedValueOnce(new Error("서버 오류"));
    const client: WpClient = { dryRun: false, request: request as never };

    const report = await bulkCreate(client, config, file, {});

    expect(report.success).toBe(1);
    expect(report.failed).toBe(1);
    expect(report.items[1].status).toBe("error");
    expect(report.items[1].error).toBe("서버 오류");
  });
});

describe("parseBulkMetaRows", () => {
  it("CSV에서 id/focus_keyword/meta_description을 읽는다", () => {
    const csv = join(dir, "meta.csv");
    writeFileSync(csv, "id,focus_keyword,meta_description\n123,전세,전세 설명\n", "utf8");

    expect(parseBulkMetaRows(csv)).toEqual([
      { id: 123, focusKeyword: "전세", metaDescription: "전세 설명" },
    ]);
  });

  it("JSON 배열을 그대로 읽는다", () => {
    const file = join(dir, "meta.json");
    writeFileSync(file, JSON.stringify([{ id: 5, metaDescription: "설명" }]), "utf8");

    expect(parseBulkMetaRows(file)).toEqual([{ id: 5, metaDescription: "설명" }]);
  });
});

describe("bulkUpdateMeta", () => {
  it("각 행마다 addSeoMeta를 호출하고 실패해도 계속한다", async () => {
    const file = join(dir, "meta.json");
    writeFileSync(
      file,
      JSON.stringify([
        { id: 1, metaDescription: "성공" },
        { id: 2, metaDescription: "실패" },
      ]),
      "utf8",
    );

    const request = vi
      .fn()
      .mockResolvedValueOnce({ id: 1, link: "u", status: "publish", meta: { _yoast_wpseo_metadesc: "성공" } })
      .mockRejectedValueOnce(new Error("찾을 수 없음"));
    const client: WpClient = { dryRun: false, request: request as never };

    const report = await bulkUpdateMeta(client, config, file);

    expect(report.success).toBe(1);
    expect(report.failed).toBe(1);
  });
});
