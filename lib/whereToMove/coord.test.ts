import { describe, expect, it } from "vitest";
import { utmkToWgs84, wgs84ToUtmk } from "./coord";

describe("utmkToWgs84", () => {
  it("UTM-K 원점(1,000,000 / 2,000,000)은 북위 38도, 동경 127.5도", () => {
    const p = utmkToWgs84(1000000, 2000000);
    expect(p.lat).toBeCloseTo(38, 6);
    expect(p.lng).toBeCloseTo(127.5, 6);
  });
  it("왕복 변환 오차 1m 미만", () => {
    const { x, y } = wgs84ToUtmk(37.615, 126.716);
    const p = utmkToWgs84(x, y);
    expect(p.lat).toBeCloseTo(37.615, 5);
    expect(p.lng).toBeCloseTo(126.716, 5);
  });
  it("서쪽·남쪽은 원점보다 작은 x·y", () => {
    const { x, y } = wgs84ToUtmk(37.5, 127);
    expect(x).toBeLessThan(1000000);
    expect(y).toBeLessThan(2000000);
  });
});
