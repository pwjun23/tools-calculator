import { describe, expect, it } from "vitest";
import { busIndex, minutesBetween, nameMatches, parseStops, suggestApts } from "./bus";

describe("parseStops", () => {
  it("한 줄에 '정류장 이름 시각', 빈 줄은 건너뛴다", () => {
    expect(parseStops("가상마을 2단지 정문 08:02\n\n가상역 버스정류장 8:05")).toEqual({
      stops: [{ name: "가상마을 2단지 정문", time: "08:02" }, { name: "가상역 버스정류장", time: "08:05" }],
      errors: [],
    });
  });
  it("앞의 번호·탭·끝 공백을 정리한다", () => {
    expect(parseStops("1\t가상 아파트 후문\t07:50 ").stops).toEqual([{ name: "가상 아파트 후문", time: "07:50" }]);
  });
  it("시각이 없거나 틀린 줄은 몇째 줄인지 알려 준다", () => {
    const r = parseStops("가상정류장 08:02\n시각없음\n가상 25:00");
    expect(r.stops).toHaveLength(1);
    expect(r.errors).toEqual(["2번째 줄: 끝에 시각(예: 08:02)이 없습니다", "3번째 줄: 끝에 시각(예: 08:02)이 없습니다"]);
  });
});

describe("minutesBetween", () => {
  it("분 차이", () => expect(minutesBetween("08:02", "08:53")).toBe(51));
  it("도착이 앞서면 null", () => expect(minutesBetween("09:00", "08:53")).toBeNull());
});

describe("suggestApts", () => {
  const list = [
    { sggCd: "11111", dong: "가동", apt: "가상솔터마을2단지" },
    { sggCd: "11111", dong: "가동", apt: "가상엘에이치솔터마을3단지" },
    { sggCd: "11111", dong: "나동", apt: "호수마을e편한세상" },
    { sggCd: "11111", dong: "나동", apt: "전혀다른단지" },
  ];
  it("이름이 비슷한 단지를 점수순으로, 관계없는 단지는 뺀다", () => {
    const r = suggestApts("솔터 2,3단지 정문 버스정류장", list).map((a) => a.apt);
    expect(r.slice(0, 2).sort()).toEqual(["가상솔터마을2단지", "가상엘에이치솔터마을3단지"]);
    expect(r).not.toContain("전혀다른단지");
  });
  it("이편한세상은 e편한세상과 같게 본다", () => {
    expect(suggestApts("이편한세상 2단지", list)[0].apt).toBe("호수마을e편한세상");
  });
});

describe("busIndex", () => {
  const routes = [{
    label: "2호차", dest: "학교", arrive: "08:53",
    stops: [
      { name: "가상정문", time: "08:02", apts: [{ sggCd: "11111", dong: "가동", apt: "가상단지" }] },
      { name: "다른정문", time: "08:20", apts: [] },
    ],
  }];
  it("단지(읍·면·동+이름) → 탑승 줄. 리 이름은 무시", () => {
    const at = busIndex(routes);
    expect(at({ sggCd: "11111", dong: "가동 가리", apt: "가상단지" })).toEqual(["🚌 2호차 가상정문 08:02 탑승 · 학교 도착까지 51분"]);
    expect(at({ sggCd: "11111", dong: "가동", apt: "없는단지" })).toEqual([]);
  });
});

describe("nameMatches", () => {
  it("띄어쓰기·표기 차이를 무시하고 포함 여부", () => {
    expect(nameMatches("솔터 마을", "김포한강엘에이치솔터마을3단지")).toBe(true);
    expect(nameMatches("LH", "가상엘에이치1단지")).toBe(true);
    expect(nameMatches("없음", "가상단지")).toBe(false);
    expect(nameMatches(" ", "가상단지")).toBe(false);
  });
});
