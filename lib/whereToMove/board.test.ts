import { describe, expect, it } from "vitest";
import { groupDongs, regionSubtitle } from "./board";

describe("groupDongs", () => {
  it("같은 이름 동도 지역별로 나눈다", () => {
    const g = groupDongs(
      [{ sggCd: "B", dong: "중앙동" }, { sggCd: "A", dong: "중앙동" }, { sggCd: "A", dong: "가동" }, { sggCd: "A", dong: "중앙동" }],
      [{ sggCd: "A", label: "가 시" }, { sggCd: "B", label: "나 시" }, { sggCd: "C", label: "다 시" }],
    );
    expect(g).toEqual([
      { sggCd: "A", label: "가 시", dongs: ["가동", "중앙동"] },
      { sggCd: "B", label: "나 시", dongs: ["중앙동"] },
    ]);
  });
});

describe("regionSubtitle", () => {
  it("지역별로 잇는다", () => {
    expect(regionSubtitle([{ sggCd: "A", label: "가 시", dongs: ["가동", "나동"] }, { sggCd: "B", label: "나 시", dongs: ["다동"] }]))
      .toBe("가 시 가동·나동 · 나 시 다동");
  });
});
