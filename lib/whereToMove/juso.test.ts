import { describe, expect, it } from "vitest";
import { cleanKeyword, coordOf, jusoSearchKey, locateAddress, parseCoord, parseSearch, searchAddress } from "./juso";
import { wgs84ToUtmk } from "./coord";

const cand = { roadAddr: "가상시 가상로 1", jibunAddr: "가상시 가상동 1", admCd: "1111010100", rnMgtSn: "111103100001", udrtYn: "0", buldMnnm: "1", buldSlno: "0", bdNm: "가상빌딩" };
const ok = (juso: unknown) => ({ results: { common: { errorCode: "0", errorMessage: "정상", totalCount: "1" }, juso } });
const res = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

describe("cleanKeyword", () => {
  it("특수문자를 지우고 공백을 하나로", () => expect(cleanKeyword("  가상로 [1] %=<>  ")).toBe("가상로 1"));
  it("SQL 예약어를 지운다", () => expect(cleanKeyword("가상로 select 1 OR union")).toBe("가상로 1"));
});

describe("parseSearch", () => {
  it("후보를 필요한 필드만 꺼낸다", () => {
    expect(parseSearch(ok([{ ...cand, zipNo: "00000" }]))).toEqual([cand]);
  });
  it("juso 가 null 이면 빈 목록", () => expect(parseSearch(ok(null))).toEqual([]));
  it("오류 코드면 메시지와 함께 throw", () => {
    expect(() => parseSearch({ results: { common: { errorCode: "E0001", errorMessage: "승인되지 않은 KEY 입니다." }, juso: null } })).toThrow("E0001");
  });
  it("모양이 다르면 throw", () => expect(() => parseSearch({ foo: 1 })).toThrow());
});

describe("parseCoord", () => {
  it("entX·entY 를 숫자로", () => expect(parseCoord(ok([{ entX: "953000.5", entY: "1952000.25" }]))).toEqual({ x: 953000.5, y: 1952000.25 }));
  it("결과 없음은 null", () => expect(parseCoord(ok([]))).toBeNull());
});

describe("searchAddress / coordOf / locateAddress", () => {
  it("검색 URL 에 키·키워드·json 을 넣는다", async () => {
    let url = "";
    await searchAddress("가상로 1", "KEY", async (u) => { url = String(u); return res(ok([cand])); });
    expect(url).toContain("addrLinkApi.do");
    expect(url).toContain("confmKey=KEY");
    expect(url).toContain(`keyword=${encodeURIComponent("가상로 1").replace(/%20/g, "+")}`);
    expect(url).toContain("resultType=json");
  });
  it("HTTP 오류는 키를 빼고 throw", async () => {
    await expect(searchAddress("가상로", "SECRETKEY", async () => new Response("bad", { status: 500 }))).rejects.toThrow(/500/);
    await expect(searchAddress("가상로", "SECRETKEY", async () => new Response("bad", { status: 500 }))).rejects.not.toThrow(/SECRETKEY/);
  });
  it("좌표를 위경도로 바꾼다", async () => {
    const { x, y } = wgs84ToUtmk(37.6, 126.7);
    const p = await coordOf(cand, "KEY", async () => res(ok([{ entX: String(x), entY: String(y) }])));
    expect(p!.lat).toBeCloseTo(37.6, 5);
    expect(p!.lng).toBeCloseTo(126.7, 5);
  });
  it("locateAddress: 검색 결과가 없으면 좌표 API 를 부르지 않고 null", async () => {
    let calls = 0;
    const p = await locateAddress("없는 주소", { search: "S", coord: "C" }, async () => { calls++; return res(ok(null)); });
    expect(p).toBeNull();
    expect(calls).toBe(1);
  });
  it("locateAddress: 첫 후보의 좌표", async () => {
    const { x, y } = wgs84ToUtmk(37.5, 127);
    const p = await locateAddress("가상로 1", { search: "S", coord: "C" }, async (u) =>
      String(u).includes("addrCoordApi") ? res(ok([{ entX: String(x), entY: String(y) }])) : res(ok([cand])));
    expect(p!.lat).toBeCloseTo(37.5, 5);
  });
});

describe("시간 제한", () => {
  it("요청마다 타임아웃 signal 을 넘긴다", async () => {
    let signal: unknown;
    await searchAddress("가상로 1", "KEY", async (_u, init) => { signal = init?.signal; return res(ok([cand])); });
    expect(signal).toBeInstanceOf(AbortSignal);
  });
});

describe("jusoSearchKey", () => {
  it("좌표 키 없이 검색 키만 있어도 돌려준다", () => {
    const prev = { s: process.env.JUSO_SEARCH_KEY, c: process.env.JUSO_COORD_KEY };
    process.env.JUSO_SEARCH_KEY = "S"; delete process.env.JUSO_COORD_KEY;
    try { expect(jusoSearchKey()).toBe("S"); } finally {
      if (prev.s === undefined) delete process.env.JUSO_SEARCH_KEY; else process.env.JUSO_SEARCH_KEY = prev.s;
      if (prev.c !== undefined) process.env.JUSO_COORD_KEY = prev.c;
    }
  });
});
