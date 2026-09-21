import { ogImageContentType, ogImageSize, renderOgImage } from "@/lib/ogImage";

export const size = ogImageSize;
export const contentType = ogImageContentType;
export const alt = "대출금 상환 vs 전세 비교 계산기";

export default function Image() {
  return renderOgImage(
    "대출금 상환 vs 전세 비교 계산기",
    "당신의 상황에 맞게 아파트 구매와 전세의 실제 비용을 비교합니다.",
  );
}
