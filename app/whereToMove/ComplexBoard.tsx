'use client';

import { useEffect, useMemo, useState } from 'react';
import { groupDongs, readBoardFilters, toggleDong } from '@/lib/whereToMove/board';
import type { BoardRow, Verdict } from '@/lib/whereToMove/complex-board';
import { sortBoard } from '@/lib/whereToMove/complex-board';
import { naverLandUrl } from '@/lib/whereToMove/links';
import { MARKET, type Market } from '@/lib/whereToMove/market';
import { man } from '@/lib/whereToMove/monthly-help';
import s from './board.module.css';

/** 단지 시세판 필터(이 브라우저에만 저장). */
const BOARD_KEY = 'wtm.board.v1';

const range = (m: Market) => `${man(m.low)}~${man(m.high)} · 중앙 ${man(m.mid)} · ${m.count}건`;
const verdict = (v: Verdict) => (v.ok ? `적합 · 월 부담 ${man(v.monthly)}` : `부적합(${v.reasons.join(', ')})`);

function badgeOf(r: BoardRow, basis: '임대' | '매매'): { text: string; cls: string } {
  if (basis === '매매') return r.buyVerdict!.ok ? { text: '매매 가능', cls: s.ok } : { text: '어려움', cls: s.no };
  return r.status === '전세 가능' ? { text: r.status, cls: s.ok } : r.status === '월세면 가능' ? { text: r.status, cls: s.maybe } : { text: '어려움', cls: s.no };
}

export default function ComplexBoard({ rows, sparse, regions, cash, convRate, onShowDeals, hasBus = false }: {
  rows: BoardRow[]; sparse: number; regions: { sggCd: string; label: string; dongs: string[] }[];
  cash: number; convRate: number; onShowDeals: (apt: string) => void; hasBus?: boolean;
}) {
  const [basis, setBasis] = useState<'임대' | '매매'>('임대');
  const [possibleOnly, setPossibleOnly] = useState(true);
  const [busOnly, setBusOnly] = useState(false);
  const [dongs, setDongs] = useState<string[]>([]);
  const [restored, setRestored] = useState(false);
  const dongGroups = useMemo(() => groupDongs(regions), [regions]);
  const multi = regions.length > 1;

  useEffect(() => {
    try {
      const f = readBoardFilters(localStorage.getItem(BOARD_KEY), dongGroups.flatMap(g => g.dongs.map(d => `${g.sggCd}:${d}`)));
      /* eslint-disable react-hooks/set-state-in-effect -- 저장된 값으로 한 번 맞춘다 */
      if (f.basis) setBasis(f.basis);
      if (f.possibleOnly !== undefined) setPossibleOnly(f.possibleOnly);
      if (f.busOnly !== undefined) setBusOnly(f.busOnly);
      if (f.dongs) setDongs(f.dongs);
    } catch { /* 저장소 사용 불가 */ }
    setRestored(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [dongGroups]);

  useEffect(() => {
    if (!restored) return;
    try { localStorage.setItem(BOARD_KEY, JSON.stringify({ basis, possibleOnly, dongs, busOnly })); } catch { /* 저장소 사용 불가 */ }
  }, [restored, basis, possibleOnly, dongs, busOnly]);

  const shown = useMemo(() => sortBoard(rows, basis).filter(r =>
    (!dongs.length || dongs.includes(`${r.sggCd}:${r.dong}`)) &&
    (!hasBus || !busOnly || !!r.bus) &&
    (!possibleOnly || (basis === '임대' ? r.status !== '어려움' : r.buyVerdict!.ok))), [rows, basis, possibleOnly, dongs, hasBus, busOnly]);

  return (
    <>
      <section className={s.filters}>
        <div className={s.row}>
          <button className={`${s.chip} ${!dongs.length ? s.on : ''}`} onClick={() => setDongs([])}>전체</button>
          {dongGroups.flatMap(g => g.dongs.map(d => {
            const v = `${g.sggCd}:${d}`;
            return <button key={v} className={`${s.chip} ${dongs.includes(v) ? s.on : ''}`} onClick={() => setDongs(cur => toggleDong(cur, v))}>{multi ? `${g.label} ${d}` : d}</button>;
          }))}
        </div>
        <div className={s.row}>
          <button className={`${s.chip} ${basis === '임대' ? s.on : ''}`} onClick={() => setBasis('임대')}>전세·월세</button>
          <button className={`${s.chip} ${basis === '매매' ? s.on : ''}`} onClick={() => setBasis('매매')}>매매</button>
          <label className={s.check}>
            <input type="checkbox" checked={possibleOnly} onChange={e => setPossibleOnly(e.target.checked)} /> 가능한 곳만
          </label>
          {hasBus && (
            <label className={s.check}>
              <input type="checkbox" checked={busOnly} onChange={e => setBusOnly(e.target.checked)} /> 통학버스 단지만
            </label>
          )}
        </div>
      </section>

      <p className={s.count}>
        {shown.length}곳 · 최근 {MARKET.months}개월 신규 계약 기준(갱신·임대주택·뺀 단지 제외)
        {sparse > 0 && ` · 거래가 ${MARKET.minCount}건 미만이라 뺀 단지·평형 ${sparse}개`}
      </p>

      <ul className={s.list}>
        {shown.map(r => {
          const b = badgeOf(r, basis);
          return (
            <li key={r.key} className={s.card}>
              <div className={s.top}>
                <a className={s.cardLink} href={naverLandUrl({ region: regions.find(g => g.sggCd === r.sggCd)?.label ?? '', dong: r.dong, apt: r.apt })} target="_blank" rel="noopener noreferrer">
                  <strong>{r.apt}</strong> <span className={s.muted}>{r.areaLabel}</span>
                </a>
                <span className={`${s.badge} ${b.cls}`}>{b.text}</span>
              </div>
              <div className={s.meta}>{multi ? `${regions.find(g => g.sggCd === r.sggCd)?.label ?? ''} ${r.dong}` : r.dong}</div>
              <div className={s.market}>
                {r.rent && <>
                  <p>신규 전세(환산) {range(r.rent)}</p>
                  <p>전세 {man(r.rent.mid)}이면: {verdict(r.jeonse!)}</p>
                  {r.wolse && <p>보증금 {man(cash)} 월세면: 월세 약 {man(r.wolse.rent)} · 월 부담 {man(r.wolse.monthly)} → {r.wolse.ok ? '적합' : `부적합(${r.wolse.reasons.join(', ')})`}</p>}
                </>}
                {r.buy && <p>매매 {range(r.buy)} → {verdict(r.buyVerdict!)}</p>}
                {r.bus?.map((t, j) => <p key={`bus${j}`}>{t}</p>)}
              </div>
              <div className={s.links}>
                <span>네이버 검색 ↗</span>
                <button type="button" className={s.exclude} onClick={() => onShowDeals(r.apt)}>이 단지 거래 보기</button>
              </div>
            </li>
          );
        })}
      </ul>
      {!shown.length && (
        <p className={s.empty}>
          조건에 맞는 단지가 없습니다.
          {possibleOnly && <><br />&apos;가능한 곳만&apos;을 풀면 가장 가까운 단지와 걸리는 조건을 볼 수 있어요.</>}
        </p>
      )}
      <p className={s.count}>월세는 전환율 연 {Math.round(convRate * 1000) / 10}%로 어림한 값입니다. 실제 매물 가격은 네이버에서 확인하세요.</p>
    </>
  );
}
