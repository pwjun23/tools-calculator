"use client";

import { useState, useTransition } from "react";
import { excludedKey } from "@/lib/whereToMove/exclude";
import type { ExcludedApt } from "@/lib/whereToMove/settings";
import { setExcludedAction } from "../actions";

/** 목록에서 뺀 단지. '다시 보기'는 바로 저장된다(설정 저장 버튼과 따로). */
export default function ExcludedList({ value, onChange }: { value: ExcludedApt[]; onChange: (v: ExcludedApt[]) => void }) {
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const restore = (a: ExcludedApt) =>
    start(async () => {
      const r = await setExcludedAction(a, false);
      if (!r.ok) return setError(r.error);
      setError("");
      onChange(value.filter((x) => excludedKey(x) !== excludedKey(a)));
    });
  return (
    <section className="mb-6">
      <h2 className="mb-2 font-semibold">목록에서 뺀 단지</h2>
      {value.length === 0
        ? <p className="text-sm text-slate-500">없습니다. 목록 카드의 &apos;이 단지 빼기&apos;로 뺄 수 있습니다.</p>
        : (
          <ul className="flex flex-col gap-2 text-sm">
            {value.map((a) => (
              <li key={excludedKey(a)} className="flex items-center justify-between gap-2">
                <span>{a.dong} {a.apt}</span>
                <button type="button" disabled={pending} onClick={() => restore(a)}
                  className="rounded-full border border-slate-300 px-3 py-1 dark:border-slate-700">다시 보기</button>
              </li>
            ))}
          </ul>
        )}
      <p className="mt-2 text-xs text-slate-500">뺀 단지는 목록과 주간 카톡 건수에서 빠집니다. 임대주택 매매 신고 알림과 시세 계산에는 그대로 씁니다.</p>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </section>
  );
}
