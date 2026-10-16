import { describe, expect, it } from "vitest";
import { groupDongs, toggleDong } from "./board";

describe("groupDongs", () => {
  it("설정에서 고른 동을 거래 유무와 관계없이 지역별로 가나다순으로 보여 준다", () => {
    const g = groupDongs([
      { sggCd: "A", label: "가 시", dongs: ["하성면", "구래동", "중앙동"] },
      { sggCd: "B", label: "나 시", dongs: ["중앙동"] },
    ]);
    expect(g).toEqual([
      { sggCd: "A", label: "가 시", dongs: ["구래동", "중앙동", "하성면"] },
      { sggCd: "B", label: "나 시", dongs: ["중앙동"] },
    ]);
  });
});

describe("toggleDong", () => {
  it("전체(빈 목록)에서 동을 누르면 그 동만 선택된다", () => {
    expect(toggleDong([], "A:구래동")).toEqual(["A:구래동"]);
  });
  it("다른 동을 누르면 함께 선택된다", () => {
    expect(toggleDong(["A:구래동"], "A:하성면")).toEqual(["A:구래동", "A:하성면"]);
  });
  it("선택된 동을 다시 누르면 빠지고, 다 빠지면 전체가 된다", () => {
    expect(toggleDong(["A:구래동", "A:하성면"], "A:구래동")).toEqual(["A:하성면"]);
    expect(toggleDong(["A:하성면"], "A:하성면")).toEqual([]);
  });
});
