'use client';

import { useMemo, useState } from 'react';
import s from './gimpo.module.css';

export type Deal = {
  recorded: string; type: '매매' | '전세' | '월세'; dong: string; apt: string; area: number; floor: number | string;
  date: string; amount: number; rent: number; loan: number; monthly: number; margin: number; ok: boolean;
};

const TYPES = ['매매', '전세', '월세'] as const;
const SORTS = [
  { v: 'date', t: '계약일 최신순' },
  { v: 'monthly', t: '월 부담 낮은순' },
  { v: 'amount', t: '금액 낮은순' },
  { v: 'area', t: '면적 넓은순' },
] as const;

const won = (v: number) => (v >= 10000 ? `${Math.round(v / 100) / 100}억` : `${v.toLocaleString()}만`);
const price = (d: Deal) => (d.type === '월세' ? `${won(d.amount)} / ${d.rent}만` : won(d.amount));

export default function GimpoBoard({ deals, updated, error }: { deals: Deal[]; updated: string; error?: string }) {
  const [q, setQ] = useState('');
  const [dong, setDong] = useState('전체');
  const [types, setTypes] = useState<string[]>([...TYPES]);
  const [okOnly, setOkOnly] = useState(true);
  const [minArea, setMinArea] = useState('');
  const [maxMonthly, setMaxMonthly] = useState('');
  const [sort, setSort] = useState<(typeof SORTS)[number]['v']>('date');

  const dongs = useMemo(() => ['전체', ...Array.from(new Set(deals.map(d => d.dong)))], [deals]);

  const rows = useMemo(() => {
    const kw = q.replace(/\s/g, '');
    const out = deals.filter(d =>
      (dong === '전체' || d.dong === dong) &&
      types.includes(d.type) &&
      (!okOnly || d.ok) &&
      (!minArea || d.area >= Number(minArea)) &&
      (!maxMonthly || d.monthly <= Number(maxMonthly)) &&
      (!kw || d.apt.replace(/\s/g, '').includes(kw)));
    const by: Record<string, (a: Deal, b: Deal) => number> = {
      date: (a, b) => (a.date < b.date ? 1 : -1),
      monthly: (a, b) => a.monthly - b.monthly,
      amount: (a, b) => a.amount - b.amount,
      area: (a, b) => b.area - a.area,
    };
    return out.sort(by[sort]);
  }, [deals, q, dong, types, okOnly, minArea, maxMonthly, sort]);

  const toggleType = (t: string) =>
    setTypes(cur => (cur.includes(t) ? cur.filter(x => x !== t) : [...cur, t]));

  return (
    <main className={s.wrap}>
      <h1 className={s.title}>김포 실거래 모아보기</h1>
      <p className={s.sub}>구래동 · 마산동 · 양촌읍{updated && ` · 데이터 갱신 ${updated.slice(0, 16).replace('T', ' ')}`}</p>
      {error && <p className={s.error}>{error}</p>}

      <section className={s.filters}>
        <input className={s.input} placeholder="단지명 검색" value={q} onChange={e => setQ(e.target.value)} />
        <div className={s.row}>
          {dongs.map(d => (
            <button key={d} className={`${s.chip} ${dong === d ? s.on : ''}`} onClick={() => setDong(d)}>{d}</button>
          ))}
        </div>
        <div className={s.row}>
          {TYPES.map(t => (
            <button key={t} className={`${s.chip} ${types.includes(t) ? s.on : ''}`} onClick={() => toggleType(t)}>{t}</button>
          ))}
          <label className={s.check}>
            <input type="checkbox" checked={okOnly} onChange={e => setOkOnly(e.target.checked)} /> 예산 적합만
          </label>
        </div>
        <div className={s.row}>
          <input className={s.small} inputMode="numeric" placeholder="최소 면적(㎡)" value={minArea} onChange={e => setMinArea(e.target.value)} />
          <input className={s.small} inputMode="numeric" placeholder="월 부담 상한(만)" value={maxMonthly} onChange={e => setMaxMonthly(e.target.value)} />
          <select className={s.small} value={sort} onChange={e => setSort(e.target.value as typeof sort)}>
            {SORTS.map(o => <option key={o.v} value={o.v}>{o.t}</option>)}
          </select>
        </div>
      </section>

      <p className={s.count}>{rows.length}건</p>

      <ul className={s.list}>
        {rows.map((d, i) => (
          <li key={i} className={s.card}>
            <div className={s.top}>
              <strong>{d.apt}</strong>
              <span className={`${s.badge} ${d.ok ? s.ok : s.no}`}>{d.ok ? '적합' : '부적합'}</span>
            </div>
            <div className={s.meta}>{d.dong} · {d.type} · {d.area}㎡ · {d.floor}층 · {d.date}</div>
            <div className={s.nums}>
              <span className={s.price}>{price(d)}</span>
              <span>월 부담 <b>{d.monthly}만</b></span>
              <span className={d.margin >= 0 ? s.plus : s.minus}>여유 {d.margin >= 0 ? '+' : ''}{d.margin}만</span>
            </div>
          </li>
        ))}
      </ul>
      {!rows.length && !error && <p className={s.empty}>조건에 맞는 거래가 없습니다.</p>}
    </main>
  );
}
