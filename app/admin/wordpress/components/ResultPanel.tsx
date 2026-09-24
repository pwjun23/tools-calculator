"use client";

export type ActionResult =
  | { ok: true; id: number; url: string; status: string }
  | { ok: false; error: string }
  | null;

export function ResultPanel({ result }: { result: ActionResult }) {
  if (!result) return null;

  if (!result.ok) {
    return (
      <p role="alert" className="mt-3 rounded-lg bg-rose-100 px-3 py-2 text-sm text-rose-900 dark:bg-rose-900/30 dark:text-rose-200">
        ✗ {result.error}
      </p>
    );
  }

  return (
    <p className="mt-3 rounded-lg bg-emerald-100 px-3 py-2 text-sm text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200">
      ✓ 성공 — id {result.id}, 상태 {result.status}.{" "}
      <a href={result.url} target="_blank" rel="noreferrer" className="underline">
        {result.url}
      </a>
    </p>
  );
}
