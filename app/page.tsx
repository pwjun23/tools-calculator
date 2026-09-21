import Link from "next/link";
import ThemeToggle from "./components/ThemeToggle";

const tools = [
  {
    href: "/salary",
    icon: "💰",
    title: "연봉 계산기",
    description:
      "연봉·월급으로 소득세와 4대보험을 뺀 월 실수령액을 계산해요.",
  },
  {
    href: "/freelancer",
    icon: "🧾",
    title: "프리랜서 실수령액 계산기",
    description: "계약금액과 실수령액을 3.3% 원천징수 기준으로 계산해요.",
  },
  {
    href: "/car",
    icon: "🚗",
    title: "자동차 유지비 계산기",
    description:
      "연료비·보험료·정비비·세금까지, 차를 굴리는 데 드는 월/연 비용을 계산해요.",
  },
  {
    href: "/jeonse",
    icon: "🏠",
    title: "전세금 이자 계산기",
    description:
      "전세금에 묶인 이자와 월세를 비교해 어느 쪽이 더 저렴한지 계산해요.",
  },
  {
    href: "/jeonse-vs-loan",
    icon: "🏘️",
    title: "대출금 상환 vs 전세 비교 계산기",
    description:
      "아파트를 대출받아 구매했을 때와 전세로 거주했을 때의 비용과 자산을 비교해요.",
  },
] as const;

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:py-10">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            도구 모음
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            실생활에 유용한 계산기를 모아두었어요.
          </p>
        </div>
        <ThemeToggle />
      </header>

      <ul className="grid gap-3 sm:grid-cols-2">
        {tools.map((tool) => (
          <li key={tool.href}>
            <Link
              href={tool.href}
              className="group flex h-full flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-5 transition hover:border-emerald-500 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-emerald-500 dark:hover:bg-slate-900/60"
            >
              <span aria-hidden="true" className="text-3xl">
                {tool.icon}
              </span>
              <span className="text-lg font-bold">{tool.title}</span>
              <span className="text-sm text-slate-600 dark:text-slate-400">
                {tool.description}
              </span>
              <span
                aria-hidden="true"
                className="mt-auto pt-2 text-sm font-semibold text-emerald-700 transition group-hover:translate-x-1 dark:text-emerald-400"
              >
                계산하러 가기 →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
