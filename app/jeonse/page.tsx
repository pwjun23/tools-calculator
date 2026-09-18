import type { Metadata } from "next";
import JeonseCalculator from "./components/JeonseCalculator";
import ThemeToggle from "@/app/components/ThemeToggle";

const title = "전세금 이자 계산기";
const description =
  "전세금 이자와 월세 비용을 계산하고, 전세와 월세 중 어느 쪽이 얼마나 저렴한지 계약 기간별·이자율별 총 비용까지 한 화면에서 확인할 수 있습니다.";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: "/jeonse",
  },
  openGraph: {
    title,
    description,
    url: "/jeonse",
  },
};

export default function JeonsePage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:py-10">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            전세금 이자 계산기
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            전세금에 묶인 돈의 이자를 계산하고, 월세와 비교해 어느 쪽이 더
            저렴한지 알려드려요.
          </p>
        </div>
        <ThemeToggle />
      </header>

      <JeonseCalculator />
    </main>
  );
}
