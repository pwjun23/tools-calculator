import { describe, expect, it } from "vitest";
import { commuteHelp, estimateCommute, estimateModes, kakaoRouteUrl, kmLabel, parseTripChoice, passesTrip, straightKm, toggleMode, tripChoices, type Place } from "./commute";

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
  it("1km 미만도 소수 한 자리(가까운 학교끼리 구분)", () => expect(kmLabel(0.43)).toBe("0.4km"));
  it("0.1km 미만", () => expect(kmLabel(0.04)).toBe("0.1km 미만"));
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
    expect(t).toContain("시속 3~4km");
    expect(t).toContain("1.5~2배");
  });
});

describe("kakaoRouteUrl", () => {
  it("이름의 쉼표·슬래시를 지우고 출발/도착 순서로 만든다", () => {
    const u = kakaoRouteUrl("traffic", { name: "가상,단지/1", lat: 37.6, lng: 126.7 }, { name: "직장", lat: 37.5, lng: 127.0 });
    expect(u).toBe(`https://map.kakao.com/link/by/traffic/${encodeURIComponent("가상 단지 1")},37.6,126.7/${encodeURIComponent("직장")},37.5,127`);
  });
});

describe("kakaoRouteUrl walk", () => {
  it("도보 길찾기", () => {
    expect(kakaoRouteUrl("walk", { name: "A", lat: 37.6, lng: 126.7 }, { name: "B", lat: 37.61, lng: 126.71 })).toBe("https://map.kakao.com/link/by/walk/A,37.6,126.7/B,37.61,126.71");
  });
});

describe("estimateModes", () => {
  it("도보: 아이 걸음 시속 3~4km, 5분 단위", () => {
    expect(estimateModes(0.6, ["walk"]).times).toEqual({ walk: [10, 15] });
    expect(estimateModes(2, ["walk"]).times).toEqual({ walk: [40, 50] });
  });
  it("아주 가까워도 최소 5분", () => expect(estimateModes(0.1, ["walk"]).times.walk).toEqual([5, 5]));
  it("통학차량은 자가용 최솟값×1.5 ~ 최댓값×2", () => {
    expect(estimateModes(10, ["shuttle", "car"]).times).toEqual({ shuttle: [40, 70], car: [25, 35] });
  });
  it("자가용·대중교통은 estimateCommute 와 같다", () => {
    const e = estimateCommute(30);
    expect(estimateModes(30, ["transit", "car"])).toEqual({ km: 30, times: { transit: e.transit, car: e.car } });
  });
  it("고른 수단만 나온다", () => expect(Object.keys(estimateModes(3, ["walk"]).times)).toEqual(["walk"]));
});

const places: Place[] = [
  { id: "w", kind: "work", label: "직장", lat: 37.5, lng: 127, modes: ["transit", "car"] },
  { id: "s0", kind: "school", label: "가상초", lat: 37.6, lng: 126.7, modes: ["walk", "shuttle"] },
];

describe("tripChoices", () => {
  it("장소별 묶음: 직장 30~120분, 학교 10~30분", () => {
    const g = tripChoices(places);
    expect(g.map((x) => x.label)).toEqual(["직장", "가상초"]);
    expect(g[0].options.map((o) => o.value)).toEqual([30, 45, 60, 90, 120].map((m) => `w:car:${m}`).concat([30, 45, 60, 90, 120].map((m) => `w:transit:${m}`)));
    expect(g[1].options.map((o) => o.value)).toEqual([10, 15, 20, 30].map((m) => `s0:walk:${m}`).concat([10, 15, 20, 30].map((m) => `s0:shuttle:${m}`)));
    expect(g[1].options[1].label).toBe("🚶 15분 이내");
  });
});

describe("parseTripChoice", () => {
  it("값을 장소·수단·분으로 나눈다", () => expect(parseTripChoice("s0:walk:15", places)).toEqual({ id: "s0", mode: "walk", max: 15 }));
  it("전체·없는 장소·그 장소에 없는 수단·틀린 형식은 null", () => {
    expect(parseTripChoice("off", places)).toBeNull();
    expect(parseTripChoice("s3:walk:15", places)).toBeNull();
    expect(parseTripChoice("s0:car:15", places)).toBeNull();
    expect(parseTripChoice("s0:walk:abc", places)).toBeNull();
  });
});

describe("passesTrip", () => {
  const trips = [{ id: "s0", km: 1, times: { walk: [20, 25] as [number, number] } }];
  it("최솟값 기준", () => {
    expect(passesTrip(trips, { id: "s0", mode: "walk", max: 20 })).toBe(true);
    expect(passesTrip(trips, { id: "s0", mode: "walk", max: 15 })).toBe(false);
  });
  it("전체·어림값 없음·그 장소 없음은 통과", () => {
    expect(passesTrip(trips, null)).toBe(true);
    expect(passesTrip(null, { id: "s0", mode: "walk", max: 10 })).toBe(true);
    expect(passesTrip(trips, { id: "w", mode: "car", max: 10 })).toBe(true);
  });
});

describe("toggleMode", () => {
  it("켜고 끄며 표시 순서를 지킨다", () => {
    expect(toggleMode(["car"], "walk")).toEqual(["walk", "car"]);
    expect(toggleMode(["walk", "car"], "walk")).toEqual(["car"]);
  });
  it("마지막 하나는 끄지 않는다", () => expect(toggleMode(["walk"], "walk")).toEqual(["walk"]));
});

describe("tripChoices 자주 가는 곳", () => {
  it("10·20·30·45·60분", () => {
    const g = tripChoices([{ id: "p0", kind: "place", label: "가상교회", lat: 37.6, lng: 126.7, modes: ["car"] }]);
    expect(g[0].options.map((o) => o.value)).toEqual(["p0:car:10", "p0:car:20", "p0:car:30", "p0:car:45", "p0:car:60"]);
  });
});

describe("tripChoices 장소 구분", () => {
  it("묶음마다 장소 id 를 주고, 같은 이름이면 번호를 붙인다", () => {
    const two: Place[] = [
      { id: "s0", kind: "school", label: "학교", lat: 37.6, lng: 126.7, modes: ["walk"] },
      { id: "s1", kind: "school", label: "학교", lat: 37.61, lng: 126.71, modes: ["walk"] },
    ];
    const g = tripChoices(two);
    expect(g.map((x) => x.id)).toEqual(["s0", "s1"]);
    expect(g.map((x) => x.label)).toEqual(["학교", "학교 (2)"]);
  });
});
