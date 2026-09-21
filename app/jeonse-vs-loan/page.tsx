import type { Metadata } from "next";
import JeonseVsLoanCalculator from "./components/JeonseVsLoanCalculator";
import ThemeToggle from "@/app/components/ThemeToggle";

const title = "대출금 상환 vs 전세 비교 계산기";
const description =
  "아파트를 대출받아 구매했을 때와 전세로 거주했을 때의 월평균비용, 거주기간 총비용, 보유자산을 비교해요.";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: "/jeonse-vs-loan",
  },
  openGraph: {
    title,
    description,
    url: "/jeonse-vs-loan",
  },
};

export default function JeonseVsLoanPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:py-10">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {title}
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            아파트 가격, 거주 기간, 대출금리를 조정해 대출로 구매했을 때와
            전세로 거주했을 때 중 어느 쪽이 더 유리한지 비교해요.
          </p>
        </div>
        <ThemeToggle />
      </header>

      <JeonseVsLoanCalculator />
    </main>
  );
}
