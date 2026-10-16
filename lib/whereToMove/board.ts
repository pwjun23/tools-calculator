/** 목록의 동 필터 칩. 설정에서 고른 동을 거래 유무와 관계없이 지역별로, 가나다순으로 보여 준다. */
export function groupDongs(regions: { sggCd: string; label: string; dongs: string[] }[]) {
  return regions.map((r) => ({ sggCd: r.sggCd, label: r.label, dongs: [...r.dongs].sort((a, b) => a.localeCompare(b, "ko")) }));
}

/** 동 칩을 토글한다. 값은 'sggCd:동'이고, 빈 목록은 '전체'다. */
export function toggleDong(selected: string[], value: string): string[] {
  return selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value];
}

export type StoredFilters = { dongs?: string[]; types?: string[]; okOnly?: boolean; minArea?: string; maxMonthly?: string; sort?: string; commute?: string };
const DEAL_TYPES = ["매매", "전세", "월세"];

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
  if (typeof o.minArea === "string") out.minArea = o.minArea;
  if (typeof o.maxMonthly === "string") out.maxMonthly = o.maxMonthly;
  if (typeof o.sort === "string" && allowed.sorts.includes(o.sort)) out.sort = o.sort;
  if (typeof o.commute === "string") out.commute = o.commute;
  return out;
}
