import type { Metadata } from "next";
import JeonseVsLoanCalculator from "./components/JeonseVsLoanCalculator";
import ThemeToggle from "@/app/components/ThemeToggle";
import JsonLd from "@/app/components/JsonLd";

const title = "대출금 상환 vs 전세 비교 계산기";
const description =
  "당신의 상황에 맞게 아파트 구매와 전세의 실제 비용을 비교합니다.";
const url = "/jeonse-vs-loan";

export const metadata: Metadata = {
  title,
  description,
  keywords: ["전세", "구매", "대출", "비교", "계산기"],
  alternates: {
    canonical: url,
  },
  openGraph: {
    title,
    description,
    url,
  },
};

export default function JeonseVsLoanPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:py-10">
      <JsonLd
        name={title}
        description={description}
        url={`https://tools.molespapa.com${url}`}
      />
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
