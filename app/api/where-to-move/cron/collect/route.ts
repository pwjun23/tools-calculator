import { isCronAuthorized } from "@/lib/whereToMove/cron";
import { apiKeyParam, fetchDeals, recentMonths } from "@/lib/whereToMove/molit";
import { allRegionSggCds, upsertDeals } from "@/lib/whereToMove/repo";

// 매일 06시 KST. 사용자 지역의 최근 2개월 매매·전월세를 모두 받아 upsert 한다.
export async function GET(request: Request) {
  if (!isCronAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return Response.json({ ok: false }, { status: 401 });
  }
  const raw = process.env.DATA_GO_KR_KEY;
  if (!raw) return Response.json({ ok: false, error: "DATA_GO_KR_KEY 없음" }, { status: 500 });
  const keys = { trade: apiKeyParam(raw), rent: apiKeyParam(process.env.DATA_GO_KR_KEY_RENT || raw) };

  const results: { sggCd: string; ym: string; count?: number; error?: string }[] = [];
  for (const sggCd of await allRegionSggCds()) {
    for (const ym of recentMonths(2)) {
      try {
        const deals = await fetchDeals(sggCd, ym, keys);
        results.push({ sggCd, ym, count: await upsertDeals(deals) });
      } catch (e) {
        console.error("[whereToMove collect]", sggCd, ym, e);
        results.push({ sggCd, ym, error: e instanceof Error ? e.message : String(e) });
      }
    }
  }
  return Response.json({ ok: results.every((r) => !r.error), results });
}
