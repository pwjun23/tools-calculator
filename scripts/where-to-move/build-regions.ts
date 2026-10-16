// 사용법: npx tsx --env-file=.env.local scripts/where-to-move/build-regions.ts
// 공공데이터포털 "행정안전부_법정동코드"(현존 코드만, flag=Y)를 받아 lib/whereToMove/regions.json 을 만든다.
// 행정구역이 바뀌면 다시 돌린다. 키는 출력하지 않는다.
import { writeFileSync } from "node:fs";
import { apiKeyParam } from "../../lib/whereToMove/molit";
import { buildRegionTree, type StanRow } from "../../lib/whereToMove/regions-build";

const key = process.env.DATA_GO_KR_KEY;
if (!key) throw new Error("DATA_GO_KR_KEY 없음");
const BASE = "https://apis.data.go.kr/1741000/StanReginCd/getStanReginCdList";
const PAGE = 1000;
const hide = (s: string) => s.replaceAll(key, "***").replaceAll(apiKeyParam(key), "***").slice(0, 300);

async function page(n: number): Promise<{ total: number; rows: StanRow[] }> {
  const url = `${BASE}?ServiceKey=${apiKeyParam(key!)}&type=json&flag=Y&numOfRows=${PAGE}&pageNo=${n}`;
  const res = await fetch(url);
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${hide(text)}`);
  const body = JSON.parse(text).StanReginCd;
  if (!body) throw new Error(hide(text));
  return { total: Number(body[0].head[0].totalCount), rows: body[1].row as StanRow[] };
}

const first = await page(1);
const rows = [...first.rows];
for (let n = 2; n <= Math.ceil(first.total / PAGE); n++) rows.push(...(await page(n)).rows);
const tree = buildRegionTree(rows);
writeFileSync("lib/whereToMove/regions.json", JSON.stringify(tree) + "\n");
const sggCount = tree.sidos.reduce((a, s) => a + s.sggs.length, 0);
const dongCount = tree.sidos.reduce((a, s) => a + s.sggs.reduce((b, g) => b + g.dongs.length, 0), 0);
console.log(`rows ${rows.length}/${first.total}, 시·도 ${tree.sidos.length}, 시·군·구 ${sggCount}, 읍·면·동 ${dongCount}`);
