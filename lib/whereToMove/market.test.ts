import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "./settings";
import { deriveParams } from "./judge";
import { belowMarket, jeonseEquivalent, marketIndex, marketLines, type MarketInput } from "./market";

const deal = (o: Partial<MarketInput>): MarketInput => ({
  type: "전세", sggCd: "11111", dong: "가상동", apt: "가상아파트", areaRaw: 84.9, date: "2026-08-01",
  amount: 30000, rent: 0, renewal: false, cancelled: false, ...o,
});
const FROM = "2026-04-18";

describe("jeonseEquivalent", () => {
  it("전세·매매는 금액 그대로", () => {
    expect(jeonseEquivalent({ type: "전세", amount: 30000, rent: 0 }, 0.05)).toBe(30000);
    expect(jeonseEquivalent({ type: "매매", amount: 50000, rent: 0 }, 0.05)).toBe(50000);
  });
  it("월세는 보증금 + 월세×12÷전환율", () => {
    expect(jeonseEquivalent({ type: "월세", amount: 10000, rent: 100 }, 0.05)).toBe(34000);
  });
});

describe("marketIndex", () => {
  const pool = [
    deal({ amount: 29000 }), deal({ amount: 30000 }), deal({ amount: 31000 }), deal({ amount: 32000 }),
    deal({ type: "월세", amount: 10000, rent: 100 }), // 환산 3.4억
    deal({ amount: 15000 }),
  ];
  const at = marketIndex(pool, FROM, 0.05);

  it("전세·월세를 전세 환산으로 한데 모아 범위·중앙·건수를 낸다", () => {
    expect(at(deal({}))).toEqual({ basis: "임대", low: 29000, mid: 30500, high: 32000, count: 6 });
    expect(at(deal({ type: "월세", amount: 5000, rent: 50 }))?.count).toBe(6);
  });
  it("면적 차이 3㎡ 이내만 같은 평형", () => {
    expect(at(deal({ areaRaw: 87.9 }))?.count).toBe(6);
    expect(at(deal({ areaRaw: 88.0 }))).toBeNull();
  });
  it("갱신·해제·기간 밖·다른 단지·다른 동은 빼고, 3건 미만이면 null", () => {
    const few = marketIndex([
      deal({}), deal({}),
      deal({ renewal: true }), deal({ cancelled: true }), deal({ date: "2026-04-17" }),
      deal({ apt: "다른아파트" }), deal({ dong: "다른동" }), deal({ sggCd: "22222" }),
    ], FROM, 0.05);
    expect(few(deal({}))).toBeNull();
  });
  it("읍·면 거래의 리 이름은 무시하고 같은 동으로 본다", () => {
    const eup = marketIndex([deal({ dong: "가상읍 가리" }), deal({ dong: "가상읍 나리" }), deal({ dong: "가상읍" })], FROM, 0.05);
    expect(eup(deal({ dong: "가상읍" }))?.count).toBe(3);
  });
  it("매매는 따로 모은다", () => {
    const buy = marketIndex([deal({ type: "매매", amount: 50000 }), deal({ type: "매매", amount: 52000 }), deal({ type: "매매", amount: 54000 }), ...pool], FROM, 0.05);
    expect(buy(deal({ type: "매매" }))).toEqual({ basis: "매매", low: 50000, mid: 52000, high: 54000, count: 3 });
  });
});

describe("belowMarket", () => {
  const m = { basis: "임대" as const, low: 29000, mid: 30000, high: 32000, count: 10 };
  it("환산가가 중앙값의 70% 미만이면 true", () => {
    expect(belowMarket({ type: "전세", amount: 15000, rent: 0 }, m, 0.05)).toBe(true);
    expect(belowMarket({ type: "전세", amount: 21000, rent: 0 }, m, 0.05)).toBe(false);
    expect(belowMarket({ type: "월세", amount: 2000, rent: 40 }, m, 0.05)).toBe(true); // 환산 1.16억
  });
  it("시세가 없으면 false", () => {
    expect(belowMarket({ type: "전세", amount: 1, rent: 0 }, null, 0.05)).toBe(false);
  });
});

describe("marketLines", () => {
  const p = deriveParams({ ...DEFAULT_SETTINGS, cash: 5000, monthlyBudget: 120, monthlyMgmt: 25, rentLoanRate: 0.04, ltvRent: 0.8, rentLoanCap: 20000, rentConvRate: 0.05 });
  const m = { basis: "임대" as const, low: 29000, mid: 30000, high: 32000, count: 18 };

  it("임대: 범위 줄, 시세 전세 판정, 현금 보증금 월세 어림", () => {
    expect(marketLines(p, { type: "전세", amount: 30000, rent: 0 }, m)).toEqual([
      "같은 평형 최근 6개월 전세(환산) 2.9억~3.2억 · 중앙 3억 · 18건",
      "시세 전세 3억이면: 부적합(대출 한도 초과, 대출 비율 초과)",
      "보증금 5,000만 월세면: 월세 약 104만 · 월 부담 129만 → 부적합(예산 초과) · 전환율 연 5% 가정",
    ]);
  });
  it("시세보다 크게 낮은 거래는 경고를 맨 앞에", () => {
    const lines = marketLines(p, { type: "전세", amount: 15000, rent: 0 }, m);
    expect(lines[0]).toBe("⚠ 같은 평형 시세의 50%인 거래입니다. 가족 간 계약·임대주택 등 특수한 거래일 수 있어 예산 판정에서 뺐습니다.");
  });
  it("적합이면 월 부담을 보여 준다", () => {
    const cheap = { ...m, low: 15000, mid: 16000, high: 17000 };
    expect(marketLines(p, { type: "전세", amount: 16000, rent: 0 }, cheap)[1]).toBe("시세 전세 1.6억이면: 적합 · 월 부담 61.7만");
  });
  it("현금이 시세보다 많으면 월세 줄은 없다", () => {
    const tiny = { ...m, low: 3000, mid: 4000, high: 4500 };
    expect(marketLines(p, { type: "전세", amount: 4000, rent: 0 }, tiny)).toHaveLength(2);
  });
  it("매매는 범위와 시세 매매 판정만", () => {
    const b = { basis: "매매" as const, low: 50000, mid: 52000, high: 54000, count: 5 };
    const lines = marketLines(p, { type: "매매", amount: 52000, rent: 0 }, b);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe("같은 평형 최근 6개월 매매 5억~5.4억 · 중앙 5.2억 · 5건");
    expect(lines[1].startsWith("시세 매매 5.2억이면: 부적합(")).toBe(true);
  });
  it("시세가 없으면 빈 목록", () => {
    expect(marketLines(p, { type: "전세", amount: 30000, rent: 0 }, null)).toEqual([]);
  });
});
