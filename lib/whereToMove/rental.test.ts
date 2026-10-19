import { describe, expect, it } from "vitest";
import { isRentalComplex, rentalLines, rentalSales, rentalTiers, type TierInput } from "./rental";

const deal = (o: Partial<TierInput>): TierInput => ({
  type: "월세", sggCd: "11111", dong: "가상동", apt: "가상뉴스테이", areaRaw: 84.9, date: "2026-08-01",
  amount: 16000, rent: 30, cancelled: false, ...o,
});
const FROM = "2026-04-18";

describe("isRentalComplex", () => {
  it("단지 이름에 뉴스테이·임대·행복주택이 있으면 임대주택", () => {
    expect(isRentalComplex("가상한강뉴스테이")).toBe(true);
    expect(isRentalComplex("가상마을주공(임대)")).toBe(true);
    expect(isRentalComplex("가상행복주택")).toBe(true);
    expect(isRentalComplex("가상아이파크")).toBe(false);
  });
});

describe("rentalTiers", () => {
  const pool = [
    deal({}), deal({}), deal({}),
    deal({ amount: 13000, rent: 45 }), deal({ amount: 13000, rent: 45 }),
    deal({ amount: 10000, rent: 56 }), deal({ amount: 10000, rent: 56 }),
    deal({ amount: 8000, rent: 68 }), deal({ amount: 8000, rent: 68 }),
    deal({ amount: 5000, rent: 78 }),
  ];
  const at = rentalTiers(pool, FROM);

  it("같은 단지·같은 평형에서 많이 쓰인 보증금/월세 조합 3개(건수 순, 같으면 보증금 큰 순)", () => {
    expect(at(deal({}))).toEqual([
      { amount: 16000, rent: 30, count: 3 },
      { amount: 13000, rent: 45, count: 2 },
      { amount: 10000, rent: 56, count: 2 },
    ]);
  });
  it("한 번만 나온 조합은 뺀다", () => {
    expect(rentalTiers([deal({}), deal({ amount: 5000, rent: 78 })], FROM)(deal({}))).toEqual([]);
  });
  it("전세도 같은 묶음, 매매·해제·기간 밖·다른 평형·다른 단지는 뺀다", () => {
    const t = rentalTiers([
      deal({ type: "전세", amount: 24000, rent: 0 }), deal({ type: "전세", amount: 24000, rent: 0 }),
      deal({ type: "매매", amount: 40000, rent: 0 }), deal({ type: "매매", amount: 40000, rent: 0 }),
      deal({ cancelled: true }), deal({ cancelled: true }),
      deal({ date: "2026-04-17" }), deal({ date: "2026-04-17" }),
      deal({ areaRaw: 59.9 }), deal({ areaRaw: 59.9 }),
      deal({ apt: "다른뉴스테이" }), deal({ apt: "다른뉴스테이" }),
    ], FROM);
    expect(t(deal({}))).toEqual([{ amount: 24000, rent: 0, count: 2 }]);
  });
});

describe("rentalLines", () => {
  it("안내와 조합 줄", () => {
    expect(rentalLines([{ amount: 16429, rent: 33, count: 21 }, { amount: 24000, rent: 0, count: 2 }])).toEqual([
      "임대주택 단지: 거래 대부분이 기존 입주자의 갱신 계약입니다. 새로 들어가려면 모집공고·운영사를 확인하세요.",
      "같은 평형 최근 6개월 많은 조합: 1.64억/33만 21건 · 전세 2.4억 2건",
    ]);
  });
  it("조합이 없으면 안내만", () => {
    expect(rentalLines([])).toHaveLength(1);
  });
});

describe("rentalSales", () => {
  it("임대주택 단지의 매매(해제 제외)를 단지별로 센다", () => {
    expect(rentalSales([
      deal({ type: "매매" }), deal({ type: "매매" }), deal({ type: "매매", cancelled: true }),
      deal({ type: "매매", apt: "가상아이파크" }), deal({}),
      deal({ type: "매매", apt: "가상행복주택" }),
    ])).toEqual([{ apt: "가상뉴스테이", count: 2 }, { apt: "가상행복주택", count: 1 }]);
  });
});
