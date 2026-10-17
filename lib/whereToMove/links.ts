import { umdOf } from "./judge";

/**
 * 네이버 부동산 모바일 검색 결과. 실거래 API에는 네이버 단지 번호가 없어 단지 페이지로 바로 갈 수는 없다.
 * 검색어는 `김포시 구래동 단지명`(시·도와 리는 빼야 잘 찾는다).
 */
export function naverLandUrl(d: { region: string; dong: string; apt: string }): string {
  const sgg = d.region.split(/\s+/).slice(1).join(" ") || d.region;
  return `https://m.land.naver.com/search/result/${encodeURIComponent(`${sgg} ${umdOf(d.dong)} ${d.apt}`.trim())}`;
}
