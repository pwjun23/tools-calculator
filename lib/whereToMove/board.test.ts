import { describe, expect, it } from "vitest";
import { groupDongs, readFilters, toggleDong } from "./board";

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

describe("readFilters", () => {
  const sorts = ["date", "monthly"];
  const dongs = ["41570:구래동", "41570:마산동"];
  it("저장된 값 중 지금 쓸 수 있는 것만 돌려준다", () => {
    const raw = JSON.stringify({ dongs: ["41570:구래동", "11110:없는동"], types: ["매매", "이상"], okOnly: false, minArea: "75", maxMonthly: "120", sort: "monthly", commute: "s0:walk:15" });
    expect(readFilters(raw, { dongs, sorts })).toEqual({ dongs: ["41570:구래동"], types: ["매매"], okOnly: false, minArea: "75", maxMonthly: "120", sort: "monthly", commute: "s0:walk:15" });
  });
  it("모르는 정렬·틀린 형식은 빼고, 깨진 값·없음은 빈 객체", () => {
    expect(readFilters(JSON.stringify({ sort: "x", okOnly: "yes", minArea: 75 }), { dongs, sorts })).toEqual({});
    expect(readFilters("{깨짐", { dongs, sorts })).toEqual({});
    expect(readFilters(null, { dongs, sorts })).toEqual({});
  });
});
