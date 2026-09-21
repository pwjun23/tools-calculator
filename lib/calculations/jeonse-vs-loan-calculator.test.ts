import { describe, expect, it } from "vitest";
import {
  calculateAcquisitionTax,
  calculateComprehensiveTax,
  calculateJeonseBrokerageFee,
  calculateJeonseVsLoan,
  calculatePropertyTax,
} from "./jeonse-vs-loan-calculator";

describe("calculateAcquisitionTax (취득세)", () => {
  it("6억 이하는 1%", () => {
    expect(calculateAcquisitionTax(500_000_000)).toEqual({
      rate: 0.01,
      amount: 5_000_000,
    });
  });

  it("6억 초과 9억 이하는 선형 구간 (7.5억 → 2%)", () => {
    const r = calculateAcquisitionTax(750_000_000);
    expect(r.rate).toBeCloseTo(0.02, 5);
    expect(r.amount).toBe(15_000_000);
  });

  it("9억 초과는 3%", () => {
    expect(calculateAcquisitionTax(1_200_000_000)).toEqual({
      rate: 0.03,
      amount: 36_000_000,
    });
  });

  it("6억, 9억 경계값이 연속적으로 이어진다", () => {
    expect(calculateAcquisitionTax(600_000_000).rate).toBeCloseTo(0.01, 5);
    expect(calculateAcquisitionTax(900_000_000).rate).toBeCloseTo(0.03, 5);
  });

  it("가격이 0이면 0원이다", () => {
    expect(calculateAcquisitionTax(0)).toEqual({ rate: 0, amount: 0 });
  });
});

describe("calculatePropertyTax (재산세)", () => {
  it("과세표준이 6천만원 이하면 0.1%", () => {
    // 공시가격 1억 × 60% = 6천만원
    expect(calculatePropertyTax(100_000_000)).toBe(60_000);
  });

  it("과세표준이 3억 초과면 57만원 + 초과분의 0.4%", () => {
    // 공시가격 6억 × 60% = 3.6억 → 3억 초과분 6천만원
    expect(calculatePropertyTax(600_000_000)).toBe(810_000);
  });

  it("가격이 0이면 0원이다", () => {
    expect(calculatePropertyTax(0)).toBe(0);
  });
});

describe("calculateComprehensiveTax (종합부동산세)", () => {
  it("공시가격이 12억 이하면 0원 (1세대 1주택 공제)", () => {
    expect(calculateComprehensiveTax(1_200_000_000)).toBe(0);
    expect(calculateComprehensiveTax(900_000_000)).toBe(0);
  });

  it("12억 초과분에 공정시장가액비율 60%를 적용해 과세한다", () => {
    // 공시가격 13.5억 → 초과분 1.5억 × 60% = 9천만원 → 0.5% 구간
    expect(calculateComprehensiveTax(1_350_000_000)).toBe(450_000);
  });
});

describe("calculateJeonseBrokerageFee (전세 중개보수)", () => {
  it("5천만원 미만은 0.5%, 한도 20만원", () => {
    expect(calculateJeonseBrokerageFee(30_000_000)).toBe(150_000);
    expect(calculateJeonseBrokerageFee(49_000_000)).toBe(200_000);
  });

  it("1억~6억 구간은 0.3%, 한도 없음", () => {
    expect(calculateJeonseBrokerageFee(300_000_000)).toBe(900_000);
  });

  it("6억 이상은 0.4%", () => {
    expect(calculateJeonseBrokerageFee(700_000_000)).toBe(2_800_000);
  });

  it("보증금이 0이면 0원이다", () => {
    expect(calculateJeonseBrokerageFee(0)).toBe(0);
  });
});

describe("calculateJeonseVsLoan (종합 비교)", () => {
  const base = {
    price: 900_000_000,
    years: 10,
    loanRatePercent: 4.5,
    ltvPercent: 70,
    officialPriceRatioPercent: 67,
    monthlyMaintenanceFee: 400_000,
  };

  it("전세금은 아파트가격 × LTV로 근사한다", () => {
    const r = calculateJeonseVsLoan(base);
    expect(r.jeonse.deposit).toBe(630_000_000);
    expect(r.purchase.loanAmount).toBe(630_000_000);
  });

  it("월평균비용은 총비용을 (거주년수×12)로 나눈 값이다", () => {
    const r = calculateJeonseVsLoan(base);
    expect(r.purchase.monthlyAverageCost).toBe(
      Math.round(r.purchase.totalCost / (r.years * 12)),
    );
    expect(r.jeonse.monthlyAverageCost).toBe(
      Math.round(r.jeonse.totalCost / (r.years * 12)),
    );
  });

  it("절감액과 자산비교는 구매 기준에서 전세 기준을 뺀 값이다", () => {
    const r = calculateJeonseVsLoan(base);
    expect(r.monthlySavings).toBe(
      r.purchase.monthlyAverageCost - r.jeonse.monthlyAverageCost,
    );
    expect(r.totalSavings).toBe(r.purchase.totalCost - r.jeonse.totalCost);
    expect(r.assetDifference).toBe(r.purchase.ownedAsset - r.jeonse.deposit);
  });

  it("거주 기간이 길수록 대출이자·관리비 총액이 비례해서 늘어난다", () => {
    const short = calculateJeonseVsLoan({ ...base, years: 5 });
    const long = calculateJeonseVsLoan({ ...base, years: 10 });
    const shortInterest = short.purchase.items.find(
      (i) => i.key === "loanInterest",
    )!.total;
    const longInterest = long.purchase.items.find(
      (i) => i.key === "loanInterest",
    )!.total;
    expect(longInterest).toBe(shortInterest * 2);
  });

  it("거주 기간은 최소 1년으로 보정한다", () => {
    const r = calculateJeonseVsLoan({ ...base, years: 0 });
    expect(r.years).toBe(1);
  });
});
