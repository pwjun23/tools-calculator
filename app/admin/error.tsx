"use client";

export default function AdminError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-full max-w-sm flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-lg font-bold">문제가 발생했습니다</h1>
      <p className="text-sm text-slate-600 dark:text-slate-400">{error.message}</p>
      <button
        type="button"
        onClick={retry}
        className="rounded-xl bg-emerald-600 px-4 py-2 font-semibold text-white"
      >
        다시 시도
      </button>
    </main>
  );
}
