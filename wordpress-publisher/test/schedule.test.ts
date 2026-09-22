import { describe, expect, it } from "vitest";
import { kstToUtc, toWpDateGmt } from "../src/schedule.ts";

describe("kstToUtc", () => {
  it("KST 오전 9시는 UTC 0시다", () => {
    const utc = kstToUtc("2026-09-28 09:00");
    expect(utc.toISOString()).toBe("2026-09-28T00:00:00.000Z");
  });

  it("형식이 잘못되면 에러를 던진다", () => {
    expect(() => kstToUtc("2026/09/28 09:00")).toThrow(/형식/);
  });

  it("현재보다 과거 시각이면 에러를 던진다", () => {
    const now = new Date("2026-09-28T00:00:00.000Z");
    expect(() => kstToUtc("2026-09-28 08:00", now)).toThrow(/과거/);
  });
});

describe("toWpDateGmt", () => {
  it("WordPress date_gmt 형식(초 단위, Z 없음)으로 만든다", () => {
    const date = new Date("2026-09-28T00:00:00.000Z");
    expect(toWpDateGmt(date)).toBe("2026-09-28T00:00:00");
  });
});
