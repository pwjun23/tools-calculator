/**
 * tools.molespapa.com 계산기 목록 (lib/tools.ts의 슬러그·URL을 그대로 미러링한 사본).
 * wordpress-publisher는 별도 패키지라 Next.js 앱 코드를 직접 import하지 않는다.
 */
export interface CalculatorInfo {
  url: string;
  title: string;
}

export const CALCULATORS: Record<string, CalculatorInfo> = {
  salary: {
    url: "https://tools.molespapa.com/salary",
    title: "연봉 계산기",
  },
  freelancer: {
    url: "https://tools.molespapa.com/freelancer",
    title: "프리랜서 실수령액 계산기",
  },
  car: {
    url: "https://tools.molespapa.com/car",
    title: "자동차 유지비 계산기",
  },
  jeonse: {
    url: "https://tools.molespapa.com/jeonse",
    title: "전세금 이자 계산기",
  },
  "jeonse-vs-loan": {
    url: "https://tools.molespapa.com/jeonse-vs-loan",
    title: "대출금 상환 vs 전세 비교 계산기",
  },
};

export function resolveCalculator(slug: string): CalculatorInfo {
  const info = CALCULATORS[slug];
  if (!info) {
    throw new Error(
      `알 수 없는 계산기 슬러그입니다: "${slug}". 사용 가능한 값: ${Object.keys(CALCULATORS).join(", ")}`,
    );
  }
  return info;
}
