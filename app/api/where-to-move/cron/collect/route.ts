import { collectRegion } from "@/lib/whereToMove/collect";
import { isCronAuthorized } from "@/lib/whereToMove/cron";
import { geocodePending } from "@/lib/whereToMove/geocode";
import { jusoKeys } from "@/lib/whereToMove/juso";
import { collectKeys } from "@/lib/whereToMove/molit";
import { allRegionSggCds, collectDeps, geocodeDeps } from "@/lib/whereToMove/repo";

export const maxDuration = 300;

/** 한 번 실행할 때 채우는 지난 달 수의 합(함수 시간 300초 보호). 남은 달은 다음 날 이어서 받는다. */
const BACKFILL_BUDGET = 36;

/** 한 번에 좌표를 찾는 단지 수. 남은 단지는 다음 날 이어서 한다. */
const GEOCODE_LIMIT = 100;

// 매일 06시 KST. 사용자 지역마다 최근 2개월과, 아직 받지 않은 지난 12개월 중 일부를 받아 upsert 한다.
export async function GET(request: Request) {
  const started = Date.now();
  if (!isCronAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return Response.json({ ok: false }, { status: 401 });
  }
  const keys = collectKeys();
  if (!keys) return Response.json({ ok: false, error: "DATA_GO_KR_KEY 없음" }, { status: 500 });

  let budget = BACKFILL_BUDGET;
  const results: { sggCd: string; ym: string; count?: number; error?: string }[] = [];
  for (const sggCd of await allRegionSggCds()) {
    const r = await collectRegion(sggCd, collectDeps(keys), { now: new Date(), maxBackfill: budget });
    budget -= r.backfilled;
    results.push(...r.results.map((x) => ({ sggCd, ...x })));
  }
  // 좌표가 없는 단지를 채운다. 수집 결과를 잃지 않게 시작 뒤 240초가 지나면 멈춘다.
  const jk = jusoKeys();
  const geocode = jk ? await geocodePending(geocodeDeps(jk), { limit: GEOCODE_LIMIT, deadline: started + 240_000 }) : null;
  return Response.json({ ok: results.every((r) => !r.error), results, geocode });
}
