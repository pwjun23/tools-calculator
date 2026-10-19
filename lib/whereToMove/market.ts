import { evaluateDeal, umdOf, type Derived } from "./judge";
import { man } from "./monthly-help";
import type { DealType } from "./types";

/** 시세 기준: 최근 6개월, 같은 평형 3건 이상, 중앙값의 70% 미만은 예외 거래, 전용면적 ±3㎡는 같은 평형. */
export const MARKET = { months: 6, minCount: 3, lowRatio: 0.7, areaBand: 3 } as const;

const EPS = 1e-6;

export type MarketInput = {
  type: DealType; sggCd: string; dong: string; apt: string; areaRaw: number; date: string;
  amount: number; rent: number; renewal: boolean; cancelled: boolean;
};

/** 매매는 매매끼리, 전세·월세는 전세 환산가로 한데 모은다(임대). 금액은 만원. */
export type Market = { basis: "매매" | "임대"; low: number; mid: number; high: number; count: number };

type Priced = { type: DealType; amount: number; rent: number };

/** 전세 환산가: 월세는 보증금 + 월세×12÷전환율, 전세·매매는 금액 그대로. */
export function jeonseEquivalent(d: Priced, convRate: number): number {
  return d.type === "월세" ? d.amount + (d.rent * 12) / convRate : d.amount;
}

const basisOf = (t: DealType): Market["basis"] => (t === "매매" ? "매매" : "임대");
const groupKey = (d: { type: DealType; sggCd: string; dong: string; apt: string }) => [d.sggCd, umdOf(d.dong), d.apt, basisOf(d.type)].join("|");

export function summarize(values: number[], basis: Market["basis"]): Market {
  const v = [...values].sort((a, b) => a - b);
  const n = v.length;
  const mid = n % 2 ? v[(n - 1) / 2] : (v[n / 2 - 1] + v[n / 2]) / 2;
  // 가운데 50% 범위. 예외 거래 한두 건에 흔들리지 않게 최솟값·최댓값을 쓰지 않는다.
  return { basis, low: v[Math.floor(0.25 * (n - 1))], mid, high: v[Math.ceil(0.75 * (n - 1))], count: n };
}

/**
 * from(계약일 YYYY-MM-DD) 이후 거래로 같은 단지·같은 평형 시세를 찾는 함수를 만든다.
 * 갱신 계약은 인상 폭이 묶여 시세보다 낮으므로 사용자 설정과 관계없이 뺀다. 3건 미만이면 null.
 */
export function marketIndex(deals: MarketInput[], from: string, convRate: number) {
  const groups = new Map<string, { areaRaw: number; value: number }[]>();
  for (const d of deals) {
    if (d.renewal || d.cancelled || d.date < from) continue;
    const k = groupKey(d);
    const list = groups.get(k) ?? [];
    list.push({ areaRaw: d.areaRaw, value: jeonseEquivalent(d, convRate) });
    groups.set(k, list);
  }
  return (d: Pick<MarketInput, "type" | "sggCd" | "dong" | "apt" | "areaRaw">): Market | null => {
    const same = (groups.get(groupKey(d)) ?? []).filter((x) => Math.abs(x.areaRaw - d.areaRaw) <= MARKET.areaBand + EPS);
    return same.length >= MARKET.minCount ? summarize(same.map((x) => x.value), basisOf(d.type)) : null;
  };
}

/** 그 거래의 (환산)가가 시세 중앙값의 70% 미만인지. */
export function belowMarket(d: Priced, m: Market | null, convRate: number): boolean {
  return !!m && jeonseEquivalent(d, convRate) < m.mid * MARKET.lowRatio;
}

/** 현금을 보증금으로 넣고 나머지(전세 환산 mid - 현금)를 월세로 낼 때의 월세와 판정. 현금이 mid 이상이면 null. */
export function wolseAt(p: Derived, mid: number) {
  if (p.cash <= 0 || mid <= p.cash) return null;
  const rent = Math.round(((mid - p.cash) * p.convRate) / 12);
  return { rent, ...evaluateDeal(p, { type: "월세", amount: p.cash, rent }) };
}

const verdict = (e: { ok: boolean; monthly: number; reasons: string[] }) =>
  e.ok ? `적합 · 월 부담 ${man(e.monthly)}` : `부적합(${e.reasons.join(", ")})`;

/**
 * 카드의 시세 줄. 같은 평형 범위, 시세(중앙값) 그대로 계약할 때의 판정,
 * 임대는 현금을 보증금으로 넣고 나머지를 월세로 낼 때의 어림값.
 */
export function marketLines(p: Derived, d: Priced, m: Market | null): string[] {
  if (!m) return [];
  const lines: string[] = [];
  if (belowMarket(d, m, p.convRate)) {
    const ratio = Math.round((jeonseEquivalent(d, p.convRate) / m.mid) * 100);
    lines.push(`⚠ 같은 평형 시세의 ${ratio}%인 거래입니다. 가족 간 계약·임대주택 등 특수한 거래일 수 있어 예산 판정에서 뺐습니다.`);
  }
  const rental = m.basis === "임대";
  const label = rental ? "전세(환산)" : "매매";
  lines.push(`같은 평형 최근 ${MARKET.months}개월 ${label} ${man(m.low)}~${man(m.high)} · 중앙 ${man(m.mid)} · ${m.count}건`);
  const kind = rental ? "전세" : "매매";
  lines.push(`시세 ${kind} ${man(m.mid)}이면: ${verdict(evaluateDeal(p, { type: kind, amount: m.mid, rent: 0 }))}`);
  const w = rental ? wolseAt(p, m.mid) : null;
  if (w) {
    const tail = w.ok ? `적합` : `부적합(${w.reasons.join(", ")})`;
    lines.push(`보증금 ${man(p.cash)} 월세면: 월세 약 ${man(w.rent)} · 월 부담 ${man(w.monthly)} → ${tail} · 전환율 연 ${Math.round(p.convRate * 1000) / 10}% 가정`);
  }
  return lines;
}
