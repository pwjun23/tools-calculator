"use client";

import type { Settings } from "@/lib/whereToMove/settings";
import AddressSearch from "./AddressSearch";

type Workplaces = Settings["workplaces"];
const input = "rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950";
const errText = "text-xs text-rose-600 dark:text-rose-400";

/** 직장 주소를 도로명주소 API로 검색해 고른다. 저장은 설정 저장 버튼으로 한다. */
export default function WorkplacePicker({ value, onChange, errors }: { value: Workplaces; onChange: (v: Workplaces) => void; errors: Record<string, string> }) {
  const wp = value[0];
  return (
    <section className="mb-6">
      <h2 className="mb-1 font-semibold">직장</h2>
      <p className="mb-2 text-xs text-slate-500">목록에 직장까지 직선거리와 통근 시간 어림값을 보여 줍니다. 주소는 이 설정에만 저장됩니다.</p>
      {wp ? (
        <div className="mb-2 grid gap-2 rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-800">
          <label className="flex flex-col gap-1">
            <span>이름</span>
            <input className={input} value={wp.label} maxLength={20} onChange={(e) => onChange([{ ...wp, label: e.target.value }])} />
          </label>
          <p>{wp.address}</p>
          {Object.entries(errors).filter(([k]) => k.startsWith("workplaces")).map(([k, v]) => <span key={k} className={errText}>{v}</span>)}
          <button type="button" className="text-left text-sm text-rose-600" onClick={() => onChange([])}>삭제</button>
        </div>
      ) : null}
      <AddressSearch placeholder={wp ? "다른 주소로 바꾸기 (도로명·건물 이름)" : "도로명·건물 이름 (예: 사우중로 1)"}
        onPick={(c, at) => onChange([{ label: wp?.label ?? "직장", address: c.roadAddr, ...(at ?? {}) }])} />
    </section>
  );
}
