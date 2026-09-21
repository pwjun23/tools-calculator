/**
 * 대출금 상환(매매) vs 전세 비교 계산기
 *
 * ⚠️ 취득세·재산세·종합부동산세는 1세대 1주택자 기준 법정 세율을 단순화해
 * 반영한 참고용 추정치다. 지방교육세·농어촌특별세, 세액공제(고령자·장기보유),
 * 취득세 감면 특례는 반영하지 않는다. 대출은 원금 상환 없이 이자만 내는
 * 것으로 가정하고, 집값·전세가는 거주 기간 동안 변하지 않는다고 가정한다.
 */

const ONE_EOK = 100_000_000;

/** 취득세율: 6억 이하 1%, 6~9억 구간 선형 증가, 9억 초과 3% (1주택자 기준) */
function getAcquisitionTaxRate(price: number): number {
  const eok = price / ONE_EOK;
  if (eok <= 6) return 0.01;
  if (eok <= 9) return (eok * (2 / 3) - 3) / 100;
  return 0.03;
}

export interface AcquisitionTaxResult {
  rate: number;
  amount: number;
}

export function calculateAcquisitionTax(price: number): AcquisitionTaxResult {
  if (price <= 0) return { rate: 0, amount: 0 };
  const rate = getAcquisitionTaxRate(price);
  return { rate, amount: Math.round(price * rate) };
}

/** 재산세: 과세표준(공시가격 × 공정시장가액비율 60%) 구간별 누진세율 */
const FAIR_MARKET_VALUE_RATIO = 0.6;
const PROPERTY_TAX_BRACKETS = [
  { upTo: 60_000_000, base: 0, over: 0, rate: 0.001 },
  { upTo: 150_000_000, base: 60_000, over: 60_000_000, rate: 0.0015 },
  { upTo: 300_000_000, base: 195_000, over: 150_000_000, rate: 0.0025 },
  { upTo: Infinity, base: 570_000, over: 300_000_000, rate: 0.004 },
] as const;

export function calculatePropertyTax(officialPrice: number): number {
  if (officialPrice <= 0) return 0;
  const taxBase = officialPrice * FAIR_MARKET_VALUE_RATIO;
  const bracket = PROPERTY_TAX_BRACKETS.find((b) => taxBase <= b.upTo)!;
  return Math.round(bracket.base + (taxBase - bracket.over) * bracket.rate);
}

/** 종합부동산세: 1세대 1주택자 12억 공제, 공정시장가액비율 60% */
const COMPREHENSIVE_TAX_DEDUCTION = 1_200_000_000;
const COMPREHENSIVE_FAIR_MARKET_VALUE_RATIO = 0.6;
const COMPREHENSIVE_TAX_BRACKETS = [
  { upTo: 300_000_000, base: 0, over: 0, rate: 0.005 },
  { upTo: 600_000_000, base: 1_500_000, over: 300_000_000, rate: 0.007 },
  { upTo: 1_200_000_000, base: 3_600_000, over: 600_000_000, rate: 0.01 },
  { upTo: 2_500_000_000, base: 9_600_000, over: 1_200_000_000, rate: 0.013 },
  { upTo: Infinity, base: 26_500_000, over: 2_500_000_000, rate: 0.015 },
] as const;

export function calculateComprehensiveTax(officialPrice: number): number {
  const excess = officialPrice - COMPREHENSIVE_TAX_DEDUCTION;
  if (excess <= 0) return 0;
  const taxBase = excess * COMPREHENSIVE_FAIR_MARKET_VALUE_RATIO;
  const bracket = COMPREHENSIVE_TAX_BRACKETS.find((b) => taxBase <= b.upTo)!;
  return Math.round(bracket.base + (taxBase - bracket.over) * bracket.rate);
}

/** 전세 중개보수 (주택 임대차 요율표, 상한요율 기준) */
const JEONSE_BROKERAGE_BRACKETS = [
  { upTo: 50_000_000, rate: 0.005, cap: 200_000 },
  { upTo: 100_000_000, rate: 0.004, cap: 300_000 },
  { upTo: 600_000_000, rate: 0.003, cap: Infinity },
  { upTo: Infinity, rate: 0.004, cap: Infinity },
] as const;

export function calculateJeonseBrokerageFee(deposit: number): number {
  if (deposit <= 0) return 0;
  const bracket = JEONSE_BROKERAGE_BRACKETS.find((b) => deposit <= b.upTo)!;
  return Math.round(Math.min(deposit * bracket.rate, bracket.cap));
}

/** 전세보증금 반환보증 연 보험료율 (HUG 아파트 기준 근사치) */
export const GUARANTEE_INSURANCE_ANNUAL_RATE = 0.0015;

export interface JeonseVsLoanInput {
  /** 아파트 가격 (원) */
  price: number;
  /** 거주 기간 (년) */
  years: number;
  /** 대출금리 (%) */
  loanRatePercent: number;
  /** LTV (%) */
  ltvPercent: number;
  /** 공시가격비율 (%) */
  officialPriceRatioPercent: number;
  /** 월 관리비 (원) */
  monthlyMaintenanceFee: number;
}

export type PurchaseCostKey =
  | "acquisitionTax"
  | "loanInterest"
  | "propertyTax"
  | "comprehensiveTax"
  | "maintenance";

export type JeonseCostKey = "brokerageFee" | "maintenance" | "guaranteeInsurance";

export interface CostItem<K> {
  key: K;
  total: number;
  monthly: number;
  /** 0~1, 해당 시나리오 총비용 대비 비중 */
  share: number;
}

export interface PurchaseResult {
  loanAmount: number;
  equity: number;
  officialPrice: number;
  acquisitionTax: AcquisitionTaxResult;
  annualPropertyTax: number;
  annualComprehensiveTax: number;
  items: CostItem<PurchaseCostKey>[];
  totalCost: number;
  monthlyAverageCost: number;
  /** 보유자산 (아파트가격, 시세 변동 없다고 가정) */
  ownedAsset: number;
}

export interface JeonseResult {
  /** 전세금 (아파트가격 × LTV로 근사) */
  deposit: number;
  brokerageFee: number;
  annualGuaranteeInsurance: number;
  items: CostItem<JeonseCostKey>[];
  totalCost: number;
  monthlyAverageCost: number;
}

export interface ComparisonResult {
  years: number;
  purchase: PurchaseResult;
  jeonse: JeonseResult;
  /** 구매 월평균비용 - 전세 월평균비용 (양수면 전세가 저렴) */
  monthlySavings: number;
  /** 구매 총비용 - 전세 총비용 (양수면 전세가 저렴) */
  totalSavings: number;
  /** 구매 보유자산 - 전세금 (양수면 구매 쪽 자산이 큼) */
  assetDifference: number;
}

const clampMin0 = (n: number) => (Number.isFinite(n) ? Math.max(0, n) : 0);

export function calculateJeonseVsLoan(input: JeonseVsLoanInput): ComparisonResult {
  const price = clampMin0(input.price);
  const years = Math.max(1, Math.floor(clampMin0(input.years)));
  const loanRate = clampMin0(input.loanRatePercent) / 100;
  const ltv = clampMin0(input.ltvPercent) / 100;
  const officialPriceRatio = clampMin0(input.officialPriceRatioPercent) / 100;
  const monthlyFee = clampMin0(input.monthlyMaintenanceFee);
  const months = years * 12;

  const loanAmount = Math.round(price * ltv);
  const equity = price - loanAmount;
  const officialPrice = Math.round(price * officialPriceRatio);

  const acquisitionTax = calculateAcquisitionTax(price);
  const annualLoanInterest = Math.round(loanAmount * loanRate);
  const annualPropertyTax = calculatePropertyTax(officialPrice);
  const annualComprehensiveTax = calculateComprehensiveTax(officialPrice);
  const annualMaintenance = monthlyFee * 12;

  const totalLoanInterest = annualLoanInterest * years;
  const totalPropertyTax = annualPropertyTax * years;
  const totalComprehensiveTax = annualComprehensiveTax * years;
  const purchaseMaintenance = annualMaintenance * years;

  const purchaseTotal =
    acquisitionTax.amount +
    totalLoanInterest +
    totalPropertyTax +
    totalComprehensiveTax +
    purchaseMaintenance;

  const makePurchaseItem = (
    key: PurchaseCostKey,
    total: number,
  ): CostItem<PurchaseCostKey> => ({
    key,
    total,
    monthly: Math.round(total / months),
    share: purchaseTotal > 0 ? total / purchaseTotal : 0,
  });

  const purchase: PurchaseResult = {
    loanAmount,
    equity,
    officialPrice,
    acquisitionTax,
    annualPropertyTax,
    annualComprehensiveTax,
    items: [
      makePurchaseItem("acquisitionTax", acquisitionTax.amount),
      makePurchaseItem("loanInterest", totalLoanInterest),
      makePurchaseItem("propertyTax", totalPropertyTax),
      makePurchaseItem("comprehensiveTax", totalComprehensiveTax),
      makePurchaseItem("maintenance", purchaseMaintenance),
    ],
    totalCost: purchaseTotal,
    monthlyAverageCost: Math.round(purchaseTotal / months),
    ownedAsset: price,
  };

  const deposit = loanAmount;
  const brokerageFee = calculateJeonseBrokerageFee(deposit);
  const annualGuaranteeInsurance = Math.round(
    deposit * GUARANTEE_INSURANCE_ANNUAL_RATE,
  );
  const totalGuaranteeInsurance = annualGuaranteeInsurance * years;
  const jeonseMaintenance = annualMaintenance * years;

  const jeonseTotal = brokerageFee + jeonseMaintenance + totalGuaranteeInsurance;

  const makeJeonseItem = (
    key: JeonseCostKey,
    total: number,
  ): CostItem<JeonseCostKey> => ({
    key,
    total,
    monthly: Math.round(total / months),
    share: jeonseTotal > 0 ? total / jeonseTotal : 0,
  });

  const jeonse: JeonseResult = {
    deposit,
    brokerageFee,
    annualGuaranteeInsurance,
    items: [
      makeJeonseItem("brokerageFee", brokerageFee),
      makeJeonseItem("maintenance", jeonseMaintenance),
      makeJeonseItem("guaranteeInsurance", totalGuaranteeInsurance),
    ],
    totalCost: jeonseTotal,
    monthlyAverageCost: Math.round(jeonseTotal / months),
  };

  return {
    years,
    purchase,
    jeonse,
    monthlySavings: purchase.monthlyAverageCost - jeonse.monthlyAverageCost,
    totalSavings: purchase.totalCost - jeonse.totalCost,
    assetDifference: purchase.ownedAsset - jeonse.deposit,
  };
}
