"use client";

import { useActionState } from "react";
import ThemeToggle from "@/app/components/ThemeToggle";
import { login } from "./actions";

const initialState: { error?: string } = {};

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(
    async (_prev: typeof initialState, formData: FormData) => login(formData),
    initialState,
  );

  return (
    <main className="mx-auto flex min-h-full w-full max-w-sm flex-1 flex-col justify-center px-4">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">김포 실거래 모아보기</h1>
        <ThemeToggle />
      </div>
      <form action={formAction} className="space-y-4">
        <input
          type="text"
          name="user"
          autoComplete="username"
          autoCapitalize="none"
          required
          placeholder="아이디"
          className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-950"
        />
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          placeholder="비밀번호"
          className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-950"
        />
        {state.error && (
          <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
            {state.error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-xl bg-emerald-600 py-3 font-semibold text-white disabled:opacity-50"
        >
          {pending ? "확인 중..." : "로그인"}
        </button>
        <p className="text-center text-xs text-slate-500 dark:text-slate-400">
          로그인하면 이 기기에서 180일 동안 유지됩니다.
        </p>
      </form>
    </main>
  );
}
