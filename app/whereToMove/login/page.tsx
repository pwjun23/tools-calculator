import type { Metadata } from "next";
import ThemeToggle from "@/app/components/ThemeToggle";
import KakaoLoginButton from "./KakaoLoginButton";

export const metadata: Metadata = {
  title: "로그인 · 이사 어디",
  robots: { index: false, follow: false },
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; error_description?: string }> }) {
  const { error, error_description } = await searchParams;
  return (
    <main className="mx-auto flex min-h-full w-full max-w-sm flex-1 flex-col justify-center px-4">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">이사 어디</h1>
        <ThemeToggle />
      </div>
      <KakaoLoginButton />
      {error && (
        <p role="alert" className="mt-4 text-sm text-rose-600 dark:text-rose-400">
          {error_description || "로그인하지 못했습니다. 다시 시도해 주세요."}
        </p>
      )}
      <p className="mt-4 text-center text-xs text-slate-500 dark:text-slate-400">
        주간 알림을 카카오톡으로 받으려면 &apos;카카오톡 메시지 전송&apos;에 동의해 주세요.
      </p>
    </main>
  );
}
