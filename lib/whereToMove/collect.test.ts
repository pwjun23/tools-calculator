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

describe("collectRegion 로그 조회 실패", () => {
  it("예외를 던지지 않고 결과에 오류를 담는다", async () => {
    const f = fakeDeps([]);
    const deps = { ...f.deps, loggedMonths: async () => { throw new Error("가상 DB 오류"); } };
    const r = await collectRegion("11110", deps, { now: NOW, maxBackfill: 5 });
    expect(r).toEqual({ results: [{ ym: "", error: "가상 DB 오류" }], backfilled: 0 });
    expect(f.upserts).toEqual([]);
  });
});

describe("collectRegion 단지 저장", () => {
  it("단지 저장이 실패해도 그 달은 성공으로 기록한다", async () => {
    const f = fakeDeps(["202610", "202609"]);
    const seeded: number[] = [];
    const deps = { ...f.deps, seedComplexes: async (d: MolitDeal[]) => { seeded.push(d.length); throw new Error("가상 단지 오류"); } };
    const r = await collectRegion("11110", deps, { now: NOW, maxBackfill: 0 });
    expect(r.results.every((x) => !x.error)).toBe(true);
    expect(f.marked).toEqual(["202610", "202609"]);
    expect(seeded).toEqual([1, 1]);
  });
});
