import { umdOf } from "./dong";
import { isExcluded } from "./exclude";
import type { Settings } from "./settings";
import type { DealType } from "./types";

export interface JudgeParams {
  cash: number;
  budget: number;
  mgmt: number;
  fee: number;
  factor: number;
  rentRate: number;
  rentCap: number;
  mortgageCap: number;
  dsrMonthly: number;
  ltvBuy: number;
  ltvRent: number;
}

export interface Derived extends JudgeParams {
  available: number;
  existingMonthly: number;
  sellExtra: number;
  /** 월세 → 전세 환산 연 전환율 */
  convRate: number;
}

export type RejectReason = "대출 한도 초과" | "대출 비율 초과" | "DSR 초과" | "예산 초과" | "보증금 0원 신고" | "시세보다 크게 낮음";

export interface Evaluation {
  ok: boolean;
  loan: number;
  carry: number;
  monthly: number;
  margin: number;
  reasons: RejectReason[];
}

const EPS = 1e-9;
const HUGE = 1e9;

/** 원리금균등 월 상환액. 금리 0이면 원금 / 개월 수. */
export function monthlyPayment(balance: number, rate: number, years: number): number {
  const n = years * 12;
  if (n <= 0) return 0;
  if (rate === 0) return balance / n;
  const r = rate / 12;
  return (balance * r) / (1 - Math.pow(1 + r, -n));
}

/** 시트 '조건'·'내자산부채'의 계산값을 재현한다. */
export function deriveParams(s: Settings): Derived {
  const selling = s.ownedHome.has && s.ownedHome.planOnMove === "sell";
  const keeping = s.ownedHome.has && s.ownedHome.planOnMove === "keep";

  const remainingLoans = s.loans.filter((l) => !(selling && l.repaidIfHomeSold));
  const existingMonthly = remainingLoans.reduce(
    (sum, l) => sum + (l.repayment === "amortizing" ? monthlyPayment(l.balance, l.rate, l.years) : (l.balance * l.rate) / 12),
    0,
  );
  const repaidOnSale = s.loans.filter((l) => l.repaidIfHomeSold).reduce((sum, l) => sum + l.balance, 0);
  const sellExtra = selling ? Math.max(s.ownedHome.price * (1 - s.ownedHome.sellCostRate) - repaidOnSale, 0) : 0;

  const available = Math.max(s.monthlyBudget - s.monthlyMgmt, 0);
  const dsrMonthly =
    s.annualIncome > 0
      ? Math.min(available, Math.max(s.annualIncome * s.dsrRatio - existingMonthly * 12, 0) / 12)
      : available;

  return {
    cash: s.cash + sellExtra,
    budget: s.monthlyBudget,
    mgmt: s.monthlyMgmt,
    fee: s.buyFeeRate,
    factor: monthlyPayment(1, s.mortgageRate, s.mortgageYears),
    rentRate: s.rentLoanRate,
    rentCap: s.rentLoanCap,
    mortgageCap: s.mortgageCap,
    dsrMonthly,
    ltvBuy: keeping && !s.ownedHome.mortgageAllowedIfKept ? 0 : s.ltvBuy,
    ltvRent: keeping && !s.ownedHome.rentLoanAllowedIfKept ? 0 : s.ltvRent,
    available,
    existingMonthly,
    sellExtra,
    convRate: s.rentConvRate,
  };
}

/** Code.gs evaluateDeal_ 와 같은 판정. */
export function evaluateDeal(
  p: JudgeParams,
  d: { type: DealType; amount: number; rent: number },
  opts: { belowMarket?: boolean } = {},
): Evaluation {
  let loan: number;
  let ratioOk: boolean;
  let capOk: boolean;
  let carry: number;
  if (d.type === "매매") {
    loan = Math.max(d.amount * (1 + p.fee) - p.cash, 0);
    ratioOk = loan <= d.amount * p.ltvBuy + EPS;
    capOk = loan <= p.mortgageCap + EPS;
    carry = loan * p.factor;
  } else {
    loan = Math.max(d.amount - p.cash, 0);
    ratioOk = loan <= d.amount * p.ltvRent + EPS;
    capOk = loan <= p.rentCap + EPS;
    carry = (loan * p.rentRate) / 12;
  }
  const monthly = (d.type === "월세" ? d.rent : 0) + p.mgmt + carry;
  const reasons: RejectReason[] = [];
  if (!capOk) reasons.push("대출 한도 초과");
  if (!ratioOk) reasons.push("대출 비율 초과");
  if (carry > p.dsrMonthly + EPS) reasons.push("DSR 초과");
  if (monthly > p.budget + EPS) reasons.push("예산 초과");
  // 아파트 월세 보증금 0원은 대부분 신고 입력 오류라 월 부담이 실제보다 낮게 나온다.
  if (d.type === "월세" && d.amount <= 0) reasons.push("보증금 0원 신고");
  // 같은 평형 시세보다 크게 싼 거래는 가족 간 계약·임대주택 등 특수 거래일 수 있어 구할 수 있는 집으로 보지 않는다.
  if (opts.belowMarket) reasons.push("시세보다 크게 낮음");
  return { ok: reasons.length === 0, loan, carry, monthly, margin: p.budget - monthly, reasons };
}

export { umdOf } from "./dong";

type Filterable = { dong: string; apt: string; areaRaw: number; renewal: boolean; cancelled: boolean; sggCd: string };

/** 사용자가 고른 시·군·구·읍·면·동 안의 거래인지. */
export function inRegion(s: Settings, d: Pick<Filterable, "sggCd" | "dong">): boolean {
  const region = s.regions.find((r) => r.sggCd === d.sggCd);
  return !!region && region.dongs.includes(umdOf(d.dong));
}

/**
 * 사용자 지역·면적·갱신 조건, 뺀 단지, 해제 여부로 거른다.
 * keepRenewal 이 참인 거래(예: 갱신이 대부분인 임대주택)는 갱신 제외 설정이어도 남긴다.
 */
export function filterDeals<T extends Filterable>(s: Settings, deals: T[], opts: { keepRenewal?: (d: T) => boolean } = {}): T[] {
  return deals.filter((d) => {
    if (d.cancelled) return false;
    if (!inRegion(s, d)) return false;
    if (isExcluded(s.excludedApts, d)) return false;
    if (s.minArea > 0 && d.areaRaw < s.minArea) return false;
    if (s.excludeRenewal && d.renewal && !opts.keepRenewal?.(d)) return false;
    return true;
  });
}

const floor10 = (v: number) => Math.floor(v / 10) * 10;

/** 시트 '한도계산'의 전세금 상한·매매가 상한. */
export function priceLimits(p: JudgeParams): { jeonseMax: number; buyMax: number } {
  const jeonseByDsr = p.rentRate > 0 ? p.cash + (p.dsrMonthly * 12) / p.rentRate : HUGE;
  const jeonseByRatio = p.ltvRent < 1 ? p.cash / (1 - p.ltvRent) : HUGE;
  const jeonseByCap = p.cash + p.rentCap;

  const buyByDsr = p.factor > 0 ? (p.cash + p.dsrMonthly / p.factor) / (1 + p.fee) : HUGE;
  const buyByRatio = 1 + p.fee - p.ltvBuy > 0 ? p.cash / (1 + p.fee - p.ltvBuy) : HUGE;
  const buyByCap = (p.cash + p.mortgageCap) / (1 + p.fee);

  return {
    jeonseMax: floor10(Math.min(jeonseByDsr, jeonseByRatio, jeonseByCap)),
    buyMax: floor10(Math.min(buyByDsr, buyByRatio, buyByCap)),
  };
}
