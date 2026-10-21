"use client";

import { useState } from "react";
import { nameMatches, parseStops, suggestApts } from "@/lib/whereToMove/bus";
import { excludedKey } from "@/lib/whereToMove/exclude";
import { MAX_BUS_ROUTES, MAX_BUS_STOPS, MAX_STOP_APTS, type BusRoute } from "@/lib/whereToMove/settings";

type Apt = { sggCd: string; dong: string; apt: string };
type Stop = BusRoute["stops"][number];
const input = "rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950";
const chip = "rounded-full border px-2 py-0.5 text-xs";
const errText = "text-xs text-rose-600 dark:text-rose-400";

/**
 * 통학버스 노선. 정류장은 붙여넣기로 넣고, 정류장마다 단지를 고른다(이름 추천은 확정하지 않는다).
 * 노선·학교는 개인 정보라 계정 설정에만 저장한다. 저장은 설정 저장 버튼으로 한다.
 */
export default function BusRoutePicker({ value, onChange, errors, complexes }: {
  value: BusRoute[]; onChange: (v: BusRoute[]) => void; errors: Record<string, string>; complexes: Apt[];
}) {
  const setRoute = (i: number, patch: Partial<BusRoute>) => onChange(value.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <section className="mb-6">
      <h2 className="mb-1 font-semibold">통학버스 노선</h2>
      <p className="mb-2 text-xs text-slate-500">
        정류장마다 단지를 골라 두면 목록에 탑승 시각과 도착까지 걸리는 시간을 보여 주고, &apos;통학버스 단지만&apos;으로 거를 수 있습니다. 최대 {MAX_BUS_ROUTES}개 노선, 노선마다 정류장 {MAX_BUS_STOPS}개.
      </p>
      {value.map((r, i) => (
        <RouteEditor key={i} route={r} index={i} errors={errors} complexes={complexes}
          onChange={(patch) => setRoute(i, patch)} onDelete={() => onChange(value.filter((_, j) => j !== i))} />
      ))}
      {value.length < MAX_BUS_ROUTES && (
        <button type="button" className="rounded-full border border-slate-300 px-3 py-1 text-sm dark:border-slate-700"
          onClick={() => onChange([...value, { label: `${value.length + 1}호차`, dest: "학교", arrive: "08:50", stops: [] }])}>
          노선 추가
        </button>
      )}
    </section>
  );
}

function RouteEditor({ route, index, errors, complexes, onChange, onDelete }: {
  route: BusRoute; index: number; errors: Record<string, string>; complexes: Apt[];
  onChange: (patch: Partial<BusRoute>) => void; onDelete: () => void;
}) {
  const [paste, setPaste] = useState("");
  const [pasteErrors, setPasteErrors] = useState<string[]>([]);
  const setStop = (j: number, patch: Partial<Stop>) => onChange({ stops: route.stops.map((st, k) => (k === j ? { ...st, ...patch } : st)) });
  const addStops = () => {
    const r = parseStops(paste);
    setPasteErrors(r.errors);
    if (!r.stops.length) return;
    // 같은 이름 정류장은 골라 둔 단지를 유지한다.
    const prev = new Map(route.stops.map((st) => [st.name, st.apts]));
    onChange({ stops: r.stops.slice(0, MAX_BUS_STOPS).map((st) => ({ ...st, apts: prev.get(st.name) ?? [] })) });
    if (!r.errors.length) setPaste("");
  };
  const errs = Object.entries(errors).filter(([k]) => k.startsWith(`busRoutes.${index}`));
  return (
    <div className="mb-3 grid gap-2 rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-800">
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="flex flex-col gap-1"><span>노선 이름</span>
          <input className={input} value={route.label} maxLength={20} onChange={(e) => onChange({ label: e.target.value })} /></label>
        <label className="flex flex-col gap-1"><span>도착지</span>
          <input className={input} value={route.dest} maxLength={20} onChange={(e) => onChange({ dest: e.target.value })} /></label>
        <label className="flex flex-col gap-1"><span>도착 시각</span>
          <input className={input} type="time" value={route.arrive} onChange={(e) => onChange({ arrive: e.target.value })} /></label>
      </div>
      <label className="flex flex-col gap-1">
        <span>정류장 붙여넣기 (한 줄에 &apos;정류장 이름 08:02&apos;, 넣으면 목록을 바꿉니다)</span>
        <textarea className={input} rows={4} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={"한강 힐스테이트 07:50\n이편한세상 2단지 07:57"} />
      </label>
      <button type="button" className="w-fit rounded-full border border-slate-300 px-3 py-1 dark:border-slate-700" onClick={addStops}>정류장 넣기</button>
      {pasteErrors.map((e) => <span key={e} className={errText}>{e}</span>)}
      {route.stops.map((st, j) => (
        <StopEditor key={`${j}-${st.name}`} stop={st} complexes={complexes}
          onChange={(patch) => setStop(j, patch)} onDelete={() => onChange({ stops: route.stops.filter((_, k) => k !== j) })} />
      ))}
      {errs.map(([k, v]) => <span key={k} className={errText}>{v}</span>)}
      <button type="button" className="text-left text-rose-600" onClick={onDelete}>노선 삭제</button>
    </div>
  );
}

function StopEditor({ stop, complexes, onChange, onDelete }: {
  stop: Stop; complexes: Apt[]; onChange: (patch: Partial<Stop>) => void; onDelete: () => void;
}) {
  const [q, setQ] = useState("");
  const chosen = new Set(stop.apts.map(excludedKey));
  const full = stop.apts.length >= MAX_STOP_APTS;
  const add = (a: Apt) => { if (!full && !chosen.has(excludedKey(a))) onChange({ apts: [...stop.apts, a] }); };
  const suggested = suggestApts(stop.name, complexes).filter((a) => !chosen.has(excludedKey(a)));
  const found = q.trim() ? complexes.filter((a) => nameMatches(q, a.apt) && !chosen.has(excludedKey(a))).slice(0, 8) : [];
  return (
    <div className="grid gap-1 rounded-lg bg-slate-50 p-2 dark:bg-slate-900">
      <div className="flex flex-wrap items-center gap-2">
        <input className={`${input} min-w-0 flex-1`} value={stop.name} maxLength={40} onChange={(e) => onChange({ name: e.target.value })} />
        <input className={`${input} w-28`} type="time" value={stop.time} onChange={(e) => onChange({ time: e.target.value })} />
        <button type="button" className="text-xs text-rose-600" onClick={onDelete}>삭제</button>
      </div>
      <div className="flex flex-wrap gap-1">
        {stop.apts.map((a) => (
          <button key={excludedKey(a)} type="button" className={`${chip} border-emerald-600 text-emerald-700 dark:text-emerald-400`}
            onClick={() => onChange({ apts: stop.apts.filter((x) => excludedKey(x) !== excludedKey(a)) })}>
            {a.apt} ({a.dong}) ✕
          </button>
        ))}
        {!stop.apts.length && <span className="text-xs text-slate-500">연결한 단지 없음</span>}
      </div>
      {!full && suggested.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-xs text-slate-500">추천</span>
          {suggested.map((a) => <button key={excludedKey(a)} type="button" className={`${chip} border-slate-300 dark:border-slate-700`} onClick={() => add(a)}>+ {a.apt} ({a.dong})</button>)}
        </div>
      )}
      {!full && (
        <>
          <input className={`${input} text-xs`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="단지 이름으로 찾기 (예: 솔터)" />
          {found.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {found.map((a) => <button key={excludedKey(a)} type="button" className={`${chip} border-slate-300 dark:border-slate-700`} onClick={() => { add(a); setQ(""); }}>+ {a.apt} ({a.dong})</button>)}
            </div>
          )}
          {q.trim() && !found.length && <span className="text-xs text-slate-500">찾는 단지가 없습니다. 설정한 동에서 거래가 있었던 단지만 나옵니다.</span>}
        </>
      )}
    </div>
  );
}
