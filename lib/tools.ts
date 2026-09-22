/**
 * 사이트의 계산기 목록 (단일 소스).
 *
 * 새 계산기를 추가하면 이 배열에 한 줄만 추가한다.
 * 홈 화면의 카드와 app/sitemap.ts 가 이 목록을 그대로 사용한다.
 */
export interface ToolInfo {
  href: string;
  icon: string;
  title: string;
  description: string;
}

export const TOOLS: ToolInfo[] = [
  {
    href: "/salary",
    icon: "💰",
    title: "연봉 계산기",
    description: "연봉·월급으로 소득세와 4대보험을 뺀 월 실수령액을 계산해요.",
  },
  {
    href: "/freelancer",
    icon: "🧾",
    title: "프리랜서 실수령액 계산기",
    description: "계약금액과 실수령액을 3.3% 원천징수 기준으로 계산해요.",
  },
  {
    href: "/car",
    icon: "🚗",
    title: "자동차 유지비 계산기",
    description:
      "연료비·보험료·정비비·세금까지, 차를 굴리는 데 드는 월/연 비용을 계산해요.",
  },
  {
    href: "/jeonse",
    icon: "🏠",
    title: "전세금 이자 계산기",
    description: "전세금에 묶인 이자와 월세를 비교해 어느 쪽이 더 저렴한지 계산해요.",
  },
  {
    href: "/jeonse-vs-loan",
    icon: "🏘️",
    title: "대출금 상환 vs 전세 비교 계산기",
    description:
      "아파트를 대출받아 구매했을 때와 전세로 거주했을 때의 비용과 자산을 비교해요.",
  },
];
