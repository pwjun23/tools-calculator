import type { Metadata } from "next";
import CarCalculator from "./components/CarCalculator";
import ThemeToggle from "@/app/components/ThemeToggle";
import JsonLd from "@/app/components/JsonLd";

const title = "자동차 유지비 계산기";
const description =
  "등록세, 보험료, 유지비까지 자동차의 실제 유지비를 계산해보세요.";
const url = "/car";

export const metadata: Metadata = {
  title,
  description,
  keywords: ["자동차", "유지비", "보험료", "등록세", "계산기"],
  alternates: {
    canonical: url,
  },
  openGraph: {
    title,
    description,
    url,
  },
};

export default function CarPage() {
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
