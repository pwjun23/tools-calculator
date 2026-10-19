// 최근 7개월 전월세 거래의 계약 기간(contract_term)을 채운다. 0003 마이그레이션 뒤 한 번 실행. 키는 출력하지 않는다.
// 실행: npx tsx --env-file=.env.local scripts/where-to-move/backfill-terms.ts
import { backfillSeenAt } from "../../lib/whereToMove/collect";
import { collectKeys, fetchDeals, recentMonths } from "../../lib/whereToMove/molit";
import { allRegionSggCds, upsertDeals } from "../../lib/whereToMove/repo";

const keys = collectKeys();
if (!keys) throw new Error("DATA_GO_KR_KEY 가 .env.local 에 없습니다");

const daily = recentMonths(2);
for (const sggCd of await allRegionSggCds()) {
  for (const ym of recentMonths(7)) {
    const deals = await fetchDeals(sggCd, ym, keys);
    // 매일 수집하지 않는 달에서 처음 들어가는 거래(늦은 신고)는 계약일을 처음 본 시각으로 둬서 주간 알림 '신규'에 섞이지 않게 한다.
    // 최근 2개월은 매일 수집과 같게 지금 시각으로 둔다.
    await upsertDeals(deals, daily.includes(ym) ? undefined : (d) => backfillSeenAt(d.date));
    console.log(sggCd, ym, "거래", deals.length, "계약 기간 있음", deals.filter((d) => d.term).length);
  }
}
process.exit(0);
