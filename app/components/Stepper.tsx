"use client";

export default function Stepper({
  label,
  hint,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  const btn =
    "flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 text-xl leading-none transition enabled:hover:bg-slate-100 disabled:opacity-30 dark:border-slate-700 dark:enabled:hover:bg-slate-800";
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">{label}</span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label={`${label} 줄이기`}
            disabled={value <= min}
            onClick={() => onChange(value - 1)}
            className={btn}
          >
            −
          </button>
          <span
            aria-live="polite"
            className="w-6 text-center text-lg font-semibold tabular-nums"
          >
            {value}
          </span>
          <button
            type="button"
            aria-label={`${label} 늘리기`}
            disabled={value >= max}
            onClick={() => onChange(value + 1)}
            className={btn}
          >
            +
          </button>
        </div>
      </div>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>
    </div>
  );
}
