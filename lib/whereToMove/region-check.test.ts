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
