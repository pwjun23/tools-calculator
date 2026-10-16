import { utmkToWgs84 } from "./coord";

/** 행정안전부 도로명주소 API. 공공데이터포털 표기 '이용허락범위 제한 없음'이라 좌표를 저장해 쓴다. */
const SEARCH_URL = "https://business.juso.go.kr/addrlink/addrLinkApi.do";
const COORD_URL = "https://business.juso.go.kr/addrlink/addrCoordApi.do";
/** 요청 하나의 시간 제한. 넘으면 오류가 되어 그 단지는 다음에 다시 한다(Cron 시간 보호). */
const TIMEOUT_MS = 10_000;

export type JusoRef = { admCd: string; rnMgtSn: string; udrtYn: string; buldMnnm: string; buldSlno: string };
export type JusoCandidate = JusoRef & { roadAddr: string; jibunAddr: string; bdNm: string };

export function jusoKeys(): { search: string; coord: string } | null {
  const search = process.env.JUSO_SEARCH_KEY?.trim();
  const coord = process.env.JUSO_COORD_KEY?.trim();
  return search && coord ? { search, coord } : null;
}

/** 주소 검색만 쓸 때(좌표 키 승인 전에도 직장 검색은 된다). */
export function jusoSearchKey(): string | null {
  return process.env.JUSO_SEARCH_KEY?.trim() || null;
}

const SQL_WORDS = /\b(OR|SELECT|INSERT|DELETE|UPDATE|CREATE|DROP|EXEC|UNION|FETCH|DECLARE|TRUNCATE)\b/gi;

/** 검색 API가 거부하는 특수문자·SQL 예약어를 지운다. */
export function cleanKeyword(s: string): string {
  return s.replace(/[%=><[\]]/g, " ").replace(SQL_WORDS, " ").replace(/\s+/g, " ").trim();
}

type Body = { results?: { common?: { errorCode?: string; errorMessage?: string }; juso?: Record<string, string>[] | null } };

function rows(json: unknown): Record<string, string>[] {
  const r = (json as Body)?.results;
  if (!r?.common) throw new Error("도로명주소 API 응답 형식이 다릅니다");
  if (r.common.errorCode !== "0") throw new Error(`도로명주소 API 오류 ${r.common.errorCode}: ${r.common.errorMessage ?? ""}`);
  return Array.isArray(r.juso) ? r.juso : [];
}

export function parseSearch(json: unknown): JusoCandidate[] {
  return rows(json).map((j) => ({
    roadAddr: j.roadAddr ?? "", jibunAddr: j.jibunAddr ?? "", bdNm: j.bdNm ?? "",
    admCd: j.admCd ?? "", rnMgtSn: j.rnMgtSn ?? "", udrtYn: j.udrtYn ?? "0", buldMnnm: j.buldMnnm ?? "", buldSlno: j.buldSlno ?? "0",
  }));
}

export function parseCoord(json: unknown): { x: number; y: number } | null {
  const j = rows(json)[0];
  const x = Number(j?.entX);
  const y = Number(j?.entY);
  return j && Number.isFinite(x) && Number.isFinite(y) && x > 0 && y > 0 ? { x, y } : null;
}

async function getJson(base: string, params: Record<string, string>, fetchFn: typeof fetch): Promise<unknown> {
  const res = await fetchFn(`${base}?${new URLSearchParams({ ...params, resultType: "json" })}`, { cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
  // 오류 메시지에 URL(키 포함)을 넣지 않는다.
  if (!res.ok) throw new Error(`도로명주소 API 호출 실패 (${res.status})`);
  return res.json();
}

export async function searchAddress(keyword: string, key: string, fetchFn: typeof fetch = fetch): Promise<JusoCandidate[]> {
  const json = await getJson(SEARCH_URL, { confmKey: key, currentPage: "1", countPerPage: "10", keyword: cleanKeyword(keyword) }, fetchFn);
  return parseSearch(json);
}

export async function coordOf(ref: JusoRef, key: string, fetchFn: typeof fetch = fetch): Promise<{ lat: number; lng: number } | null> {
  const json = await getJson(COORD_URL, { confmKey: key, admCd: ref.admCd, rnMgtSn: ref.rnMgtSn, udrtYn: ref.udrtYn, buldMnnm: ref.buldMnnm, buldSlno: ref.buldSlno }, fetchFn);
  const p = parseCoord(json);
  return p ? utmkToWgs84(p.x, p.y) : null;
}

/** 주소 문자열의 좌표. 결과가 없으면 null, 네트워크·키 오류는 throw. */
export async function locateAddress(address: string, keys: { search: string; coord: string }, fetchFn: typeof fetch = fetch) {
  const [first] = await searchAddress(address, keys.search, fetchFn);
  return first ? coordOf(first, keys.coord, fetchFn) : null;
}
