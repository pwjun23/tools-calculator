import { umdOf } from "./dong";

/**
 * 네이버 통합검색. 실거래 API에는 네이버 단지 번호가 없어 단지 페이지로 바로 갈 수는 없다.
 * fin.land 검색은 검색어를 지도 검색창에만 넣어 결과가 비고, m.land 검색은 이름이 정확히 한 단지일 때만 찾는다
 * (2026-10-20 김포 43개 단지 중 절반 실패: 엘에이치/LH, e편한세상/이편한세상 표기 차이 등).
 * 통합검색은 표기가 달라도 부동산 단지 카드(매물 수·매물 보기)를 보여 준다.
 * 시·군·구와 읍·면·동을 붙여 같은 이름 단지를 가리고, 국토부 표기의 괄호·'아파트'를 정리한다.
 */
export function naverLandUrl(d: { region: string; dong: string; apt: string }): string {
  const city = d.region.split(" ").at(-1) ?? "";
  const apt = d.apt.replace(/[()]/g, " ").replace(/아파트$/, "");
  const q = [city, umdOf(d.dong), apt].join(" ").replace(/\s+/g, " ").trim();
  return `https://search.naver.com/search.naver?query=${encodeURIComponent(q)}`;
}
