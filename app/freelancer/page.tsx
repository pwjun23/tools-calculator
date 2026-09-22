import type { Metadata } from "next";
import FreelancerCalculator from "./components/FreelancerCalculator";
import JsonLd from "@/app/components/JsonLd";

const title = "프리랜서 실수령액 계산기";
const description = "연봉과 세금을 반영한 프리랜서 실제 수령액을 계산해보세요.";
const url = "/freelancer";

export const metadata: Metadata = {
  title,
  description,
  keywords: ["프리랜서", "실수령액", "세금", "소득세", "계산기"],
  alternates: {
    canonical: url,
  },
  openGraph: {
    title,
    description,
    url,
  },
};

export default function FreelancerPage() {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-zinc-50 px-4 py-16 dark:bg-zinc-950">
      <JsonLd
        name={title}
        description={description}
        url={`https://tools.molespapa.com${url}`}
      />
      <FreelancerCalculator />
    </div>
  );
}
