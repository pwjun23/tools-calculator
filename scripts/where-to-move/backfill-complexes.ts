// 기존 거래의 단지를 채우고 좌표를 찾는다. 키는 출력하지 않는다.
// 실행: npx tsx --env-file=.env.local scripts/where-to-move/backfill-complexes.ts [--retry-notfound]
import { complexSeeds } from "../../lib/whereToMove/complexes";
import { geocodePending } from "../../lib/whereToMove/geocode";
import { jusoKeys } from "../../lib/whereToMove/juso";
import { collectKeys, fetchDeals, recentMonths } from "../../lib/whereToMove/molit";
import { allRegionSggCds, geocodeDeps, resetNotFound, upsertComplexes } from "../../lib/whereToMove/repo";

const keys = collectKeys();
const jk = jusoKeys();
if (!keys || !jk) throw new Error("DATA_GO_KR_KEY 또는 JUSO_* 키가 .env.local 에 없습니다");

if (process.argv.includes("--retry-notfound")) console.log("notfound → pending:", await resetNotFound());

for (const sggCd of await allRegionSggCds()) {
  for (const ym of recentMonths(12)) {
    const seeds = complexSeeds(await fetchDeals(sggCd, ym, keys));
    await upsertComplexes(seeds);
    console.log(sggCd, ym, "단지", seeds.length);
  }
}

for (;;) {
  const r = await geocodePending(geocodeDeps(jk), { limit: 100 });
  console.log("좌표", r);
  if (r.ok + r.notfound === 0) break;
}
process.exit(0);
