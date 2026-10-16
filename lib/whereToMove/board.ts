/** 목록의 동 필터 칩을 설정 지역 순서로 나눈다. 거래가 있는 동만, 가나다순. */
export function groupDongs(deals: { sggCd: string; dong: string }[], regions: { sggCd: string; label: string }[]) {
  return regions
    .map((r) => ({
      sggCd: r.sggCd,
      label: r.label,
      dongs: [...new Set(deals.filter((d) => d.sggCd === r.sggCd).map((d) => d.dong))].sort((a, b) => a.localeCompare(b, "ko")),
    }))
    .filter((g) => g.dongs.length > 0);
}

/** 목록 제목 아래 부제: "경기 김포시 구래동·마산동 · 인천 서구 가상동" */
export const regionSubtitle = (regions: { sggCd: string; label: string; dongs: string[] }[]) =>
  regions.map((r) => `${r.label} ${r.dongs.join("·")}`).join(" · ");
