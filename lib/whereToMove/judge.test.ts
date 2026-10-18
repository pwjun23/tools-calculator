import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, type Settings } from "./settings";
import { deriveParams, evaluateDeal, filterDeals, monthlyPayment, priceLimits, umdOf, type JudgeParams } from "./judge";

const base: Settings = {
  ...DEFAULT_SETTINGS,
  cash: 5000,
  monthlyBudget: 150,
  monthlyMgmt: 25,
  annualIncome: 3000,
  dsrRatio: 0.4,
  loans: [
    { name: "가상 주택대출", balance: 10000, rate: 0.03, years: 20, repayment: "amortizing", repaidIfHomeSold: true },
    { name: "가상 만기대출", balance: 2000, rate: 0.06, years: 1, repayment: "bullet", repaidIfHomeSold: false },
  ],
  ownedHome: { has: true, price: 30000, sellCostRate: 0.03, planOnMove: "keep", rentLoanAllowedIfKept: true, mortgageAllowedIfKept: false },
};

describe("monthlyPayment", () => {
  it("원리금균등 월 상환액", () => {
    expect(monthlyPayment(1, 0.04, 30)).toBeCloseTo(0.004774152954654538, 12);
    expect(monthlyPayment(10000, 0.03, 20)).toBeCloseTo(55.459759785392066, 9);
  });
  it("금리 0이면 원금 / 개월 수", () => {
    expect(monthlyPayment(1200, 0, 10)).toBe(10);
  });
});

describe("deriveParams", () => {
  it("보유 유지: 기존 대출이 DSR 한도를 줄이고, 주담대 불가면 매매 비율 0", () => {
    const p = deriveParams(base);
    expect(p.available).toBe(125);
    expect(p.factor).toBeCloseTo(0.004774152954654538, 12);
    expect(p.existingMonthly).toBeCloseTo(65.45975978539207, 9);
    expect(p.dsrMonthly).toBeCloseTo(34.540240214607934, 9);
    expect(p.sellExtra).toBe(0);
    expect(p.cash).toBe(5000);
    expect(p.ltvBuy).toBe(0);
    expect(p.ltvRent).toBe(0.8);
  });

  it("매도: 매도 순현금이 현금에 더해지고 그 집 대출은 DSR에서 빠진다", () => {
    const p = deriveParams({ ...base, ownedHome: { ...base.ownedHome, planOnMove: "sell" } });
    expect(p.sellExtra).toBe(19100);
    expect(p.cash).toBe(24100);
    expect(p.dsrMonthly).toBe(90);
    expect(p.ltvBuy).toBe(0.7);
  });

  it("소득 0이면 DSR 대신 월 가용액", () => {
    const p = deriveParams({ ...base, annualIncome: 0 });
    expect(p.dsrMonthly).toBe(125);
  });

  it("기존 대출 상환이 DSR 한도를 넘으면 0", () => {
    const p = deriveParams({ ...base, annualIncome: 100 });
    expect(p.dsrMonthly).toBe(0);
  });

  it("관리비가 예산보다 크면 가용액 0", () => {
    expect(deriveParams({ ...base, monthlyMgmt: 200 }).available).toBe(0);
  });
});

const P: JudgeParams = {
  cash: 5000, budget: 150, mgmt: 25, fee: 0.012, factor: 0.004774152954654538,
  rentRate: 0.04, rentCap: 20000, mortgageCap: 60000, dsrMonthly: 90, ltvBuy: 0.7, ltvRent: 0.8,
};

describe("evaluateDeal", () => {
  it("전세 적합", () => {
    const e = evaluateDeal(P, { type: "전세", amount: 20000, rent: 0 });
    expect(e).toMatchObject({ ok: true, loan: 15000, carry: 50, monthly: 75, margin: 75, reasons: [] });
  });

  it("전세: 한도와 비율 초과는 여유가 있어도 부적합", () => {
    const e = evaluateDeal(P, { type: "전세", amount: 26000, rent: 0 });
    expect(e.ok).toBe(false);
    expect(e.margin).toBe(55);
    expect(e.reasons).toEqual(["대출 한도 초과", "대출 비율 초과"]);
  });

  it("월세 적합", () => {
    const e = evaluateDeal(P, { type: "월세", amount: 10000, rent: 60 });
    expect(e.ok).toBe(true);
    expect(e.monthly).toBeCloseTo(101.66666666666667, 9);
  });

  it("월세 예산 초과", () => {
    const e = evaluateDeal(P, { type: "월세", amount: 3000, rent: 130 });
    expect(e).toMatchObject({ ok: false, loan: 0, monthly: 155, margin: -5, reasons: ["예산 초과"] });
  });

  it("매매: 비율과 DSR 초과", () => {
    const e = evaluateDeal(P, { type: "매매", amount: 30000, rent: 0 });
    expect(e.loan).toBe(25360);
    expect(e.carry).toBeCloseTo(121.07251893003908, 9);
    expect(e.reasons).toEqual(["대출 비율 초과", "DSR 초과"]);
  });

  it("매매: 주담대 최대 금액 초과", () => {
    const e = evaluateDeal({ ...P, ltvBuy: 1, dsrMonthly: 1e9, budget: 1e9 }, { type: "매매", amount: 100000, rent: 0 });
    expect(e.loan).toBe(96200);
    expect(e.reasons).toEqual(["대출 한도 초과"]);
  });

  it("대출 비율 100%여도 NaN이 없다", () => {
    const e = evaluateDeal({ ...P, ltvRent: 1, rentRate: 0 }, { type: "전세", amount: 20000, rent: 0 });
    expect(Number.isFinite(e.monthly)).toBe(true);
  });
});

describe("priceLimits", () => {
  it("한도계산 시트와 같은 상한 (10만원 단위 내림)", () => {
    expect(priceLimits(P)).toEqual({ jeonseMax: 25000, buyMax: 16020 });
  });
  it("금리 0이어도 유한한 값", () => {
    const r = priceLimits({ ...P, rentRate: 0 });
    expect(Number.isFinite(r.jeonseMax)).toBe(true);
  });
});

describe("filterDeals", () => {
  const mk = (o: Partial<{ dong: string; areaRaw: number; renewal: boolean; cancelled: boolean; sggCd: string }>) => ({
    dong: "구래동", areaRaw: 84.9, renewal: false, cancelled: false, sggCd: "41570", ...o,
  });

  it("지역 동, 최소 면적, 갱신, 해제를 거른다", () => {
    const s: Settings = { ...DEFAULT_SETTINGS, minArea: 75, excludeRenewal: true };
    const out = filterDeals(s, [
      mk({}),
      mk({ dong: "장기동" }),
      mk({ areaRaw: 59.9 }),
      mk({ renewal: true }),
      mk({ cancelled: true }),
      mk({ sggCd: "11110" }),
    ]);
    expect(out).toHaveLength(1);
  });

  it("갱신 포함 설정이면 갱신 거래도 남긴다", () => {
    const s: Settings = { ...DEFAULT_SETTINGS, excludeRenewal: false };
    expect(filterDeals(s, [mk({ renewal: true })])).toHaveLength(1);
  });

  it("읍·면 거래는 리가 붙어 와도 읍·면으로 고르면 통과한다", () => {
    const s: Settings = { ...base, minArea: 0, regions: [{ sggCd: "41570", label: "경기 김포시", dongs: ["양촌읍"] }] };
    const out = filterDeals(s, [mk({ dong: "양촌읍 양곡리" }), mk({ dong: "양촌읍" }), mk({ dong: "통진읍 마송리" }), mk({ dong: "양촌읍내" })]);
    expect(out.map((d) => d.dong)).toEqual(["양촌읍 양곡리", "양촌읍"]);
  });
});

describe("umdOf", () => {
  it("리를 떼고 읍·면·동만 남긴다", () => {
    expect(umdOf("양촌읍 양곡리")).toBe("양촌읍");
    expect(umdOf("구래동")).toBe("구래동");
  });
});

describe("evaluateDeal 보증금 0원 월세", () => {
  const p = deriveParams({ ...base, ownedHome: { ...base.ownedHome, has: false } });
  it("보증금 0원으로 신고된 월세는 신고 오류일 수 있어 적합으로 두지 않는다", () => {
    const e = evaluateDeal(p, { type: "월세", amount: 0, rent: 33 });
    expect(e.ok).toBe(false);
    expect(e.reasons).toContain("보증금 0원 신고");
  });
  it("보증금이 있으면 그 사유는 없다", () => {
    expect(evaluateDeal(p, { type: "월세", amount: 1000, rent: 33 }).reasons).not.toContain("보증금 0원 신고");
  });
});

describe("evaluateDeal 시세보다 크게 낮음", () => {
  it("belowMarket 이면 다른 조건을 통과해도 부적합", () => {
    const e = evaluateDeal(P, { type: "전세", amount: 15000, rent: 0 }, { belowMarket: true });
    expect(e.ok).toBe(false);
    expect(e.reasons).toEqual(["시세보다 크게 낮음"]);
  });
  it("표시가 없으면 이전과 같다", () => {
    expect(evaluateDeal(P, { type: "전세", amount: 15000, rent: 0 }).reasons).toEqual([]);
  });
});

describe("deriveParams 전환율", () => {
  it("설정의 월세 전환율을 convRate 로 넘긴다", () => {
    expect(deriveParams({ ...base, rentConvRate: 0.06 }).convRate).toBe(0.06);
  });
});
