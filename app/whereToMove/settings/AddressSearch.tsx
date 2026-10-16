"use client";

import { useState, useTransition } from "react";
import type { JusoCandidate } from "@/lib/whereToMove/juso";
import { locateCandidateAction, searchAddressAction } from "./actions";

const input = "rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950";
const errText = "text-xs text-rose-600 dark:text-rose-400";

/**
 * 도로명주소 API로 주소를 찾아 고른다(직장·학교 공용).
 * 좌표 API를 못 쓰는 동안(임시 카카오 방식)에는 at 이 비어 있다.
 */
export default function AddressSearch({ placeholder, onPick }: {
  placeholder: string;
  onPick: (c: JusoCandidate, at: { lat: number; lng: number } | null) => void;
}) {
  const [kw, setKw] = useState("");
  const [list, setList] = useState<JusoCandidate[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, start] = useTransition();

  const search = () => start(async () => {
    setMsg("");
    const r = await searchAddressAction(kw);
    if (r.ok) setList(r.candidates); else { setList([]); setMsg(r.error); }
  });
  const pick = (c: JusoCandidate) => start(async () => {
    const r = await locateCandidateAction(c);
    if (!r.ok) { setMsg(r.error); return; }
    onPick(c, r.lat !== undefined && r.lng !== undefined ? { lat: r.lat, lng: r.lng } : null);
    setList([]); setKw(""); setMsg("");
  });

  return (
    <>
      <div className="flex gap-2">
        <input className={`${input} flex-1`} placeholder={placeholder} value={kw}
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
    </>
  );
}
