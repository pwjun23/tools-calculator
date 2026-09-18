import type { Metadata } from "next";
import SalaryCalculator from "./components/SalaryCalculator";
import ThemeToggle from "./components/ThemeToggle";

const title = "연봉 계산기 - 실수령액 계산";
const description =
  "연봉 또는 월급을 입력하면 소득세, 국민연금, 건강보험, 고용보험을 뺀 실수령액을 한 화면에서 확인할 수 있습니다.";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: "/salary",
  },
  openGraph: {
    title,
    description,
    url: "/salary",
  },
};

export default function SalaryPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:py-10">
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
