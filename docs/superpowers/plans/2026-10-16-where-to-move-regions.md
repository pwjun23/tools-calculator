# 이사 어디 — 2단계 지역 설정 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사이트 이름을 "이사 어디"로 바꾸고, 사용자가 전국 법정동 목록에서 시·군·구(최대 5개)와 읍·면·동을 골라 그 지역 실거래를 받아 보게 한다.

**Architecture:** 법정동코드 API로 만든 정적 `regions.json`을 앱에 넣는다. 설정 저장 때 이 목록으로 검사한다. 수집은 `wtm_collect_log`로 연월별 수집 여부를 기록하고, 처음 받는 달은 `first_seen_at`을 계약일로 넣어 주간 알림에 섞이지 않게 한다. 새 시·군·구는 저장 직후 `after()`로 바로 받는다.

**Tech Stack:** Next 16(App Router, `after` from `next/server`), drizzle-orm + Neon Postgres, zod 4, vitest, tsx.

**Spec:** `docs/superpowers/specs/2026-10-16-where-to-move-regions-design.md`

## Global Constraints
- 공개 저장소: 실제 개인 값(소득·대출·자산·카카오 ID·키)을 코드/테스트/문서/커밋에 넣지 않는다. 테스트는 가상 값만 쓴다.
- 비밀 값(`DATA_GO_KR_KEY` 등)은 출력하지 않는다. 스크립트는 `.env.local`에서 읽고, 오류 메시지에서도 키를 가린다.
- 운영과 개발이 **같은 DB**다. 마이그레이션은 운영 배포 직전에 돌리고, Cron 시각(매일 06시, 월 08시 KST)을 피한다.
- 서비스 이름은 정확히 `이사 어디`.
- 시·군·구 최대 5개, 지난 12개월 수집, Cron 1회당 "처음 받는 달" 최대 36개.
- 커밋 메시지 끝 두 줄: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` / `Claude-Session: https://claude.ai/code/session_01FSrCBnDvxCnDf8cKSTEwxh`.
- 테스트: `npx vitest run <파일>`; 전체 `npm test`; 빌드 `npm run build`.

## Review Focus
1. 마이그레이션 직후 김포의 기존 달이 "처음 받는 달"로 잡혀 이미 아는 거래가 다시 받아지거나, 새 거래가 계약일 시각으로 들어가 알림에서 빠지는 경우 — 기존 deal 연월로 로그를 채운다(Task 4).
2. 다른 시·군·구의 같은 이름 동·단지 거래가 같은 키로 합쳐지는 경우 — 거래 키에 sggCd를 넣고 기존 키를 마이그레이션으로 바꾼다(Task 4).
3. 새 지역을 추가한 다음 주 카톡에 12개월치가 "신규"로 몰리는 경우 — `backfillSeenAt` 테스트(Task 5).
4. 클라이언트가 보낸 label이나 목록에 없는 동이 저장되는 경우 — 저장 검사 테스트(Task 3).
5. 같은 이름 동이 두 지역에 있을 때 목록 필터가 섞이는 경우 — `groupDongs` 테스트(Task 7).

---

### Task 1: 이름을 "이사 어디"로

**Files:**
- Modify: `app/whereToMove/page.tsx`, `app/whereToMove/login/page.tsx`, `app/whereToMove/settings/page.tsx`
- Rename: `app/whereToMove/GimpoBoard.tsx` → `app/whereToMove/DealBoard.tsx`, `app/whereToMove/gimpo.module.css` → `app/whereToMove/board.module.css`
- Modify: `lib/whereToMove/message.ts`, `lib/whereToMove/message.test.ts`, `app/api/where-to-move/cron/notify/route.ts`

**Interfaces:**
- Produces: `buildWeeklyMessage(deals: MessageDeal[], max?: number): string` — 첫 줄 `[이사 어디 주간] 신규 신고 N건 (...)`. label 인자를 없앤다(지역이 여러 개라 한 label로 부를 수 없음).

- [ ] **Step 1: message 테스트를 새 형식으로 고친다**

`message.test.ts`에서 `buildWeeklyMessage("김포", X)` → `buildWeeklyMessage(X)`, 기대 문자열의 `[김포 부동산 주간]` → `[이사 어디 주간]`.

- [ ] **Step 2: 실패 확인** — `npx vitest run lib/whereToMove/message.test.ts` → FAIL(첫 줄 불일치).

- [ ] **Step 3: 구현**

`message.ts`: 시그니처를 `buildWeeklyMessage(deals: MessageDeal[], max = 200)`로, 첫 줄을 `` `[이사 어디 주간] 신규 신고 ${deals.length}건 ...` ``로. `notify/route.ts`: `buildWeeklyMessage(judged)`.

- [ ] **Step 4: 통과 확인** — 같은 명령 → PASS.

- [ ] **Step 5: 화면 이름**
  - `git mv`로 두 파일 이름을 바꾸고, `DealBoard.tsx`의 import를 `./board.module.css`, 컴포넌트 이름을 `DealBoard`로.
  - 메타 제목: 목록 `"이사 어디"`, 로그인 `"로그인 · 이사 어디"`, 설정 `"설정 · 이사 어디"`. 로그인 h1 `이사 어디`.
  - `page.tsx`는 `DealBoard`를 import하고 `title="이사 어디"`를 넘긴다(부제는 Task 7에서 바꾼다. 지금은 기존 부제 유지).
  - `DealBoard`의 `const label = title.split(' ')[0]`는 Task 7까지 `settings.regions[0].label`을 prop `regionLabel`로 받아 쓴다.

- [ ] **Step 6: 검증·커밋** — `npm test && npx tsc --noEmit` → 통과. `git commit -m "feat(whereToMove): 서비스 이름을 이사 어디로"`.

---

### Task 2: 법정동 지역 목록

**Files:**
- Create: `lib/whereToMove/regions-build.ts`, `lib/whereToMove/regions-build.test.ts`
- Create: `scripts/where-to-move/build-regions.ts`
- Create(생성물, 커밋): `lib/whereToMove/regions.json`
- Create: `lib/whereToMove/regions.ts`, `lib/whereToMove/regions.test.ts`

**Interfaces:**
- Produces:
  - `type StanRow = { region_cd: string; sido_cd: string; sgg_cd: string; umd_cd: string; ri_cd: string; locatadd_nm: string; locallow_nm: string }`
  - `type SggEntry = { cd: string; name: string; label: string; dongs: string[] }`, `type SidoEntry = { cd: string; name: string; sggs: SggEntry[] }`, `type RegionTree = { sidos: SidoEntry[] }`
  - `buildRegionTree(rows: StanRow[]): RegionTree`
  - `regions.ts`: `REGION_TREE: RegionTree`, `findSgg(cd: string): SggEntry | undefined`, `regionLabel(cd: string): string | undefined`, `invalidDongs(sggCd: string, dongs: string[]): string[] | null`(시·군·구가 없으면 null, 있으면 목록에 없는 동 배열)

- [ ] **Step 1: 실패하는 테스트**

```ts
// lib/whereToMove/regions-build.test.ts
import { describe, expect, it } from "vitest";
import { buildRegionTree, type StanRow } from "./regions-build";

const row = (cd: string, addr: string): StanRow => ({
  region_cd: cd, sido_cd: cd.slice(0, 2), sgg_cd: cd.slice(2, 5), umd_cd: cd.slice(5, 8), ri_cd: cd.slice(8, 10),
  locatadd_nm: addr, locallow_nm: addr.split(" ").at(-1)!,
});

const rows = [
  row("4100000000", "경기도"),
  row("4157000000", "경기도 김포시"),
  row("4157010200", "경기도 김포시 사우동"),
  row("4157010100", "경기도 김포시 가현동"),
  row("4157025300", "경기도 김포시 양촌읍"),
  row("4157025321", "경기도 김포시 양촌읍 가상리"),
  row("4111000000", "경기도 수원시"),
  row("4111100000", "경기도 수원시 장안구"),
  row("4111112900", "경기도 수원시 장안구 파장동"),
  row("2800000000", "인천광역시"),
  row("2826000000", "인천광역시 서구"),
  row("2826010100", "인천광역시 서구 가상동"),
  row("3611000000", "세종특별자치시"),
  row("3611011000", "세종특별자치시 가상동"),
];

describe("buildRegionTree", () => {
  const tree = buildRegionTree(rows);
  const sgg = (cd: string) => tree.sidos.flatMap((s) => s.sggs).find((g) => g.cd === cd);

  it("읍·면·동만 가나다순으로 담고 리는 뺀다", () => {
    expect(sgg("41570")?.dongs).toEqual(["가현동", "사우동", "양촌읍"]);
  });
  it("label 은 시·도 약칭 + 시·군·구 이름", () => {
    expect(sgg("41570")?.label).toBe("경기 김포시");
    expect(sgg("28260")?.label).toBe("인천 서구");
    expect(sgg("41111")?.label).toBe("경기 수원시 장안구");
  });
  it("동이 없는 시(구가 있는 시 자체)는 뺀다", () => {
    expect(sgg("41110")).toBeUndefined();
  });
  it("시·도와 시·군·구가 같은 세종은 시·도 이름을 쓴다", () => {
    expect(sgg("36110")).toMatchObject({ name: "세종특별자치시", label: "세종", dongs: ["가상동"] });
  });
  it("시·도는 코드순, 시·군·구는 이름순", () => {
    expect(tree.sidos.map((s) => s.cd)).toEqual(["28", "36", "41"]);
    expect(tree.sidos.find((s) => s.cd === "41")?.sggs.map((g) => g.cd)).toEqual(["41570", "41111"]);
  });
});
```

- [ ] **Step 2: 실패 확인** — `npx vitest run lib/whereToMove/regions-build.test.ts` → FAIL(모듈 없음).

- [ ] **Step 3: 구현**

```ts
// lib/whereToMove/regions-build.ts
export type StanRow = { region_cd: string; sido_cd: string; sgg_cd: string; umd_cd: string; ri_cd: string; locatadd_nm: string; locallow_nm: string };
export type SggEntry = { cd: string; name: string; label: string; dongs: string[] };
export type SidoEntry = { cd: string; name: string; sggs: SggEntry[] };
export type RegionTree = { sidos: SidoEntry[] };

const SIDO_SHORT: Record<string, string> = {
  "11": "서울", "26": "부산", "27": "대구", "28": "인천", "29": "광주", "30": "대전", "31": "울산", "36": "세종",
  "41": "경기", "42": "강원", "51": "강원", "43": "충북", "44": "충남", "45": "전북", "52": "전북", "46": "전남",
  "47": "경북", "48": "경남", "50": "제주",
};

const ko = (a: string, b: string) => a.localeCompare(b, "ko");

/** 법정동코드(현존) 행을 시·도 → 시·군·구(5자리, 국토부 LAWD_CD) → 읍·면·동 이름 트리로 만든다. */
export function buildRegionTree(rows: StanRow[]): RegionTree {
  const sidoName = new Map<string, string>();
  const sggName = new Map<string, string>();
  const dongs = new Map<string, Set<string>>();
  for (const r of rows) {
    const cd5 = r.region_cd.slice(0, 5);
    if (r.sgg_cd === "000" && r.umd_cd === "000" && r.ri_cd === "00") sidoName.set(r.sido_cd, r.locatadd_nm);
    else if (r.umd_cd === "000" && r.ri_cd === "00") sggName.set(cd5, r.locatadd_nm);
    else if (r.ri_cd === "00") {
      if (!dongs.has(cd5)) dongs.set(cd5, new Set());
      dongs.get(cd5)!.add(r.locallow_nm);
    }
  }
  const sidos = new Map<string, SidoEntry>();
  for (const [cd5, set] of dongs) {
    const sidoCd = cd5.slice(0, 2);
    const sido = sidoName.get(sidoCd) ?? "";
    const full = sggName.get(cd5);
    // 세종처럼 시·군·구 행이 따로 없으면 시·도 이름을 쓴다.
    const name = full && full !== sido ? full.slice(sido.length).trim() : sido;
    const short = SIDO_SHORT[sidoCd] ?? sido;
    const label = name === sido ? short : `${short} ${name}`;
    if (!sidos.has(sidoCd)) sidos.set(sidoCd, { cd: sidoCd, name: sido, sggs: [] });
    sidos.get(sidoCd)!.sggs.push({ cd: cd5, name, label, dongs: [...set].sort(ko) });
  }
  const out = [...sidos.values()].sort((a, b) => a.cd.localeCompare(b.cd));
  for (const s of out) s.sggs.sort((a, b) => ko(a.name, b.name));
  return { sidos: out };
}
```

참고: 구가 있는 시(41110) 행은 `sggName`에만 있고 동이 없어서 자연히 빠진다.

- [ ] **Step 4: 통과 확인** — 같은 명령 → PASS 5/5.

- [ ] **Step 5: 생성 스크립트**

```ts
// scripts/where-to-move/build-regions.ts
// 사용법: npx tsx --env-file=.env.local scripts/where-to-move/build-regions.ts
// 공공데이터포털 "행정안전부_법정동코드"(현존 코드만, flag=Y)를 받아 lib/whereToMove/regions.json 을 만든다.
import { writeFileSync } from "node:fs";
import { buildRegionTree, type StanRow } from "../../lib/whereToMove/regions-build";

const key = process.env.DATA_GO_KR_KEY;
if (!key) throw new Error("DATA_GO_KR_KEY 없음");
const BASE = "https://apis.data.go.kr/1741000/StanReginCd/getStanReginCdList";
const PAGE = 1000;

async function page(n: number): Promise<{ total: number; rows: StanRow[] }> {
  const url = `${BASE}?ServiceKey=${encodeURIComponent(key!)}&type=json&flag=Y&numOfRows=${PAGE}&pageNo=${n}`;
  const res = await fetch(url);
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.replaceAll(key!, "***").slice(0, 300)}`);
  const json = JSON.parse(text);
  const body = json.StanReginCd;
  if (!body) throw new Error(text.replaceAll(key!, "***").slice(0, 300));
  return { total: Number(body[0].head[0].totalCount), rows: body[1].row as StanRow[] };
}

const first = await page(1);
const rows = [...first.rows];
for (let n = 2; n <= Math.ceil(first.total / PAGE); n++) rows.push(...(await page(n)).rows);
const tree = buildRegionTree(rows);
writeFileSync("lib/whereToMove/regions.json", JSON.stringify(tree) + "\n");
const sggCount = tree.sidos.reduce((a, s) => a + s.sggs.length, 0);
const dongCount = tree.sidos.reduce((a, s) => a + s.sggs.reduce((b, g) => b + g.dongs.length, 0), 0);
console.log(`rows ${rows.length}, 시·도 ${tree.sidos.length}, 시·군·구 ${sggCount}, 읍·면·동 ${dongCount}`);
```

- [ ] **Step 6: 실행** — `npx tsx --env-file=.env.local scripts/where-to-move/build-regions.ts`
Expected: 시·도 17, 시·군·구 약 250, 읍·면·동 약 5,000. 그리고 `node -e` 로 41570 의 동에 구래동·마산동·양촌읍이 있고 키가 출력에 없는지 확인한다. 파일 크기는 200KB 이하.

- [ ] **Step 7: regions.ts 테스트**

```ts
// lib/whereToMove/regions.test.ts
import { describe, expect, it } from "vitest";
import { findSgg, invalidDongs, regionLabel } from "./regions";

describe("regions", () => {
  it("김포를 찾는다", () => {
    expect(regionLabel("41570")).toBe("경기 김포시");
    expect(findSgg("41570")?.dongs).toEqual(expect.arrayContaining(["구래동", "마산동", "양촌읍"]));
  });
  it("없는 시·군·구는 null", () => {
    expect(invalidDongs("99999", ["구래동"])).toBeNull();
  });
  it("그 시·군·구에 없는 동만 돌려준다", () => {
    expect(invalidDongs("41570", ["구래동", "없는동"])).toEqual(["없는동"]);
    expect(invalidDongs("41570", ["구래동", "마산동"])).toEqual([]);
  });
});
```

실패 확인(모듈 없음) → 구현:

```ts
// lib/whereToMove/regions.ts
import data from "./regions.json";
import type { RegionTree, SggEntry } from "./regions-build";

export const REGION_TREE = data as RegionTree;
const BY_CD = new Map<string, SggEntry>(REGION_TREE.sidos.flatMap((s) => s.sggs.map((g) => [g.cd, g] as const)));

export const findSgg = (cd: string) => BY_CD.get(cd);
export const regionLabel = (cd: string) => BY_CD.get(cd)?.label;

/** 시·군·구가 목록에 없으면 null, 있으면 그 시·군·구에 없는 동 이름들. */
export function invalidDongs(sggCd: string, dongs: string[]): string[] | null {
  const g = BY_CD.get(sggCd);
  if (!g) return null;
  return dongs.filter((d) => !g.dongs.includes(d));
}
```

→ PASS.

- [ ] **Step 8: 커밋** — `npm test` 통과 후 `git add lib/whereToMove/regions* scripts/where-to-move/build-regions.ts && git commit -m "feat(whereToMove): 법정동코드 지역 목록"`.

---

### Task 3: 설정 — 지역 1~5개, 목록 검사

**Files:**
- Modify: `lib/whereToMove/settings.ts`, `lib/whereToMove/settings.test.ts`
- Create: `lib/whereToMove/region-check.ts`, `lib/whereToMove/region-check.test.ts`
- Modify: `app/whereToMove/settings/actions.ts`

**Interfaces:**
- Consumes: `invalidDongs`, `regionLabel` (Task 2)
- Produces:
  - 스키마 `regions` `.min(1).max(5)` + sggCd 중복 금지(`regions` 경로 오류 "같은 시·군·구를 두 번 고를 수 없습니다").
  - `MAX_REGIONS = 5` export.
  - `checkRegions(regions: Settings["regions"]): { ok: true; regions: Settings["regions"] } | { ok: false; errors: Record<string, string> }` — label을 `regionLabel`로 다시 채움. 오류 경로 `regions.<i>`.
  - `DEFAULT_SETTINGS.regions[0].label = "경기 김포시"`.

- [ ] **Step 1: 실패하는 테스트**

`settings.test.ts`에 추가:

```ts
describe("regions 개수", () => {
  const r = (sggCd: string) => ({ sggCd, label: "가상", dongs: ["가상동"] });
  it("0개는 실패", () => expect(parseSettings({ ...DEFAULT_SETTINGS, regions: [] }).ok).toBe(false));
  it("5개는 통과", () => expect(parseSettings({ ...DEFAULT_SETTINGS, regions: ["11110", "11140", "11170", "11200", "11215"].map(r) }).ok).toBe(true));
  it("6개는 실패", () => expect(parseSettings({ ...DEFAULT_SETTINGS, regions: ["11110", "11140", "11170", "11200", "11215", "11230"].map(r) }).ok).toBe(false));
  it("같은 시·군·구 두 번은 실패", () => {
    const p = parseSettings({ ...DEFAULT_SETTINGS, regions: [r("11110"), r("11110")] });
    expect(p.ok).toBe(false);
    if (!p.ok) expect(Object.keys(p.errors)).toContain("regions");
  });
});
```

`region-check.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { checkRegions } from "./region-check";

describe("checkRegions", () => {
  it("label 을 목록 값으로 바꾼다", () => {
    const r = checkRegions([{ sggCd: "41570", label: "아무거나", dongs: ["구래동"] }]);
    expect(r).toEqual({ ok: true, regions: [{ sggCd: "41570", label: "경기 김포시", dongs: ["구래동"] }] });
  });
  it("없는 시·군·구", () => {
    const r = checkRegions([{ sggCd: "99999", label: "x", dongs: ["가"] }]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors["regions.0"]).toMatch(/시·군·구/);
  });
  it("그 시·군·구에 없는 동", () => {
    const r = checkRegions([{ sggCd: "41570", label: "x", dongs: ["구래동"] }, { sggCd: "41570", label: "x", dongs: ["없는동"] }]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors["regions.1"]).toContain("없는동");
  });
});
```

- [ ] **Step 2: 실패 확인** — `npx vitest run lib/whereToMove/settings.test.ts lib/whereToMove/region-check.test.ts` → 6개 실패 테스트가 FAIL(현재 `.length(1)`, 모듈 없음).

- [ ] **Step 3: 구현**

`settings.ts`:
```ts
export const MAX_REGIONS = 5;
// regions 정의를
  regions: z
    .array(z.object({ sggCd: z.string().regex(/^\d{5}$/), label: z.string().trim().min(1).max(30), dongs: z.array(z.string().trim().min(1)).min(1) }))
    .min(1)
    .max(MAX_REGIONS)
    .refine((rs) => new Set(rs.map((r) => r.sggCd)).size === rs.length, { message: "같은 시·군·구를 두 번 고를 수 없습니다" }),
```
(기존 주석 "1단계는 지역 1개만"은 지운다. `DEFAULT_SETTINGS` label → `"경기 김포시"`.)

`region-check.ts`:
```ts
import { invalidDongs, regionLabel } from "./regions";
import type { Settings } from "./settings";

/** 저장 전에 법정동 목록으로 지역을 검사하고 label 을 목록 값으로 채운다. */
export function checkRegions(regions: Settings["regions"]):
  | { ok: true; regions: Settings["regions"] }
  | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const out = regions.map((r, i) => {
    const bad = invalidDongs(r.sggCd, r.dongs);
    if (bad === null) errors[`regions.${i}`] = "목록에 없는 시·군·구입니다";
    else if (bad.length) errors[`regions.${i}`] = `이 시·군·구에 없는 동: ${bad.join(", ")}`;
    return { ...r, label: regionLabel(r.sggCd) ?? r.label };
  });
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, regions: out };
}
```

`actions.ts`: `parseSettings` 다음에
```ts
  const checked = checkRegions(parsed.settings.regions);
  if (!checked.ok) return checked;
  const settings = { ...parsed.settings, regions: checked.regions };
```
하고 `saveSettings(user.id, settings, ...)`. (`after()` 수집은 Task 5에서 붙인다.)

- [ ] **Step 4: 통과 확인** — 같은 명령 → PASS. 기존 테스트의 `label: "김포"`는 스키마상 여전히 유효하다.

- [ ] **Step 5: 커밋** — `npm test && npx tsc --noEmit` 후 `git commit -m "feat(whereToMove): 지역 1~5개와 법정동 목록 검사"`.

---

### Task 4: 거래 키에 시·군·구 + 수집 로그 표 (마이그레이션)

**Files:**
- Modify: `lib/whereToMove/molit.ts`, `lib/whereToMove/molit.test.ts`, `lib/whereToMove/schema.ts`
- Create: `drizzle/0001_*.sql` (drizzle-kit generate 후 데이터 이전 SQL 추가)

**Interfaces:**
- Produces:
  - `dealKey(d)`가 `d.sggCd`를 맨 앞에 붙인다: `41570|매매|가상아파트|구래동|85|7|2026-09-03|35500|0`. Pick 타입에 `"sggCd"` 추가.
  - `wtmCollectLog` 표: `sggCd text`, `ym text`, `collectedAt timestamptz not null default now()`, PK(sggCd, ym).

- [ ] **Step 1: 실패하는 테스트** — `molit.test.ts`의 키 기대값 두 곳 앞에 sggCd를 붙인다(`"41570|매매|가상아파트|..."`, `dealKey({ sggCd: "11110", type: "월세", ... })` → `"11110|월세|A|B|77|11|2026-09-04|10211|50"`).

- [ ] **Step 2: 실패 확인** — `npx vitest run lib/whereToMove/molit.test.ts` → FAIL.

- [ ] **Step 3: 구현** — `dealKey`: `[d.sggCd, d.type, ...].join("|")`. `schema.ts`에:
```ts
export const wtmCollectLog = pgTable(
  "wtm_collect_log",
  {
    sggCd: text("sgg_cd").notNull(),
    ym: text("ym").notNull(),
    collectedAt: timestamp("collected_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.sggCd, t.ym] })],
);
```
(`primaryKey` import 추가.)

- [ ] **Step 4: 통과 확인** — 같은 명령 → PASS.

- [ ] **Step 5: 마이그레이션 생성** — `npm run db:generate`. 생성된 `drizzle/0001_*.sql` 끝에 다음을 붙인다:
```sql
--> statement-breakpoint
UPDATE "wtm_deals" SET "deal_key" = "sgg_cd" || '|' || "deal_key" WHERE "deal_key" NOT LIKE "sgg_cd" || '|%';
--> statement-breakpoint
INSERT INTO "wtm_collect_log" ("sgg_cd", "ym", "collected_at")
SELECT DISTINCT "sgg_cd", to_char("deal_date", 'YYYYMM'), now() FROM "wtm_deals"
ON CONFLICT DO NOTHING;
```
(기존 달을 "이미 받은 달"로 표시해 김포의 새 거래가 계약일 시각으로 들어가지 않게 한다.) **이 단계에서는 `db:migrate`를 돌리지 않는다**(Task 8).

- [ ] **Step 6: 커밋** — `npm test && npx tsc --noEmit` 후 `git commit -m "feat(whereToMove): 거래 키에 시·군·구, 수집 로그 표"`.

---

### Task 5: 지역별 수집 (12개월 채우기, 처음 받는 달 처리)

**Files:**
- Create: `lib/whereToMove/collect.ts`, `lib/whereToMove/collect.test.ts`
- Modify: `lib/whereToMove/repo.ts`, `app/api/where-to-move/cron/collect/route.ts`, `app/whereToMove/settings/actions.ts`

**Interfaces:**
- Consumes: `recentMonths`, `fetchDeals`, `apiKeyParam` (molit), `wtmCollectLog` (Task 4)
- Produces:
  - `monthsToCollect(now: Date, logged: Set<string>): { recent: string[]; backfill: string[] }` — recent = `recentMonths(2, now)`, backfill = `recentMonths(12, now)` 중 recent 아니고 logged 에 없는 달(최신순).
  - `backfillSeenAt(date: string): Date` — `new Date(`${date}T00:00:00+09:00`)`.
  - `collectRegion(sggCd, deps, opts): Promise<{ results: {ym; count?; error?}[]; backfilled: number }>` with `deps = { fetchMonth(sggCd, ym): Promise<MolitDeal[]>; loggedMonths(sggCd): Promise<Set<string>>; upsert(deals, seenAt?: (d) => Date): Promise<number>; markCollected(sggCd, ym): Promise<void> }`, `opts = { now: Date; maxBackfill: number }`.
  - repo: `upsertDeals(all, seenAt?)`, `loggedMonths(sggCd)`, `markCollected(sggCd, ym)`, `collectDeps(keys)`(위 deps의 실제 구현).
  - `collectKeys(): { trade; rent } | null` (env에서).

- [ ] **Step 1: 실패하는 테스트**

```ts
// lib/whereToMove/collect.test.ts
import { describe, expect, it } from "vitest";
import { backfillSeenAt, collectRegion, monthsToCollect } from "./collect";
import type { MolitDeal } from "./types";

const NOW = new Date("2026-10-16T03:00:00Z"); // KST 2026-10-16 12시

describe("monthsToCollect", () => {
  it("로그가 없으면 최근 2개월 + 나머지 10개월", () => {
    const m = monthsToCollect(NOW, new Set());
    expect(m.recent).toEqual(["202610", "202609"]);
    expect(m.backfill).toEqual(["202608", "202607", "202606", "202605", "202604", "202603", "202602", "202601", "202512", "202511"]);
  });
  it("빠진 달만 채운다", () => {
    const m = monthsToCollect(NOW, new Set(["202610", "202609", "202608", "202606", "202605", "202604", "202603", "202602", "202601", "202512", "202511"]));
    expect(m.backfill).toEqual(["202607"]);
  });
});

describe("backfillSeenAt", () => {
  it("계약일 KST 00시", () => expect(backfillSeenAt("2026-03-05").toISOString()).toBe("2026-03-04T15:00:00.000Z"));
});

const deal = (date: string): MolitDeal => ({
  key: date, type: "전세", sggCd: "11110", dong: "가상동", apt: "가상", area: 84, areaRaw: 84, floor: "3", date, amount: 30000, rent: 0, renewal: false, cancelled: false,
});

function fakeDeps(logged: string[], failYm?: string) {
  const upserts: { ym: string; seen: (string | null)[] }[] = [];
  const marked: string[] = [];
  return {
    upserts, marked,
    deps: {
      loggedMonths: async () => new Set(logged),
      fetchMonth: async (_: string, ym: string) => {
        if (ym === failYm) throw new Error("가상 오류");
        return [deal(`${ym.slice(0, 4)}-${ym.slice(4)}-10`)];
      },
      upsert: async (deals: MolitDeal[], seenAt?: (d: MolitDeal) => Date) => {
        upserts.push({ ym: deals[0].date.slice(0, 7).replace("-", ""), seen: deals.map((d) => (seenAt ? seenAt(d).toISOString() : null)) });
        return deals.length;
      },
      markCollected: async (_: string, ym: string) => { marked.push(ym); },
    },
  };
}

describe("collectRegion", () => {
  it("처음 받는 달은 계약일로, 이미 받은 달은 now 로 넣는다", async () => {
    const f = fakeDeps(["202610"]);
    await collectRegion("11110", f.deps, { now: NOW, maxBackfill: 0 });
    expect(f.upserts).toEqual([
      { ym: "202610", seen: [null] },
      { ym: "202609", seen: ["2026-09-09T15:00:00.000Z"] },
    ]);
    expect(f.marked).toEqual(["202610", "202609"]);
  });
  it("maxBackfill 만큼만 지난 달을 받고 개수를 돌려준다", async () => {
    const f = fakeDeps(["202610", "202609"]);
    const r = await collectRegion("11110", f.deps, { now: NOW, maxBackfill: 3 });
    expect(r.backfilled).toBe(3);
    expect(f.marked).toEqual(["202610", "202609", "202608", "202607", "202606"]);
  });
  it("실패한 달은 로그를 남기지 않고 나머지는 계속한다", async () => {
    const f = fakeDeps(["202610", "202609"], "202608");
    const r = await collectRegion("11110", f.deps, { now: NOW, maxBackfill: 2 });
    expect(r.results.find((x) => x.ym === "202608")?.error).toBe("가상 오류");
    expect(f.marked).toEqual(["202610", "202609", "202607"]);
  });
});
```

- [ ] **Step 2: 실패 확인** — `npx vitest run lib/whereToMove/collect.test.ts` → FAIL(모듈 없음).

- [ ] **Step 3: 구현**

```ts
// lib/whereToMove/collect.ts
import { recentMonths } from "./molit";
import type { MolitDeal } from "./types";

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

export async function collectRegion(sggCd: string, deps: CollectDeps, opts: { now: Date; maxBackfill: number }) {
  const logged = await deps.loggedMonths(sggCd);
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
```

주의: 테스트 1에서 `deals`가 비면 `upsert` 기록이 없을 수 있으니 fake는 항상 1건을 돌려준다(위 코드 그대로).

- [ ] **Step 4: 통과 확인** — 같은 명령 → PASS 6/6.

- [ ] **Step 5: repo·Cron·액션 연결**

`repo.ts`:
```ts
export async function upsertDeals(all: MolitDeal[], seenAt?: (d: MolitDeal) => Date): Promise<number> {
  // rows 에 ...(seenAt ? { firstSeenAt: seenAt(d) } : {}) 추가. onConflict set 은 그대로(first_seen_at 유지).
}
export async function loggedMonths(sggCd: string): Promise<Set<string>> {
  const rows = await db.select({ ym: wtmCollectLog.ym }).from(wtmCollectLog).where(eq(wtmCollectLog.sggCd, sggCd));
  return new Set(rows.map((r) => r.ym));
}
export async function markCollected(sggCd: string, ym: string): Promise<void> {
  await db.insert(wtmCollectLog).values({ sggCd, ym }).onConflictDoUpdate({ target: [wtmCollectLog.sggCd, wtmCollectLog.ym], set: { collectedAt: sql`now()` } });
}
```

`collect.ts`에 실제 deps를 만드는 서버 전용 함수는 DB import 때문에 repo 쪽에 둔다:
```ts
// repo.ts
export function collectDeps(keys: { trade: string; rent: string }): CollectDeps {
  return { fetchMonth: (sggCd, ym) => fetchDeals(sggCd, ym, keys), loggedMonths, upsert: upsertDeals, markCollected };
}
```
`molit.ts`에 `collectKeys()` 추가:
```ts
export function collectKeys(): { trade: string; rent: string } | null {
  const raw = process.env.DATA_GO_KR_KEY;
  if (!raw) return null;
  return { trade: apiKeyParam(raw), rent: apiKeyParam(process.env.DATA_GO_KR_KEY_RENT || raw) };
}
```

`collect/route.ts`:
```ts
export const maxDuration = 300;
// 매일 06시 KST. 지역마다 최근 2개월과, 아직 받지 않은 지난 12개월 중 일부(전체 36개월까지)를 받는다.
export async function GET(request: Request) {
  if (!isCronAuthorized(...)) return 401;
  const keys = collectKeys();
  if (!keys) return Response.json({ ok: false, error: "DATA_GO_KR_KEY 없음" }, { status: 500 });
  let budget = 36;
  const out = [];
  for (const sggCd of await allRegionSggCds()) {
    const r = await collectRegion(sggCd, collectDeps(keys), { now: new Date(), maxBackfill: budget });
    budget -= r.backfilled;
    out.push(...r.results.map((x) => ({ sggCd, ...x })));
  }
  return Response.json({ ok: out.every((r) => !r.error), results: out });
}
```

`actions.ts`: 저장 전에 `const before = await getOrCreateSettings(user.id)`로 기존 sggCd를 알 필요는 없다. 로그가 없는 시·군·구만 받는다:
```ts
import { after } from "next/server";
// saveSettings 다음:
  const fresh: string[] = [];
  for (const r of settings.regions) if ((await loggedMonths(r.sggCd)).size === 0) fresh.push(r.sggCd);
  const keys = collectKeys();
  if (fresh.length && keys) {
    after(async () => {
      for (const sggCd of fresh) {
        try { await collectRegion(sggCd, collectDeps(keys), { now: new Date(), maxBackfill: 10 }); }
        catch (e) { console.error("[whereToMove backfill]", sggCd, e); }
      }
    });
  }
  revalidatePath("/whereToMove");
  return { ok: true as const, collecting: fresh.length > 0 };
```
설정 page 에 `export const maxDuration = 300;`을 둔다(서버 액션은 페이지의 설정을 따름).

- [ ] **Step 6: 검증·커밋** — `npm test && npx tsc --noEmit` 후 `git commit -m "feat(whereToMove): 지역별 12개월 수집과 새 지역 즉시 수집"`.

---

### Task 6: 설정 화면 지역 섹션

**Files:**
- Create: `app/whereToMove/settings/RegionPicker.tsx`
- Modify: `app/whereToMove/settings/SettingsForm.tsx`

**Interfaces:**
- Consumes: `REGION_TREE`(Task 2), `MAX_REGIONS`(Task 3), 액션 반환 `collecting`(Task 5)
- Produces: `RegionPicker({ value, onChange, errors }: { value: Settings["regions"]; onChange(v: Settings["regions"]): void; errors: Record<string, string> })`

- [ ] **Step 1: RegionPicker 구현**

```tsx
"use client";
import { useState } from "react";
import { REGION_TREE } from "@/lib/whereToMove/regions";
import { MAX_REGIONS, type Settings } from "@/lib/whereToMove/settings";

type Regions = Settings["regions"];
const input = "rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950";
const errText = "text-xs text-rose-600 dark:text-rose-400";

export default function RegionPicker({ value, onChange, errors }: { value: Regions; onChange: (v: Regions) => void; errors: Record<string, string> }) {
  const [sido, setSido] = useState(REGION_TREE.sidos.find((s) => s.cd === "41")?.cd ?? REGION_TREE.sidos[0].cd);
  const [sgg, setSgg] = useState("");
  const chosen = new Set(value.map((r) => r.sggCd));
  const sggs = (REGION_TREE.sidos.find((s) => s.cd === sido)?.sggs ?? []).filter((g) => !chosen.has(g.cd));
  const find = (cd: string) => REGION_TREE.sidos.flatMap((s) => s.sggs).find((g) => g.cd === cd);

  const toggle = (i: number, dong: string) =>
    onChange(value.map((r, j) => (j !== i ? r : { ...r, dongs: r.dongs.includes(dong) ? r.dongs.filter((d) => d !== dong) : [...r.dongs, dong] })));
  const add = () => {
    const g = find(sgg);
    if (!g) return;
    onChange([...value, { sggCd: g.cd, label: g.label, dongs: [] }]);
    setSgg("");
  };

  return (
    <section className="mb-6">
      <h2 className="mb-2 font-semibold">지역</h2>
      {value.map((r, i) => {
        const g = find(r.sggCd);
        return (
          <div key={r.sggCd} className="mb-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
            <div className="mb-2 flex items-center justify-between">
              <strong className="text-sm">{g?.label ?? r.label}</strong>
              {value.length > 1 && (
                <button type="button" className="text-sm text-rose-600" onClick={() => onChange(value.filter((_, j) => j !== i))}>삭제</button>
              )}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {(g?.dongs ?? r.dongs).map((d) => (
                <label key={d} className="flex items-center gap-1 text-sm">
                  <input type="checkbox" checked={r.dongs.includes(d)} onChange={() => toggle(i, d)} /> {d}
                </label>
              ))}
            </div>
            {[`regions.${i}`, `regions.${i}.dongs`].map((k) => errors[k] && <p key={k} className={errText}>{errors[k]}</p>)}
          </div>
        );
      })}
      {errors.regions && <p className={errText}>{errors.regions}</p>}
      {value.length < MAX_REGIONS ? (
        <div className="flex flex-wrap gap-2">
          <select className={input} value={sido} onChange={(e) => { setSido(e.target.value); setSgg(""); }}>
            {REGION_TREE.sidos.map((s) => <option key={s.cd} value={s.cd}>{s.name}</option>)}
          </select>
          <select className={input} value={sgg} onChange={(e) => setSgg(e.target.value)}>
            <option value="">시·군·구 선택</option>
            {sggs.map((g) => <option key={g.cd} value={g.cd}>{g.name}</option>)}
          </select>
          <button type="button" disabled={!sgg} onClick={add} className="rounded-full border border-slate-300 px-3 py-1 text-sm disabled:opacity-50 dark:border-slate-700">추가</button>
        </div>
      ) : (
        <p className="text-sm text-slate-500">지역은 {MAX_REGIONS}개까지 고를 수 있습니다.</p>
      )}
    </section>
  );
}
```

- [ ] **Step 2: SettingsForm 연결**
  - 헤더 부제 `지역: ...` 줄을 지운다.
  - 첫 섹션 앞에 `<RegionPicker value={s.regions} errors={errors} onChange={(regions) => { setSaved(false); setS({ ...s, regions }); }} />`.
  - `const [collecting, setCollecting] = useState(false)`; save 성공 시 `setCollecting(r.collecting === true)`. 저장 버튼 위에 `{collecting && <p className="mb-2 text-sm text-emerald-700 dark:text-emerald-400">새 지역의 지난 12개월 거래를 받는 중입니다. 몇 분 뒤 목록에 나옵니다.</p>}`.

- [ ] **Step 3: 검증·커밋** — `npx tsc --noEmit && npm test` 통과 후 `git commit -m "feat(whereToMove): 설정 화면에서 지역 고르기"`. (화면 확인은 Task 8.)

---

### Task 7: 목록 화면 — 지역별 동 필터, 부제

**Files:**
- Create: `lib/whereToMove/board.ts`, `lib/whereToMove/board.test.ts`
- Modify: `app/whereToMove/page.tsx`, `app/whereToMove/DealBoard.tsx`

**Interfaces:**
- Produces:
  - `groupDongs(deals: { sggCd: string; dong: string }[], regions: { sggCd: string; label: string }[]): { sggCd: string; label: string; dongs: string[] }[]` — 설정 지역 순서, 동은 거래에 나온 것만 가나다순, 거래 없는 지역은 뺀다.
  - `regionSubtitle(regions: Settings["regions"]): string` — `경기 김포시 구래동·마산동 · 인천 서구 가상동`.
  - `Deal`에 `sggCd: string; region: string` 추가. DealBoard props: `{ deals; regions: { sggCd; label }[]; subtitle; notice }` (`title`, `regionLabel` 제거, 제목은 상수 `이사 어디`).

- [ ] **Step 1: 실패하는 테스트**

```ts
// lib/whereToMove/board.test.ts
import { describe, expect, it } from "vitest";
import { groupDongs, regionSubtitle } from "./board";

describe("groupDongs", () => {
  it("같은 이름 동도 지역별로 나눈다", () => {
    const g = groupDongs(
      [{ sggCd: "B", dong: "중앙동" }, { sggCd: "A", dong: "중앙동" }, { sggCd: "A", dong: "가동" }, { sggCd: "A", dong: "중앙동" }],
      [{ sggCd: "A", label: "가 시" }, { sggCd: "B", label: "나 시" }, { sggCd: "C", label: "다 시" }],
    );
    expect(g).toEqual([
      { sggCd: "A", label: "가 시", dongs: ["가동", "중앙동"] },
      { sggCd: "B", label: "나 시", dongs: ["중앙동"] },
    ]);
  });
});

describe("regionSubtitle", () => {
  it("지역별로 잇는다", () => {
    expect(regionSubtitle([{ sggCd: "A", label: "가 시", dongs: ["가동", "나동"] }, { sggCd: "B", label: "나 시", dongs: ["다동"] }]))
      .toBe("가 시 가동·나동 · 나 시 다동");
  });
});
```

- [ ] **Step 2: 실패 확인** — `npx vitest run lib/whereToMove/board.test.ts` → FAIL.

- [ ] **Step 3: 구현**

```ts
// lib/whereToMove/board.ts
export function groupDongs(deals: { sggCd: string; dong: string }[], regions: { sggCd: string; label: string }[]) {
  return regions
    .map((r) => ({
      sggCd: r.sggCd,
      label: r.label,
      dongs: [...new Set(deals.filter((d) => d.sggCd === r.sggCd).map((d) => d.dong))].sort((a, b) => a.localeCompare(b, "ko")),
    }))
    .filter((g) => g.dongs.length > 0);
}

export const regionSubtitle = (regions: { label: string; dongs: string[] }[]) =>
  regions.map((r) => `${r.label} ${r.dongs.join("·")}`).join(" · ");
```

- [ ] **Step 4: 통과 확인** — 같은 명령 → PASS.

- [ ] **Step 5: 화면 연결**
  - `page.tsx`: 거래 매핑에 `sggCd: d.sggCd, region: settings.regions.find((r) => r.sggCd === d.sggCd)?.label ?? ""`. `<DealBoard deals={deals} regions={settings.regions.map(({ sggCd, label }) => ({ sggCd, label }))} subtitle={regionSubtitle(settings.regions)} notice={notice} />`.
  - `DealBoard.tsx`:
    - 제목 `<h1>이사 어디</h1>`.
    - 동 상태를 `const [dong, setDong] = useState('전체')`에서 값 `'전체'` 또는 `` `${sggCd}:${dong}` ``로. 필터: `dong === '전체' || `${d.sggCd}:${d.dong}` === dong`.
    - 칩: `전체` 칩 한 줄 + `groupDongs(deals, regions).map(g => <div className={s.row}><span className={s.muted}>{g.label}</span>{g.dongs.map(...)}</div>)`. 지역이 하나면 label 없이 기존처럼 한 줄.
    - 네이버: `naverUrl(d)` = `` `${d.region} ${d.dong} ${d.apt}` ``. 호갱노노도 `` `${d.region} ${d.dong} ${d.apt}` ``.
    - 카드 메타 `{d.dong}` → 지역이 둘 이상이면 `{d.region} {d.dong}`.

- [ ] **Step 6: 검증·커밋** — `npm test && npx tsc --noEmit && npm run build` 후 `git commit -m "feat(whereToMove): 목록에서 지역별 동 필터"`.

---

### Task 8: 배포·마이그레이션·실제 확인

운영과 개발이 같은 DB다. **새 코드를 먼저 운영에 배포하고 곧바로 마이그레이션한다.** 반대로 하면(마이그레이션 먼저) 운영의 옛 코드가 접두어 없는 키로 중복 거래를 넣고, 2개 지역 설정을 읽지 못한다(최종 리뷰 Critical 1·Important 1). 새 코드가 마이그레이션 전에 돌면 `loggedMonths`에서 오류가 나 아무것도 넣지 않으므로 안전하다. 06시·월 08시 KST를 피한다.

- [ ] **Step 1: 사용자 확인** — 머지·push·마이그레이션을 한 번에 진행해도 되는지 묻는다.
- [ ] **Step 2: 배포** — squash 머지 → push → Vercel 배포 완료 확인.
- [ ] **Step 3: 마이그레이션(배포 직후)** — `npm run db:migrate`. 확인 쿼리: `wtm_collect_log` 행 수, `wtm_deals`에서 `deal_key not like sgg_cd || '|%'` 0건, 전체 거래 수가 전과 같음.
- [ ] **Step 4: 운영 Cron 한 번** — 운영 `CRON_SECRET`으로 collect 호출 → `ok: true`, 김포 지난 10개월 채우기, 새 거래는 계약일 시각.
- [ ] **Step 5: 화면** — 운영에서 설정 → 지역 추가 → 저장 → "받는 중" 문구 → 몇 분 뒤 목록에 지역별 동 칩·부제·네이버 검색어 확인(사용자). 필요 없으면 지역을 지우고 저장.
- [ ] **Step 6: 문서** — 인계 문서 CLAUDE.md(저장소 밖)에 2단계 내용을 적는다.
