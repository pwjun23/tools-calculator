/**
 * 전세 vs 월세 비용 비교 계산기
 *
 * 같은 집을 "전세"와 "월세(보증금 + 월세)" 두 조건으로 계약할 때의 비용을 비교한다.
 * 비용 = 보증금 이자(대출이자든 예금 기회비용이든 같은 이자율) + 월세.
 * 이자는 연 단위 단리로 계산하며, 중개수수료·관리비·대출 원금 상환·보증보험료·
 * 집값 변동·세제 혜택(월세 세액공제, 대출이자 소득공제)은 반영하지 않는다.
 */

/** 계약 기간별 비교 표에 항상 보여줄 기간 (임대차 통상 2년 + 갱신 2년) */
const PERIOD_ROWS = [1, 2, 3, 4];
/** 이자율별 비교 표에 항상 보여줄 이자율 (%) */
const RATE_ROWS = [3, 4, 5];

export interface JeonseInput {
  /** 전세금 (원) */
  jeonseDeposit: number;
  /** 월세 조건의 보증금 (원) */
  rentDeposit: number;
  /** 월세 (원/월) */
  monthlyRent: number;
  /** 이자율 (%), 예: 4 = 연 4% */
  interestRatePercent: number;
  /** 계약 기간 (년) */
  years: number;
}

export interface ScenarioCost {
  deposit: number;
  annualInterest: number;
  annualRent: number;
  annualCost: number;
  monthlyInterest: number;
  monthlyRent: number;
  monthlyCost: number;
  totalCost: number;
}

export interface CostDifference {
  annual: number;
  monthly: number;
  total: number;
}

export interface PeriodRow {
  years: number;
  jeonse: number;
  wolse: number;
  /** 월세 - 전세 (양수면 전세가 저렴) */
  difference: number;
}

export interface RateRow {
  ratePercent: number;
  jeonse: number;
  wolse: number;
  difference: number;
}

export interface JeonseResult {
  years: number;
  jeonse: ScenarioCost;
  wolse: ScenarioCost;
  /** 월세 - 전세. 양수면 월세가 더 비싸다 */
  difference: CostDifference;
  cheaper: "jeonse" | "wolse" | "same";
  /** 전월세 전환율 (%). 월세 보증금이 전세금 이상이면 null */
  conversionRate: number | null;
  /** 보증금을 낮추고 월세를 붙였을 때 월 비용 변화 */
  rentImpact: {
    depositReduction: number;
    monthlyInterestSaved: number;
    monthlyRentAdded: number;
    /** 월세 월 비용 - 전세 월 비용 */
    monthlyNet: number;
    /** 전세 월 비용 대비 증감률 (%). 전세 월 비용이 0이면 null */
    percentChange: number | null;
  };
  byPeriod: PeriodRow[];
  byRate: RateRow[];
}

const clean = (n: number) => (Number.isFinite(n) ? Math.max(0, n) : 0);

function scenario(
  deposit: number,
  monthlyRent: number,
  ratePercent: number,
  years: number,
): ScenarioCost {
  const annualInterest = Math.round((deposit * ratePercent) / 100);
  const annualRent = monthlyRent * 12;
  const monthlyInterest = Math.round(annualInterest / 12);
  return {
    deposit,
    annualInterest,
    annualRent,
    annualCost: annualInterest + annualRent,
    monthlyInterest,
    monthlyRent,
    monthlyCost: monthlyInterest + monthlyRent,
    totalCost: (annualInterest + annualRent) * years,
  };
}

/** 기본 행에 선택값이 없으면 끼워 넣고 오름차순으로 정렬한다. */
const withSelected = (rows: number[], selected: number) =>
  (rows.includes(selected) ? rows : [...rows, selected]).sort((a, b) => a - b);

export function calculateJeonse(input: JeonseInput): JeonseResult {
  const jeonseDeposit = clean(input.jeonseDeposit);
  const rentDeposit = clean(input.rentDeposit);
  const monthlyRent = clean(input.monthlyRent);
  const rate = clean(input.interestRatePercent);
  const years = Math.max(1, Math.floor(clean(input.years)));

  const jeonse = scenario(jeonseDeposit, 0, rate, years);
  const wolse = scenario(rentDeposit, monthlyRent, rate, years);

  const total = wolse.totalCost - jeonse.totalCost;
  const depositReduction = jeonseDeposit - rentDeposit;
  const monthlyNet = wolse.monthlyCost - jeonse.monthlyCost;

  return {
    years,
    jeonse,
    wolse,
    difference: {
      annual: wolse.annualCost - jeonse.annualCost,
      monthly: monthlyNet,
      total,
    },
    cheaper: total > 0 ? "jeonse" : total < 0 ? "wolse" : "same",
    conversionRate:
      depositReduction > 0 ? ((monthlyRent * 12) / depositReduction) * 100 : null,
    rentImpact: {
      depositReduction,
      monthlyInterestSaved: jeonse.monthlyInterest - wolse.monthlyInterest,
      monthlyRentAdded: monthlyRent,
      monthlyNet,
      percentChange:
        jeonse.monthlyCost > 0 ? (monthlyNet / jeonse.monthlyCost) * 100 : null,
    },
    byPeriod: withSelected(PERIOD_ROWS, years).map((y) => ({
      years: y,
      jeonse: jeonse.annualCost * y,
      wolse: wolse.annualCost * y,
      difference: (wolse.annualCost - jeonse.annualCost) * y,
    })),
    byRate: withSelected(RATE_ROWS, rate).map((r) => {
      const j = scenario(jeonseDeposit, 0, r, years).totalCost;
      const w = scenario(rentDeposit, monthlyRent, r, years).totalCost;
      return { ratePercent: r, jeonse: j, wolse: w, difference: w - j };
    }),
  };
}
