// 좌표 없이 주소만 저장된 직장·학교·자주 가는 곳에 도로명주소 좌표를 채운다(모든 계정). 주소·이름·키는 출력하지 않는다.
// 미리보기: npx tsx --env-file=.env.local scripts/where-to-move/fill-place-coords.ts
// 저장:     ... fill-place-coords.ts --apply
import { eq } from "drizzle-orm";
import { db } from "../../lib/whereToMove/db";
import { jusoKeys, locateAddress } from "../../lib/whereToMove/juso";
import { fillPlaceCoords } from "../../lib/whereToMove/place-coords";
import { wtmSettings } from "../../lib/whereToMove/schema";
import { readStoredSettings } from "../../lib/whereToMove/settings";

const keys = jusoKeys();
if (!keys) throw new Error("JUSO_SEARCH_KEY·JUSO_COORD_KEY 가 .env.local 에 없습니다");
const apply = process.argv.includes("--apply");

const rows = await db.select({ userId: wtmSettings.userId, data: wtmSettings.data }).from(wtmSettings);
for (const [i, row] of rows.entries()) {
  const { settings, valid } = readStoredSettings(row.data);
  if (!valid) { console.log(`계정 ${i + 1}: 설정이 올바르지 않아 건너뜀`); continue; }
  const r = await fillPlaceCoords(settings, (a) => locateAddress(a, keys));
  console.log(`계정 ${i + 1}: 채움 ${r.filled} · 못 찾음 ${r.missed}`);
  if (apply && r.filled) await db.update(wtmSettings).set({ data: r.settings }).where(eq(wtmSettings.userId, row.userId));
}
console.log(apply ? "저장했습니다." : "미리보기입니다. 저장하려면 끝에 --apply 를 붙이세요.");
process.exit(0);
