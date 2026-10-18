import { describe, expect, it } from "vitest";
import { naverLandUrl } from "./links";

const q = (u: string) => new URL(u).searchParams.get("q");

describe("naverLandUrl", () => {
  it("네이버페이 부동산 검색(fin.land)으로 보낸다", () => {
    const u = naverLandUrl({ region: "경기 김포시", dong: "구래동", apt: "가상아파트" });
    expect(u.startsWith("https://fin.land.naver.com/search?q=")).toBe(true);
  });
  it("검색어는 단지 이름만 쓴다(지역을 붙이면 네이버가 못 찾는다)", () => {
    expect(q(naverLandUrl({ region: "경기 김포시", dong: "양촌읍 양곡리", apt: "가상단지" }))).toBe("가상단지");
  });
  it("괄호는 띄어쓰기로 바꾸고 끝의 '아파트'는 뺀다", () => {
    expect(q(naverLandUrl({ region: "", dong: "", apt: "가상마을(가상린)" }))).toBe("가상마을 가상린");
    expect(q(naverLandUrl({ region: "", dong: "", apt: "가상e편한세상아파트" }))).toBe("가상e편한세상");
  });
});
