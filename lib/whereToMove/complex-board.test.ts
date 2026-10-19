import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, type Settings } from "./settings";
import { deriveParams } from "./judge";
import { complexBoard, sortBoard, type BoardInput } from "./complex-board";

const s: Settings = {
  ...DEFAULT_SETTINGS, regions: [{ sggCd: "11111", label: "가상시", dongs: ["가상동", "가상읍"] }],
  cash: 5000, monthlyBudget: 120, monthlyMgmt: 25, rentLoanRate: 0.04, ltvRent: 0.8, rentLoanCap: 20000, rentConvRate: 0.05, minArea: 0,
};
const p = deriveParams(s);
const FROM = "2026-04-18";
const deal = (o: Partial<BoardInput>): BoardInput => ({
  type: "전세", sggCd: "11111", dong: "가상동", apt: "가상아파트", areaRaw: 84.9, date: "2026-08-01",
  amount: 16000, rent: 0, renewal: false, cancelled: false, ...o,
});
const three = (o: Partial<BoardInput>) => [deal(o), deal(o), deal(o)];

describe("complexBoard", () => {
  it("단지·평형(전용 3㎡ 이내)마다 한 줄, 시세와 판정", () => {
    const { rows } = complexBoard([...three({}), deal({ areaRaw: 86.5 }), ...three({ areaRaw: 59.9, amount: 26000 })], s, p, FROM);
    expect(rows).toHaveLength(2);
    const big = rows.find((r) => r.areaLabel === "85~87㎡")!;
    expect(big.rent).toMatchObject({ basis: "임대", mid: 16000, count: 4 });
    expect(big.status).toBe("전세 가능");
    expect(big.jeonse).toMatchObject({ ok: true });
    const small = rows.find((r) => r.areaLabel === "60㎡")!;
    expect(small.status).toBe("월세면 가능");
    expect(small.wolse).toMatchObject({ ok: true, rent: 88 });
  });

  it("전세도 월세도 안 되면 어려움(사유)", () => {
    const { rows } = complexBoard(three({ amount: 30000 }), s, p, FROM);
    expect(rows[0].status).toBe("어려움");
    expect(rows[0].jeonse!.reasons).toContain("대출 한도 초과");
  });

  it("월세는 전세 환산가로 같이 묶는다", () => {
    const { rows } = complexBoard([deal({}), deal({}), deal({ type: "월세", amount: 10000, rent: 25 })], s, p, FROM);
    expect(rows[0].rent).toMatchObject({ count: 3, mid: 16000 });
  });

  it("매매는 따로 시세와 판정을 낸다", () => {
    const { rows } = complexBoard(three({ type: "매매", amount: 90000 }), s, p, FROM);
    expect(rows[0].rent).toBeNull();
    expect(rows[0].status).toBeNull();
    expect(rows[0].buy).toMatchObject({ basis: "매매", mid: 90000 });
    expect(rows[0].buyVerdict!.ok).toBe(false);
  });

  it("갱신·해제·기간 밖·임대주택·뺀 단지·다른 동·최소 면적 미달은 빼고, 3건 미만 평형은 개수만 센다", () => {
    const s2: Settings = { ...s, minArea: 70, excludedApts: [{ sggCd: "11111", dong: "가상동", apt: "뺀아파트" }] };
    const { rows, sparse } = complexBoard([
      deal({}), deal({}),
      deal({ renewal: true }), deal({ cancelled: true }), deal({ date: "2026-04-17" }),
      ...three({ apt: "가상뉴스테이" }), ...three({ apt: "뺀아파트" }), ...three({ dong: "다른동" }), ...three({ areaRaw: 59.9 }),
      deal({ apt: "드문아파트" }),
    ], s2, { ...p }, FROM);
    expect(rows).toEqual([]);
    expect(sparse).toBe(2);
  });

  it("읍·면 거래는 리가 달라도 같은 단지로 묶는다", () => {
    const { rows } = complexBoard([deal({ dong: "가상읍 가리" }), deal({ dong: "가상읍 가리" }), deal({ dong: "가상읍" })], s, p, FROM);
    expect(rows).toHaveLength(1);
    expect(rows[0].dong).toBe("가상읍");
  });
});

describe("sortBoard", () => {
  it("전세 기준: 전세 가능 → 월세면 가능 → 어려움, 같으면 중앙값 낮은 순, 임대 시세 없는 줄은 뺀다", () => {
    const { rows } = complexBoard([
      ...three({ apt: "A", amount: 30000 }), ...three({ apt: "B", amount: 26000 }),
      ...three({ apt: "C", amount: 17000 }), ...three({ apt: "D", amount: 15000 }),
      ...three({ apt: "E", type: "매매", amount: 50000 }),
    ], s, p, FROM);
    expect(sortBoard(rows, "임대").map((r) => r.apt)).toEqual(["D", "C", "B", "A"]);
  });
  it("매매 기준: 가능 먼저, 중앙값 낮은 순, 매매 시세 없는 줄은 뺀다", () => {
    const { rows } = complexBoard([...three({ apt: "A", type: "매매", amount: 90000 }), ...three({ apt: "B", type: "매매", amount: 80000 }), ...three({ apt: "C" })], s, p, FROM);
    expect(sortBoard(rows, "매매").map((r) => r.apt)).toEqual(["B", "A"]);
  });
});
