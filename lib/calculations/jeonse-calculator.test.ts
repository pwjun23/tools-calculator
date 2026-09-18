import { describe, expect, it } from "vitest";
import { calculateJeonse, type JeonseInput } from "./jeonse-calculator";

const base: JeonseInput = {
  jeonseDeposit: 300_000_000,
  rentDeposit: 50_000_000,
  monthlyRent: 1_000_000,
  interestRatePercent: 4,
  years: 2,
};

describe("calculateJeonse — 전세 / 월세 비용", () => {
  it("전세: 전세금 × 이자율이 비용의 전부다", () => {
    const { jeonse } = calculateJeonse(base);
    expect(jeonse).toEqual({
      deposit: 300_000_000,
      annualInterest: 12_000_000,
      annualRent: 0,
      annualCost: 12_000_000,
      monthlyInterest: 1_000_000,
      monthlyRent: 0,
      monthlyCost: 1_000_000,
      totalCost: 24_000_000,
    });
  });

  it("월세: 보증금 이자 + 월세 × 12", () => {
    const { wolse } = calculateJeonse(base);
    expect(wolse).toEqual({
      deposit: 50_000_000,
      annualInterest: 2_000_000,
      annualRent: 12_000_000,
      annualCost: 14_000_000,
      monthlyInterest: 166_667,
      monthlyRent: 1_000_000,
      monthlyCost: 1_166_667,
      totalCost: 28_000_000,
    });
  });

  it("차이는 월세 - 전세이고, 양수면 전세가 더 저렴하다", () => {
    const r = calculateJeonse(base);
    expect(r.difference).toEqual({
      annual: 2_000_000,
      monthly: 166_667,
      total: 4_000_000,
    });
    expect(r.cheaper).toBe("jeonse");
  });

  it("이자율이 전환율보다 높으면 월세가 더 저렴하다", () => {
    const r = calculateJeonse({ ...base, interestRatePercent: 5 });
    expect(r.difference.total).toBe(-1_000_000);
    expect(r.cheaper).toBe("wolse");
  });

  it("이자율이 전환율과 같으면 비용이 같다 (손익분기)", () => {
    const r = calculateJeonse({ ...base, interestRatePercent: 4.8 });
    expect(r.difference.total).toBe(0);
    expect(r.cheaper).toBe("same");
  });
});

describe("calculateJeonse — 전월세 전환율", () => {
  it("월세 × 12 ÷ (전세금 - 월세 보증금)", () => {
    expect(calculateJeonse(base).conversionRate).toBeCloseTo(4.8, 10);
  });

  it("월세가 0원이면 전환율은 0%다", () => {
    const r = calculateJeonse({ ...base, monthlyRent: 0 });
    expect(r.conversionRate).toBe(0);
  });

  it("월세 보증금이 전세금 이상이면 전환율을 구할 수 없다", () => {
    expect(
      calculateJeonse({ ...base, rentDeposit: 300_000_000 }).conversionRate,
    ).toBeNull();
    expect(
      calculateJeonse({ ...base, rentDeposit: 400_000_000 }).conversionRate,
    ).toBeNull();
  });
});

describe("calculateJeonse — 월세 추가 영향도", () => {
  it("보증금을 낮춰 절약한 이자와 새로 내는 월세, 순 변화", () => {
    const { rentImpact } = calculateJeonse(base);
    expect(rentImpact.depositReduction).toBe(250_000_000);
    expect(rentImpact.monthlyInterestSaved).toBe(833_333);
    expect(rentImpact.monthlyRentAdded).toBe(1_000_000);
    expect(rentImpact.monthlyNet).toBe(166_667);
    expect(rentImpact.percentChange).toBeCloseTo(16.6667, 3);
  });

  it("순 변화는 월세 월 비용 - 전세 월 비용과 같다", () => {
    const r = calculateJeonse({ ...base, interestRatePercent: 3.3 });
    expect(r.rentImpact.monthlyNet).toBe(
      r.wolse.monthlyCost - r.jeonse.monthlyCost,
    );
  });

  it("월세가 유리한 조건이면 순 변화는 음수다", () => {
    const r = calculateJeonse({ ...base, interestRatePercent: 5 });
    expect(r.rentImpact.monthlyNet).toBeLessThan(0);
    expect(r.rentImpact.percentChange!).toBeLessThan(0);
  });

  it("전세 월 비용이 0이면 증감률은 구할 수 없다", () => {
    const r = calculateJeonse({ ...base, interestRatePercent: 0 });
    expect(r.rentImpact.percentChange).toBeNull();
  });
});

describe("calculateJeonse — 계약 기간별 비교", () => {
  it("1~4년 행을 만들고 각 기간의 총 비용을 계산한다", () => {
    const { byPeriod } = calculateJeonse(base);
    expect(byPeriod.map((p) => p.years)).toEqual([1, 2, 3, 4]);
    expect(byPeriod[0]).toEqual({
      years: 1,
      jeonse: 12_000_000,
      wolse: 14_000_000,
      difference: 2_000_000,
    });
    expect(byPeriod[3]).toEqual({
      years: 4,
      jeonse: 48_000_000,
      wolse: 56_000_000,
      difference: 8_000_000,
    });
  });

  it("선택한 기간이 1~4년 밖이면 행을 추가한다", () => {
    const { byPeriod } = calculateJeonse({ ...base, years: 6 });
    expect(byPeriod.map((p) => p.years)).toEqual([1, 2, 3, 4, 6]);
  });
});

describe("calculateJeonse — 이자율별 비교", () => {
  it("3%, 4%, 5%를 선택한 계약 기간 기준으로 비교한다", () => {
    const { byRate } = calculateJeonse(base);
    expect(byRate).toEqual([
      { ratePercent: 3, jeonse: 18_000_000, wolse: 27_000_000, difference: 9_000_000 },
      { ratePercent: 4, jeonse: 24_000_000, wolse: 28_000_000, difference: 4_000_000 },
      { ratePercent: 5, jeonse: 30_000_000, wolse: 29_000_000, difference: -1_000_000 },
    ]);
  });

  it("선택한 이자율이 3/4/5% 밖이면 행을 추가한다", () => {
    const { byRate } = calculateJeonse({ ...base, interestRatePercent: 4.5 });
    expect(byRate.map((r) => r.ratePercent)).toEqual([3, 4, 4.5, 5]);
  });
});

describe("calculateJeonse — 경계값과 방어", () => {
  it("이자율 0%면 전세 비용은 0이고 월세 비용은 월세뿐이다", () => {
    const r = calculateJeonse({ ...base, interestRatePercent: 0 });
    expect(r.jeonse.totalCost).toBe(0);
    expect(r.wolse.totalCost).toBe(24_000_000);
    expect(r.cheaper).toBe("jeonse");
  });

  it("월세 0원, 보증금이 전세금과 같으면 두 조건이 같다", () => {
    const r = calculateJeonse({
      ...base,
      rentDeposit: 300_000_000,
      monthlyRent: 0,
    });
    expect(r.difference).toEqual({ annual: 0, monthly: 0, total: 0 });
    expect(r.cheaper).toBe("same");
  });

  it("계약 기간이 1년 미만이면 1년으로 본다", () => {
    const r = calculateJeonse({ ...base, years: 0 });
    expect(r.years).toBe(1);
    expect(r.jeonse.totalCost).toBe(12_000_000);
  });

  it("음수와 비정상 값은 0으로 처리한다", () => {
    const r = calculateJeonse({
      jeonseDeposit: -1,
      rentDeposit: Number.NaN,
      monthlyRent: -500,
      interestRatePercent: -3,
      years: 2,
    });
    expect(r.jeonse.totalCost).toBe(0);
    expect(r.wolse.totalCost).toBe(0);
    expect(r.cheaper).toBe("same");
  });

  it("모든 값이 0이면 결과도 0이다", () => {
    const r = calculateJeonse({
      jeonseDeposit: 0,
      rentDeposit: 0,
      monthlyRent: 0,
      interestRatePercent: 0,
      years: 0,
    });
    expect(r.jeonse.totalCost).toBe(0);
    expect(r.wolse.totalCost).toBe(0);
    expect(r.conversionRate).toBeNull();
  });
});
