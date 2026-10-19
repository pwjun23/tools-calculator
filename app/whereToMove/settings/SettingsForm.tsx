"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import ThemeToggle from "@/app/components/ThemeToggle";
import { deriveParams, priceLimits } from "@/lib/whereToMove/judge";
import type { Loan, Settings } from "@/lib/whereToMove/settings";
import { saveSettingsAction } from "./actions";
import RegionPicker from "./RegionPicker";
import WorkplacePicker from "./WorkplacePicker";
import SchoolPicker from "./SchoolPicker";
import ExcludedList from "./ExcludedList";

type NumKey = { [K in keyof Settings]: Settings[K] extends number ? K : never }[keyof Settings];
type Unit = "만원" | "%" | "년" | "㎡";

const SECTIONS: { title: string; fields: { key: NumKey; label: string; unit: Unit }[] }[] = [
  { title: "기본", fields: [
    { key: "cash", label: "이사 시점 현금", unit: "만원" },
    { key: "monthlyBudget", label: "월 총 예산 (관리비 포함)", unit: "만원" },
    { key: "monthlyMgmt", label: "예상 월 관리비", unit: "만원" },
    { key: "minArea", label: "최소 전용면적 (0이면 제한 없음)", unit: "㎡" },
  ] },
  { title: "매매", fields: [
    { key: "mortgageRate", label: "주담대 금리 (연)", unit: "%" },
    { key: "mortgageYears", label: "상환 기간 (원리금균등)", unit: "년" },
    { key: "ltvBuy", label: "매매 대출 비율 (LTV)", unit: "%" },
    { key: "buyFeeRate", label: "부대비용 (취득세·중개 등)", unit: "%" },
    { key: "mortgageCap", label: "주담대 최대 금액", unit: "만원" },
  ] },
  { title: "전세·보증금", fields: [
    { key: "rentLoanRate", label: "대출 금리 (연)", unit: "%" },
    { key: "ltvRent", label: "대출 비율", unit: "%" },
    { key: "rentLoanCap", label: "보증기관 한도", unit: "만원" },
    { key: "rentConvRate", label: "월세 전환율 (연, 시세 비교용)", unit: "%" },
  ] },
  { title: "소득·DSR", fields: [
    { key: "annualIncome", label: "연 소득 (0이면 DSR 계산 안 함)", unit: "만원" },
    { key: "dsrRatio", label: "DSR 한도 비율", unit: "%" },
  ] },
];

const toView = (v: number, unit: Unit) => (unit === "%" ? Math.round(v * 10000) / 100 : v);
const fromView = (v: number, unit: Unit) => (unit === "%" ? v / 100 : v);
const fmt = (v: number) => (v >= 1e8 ? "제한 없음" : `${Math.round(v * 10) / 10}`);
const input = "w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950";

export default function SettingsForm({ initial, initialNotify }: { initial: Settings; initialNotify: boolean }) {
  const [s, setS] = useState<Settings>(initial);
  const [notify, setNotify] = useState(initialNotify);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [collecting, setCollecting] = useState(false);
  const [pending, start] = useTransition();

  const derived = useMemo(() => deriveParams(s), [s]);
  const limits = useMemo(() => priceLimits(derived), [derived]);

  const setNum = (key: NumKey, unit: Unit, raw: string) => {
    setSaved(false);
    setS({ ...s, [key]: raw === "" ? 0 : fromView(Number(raw), unit) });
  };
  const setLoan = (i: number, patch: Partial<Loan>) => {
    setSaved(false);
    setS({ ...s, loans: s.loans.map((l, j) => (j === i ? { ...l, ...patch } : l)) });
  };
  const setHome = (patch: Partial<Settings["ownedHome"]>) => {
    setSaved(false);
    setS({ ...s, ownedHome: { ...s.ownedHome, ...patch } });
  };

  const save = () =>
    start(async () => {
      const r = await saveSettingsAction({ data: s, notifyEnabled: notify });
      if (r.ok) { setErrors({}); setSaved(true); setCollecting(r.collecting); } else { setErrors(r.errors); setSaved(false); }
    });

  const err = (path: string) => errors[path] && <span className="text-xs text-rose-600 dark:text-rose-400">{errors[path]}</span>;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
      <header className="mb-6 flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold">설정</h1>
        <div className="flex items-center gap-2">
          <Link href="/whereToMove" className="rounded-full border border-slate-300 px-3 py-1 text-sm dark:border-slate-700">목록</Link>
          <ThemeToggle />
        </div>
      </header>

      <RegionPicker value={s.regions} errors={errors} onChange={(regions) => { setSaved(false); setS({ ...s, regions }); }} />
      <WorkplacePicker value={s.workplaces} errors={errors} onChange={(workplaces) => { setSaved(false); setS({ ...s, workplaces }); }} />
      <SchoolPicker value={s.schools} errors={errors} onChange={(schools) => { setSaved(false); setS({ ...s, schools }); }} />

      {SECTIONS.map((sec) => (
        <section key={sec.title} className="mb-6">
          <h2 className="mb-2 font-semibold">{sec.title}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {sec.fields.map((f) => (
              <label key={f.key} className="flex flex-col gap-1 text-sm">
                <span>{f.label} ({f.unit})</span>
                <input className={input} type="number" inputMode="decimal" step="any"
                  value={toView(s[f.key], f.unit)} onChange={(e) => setNum(f.key, f.unit, e.target.value)} />
                {err(f.key)}
              </label>
            ))}
          </div>
        </section>
      ))}

      <section className="mb-6">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={s.excludeRenewal} onChange={(e) => { setSaved(false); setS({ ...s, excludeRenewal: e.target.checked }); }} />
          갱신 계약 제외
        </label>
      </section>

      <ExcludedList value={s.excludedApts} onChange={(excludedApts) => setS({ ...s, excludedApts })} />

      <section className="mb-6">
        <h2 className="mb-2 font-semibold">기존 대출</h2>
        {s.loans.map((l, i) => (
          <div key={i} className="mb-3 grid gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-3 dark:border-slate-800">
            <input className={input} placeholder="이름" value={l.name} onChange={(e) => setLoan(i, { name: e.target.value })} />
            <input className={input} type="number" placeholder="잔액(만원)" value={l.balance} onChange={(e) => setLoan(i, { balance: Number(e.target.value) })} />
            <input className={input} type="number" step="any" placeholder="금리(%)" value={toView(l.rate, "%")} onChange={(e) => setLoan(i, { rate: fromView(Number(e.target.value), "%") })} />
            <input className={input} type="number" step="any" placeholder="잔여 기간(년)" value={l.years} onChange={(e) => setLoan(i, { years: Number(e.target.value) })} />
            <select className={input} value={l.repayment} onChange={(e) => setLoan(i, { repayment: e.target.value as Loan["repayment"] })}>
              <option value="amortizing">원리금균등</option>
              <option value="bullet">만기일시 (이자만)</option>
            </select>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={l.repaidIfHomeSold} onChange={(e) => setLoan(i, { repaidIfHomeSold: e.target.checked })} />
              보유 주택 팔면 갚음
            </label>
            {err(`loans.${i}.name`)}{err(`loans.${i}.years`)}
            <button type="button" className="text-left text-sm text-rose-600" onClick={() => { setSaved(false); setS({ ...s, loans: s.loans.filter((_, j) => j !== i) }); }}>삭제</button>
          </div>
        ))}
        <button type="button" className="rounded-full border border-slate-300 px-3 py-1 text-sm dark:border-slate-700"
          onClick={() => { setSaved(false); setS({ ...s, loans: [...s.loans, { name: "", balance: 0, rate: 0.04, years: 10, repayment: "amortizing", repaidIfHomeSold: false }] }); }}>
          대출 추가
        </button>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 font-semibold">보유 주택</h2>
        <label className="mb-2 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={s.ownedHome.has} onChange={(e) => setHome({ has: e.target.checked })} /> 보유 주택 있음
        </label>
        {s.ownedHome.has && (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm"><span>시세 (만원)</span>
              <input className={input} type="number" value={s.ownedHome.price} onChange={(e) => setHome({ price: Number(e.target.value) })} /></label>
            <label className="flex flex-col gap-1 text-sm"><span>매도 비용률 (%)</span>
              <input className={input} type="number" step="any" value={toView(s.ownedHome.sellCostRate, "%")} onChange={(e) => setHome({ sellCostRate: fromView(Number(e.target.value), "%") })} /></label>
            <label className="flex flex-col gap-1 text-sm"><span>이사할 때</span>
              <select className={input} value={s.ownedHome.planOnMove} onChange={(e) => setHome({ planOnMove: e.target.value as "keep" | "sell" })}>
                <option value="keep">보유</option><option value="sell">매도</option>
              </select></label>
            <div className="flex flex-col justify-end gap-1 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={s.ownedHome.rentLoanAllowedIfKept} onChange={(e) => setHome({ rentLoanAllowedIfKept: e.target.checked })} /> 보유 시 전세대출 가능</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={s.ownedHome.mortgageAllowedIfKept} onChange={(e) => setHome({ mortgageAllowedIfKept: e.target.checked })} /> 보유 시 주담대 가능</label>
            </div>
          </div>
        )}
      </section>

      <section className="mb-6 rounded-xl bg-slate-50 p-4 text-sm dark:bg-slate-900">
        <h2 className="mb-2 font-semibold">계산 결과 (저장 전 미리보기)</h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
          <dt>월 가용액 (관리비 제외)</dt><dd>{fmt(derived.available)}만</dd>
          <dt>DSR 반영 월 대출 상환 한도</dt><dd>{fmt(derived.dsrMonthly)}만</dd>
          <dt>적용 현금 (매도 반영)</dt><dd>{fmt(derived.cash)}만</dd>
          <dt>적용 매매 / 전세 대출 비율</dt><dd>{Math.round(derived.ltvBuy * 100)}% / {Math.round(derived.ltvRent * 100)}%</dd>
          <dt>전세금 상한</dt><dd>{fmt(limits.jeonseMax)}만</dd>
          <dt>매매가 상한</dt><dd>{fmt(limits.buyMax)}만</dd>
        </dl>
      </section>

      <section className="mb-6">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={notify} onChange={(e) => { setSaved(false); setNotify(e.target.checked); }} />
          매주 월요일 카카오톡 알림 받기
        </label>
      </section>

      {/* 설정이 길어 저장 버튼과 안내는 화면 아래에 붙여 둔다. */}
      <div className="sticky bottom-0 -mx-4 border-t border-slate-200 bg-background px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:border-slate-800">
        {collecting && <p className="mb-2 text-sm text-emerald-700 dark:text-emerald-400">새 지역의 지난 12개월 거래를 받는 중입니다. 몇 분 뒤 목록에 나옵니다.</p>}
        {errors._ && <p className="mb-2 text-sm text-rose-600">{errors._}</p>}
        {Object.keys(errors).length > 0 && <p className="mb-2 text-sm text-rose-600">입력값을 확인해 주세요.</p>}
        <button type="button" onClick={save} disabled={pending} className="w-full rounded-xl bg-emerald-600 py-3 font-semibold text-white disabled:opacity-50">
          {pending ? "저장 중..." : saved ? "저장했습니다" : "저장"}
        </button>
      </div>
    </main>
  );
}
