import { describe, expect, it } from "vitest";
import { naverLandUrl } from "./links";

const q = (u: string) => new URL(u).searchParams.get("query");

describe("naverLandUrl", () => {
  it("네이버 통합검색으로 보낸다", () => {
    const u = naverLandUrl({ region: "경기 김포시", dong: "구래동", apt: "가상아파트" });
    expect(u.startsWith("https://search.naver.com/search.naver?query=")).toBe(true);
  });
  it("검색어는 시·군·구 + 읍·면·동 + 단지 이름(리 이름은 뺀다)", () => {
    expect(q(naverLandUrl({ region: "경기 김포시", dong: "양촌읍 양곡리", apt: "가상단지" }))).toBe("김포시 양촌읍 가상단지");
  });
  it("지역 이름이 없으면 읍·면·동부터", () => {
    expect(q(naverLandUrl({ region: "", dong: "구래동", apt: "가상단지" }))).toBe("구래동 가상단지");
  });
  it("괄호는 띄어쓰기로 바꾸고 끝의 '아파트'는 뺀다", () => {
    expect(q(naverLandUrl({ region: "", dong: "", apt: "가상마을(가상린)" }))).toBe("가상마을 가상린");
    expect(q(naverLandUrl({ region: "", dong: "", apt: "가상e편한세상아파트" }))).toBe("가상e편한세상");
  });
});
