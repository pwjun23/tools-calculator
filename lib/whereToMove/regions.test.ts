import { describe, expect, it } from "vitest";
import { addrPrefix, findSgg, invalidDongs, regionLabel } from "./regions";

describe("regions", () => {
  it("김포를 찾는다", () => {
    expect(regionLabel("41570")).toBe("경기 김포시");
    expect(findSgg("41570")?.dongs).toEqual(expect.arrayContaining(["구래동", "마산동", "양촌읍"]));
  });
  it("없는 시·군·구는 null", () => {
    expect(invalidDongs("99999", ["구래동"])).toBeNull();
  });
  it("그 시·군·구에 없는 동만 돌려준다", () => {
    expect(invalidDongs("41570", ["구래동", "없는동"])).toEqual(["없는동"]);
    expect(invalidDongs("41570", ["구래동", "마산동"])).toEqual([]);
  });
});

describe("addrPrefix", () => {
  it("시·도 + 시·군·구", () => expect(addrPrefix("41570")).toBe("경기도 김포시"));
  it("세종은 한 번만", () => expect(addrPrefix("36110")).toBe("세종특별자치시"));
  it("없는 코드는 빈 문자열", () => expect(addrPrefix("00000")).toBe(""));
});
