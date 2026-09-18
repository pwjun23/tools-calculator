/**
 * 자동차 유지비 계산기 (휘발유 승용차, 신차 기준)
 *
 * ⚠️ 보험료·정비비·등록 부대비용의 계수(ESTIMATES)는 공식 통계가 아니라
 * 대략적으로 잡은 추정치다. 실제 견적을 알면 UI에서 직접 입력해 덮어쓴다.
 * 자동차세·취득세는 법정 세율을 따르지만 차령 경감, 연납 할인, 경차 취득세
 * 감면, 공채 지역별 차등은 반영하지 않는다.
 */

/** 자동차세 (비영업용 승용): 배기량 구간별 cc당 세액 */
const CAR_TAX_BRACKETS = [
  { upToCc: 1000, ratePerCc: 80 },
  { upToCc: 1600, ratePerCc: 140 },
  { upToCc: Infinity, ratePerCc: 200 },
] as const;
/** 지방교육세: 자동차세의 30% */
const EDUCATION_TAX_PERCENT = 30;

/** 취득세율 (%): 비영업용 승용 7%, 경차(1,000cc 미만) 4% */
const ACQUISITION_TAX_PERCENT = 7;
const LIGHT_CAR_ACQUISITION_TAX_PERCENT = 4;
const LIGHT_CAR_MAX_CC = 1000;

/** 추정 계수 (공식 통계 아님) */
export const ESTIMATES = {
  insurance: { base: 400_000, priceRate: 0.012, roundTo: 10_000 },
  registration: { fixed: 40_000, priceRate: 0.005, roundTo: 1_000 },
  engineOil: { intervalKm: 10_000, costPerChange: 100_000 },
  tire: { intervalKm: 50_000 },
  /** 가격대별 타이어 한 세트 가격과 연 점검·소모품비 */
  maintenanceTiers: [
    { below: 20_000_000, tireSet: 500_000, service: 150_000 },
    { below: 50_000_000, tireSet: 800_000, service: 200_000 },
    { below: Infinity, tireSet: 1_400_000, service: 350_000 },
  ],
} as const;

export interface CarInput {
  /** 차량 가격 (원, 부가세 포함) */
  price: number;
  /** 배기량 (cc) */
  displacement: number;
  /** 연간 주행거리 (km) */
  annualKm: number;
  /** 연비 (km/L) */
  fuelEfficiency: number;
  /** 휘발유 가격 (원/L) */
  fuelPrice: number;
  /** 보유 기간 (년) — 초기 비용을 나눌 기간 */
  holdingYears: number;
  /** 연 보험료 직접 입력 (0 또는 미입력이면 추정값 사용) */
  insuranceOverride?: number;
  /** 연 정비비 직접 입력 (0 또는 미입력이면 추정값 사용) */
  maintenanceOverride?: number;
}

export type CostKey = "fuel" | "insurance" | "maintenance" | "carTax" | "initial";

export interface CostItem {
  key: CostKey;
  annual: number;
  monthly: number;
  /** 0~1, 총 유지비 대비 비중 */
  share: number;
  /** 추정값에 기반한 항목인지 */
  estimated: boolean;
}

export interface CarTaxResult {
  ratePerCc: number;
  baseTax: number;
  educationTax: number;
  total: number;
}

export interface AcquisitionTaxResult {
  /** 부가세를 뺀 과세표준 */
  taxBase: number;
  rate: number;
  tax: number;
}

export interface MaintenanceEstimate {
  engineOil: number;
  tires: number;
  service: number;
  total: number;
}

export interface CarResult {
  items: CostItem[];
  /** 초기 비용 분할분을 뺀, 매년 반복되는 비용 합계 */
  recurringAnnual: number;
  annualTotal: number;
  monthlyTotal: number;
  initial: {
    acquisitionTax: number;
    acquisitionTaxRate: number;
    taxBase: number;
    registrationCost: number;
    total: number;
    holdingYears: number;
    /** 초기 비용 ÷ 보유 기간 (연) */
    annualized: number;
  };
  carTax: CarTaxResult;
  maintenanceEstimate: MaintenanceEstimate;
}

const clampMin0 = (n: number) => (Number.isFinite(n) ? Math.max(0, n) : 0);
const roundTo = (n: number, unit: number) => Math.round(n / unit) * unit;
const monthlyOf = (annual: number) => Math.round(annual / 12);

export function calculateCarTax(displacement: number): CarTaxResult {
  const cc = clampMin0(displacement);
  const { ratePerCc } = CAR_TAX_BRACKETS.find((b) => cc <= b.upToCc)!;
  const baseTax = Math.floor(cc) * ratePerCc;
  const educationTax = Math.floor((baseTax * EDUCATION_TAX_PERCENT) / 100);
  return { ratePerCc, baseTax, educationTax, total: baseTax + educationTax };
}

export function calculateAcquisitionTax(
  price: number,
  displacement: number,
): AcquisitionTaxResult {
  // 정수 연산으로 부가세(10%)를 뺀 과세표준을 구한다 (부동소수점 오차 방지).
  const taxBase = Math.floor((clampMin0(price) * 10) / 11);
  const percent =
    displacement < LIGHT_CAR_MAX_CC
      ? LIGHT_CAR_ACQUISITION_TAX_PERCENT
      : ACQUISITION_TAX_PERCENT;
  const tax = Math.floor((taxBase * percent) / 100 / 10) * 10;
  return { taxBase, rate: percent / 100, tax };
}

export function calculateFuelCost(
  annualKm: number,
  fuelEfficiency: number,
  fuelPrice: number,
): number {
  if (fuelEfficiency <= 0) return 0;
  return Math.round(
    (clampMin0(annualKm) / fuelEfficiency) * clampMin0(fuelPrice),
  );
}

export function estimateInsurance(price: number): number {
  if (price <= 0) return 0;
  const { base, priceRate, roundTo: unit } = ESTIMATES.insurance;
  return roundTo(base + price * priceRate, unit);
}

export function estimateRegistrationCost(price: number): number {
  if (price <= 0) return 0;
  const { fixed, priceRate, roundTo: unit } = ESTIMATES.registration;
  return roundTo(fixed + price * priceRate, unit);
}

export function estimateMaintenance(
  price: number,
  annualKm: number,
): MaintenanceEstimate {
  if (price <= 0) return { engineOil: 0, tires: 0, service: 0, total: 0 };

  const km = clampMin0(annualKm);
  const tier = ESTIMATES.maintenanceTiers.find((t) => price < t.below)!;
  const engineOil = Math.round(
    (km / ESTIMATES.engineOil.intervalKm) * ESTIMATES.engineOil.costPerChange,
  );
  const tires = Math.round((km / ESTIMATES.tire.intervalKm) * tier.tireSet);
  const service = tier.service;
  return { engineOil, tires, service, total: engineOil + tires + service };
}

export function calculateCarCosts(input: CarInput): CarResult {
  const price = clampMin0(input.price);
  const holdingYears = Math.max(1, Math.floor(clampMin0(input.holdingYears)));

  const fuel = calculateFuelCost(
    input.annualKm,
    input.fuelEfficiency,
    input.fuelPrice,
  );
  const carTax = calculateCarTax(input.displacement);

  const insuranceGiven = (input.insuranceOverride ?? 0) > 0;
  const insurance = insuranceGiven
    ? input.insuranceOverride!
    : estimateInsurance(price);

  const maintenanceEstimate = estimateMaintenance(price, input.annualKm);
  const maintenanceGiven = (input.maintenanceOverride ?? 0) > 0;
  const maintenance = maintenanceGiven
    ? input.maintenanceOverride!
    : maintenanceEstimate.total;

  const acquisition = calculateAcquisitionTax(price, input.displacement);
  const registrationCost = estimateRegistrationCost(price);
  const initialTotal = acquisition.tax + registrationCost;
  const initialAnnualized = Math.round(initialTotal / holdingYears);

  const recurringAnnual = fuel + insurance + maintenance + carTax.total;
  const annualTotal = recurringAnnual + initialAnnualized;

  const make = (
    key: CostKey,
    annual: number,
    estimated: boolean,
  ): CostItem => ({
    key,
    annual,
    monthly: monthlyOf(annual),
    share: annualTotal > 0 ? annual / annualTotal : 0,
    estimated,
  });

  return {
    items: [
      make("fuel", fuel, false),
      make("insurance", insurance, !insuranceGiven),
      make("maintenance", maintenance, !maintenanceGiven),
      make("carTax", carTax.total, false),
      make("initial", initialAnnualized, true),
    ],
    recurringAnnual,
    annualTotal,
    monthlyTotal: monthlyOf(annualTotal),
    initial: {
      acquisitionTax: acquisition.tax,
      acquisitionTaxRate: acquisition.rate,
      taxBase: acquisition.taxBase,
      registrationCost,
      total: initialTotal,
      holdingYears,
      annualized: initialAnnualized,
    },
    carTax,
    maintenanceEstimate,
  };
}
