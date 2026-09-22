import type { Metadata } from "next";
import JeonseCalculator from "./components/JeonseCalculator";
import ThemeToggle from "@/app/components/ThemeToggle";
import JsonLd from "@/app/components/JsonLd";

const title = "전세 이자 계산기";
const description =
  "전세금으로 받을 수 있는 이자를 계산하고 금융상품을 비교해보세요.";
const url = "/jeonse";

export const metadata: Metadata = {
  title,
  description,
  keywords: ["전세", "이자", "계산기", "금융상품", "비교"],
  alternates: {
    canonical: url,
  },
  openGraph: {
    title,
    description,
    url,
  },
};

export default function JeonsePage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:py-10">
      <JsonLd
        name={title}
        description={description}
        url={`https://tools.molespapa.com${url}`}
      />
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
