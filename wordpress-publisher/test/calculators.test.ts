import { describe, expect, it } from "vitest";
import { resolveCalculator } from "../src/calculators.ts";

describe("resolveCalculator", () => {
  it("알려진 슬러그면 url/title을 돌려준다", () => {
    expect(resolveCalculator("salary")).toEqual({
      url: "https://tools.molespapa.com/salary",
      title: "연봉 계산기",
    });
  });

  it("모르는 슬러그면 사용 가능한 값 목록을 담은 에러를 던진다", () => {
    expect(() => resolveCalculator("없는거")).toThrow(/salary/);
  });

  it("앞에 슬래시가 붙어도(\"/jeonse-vs-loan\") 받아들인다", () => {
    expect(resolveCalculator("/jeonse-vs-loan")).toEqual({
      url: "https://tools.molespapa.com/jeonse-vs-loan",
      title: "대출금 상환 vs 전세 비교 계산기",
    });
  });

  it("/calculator/ 같은 다른 접두사는 여전히 알 수 없는 슬러그로 취급한다", () => {
    expect(() => resolveCalculator("/calculator/jeonse-vs-loan")).toThrow(/salary/);
  });
});
