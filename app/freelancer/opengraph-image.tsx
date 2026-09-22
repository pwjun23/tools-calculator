import { ogImageContentType, ogImageSize, renderOgImage } from "@/lib/ogImage";

export const size = ogImageSize;
export const contentType = ogImageContentType;
export const alt = "프리랜서 실수령액 계산기";

export default function Image() {
  return renderOgImage(
    "프리랜서 실수령액 계산기",
    "연봉과 세금을 반영한 프리랜서 실제 수령액을 계산해보세요.",
  );
}
