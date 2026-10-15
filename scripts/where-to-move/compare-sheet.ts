// 사용법: npx tsx scripts/where-to-move/compare-sheet.ts <설정 JSON> <거래기록 JSON>
// 거래기록 JSON: [{ "type": "전세", "amount": 20947, "rent": 0, "verdict": "부적합" }, ...] (시트 '거래기록' C·I·J·N 열)
import { readFileSync } from "node:fs";
import { deriveParams, evaluateDeal } from "../../lib/whereToMove/judge";
import { parseSettings } from "../../lib/whereToMove/settings";
import type { DealType } from "../../lib/whereToMove/types";

const [settingsPath, rowsPath] = process.argv.slice(2);
const parsed = parseSettings(JSON.parse(readFileSync(settingsPath, "utf8")));
if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
const p = deriveParams(parsed.settings);
const rows = JSON.parse(readFileSync(rowsPath, "utf8")) as { type: DealType; amount: number; rent: number; verdict: string }[];

let mismatch = 0;
for (const r of rows) {
  const ok = evaluateDeal(p, r).ok;
  if (ok !== (r.verdict === "적합")) {
    mismatch++;
    console.log("불일치:", r.type, r.amount, r.rent, "시트", r.verdict, "새 판정", ok ? "적합" : "부적합");
  }
}
console.log(`비교 ${rows.length}건, 불일치 ${mismatch}건`);
process.exit(mismatch ? 1 : 0);
