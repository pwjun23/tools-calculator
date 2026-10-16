import { describe, expect, it } from "vitest";
import { apiKeyParam, dealKey, fetchDeals, normalizeRent, normalizeTrade, parseItems, parseMoney, recentMonths, uniqueByKey } from "./molit";

const wrap = (items: string, total: number) =>
  `<?xml version="1.0" encoding="UTF-8"?><response><header><resultCode>000</resultCode><resultMsg>OK</resultMsg></header>` +
  `<body><items>${items}</items><numOfRows>1000</numOfRows><pageNo>1</pageNo><totalCount>${total}</totalCount></body></response>`;

const tradeItem = (o: Record<string, string>) =>
  `<item>${Object.entries({ umdNm: "구래동", aptNm: "가상아파트", excluUseAr: "84.97", floor: "7", dealYear: "2026", dealMonth: "9", dealDay: "3", dealAmount: " 35,500", cdealType: "", cdealDay: "", ...o })
    .map(([k, v]) => `<${k}>${v}</${k}>`).join("")}</item>`;

describe("parseItems", () => {
  it("여러 건", () => {
    const r = parseItems(wrap(tradeItem({}) + tradeItem({ floor: "8" }), 2));
    expect(r.total).toBe(2);
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0].dealAmount).toBe("35,500");
  });
  it("한 건이어도 배열", () => {
    expect(parseItems(wrap(tradeItem({}), 1)).rows).toHaveLength(1);
  });
  it("0건", () => {
    expect(parseItems(wrap("", 0))).toEqual({ total: 0, rows: [] });
  });
  it("오류 코드면 throw", () => {
    const xml = `<response><header><resultCode>30</resultCode><resultMsg>SERVICE KEY IS NOT REGISTERED</resultMsg></header></response>`;
    expect(() => parseItems(xml)).toThrow(/30/);
  });
  it("response가 아니면 throw", () => {
    expect(() => parseItems("<OpenAPI_ServiceResponse><cmmMsgHeader/></OpenAPI_ServiceResponse>")).toThrow();
  });
});

describe("parseMoney", () => {
  it.each([[" 35,500", 35500], ["", 0], [undefined, 0], ["120", 120]])("%s → %i", (s, n) => {
    expect(parseMoney(s)).toBe(n);
  });
});

describe("normalizeTrade", () => {
  it("매매 정규화", () => {
    const d = normalizeTrade(parseItems(wrap(tradeItem({}), 1)).rows[0], "41570")!;
    expect(d).toMatchObject({ type: "매매", sggCd: "41570", dong: "구래동", area: 85, areaRaw: 84.97, floor: "7", date: "2026-09-03", amount: 35500, rent: 0, renewal: false, cancelled: false });
    expect(d.key).toBe("41570|매매|가상아파트|구래동|85|7|2026-09-03|35500|0");
  });
  it("해제 거래는 cancelled", () => {
    const row = parseItems(wrap(tradeItem({ cdealType: "O", cdealDay: "26.09.20" }), 1)).rows[0];
    expect(normalizeTrade(row, "41570")!.cancelled).toBe(true);
  });
  it("동 이름이 없으면 null", () => {
    expect(normalizeTrade({ aptNm: "x" }, "41570")).toBeNull();
  });
});

describe("normalizeRent", () => {
  const rentRow = (o: Record<string, string>) => ({
    umdNm: "마산동", aptNm: "가상전세", excluUseAr: "84.9", floor: "3", dealYear: "2026", dealMonth: "10", dealDay: "1",
    deposit: "20,000", monthlyRent: "0", contractType: "신규", ...o,
  });
  it("월세 0이면 전세", () => {
    expect(normalizeRent(rentRow({}), "41570")).toMatchObject({ type: "전세", amount: 20000, rent: 0, renewal: false });
  });
  it("월세 있으면 월세, 갱신 표시", () => {
    expect(normalizeRent(rentRow({ monthlyRent: "45", contractType: "갱신" }), "41570")).toMatchObject({ type: "월세", rent: 45, renewal: true });
  });
  it("월세 칸이 비어 있으면 전세", () => {
    expect(normalizeRent(rentRow({ monthlyRent: "" }), "41570")!.type).toBe("전세");
  });
});

describe("apiKeyParam", () => {
  it("Decoding 키는 인코딩, Encoding 키는 그대로, 공백·따옴표 제거", () => {
    expect(apiKeyParam(' "ab+c/=" \n')).toBe("ab%2Bc%2F%3D");
    expect(apiKeyParam("ab%2Bc")).toBe("ab%2Bc");
  });
});

describe("recentMonths", () => {
  it("KST 기준 이번 달부터", () => {
    // 2026-09-30 16:00 UTC = 2026-10-01 01:00 KST
    expect(recentMonths(2, new Date("2026-09-30T16:00:00Z"))).toEqual(["202610", "202609"]);
    expect(recentMonths(2, new Date("2026-01-10T00:00:00Z"))).toEqual(["202601", "202512"]);
  });
});

describe("dealKey", () => {
  it("시·군·구 + Apps Script 키 형식", () => {
    expect(dealKey({ sggCd: "11110", type: "월세", apt: "A", dong: "B", area: 77, floor: "11", date: "2026-09-04", amount: 10211, rent: 50 }))
      .toBe("11110|월세|A|B|77|11|2026-09-04|10211|50");
  });
});

describe("fetchDeals", () => {
  it("매매·전월세를 모두 받아 페이지를 넘긴다", async () => {
    const calls: string[] = [];
    const fake = (async (url: string) => {
      calls.push(url);
      const body = url.includes("Trade") ? wrap(tradeItem({}), 1) : wrap("", 0);
      return new Response(body, { status: 200 });
    }) as unknown as typeof fetch;
    const deals = await fetchDeals("41570", "202610", { trade: "K1", rent: "K2" }, fake);
    expect(deals).toHaveLength(1);
    expect(calls.some((u) => u.includes("serviceKey=K1") && u.includes("LAWD_CD=41570") && u.includes("DEAL_YMD=202610"))).toBe(true);
    expect(calls.some((u) => u.includes("serviceKey=K2"))).toBe(true);
  });
  it("HTTP 오류면 throw", async () => {
    const fake = (async () => new Response("down", { status: 500 })) as unknown as typeof fetch;
    await expect(fetchDeals("41570", "202610", { trade: "K", rent: "K" }, fake)).rejects.toThrow(/500/);
  });
});

describe("uniqueByKey", () => {
  it("같은 키는 처음 것만 남긴다 (한 upsert 안에서 같은 행을 두 번 고칠 수 없음)", () => {
    const out = uniqueByKey([{ key: "a", n: 1 }, { key: "b", n: 2 }, { key: "a", n: 3 }]);
    expect(out).toEqual([{ key: "a", n: 1 }, { key: "b", n: 2 }]);
  });
});

describe("단지 주소", () => {
  const base = { aptNm: "가상", umdNm: "양촌읍 양곡리", excluUseAr: "84.9", floor: "3", dealYear: "2026", dealMonth: "9", dealDay: "1", jibun: "12-3", aptSeq: "41570-1" };
  it("매매: 도로명 + 본번(-부번)", () => {
    const t = normalizeTrade({ ...base, dealAmount: "30,000", roadNm: "가상로", roadNmBonbun: "00215", roadNmBubun: "00003" }, "41570")!;
    expect(t.roadAddr).toBe("경기도 김포시 가상로 215-3");
    expect(t.jibunAddr).toBe("경기도 김포시 양촌읍 양곡리 12-3");
    expect(t.aptSeq).toBe("41570-1");
  });
  it("매매: 부번 0 은 생략, 도로명이 없으면 빈 값", () => {
    expect(normalizeTrade({ ...base, dealAmount: "1", roadNm: "가상로", roadNmBonbun: "00064", roadNmBubun: "00000" }, "41570")!.roadAddr).toBe("경기도 김포시 가상로 64");
    expect(normalizeTrade({ ...base, dealAmount: "1", roadNm: "" }, "41570")!.roadAddr).toBe("");
  });
  it("전월세: roadnm 그대로", () => {
    const r = normalizeRent({ ...base, deposit: "1", monthlyRent: "0", roadnm: "가상로 64" }, "41570")!;
    expect(r.roadAddr).toBe("경기도 김포시 가상로 64");
  });
  it("지번이 없으면 지번 주소도 빈 값", () => {
    expect(normalizeRent({ ...base, jibun: "", deposit: "1", monthlyRent: "0" }, "41570")!.jibunAddr).toBe("");
  });
});
