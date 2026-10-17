import { describe, expect, it } from "vitest";
import { naverLandUrl } from "./links";

describe("naverLandUrl", () => {
  it("네이버 부동산 모바일 검색 결과로 보낸다(통합검색 아님)", () => {
    const u = naverLandUrl({ region: "경기 김포시", dong: "구래동", apt: "가상아파트" });
    expect(u).toBe(`https://m.land.naver.com/search/result/${encodeURIComponent("김포시 구래동 가상아파트")}`);
  });
  it("읍·면의 리는 빼고 시·군·구 이름만 쓴다", () => {
    expect(decodeURIComponent(naverLandUrl({ region: "경기 김포시", dong: "양촌읍 양곡리", apt: "가상" }))).toMatch(/result\/김포시 양촌읍 가상$/);
  });
});
