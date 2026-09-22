import { ogImageContentType, ogImageSize, renderOgImage } from "@/lib/ogImage";

export const size = ogImageSize;
export const contentType = ogImageContentType;
export const alt = "전세 이자 계산기";

export default function Image() {
  return renderOgImage(
    "전세 이자 계산기",
    "전세금으로 받을 수 있는 이자를 계산하고 금융상품을 비교해보세요.",
  );
}
