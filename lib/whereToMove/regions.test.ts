import { describe, expect, it } from "vitest";
import { findSgg, invalidDongs, regionLabel } from "./regions";

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
