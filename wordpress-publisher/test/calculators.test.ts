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
});
