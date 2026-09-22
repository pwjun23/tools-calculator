import type { Metadata } from "next";
import SalaryCalculator from "./components/SalaryCalculator";
import ThemeToggle from "@/app/components/ThemeToggle";
import JsonLd from "@/app/components/JsonLd";

const title = "연봉 계산기 - 실수령액 & 세금 계산";
const description = "연봉에서 세금을 제외한 실제 월급과 연봉을 계산합니다.";
const url = "/salary";

export const metadata: Metadata = {
  title,
  description,
  keywords: ["연봉", "실수령액", "세금", "월급", "계산기"],
  alternates: {
    canonical: url,
  },
  openGraph: {
    title,
    description,
    url,
  },
};

export default function SalaryPage() {
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
            연봉 계산기
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            연봉이나 월급을 입력하면 세금과 보험료를 뺀 실수령액을 알려드려요.
          </p>
        </div>
        <ThemeToggle />
      </header>

      <SalaryCalculator />
    </main>
  );
}
