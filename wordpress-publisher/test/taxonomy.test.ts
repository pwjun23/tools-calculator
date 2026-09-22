import { describe, expect, it, vi } from "vitest";
import { createTaxonomyResolver } from "../src/taxonomy.ts";
import { WpApiError } from "../src/client.ts";
import type { WpClient } from "../src/client.ts";

function makeClient(dryRun: boolean, request: WpClient["request"]): WpClient {
  return { dryRun, request };
}

describe("createTaxonomyResolver", () => {
  it("이름이 검색 결과에 있으면 해당 id를 반환한다", async () => {
    const request = vi.fn(async () => [
      { id: 5, name: "다른이름" },
      { id: 9, name: "부동산" },
    ]);
    const resolver = createTaxonomyResolver(makeClient(false, request as never));

    await expect(resolver.resolveCategoryId("부동산")).resolves.toBe(9);
    expect(request).toHaveBeenCalledWith({
      method: "GET",
      path: "/categories?search=%EB%B6%80%EB%8F%99%EC%82%B0",
    });
  });

  it("이름이 없으면 생성해서 새 id를 반환한다", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ id: 42, name: "새카테고리" });
    const resolver = createTaxonomyResolver(makeClient(false, request as never));

    await expect(resolver.resolveCategoryId("새카테고리")).resolves.toBe(42);
    expect(request).toHaveBeenLastCalledWith({
      method: "POST",
      path: "/categories",
      body: { name: "새카테고리" },
    });
  });

  it("생성 권한이 없으면(403) 사람이 읽을 수 있는 에러를 던진다", async () => {
    const request = vi.fn().mockResolvedValueOnce([]).mockRejectedValueOnce(
      new WpApiError("forbidden", 403),
    );
    const resolver = createTaxonomyResolver(makeClient(false, request as never));

    await expect(resolver.resolveCategoryId("새카테고리")).rejects.toThrow(
      /권한이 없습니다/,
    );
  });

  it("여러 태그 이름을 병렬로 id 배열로 바꾼다", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce([{ id: 1, name: "계산기" }])
      .mockResolvedValueOnce([{ id: 2, name: "금융" }]);
    const resolver = createTaxonomyResolver(makeClient(false, request as never));

    await expect(resolver.resolveTagIds(["계산기", "금융"])).resolves.toEqual([1, 2]);
  });

  it("dryRun 클라이언트에서는 네트워크 호출 없이 -1을 반환한다", async () => {
    const request = vi.fn();
    const resolver = createTaxonomyResolver(makeClient(true, request as never));

    await expect(resolver.resolveCategoryId("부동산")).resolves.toBe(-1);
    await expect(resolver.resolveTagIds(["계산기", "금융"])).resolves.toEqual([-1, -1]);
    expect(request).not.toHaveBeenCalled();
  });
});
