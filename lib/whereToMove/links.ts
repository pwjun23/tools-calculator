/**
 * 네이버페이 부동산 검색. 실거래 API에는 네이버 단지 번호가 없어 단지 페이지로 바로 갈 수는 없다.
 * fin.land.naver.com/search 는 지도 화면의 검색창을 열어 비슷한 단지 목록을 보여 준다.
 * 지역 이름을 붙이면 못 찾아서 단지 이름만 쓰고, 국토부 표기의 괄호·'아파트'를 정리한다.
 */
export function naverLandUrl(d: { region: string; dong: string; apt: string }): string {
  const q = d.apt.replace(/[()]/g, " ").replace(/아파트$/, "").replace(/\s+/g, " ").trim();
  return `https://fin.land.naver.com/search?q=${encodeURIComponent(q)}`;
}
