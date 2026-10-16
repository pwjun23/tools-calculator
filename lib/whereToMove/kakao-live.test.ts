import { afterEach, describe, expect, it } from "vitest";
import { fillLiveSites, kakaoAddress, kakaoComplex, kakaoLiveKey, type LiveSite } from "./kakao-live";

const res = (documents: unknown[], status = 200) => new Response(JSON.stringify({ documents }), { status });
const doc = (address_name: string, x = "126.6", y = "37.6") => ({ place_name: "가상", address_name, x, y });

describe("kakaoLiveKey", () => {
  const prev = { f: process.env.WTM_KAKAO_LIVE, k: process.env.KAKAO_CLIENT_ID };
  afterEach(() => {
    if (prev.f === undefined) delete process.env.WTM_KAKAO_LIVE; else process.env.WTM_KAKAO_LIVE = prev.f;
    if (prev.k === undefined) delete process.env.KAKAO_CLIENT_ID; else process.env.KAKAO_CLIENT_ID = prev.k;
  });
  it("WTM_KAKAO_LIVE=1 이고 키가 있을 때만 키를 준다", () => {
    process.env.KAKAO_CLIENT_ID = "K";
    delete process.env.WTM_KAKAO_LIVE;
    expect(kakaoLiveKey()).toBeNull();
    process.env.WTM_KAKAO_LIVE = "1";
    expect(kakaoLiveKey()).toBe("K");
  });
});

describe("kakaoComplex", () => {
  it("지역·읍면동·단지명으로 찾고 그 읍면동 주소인 결과를 고른다", async () => {
    let url = "", auth = "";
    const p = await kakaoComplex({ label: "가상 가상시", dong: "가상읍 가상리", apt: "가상아파트" }, "K", async (u, init) => {
      url = String(u); auth = new Headers(init?.headers).get("Authorization") ?? "";
      return res([doc("가상시 다른동 1", "1", "2"), doc("가상시 가상읍 가상리 5", "126.5", "37.7")]);
    });
    expect(new URL(url).searchParams.get("query")).toBe("가상 가상시 가상읍 가상아파트");
    expect(auth).toBe("KakaoAK K");
    expect(p).toEqual({ lat: 37.7, lng: 126.5 });
  });
  it("그 읍면동 결과가 없으면 null", async () => {
    expect(await kakaoComplex({ label: "가상시", dong: "가상동", apt: "A" }, "K", async () => res([doc("가상시 다른동 1")]))).toBeNull();
  });
  it("HTTP 오류는 키 없이 던진다", async () => {
    await expect(kakaoComplex({ label: "가상시", dong: "가상동", apt: "A" }, "SECRETKEY", async () => new Response("SECRETKEY", { status: 403 })))
      .rejects.toThrow(/^(?!.*SECRETKEY).*403/);
  });
});

describe("kakaoAddress", () => {
  it("주소 검색 결과를 쓴다", async () => {
    expect(await kakaoAddress("가상로 1", "K", async () => res([doc("가상로 1", "127", "37.5")]))).toEqual({ lat: 37.5, lng: 127 });
  });
  it("주소 결과가 없으면 키워드 검색으로 찾는다", async () => {
    const urls: string[] = [];
    const p = await kakaoAddress("가상빌딩", "K", async (u) => { urls.push(String(u)); return urls.length === 1 ? res([]) : res([doc("가상로 2", "127.1", "37.4")]); });
    expect(urls[0]).toContain("/address.json");
    expect(urls[1]).toContain("/keyword.json");
    expect(p).toEqual({ lat: 37.4, lng: 127.1 });
  });
  it("둘 다 없으면 null", async () => {
    expect(await kakaoAddress("없음", "K", async () => res([]))).toBeNull();
  });
});

describe("fillLiveSites", () => {
  const ok: LiveSite = { status: "ok", lat: 37, lng: 127 };
  it("좌표 없는 단지만 한 번씩 찾고, 찾은 것은 ok 로 채운다", async () => {
    const sites = new Map<string, LiveSite>([["a", ok], ["b", { status: "pending", lat: null, lng: null }]]);
    const asked: string[] = [];
    await fillLiveSites(sites, [{ key: "a", q: 1 }, { key: "b", q: 2 }, { key: "b", q: 2 }, { key: "c", q: 3 }], async (x) => {
      asked.push(String(x.q)); return x.q === 2 ? { lat: 37.1, lng: 126.9 } : null;
    });
    expect(asked.sort()).toEqual(["2", "3"]);
    expect(sites.get("b")).toEqual({ status: "ok", lat: 37.1, lng: 126.9 });
    expect(sites.has("c")).toBe(false);
  });
  it("찾다가 오류가 나도 나머지는 계속한다", async () => {
    const sites = new Map<string, LiveSite>();
    await fillLiveSites(sites, [{ key: "x", q: 0 }, { key: "y", q: 1 }], async (x) => { if (x.q === 0) throw new Error("net"); return { lat: 37, lng: 127 }; });
    expect(sites.get("y")?.status).toBe("ok");
    expect(sites.has("x")).toBe(false);
  });
});
