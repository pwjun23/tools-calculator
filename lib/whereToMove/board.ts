/** 목록의 동 필터 칩. 설정에서 고른 동을 거래 유무와 관계없이 지역별로, 가나다순으로 보여 준다. */
export function groupDongs(regions: { sggCd: string; label: string; dongs: string[] }[]) {
  return regions.map((r) => ({ sggCd: r.sggCd, label: r.label, dongs: [...r.dongs].sort((a, b) => a.localeCompare(b, "ko")) }));
}

/** 동 칩을 토글한다. 값은 'sggCd:동'이고, 빈 목록은 '전체'다. */
export function toggleDong(selected: string[], value: string): string[] {
  return selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value];
}

export type StoredFilters = { dongs?: string[]; types?: string[]; okOnly?: boolean; minArea?: string; maxMonthly?: string; sort?: string; commute?: string; period?: string; hideRental?: boolean };
const DEAL_TYPES = ["매매", "전세", "월세"];

/** 목록 기간 필터(계약일 기준). 오래된 계약일수록 지금 시세와 차이가 크다. */
export const PERIODS = [
  { v: "all", t: "전체 기간" },
  { v: "1", t: "최근 1개월" },
  { v: "3", t: "최근 3개월" },
  { v: "6", t: "최근 6개월" },
] as const;

/** 기간의 시작 계약일(YYYY-MM-DD). today 에서 N개월 전, 그달에 없는 날이면 그달 말일. 전체·모르는 값은 null. */
export function periodStart(period: string, today: string): string | null {
  const n = PERIODS.some((p) => p.v === period && p.v !== "all") ? Number(period) : 0;
  if (!n) return null;
  const [y, m, d] = today.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1 - n, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(d, last));
  return first.toISOString().slice(0, 10);
}

/**
 * 브라우저에 저장해 둔 목록 필터를 읽는다. 지금 쓸 수 없는 값(빠진 동, 모르는 정렬, 틀린 형식)은 버린다.
 * 통근·통학 값은 화면에서 장소 목록으로 다시 검사한다(없는 장소면 '전체').
 */
export function readFilters(raw: string | null, allowed: { dongs: string[]; sorts: string[] }): StoredFilters {
  let o: Record<string, unknown>;
  try {
    o = raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
  if (!o || typeof o !== "object") return {};
  const out: StoredFilters = {};
  const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : null);
  const dongs = strs(o.dongs);
  if (dongs) out.dongs = dongs.filter((d) => allowed.dongs.includes(d));
  const types = strs(o.types);
  if (types) out.types = types.filter((t) => DEAL_TYPES.includes(t));
  if (typeof o.okOnly === "boolean") out.okOnly = o.okOnly;
  if (typeof o.hideRental === "boolean") out.hideRental = o.hideRental;
  if (typeof o.minArea === "string") out.minArea = o.minArea;
  if (typeof o.maxMonthly === "string") out.maxMonthly = o.maxMonthly;
  if (typeof o.sort === "string" && allowed.sorts.includes(o.sort)) out.sort = o.sort;
  if (typeof o.commute === "string") out.commute = o.commute;
  if (typeof o.period === "string" && PERIODS.some((p) => p.v === o.period)) out.period = o.period;
  return out;
}

export type BoardFilters = { basis?: "임대" | "매매"; possibleOnly?: boolean; dongs?: string[] };

/** 단지 시세판에 저장해 둔 필터를 읽는다. 지금 쓸 수 없는 값은 버린다. */
export function readBoardFilters(raw: string | null, allowedDongs: string[]): BoardFilters {
  let o: Record<string, unknown>;
  try {
    o = raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
  if (!o || typeof o !== "object") return {};
  const out: BoardFilters = {};
  if (o.basis === "임대" || o.basis === "매매") out.basis = o.basis;
  if (typeof o.possibleOnly === "boolean") out.possibleOnly = o.possibleOnly;
  if (Array.isArray(o.dongs)) out.dongs = o.dongs.filter((d): d is string => typeof d === "string" && allowedDongs.includes(d));
  return out;
}
