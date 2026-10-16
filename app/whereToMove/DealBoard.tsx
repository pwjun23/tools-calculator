'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/whereToMove/auth-client';
import { groupDongs, toggleDong } from '@/lib/whereToMove/board';
import { TRIP_ICON, TRIP_MODES, commuteHelp, kakaoRouteUrl, kmLabel, parseTripChoice, passesTrip, tripChoices, type LatLng, type Place, type Trip } from '@/lib/whereToMove/commute';
import { umdOf } from '@/lib/whereToMove/judge';
import ThemeToggle from '@/app/components/ThemeToggle';
import s from './board.module.css';

export type Deal = {
  recorded: string; type: '매매' | '전세' | '월세'; sggCd: string; region: string; dong: string; apt: string; area: number; floor: number | string;
  date: string; amount: number; rent: number; loan: number; monthly: number; margin: number; ok: boolean;
  reason?: string;
  trips?: (Trip & { id: string })[] | null;
  pos?: LatLng;
  site?: 'ok' | 'pending' | 'notfound';
};

const TYPES = ['매매', '전세', '월세'] as const;
const SORTS = [
  { v: 'date', t: '계약일 최신순' },
  { v: 'monthly', t: '월 부담 낮은순' },
  { v: 'amount', t: '금액 낮은순' },
  { v: 'area', t: '면적 넓은순' },
] as const;

const won = (v: number) => (v >= 10000 ? `${Math.round(v / 100) / 100}억` : `${v.toLocaleString()}만`);
// 실거래 API에는 단지 번호가 없어 단지명 검색으로 연결한다. 네이버 검색은 맨 위에 네이버 부동산 단지 카드가 뜬다.
const naverUrl = (d: Deal) => `https://m.search.naver.com/search.naver?query=${encodeURIComponent(`${d.region} ${d.dong} ${d.apt}`)}`;
const hogangUrl = (d: Deal) => `https://hogangnono.com/search?q=${encodeURIComponent(`${d.region} ${d.dong} ${d.apt}`)}`;
const HELP = commuteHelp();

/** 누르면 펼치고 다시 누르면 닫는 설명. 카드 전체 링크(::after) 위에 오도록 z-index 를 준다. */
function CommuteInfo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={s.info} aria-expanded={open} aria-label="통근 시간 계산 방법" onClick={() => setOpen(o => !o)}>ⓘ</button>
      {open && <div className={s.help}>{HELP.map((t, i) => <p key={i}>{t}</p>)}</div>}
    </>
  );
}

const price = (d: Deal) => (d.type === '월세' ? `${won(d.amount)} / ${d.rent}만` : won(d.amount));

/** 한 장소 줄: `가상초 1.2km · 🚶 약 20~25분 · 🚌 약 10~15분`. */
const tripLine = (p: Place, t: Trip) =>
  [`${p.label} ${kmLabel(t.km)}`, ...TRIP_MODES.filter(m => t.times[m]).map(m => `${TRIP_ICON[m]} 약 ${t.times[m]![0]}~${t.times[m]![1]}분`)].join(' · ');

/** 길찾기 링크. 직장은 대중교통·자동차, 학교는 도보를 골랐으면 도보, 아니면 자동차. */
const routeLinks = (p: Place): { by: 'traffic' | 'car' | 'walk'; text: string }[] =>
  p.kind === 'work'
    ? [{ by: 'traffic', text: '🚇 길찾기' }, { by: 'car', text: '🚗 길찾기' }]
    : [{ by: p.modes.includes('walk') ? 'walk' : 'car', text: `${p.label} 길찾기` }];

export default function DealBoard({ deals, regions, notice, places = [] }: {
  deals: Deal[]; regions: { sggCd: string; label: string; dongs: string[] }[]; notice?: { text: string; relogin: boolean };
  places?: Place[];
}) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [dongs, setDongs] = useState<string[]>([]); // 'sggCd:동' 목록. 비어 있으면 전체.
  const [types, setTypes] = useState<string[]>(['전세']); // 처음에는 전세만 보여 준다.
  const [okOnly, setOkOnly] = useState(true);
  const [minArea, setMinArea] = useState('');
  const [maxMonthly, setMaxMonthly] = useState('');
  const [sort, setSort] = useState<(typeof SORTS)[number]['v']>('date');
  const [commute, setCommute] = useState('off');

  const dongGroups = useMemo(() => groupDongs(regions), [regions]);
  const multi = regions.length > 1;

  const choice = useMemo(() => parseTripChoice(commute, places), [commute, places]);
  const rows = useMemo(() => {
    const kw = q.replace(/\s/g, '');
    const out = deals.filter(d =>
      (!dongs.length || dongs.includes(`${d.sggCd}:${umdOf(d.dong)}`)) &&
      types.includes(d.type) &&
      (!okOnly || d.ok) &&
      (!minArea || d.area >= Number(minArea)) &&
      (!maxMonthly || d.monthly <= Number(maxMonthly)) &&
      passesTrip(d.trips ?? null, choice) &&
      (!kw || d.apt.replace(/\s/g, '').includes(kw)));
    const by: Record<string, (a: Deal, b: Deal) => number> = {
      date: (a, b) => (a.date < b.date ? 1 : -1),
      monthly: (a, b) => a.monthly - b.monthly,
      amount: (a, b) => a.amount - b.amount,
      area: (a, b) => b.area - a.area,
    };
    return out.sort(by[sort]);
  }, [deals, q, dongs, types, okOnly, minArea, maxMonthly, choice, sort]);

  const toggleType = (t: string) =>
    setTypes(cur => (cur.includes(t) ? cur.filter(x => x !== t) : [...cur, t]));

  return (
    <main className={s.wrap}>
      <header className={s.head}>
        <h1 className={s.title}>이사 어디</h1>
        <div className={s.tools}>
          <Link className={s.chip} href="/whereToMove/settings">설정</Link>
          <button type="button" className={s.chip} onClick={() => authClient.signOut().then(() => router.replace('/whereToMove/login'))}>로그아웃</button>
          <ThemeToggle />
        </div>
      </header>
      {notice && (
        <div className={s.error}>
          <p>{notice.text}</p>
          {notice.relogin && (
            <button type="button" className={s.chip} onClick={() => authClient.signIn.social({ provider: 'kakao', callbackURL: '/whereToMove' })}>
              카카오로 다시 로그인
            </button>
          )}
        </div>
      )}

      <section className={s.filters}>
        <input className={s.input} placeholder="단지명 검색" value={q} onChange={e => setQ(e.target.value)} />
        <div className={s.row}>
          <button className={`${s.chip} ${!dongs.length ? s.on : ''}`} onClick={() => setDongs([])}>전체</button>
          {!multi && dongGroups[0]?.dongs.map(d => {
            const v = `${dongGroups[0].sggCd}:${d}`;
            return <button key={v} className={`${s.chip} ${dongs.includes(v) ? s.on : ''}`} onClick={() => setDongs(cur => toggleDong(cur, v))}>{d}</button>;
          })}
        </div>
        {multi && dongGroups.map(g => (
          <div key={g.sggCd} className={s.row}>
            <span className={s.muted}>{g.label}</span>
            {g.dongs.map(d => {
              const v = `${g.sggCd}:${d}`;
              return <button key={v} className={`${s.chip} ${dongs.includes(v) ? s.on : ''}`} onClick={() => setDongs(cur => toggleDong(cur, v))}>{d}</button>;
            })}
          </div>
        ))}
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
        {places.length > 0 && (
          <div className={s.row}>
            <span className={s.muted}>통근·통학</span>
            <select className={s.small} value={choice ? commute : 'off'} onChange={e => setCommute(e.target.value)}>
              <option value="off">전체</option>
              {tripChoices(places).map(g => (
                <optgroup key={g.id} label={g.label}>
                  {g.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </optgroup>
              ))}
            </select>
            <CommuteInfo />
          </div>
        )}
      </section>

      <p className={s.count}>{rows.length}건</p>

      <ul className={s.list}>
        {rows.map((d, i) => (
          <li key={i} className={s.card}>
            <div className={s.top}>
              <a className={s.cardLink} href={naverUrl(d)} target="_blank" rel="noopener noreferrer">
                <strong>{d.apt}</strong>
              </a>
              <span className={`${s.badge} ${d.ok ? s.ok : s.no}`}>{d.ok ? '적합' : '부적합'}</span>
            </div>
            <div className={s.meta}>{multi ? `${d.region} ${d.dong}` : d.dong} · {d.type} · {d.area}㎡ · {d.floor}층 · {d.date}</div>
            <div className={s.nums}>
              <span className={s.price}>{price(d)}</span>
              <span>월 부담 <b>{d.monthly}만</b></span>
              {/* 여유는 월 예산만 본 값이다. 부적합이면 대출 조건에 걸렸을 수 있으므로 초록색을 쓰지 않는다. */}
              {d.margin >= 0
                ? <span className={d.ok ? s.plus : s.muted}>월 예산 여유 +{d.margin}만</span>
                : <span className={s.minus}>월 예산 초과 {Math.abs(d.margin)}만</span>}
            </div>
            {places.length > 0 && (d.trips
              ? places.map((p, j) => {
                  const t = d.trips!.find(x => x.id === p.id);
                  return t && (
                    <div key={p.id} className={s.commute}>
                      <span>{tripLine(p, t)}</span>
                      {j === 0 && <CommuteInfo />}
                    </div>
                  );
                })
              : (
                <div className={s.commute}>
                  <span className={s.muted}>{places.length === 1 ? `${places[0].label}까지` : '직장·학교까지'} 거리: {d.site === 'notfound' ? '위치 확인 안 됨' : '위치 확인 중'}</span>
                  <CommuteInfo />
                </div>
              ))}
            {!d.ok && (
              <p className={s.reason}>
                부적합 사유: {d.reason || '조건 미달'}
                {d.loan > 0 && ` · 필요 대출 ${won(d.loan)}(금액의 ${Math.round((d.loan / d.amount) * 100)}%)`}
              </p>
            )}
            <div className={s.links}>
              <span>네이버 부동산 ↗</span>
              <a href={hogangUrl(d)} target="_blank" rel="noopener noreferrer">호갱노노 ↗</a>
              {d.pos && places.flatMap(p => routeLinks(p).map(r => (
                <a key={`${p.id}-${r.by}`} href={kakaoRouteUrl(r.by, { name: d.apt, ...d.pos! }, { name: p.label, lat: p.lat, lng: p.lng })} target="_blank" rel="noopener noreferrer">{r.text} ↗</a>
              )))}
            </div>
          </li>
        ))}
      </ul>
      {!rows.length && (
        <p className={s.empty}>
          조건에 맞는 거래가 없습니다.
          {okOnly && <><br />&apos;예산 적합만&apos;을 풀면 부적합 거래와 사유를 볼 수 있어요.</>}
        </p>
      )}
    </main>
  );
}
