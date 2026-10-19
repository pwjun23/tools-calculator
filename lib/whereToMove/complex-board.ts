import { isExcluded } from "./exclude";
import { evaluateDeal, inRegion, umdOf, type Derived } from "./judge";
import { MARKET, jeonseEquivalent, summarize, wolseAt, type Market } from "./market";
import { isRentalComplex } from "./rental";
import type { Settings } from "./settings";
import type { DealType } from "./types";

export type BoardInput = {
  type: DealType; sggCd: string; dong: string; apt: string; areaRaw: number; date: string;
  amount: number; rent: number; renewal: boolean; cancelled: boolean;
};

export type Verdict = { ok: boolean; monthly: number; reasons: string[] };
export type RentStatus = "전세 가능" | "월세면 가능" | "어려움";

/** 단지 시세판 한 줄: 단지 + 평형(전용 3㎡ 이내 묶음). 금액은 만원. */
export type BoardRow = {
  key: string; sggCd: string; dong: string; apt: string; areaLabel: string;
  /** 전세·월세(전세 환산) 시세. 3건 미만이면 null. */
  rent: Market | null;
  /** 매매 시세. 3건 미만이면 null. */
  buy: Market | null;
  /** 전세 중앙값 그대로 계약할 때 */
  jeonse: Verdict | null;
  /** 현금을 보증금으로 넣고 나머지를 월세로 낼 때(전환율 가정) */
  wolse: (Verdict & { rent: number }) | null;
  /** 매매 중앙값 그대로 살 때 */
  buyVerdict: Verdict | null;
  status: RentStatus | null;
};

const verdictOf = (e: Verdict): Verdict => ({ ok: e.ok, monthly: e.monthly, reasons: e.reasons });

/** 같은 단지 안에서 면적 순으로 놓고, 묶음의 첫 면적과 3㎡ 넘게 차이 나면 새 평형으로 나눈다. */
function clusters<T extends { areaRaw: number }>(deals: T[]): T[][] {
  const sorted = [...deals].sort((a, b) => a.areaRaw - b.areaRaw);
  const out: T[][] = [];
  for (const d of sorted) {
    const cur = out[out.length - 1];
    if (cur && d.areaRaw - cur[0].areaRaw <= MARKET.areaBand + 1e-6) cur.push(d);
    else out.push([d]);
  }
  return out;
}

const areaLabel = (c: { areaRaw: number }[]) => {
  const lo = Math.round(c[0].areaRaw);
  const hi = Math.round(c[c.length - 1].areaRaw);
  return lo === hi ? `${lo}㎡` : `${lo}~${hi}㎡`;
};

/**
 * from(계약일) 이후 신규 계약으로 단지·평형별 시세와 예산 판정을 만든다.
 * 갱신·해제·임대주택·뺀 단지·설정 지역 밖·최소 면적 미달은 뺀다. 전세·월세 또는 매매가 3건 이상인 평형만 줄이 되고,
 * 둘 다 모자란 평형은 sparse 로 센다.
 */
export function complexBoard(deals: BoardInput[], s: Settings, p: Derived, from: string): { rows: BoardRow[]; sparse: number } {
  const groups = new Map<string, BoardInput[]>();
  for (const d of deals) {
    if (d.renewal || d.cancelled || d.date < from) continue;
    if (!inRegion(s, d) || isExcluded(s.excludedApts, d) || isRentalComplex(d.apt)) continue;
    if (s.minArea > 0 && d.areaRaw < s.minArea) continue;
    const k = [d.sggCd, umdOf(d.dong), d.apt].join("|");
    groups.set(k, [...(groups.get(k) ?? []), d]);
  }
  const rows: BoardRow[] = [];
  let sparse = 0;
  for (const [k, list] of groups) {
    for (const c of clusters(list)) {
      const rentVals = c.filter((d) => d.type !== "매매").map((d) => jeonseEquivalent(d, p.convRate));
      const buyVals = c.filter((d) => d.type === "매매").map((d) => d.amount);
      const rent = rentVals.length >= MARKET.minCount ? summarize(rentVals, "임대") : null;
      const buy = buyVals.length >= MARKET.minCount ? summarize(buyVals, "매매") : null;
      if (!rent && !buy) { sparse++; continue; }
      const jeonse = rent ? verdictOf(evaluateDeal(p, { type: "전세", amount: rent.mid, rent: 0 })) : null;
      const w = rent ? wolseAt(p, rent.mid) : null;
      const wolse = w ? { ...verdictOf(w), rent: w.rent } : null;
      const status: RentStatus | null = !jeonse ? null : jeonse.ok ? "전세 가능" : wolse?.ok ? "월세면 가능" : "어려움";
      const label = areaLabel(c);
      rows.push({
        key: `${k}|${label}`, sggCd: c[0].sggCd, dong: umdOf(c[0].dong), apt: c[0].apt, areaLabel: label,
        rent, buy, jeonse, wolse, buyVerdict: buy ? verdictOf(evaluateDeal(p, { type: "매매", amount: buy.mid, rent: 0 })) : null, status,
      });
    }
  }
  return { rows, sparse };
}

const RANK: Record<RentStatus, number> = { "전세 가능": 0, "월세면 가능": 1, "어려움": 2 };

/** 기준(임대·매매)에 시세가 있는 줄만, 가능한 곳 먼저·같으면 중앙값 낮은 순. */
export function sortBoard(rows: BoardRow[], basis: "임대" | "매매"): BoardRow[] {
  if (basis === "임대") {
    return rows.filter((r) => r.rent && r.status).sort((a, b) => RANK[a.status!] - RANK[b.status!] || a.rent!.mid - b.rent!.mid);
  }
  return rows.filter((r) => r.buy).sort((a, b) => Number(b.buyVerdict!.ok) - Number(a.buyVerdict!.ok) || a.buy!.mid - b.buy!.mid);
}
