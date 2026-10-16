"use client";

import { useState } from "react";
import { REGION_TREE } from "@/lib/whereToMove/regions";
import { MAX_REGIONS, type Settings } from "@/lib/whereToMove/settings";

type Regions = Settings["regions"];
const input = "rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950";
const errText = "text-xs text-rose-600 dark:text-rose-400";
const ALL_SGGS = REGION_TREE.sidos.flatMap((s) => s.sggs);
const find = (cd: string) => ALL_SGGS.find((g) => g.cd === cd);

/** 시·도 → 시·군·구를 골라 추가하고, 지역마다 읍·면·동을 체크한다. */
export default function RegionPicker({ value, onChange, errors }: { value: Regions; onChange: (v: Regions) => void; errors: Record<string, string> }) {
  const [sido, setSido] = useState(REGION_TREE.sidos.find((s) => s.cd === "41")?.cd ?? REGION_TREE.sidos[0].cd);
  const [sgg, setSgg] = useState("");
  const chosen = new Set(value.map((r) => r.sggCd));
  const sggs = (REGION_TREE.sidos.find((s) => s.cd === sido)?.sggs ?? []).filter((g) => !chosen.has(g.cd));

  const toggle = (i: number, dong: string) =>
    onChange(value.map((r, j) => (j !== i ? r : { ...r, dongs: r.dongs.includes(dong) ? r.dongs.filter((d) => d !== dong) : [...r.dongs, dong] })));
  const add = () => {
    const g = find(sgg);
    if (!g) return;
    onChange([...value, { sggCd: g.cd, label: g.label, dongs: [] }]);
    setSgg("");
  };

  return (
    <section className="mb-6">
      <h2 className="mb-2 font-semibold">지역</h2>
      {value.map((r, i) => {
        const g = find(r.sggCd);
        return (
          <div key={r.sggCd} className="mb-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
            <div className="mb-2 flex items-center justify-between">
              <strong className="text-sm">{g?.label ?? r.label}</strong>
              {value.length > 1 && (
                <button type="button" className="text-sm text-rose-600" onClick={() => onChange(value.filter((_, j) => j !== i))}>삭제</button>
              )}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {(g?.dongs ?? r.dongs).map((d) => (
                <label key={d} className="flex items-center gap-1 text-sm">
                  <input type="checkbox" checked={r.dongs.includes(d)} onChange={() => toggle(i, d)} /> {d}
                </label>
              ))}
            </div>
            {[`regions.${i}`, `regions.${i}.dongs`].map((k) => errors[k] && <p key={k} className={errText}>{errors[k]}</p>)}
          </div>
        );
      })}
      {errors.regions && <p className={`${errText} mb-2`}>{errors.regions}</p>}
      {value.length < MAX_REGIONS ? (
        <div className="flex flex-wrap gap-2">
          <select className={input} aria-label="시·도" value={sido} onChange={(e) => { setSido(e.target.value); setSgg(""); }}>
            {REGION_TREE.sidos.map((s) => <option key={s.cd} value={s.cd}>{s.name}</option>)}
          </select>
          <select className={input} aria-label="시·군·구" value={sgg} onChange={(e) => setSgg(e.target.value)}>
            <option value="">시·군·구 선택</option>
            {sggs.map((g) => <option key={g.cd} value={g.cd}>{g.name}</option>)}
          </select>
          <button type="button" disabled={!sgg} onClick={add} className="rounded-full border border-slate-300 px-3 py-1 text-sm disabled:opacity-50 dark:border-slate-700">추가</button>
        </div>
      ) : (
        <p className="text-sm text-slate-500 dark:text-slate-400">지역은 {MAX_REGIONS}개까지 고를 수 있습니다.</p>
      )}
    </section>
  );
}
