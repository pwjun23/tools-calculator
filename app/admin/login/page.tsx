"use client";

import { useActionState } from "react";
import { login } from "./actions";

const initialState: { error?: string } = {};

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(
    async (_prev: typeof initialState, formData: FormData) => login(formData),
    initialState,
  );

  return (
    <main className="mx-auto flex min-h-full max-w-sm flex-1 flex-col justify-center px-4">
      <h1 className="mb-6 text-xl font-bold">관리자 로그인</h1>
      <form action={formAction} className="space-y-4">
        <input
          type="password"
          name="password"
          autoFocus
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
      </form>
    </main>
  );
}
