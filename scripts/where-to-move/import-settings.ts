// 사용법: npx tsx --env-file=.env.local scripts/where-to-move/import-settings.ts <설정 JSON 경로> <카카오 회원번호>
// 설정 JSON 은 개인 재무정보라 저장소 밖에 두고 커밋하지 않는다.
import { readFileSync } from "node:fs";
import { and, eq } from "drizzle-orm";
import { db } from "../../lib/whereToMove/db";
import { getOrCreateSettings, saveSettings } from "../../lib/whereToMove/repo";
import { account } from "../../lib/whereToMove/schema";
import { parseSettings } from "../../lib/whereToMove/settings";

const [path, kakaoId] = process.argv.slice(2);
if (!path || !kakaoId) throw new Error("사용법: import-settings.ts <json> <카카오 회원번호>");

const parsed = parseSettings(JSON.parse(readFileSync(path, "utf8")));
if (!parsed.ok) {
  console.error(parsed.errors);
  process.exit(1);
}
const [row] = await db.select({ userId: account.userId }).from(account)
  .where(and(eq(account.providerId, "kakao"), eq(account.accountId, kakaoId)));
if (!row) throw new Error("그 카카오 회원번호로 로그인한 사용자가 없습니다. 먼저 웹에서 로그인하세요.");
const current = await getOrCreateSettings(row.userId);
await saveSettings(row.userId, parsed.settings, current.notifyEnabled);
console.log("설정을 저장했습니다:", row.userId);
process.exit(0);
