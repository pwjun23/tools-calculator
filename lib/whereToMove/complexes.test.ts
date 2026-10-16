import { describe, expect, it } from "vitest";
import { complexKey, complexSeeds } from "./complexes";
import type { MolitDeal } from "./types";

const d = (p: Partial<MolitDeal>): MolitDeal => ({
  key: Math.random().toString(), type: "전세", sggCd: "11110", dong: "가상동", apt: "가상단지", area: 84, areaRaw: 84, floor: "3",
  date: "2026-09-01", amount: 30000, rent: 0, renewal: false, cancelled: false, ...p,
});

describe("complexSeeds", () => {
  it("단지마다 하나, 도로명 주소가 있는 것을 고른다", () => {
    const s = complexSeeds([
      d({ roadAddr: "", jibunAddr: "서울특별시 종로구 가상동 1", aptSeq: "11110-1" }),
      d({ roadAddr: "서울특별시 종로구 가상로 5", jibunAddr: "서울특별시 종로구 가상동 1", aptSeq: "11110-1" }),
      d({ apt: "다른단지", roadAddr: "", jibunAddr: "" }),
    ]);
    expect(s).toEqual([
      { sggCd: "11110", dong: "가상동", apt: "가상단지", aptSeq: "11110-1", roadAddr: "서울특별시 종로구 가상로 5", jibunAddr: "서울특별시 종로구 가상동 1" },
      { sggCd: "11110", dong: "가상동", apt: "다른단지", aptSeq: "", roadAddr: "", jibunAddr: "" },
    ]);
  });
  it("단지명이 빈 거래는 뺀다", () => expect(complexSeeds([d({ apt: "" })])).toEqual([]));
  it("complexKey", () => expect(complexKey({ sggCd: "1", dong: "가 리", apt: "단지" })).toBe("1|가 리|단지"));
});
