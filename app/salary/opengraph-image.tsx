import { ogImageContentType, ogImageSize, renderOgImage } from "@/lib/ogImage";

export const size = ogImageSize;
export const contentType = ogImageContentType;
export const alt = "연봉 계산기 - 실수령액 & 세금 계산";

export default function Image() {
  return renderOgImage(
    "연봉 계산기 - 실수령액 & 세금 계산",
    "연봉에서 세금을 제외한 실제 월급과 연봉을 계산합니다.",
  );
}
