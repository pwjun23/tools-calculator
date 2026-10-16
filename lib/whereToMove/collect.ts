import { recentMonths } from "./molit";
import type { MolitDeal } from "./types";

/** 최근 2개월은 매번, 지난 12개월 가운데 아직 받지 않은 달은 채우기 대상이다(최신순). */
export function monthsToCollect(now: Date, logged: Set<string>): { recent: string[]; backfill: string[] } {
  const recent = recentMonths(2, now);
  const backfill = recentMonths(12, now).filter((ym) => !recent.includes(ym) && !logged.has(ym));
  return { recent, backfill };
}

/** 처음 받는 달의 거래는 계약일을 처음 본 시각으로 둔다. 주간 알림의 '신규'에 섞이지 않게 하기 위해서다. */
export const backfillSeenAt = (date: string) => new Date(`${date}T00:00:00+09:00`);

export type CollectDeps = {
  fetchMonth(sggCd: string, ym: string): Promise<MolitDeal[]>;
  loggedMonths(sggCd: string): Promise<Set<string>>;
  upsert(deals: MolitDeal[], seenAt?: (d: MolitDeal) => Date): Promise<number>;
  markCollected(sggCd: string, ym: string): Promise<void>;
};

/** 한 시·군·구를 받는다. 실패한 달은 로그를 남기지 않아 다음에 다시 받는다. */
export async function collectRegion(sggCd: string, deps: CollectDeps, opts: { now: Date; maxBackfill: number }) {
  let logged: Set<string>;
  try {
    logged = await deps.loggedMonths(sggCd);
  } catch (e) {
    // DB 오류가 나도 다른 시·군·구 수집은 계속되게 예외를 던지지 않는다.
    console.error("[whereToMove collect]", sggCd, e);
    return { results: [{ ym: "", error: e instanceof Error ? e.message : String(e) }], backfilled: 0 };
  }
  const { recent, backfill } = monthsToCollect(opts.now, logged);
  const months = [...recent, ...backfill.slice(0, Math.max(0, opts.maxBackfill))];
  const results: { ym: string; count?: number; error?: string }[] = [];
  let backfilled = 0;
  for (const ym of months) {
    try {
      const deals = await deps.fetchMonth(sggCd, ym);
      const first = !logged.has(ym);
      const count = await deps.upsert(deals, first ? (d) => backfillSeenAt(d.date) : undefined);
      await deps.markCollected(sggCd, ym);
      if (!recent.includes(ym)) backfilled++;
      results.push({ ym, count });
    } catch (e) {
      console.error("[whereToMove collect]", sggCd, ym, e);
      results.push({ ym, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return { results, backfilled };
}
