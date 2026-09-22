import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://tools.molespapa.com"),
  title: {
    default: "도구 모음",
    template: "%s | molespapa",
  },
  description: "실생활에 유용한 계산기 모음",
  openGraph: {
    type: "website",
    siteName: "도구 모음",
    locale: "ko_KR",
  },
  verification: {
    google: "SRRvEKbg362Et3tYIP3ClwBLzM-d3_nR8C8EatO_PH0",
  },
};

// 첫 페인트 전에 저장된 테마(없으면 시스템 설정)를 적용해 깜빡임을 막는다.
const themeInitScript = `(function(){try{var t=localStorage.getItem('theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark')}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
