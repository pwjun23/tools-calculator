import { describe, expect, it } from "vitest";
import { formatKoreanAmount, formatWon } from "./format";

describe("formatWon", () => {
  it.each([
    [0, "0원"],
    [1_234_567, "1,234,567원"],
    [-5_000, "-5,000원"],
  ])("%i → %s", (n, expected) => {
    expect(formatWon(n)).toBe(expected);
  });
});

describe("formatKoreanAmount", () => {
  it.each([
    [0, "0원"],
    [4_000_000, "400만원"],
    [50_000_000, "5,000만원"],
    [100_000_000, "1억원"],
    [120_000_000, "1억 2,000만원"],
    [4_166_666, "416만 6,666원"],
    [1_234_567_890, "12억 3,456만 7,890원"],
    [9_999, "9,999원"],
  ])("%i → %s", (n, expected) => {
    expect(formatKoreanAmount(n)).toBe(expected);
  });
});
