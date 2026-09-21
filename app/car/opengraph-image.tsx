import { ogImageContentType, ogImageSize, renderOgImage } from "@/lib/ogImage";

export const size = ogImageSize;
export const contentType = ogImageContentType;
export const alt = "자동차 유지비 계산기";

export default function Image() {
  return renderOgImage(
    "자동차 유지비 계산기",
    "등록세, 보험료, 유지비까지 자동차의 실제 유지비를 계산해보세요.",
  );
}
