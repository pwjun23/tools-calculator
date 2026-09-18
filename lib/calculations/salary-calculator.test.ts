import { describe, expect, it } from "vitest";
import {
  calculateChildTaxCredit,
  calculateEarnedIncomeDeduction,
  calculateEarnedIncomeTaxCredit,
  calculateProgressiveTax,
  calculateSalary,
} from "./salary-calculator";

describe("calculateEarnedIncomeDeduction (근로소득공제)", () => {
  it.each([
    [0, 0],
    [5_000_000, 3_500_000], // 500만 이하: 70%
    [10_000_000, 5_500_000], // 350만 + 500만 초과분 40%
    [15_000_000, 7_500_000],
    [45_000_000, 12_000_000], // 750만 + 1500만 초과분 15%
    [100_000_000, 14_750_000], // 1200만 + 4500만 초과분 5%
  ])("총급여 %i원 → 공제 %i원", (gross, expected) => {
    expect(calculateEarnedIncomeDeduction(gross)).toBe(expected);
  });

  it("4500만 초과 구간은 5%를 적용한다", () => {
    expect(calculateEarnedIncomeDeduction(47_600_000)).toBe(12_130_000);
  });

  it("1억 초과 구간은 2%를 적용하고 2,000만원을 넘지 못한다", () => {
    expect(calculateEarnedIncomeDeduction(150_000_000)).toBe(15_750_000);
    expect(calculateEarnedIncomeDeduction(500_000_000)).toBe(20_000_000);
  });
});

describe("calculateProgressiveTax (종합소득세 누진세율)", () => {
  it.each([
    [0, 0],
    [14_000_000, 840_000], // 6%
    [50_000_000, 6_240_000], // 15% - 126만
    [88_000_000, 15_360_000], // 24% - 576만
    [150_000_000, 37_060_000], // 35% - 1,544만
    [300_000_000, 94_060_000], // 38% - 1,994만
    [500_000_000, 174_060_000], // 40% - 2,594만
    [1_000_000_000, 384_060_000], // 42% - 3,594만
    [2_000_000_000, 834_060_000], // 45% - 6,594만
  ])("과세표준 %i원 → 산출세액 %i원", (base, expected) => {
    expect(calculateProgressiveTax(base)).toBe(expected);
  });

  it("음수 과세표준은 0원으로 처리한다", () => {
    expect(calculateProgressiveTax(-1_000)).toBe(0);
  });
});

describe("calculateEarnedIncomeTaxCredit (근로소득세액공제)", () => {
  it("산출세액 130만원 이하는 55%를 공제한다", () => {
    expect(calculateEarnedIncomeTaxCredit(1_000_000, 30_000_000)).toBe(550_000);
  });

  it("산출세액 130만원 초과분은 30%를 추가로 공제한다", () => {
    // 71.5만 + (200만-130만)*30% = 92.5만 이지만 총급여 3,300만 이하 한도 74만
    expect(calculateEarnedIncomeTaxCredit(2_000_000, 30_000_000)).toBe(740_000);
  });

  it.each([
    [33_000_000, 740_000],
    [47_600_000, 660_000], // 74만 - (4,760만-3,300만)*0.8% = 62.32만 → 최소 66만
    [70_000_000, 660_000],
    [100_000_000, 500_000],
    [120_000_000, 500_000],
    [150_000_000, 200_000],
  ])("총급여 %i원의 한도는 %i원이다", (gross, limit) => {
    expect(calculateEarnedIncomeTaxCredit(50_000_000, gross)).toBe(limit);
  });

  it("산출세액이 0이면 공제도 0이다", () => {
    expect(calculateEarnedIncomeTaxCredit(0, 30_000_000)).toBe(0);
  });
});

describe("calculateChildTaxCredit (자녀세액공제)", () => {
  it.each([
    [0, 0],
    [1, 250_000],
    [2, 550_000],
    [3, 950_000],
    [4, 1_350_000],
  ])("자녀 %i명 → %i원", (children, expected) => {
    expect(calculateChildTaxCredit(children)).toBe(expected);
  });
});

describe("calculateSalary (통합)", () => {
  const base = {
    amount: 50_000_000,
    period: "year" as const,
    dependents: 1,
    children: 0,
    monthlyNonTaxable: 200_000,
  };

  it("연봉 5,000만원 / 부양가족 1명 / 비과세 20만원 — 세부 항목", () => {
    const r = calculateSalary(base);

    expect(r.monthly.nationalPension).toBe(178_490);
    expect(r.monthly.healthInsurance).toBe(140_610);
    expect(r.monthly.longTermCare).toBe(18_200);
    expect(r.monthly.employmentInsurance).toBe(35_690);

    expect(r.taxDetail.taxableGross).toBe(47_600_000);
    expect(r.taxDetail.earnedIncomeDeduction).toBe(12_130_000);
    expect(r.taxDetail.personalDeduction).toBe(1_500_000);
    expect(r.taxDetail.insuranceDeduction).toBe(4_475_880);
    expect(r.taxDetail.taxableBase).toBe(29_494_120);
    expect(r.taxDetail.bracketRate).toBe(0.15);
    expect(r.taxDetail.calculatedTax).toBe(3_164_118);
    expect(r.taxDetail.earnedIncomeTaxCredit).toBe(660_000);
    expect(r.taxDetail.standardTaxCredit).toBe(130_000);
    expect(r.taxDetail.determinedTax).toBe(2_374_110);

    expect(r.annual.incomeTax).toBe(2_374_110);
    expect(r.annual.localIncomeTax).toBe(237_410);
    expect(r.monthly.incomeTax).toBe(197_840);
    expect(r.monthly.localIncomeTax).toBe(19_780);
  });

  it("실수령액 = 총 지급액 - 모든 공제 합계", () => {
    const r = calculateSalary(base);
    const sum =
      r.annual.nationalPension +
      r.annual.healthInsurance +
      r.annual.longTermCare +
      r.annual.employmentInsurance +
      r.annual.incomeTax +
      r.annual.localIncomeTax;

    expect(r.annual.totalDeduction).toBe(sum);
    expect(r.annual.netPay).toBe(r.annual.gross - sum);
    expect(r.monthly.netPay).toBe(
      r.monthly.gross - r.monthly.totalDeduction,
    );
  });

  it("월급 입력은 12배한 연봉 입력과 같은 결과를 낸다", () => {
    const fromMonth = calculateSalary({ ...base, amount: 4_000_000, period: "month" });
    const fromYear = calculateSalary({ ...base, amount: 48_000_000 });

    expect(fromMonth).toEqual(fromYear);
  });

  it("국민연금은 기준소득월액 상한(637만원)을 넘지 않는다", () => {
    const r = calculateSalary({ ...base, amount: 300_000_000 });
    expect(r.monthly.nationalPension).toBe(286_650);
  });

  it("국민연금은 기준소득월액 하한(40만원)을 적용한다", () => {
    const r = calculateSalary({
      ...base,
      amount: 3_600_000,
      monthlyNonTaxable: 0,
    });
    expect(r.monthly.nationalPension).toBe(18_000);
    expect(r.monthly.employmentInsurance).toBe(2_700);
  });

  it("부양가족이 늘면 소득세가 줄어든다", () => {
    const one = calculateSalary(base);
    const three = calculateSalary({ ...base, dependents: 3 });
    expect(three.annual.incomeTax).toBeLessThan(one.annual.incomeTax);
  });

  it("자녀가 있으면 자녀세액공제만큼 세금이 줄어든다", () => {
    const noKids = calculateSalary({ ...base, dependents: 3 });
    const twoKids = calculateSalary({ ...base, dependents: 3, children: 2 });
    expect(twoKids.taxDetail.childTaxCredit).toBe(550_000);
    expect(twoKids.taxDetail.determinedTax).toBe(
      noKids.taxDetail.determinedTax - 550_000,
    );
  });

  it("자녀 수는 부양가족(본인 제외)을 넘을 수 없다", () => {
    const r = calculateSalary({ ...base, dependents: 1, children: 3 });
    expect(r.taxDetail.childTaxCredit).toBe(0);
  });

  it("0원 입력은 모두 0원이다", () => {
    const r = calculateSalary({ ...base, amount: 0 });
    expect(r.annual.netPay).toBe(0);
    expect(r.monthly.netPay).toBe(0);
    expect(r.annual.totalDeduction).toBe(0);
    expect(r.taxDetail.determinedTax).toBe(0);
  });

  it("비과세액이 급여보다 커도 음수가 나오지 않는다", () => {
    const r = calculateSalary({ ...base, amount: 12_000_000, monthlyNonTaxable: 2_000_000 });
    expect(r.taxDetail.taxableGross).toBe(0);
    expect(r.annual.totalDeduction).toBe(0);
    expect(r.annual.netPay).toBe(12_000_000);
  });

  it("소득세는 결정세액이 음수여도 0원으로 처리한다", () => {
    const r = calculateSalary({ ...base, amount: 20_000_000, dependents: 4, children: 3 });
    expect(r.annual.incomeTax).toBe(0);
    expect(r.annual.localIncomeTax).toBe(0);
  });
});
