import type { Derived } from "./judge";
import type { DealType } from "./types";

const EPS = 1e-9;
const r1 = (v: number) => Math.round(v * 10) / 10;
/** 금액(만원): 1억 이상은 `3.56억`, 아래는 `5,000만`. */
export const man = (v: number) => (v >= 10000 ? `${Math.round(v / 100) / 100}억` : `${r1(v).toLocaleString("en-US")}만`);
const pct = (v: number) => `${Math.round(v * 1000) / 10}%`;
const pass = (ok: boolean) => (ok ? "통과" : "초과");

export type MonthlyCalc = { p: Derived; rates: { mortgageRate: number; mortgageYears: number } };

/** 월 부담 ⓘ 설명: 그 거래의 숫자를 넣은 계산 과정. judge.evaluateDeal 과 같은 식이다. */
export function explainMonthly(
  p: Derived,
  rates: { mortgageRate: number; mortgageYears: number },
  d: { type: DealType; amount: number; rent: number },
): string[] {
  const buy = d.type === "매매";
  const base = buy ? d.amount * (1 + p.fee) : d.amount;
  const loan = Math.max(base - p.cash, 0);
  const carry = buy ? loan * p.factor : (loan * p.rentRate) / 12;
  const monthly = (d.type === "월세" ? d.rent : 0) + p.mgmt + carry;
  const margin = p.budget - monthly;
  const ltv = buy ? p.ltvBuy : p.ltvRent;
  const cap = buy ? p.mortgageCap : p.rentCap;
  const what = buy ? "매매가" : "보증금";

  const lines: string[] = [];
  if (d.type === "월세" && d.amount <= 0) lines.push("⚠ 보증금이 0원으로 신고된 거래입니다. 신고 입력 오류일 수 있어 실제 월 부담은 더 클 수 있습니다.");
  const head = buy ? `매매가 ${man(d.amount)} × (1 + 취득 비용 ${pct(p.fee)})` : `${what} ${man(d.amount)}`;
  lines.push(loan > 0 ? `필요 대출 = ${head} − 현금 ${man(p.cash)} = ${man(loan)}` : `필요 대출 = ${head} − 현금 ${man(p.cash)} → 0 (현금으로 충분)`);
  if (loan > 0) {
    lines.push(
      buy
        ? `월 상환 = ${man(loan)}, 연 ${pct(rates.mortgageRate)}, ${rates.mortgageYears}년 원리금균등 = ${man(carry)}`
        : `월 이자 = ${man(loan)} × 연 ${pct(p.rentRate)} ÷ 12 = ${man(carry)}`,
    );
  }
  const parts = [
    ...(d.type === "월세" ? [`월세 ${man(d.rent)}`] : []),
    ...(loan > 0 ? [`${buy ? "대출 상환" : "대출 이자"} ${man(carry)}`] : []),
    `관리비 ${man(p.mgmt)}`,
  ];
  lines.push(`월 부담 = ${parts.join(" + ")} = ${man(monthly)}`);
  lines.push(`월 예산 ${man(p.budget)} − 월 부담 ${man(monthly)} = ${margin >= -EPS ? `여유 ${man(Math.max(margin, 0))}` : `초과 ${man(-margin)}`}`);
  if (loan > 0) {
    lines.push(`대출 한도: ${man(loan)} / 한도 ${man(cap)} → ${pass(loan <= cap + EPS)}`);
    lines.push(
      ltv <= 0
        ? "대출 비율: 대출 불가(설정의 기존 주택 조건) → 초과"
        : `대출 비율: ${Math.round((loan / d.amount) * 100)}% / 상한 ${pct(ltv)} → ${pass(loan <= d.amount * ltv + EPS)}`,
    );
    lines.push(`DSR: 월 ${buy ? "상환" : "이자"} ${man(carry)} / 상환 여력 ${man(p.dsrMonthly)} → ${pass(carry <= p.dsrMonthly + EPS)}`);
  }
  lines.push("금액은 만원, 금리·한도·관리비는 내 설정 값입니다. 실거래가 기준 어림값이며 대출 조언이 아닙니다.");
  return lines;
}
