import { ogImageContentType, ogImageSize, renderOgImage } from "@/lib/ogImage";

export const size = ogImageSize;
export const contentType = ogImageContentType;
export const alt = "도구 모음";

export default function Image() {
  return renderOgImage("도구 모음", "실생활에 유용한 계산기 모음");
}
