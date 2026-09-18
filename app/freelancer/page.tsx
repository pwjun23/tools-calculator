import type { Metadata } from "next";
import FreelancerCalculator from "./components/FreelancerCalculator";

export const metadata: Metadata = {
  title: "프리랜서 실수령액 계산기",
  description: "계약금액과 실수령액을 3.3% 원천징수 기준으로 계산해요.",
};

export default function FreelancerPage() {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-zinc-50 px-4 py-16 dark:bg-zinc-950">
      <FreelancerCalculator />
    </div>
  );
}
