import { umdOf } from "./judge";
import { MARKET } from "./market";
import { man } from "./monthly-help";
import type { DealType } from "./types";

/** 단지 이름으로 임대주택을 고른다. 이름에 표시가 없는 임대 단지는 놓친다. */
export const RENTAL_WORDS = ["뉴스테이", "임대", "행복주택"] as const;

export const isRentalComplex = (apt: string) => RENTAL_WORDS.some((w) => apt.includes(w));

export type TierInput = {
  type: DealType; sggCd: string; dong: string; apt: string; areaRaw: number; date: string;
  amount: number; rent: number; cancelled: boolean;
};

/** 임대주택에서 많이 쓰인 보증금/월세 조합. 금액·월세는 만원. */
export type Tier = { amount: number; rent: number; count: number };

const EPS = 1e-6;
const groupKey = (d: { sggCd: string; dong: string; apt: string }) => [d.sggCd, umdOf(d.dong), d.apt].join("|");

/**
 * from(계약일) 이후 같은 단지·같은 평형(전용 ±3㎡)의 전세·월세 조합을 건수 순으로 3개 찾는 함수를 만든다.
 * 임대주택은 운영사가 정한 조합으로 계약하고 대부분 갱신이라 갱신도 센다. 한 번만 나온 조합은 뺀다.
 */
export function rentalTiers(deals: TierInput[], from: string) {
  const groups = new Map<string, TierInput[]>();
  for (const d of deals) {
    if (d.type === "매매" || d.cancelled || d.date < from) continue;
    const k = groupKey(d);
    groups.set(k, [...(groups.get(k) ?? []), d]);
  }
  return (d: Pick<TierInput, "sggCd" | "dong" | "apt" | "areaRaw">): Tier[] => {
    const counts = new Map<string, Tier>();
    for (const x of groups.get(groupKey(d)) ?? []) {
      if (Math.abs(x.areaRaw - d.areaRaw) > MARKET.areaBand + EPS) continue;
      const k = `${x.amount}/${x.rent}`;
      const t = counts.get(k) ?? { amount: x.amount, rent: x.rent, count: 0 };
      t.count++;
      counts.set(k, t);
    }
    return [...counts.values()]
      .filter((t) => t.count >= 2)
      .sort((a, b) => b.count - a.count || b.amount - a.amount)
      .slice(0, 3);
  };
}

const tierLabel = (t: Tier) => `${t.rent > 0 ? `${man(t.amount)}/${man(t.rent)}` : `전세 ${man(t.amount)}`} ${t.count}건`;

/** 임대주택 카드의 안내 줄과 조합 줄. */
export function rentalLines(tiers: Tier[]): string[] {
  const lines = ["임대주택 단지: 거래 대부분이 기존 입주자의 갱신 계약입니다. 새로 들어가려면 모집공고·운영사를 확인하세요."];
  if (tiers.length) lines.push(`같은 평형 최근 ${MARKET.months}개월 많은 조합: ${tiers.map(tierLabel).join(" · ")}`);
  return lines;
}

/** 임대주택 단지의 매매 신고(해제 제외)를 단지별로 센다. 분양 전환이 시작됐다는 공공 신호일 수 있다. */
export function rentalSales(deals: Pick<TierInput, "type" | "apt" | "cancelled">[]): { apt: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const d of deals) {
    if (d.type !== "매매" || d.cancelled || !isRentalComplex(d.apt)) continue;
    counts.set(d.apt, (counts.get(d.apt) ?? 0) + 1);
  }
  return [...counts].map(([apt, count]) => ({ apt, count }));
}
