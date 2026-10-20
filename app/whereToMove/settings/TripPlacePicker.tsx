"use client";

import { TRIP_ICON, TRIP_MODES, toggleMode, type TripMode } from "@/lib/whereToMove/commute";
import { MAX_PLACES, MAX_SCHOOLS, PLACE_MODES, type Settings } from "@/lib/whereToMove/settings";
import AddressSearch from "./AddressSearch";

type Item = Settings["schools"][number] | Settings["places"][number];
const input = "rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950";
const errText = "text-xs text-rose-600 dark:text-rose-400";
const MODE_NAME: Record<TripMode, string> = { walk: "도보", shuttle: "통학차량", car: "자가용", transit: "대중교통" };

/** 학교·자주 가는 곳의 화면 차이. */
const KINDS = {
  schools: {
    title: "학교",
    desc: `목록에 학교까지 직선거리와 등하원 시간 어림값을 보여 줍니다. 최대 ${MAX_SCHOOLS}곳, 학교마다 수단을 여러 개 고를 수 있습니다.`,
    max: MAX_SCHOOLS, modes: TRIP_MODES, first: ["walk"] as TripMode[], fallback: "학교",
    name: "이름 (예: 첫째 ○○초)", search: "학교 이름·주소 (예: 김포 ○○초등학교)",
  },
  places: {
    title: "자주 가는 곳",
    desc: `교회처럼 자주 가는 곳까지 직선거리와 이동 시간 어림값을 보여 줍니다. 최대 ${MAX_PLACES}곳, 장소마다 수단을 여러 개 고를 수 있습니다.`,
    max: MAX_PLACES, modes: TRIP_MODES.filter((m) => (PLACE_MODES as readonly string[]).includes(m)), first: ["car"] as TripMode[], fallback: "자주 가는 곳",
    name: "이름 (예: ○○교회)", search: "장소 이름·주소 (예: 김포 ○○교회)",
  },
} as const;

/** 학교·자주 가는 곳을 고르고, 장소마다 보여 줄 수단을 고른다. 저장은 설정 저장 버튼으로 한다. */
export default function TripPlacePicker<T extends Item>({ kind, value, onChange, errors }: {
  kind: keyof typeof KINDS; value: T[]; onChange: (v: T[]) => void; errors: Record<string, string>;
}) {
  const k = KINDS[kind];
  const set = (i: number, patch: Partial<Item>) => onChange(value.map((sc, j) => (j === i ? ({ ...sc, ...patch } as T) : sc)));
  return (
    <section className="mb-6">
      <h2 className="mb-1 font-semibold">{k.title}</h2>
      <p className="mb-2 text-xs text-slate-500">{k.desc}</p>
      {value.map((sc, i) => (
        <div key={i} className="mb-2 grid gap-2 rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-800">
          <label className="flex flex-col gap-1">
            <span>{k.name}</span>
            <input className={input} value={sc.label} maxLength={20} onChange={(e) => set(i, { label: e.target.value })} />
          </label>
          <p>{sc.address}</p>
          <div className="flex flex-wrap gap-3">
            {k.modes.map((m) => (
              <label key={m} className="flex items-center gap-1">
                <input type="checkbox" checked={(sc.modes as TripMode[]).includes(m)} onChange={() => set(i, { modes: toggleMode(sc.modes as TripMode[], m) as T["modes"] })} />
                {TRIP_ICON[m]} {MODE_NAME[m]}
              </label>
            ))}
          </div>
          {Object.entries(errors).filter(([e]) => e.startsWith(`${kind}.${i}`)).map(([e, v]) => <span key={e} className={errText}>{v}</span>)}
          <button type="button" className="text-left text-sm text-rose-600" onClick={() => onChange(value.filter((_, j) => j !== i))}>삭제</button>
        </div>
      ))}
      {value.length < k.max && (
        <AddressSearch placeholder={k.search}
          onPick={(c, at) => onChange([...value, { label: (c.bdNm || k.fallback).slice(0, 20), address: c.roadAddr, modes: k.first, ...(at ?? {}) } as T])} />
      )}
    </section>
  );
}
