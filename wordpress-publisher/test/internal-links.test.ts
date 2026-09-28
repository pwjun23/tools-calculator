import { describe, expect, it, vi } from "vitest";
import { findRelatedPosts } from "../src/internal-links.ts";
import type { WpClient } from "../src/client.ts";

describe("findRelatedPosts", () => {
  it("dry-run이면 검색하지 않고 빈 배열을 돌려준다", async () => {
    const request = vi.fn();
    const client: WpClient = { dryRun: true, request: request as never };

    const result = await findRelatedPosts(client, ["전세"]);

    expect(result).toEqual([]);
    expect(request).not.toHaveBeenCalled();
  });

  it("키워드가 없으면 검색하지 않는다", async () => {
    const request = vi.fn();
    const client: WpClient = { dryRun: false, request: request as never };

    const result = await findRelatedPosts(client, []);

    expect(result).toEqual([]);
    expect(request).not.toHaveBeenCalled();
  });

  it("키워드마다 검색해서 url/anchorText로 모은다", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce([{ id: 1, link: "https://molespapa.com/?p=1", title: { rendered: "전세 글" } }])
      .mockResolvedValueOnce([{ id: 2, link: "https://molespapa.com/?p=2", title: "대출 글" }]);
    const client: WpClient = { dryRun: false, request: request as never };

    const result = await findRelatedPosts(client, ["전세", "대출"]);

    expect(result).toEqual([
      { url: "https://molespapa.com/?p=1", anchorText: "전세 글" },
      { url: "https://molespapa.com/?p=2", anchorText: "대출 글" },
    ]);
  });

  it("같은 글이 여러 키워드에 걸리면 한 번만 담는다", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce([{ id: 1, link: "u1", title: "글1" }])
      .mockResolvedValueOnce([{ id: 1, link: "u1", title: "글1" }]);
    const client: WpClient = { dryRun: false, request: request as never };

    const result = await findRelatedPosts(client, ["a", "b"]);

    expect(result).toHaveLength(1);
  });

  it("excludeId로 지정한 글은 제외한다 (자기 자신 링크 방지)", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce([{ id: 5, link: "u5", title: "자기 자신" }]);
    const client: WpClient = { dryRun: false, request: request as never };

    const result = await findRelatedPosts(client, ["a"], { excludeId: 5 });

    expect(result).toEqual([]);
  });

  it("최대 3개까지만 모으고 그 이상은 검색하지 않는다", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce([
        { id: 1, link: "u1", title: "1" },
        { id: 2, link: "u2", title: "2" },
        { id: 3, link: "u3", title: "3" },
      ])
      .mockResolvedValueOnce([{ id: 4, link: "u4", title: "4" }]);
    const client: WpClient = { dryRun: false, request: request as never };

    const result = await findRelatedPosts(client, ["a", "b"]);

    expect(result).toHaveLength(3);
    expect(request).toHaveBeenCalledTimes(1);
  });
});
