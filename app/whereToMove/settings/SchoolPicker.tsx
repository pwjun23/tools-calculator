"use client";

import { TRIP_ICON, TRIP_MODES, toggleMode, type TripMode } from "@/lib/whereToMove/commute";
import { MAX_SCHOOLS, type Settings } from "@/lib/whereToMove/settings";
import AddressSearch from "./AddressSearch";

type Schools = Settings["schools"];
const input = "rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950";
const errText = "text-xs text-rose-600 dark:text-rose-400";
const MODE_NAME: Record<TripMode, string> = { walk: "도보", shuttle: "통학차량", car: "자가용", transit: "대중교통" };

/** 아이 학교를 최대 4곳 고르고, 학교마다 보여 줄 수단을 고른다. 저장은 설정 저장 버튼으로 한다. */
export default function SchoolPicker({ value, onChange, errors }: { value: Schools; onChange: (v: Schools) => void; errors: Record<string, string> }) {
  const set = (i: number, patch: Partial<Schools[number]>) => onChange(value.map((sc, j) => (j === i ? { ...sc, ...patch } : sc)));
  return (
    <section className="mb-6">
      <h2 className="mb-1 font-semibold">학교</h2>
      <p className="mb-2 text-xs text-slate-500">목록에 학교까지 직선거리와 등하원 시간 어림값을 보여 줍니다. 최대 {MAX_SCHOOLS}곳, 학교마다 수단을 여러 개 고를 수 있습니다.</p>
      {value.map((sc, i) => (
        <div key={i} className="mb-2 grid gap-2 rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-800">
          <label className="flex flex-col gap-1">
            <span>이름 (예: 첫째 ○○초)</span>
            <input className={input} value={sc.label} maxLength={20} onChange={(e) => set(i, { label: e.target.value })} />
          </label>
          <p>{sc.address}</p>
          <div className="flex flex-wrap gap-3">
            {TRIP_MODES.map((m) => (
              <label key={m} className="flex items-center gap-1">
                <input type="checkbox" checked={sc.modes.includes(m)} onChange={() => set(i, { modes: toggleMode(sc.modes, m) })} />
                {TRIP_ICON[m]} {MODE_NAME[m]}
              </label>
            ))}
          </div>
          {Object.entries(errors).filter(([k]) => k.startsWith(`schools.${i}`)).map(([k, v]) => <span key={k} className={errText}>{v}</span>)}
          <button type="button" className="text-left text-sm text-rose-600" onClick={() => onChange(value.filter((_, j) => j !== i))}>삭제</button>
        </div>
      ))}
      {value.length < MAX_SCHOOLS && (
        <AddressSearch placeholder="학교 이름·주소 (예: 김포 ○○초등학교)"
          onPick={(c, at) => onChange([...value, { label: (c.bdNm || "학교").slice(0, 20), address: c.roadAddr, modes: ["walk"], ...(at ?? {}) }])} />
      )}
    </section>
  );
}
