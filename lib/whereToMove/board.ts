/** 목록의 동 필터 칩. 설정에서 고른 동을 거래 유무와 관계없이 지역별로, 가나다순으로 보여 준다. */
export function groupDongs(regions: { sggCd: string; label: string; dongs: string[] }[]) {
  return regions.map((r) => ({ sggCd: r.sggCd, label: r.label, dongs: [...r.dongs].sort((a, b) => a.localeCompare(b, "ko")) }));
}

/** 동 칩을 토글한다. 값은 'sggCd:동'이고, 빈 목록은 '전체'다. */
export function toggleDong(selected: string[], value: string): string[] {
  return selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value];
}
