import type { Metadata } from "next";
import CarCalculator from "./components/CarCalculator";
import ThemeToggle from "@/app/components/ThemeToggle";

const title = "자동차 유지비 계산기";
const description =
  "자동차 가격을 입력하면 연료비, 보험료, 정비비, 자동차세, 취득세를 합쳐 월·연 유지비를 한 화면에서 계산합니다.";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: "/car",
  },
  openGraph: {
    title,
    description,
    url: "/car",
  },
};

export default function CarPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:py-10">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            자동차 유지비 계산기
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            차 한 대를 굴리는 데 한 달, 1년에 얼마가 드는지 계산해 드려요.
          </p>
        </div>
        <ThemeToggle />
      </header>

      <CarCalculator />
    </main>
  );
}
