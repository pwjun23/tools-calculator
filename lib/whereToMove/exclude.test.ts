import { describe, expect, it } from "vitest";
import { addExcluded, excludedKey, isExcluded, removeExcluded } from "./exclude";
import { MAX_EXCLUDED } from "./settings";

const a = { sggCd: "11111", dong: "가상동", apt: "가상아파트" };

describe("isExcluded", () => {
  it("시·군·구·읍·면·동·단지 이름이 같으면 뺀다(리 이름은 무시)", () => {
    const list = [{ sggCd: "11111", dong: "가상읍", apt: "가상아파트" }];
    expect(isExcluded(list, { ...a, dong: "가상읍 가리" })).toBe(true);
    expect(isExcluded(list, { ...a, dong: "가상읍" })).toBe(true);
    expect(isExcluded(list, { ...a, dong: "다른읍" })).toBe(false);
    expect(isExcluded(list, { ...a, dong: "가상읍", apt: "다른아파트" })).toBe(false);
    expect(isExcluded(list, { ...a, dong: "가상읍", sggCd: "22222" })).toBe(false);
  });
});

describe("addExcluded", () => {
  it("읍·면·동으로 줄여 넣고, 이미 있으면 그대로", () => {
    const once = addExcluded([], { ...a, dong: "가상읍 가리" })!;
    expect(once).toEqual([{ ...a, dong: "가상읍" }]);
    expect(addExcluded(once, { ...a, dong: "가상읍 나리" })).toEqual(once);
  });
  it(`${MAX_EXCLUDED}개가 넘으면 null`, () => {
    const full = Array.from({ length: MAX_EXCLUDED }, (_, i) => ({ ...a, apt: `단지${i}` }));
    expect(addExcluded(full, a)).toBeNull();
  });
});

describe("removeExcluded", () => {
  it("같은 단지만 뺀다", () => {
    const b = { ...a, apt: "다른아파트" };
    expect(removeExcluded([a, b], { ...a })).toEqual([b]);
  });
  it("excludedKey 는 단지마다 다르다", () => {
    expect(excludedKey(a)).not.toBe(excludedKey({ ...a, apt: "다른아파트" }));
  });
});
