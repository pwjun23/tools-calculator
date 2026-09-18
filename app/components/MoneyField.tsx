"use client";

import { useId } from "react";

const MAX_AMOUNT = 10_000_000_000;

export const INPUT_CLASS =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-right text-lg font-semibold tabular-nums outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 dark:border-slate-700 dark:bg-slate-950";

export default function MoneyField({
  label,
  value,
  onChange,
  hint,
  compact,
  unit = "원",
  max = MAX_AMOUNT,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  hint?: string;
  compact?: boolean;
  /** 입력창 오른쪽에 표시할 단위 */
  unit?: string;
  max?: number;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={value > 0 ? value.toLocaleString("en-US") : ""}
          placeholder="0"
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, "");
            onChange(Math.min(Number(digits || 0), max));
          }}
          className={`${INPUT_CLASS} pr-12 ${compact ? "py-2.5 text-base" : ""}`}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-slate-500"
        >
          {unit}
        </span>
      </div>
      {hint && (
        <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
          {hint}
        </p>
      )}
    </div>
  );
}
