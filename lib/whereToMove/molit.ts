import { XMLParser } from "fast-xml-parser";
import type { DealType, MolitDeal } from "./types";

export const TRADE_URL = "https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev";
export const RENT_URL = "https://apis.data.go.kr/1613000/RTMSDataSvcAptRent/getRTMSDataSvcAptRent";
const PAGE_SIZE = 1000;

const parser = new XMLParser({ parseTagValue: false, isArray: (name) => name === "item" });

/** 복사하며 섞인 공백·따옴표를 지우고, Decoding 키면 인코딩한다(Encoding 키는 그대로). */
export function apiKeyParam(raw: string): string {
  const k = raw.replace(/\s/g, "").replace(/^["']+|["']+$/g, "");
  return k.includes("%") ? k : encodeURIComponent(k);
}

export function parseMoney(s: unknown): number {
  const n = parseInt(String(s ?? "").replace(/[,\s]/g, ""), 10);
  return Number.isNaN(n) ? 0 : n;
}

const clip = (s: string, max = 200) => (s.length <= max ? s : s.slice(0, max - 1) + "…");

export function parseItems(xml: string): { total: number; rows: Record<string, string>[] } {
  const doc = parser.parse(xml) as { response?: { header?: { resultCode?: string; resultMsg?: string }; body?: { items?: { item?: Record<string, string>[] } | string; totalCount?: string } } };
  const res = doc.response;
  if (!res) throw new Error("API 응답 형식이 다릅니다. 인증키나 신청 상태를 확인하세요: " + clip(xml));
  const code = res.header?.resultCode;
  if (code && code !== "00" && code !== "000") throw new Error(`API 오류 ${code}: ${res.header?.resultMsg ?? ""}`);
  const items = res.body?.items;
  const rows = items && typeof items === "object" && Array.isArray(items.item) ? items.item : [];
  return { total: parseMoney(res.body?.totalCount), rows: rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, String(v ?? "").trim()]))) };
}

const pad2 = (n: number) => String(n).padStart(2, "0");
const dealDate = (y: string, m: string, d: string) => `${y}-${pad2(parseInt(m, 10))}-${pad2(parseInt(d, 10))}`;

export function dealKey(d: Pick<MolitDeal, "sggCd" | "type" | "apt" | "dong" | "area" | "floor" | "date" | "amount" | "rent">): string {
  return [d.sggCd, d.type, d.apt, d.dong, d.area, d.floor, d.date, d.amount, d.rent].join("|");
}

function build(it: Record<string, string>, sggCd: string, type: DealType, amount: number, rent: number, renewal: boolean, cancelled: boolean): MolitDeal | null {
  if (!it.umdNm) return null;
  const areaRaw = parseFloat(it.excluUseAr) || 0;
  const base = {
    type, sggCd, dong: it.umdNm, apt: it.aptNm ?? "", area: Math.round(areaRaw), areaRaw,
    floor: it.floor ?? "", date: dealDate(it.dealYear, it.dealMonth, it.dealDay), amount, rent, renewal, cancelled,
  };
  return { ...base, key: dealKey(base) };
}

export function normalizeTrade(it: Record<string, string>, sggCd: string): MolitDeal | null {
  const cancelled = it.cdealType === "O" || (it.cdealDay ?? "").length > 0;
  return build(it, sggCd, "매매", parseMoney(it.dealAmount), 0, false, cancelled);
}

export function normalizeRent(it: Record<string, string>, sggCd: string): MolitDeal | null {
  const rent = parseMoney(it.monthlyRent);
  return build(it, sggCd, rent > 0 ? "월세" : "전세", parseMoney(it.deposit), rent, (it.contractType ?? "").includes("갱신"), false);
}

/** KST 기준 이번 달부터 n개월의 YYYYMM. */
export function recentMonths(n: number, now: Date = new Date()): string[] {
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear();
  const m = kst.getUTCMonth();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(y, m - i, 1));
    return `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}`;
  });
}

async function fetchPaged(baseUrl: string, key: string, sggCd: string, ym: string, fetchFn: typeof fetch) {
  const rows: Record<string, string>[] = [];
  for (let page = 1; ; page++) {
    const url = `${baseUrl}?serviceKey=${key}&LAWD_CD=${sggCd}&DEAL_YMD=${ym}&pageNo=${page}&numOfRows=${PAGE_SIZE}`;
    const res = await fetchFn(url, { cache: "no-store" });
    const text = await res.text();
    if (!res.ok) throw new Error(`API 호출 실패 (${res.status}): ${clip(text)}`);
    const parsed = parseItems(text);
    rows.push(...parsed.rows);
    if (rows.length >= parsed.total || parsed.rows.length === 0) break;
  }
  return rows;
}

export async function fetchDeals(sggCd: string, ym: string, keys: { trade: string; rent: string }, fetchFn: typeof fetch = fetch): Promise<MolitDeal[]> {
  const trades = (await fetchPaged(TRADE_URL, keys.trade, sggCd, ym, fetchFn)).map((r) => normalizeTrade(r, sggCd));
  const rents = (await fetchPaged(RENT_URL, keys.rent, sggCd, ym, fetchFn)).map((r) => normalizeRent(r, sggCd));
  return [...trades, ...rents].filter((d): d is MolitDeal => d !== null);
}

/** 같은 키(같은 날·층·금액의 다른 호실 등)는 처음 것만 남긴다. Apps Script도 키 기준으로 한 건으로 셌다. */
export function uniqueByKey<T extends { key: string }>(deals: T[]): T[] {
  const seen = new Set<string>();
  return deals.filter((d) => (seen.has(d.key) ? false : (seen.add(d.key), true)));
}

/** 환경변수의 공공데이터 키(매매, 전월세). 없으면 null. */
export function collectKeys(): { trade: string; rent: string } | null {
  const raw = process.env.DATA_GO_KR_KEY;
  if (!raw) return null;
  return { trade: apiKeyParam(raw), rent: apiKeyParam(process.env.DATA_GO_KR_KEY_RENT || raw) };
}
