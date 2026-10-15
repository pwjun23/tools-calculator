import { describe, expect, it } from "vitest";
import { isAllowedKakaoId } from "./allowlist";

describe("isAllowedKakaoId", () => {
  it("쉼표 목록에 있으면 true (공백 무시)", () => {
    expect(isAllowedKakaoId("111", "111, 222")).toBe(true);
    expect(isAllowedKakaoId("222", "111, 222")).toBe(true);
    expect(isAllowedKakaoId("333", "111, 222")).toBe(false);
  });
  it("목록이 비었거나 id가 비면 false", () => {
    expect(isAllowedKakaoId("111", undefined)).toBe(false);
    expect(isAllowedKakaoId("111", "")).toBe(false);
    expect(isAllowedKakaoId("", "111")).toBe(false);
  });
});
