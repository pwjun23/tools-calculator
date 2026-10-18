import { describe, expect, it } from "vitest";
import type { Derived } from "./judge";
import { explainMonthly } from "./monthly-help";

// 가상 값
const p: Derived = {
  cash: 5000, budget: 120, mgmt: 25, fee: 0.015, factor: 0.004774152954654538, rentRate: 0.036, rentCap: 20000,
  mortgageCap: 60000, dsrMonthly: 100, ltvBuy: 0.7, ltvRent: 0.8, available: 95, existingMonthly: 0, sellExtra: 0, convRate: 0.05,
};
const rates = { mortgageRate: 0.04, mortgageYears: 30 };

describe("explainMonthly", () => {
  it("전세: 대출 → 월 이자 → 월 부담 → 여유를 그 거래 숫자로 보여 준다", () => {
    const t = explainMonthly(p, rates, { type: "전세", amount: 20000, rent: 0 }).join("\n");
    expect(t).toContain("필요 대출 = 보증금 2억 − 현금 5,000만 = 1.5억");
    expect(t).toContain("월 이자 = 1.5억 × 연 3.6% ÷ 12 = 45만");
    expect(t).toContain("월 부담 = 대출 이자 45만 + 관리비 25만 = 70만");
    expect(t).toContain("월 예산 120만 − 월 부담 70만 = 여유 50만");
  });
  it("전세: 한도·비율·DSR 검사를 통과/초과로 보여 준다", () => {
    const t = explainMonthly(p, rates, { type: "전세", amount: 30000, rent: 0 }).join("\n");
    expect(t).toContain("대출 한도: 2.5억 / 한도 2억 → 초과");
    expect(t).toContain("대출 비율: 83% / 상한 80% → 초과");
    expect(t).toContain("DSR: 월 이자 75만 / 상환 여력 100만 → 통과");
  });
  it("현금이 더 많으면 대출 0", () => {
    expect(explainMonthly(p, rates, { type: "전세", amount: 3000, rent: 0 })[0]).toBe("필요 대출 = 보증금 3,000만 − 현금 5,000만 → 0 (현금으로 충분)");
  });
  it("월세: 월세가 월 부담에 더해진다", () => {
    const t = explainMonthly(p, rates, { type: "월세", amount: 15000, rent: 33 }).join("\n");
    expect(t).toContain("월 부담 = 월세 33만 + 대출 이자 30만 + 관리비 25만 = 88만");
  });
  it("월세 보증금 0원은 신고 오류 가능성을 알린다", () => {
    expect(explainMonthly(p, rates, { type: "월세", amount: 0, rent: 33 }).join("\n")).toContain("보증금이 0원으로 신고");
  });
  it("매매: 취득 비용과 원리금균등 상환을 보여 주고 초과면 초과로 쓴다", () => {
    const t = explainMonthly(p, rates, { type: "매매", amount: 40000, rent: 0 }).join("\n");
    expect(t).toContain("필요 대출 = 매매가 4억 × (1 + 취득 비용 1.5%) − 현금 5,000만 = 3.56억");
    expect(t).toContain("월 상환 = 3.56억, 연 4%, 30년 원리금균등 = 170만");
    expect(t).toContain("월 예산 120만 − 월 부담 195만 = 초과 75만");
  });
  it("대출 비율 0(기존 주택 유지로 대출 불가)이면 그렇게 쓴다", () => {
    const t = explainMonthly({ ...p, ltvRent: 0 }, rates, { type: "전세", amount: 20000, rent: 0 }).join("\n");
    expect(t).toContain("대출 비율: 대출 불가(설정의 기존 주택 조건) → 초과");
  });
});
