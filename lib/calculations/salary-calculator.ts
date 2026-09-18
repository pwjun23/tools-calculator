/**
 * 연봉 실수령액 계산기 (2025년 기준, 연말정산 방식 근사치)
 *
 * 요율·세율이 바뀌면 아래 상수만 수정하면 된다.
 * 실제 급여명세서의 원천징수액(간이세액표)이나 의료비·연금저축 등을 반영한
 * 최종 결정세액과는 차이가 날 수 있다.
 */

export const RATES_2025 = {
  /** 국민연금 근로자 부담률 (총 9%의 절반) */
  nationalPension: 0.045,
  /** 국민연금 기준소득월액 하한/상한 */
  pensionBaseMin: 400_000,
  pensionBaseMax: 6_370_000,
  /** 건강보험 근로자 부담률 (총 7.09%의 절반) */
  healthInsurance: 0.03545,
  /** 장기요양보험료율 (건강보험료 대비) */
  longTermCare: 0.1295,
  /** 고용보험(실업급여) 근로자 부담률 */
  employmentInsurance: 0.009,
  /** 지방소득세율 (소득세의 10%) */
  localIncomeTax: 0.1,
  /** 인적공제 1인당 금액 */
  personalDeductionPerPerson: 1_500_000,
  /** 근로자 표준세액공제 */
  standardTaxCredit: 130_000,
} as const;

/** 근로소득공제 구간: 총급여 상한, 구간 시작 공제액, 구간 시작 금액, 초과분 공제율 */
const EARNED_INCOME_DEDUCTION_BRACKETS = [
  { upTo: 5_000_000, base: 0, from: 0, rate: 0.7 },
  { upTo: 15_000_000, base: 3_500_000, from: 5_000_000, rate: 0.4 },
  { upTo: 45_000_000, base: 7_500_000, from: 15_000_000, rate: 0.15 },
  { upTo: 100_000_000, base: 12_000_000, from: 45_000_000, rate: 0.05 },
  { upTo: Infinity, base: 14_750_000, from: 100_000_000, rate: 0.02 },
] as const;
const EARNED_INCOME_DEDUCTION_LIMIT = 20_000_000;

/** 종합소득세 누진세율 (과세표준 상한, 세율, 누진공제액) */
export const TAX_BRACKETS = [
  { upTo: 14_000_000, rate: 0.06, deduction: 0 },
  { upTo: 50_000_000, rate: 0.15, deduction: 1_260_000 },
  { upTo: 88_000_000, rate: 0.24, deduction: 5_760_000 },
  { upTo: 150_000_000, rate: 0.35, deduction: 15_440_000 },
  { upTo: 300_000_000, rate: 0.38, deduction: 19_940_000 },
  { upTo: 500_000_000, rate: 0.4, deduction: 25_940_000 },
  { upTo: 1_000_000_000, rate: 0.42, deduction: 35_940_000 },
  { upTo: Infinity, rate: 0.45, deduction: 65_940_000 },
] as const;

export type SalaryPeriod = "year" | "month";

export interface SalaryInput {
  /** 입력 금액 (원). period가 month면 월급, year면 연봉 (비과세 포함 총 지급액) */
  amount: number;
  period: SalaryPeriod;
  /** 부양가족 수 (본인 포함, 최소 1) */
  dependents: number;
  /** 자녀 수 (8세 이상 20세 이하, 부양가족에 포함) */
  children: number;
  /** 월 비과세액 (식대 등) */
  monthlyNonTaxable: number;
}

export interface Breakdown {
  gross: number;
  nationalPension: number;
  healthInsurance: number;
  longTermCare: number;
  employmentInsurance: number;
  incomeTax: number;
  localIncomeTax: number;
  totalDeduction: number;
  netPay: number;
}

export interface TaxDetail {
  /** 총급여 (연 지급액 - 비과세) */
  taxableGross: number;
  earnedIncomeDeduction: number;
  personalDeduction: number;
  /** 연금·건강·고용보험료 소득공제 합계 */
  insuranceDeduction: number;
  taxableBase: number;
  bracketRate: number;
  calculatedTax: number;
  earnedIncomeTaxCredit: number;
  childTaxCredit: number;
  standardTaxCredit: number;
  determinedTax: number;
}

export interface SalaryResult {
  annual: Breakdown;
  monthly: Breakdown;
  taxDetail: TaxDetail;
}

const floorTo10 = (n: number) => Math.floor(n / 10) * 10;
const clampMin0 = (n: number) => Math.max(0, n);

export function calculateEarnedIncomeDeduction(taxableGross: number): number {
  if (taxableGross <= 0) return 0;
  const bracket = EARNED_INCOME_DEDUCTION_BRACKETS.find(
    (b) => taxableGross <= b.upTo,
  )!;
  const deduction = bracket.base + (taxableGross - bracket.from) * bracket.rate;
  return Math.min(Math.floor(deduction), EARNED_INCOME_DEDUCTION_LIMIT);
}

export function getTaxBracket(taxableBase: number) {
  return TAX_BRACKETS.find((b) => taxableBase <= b.upTo)!;
}

export function calculateProgressiveTax(taxableBase: number): number {
  if (taxableBase <= 0) return 0;
  const { rate, deduction } = getTaxBracket(taxableBase);
  return Math.floor(taxableBase * rate - deduction);
}

export function calculateEarnedIncomeTaxCredit(
  calculatedTax: number,
  taxableGross: number,
): number {
  if (calculatedTax <= 0) return 0;

  const credit =
    calculatedTax <= 1_300_000
      ? calculatedTax * 0.55
      : 715_000 + (calculatedTax - 1_300_000) * 0.3;

  let limit: number;
  if (taxableGross <= 33_000_000) {
    limit = 740_000;
  } else if (taxableGross <= 70_000_000) {
    limit = Math.max(660_000, 740_000 - (taxableGross - 33_000_000) * 0.008);
  } else if (taxableGross <= 120_000_000) {
    limit = Math.max(500_000, 660_000 - (taxableGross - 70_000_000) * 0.5);
  } else {
    limit = Math.max(200_000, 500_000 - (taxableGross - 120_000_000) * 0.5);
  }

  return Math.floor(Math.min(credit, limit));
}

export function calculateChildTaxCredit(children: number): number {
  if (children <= 0) return 0;
  if (children === 1) return 250_000;
  if (children === 2) return 550_000;
  return 550_000 + (children - 2) * 400_000;
}

export function calculateSalary(input: SalaryInput): SalaryResult {
  const r = RATES_2025;
  const annualGross = Math.floor(
    clampMin0(input.period === "month" ? input.amount * 12 : input.amount),
  );
  const monthlyGross = Math.floor(annualGross / 12);

  const monthlyNonTaxable = Math.min(
    clampMin0(input.monthlyNonTaxable),
    monthlyGross,
  );
  const taxableGross = annualGross - monthlyNonTaxable * 12;
  const monthlyBase = Math.floor(taxableGross / 12);

  // 4대보험 (월 기준, 10원 미만 절사)
  const isEmployed = monthlyBase > 0;
  const nationalPension = isEmployed
    ? floorTo10(
        Math.min(Math.max(monthlyBase, r.pensionBaseMin), r.pensionBaseMax) *
          r.nationalPension,
      )
    : 0;
  const healthInsurance = floorTo10(monthlyBase * r.healthInsurance);
  const longTermCare = floorTo10(healthInsurance * r.longTermCare);
  const employmentInsurance = floorTo10(monthlyBase * r.employmentInsurance);

  // 소득세 (연말정산 방식)
  const dependents = Math.max(1, Math.floor(input.dependents));
  const children = Math.min(
    Math.max(0, Math.floor(input.children)),
    dependents - 1,
  );
  const earnedIncomeDeduction = calculateEarnedIncomeDeduction(taxableGross);
  const personalDeduction = r.personalDeductionPerPerson * dependents;
  const insuranceDeduction =
    (nationalPension + healthInsurance + longTermCare + employmentInsurance) *
    12;
  const taxableBase = clampMin0(
    taxableGross -
      earnedIncomeDeduction -
      personalDeduction -
      insuranceDeduction,
  );
  const calculatedTax = calculateProgressiveTax(taxableBase);
  const earnedIncomeTaxCredit = calculateEarnedIncomeTaxCredit(
    calculatedTax,
    taxableGross,
  );
  const childTaxCredit = calculateChildTaxCredit(children);
  const standardTaxCredit = calculatedTax > 0 ? r.standardTaxCredit : 0;
  const determinedTax = floorTo10(
    clampMin0(
      calculatedTax -
        earnedIncomeTaxCredit -
        childTaxCredit -
        standardTaxCredit,
    ),
  );
  const annualLocalTax = floorTo10(determinedTax * r.localIncomeTax);

  const monthlyIncomeTax = floorTo10(determinedTax / 12);
  const monthlyLocalTax = floorTo10(annualLocalTax / 12);

  const monthlyTotal =
    nationalPension +
    healthInsurance +
    longTermCare +
    employmentInsurance +
    monthlyIncomeTax +
    monthlyLocalTax;

  const annualTotal =
    (nationalPension + healthInsurance + longTermCare + employmentInsurance) *
      12 +
    determinedTax +
    annualLocalTax;

  return {
    monthly: {
      gross: monthlyGross,
      nationalPension,
      healthInsurance,
      longTermCare,
      employmentInsurance,
      incomeTax: monthlyIncomeTax,
      localIncomeTax: monthlyLocalTax,
      totalDeduction: monthlyTotal,
      netPay: monthlyGross - monthlyTotal,
    },
    annual: {
      gross: annualGross,
      nationalPension: nationalPension * 12,
      healthInsurance: healthInsurance * 12,
      longTermCare: longTermCare * 12,
      employmentInsurance: employmentInsurance * 12,
      incomeTax: determinedTax,
      localIncomeTax: annualLocalTax,
      totalDeduction: annualTotal,
      netPay: annualGross - annualTotal,
    },
    taxDetail: {
      taxableGross,
      earnedIncomeDeduction,
      personalDeduction,
      insuranceDeduction,
      taxableBase,
      bracketRate: getTaxBracket(taxableBase).rate,
      calculatedTax,
      earnedIncomeTaxCredit,
      childTaxCredit,
      standardTaxCredit,
      determinedTax,
    },
  };
}
