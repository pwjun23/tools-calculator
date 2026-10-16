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

describe("geocodePending 실패 단지 미루기", () => {
  it("오류가 난 단지는 defer 로 뒤로 보낸다", async () => {
    const deferred: string[] = [];
    const { d } = deps([c("1"), c("2")], async (a) => { if (a.endsWith("1")) throw new Error("network"); return P; });
    await geocodePending({ ...d, defer: async (x) => { deferred.push(x.apt); } }, { limit: 10 });
    expect(deferred).toEqual(["1"]);
  });
});
