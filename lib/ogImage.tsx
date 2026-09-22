import { ImageResponse } from "next/og";

export const ogImageSize = { width: 1200, height: 630 };
export const ogImageContentType = "image/png";

/** 모든 계산기 페이지가 공유하는 Open Graph 이미지 템플릿 */
export function renderOgImage(title: string, description: string) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#0f172a",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 28,
            fontWeight: 700,
            color: "#34d399",
            marginBottom: 28,
          }}
        >
          tools.molespapa.com
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 60,
            fontWeight: 800,
            lineHeight: 1.25,
            color: "#ffffff",
          }}
        >
          {title}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 28,
            marginTop: 28,
            color: "#cbd5e1",
          }}
        >
          {description}
        </div>
      </div>
    ),
    ogImageSize,
  );
}
