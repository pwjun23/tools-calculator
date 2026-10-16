import { describe, expect, it } from "vitest";
import { commuteHelp, estimateCommute, kakaoRouteUrl, kmLabel, passesCommute, straightKm } from "./commute";

describe("straightKm", () => {
  it("위도 1도는 약 111.19km", () => {
    expect(straightKm({ lat: 37, lng: 127 }, { lat: 38, lng: 127 })).toBeCloseTo(111.19, 1);
  });
  it("같은 점은 0", () => expect(straightKm({ lat: 37.5, lng: 127 }, { lat: 37.5, lng: 127 })).toBe(0));
});

describe("estimateCommute", () => {
  it("0km 는 최소 시간만", () => {
    expect(estimateCommute(0)).toEqual({ km: 0, car: [5, 5], transit: [10, 20] });
  });
  it("10km: 도로 13km 로 계산하고 5분 단위 반올림", () => {
    expect(estimateCommute(10)).toEqual({ km: 10, car: [25, 35], transit: [40, 70] });
  });
  it("30km", () => {
    expect(estimateCommute(30)).toEqual({ km: 30, car: [65, 100], transit: [105, 175] });
  });
  it("최솟값은 최댓값을 넘지 않는다", () => {
    for (const km of [0.3, 1, 2.7, 8, 15, 42]) {
      const e = estimateCommute(km);
      expect(e.car[0]).toBeLessThanOrEqual(e.car[1]);
      expect(e.transit[0]).toBeLessThanOrEqual(e.transit[1]);
    }
  });
});

describe("kmLabel", () => {
  it("1km 미만", () => expect(kmLabel(0.4)).toBe("1km 미만"));
  it("10km 미만은 소수 한 자리", () => expect(kmLabel(3.46)).toBe("3.5km"));
  it("10km 이상은 정수", () => expect(kmLabel(14.2)).toBe("14km"));
});

describe("commuteHelp", () => {
  it("직선거리 어림값이라는 점과 상수 값을 담는다", () => {
    const t = commuteHelp().join("\n");
    expect(t).toContain("직선거리");
    expect(t).toContain("1.3");
    expect(t).toContain("시속 25~40km");
    expect(t).toContain("시속 15~25km");
    expect(t).toContain("카카오맵");
  });
});

describe("kakaoRouteUrl", () => {
  it("이름의 쉼표·슬래시를 지우고 출발/도착 순서로 만든다", () => {
    const u = kakaoRouteUrl("traffic", { name: "가상,단지/1", lat: 37.6, lng: 126.7 }, { name: "직장", lat: 37.5, lng: 127.0 });
    expect(u).toBe(`https://map.kakao.com/link/by/traffic/${encodeURIComponent("가상 단지 1")},37.6,126.7/${encodeURIComponent("직장")},37.5,127`);
  });
});

describe("passesCommute", () => {
  const e = { km: 10, car: [25, 35] as [number, number], transit: [40, 70] as [number, number] };
  it("off 면 통과", () => expect(passesCommute(e, "off", 30)).toBe(true));
  it("어림값이 없으면 숨기지 않는다", () => expect(passesCommute(null, "transit", 30)).toBe(true));
  it("최솟값 기준", () => {
    expect(passesCommute(e, "transit", 45)).toBe(true);
    expect(passesCommute(e, "transit", 30)).toBe(false);
    expect(passesCommute(e, "car", 30)).toBe(true);
  });
});
