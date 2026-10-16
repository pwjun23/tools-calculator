"use client";

import { useState, useTransition } from "react";
import type { JusoCandidate } from "@/lib/whereToMove/juso";
import type { Settings } from "@/lib/whereToMove/settings";
import { locateCandidateAction, searchAddressAction } from "./actions";

type Workplaces = Settings["workplaces"];
const input = "rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950";
const errText = "text-xs text-rose-600 dark:text-rose-400";

/** 직장 주소를 도로명주소 API로 검색해 고른다. 저장은 설정 저장 버튼으로 한다. */
export default function WorkplacePicker({ value, onChange, errors }: { value: Workplaces; onChange: (v: Workplaces) => void; errors: Record<string, string> }) {
  const [kw, setKw] = useState("");
  const [list, setList] = useState<JusoCandidate[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, start] = useTransition();
  const wp = value[0];

  const search = () => start(async () => {
    setMsg("");
    const r = await searchAddressAction(kw);
    if (r.ok) setList(r.candidates); else { setList([]); setMsg(r.error); }
  });
  const pick = (c: JusoCandidate) => start(async () => {
    const r = await locateCandidateAction(c);
    if (!r.ok) { setMsg(r.error); return; }
    const at = r.lat !== undefined && r.lng !== undefined ? { lat: r.lat, lng: r.lng } : {};
    onChange([{ label: wp?.label ?? "직장", address: c.roadAddr, ...at }]);
    setList([]); setKw(""); setMsg("");
  });

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
      <div className="flex gap-2">
        <input className={`${input} flex-1`} placeholder={wp ? "다른 주소로 바꾸기 (도로명·건물 이름)" : "도로명·건물 이름 (예: 사우중로 1)"} value={kw}
          onChange={(e) => setKw(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); search(); } }} />
        <button type="button" disabled={busy} onClick={search} className="rounded-lg border border-slate-300 px-3 text-sm disabled:opacity-50 dark:border-slate-700">
          {busy ? "찾는 중" : "검색"}
        </button>
      </div>
      {msg && <p className={`mt-1 ${errText}`}>{msg}</p>}
      {list.length > 0 && (
        <ul className="mt-2 divide-y divide-slate-200 rounded-xl border border-slate-200 text-sm dark:divide-slate-800 dark:border-slate-800">
          {list.map((c, i) => (
            <li key={i}>
              <button type="button" disabled={busy} className="w-full px-3 py-2 text-left disabled:opacity-50" onClick={() => pick(c)}>
                <span className="block">{c.roadAddr}{c.bdNm ? ` (${c.bdNm})` : ""}</span>
                <span className="block text-xs text-slate-500">{c.jibunAddr}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
