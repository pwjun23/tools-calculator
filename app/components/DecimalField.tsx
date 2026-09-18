"use client";

import { useId } from "react";
import { INPUT_CLASS } from "./MoneyField";

export default function DecimalField({
  label,
  value,
  onChange,
  unit,
  hint,
  maxDecimals = 1,
  maxIntDigits = 3,
}: {
  label: string;
  value: string;
  onChange: (text: string) => void;
  unit: string;
  hint?: string;
  /** 허용할 소수 자릿수 */
  maxDecimals?: number;
  /** 허용할 정수 자릿수 */
  maxIntDigits?: number;
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
          inputMode="decimal"
          autoComplete="off"
          value={value}
          placeholder="0"
          onChange={(e) => {
            // 숫자와 소수점 한 개만 허용
            const cleaned = e.target.value.replace(/[^0-9.]/g, "");
            const [int, ...rest] = cleaned.split(".");
            const next =
              rest.length > 0
                ? `${int.slice(0, maxIntDigits)}.${rest.join("").slice(0, maxDecimals)}`
                : int.slice(0, maxIntDigits);
            onChange(next);
          }}
          className={`${INPUT_CLASS} py-2.5 pr-14 text-base`}
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
