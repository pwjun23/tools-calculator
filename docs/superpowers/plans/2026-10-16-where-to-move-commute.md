# 이사 어디 3단계 — 통근 어림값 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 직장 주소를 설정하면 거래 카드마다 직장까지 직선거리와 대중교통·자가용 예상 시간 범위, ⓘ 설명, 카카오맵 길찾기 링크를 보여 주고 통근 시간으로 거른다.

**Architecture:** 단지 좌표는 행정안전부 도로명주소 검색·좌표 API(저장 허용)로 구해 새 표 `wtm_complexes`에 한 번만 저장한다. 수집 때 단지를 `pending`으로 넣고, Cron·설정 저장 뒤·일회성 스크립트가 좌표를 채운다. 어림값은 화면을 그릴 때 순수 함수로 계산하며 저장하지 않는다.

**Tech Stack:** Next 16(app router, server actions, `after()`), drizzle + Neon Postgres, zod 4, vitest, tsx, proj4 2.22.0(UTM-K → WGS84).

**Spec:** `docs/superpowers/specs/2026-10-16-where-to-move-commute-design.md`

## Global Constraints
- 비용(요금·유류비·통행료)은 보여 주지 않는다. 시간 어림값만.
- 실제 길찾기 API는 쓰지 않는다. 좌표는 도로명주소 API로만 구해 저장한다.
- 키: `JUSO_SEARCH_KEY`, `JUSO_COORD_KEY`. 키 값은 출력·로그·오류 메시지·커밋에 넣지 않는다.
- 공개 저장소다. 테스트·문서는 가상 값과 공공 장소(시청 등)만 쓴다. 실제 직장 주소를 넣지 않는다.
- 어림 상수: 도로 = 직선 × 1.3, 자가용 시속 25~40km + 5분, 대중교통 시속 15~25km + 10~20분, 5분 단위 반올림.
- 필터는 어림 범위의 **최솟값** 기준, `commute: null` 거래는 숨기지 않는다. 직장이 없으면 통근 UI를 모두 숨긴다.
- 직장은 0~1개(`MAX_WORKPLACES = 1`), 좌표 범위 위도 33~39, 경도 124~132.
- Cron 1회 좌표 채우기 최대 100단지, Cron 시작 뒤 240초가 지나면 멈춘다.
- 커밋 메시지 끝 두 줄: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` / `Claude-Session: https://claude.ai/code/session_01FSrCBnDvxCnDf8cKSTEwxh`
- main 머지·push·운영 마이그레이션은 사용자 확인 뒤에만 한다.

## Review Focus
1. 거래 카드의 `.cardLink::after`가 카드 전체를 덮는다. ⓘ 버튼·설명·길찾기 링크가 눌리지 않으면 기능이 없는 것과 같다 → `position: relative; z-index: 1` 확인(Task 10).
2. 도로명주소 검색 API는 특수문자(`%=><[]`)·SQL 예약어가 든 키워드를 오류로 돌려준다 → `cleanKeyword` 테스트(Task 3).
3. Cron은 수집 뒤에 좌표를 채운다. 300초를 넘기면 수집 결과까지 잃는다 → `geocodePending`의 `deadline` 테스트(Task 7).
4. 예전 설정(workplaces 없음)이 `valid=false`가 되면 알림이 멈춘다 → `readStoredSettings` 테스트(Task 4).
5. 도로명·지번 주소가 모두 빈 단지는 API를 부르지 않고 `notfound` → 테스트(Task 7).

## File Structure
- Create `lib/whereToMove/commute.ts` (+ test): 거리·어림값·설명 문구·카카오맵 링크·필터 판정.
- Create `lib/whereToMove/coord.ts` (+ test): UTM-K → WGS84.
- Create `lib/whereToMove/juso.ts` (+ test): 도로명주소 API 호출·파싱·키워드 정리·`locateAddress`.
- Create `lib/whereToMove/complexes.ts` (+ test): 거래 → 단지 씨앗(`complexSeeds`), 주소 문자열.
- Create `lib/whereToMove/geocode.ts` (+ test): `geocodePending`(의존성 주입).
- Create `scripts/where-to-move/probe-juso.ts`, `scripts/where-to-move/backfill-complexes.ts`.
- Create `app/whereToMove/settings/WorkplacePicker.tsx`.
- Modify `lib/whereToMove/settings.ts`, `types.ts`, `molit.ts`, `regions.ts`, `schema.ts`, `repo.ts`, `app/api/where-to-move/cron/collect/route.ts`, `app/whereToMove/settings/actions.ts`, `SettingsForm.tsx`, `app/whereToMove/page.tsx`, `DealBoard.tsx`, `board.module.css`.
- Generate `drizzle/0002_*.sql`.

---

### Task 1: 어림값 순수 함수 (`commute.ts`)

**Files:**
- Create: `lib/whereToMove/commute.ts`
- Test: `lib/whereToMove/commute.test.ts`

**Interfaces:**
- Produces:
  - `type LatLng = { lat: number; lng: number }`
  - `type CommuteEstimate = { km: number; transit: [number, number]; car: [number, number] }`
  - `type CommuteMode = "off" | "transit" | "car"`
  - `COMMUTE_ASSUMPTIONS`
  - `straightKm(a: LatLng, b: LatLng): number`
  - `estimateCommute(km: number): CommuteEstimate`
  - `kmLabel(km: number): string`
  - `commuteHelp(): string[]`
  - `kakaoRouteUrl(by: "traffic" | "car", from: LatLng & { name: string }, to: LatLng & { name: string }): string`
  - `passesCommute(c: CommuteEstimate | null, mode: CommuteMode, maxMin: number): boolean`

- [ ] **Step 1: Write the failing test**

```ts
// lib/whereToMove/commute.test.ts
import { describe, expect, it } from "vitest";
import { commuteHelp, estimateCommute, kakaoRouteUrl, kmLabel, passesCommute, straightKm } from "./commute";

describe("straightKm", () => {
  it("위도 1도는 약 111.19km", () => {
    expect(straightKm({ lat: 37, lng: 127 }, { lat: 38, lng: 127 })).toBeCloseTo(111.19, 1);
  });
  it("같은 점은 0", () => expect(straightKm({ lat: 37.5, lng: 127 }, { lat: 37.5, lng: 127 })).toBe(0));
});

describe("estimateCommute", () => {
  it("0km 는 최소 시간만", () => {
    expect(estimateCommute(0)).toEqual({ km: 0, car: [5, 5], transit: [10, 20] });
  });
  it("10km: 도로 13km 로 계산하고 5분 단위 반올림", () => {
    expect(estimateCommute(10)).toEqual({ km: 10, car: [25, 35], transit: [40, 70] });
  });
  it("30km", () => {
    expect(estimateCommute(30)).toEqual({ km: 30, car: [65, 100], transit: [105, 175] });
  });
  it("최솟값은 최댓값을 넘지 않는다", () => {
    for (const km of [0.3, 1, 2.7, 8, 15, 42]) {
      const e = estimateCommute(km);
      expect(e.car[0]).toBeLessThanOrEqual(e.car[1]);
      expect(e.transit[0]).toBeLessThanOrEqual(e.transit[1]);
    }
  });
});

describe("kmLabel", () => {
  it("1km 미만", () => expect(kmLabel(0.4)).toBe("1km 미만"));
  it("10km 미만은 소수 한 자리", () => expect(kmLabel(3.46)).toBe("3.5km"));
  it("10km 이상은 정수", () => expect(kmLabel(14.2)).toBe("14km"));
});

describe("commuteHelp", () => {
  it("직선거리 어림값이라는 점과 상수 값을 담는다", () => {
    const t = commuteHelp().join("\n");
    expect(t).toContain("직선거리");
    expect(t).toContain("1.3");
    expect(t).toContain("시속 25~40km");
    expect(t).toContain("시속 15~25km");
    expect(t).toContain("카카오맵");
  });
});

describe("kakaoRouteUrl", () => {
  it("이름의 쉼표·슬래시를 지우고 출발/도착 순서로 만든다", () => {
    const u = kakaoRouteUrl("traffic", { name: "가상,단지/1", lat: 37.6, lng: 126.7 }, { name: "직장", lat: 37.5, lng: 127.0 });
    expect(u).toBe(`https://map.kakao.com/link/by/traffic/${encodeURIComponent("가상 단지 1")},37.6,126.7/${encodeURIComponent("직장")},37.5,127`);
  });
});

describe("passesCommute", () => {
  const e = { km: 10, car: [25, 35] as [number, number], transit: [40, 70] as [number, number] };
  it("off 면 통과", () => expect(passesCommute(e, "off", 30)).toBe(true));
  it("어림값이 없으면 숨기지 않는다", () => expect(passesCommute(null, "transit", 30)).toBe(true));
  it("최솟값 기준", () => {
    expect(passesCommute(e, "transit", 45)).toBe(true);
    expect(passesCommute(e, "transit", 30)).toBe(false);
    expect(passesCommute(e, "car", 30)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/whereToMove/commute.test.ts`
Expected: FAIL — `Failed to resolve import "./commute"`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/whereToMove/commute.ts
export type LatLng = { lat: number; lng: number };
export type CommuteEstimate = { km: number; transit: [number, number]; car: [number, number] };
export type CommuteMode = "off" | "transit" | "car";

/** 어림값 가정. 바꾸면 ⓘ 설명 문구도 같이 바뀐다. */
export const COMMUTE_ASSUMPTIONS = {
  roadFactor: 1.3,
  car: { kmh: [25, 40], extraMin: 5 },
  transit: { kmh: [15, 25], extraMin: [10, 20] },
} as const;

const R = 6371;
const rad = (d: number) => (d * Math.PI) / 180;

/** 두 좌표 사이 직선(대원) 거리, km. */
export function straightKm(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

const round5 = (m: number) => Math.round(m / 5) * 5;

/** 직선거리로 추정한 통근 시간 범위(분). 길찾기 결과가 아니다. */
export function estimateCommute(km: number): CommuteEstimate {
  const A = COMMUTE_ASSUMPTIONS;
  const road = km * A.roadFactor;
  const mins = (kmh: number, extra: number) => (road / kmh) * 60 + extra;
  return {
    km: Math.round(km * 10) / 10,
    car: [round5(mins(A.car.kmh[1], A.car.extraMin)), round5(mins(A.car.kmh[0], A.car.extraMin))],
    transit: [round5(mins(A.transit.kmh[1], A.transit.extraMin[0])), round5(mins(A.transit.kmh[0], A.transit.extraMin[1]))],
  };
}

export function kmLabel(km: number): string {
  if (km < 1) return "1km 미만";
  return km < 10 ? `${Math.round(km * 10) / 10}km` : `${Math.round(km)}km`;
}

/** ⓘ 설명 문구. 상수에서 만든다. */
export function commuteHelp(): string[] {
  const A = COMMUTE_ASSUMPTIONS;
  return [
    "이 시간은 길찾기 결과가 아닙니다. 단지와 직장 사이의 직선거리로 추정한 어림값입니다.",
    `계산: 실제 길은 직선보다 길어서 직선거리 × ${A.roadFactor}을 도로 거리로 봅니다. 자가용은 시속 ${A.car.kmh[0]}~${A.car.kmh[1]}km에 ${A.car.extraMin}분, 대중교통은 시속 ${A.transit.kmh[0]}~${A.transit.kmh[1]}km에 걷기·기다리기 ${A.transit.extraMin[0]}~${A.transit.extraMin[1]}분을 더했습니다.`,
    "반영 안 된 것: 실제 노선과 환승, 배차 간격, 출퇴근 혼잡(예: 김포골드라인), 신호·정체, 주차.",
    "강·바다·철길을 돌아가야 하거나 다리·IC가 먼 곳은 실제와 크게 다를 수 있습니다.",
    "정확한 시간·경로·요금은 길찾기 버튼으로 카카오맵에서 확인하세요.",
  ];
}

const placeName = (s: string) => encodeURIComponent(s.replace(/[,/]/g, " ").replace(/\s+/g, " ").trim());

/** 카카오맵 URL 길찾기(https://apis.map.kakao.com/web/guide/#routeurl). traffic=대중교통. */
export function kakaoRouteUrl(by: "traffic" | "car", from: LatLng & { name: string }, to: LatLng & { name: string }): string {
  return `https://map.kakao.com/link/by/${by}/${placeName(from.name)},${from.lat},${from.lng}/${placeName(to.name)},${to.lat},${to.lng}`;
}

/** 통근 필터. 어림 범위의 최솟값 기준이고, 어림값이 없으면 숨기지 않는다. */
export function passesCommute(c: CommuteEstimate | null, mode: CommuteMode, maxMin: number): boolean {
  if (mode === "off" || !c) return true;
  return c[mode][0] <= maxMin;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/whereToMove/commute.test.ts`
Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
git add lib/whereToMove/commute.ts lib/whereToMove/commute.test.ts
git commit -m "feat(whereToMove): 직선거리 통근 어림값 함수"
```

---

### Task 2: UTM-K → WGS84 (`coord.ts`)

**Files:**
- Modify: `package.json` (proj4)
- Create: `lib/whereToMove/coord.ts`
- Test: `lib/whereToMove/coord.test.ts`

**Interfaces:**
- Produces: `utmkToWgs84(x: number, y: number): { lat: number; lng: number }`, `wgs84ToUtmk(lat: number, lng: number): { x: number; y: number }`(테스트·검증용)

- [ ] **Step 1: Install**

Run: `npm i proj4@2.22.0`
Expected: `package.json` dependencies에 `"proj4": "^2.22.0"` 추가. proj4는 자체 타입(`dist/index.d.ts`)이 있다.

- [ ] **Step 2: Write the failing test**

```ts
// lib/whereToMove/coord.test.ts
import { describe, expect, it } from "vitest";
import { utmkToWgs84, wgs84ToUtmk } from "./coord";

describe("utmkToWgs84", () => {
  it("UTM-K 원점(1,000,000 / 2,000,000)은 북위 38도, 동경 127.5도", () => {
    const p = utmkToWgs84(1000000, 2000000);
    expect(p.lat).toBeCloseTo(38, 6);
    expect(p.lng).toBeCloseTo(127.5, 6);
  });
  it("왕복 변환 오차 1m 미만", () => {
    const { x, y } = wgs84ToUtmk(37.615, 126.716);
    const p = utmkToWgs84(x, y);
    expect(p.lat).toBeCloseTo(37.615, 5);
    expect(p.lng).toBeCloseTo(126.716, 5);
  });
  it("서쪽·남쪽은 원점보다 작은 x·y", () => {
    const { x, y } = wgs84ToUtmk(37.5, 127);
    expect(x).toBeLessThan(1000000);
    expect(y).toBeLessThan(2000000);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run lib/whereToMove/coord.test.ts`
Expected: FAIL — `Failed to resolve import "./coord"`.

- [ ] **Step 4: Write minimal implementation**

```ts
// lib/whereToMove/coord.ts
import proj4 from "proj4";

/** 도로명주소 좌표 API가 주는 UTM-K(GRS80, EPSG:5179). */
const UTMK = "+proj=tmerc +lat_0=38 +lon_0=127.5 +k=0.9996 +x_0=1000000 +y_0=2000000 +ellps=GRS80 +units=m +no_defs";
const WGS84 = "EPSG:4326";

export function utmkToWgs84(x: number, y: number): { lat: number; lng: number } {
  const [lng, lat] = proj4(UTMK, WGS84, [x, y]);
  return { lat, lng };
}

export function wgs84ToUtmk(lat: number, lng: number): { x: number; y: number } {
  const [x, y] = proj4(WGS84, UTMK, [lng, lat]);
  return { x, y };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run lib/whereToMove/coord.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json lib/whereToMove/coord.ts lib/whereToMove/coord.test.ts
git commit -m "feat(whereToMove): UTM-K 좌표를 위경도로 변환"
```

---

### Task 3: 도로명주소 API (`juso.ts`) + 실제 호출 확인

**Files:**
- Create: `lib/whereToMove/juso.ts`
- Test: `lib/whereToMove/juso.test.ts`
- Create: `scripts/where-to-move/probe-juso.ts`

**Interfaces:**
- Consumes: `utmkToWgs84` (Task 2)
- Produces:
  - `type JusoRef = { admCd: string; rnMgtSn: string; udrtYn: string; buldMnnm: string; buldSlno: string }`
  - `type JusoCandidate = JusoRef & { roadAddr: string; jibunAddr: string; bdNm: string }`
  - `jusoKeys(): { search: string; coord: string } | null`
  - `cleanKeyword(s: string): string`
  - `parseSearch(json: unknown): JusoCandidate[]` (오류 코드면 throw)
  - `parseCoord(json: unknown): { x: number; y: number } | null`
  - `searchAddress(keyword: string, key: string, fetchFn?: typeof fetch): Promise<JusoCandidate[]>`
  - `coordOf(ref: JusoRef, key: string, fetchFn?: typeof fetch): Promise<{ lat: number; lng: number } | null>`
  - `locateAddress(address: string, keys: { search: string; coord: string }, fetchFn?: typeof fetch): Promise<{ lat: number; lng: number } | null>` — 결과 없음은 null, 네트워크·키 오류는 throw.

응답 모양(도로명주소 개발자센터 문서 기준, Step 6에서 실제 호출로 확인):
- 검색 `GET https://business.juso.go.kr/addrlink/addrLinkApi.do?confmKey=&currentPage=1&countPerPage=10&keyword=&resultType=json` → `{ results: { common: { errorCode: "0", errorMessage: "정상", totalCount: "1" }, juso: [{ roadAddr, jibunAddr, admCd, rnMgtSn, udrtYn, buldMnnm, buldSlno, bdNm, ... }] | null } }`
- 좌표 `GET https://business.juso.go.kr/addrlink/addrCoordApi.do?confmKey=&admCd=&rnMgtSn=&udrtYn=&buldMnnm=&buldSlno=&resultType=json` → `{ results: { common: {...}, juso: [{ entX: "953000.1", entY: "1952000.2", ... }] | null } }`

- [ ] **Step 1: Write the failing test**

```ts
// lib/whereToMove/juso.test.ts
import { describe, expect, it } from "vitest";
import { cleanKeyword, coordOf, locateAddress, parseCoord, parseSearch, searchAddress } from "./juso";
import { wgs84ToUtmk } from "./coord";

const cand = { roadAddr: "가상시 가상로 1", jibunAddr: "가상시 가상동 1", admCd: "1111010100", rnMgtSn: "111103100001", udrtYn: "0", buldMnnm: "1", buldSlno: "0", bdNm: "가상빌딩" };
const ok = (juso: unknown) => ({ results: { common: { errorCode: "0", errorMessage: "정상", totalCount: "1" }, juso } });
const res = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

describe("cleanKeyword", () => {
  it("특수문자를 지우고 공백을 하나로", () => expect(cleanKeyword("  가상로 [1] %=<>  ")).toBe("가상로 1"));
  it("SQL 예약어를 지운다", () => expect(cleanKeyword("가상로 select 1 OR union")).toBe("가상로 1"));
});

describe("parseSearch", () => {
  it("후보를 필요한 필드만 꺼낸다", () => {
    expect(parseSearch(ok([{ ...cand, zipNo: "00000" }]))).toEqual([cand]);
  });
  it("juso 가 null 이면 빈 목록", () => expect(parseSearch(ok(null))).toEqual([]));
  it("오류 코드면 메시지와 함께 throw", () => {
    expect(() => parseSearch({ results: { common: { errorCode: "E0001", errorMessage: "승인되지 않은 KEY 입니다." }, juso: null } })).toThrow("E0001");
  });
  it("모양이 다르면 throw", () => expect(() => parseSearch({ foo: 1 })).toThrow());
});

describe("parseCoord", () => {
  it("entX·entY 를 숫자로", () => expect(parseCoord(ok([{ entX: "953000.5", entY: "1952000.25" }]))).toEqual({ x: 953000.5, y: 1952000.25 }));
  it("결과 없음은 null", () => expect(parseCoord(ok([]))).toBeNull());
});

describe("searchAddress / coordOf / locateAddress", () => {
  it("검색 URL 에 키·키워드·json 을 넣는다", async () => {
    let url = "";
    await searchAddress("가상로 1", "KEY", async (u) => { url = String(u); return res(ok([cand])); });
    expect(url).toContain("addrLinkApi.do");
    expect(url).toContain("confmKey=KEY");
    expect(url).toContain(`keyword=${encodeURIComponent("가상로 1")}`);
    expect(url).toContain("resultType=json");
  });
  it("HTTP 오류는 키를 빼고 throw", async () => {
    await expect(searchAddress("가상로", "SECRETKEY", async () => new Response("bad", { status: 500 }))).rejects.toThrow(/500/);
    await expect(searchAddress("가상로", "SECRETKEY", async () => new Response("bad", { status: 500 }))).rejects.not.toThrow(/SECRETKEY/);
  });
  it("좌표를 위경도로 바꾼다", async () => {
    const { x, y } = wgs84ToUtmk(37.6, 126.7);
    const p = await coordOf(cand, "KEY", async () => res(ok([{ entX: String(x), entY: String(y) }])));
    expect(p!.lat).toBeCloseTo(37.6, 5);
    expect(p!.lng).toBeCloseTo(126.7, 5);
  });
  it("locateAddress: 검색 결과가 없으면 좌표 API 를 부르지 않고 null", async () => {
    let calls = 0;
    const p = await locateAddress("없는 주소", { search: "S", coord: "C" }, async () => { calls++; return res(ok(null)); });
    expect(p).toBeNull();
    expect(calls).toBe(1);
  });
  it("locateAddress: 첫 후보의 좌표", async () => {
    const { x, y } = wgs84ToUtmk(37.5, 127);
    const p = await locateAddress("가상로 1", { search: "S", coord: "C" }, async (u) =>
      String(u).includes("addrCoordApi") ? res(ok([{ entX: String(x), entY: String(y) }])) : res(ok([cand])));
    expect(p!.lat).toBeCloseTo(37.5, 5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/whereToMove/juso.test.ts`
Expected: FAIL — `Failed to resolve import "./juso"`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/whereToMove/juso.ts
import { utmkToWgs84 } from "./coord";

/** 행정안전부 도로명주소 API. 공공데이터포털 표기 '이용허락범위 제한 없음'이라 좌표를 저장해 쓴다. */
const SEARCH_URL = "https://business.juso.go.kr/addrlink/addrLinkApi.do";
const COORD_URL = "https://business.juso.go.kr/addrlink/addrCoordApi.do";

export type JusoRef = { admCd: string; rnMgtSn: string; udrtYn: string; buldMnnm: string; buldSlno: string };
export type JusoCandidate = JusoRef & { roadAddr: string; jibunAddr: string; bdNm: string };

export function jusoKeys(): { search: string; coord: string } | null {
  const search = process.env.JUSO_SEARCH_KEY?.trim();
  const coord = process.env.JUSO_COORD_KEY?.trim();
  return search && coord ? { search, coord } : null;
}

const SQL_WORDS = /\b(OR|SELECT|INSERT|DELETE|UPDATE|CREATE|DROP|EXEC|UNION|FETCH|DECLARE|TRUNCATE)\b/gi;

/** 검색 API가 거부하는 특수문자·SQL 예약어를 지운다. */
export function cleanKeyword(s: string): string {
  return s.replace(/[%=><\[\]]/g, " ").replace(SQL_WORDS, " ").replace(/\s+/g, " ").trim();
}

type Body = { results?: { common?: { errorCode?: string; errorMessage?: string }; juso?: Record<string, string>[] | null } };

function rows(json: unknown): Record<string, string>[] {
  const r = (json as Body)?.results;
  if (!r?.common) throw new Error("도로명주소 API 응답 형식이 다릅니다");
  if (r.common.errorCode !== "0") throw new Error(`도로명주소 API 오류 ${r.common.errorCode}: ${r.common.errorMessage ?? ""}`);
  return Array.isArray(r.juso) ? r.juso : [];
}

export function parseSearch(json: unknown): JusoCandidate[] {
  return rows(json).map((j) => ({
    roadAddr: j.roadAddr ?? "", jibunAddr: j.jibunAddr ?? "", bdNm: j.bdNm ?? "",
    admCd: j.admCd ?? "", rnMgtSn: j.rnMgtSn ?? "", udrtYn: j.udrtYn ?? "0", buldMnnm: j.buldMnnm ?? "", buldSlno: j.buldSlno ?? "0",
  }));
}

export function parseCoord(json: unknown): { x: number; y: number } | null {
  const j = rows(json)[0];
  const x = Number(j?.entX);
  const y = Number(j?.entY);
  return j && Number.isFinite(x) && Number.isFinite(y) && x > 0 && y > 0 ? { x, y } : null;
}

async function getJson(base: string, params: Record<string, string>, fetchFn: typeof fetch): Promise<unknown> {
  const res = await fetchFn(`${base}?${new URLSearchParams({ ...params, resultType: "json" })}`, { cache: "no-store" });
  // 오류 메시지에 URL(키 포함)을 넣지 않는다.
  if (!res.ok) throw new Error(`도로명주소 API 호출 실패 (${res.status})`);
  return res.json();
}

export async function searchAddress(keyword: string, key: string, fetchFn: typeof fetch = fetch): Promise<JusoCandidate[]> {
  const json = await getJson(SEARCH_URL, { confmKey: key, currentPage: "1", countPerPage: "10", keyword: cleanKeyword(keyword) }, fetchFn);
  return parseSearch(json);
}

export async function coordOf(ref: JusoRef, key: string, fetchFn: typeof fetch = fetch): Promise<{ lat: number; lng: number } | null> {
  const json = await getJson(COORD_URL, { confmKey: key, admCd: ref.admCd, rnMgtSn: ref.rnMgtSn, udrtYn: ref.udrtYn, buldMnnm: ref.buldMnnm, buldSlno: ref.buldSlno }, fetchFn);
  const p = parseCoord(json);
  return p ? utmkToWgs84(p.x, p.y) : null;
}

/** 주소 문자열의 좌표. 결과가 없으면 null, 네트워크·키 오류는 throw. */
export async function locateAddress(address: string, keys: { search: string; coord: string }, fetchFn: typeof fetch = fetch) {
  const [first] = await searchAddress(address, keys.search, fetchFn);
  return first ? coordOf(first, keys.coord, fetchFn) : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/whereToMove/juso.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the probe script**

```ts
// scripts/where-to-move/probe-juso.ts
// 실제 키로 한 번 불러 응답 모양을 확인한다. 키는 출력하지 않는다.
// 실행: npx tsx --env-file=.env.local scripts/where-to-move/probe-juso.ts
import { jusoKeys, locateAddress, searchAddress } from "../../lib/whereToMove/juso";

const keys = jusoKeys();
if (!keys) throw new Error("JUSO_SEARCH_KEY / JUSO_COORD_KEY 가 .env.local 에 없습니다");
const [c] = await searchAddress("경기도 김포시 사우중로 1", keys.search);
console.log("검색 첫 후보 필드:", c ? Object.keys(c).join(",") : "(없음)", "/", c?.roadAddr);
console.log("김포시청 좌표:", await locateAddress("경기도 김포시 사우중로 1", keys)); // 기대: 약 37.615, 126.716
console.log("지번 주소:", await locateAddress("경기도 김포시 풍무동 936", keys));
console.log("없는 주소:", await locateAddress("가상시 없는로 99999", keys));
```

- [ ] **Step 6: Run the probe (실제 키 필요)**

Run: `npx tsx --env-file=.env.local scripts/where-to-move/probe-juso.ts`
Expected: 후보 필드에 `roadAddr,jibunAddr,bdNm,admCd,rnMgtSn,udrtYn,buldMnnm,buldSlno`, 김포시청 좌표가 위도 37.60~37.63 / 경도 126.70~126.73, 지번 주소도 좌표, 없는 주소는 `null`.
키가 `.env.local`에 없으면 멈추고 사용자에게 넣어 달라고 요청한다(값을 채팅에 붙이지 말라고 안내). 응답 필드 이름이 다르면 `parseSearch`/`parseCoord`와 테스트 픽스처를 실제 이름으로 고치고 ledger에 Ruling으로 남긴다.

- [ ] **Step 7: Commit**

```bash
git add lib/whereToMove/juso.ts lib/whereToMove/juso.test.ts scripts/where-to-move/probe-juso.ts
git commit -m "feat(whereToMove): 도로명주소 검색·좌표 API"
```

---

### Task 4: 설정에 직장 추가

**Files:**
- Modify: `lib/whereToMove/settings.ts`
- Test: `lib/whereToMove/settings.test.ts` (기존 파일에 describe 추가)

**Interfaces:**
- Produces: `Settings["workplaces"]: { label: string; address: string; lat: number; lng: number }[]`, `MAX_WORKPLACES = 1`, `type Workplace`

- [ ] **Step 1: Write the failing test** (settings.test.ts 끝에 추가)

```ts
import { DEFAULT_SETTINGS, parseSettings, readStoredSettings } from "./settings";

describe("workplaces", () => {
  const wp = { label: "직장", address: "가상시 가상로 1", lat: 37.5, lng: 127 };
  it("기본값은 빈 목록", () => expect(DEFAULT_SETTINGS.workplaces).toEqual([]));
  it("1개 허용", () => expect(parseSettings({ ...DEFAULT_SETTINGS, workplaces: [wp] }).ok).toBe(true));
  it("2개 거부", () => expect(parseSettings({ ...DEFAULT_SETTINGS, workplaces: [wp, wp] }).ok).toBe(false));
  it("한국 밖 좌표 거부", () => {
    const r = parseSettings({ ...DEFAULT_SETTINGS, workplaces: [{ ...wp, lat: 10 }] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors)).toContain("workplaces.0.lat");
  });
  it("예전 설정(필드 없음)은 빈 목록으로 읽고 valid 를 유지한다", () => {
    const { workplaces: _, ...old } = DEFAULT_SETTINGS;
    const r = readStoredSettings(old);
    expect(r.valid).toBe(true);
    expect(r.settings.workplaces).toEqual([]);
  });
});
```
(파일 맨 위 import에 이미 있는 이름은 합친다.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/whereToMove/settings.test.ts`
Expected: FAIL — `DEFAULT_SETTINGS.workplaces` undefined 등.

- [ ] **Step 3: Implement** — `settings.ts`에서:

`MAX_REGIONS` 아래에 추가:
```ts
/** 직장 수. 지금은 1곳, 나중에 늘린다. */
export const MAX_WORKPLACES = 1;

const workplaceSchema = z.object({
  label: z.string().trim().min(1).max(20),
  address: z.string().trim().min(1).max(200),
  lat: z.number().min(33).max(39),
  lng: z.number().min(124).max(132),
});
```
`settingsSchema`의 `regions` 다음에 `workplaces: z.array(workplaceSchema).max(MAX_WORKPLACES),`
타입 export에 `export type Workplace = z.infer<typeof workplaceSchema>;`
`DEFAULT_SETTINGS`의 `regions` 다음에 `workplaces: [],`
(`readStoredSettings`는 `...DEFAULT_SETTINGS`를 먼저 펴므로 고칠 필요 없다.)

- [ ] **Step 4: Run tests**

Run: `npx vitest run lib/whereToMove`
Expected: PASS(기존 설정 테스트 포함). 다른 파일의 `Settings` 리터럴이 타입 오류면 `npx tsc --noEmit`으로 찾아 `workplaces: []`를 더한다.

- [ ] **Step 5: Commit**

```bash
git add lib/whereToMove/settings.ts lib/whereToMove/settings.test.ts
git commit -m "feat(whereToMove): 설정에 직장(최대 1곳) 추가"
```

---

### Task 5: 거래에서 단지 주소 꺼내기

**Files:**
- Modify: `lib/whereToMove/types.ts`, `lib/whereToMove/molit.ts`, `lib/whereToMove/regions.ts`
- Create: `lib/whereToMove/complexes.ts`
- Test: `lib/whereToMove/complexes.test.ts`, `lib/whereToMove/regions.test.ts`(추가), `lib/whereToMove/molit.test.ts`(기대값 수정·추가)

**Interfaces:**
- Produces:
  - `MolitDeal`에 선택 필드 `aptSeq?: string; roadAddr?: string; jibunAddr?: string`
  - `addrPrefix(sggCd: string): string` (regions.ts) — `경기도 김포시`, 세종처럼 시·도=시·군·구면 시·도 이름 하나, 목록에 없으면 `""`
  - `type ComplexSeed = { sggCd: string; dong: string; apt: string; aptSeq: string; roadAddr: string; jibunAddr: string }`
  - `complexKey(c: { sggCd: string; dong: string; apt: string }): string` → `"sggCd|dong|apt"`
  - `complexSeeds(deals: MolitDeal[]): ComplexSeed[]`

- [ ] **Step 1: Write the failing tests**

```ts
// lib/whereToMove/complexes.test.ts
import { describe, expect, it } from "vitest";
import { complexKey, complexSeeds } from "./complexes";
import type { MolitDeal } from "./types";

const d = (p: Partial<MolitDeal>): MolitDeal => ({
  key: Math.random().toString(), type: "전세", sggCd: "11110", dong: "가상동", apt: "가상단지", area: 84, areaRaw: 84, floor: "3",
  date: "2026-09-01", amount: 30000, rent: 0, renewal: false, cancelled: false, ...p,
});

describe("complexSeeds", () => {
  it("단지마다 하나, 도로명 주소가 있는 것을 고른다", () => {
    const s = complexSeeds([
      d({ roadAddr: "", jibunAddr: "서울특별시 종로구 가상동 1", aptSeq: "11110-1" }),
      d({ roadAddr: "서울특별시 종로구 가상로 5", jibunAddr: "서울특별시 종로구 가상동 1", aptSeq: "11110-1" }),
      d({ apt: "다른단지", roadAddr: "", jibunAddr: "" }),
    ]);
    expect(s).toEqual([
      { sggCd: "11110", dong: "가상동", apt: "가상단지", aptSeq: "11110-1", roadAddr: "서울특별시 종로구 가상로 5", jibunAddr: "서울특별시 종로구 가상동 1" },
      { sggCd: "11110", dong: "가상동", apt: "다른단지", aptSeq: "", roadAddr: "", jibunAddr: "" },
    ]);
  });
  it("단지명이 빈 거래는 뺀다", () => expect(complexSeeds([d({ apt: "" })])).toEqual([]));
  it("complexKey", () => expect(complexKey({ sggCd: "1", dong: "가 리", apt: "단지" })).toBe("1|가 리|단지"));
});
```

regions.test.ts에 추가:
```ts
import { addrPrefix } from "./regions";
describe("addrPrefix", () => {
  it("시·도 + 시·군·구", () => expect(addrPrefix("41570")).toBe("경기도 김포시"));
  it("세종은 한 번만", () => expect(addrPrefix("36110")).toBe("세종특별자치시"));
  it("없는 코드는 빈 문자열", () => expect(addrPrefix("00000")).toBe(""));
});
```

molit.test.ts에 추가(기존 `normalizeTrade`/`normalizeRent` 기대값이 `toEqual`이면 새 필드를 기대값에 더한다):
```ts
describe("단지 주소", () => {
  const base = { aptNm: "가상", umdNm: "양촌읍 양곡리", excluUseAr: "84.9", floor: "3", dealYear: "2026", dealMonth: "9", dealDay: "1", jibun: "12-3", aptSeq: "41570-1" };
  it("매매: 도로명 + 본번(-부번)", () => {
    const t = normalizeTrade({ ...base, dealAmount: "30,000", roadNm: "가상로", roadNmBonbun: "00215", roadNmBubun: "00003" }, "41570")!;
    expect(t.roadAddr).toBe("경기도 김포시 가상로 215-3");
    expect(t.jibunAddr).toBe("경기도 김포시 양촌읍 양곡리 12-3");
    expect(t.aptSeq).toBe("41570-1");
  });
  it("매매: 부번 0 은 생략, 도로명이 없으면 빈 값", () => {
    expect(normalizeTrade({ ...base, dealAmount: "1", roadNm: "가상로", roadNmBonbun: "00064", roadNmBubun: "00000" }, "41570")!.roadAddr).toBe("경기도 김포시 가상로 64");
    expect(normalizeTrade({ ...base, dealAmount: "1", roadNm: "" }, "41570")!.roadAddr).toBe("");
  });
  it("전월세: roadnm 그대로", () => {
    const r = normalizeRent({ ...base, deposit: "1", monthlyRent: "0", roadnm: "가상로 64" }, "41570")!;
    expect(r.roadAddr).toBe("경기도 김포시 가상로 64");
  });
  it("지번이 없으면 지번 주소도 빈 값", () => {
    expect(normalizeRent({ ...base, jibun: "", deposit: "1", monthlyRent: "0" }, "41570")!.jibunAddr).toBe("");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/whereToMove/complexes.test.ts lib/whereToMove/regions.test.ts lib/whereToMove/molit.test.ts`
Expected: FAIL — `./complexes` 없음, `addrPrefix` 없음, `roadAddr` undefined.

- [ ] **Step 3: Implement**

`types.ts`의 `MolitDeal` 끝에:
```ts
  /** 국토부 단지 일련번호(예: 41570-998). 수집 때만 있고 DB 거래 표에는 없다. */
  aptSeq?: string;
  /** 시·도부터 쓴 도로명 주소. 없으면 "". */
  roadAddr?: string;
  /** 시·도부터 쓴 지번 주소. 없으면 "". */
  jibunAddr?: string;
```

`regions.ts`에 추가:
```ts
const SIDO_OF = new Map<string, string>(REGION_TREE.sidos.flatMap((s) => s.sggs.map((g) => [g.cd, s.name] as const)));

/** 주소 앞부분 '시·도 시·군·구'. 세종처럼 같으면 한 번만. 목록에 없으면 "". */
export function addrPrefix(sggCd: string): string {
  const g = BY_CD.get(sggCd);
  const sido = SIDO_OF.get(sggCd);
  if (!g || !sido) return "";
  return g.name === sido ? sido : `${sido} ${g.name}`;
}
```

`molit.ts`: `import { addrPrefix } from "./regions";` 추가, `build`에 주소 인자를 더한다.
```ts
const num = (s: string | undefined) => parseInt(s ?? "", 10) || 0;
const join = (...parts: string[]) => parts.filter(Boolean).join(" ");

function siteOf(it: Record<string, string>, sggCd: string, road: string) {
  const prefix = addrPrefix(sggCd);
  return {
    aptSeq: it.aptSeq ?? "",
    roadAddr: road ? join(prefix, road) : "",
    jibunAddr: it.jibun ? join(prefix, it.umdNm, it.jibun) : "",
  };
}

const tradeRoad = (it: Record<string, string>) => {
  if (!it.roadNm || !num(it.roadNmBonbun)) return "";
  const bu = num(it.roadNmBubun);
  return `${it.roadNm} ${num(it.roadNmBonbun)}${bu ? `-${bu}` : ""}`;
};
```
`build(...)`의 반환을 `{ ...base, key: dealKey(base), ...site }`로 바꾸고, `build`에 `site: ReturnType<typeof siteOf>` 인자를 추가한다. `normalizeTrade`는 `siteOf(it, sggCd, tradeRoad(it))`, `normalizeRent`는 `siteOf(it, sggCd, (it.roadnm ?? "").trim())`를 넘긴다. `dealKey`는 바꾸지 않는다.

```ts
// lib/whereToMove/complexes.ts
import type { MolitDeal } from "./types";

export type ComplexSeed = { sggCd: string; dong: string; apt: string; aptSeq: string; roadAddr: string; jibunAddr: string };

/** 단지 키. 거래 표와 같은 (시·군·구, 동(umdNm 그대로), 단지명). */
export const complexKey = (c: { sggCd: string; dong: string; apt: string }) => `${c.sggCd}|${c.dong}|${c.apt}`;

/** 거래들에서 단지를 하나씩 꺼낸다. 같은 단지면 도로명 주소가 있는 쪽, 지번이 있는 쪽을 채운다. */
export function complexSeeds(deals: MolitDeal[]): ComplexSeed[] {
  const out = new Map<string, ComplexSeed>();
  for (const d of deals) {
    if (!d.apt) continue;
    const k = complexKey(d);
    const cur = out.get(k);
    const next: ComplexSeed = { sggCd: d.sggCd, dong: d.dong, apt: d.apt, aptSeq: d.aptSeq ?? "", roadAddr: d.roadAddr ?? "", jibunAddr: d.jibunAddr ?? "" };
    if (!cur) { out.set(k, next); continue; }
    cur.roadAddr ||= next.roadAddr;
    cur.jibunAddr ||= next.jibunAddr;
    cur.aptSeq ||= next.aptSeq;
  }
  return [...out.values()];
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run lib/whereToMove`
Expected: PASS(전체). 기존 molit 기대값 수정이 필요했다면 그 수정만 한다.

- [ ] **Step 5: Commit**

```bash
git add lib/whereToMove/types.ts lib/whereToMove/molit.ts lib/whereToMove/molit.test.ts lib/whereToMove/regions.ts lib/whereToMove/regions.test.ts lib/whereToMove/complexes.ts lib/whereToMove/complexes.test.ts
git commit -m "feat(whereToMove): 거래에서 단지 주소 꺼내기"
```

---

### Task 6: `wtm_complexes` 표와 repo 함수

**Files:**
- Modify: `lib/whereToMove/schema.ts`, `lib/whereToMove/repo.ts`
- Generate: `drizzle/0002_*.sql`

**Interfaces:**
- Consumes: `ComplexSeed`, `complexSeeds`, `complexKey` (Task 5), `locateAddress`, `jusoKeys` (Task 3), `GeocodeDeps` (Task 7 — 이 Task에서는 타입만 import하므로 Task 7과 같은 커밋 순서 문제를 피하려고 `geocodeDeps`는 Task 7 Step 3에서 추가한다)
- Produces (repo.ts):
  - `type ComplexStatus = "pending" | "ok" | "notfound"` (schema.ts)
  - `upsertComplexes(seeds: ComplexSeed[]): Promise<void>` — 없으면 `pending`으로 넣고, 있으면 빈 주소·aptSeq만 채운다
  - `upsertDeals`가 끝에서 `upsertComplexes(complexSeeds(deals))`를 부른다
  - `pendingComplexes(limit: number): Promise<ComplexSeed[]>`
  - `saveComplexCoord(c: { sggCd; dong; apt }, p: { lat: number; lng: number } | null): Promise<void>` — null이면 `notfound`
  - `listComplexes(sggCds: string[]): Promise<Map<string, { status: ComplexStatus; lat: number | null; lng: number | null }>>` (키는 `complexKey`)
  - `resetNotFound(): Promise<number>`

- [ ] **Step 1: schema.ts에 표 추가**

`drizzle-orm/pg-core` import에 `doublePrecision`을 더하고 끝에:
```ts
export type ComplexStatus = "pending" | "ok" | "notfound";

/** 단지 좌표(도로명주소 API). 키는 거래 표와 같은 (시·군·구, 동, 단지명). */
export const wtmComplexes = pgTable(
  "wtm_complexes",
  {
    sggCd: text("sgg_cd").notNull(),
    dong: text("dong").notNull(),
    apt: text("apt").notNull(),
    aptSeq: text("apt_seq").notNull().default(""),
    roadAddr: text("road_addr").notNull().default(""),
    jibunAddr: text("jibun_addr").notNull().default(""),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    status: text("status").$type<ComplexStatus>().notNull().default("pending"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.sggCd, t.dong, t.apt] }), index("wtm_complexes_status_idx").on(t.status)],
);
```

- [ ] **Step 2: Generate migration**

Run: `npm run db:generate`
Expected: `drizzle/0002_<이름>.sql`에 `CREATE TABLE "wtm_complexes"`와 인덱스만 있다(다른 표 변경 없음). 내용을 읽어 확인한다. **운영 DB에 돌리는 것은 Task 11에서 사용자 확인 뒤.**

- [ ] **Step 3: repo.ts 함수 추가**

import에 `wtmComplexes`, `type ComplexStatus`, `complexKey`, `complexSeeds`, `type ComplexSeed`를 더한다.

```ts
/** 새 단지는 pending 으로 넣고, 있는 단지는 비어 있던 주소·단지 번호만 채운다. */
export async function upsertComplexes(seeds: ComplexSeed[]): Promise<void> {
  for (let i = 0; i < seeds.length; i += CHUNK) {
    await db
      .insert(wtmComplexes)
      .values(seeds.slice(i, i + CHUNK))
      .onConflictDoUpdate({
        target: [wtmComplexes.sggCd, wtmComplexes.dong, wtmComplexes.apt],
        set: {
          roadAddr: sql`case when ${wtmComplexes.roadAddr} = '' then excluded.road_addr else ${wtmComplexes.roadAddr} end`,
          jibunAddr: sql`case when ${wtmComplexes.jibunAddr} = '' then excluded.jibun_addr else ${wtmComplexes.jibunAddr} end`,
          aptSeq: sql`case when ${wtmComplexes.aptSeq} = '' then excluded.apt_seq else ${wtmComplexes.aptSeq} end`,
        },
      });
  }
}

export async function pendingComplexes(limit: number): Promise<ComplexSeed[]> {
  return db
    .select({ sggCd: wtmComplexes.sggCd, dong: wtmComplexes.dong, apt: wtmComplexes.apt, aptSeq: wtmComplexes.aptSeq, roadAddr: wtmComplexes.roadAddr, jibunAddr: wtmComplexes.jibunAddr })
    .from(wtmComplexes)
    .where(eq(wtmComplexes.status, "pending"))
    .limit(limit);
}

export async function saveComplexCoord(c: { sggCd: string; dong: string; apt: string }, p: { lat: number; lng: number } | null): Promise<void> {
  await db
    .update(wtmComplexes)
    .set(p ? { lat: p.lat, lng: p.lng, status: "ok", updatedAt: new Date() } : { status: "notfound", updatedAt: new Date() })
    .where(and(eq(wtmComplexes.sggCd, c.sggCd), eq(wtmComplexes.dong, c.dong), eq(wtmComplexes.apt, c.apt)));
}

export async function listComplexes(sggCds: string[]) {
  const out = new Map<string, { status: ComplexStatus; lat: number | null; lng: number | null }>();
  if (!sggCds.length) return out;
  const rows = await db.select().from(wtmComplexes).where(inArray(wtmComplexes.sggCd, sggCds));
  for (const r of rows) out.set(complexKey(r), { status: r.status, lat: r.lat, lng: r.lng });
  return out;
}

export async function resetNotFound(): Promise<number> {
  const rows = await db.update(wtmComplexes).set({ status: "pending" }).where(eq(wtmComplexes.status, "notfound")).returning({ apt: wtmComplexes.apt });
  return rows.length;
}
```
`upsertDeals`의 for 루프 뒤, `return` 앞에 `await upsertComplexes(complexSeeds(deals));`를 넣는다.

- [ ] **Step 4: Type check & tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: 타입 오류 0, 테스트 PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/whereToMove/schema.ts lib/whereToMove/repo.ts drizzle/
git commit -m "feat(whereToMove): 단지 좌표 표(wtm_complexes)"
```

---

### Task 7: 좌표 채우기 (`geocode.ts`)

**Files:**
- Create: `lib/whereToMove/geocode.ts`
- Test: `lib/whereToMove/geocode.test.ts`
- Modify: `lib/whereToMove/repo.ts` (`geocodeDeps` 추가)

**Interfaces:**
- Consumes: `ComplexSeed` (Task 5), repo 함수(Task 6), `locateAddress` (Task 3)
- Produces:
  - `type GeocodeDeps = { pending(limit: number): Promise<ComplexSeed[]>; locate(address: string): Promise<{ lat: number; lng: number } | null>; save(c: ComplexSeed, p: { lat: number; lng: number } | null): Promise<void> }`
  - `geocodePending(deps: GeocodeDeps, opts: { limit: number; deadline?: number; now?: () => number }): Promise<{ ok: number; notfound: number; failed: number }>`
  - repo: `geocodeDeps(keys: { search: string; coord: string }): GeocodeDeps`

- [ ] **Step 1: Write the failing test**

```ts
// lib/whereToMove/geocode.test.ts
import { describe, expect, it } from "vitest";
import { geocodePending, type GeocodeDeps } from "./geocode";
import type { ComplexSeed } from "./complexes";

const c = (apt: string, roadAddr = `가상로 ${apt}`, jibunAddr = `가상동 ${apt}`): ComplexSeed => ({ sggCd: "11110", dong: "가상동", apt, aptSeq: "", roadAddr, jibunAddr });
const P = { lat: 37.5, lng: 127 };

function deps(list: ComplexSeed[], locate: GeocodeDeps["locate"]) {
  const saved: [string, unknown][] = [];
  const calls: string[] = [];
  const d: GeocodeDeps = {
    pending: async (limit) => list.slice(0, limit),
    locate: async (a) => { calls.push(a); return locate(a); },
    save: async (x, p) => { saved.push([x.apt, p]); },
  };
  return { d, saved, calls };
}

describe("geocodePending", () => {
  it("도로명 주소로 찾는다", async () => {
    const { d, saved, calls } = deps([c("1")], async () => P);
    expect(await geocodePending(d, { limit: 10 })).toEqual({ ok: 1, notfound: 0, failed: 0 });
    expect(saved).toEqual([["1", P]]);
    expect(calls).toEqual(["가상로 1"]);
  });
  it("도로명으로 못 찾으면 지번으로", async () => {
    const { d, saved, calls } = deps([c("1")], async (a) => (a.startsWith("가상동") ? P : null));
    await geocodePending(d, { limit: 10 });
    expect(calls).toEqual(["가상로 1", "가상동 1"]);
    expect(saved).toEqual([["1", P]]);
  });
  it("둘 다 없으면 notfound(null 저장)", async () => {
    const { d, saved } = deps([c("1")], async () => null);
    expect(await geocodePending(d, { limit: 10 })).toEqual({ ok: 0, notfound: 1, failed: 0 });
    expect(saved).toEqual([["1", null]]);
  });
  it("주소가 모두 비면 API 를 부르지 않고 notfound", async () => {
    const { d, saved, calls } = deps([c("1", "", "")], async () => P);
    await geocodePending(d, { limit: 10 });
    expect(calls).toEqual([]);
    expect(saved).toEqual([["1", null]]);
  });
  it("오류는 저장하지 않고(pending 유지) 다음 단지를 계속한다", async () => {
    const { d, saved } = deps([c("1"), c("2")], async (a) => { if (a.endsWith("1")) throw new Error("network"); return P; });
    expect(await geocodePending(d, { limit: 10 })).toEqual({ ok: 1, notfound: 0, failed: 1 });
    expect(saved).toEqual([["2", P]]);
  });
  it("limit 만큼만", async () => {
    const { d, saved } = deps([c("1"), c("2"), c("3")], async () => P);
    await geocodePending(d, { limit: 2 });
    expect(saved.length).toBe(2);
  });
  it("deadline 이 지나면 멈춘다", async () => {
    let t = 0;
    const { d, saved } = deps([c("1"), c("2"), c("3")], async () => { t += 100; return P; });
    await geocodePending(d, { limit: 10, deadline: 150, now: () => t });
    expect(saved.length).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/whereToMove/geocode.test.ts`
Expected: FAIL — `./geocode` 없음.

- [ ] **Step 3: Implement**

```ts
// lib/whereToMove/geocode.ts
import type { ComplexSeed } from "./complexes";

type Point = { lat: number; lng: number };

export type GeocodeDeps = {
  pending(limit: number): Promise<ComplexSeed[]>;
  locate(address: string): Promise<Point | null>;
  save(c: ComplexSeed, p: Point | null): Promise<void>;
};

/**
 * 좌표가 없는 단지를 도로명 → 지번 순서로 찾아 저장한다. 결과가 없으면 notfound(null),
 * 오류면 저장하지 않아 다음에 다시 한다. deadline(ms, now() 기준)이 지나면 멈춘다.
 */
export async function geocodePending(deps: GeocodeDeps, opts: { limit: number; deadline?: number; now?: () => number }) {
  const now = opts.now ?? Date.now;
  const out = { ok: 0, notfound: 0, failed: 0 };
  for (const c of await deps.pending(opts.limit)) {
    if (opts.deadline !== undefined && now() > opts.deadline) break;
    try {
      let p: Point | null = null;
      for (const addr of [c.roadAddr, c.jibunAddr]) {
        if (!addr) continue;
        p = await deps.locate(addr);
        if (p) break;
      }
      await deps.save(c, p);
      if (p) out.ok++;
      else out.notfound++;
    } catch (e) {
      console.error("[whereToMove geocode]", c.sggCd, c.apt, e instanceof Error ? e.message : e);
      out.failed++;
    }
  }
  return out;
}
```

repo.ts에 추가(`import { locateAddress } from "./juso"; import type { GeocodeDeps } from "./geocode";`):
```ts
/** geocodePending 에 넘길 실제 의존성(도로명주소 API + DB). */
export function geocodeDeps(keys: { search: string; coord: string }): GeocodeDeps {
  return { pending: pendingComplexes, locate: (a) => locateAddress(a, keys), save: saveComplexCoord };
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run lib/whereToMove && npx tsc --noEmit`
Expected: PASS, 타입 오류 0.

- [ ] **Step 5: Commit**

```bash
git add lib/whereToMove/geocode.ts lib/whereToMove/geocode.test.ts lib/whereToMove/repo.ts
git commit -m "feat(whereToMove): 단지 좌표 채우기"
```

---

### Task 8: Cron·설정 저장 뒤 좌표 채우기 + 일회성 스크립트

**Files:**
- Modify: `app/api/where-to-move/cron/collect/route.ts`, `app/whereToMove/settings/actions.ts`
- Create: `scripts/where-to-move/backfill-complexes.ts`

**Interfaces:**
- Consumes: `geocodePending` (Task 7), `geocodeDeps`, `upsertComplexes`, `resetNotFound` (Task 6), `jusoKeys` (Task 3), `complexSeeds` (Task 5), `fetchDeals`, `recentMonths`, `collectKeys` (molit), `allRegionSggCds` (repo)

- [ ] **Step 1: Cron route** — `GET` 시작에 `const started = Date.now();`, 수집 루프 뒤:

```ts
  // 좌표가 없는 단지를 채운다. 수집 결과를 잃지 않게 시작 뒤 240초가 지나면 멈춘다.
  const jk = jusoKeys();
  const geocode = jk ? await geocodePending(geocodeDeps(jk), { limit: GEOCODE_LIMIT, deadline: started + 240_000 }) : null;
  return Response.json({ ok: results.every((r) => !r.error), results, geocode });
```
상수 `const GEOCODE_LIMIT = 100;`(주석: "한 번에 좌표를 찾는 단지 수. 남은 단지는 다음 날 이어서 한다."). import `geocodePending`, `jusoKeys`, `geocodeDeps`.

- [ ] **Step 2: 설정 저장 뒤** — `actions.ts`의 `after` 콜백 안, for 루프 뒤:

```ts
      const jk = jusoKeys();
      if (jk) {
        const started = Date.now();
        await geocodePending(geocodeDeps(jk), { limit: 100, deadline: started + 120_000 }).catch((e) => console.error("[whereToMove geocode]", e));
      }
```

- [ ] **Step 3: 일회성 스크립트**

```ts
// scripts/where-to-move/backfill-complexes.ts
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
```

- [ ] **Step 4: Check**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: 타입 오류 0, 테스트 PASS, 빌드 성공.

- [ ] **Step 5: Commit**

```bash
git add app/api/where-to-move/cron/collect/route.ts app/whereToMove/settings/actions.ts scripts/where-to-move/backfill-complexes.ts
git commit -m "feat(whereToMove): Cron·설정 저장 뒤 단지 좌표 채우기"
```

---

### Task 9: 설정 화면 직장 섹션

**Files:**
- Modify: `app/whereToMove/settings/actions.ts`, `app/whereToMove/settings/SettingsForm.tsx`
- Create: `app/whereToMove/settings/WorkplacePicker.tsx`

**Interfaces:**
- Consumes: `searchAddress`, `coordOf`, `jusoKeys`, `JusoCandidate`, `JusoRef` (Task 3), `Settings["workplaces"]` (Task 4)
- Produces (actions.ts):
  - `searchAddressAction(keyword: string): Promise<{ ok: true; candidates: JusoCandidate[] } | { ok: false; error: string }>`
  - `locateCandidateAction(ref: JusoRef): Promise<{ ok: true; lat: number; lng: number } | { ok: false; error: string }>`

- [ ] **Step 1: actions** — `actions.ts`에 추가:

```ts
const NO_JUSO = "주소 검색을 쓸 수 없습니다. 잠시 뒤 다시 시도해 주세요.";

export async function searchAddressAction(keyword: string) {
  await requireUser();
  const jk = jusoKeys();
  if (!jk) return { ok: false as const, error: NO_JUSO };
  const kw = cleanKeyword(String(keyword ?? "")).slice(0, 80);
  if (kw.length < 2) return { ok: false as const, error: "주소를 두 글자 이상 입력해 주세요." };
  try {
    const candidates = await searchAddress(kw, jk.search);
    return candidates.length ? { ok: true as const, candidates } : { ok: false as const, error: "검색 결과가 없습니다. 도로명이나 건물 이름으로 다시 찾아 주세요." };
  } catch (e) {
    console.error("[whereToMove juso search]", e instanceof Error ? e.message : e);
    return { ok: false as const, error: NO_JUSO };
  }
}

export async function locateCandidateAction(ref: JusoRef) {
  await requireUser();
  const jk = jusoKeys();
  if (!jk) return { ok: false as const, error: NO_JUSO };
  try {
    const p = await coordOf(ref, jk.coord);
    return p ? { ok: true as const, ...p } : { ok: false as const, error: "이 주소의 위치를 찾지 못했습니다. 다른 후보를 골라 주세요." };
  } catch (e) {
    console.error("[whereToMove juso coord]", e instanceof Error ? e.message : e);
    return { ok: false as const, error: NO_JUSO };
  }
}
```
import: `cleanKeyword, coordOf, jusoKeys, searchAddress, type JusoRef` from `@/lib/whereToMove/juso`.

- [ ] **Step 2: WorkplacePicker**

```tsx
// app/whereToMove/settings/WorkplacePicker.tsx
"use client";

import { useState, useTransition } from "react";
import type { JusoCandidate } from "@/lib/whereToMove/juso";
import type { Settings } from "@/lib/whereToMove/settings";
import { locateCandidateAction, searchAddressAction } from "./actions";

type Workplaces = Settings["workplaces"];
const input = "rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950";
const errText = "text-xs text-rose-600 dark:text-rose-400";

/** 직장 주소를 도로명주소 API로 검색해 고른다. 저장은 설정 저장 버튼으로 한다. */
export default function WorkplacePicker({ value, onChange, errors }: { value: Workplaces; onChange: (v: Workplaces) => void; errors: Record<string, string> }) {
  const [kw, setKw] = useState("");
  const [list, setList] = useState<JusoCandidate[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, start] = useTransition();
  const wp = value[0];

  const search = () => start(async () => {
    setMsg("");
    const r = await searchAddressAction(kw);
    if (r.ok) setList(r.candidates); else { setList([]); setMsg(r.error); }
  });
  const pick = (c: JusoCandidate) => start(async () => {
    const r = await locateCandidateAction(c);
    if (!r.ok) { setMsg(r.error); return; }
    onChange([{ label: wp?.label ?? "직장", address: c.roadAddr, lat: r.lat, lng: r.lng }]);
    setList([]); setKw(""); setMsg("");
  });

  return (
    <section className="mb-6">
      <h2 className="mb-1 font-semibold">직장</h2>
      <p className="mb-2 text-xs text-slate-500">목록에 직장까지 직선거리와 통근 시간 어림값을 보여 줍니다. 주소는 이 설정에만 저장됩니다.</p>
      {wp ? (
        <div className="mb-2 grid gap-2 rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-800">
          <label className="flex flex-col gap-1">
            <span>이름</span>
            <input className={input} value={wp.label} maxLength={20} onChange={(e) => onChange([{ ...wp, label: e.target.value }])} />
          </label>
          <p>{wp.address}</p>
          {Object.entries(errors).filter(([k]) => k.startsWith("workplaces")).map(([k, v]) => <span key={k} className={errText}>{v}</span>)}
          <button type="button" className="text-left text-sm text-rose-600" onClick={() => onChange([])}>삭제</button>
        </div>
      ) : null}
      <div className="flex gap-2">
        <input className={`${input} flex-1`} placeholder={wp ? "다른 주소로 바꾸기 (도로명·건물 이름)" : "도로명·건물 이름 (예: 사우중로 1)"} value={kw}
          onChange={(e) => setKw(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); search(); } }} />
        <button type="button" disabled={busy} onClick={search} className="rounded-lg border border-slate-300 px-3 text-sm disabled:opacity-50 dark:border-slate-700">
          {busy ? "찾는 중" : "검색"}
        </button>
      </div>
      {msg && <p className={`mt-1 ${errText}`}>{msg}</p>}
      {list.length > 0 && (
        <ul className="mt-2 divide-y divide-slate-200 rounded-xl border border-slate-200 text-sm dark:divide-slate-800 dark:border-slate-800">
          {list.map((c, i) => (
            <li key={i}>
              <button type="button" disabled={busy} className="w-full px-3 py-2 text-left disabled:opacity-50" onClick={() => pick(c)}>
                <span className="block">{c.roadAddr}{c.bdNm ? ` (${c.bdNm})` : ""}</span>
                <span className="block text-xs text-slate-500">{c.jibunAddr}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 3: SettingsForm에 넣기** — import `WorkplacePicker`, `<RegionPicker ... />` 바로 아래에:

```tsx
      <WorkplacePicker value={s.workplaces} errors={errors} onChange={(workplaces) => { setSaved(false); setS({ ...s, workplaces }); }} />
```

- [ ] **Step 4: Check**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: 모두 통과.
그다음 `npm run dev`로 `/whereToMove/settings`를 열어(로그인 필요 — 사용자가 이미 로그인한 브라우저가 없으면 이 수동 확인은 배포 뒤 사용자 확인으로 넘기고 ledger에 남긴다) 가상의 공공 주소("사우중로 1")로 검색 → 후보 선택 → 저장까지 확인한다.

- [ ] **Step 5: Commit**

```bash
git add app/whereToMove/settings/
git commit -m "feat(whereToMove): 설정에 직장 주소 검색"
```

---

### Task 10: 목록에 통근 어림값·ⓘ·길찾기·필터

**Files:**
- Modify: `app/whereToMove/page.tsx`, `app/whereToMove/DealBoard.tsx`, `app/whereToMove/board.module.css`

**Interfaces:**
- Consumes: `estimateCommute`, `straightKm`, `kmLabel`, `commuteHelp`, `kakaoRouteUrl`, `passesCommute`, `CommuteEstimate`, `CommuteMode` (Task 1), `listComplexes` (Task 6), `complexKey` (Task 5)
- Produces: `Deal`에 `commute?: (CommuteEstimate & { lat: number; lng: number }) | null; site?: "ok" | "pending" | "notfound"`, `DealBoard` prop `workplace?: { label: string; lat: number; lng: number }`

- [ ] **Step 1: page.tsx** — `listDeals` 뒤:

```ts
  const wp = settings.workplaces[0];
  const sites = wp ? await listComplexes(settings.regions.map((r) => r.sggCd)) : new Map();
```
deal 매핑 객체 끝에:
```ts
      ...(wp ? commuteOf(sites.get(complexKey(d)), wp) : {}),
```
파일 안 함수:
```ts
type Site = { status: "pending" | "ok" | "notfound"; lat: number | null; lng: number | null } | undefined;

function commuteOf(site: Site, wp: { lat: number; lng: number }) {
  if (!site || site.status !== "ok" || site.lat === null || site.lng === null) return { commute: null, site: site?.status ?? "pending" };
  return { commute: { ...estimateCommute(straightKm({ lat: site.lat, lng: site.lng }, wp)), lat: site.lat, lng: site.lng }, site: "ok" as const };
}
```
`<DealBoard ... workplace={wp ? { label: wp.label, lat: wp.lat, lng: wp.lng } : undefined} />` (주소 문자열은 넘기지 않는다).

- [ ] **Step 2: DealBoard.tsx**

`Deal` 타입에 `commute?: (CommuteEstimate & { lat: number; lng: number }) | null; site?: 'ok' | 'pending' | 'notfound';` 추가, props에 `workplace?: { label: string; lat: number; lng: number }`.

상태:
```tsx
  const [commuteMode, setCommuteMode] = useState<CommuteMode>('off');
  const [commuteMax, setCommuteMax] = useState(60);
```
필터 조건에 `passesCommute(d.commute ?? null, commuteMode, commuteMax) &&`를 더하고 useMemo 의존성에 `commuteMode, commuteMax`.

ⓘ 컴포넌트(파일 안):
```tsx
const HELP = commuteHelp();

/** 누르면 펼치고 다시 누르면 닫는 설명. 카드 전체 링크(::after) 위에 오도록 z-index 를 준다. */
function CommuteInfo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={s.info} aria-expanded={open} aria-label="통근 시간 계산 방법" onClick={() => setOpen(o => !o)}>ⓘ</button>
      {open && <div className={s.help}>{HELP.map((t, i) => <p key={i}>{t}</p>)}</div>}
    </>
  );
}
```
필터 섹션 마지막 줄 다음(직장이 있을 때만):
```tsx
        {workplace && (
          <div className={s.row}>
            <span className={s.muted}>통근</span>
            <select className={s.small} value={commuteMode} onChange={e => setCommuteMode(e.target.value as CommuteMode)}>
              <option value="off">전체</option>
              <option value="transit">🚇 대중교통</option>
              <option value="car">🚗 자가용</option>
            </select>
            <select className={s.small} value={commuteMax} disabled={commuteMode === 'off'} onChange={e => setCommuteMax(Number(e.target.value))}>
              {[30, 45, 60, 90].map(m => <option key={m} value={m}>{m}분 이내</option>)}
            </select>
            <CommuteInfo />
          </div>
        )}
```
카드의 `.nums` 다음, 부적합 사유 앞:
```tsx
            {workplace && (
              <div className={s.commute}>
                {d.commute
                  ? <span>{workplace.label} {kmLabel(d.commute.km)} · 🚇 약 {d.commute.transit[0]}~{d.commute.transit[1]}분 · 🚗 약 {d.commute.car[0]}~{d.commute.car[1]}분</span>
                  : <span className={s.muted}>{workplace.label}까지 거리: {d.site === 'notfound' ? '위치 확인 안 됨' : '위치 확인 중'}</span>}
                <CommuteInfo />
              </div>
            )}
```
`.links` 안 호갱노노 다음:
```tsx
              {workplace && d.commute && (
                <>
                  <a href={kakaoRouteUrl('traffic', { name: d.apt, lat: d.commute.lat, lng: d.commute.lng }, { name: workplace.label, ...workplace })} target="_blank" rel="noopener noreferrer">🚇 길찾기 ↗</a>
                  <a href={kakaoRouteUrl('car', { name: d.apt, lat: d.commute.lat, lng: d.commute.lng }, { name: workplace.label, ...workplace })} target="_blank" rel="noopener noreferrer">🚗 길찾기 ↗</a>
                </>
              )}
```
`.links`가 4개가 되므로 `flex-wrap`을 준다(Step 3). import: `commuteHelp, kakaoRouteUrl, kmLabel, passesCommute, type CommuteEstimate, type CommuteMode` from `@/lib/whereToMove/commute`.

- [ ] **Step 3: board.module.css** 추가·수정

```css
.links { flex-wrap: wrap; }
.commute { position: relative; z-index: 1; display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 6px; font-size: .85rem; }
.info { position: relative; z-index: 1; width: 22px; height: 22px; border: 0; border-radius: 50%; background: transparent; color: #1f6feb; font-size: .95rem; line-height: 1; cursor: pointer; }
.help { position: relative; z-index: 1; flex-basis: 100%; margin-top: 4px; padding: 8px 10px; border-radius: 8px; background: #f3f6fb; color: #333; font-size: .8rem; line-height: 1.5; }
.help p { margin: 0 0 4px; }
:global(.dark) .help { background: #26282c; color: #ddd; }
:global(.dark) .info { color: #6ea8fe; }
```
(`.links`는 기존 규칙에 `flex-wrap: wrap;`만 더한다. 필터 줄의 `.row`가 flex-wrap이 아니면 `.help`가 줄 아래로 내려가도록 `.row`에도 `flex-wrap: wrap`이 있는지 확인한다.)

- [ ] **Step 4: Check**

Run: `npx tsc --noEmit && npx vitest run && npm run lint && npm run build`
Expected: 모두 통과.
`npm run dev`로 목록을 열 수 있으면 휴대폰 폭(375px)에서: 통근 줄이 줄바꿈되는지, ⓘ를 누르면 카드 링크로 이동하지 않고 설명이 열리는지, 길찾기가 새 창으로 열리는지 확인한다. 로그인 브라우저가 없으면 배포 뒤 사용자 확인 항목으로 남긴다.

- [ ] **Step 5: Commit**

```bash
git add app/whereToMove/page.tsx app/whereToMove/DealBoard.tsx app/whereToMove/board.module.css
git commit -m "feat(whereToMove): 목록에 통근 어림값·설명·길찾기·필터"
```

---

### Task 11: 문서·배포·기존 단지 채우기

**Files:**
- Modify: `C:\Users\pwjun\orca\projects\whereToMove\CLAUDE.md` (저장소 밖 인계 문서)

- [ ] **Step 1: 최종 리뷰** — 브랜치 전체 리뷰(가장 능력 있는 모델) 후 Critical/Important 수정.

- [ ] **Step 2: 사용자 확인** — main 머지·push, 운영 마이그레이션, 스크립트 실행을 묻는다. 운영 Vercel에 `JUSO_SEARCH_KEY`, `JUSO_COORD_KEY`가 있는지 `vercel env ls`(이름만)로 확인한다.

- [ ] **Step 3: 마이그레이션 → 배포** (이번 마이그레이션은 **표 추가만** 하므로 2단계와 반대로 **배포 전에** 돌린다. 새 코드의 `upsertDeals`가 이 표에 쓰기 때문이다. 옛 코드는 이 표를 모르므로 먼저 만들어도 안전하다.)
  - `npm run db:migrate` → `wtm_complexes` 생성 확인.
  - main squash 머지 → push → Vercel 배포 Ready 확인. 06시·월 08시 KST Cron 시각은 피한다.

- [ ] **Step 4: 기존 단지 채우기**

Run: `npx tsx --env-file=.env.local scripts/where-to-move/backfill-complexes.ts`
Expected: 시·군·구×12개월 단지 수 출력, 좌표 `{ ok, notfound, failed }`가 0이 될 때까지 반복. 끝나고 DB에서 status별 건수를 센다(ok 비율 보고).

- [ ] **Step 5: CLAUDE.md** — "3단계(통근 어림값)" 섹션: spec/plan 경로, 도로명주소 API(키 이름만), `wtm_complexes`, 어림 상수, 저장 금지 API 조사 결과 한 줄, 배포 순서(표 추가는 배포 전), 스크립트 사용법, 미룬 Minor. 같은 내용을 `docs/` 사본에도 맞춘다.
