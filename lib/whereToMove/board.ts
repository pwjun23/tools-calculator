/** 목록의 동 필터 칩. 설정에서 고른 동을 거래 유무와 관계없이 지역별로, 가나다순으로 보여 준다. */
export function groupDongs(regions: { sggCd: string; label: string; dongs: string[] }[]) {
  return regions.map((r) => ({ sggCd: r.sggCd, label: r.label, dongs: [...r.dongs].sort((a, b) => a.localeCompare(b, "ko")) }));
}
