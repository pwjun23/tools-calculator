import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, normalizeStoredSettings, parseSettings, readStoredSettings } from "./settings";

describe("parseSettings", () => {
  it("기본값은 통과한다", () => {
    const r = parseSettings(DEFAULT_SETTINGS);
    expect(r.ok).toBe(true);
  });

  it("비율이 1을 넘으면 항목 경로와 함께 오류를 낸다", () => {
    const r = parseSettings({ ...DEFAULT_SETTINGS, ltvRent: 1.2 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors)).toContain("ltvRent");
  });

  it("기존 대출 항목의 잘못된 상환 방식을 잡는다", () => {
    const r = parseSettings({
      ...DEFAULT_SETTINGS,
      loans: [{ name: "가상 대출", balance: 1000, rate: 0.05, years: 10, repayment: "weird", repaidIfHomeSold: false }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors)).toContain("loans.0.repayment");
  });

  it("지역 동 목록이 비면 실패한다", () => {
    const r = parseSettings({ ...DEFAULT_SETTINGS, regions: [{ sggCd: "41570", label: "김포", dongs: [] }] });
    expect(r.ok).toBe(false);
  });
});

describe("normalizeStoredSettings", () => {
  it("예전 JSON에 없는 항목은 기본값으로 채운다", () => {
    const old: Record<string, unknown> = { ...DEFAULT_SETTINGS, cash: 1234 };
    delete old.mortgageCap;
    const s = normalizeStoredSettings(old);
    expect(s.cash).toBe(1234);
    expect(s.mortgageCap).toBe(DEFAULT_SETTINGS.mortgageCap);
  });

  it("검증에 실패한 저장값이면 기본값을 돌려준다", () => {
    expect(normalizeStoredSettings({ cash: -5 })).toEqual(DEFAULT_SETTINGS);
    expect(normalizeStoredSettings(null)).toEqual(DEFAULT_SETTINGS);
  });
});

describe("readStoredSettings", () => {
  it("대출 항목에 새로 생긴 칸이 없으면 기본값으로 채우고 대출은 유지한다", () => {
    const loan: Record<string, unknown> = { name: "가상 대출", balance: 1000, rate: 0.05, years: 10, repayment: "amortizing", repaidIfHomeSold: true };
    delete loan.repaidIfHomeSold;
    const r = readStoredSettings({ ...DEFAULT_SETTINGS, cash: 777, loans: [loan] });
    expect(r.valid).toBe(true);
    expect(r.settings.cash).toBe(777);
    expect(r.settings.loans).toHaveLength(1);
    expect(r.settings.loans[0].repaidIfHomeSold).toBe(false);
  });

  it("검증에 실패하면 valid=false 로 알려 기본값을 조용히 쓰지 않게 한다", () => {
    const r = readStoredSettings({ ...DEFAULT_SETTINGS, cash: -5 });
    expect(r.valid).toBe(false);
    expect(r.settings).toEqual(DEFAULT_SETTINGS);
  });

  it("저장값이 아예 없으면 기본값이고 valid", () => {
    expect(readStoredSettings(null)).toEqual({ settings: DEFAULT_SETTINGS, valid: true });
  });
});

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
