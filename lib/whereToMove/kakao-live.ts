import type { LatLng } from "./commute";
import { umdOf } from "./judge";

/**
 * 임시: 도로명주소 좌표 API 승인 전까지 카카오 로컬로 좌표를 그때그때 구한다.
 * 카카오 약관상 결과를 저장하면 안 되므로 DB에 넣지 않고 화면을 그리는 데만 쓴다.
 * 좌표 API가 승인되어 단지 좌표가 채워지면 WTM_KAKAO_LIVE 를 끄고 이 파일을 지운다.
 */
const BASE = "https://dapi.kakao.com/v2/local/search";
const TIMEOUT_MS = 3_000;
const CONCURRENCY = 10;

export type LiveSite = { status: "pending" | "ok" | "notfound"; lat: number | null; lng: number | null };
type Doc = { address_name: string; x: string; y: string };

export function kakaoLiveKey(): string | null {
  return process.env.WTM_KAKAO_LIVE === "1" ? process.env.KAKAO_CLIENT_ID?.trim() || null : null;
}

async function search(kind: "address" | "keyword", query: string, key: string, fetchFn: typeof fetch): Promise<Doc[]> {
  const res = await fetchFn(`${BASE}/${kind}.json?${new URLSearchParams({ query, size: "5" })}`, {
    headers: { Authorization: `KakaoAK ${key}` }, cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  // 오류 메시지에 키나 응답 본문을 넣지 않는다.
  if (!res.ok) throw new Error(`카카오 로컬 호출 실패 (${res.status})`);
  return ((await res.json()) as { documents?: Doc[] }).documents ?? [];
}

const point = (d: Doc | undefined): LatLng | null => {
  const lat = Number(d?.y), lng = Number(d?.x);
  return d && Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
};

/** 단지: `지역 이름 읍면동 단지명` 키워드로 찾고, 같은 읍면동 주소인 결과만 받는다. */
export async function kakaoComplex(c: { label: string; dong: string; apt: string }, key: string, fetchFn: typeof fetch = fetch): Promise<LatLng | null> {
  const umd = umdOf(c.dong);
  const docs = await search("keyword", `${c.label} ${umd} ${c.apt}`, key, fetchFn);
  return point(docs.find((d) => d.address_name.includes(umd)));
}

/** 직장 주소: 주소 검색, 없으면 키워드 검색. */
export async function kakaoAddress(address: string, key: string, fetchFn: typeof fetch = fetch): Promise<LatLng | null> {
  return point((await search("address", address, key, fetchFn))[0]) ?? point((await search("keyword", address, key, fetchFn))[0]);
}

/** 좌표가 없는 단지만 한 번씩 찾아 sites 에 ok 로 채운다(메모리에서만). 실패한 단지는 그대로 둔다. */
export async function fillLiveSites<Q>(sites: Map<string, LiveSite>, needs: { key: string; q: Q }[], lookup: (n: { key: string; q: Q }) => Promise<LatLng | null>): Promise<void> {
  const seen = new Set<string>();
  const todo = needs.filter((n) => sites.get(n.key)?.status !== "ok" && !seen.has(n.key) && seen.add(n.key));
  let i = 0;
  const worker = async () => {
    while (i < todo.length) {
      const n = todo[i++];
      try {
        const p = await lookup(n);
        if (p) sites.set(n.key, { status: "ok", lat: p.lat, lng: p.lng });
      } catch (e) {
        console.error("[whereToMove kakao live]", e instanceof Error ? e.message : e);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, todo.length) }, worker));
}
