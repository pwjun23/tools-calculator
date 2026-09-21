"use client";

import { useId, useState } from "react";

export default function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  formatValue,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (n: number) => void;
  /** 값 표시 형식을 바꾸고 싶을 때 (기본: 천단위 콤마) */
  formatValue?: (n: number) => string;
}) {
  const id = useId();
  const format = formatValue ?? ((n: number) => n.toLocaleString("en-US"));

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState("");

  function startEditing() {
    setDraft(String(value));
    setIsEditing(true);
  }

  function commit() {
    const parsed = parseFloat(draft);
    if (Number.isFinite(parsed)) {
      onChange(Math.min(max, Math.max(min, parsed)));
    }
    setIsEditing(false);
  }

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        {isEditing ? (
          <input
            type="text"
            inputMode="decimal"
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value.replace(/[^0-9.-]/g, ""))}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") setIsEditing(false);
            }}
            className="w-28 rounded-full border border-emerald-300 bg-white px-2.5 py-0.5 text-right text-sm font-semibold tabular-nums text-emerald-700 outline-none focus:border-emerald-500 dark:border-emerald-700 dark:bg-slate-950 dark:text-emerald-300"
          />
        ) : (
          <button
            type="button"
            onClick={startEditing}
            aria-label={`${label} 값 직접 입력`}
            className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-sm font-semibold tabular-nums text-emerald-700 transition hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-900/50"
          >
            {format(value)}
          </button>
        )}
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-emerald-600"
      />
      <div className="mt-1 flex justify-between text-xs text-slate-500 dark:text-slate-400">
        <span>{format(min)}</span>
        <span>{format(max)}</span>
      </div>
    </div>
  );
}
