"use client";

import { useMemo, useState } from "react";
import {
  RATES_2025,
  TAX_BRACKETS,
  calculateSalary,
  type Breakdown,
  type SalaryPeriod,
} from "@/lib/calculations/salary-calculator";
import { formatKoreanAmount, formatWon } from "@/lib/format";
import MoneyField from "@/app/components/MoneyField";
import Stepper from "@/app/components/Stepper";

const MAX_AMOUNT = 10_000_000_000;
const MAX_DEPENDENTS = 10;

const CARD =
  "rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5 dark:border-slate-800 dark:bg-slate-900";
const pct = (rate: number) => `${Number((rate * 100).toFixed(3))}%`;
const num = (n: number) => n.toLocaleString("en-US");

export default function SalaryCalculator() {
  const [period, setPeriod] = useState<SalaryPeriod>("year");
  const [amount, setAmount] = useState(50_000_000);
  const [dependents, setDependents] = useState(1);
  const [children, setChildren] = useState(0);
  const [nonTaxable, setNonTaxable] = useState(200_000);

  const result = useMemo(
    () =>
      calculateSalary({
        amount,
        period,
        dependents,
        children,
        monthlyNonTaxable: nonTaxable,
      }),
    [amount, period, dependents, children, nonTaxable],
  );

  function changePeriod(next: SalaryPeriod) {
    if (next === period) return;
    setAmount(
      next === "month"
        ? Math.round(amount / 12 / 1000) * 1000
        : Math.min(amount * 12, MAX_AMOUNT),
    );
    setPeriod(next);
  }

  function changeDependents(next: number) {
    setDependents(next);
    setChildren((c) => Math.min(c, next - 1));
  }

  const { monthly, annual, taxDetail } = result;
  const hasIncome = monthly.gross > 0;
  const deductionRate = hasIncome
    ? (monthly.totalDeduction / monthly.gross) * 100
    : 0;

  return (
    <div className="space-y-4">
      {/* 1. 입력 */}
      <section className={CARD} aria-labelledby="input-heading">
        <h2 id="input-heading" className="sr-only">
          급여 입력
        </h2>

        <div
          role="group"
          aria-label="입력 기준 선택"
          className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-slate-200 p-1 dark:bg-slate-800"
        >
          {(["year", "month"] as const).map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={period === p}
              onClick={() => changePeriod(p)}
              className={`rounded-lg py-2.5 text-sm font-semibold transition ${
                period === p
                  ? "bg-white text-emerald-700 shadow-sm dark:bg-slate-950 dark:text-emerald-400"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              {p === "year" ? "연봉" : "월급"}
            </button>
          ))}
        </div>

        <MoneyField
          label={period === "year" ? "연봉 (세전)" : "월급 (세전)"}
          value={amount}
          onChange={setAmount}
          hint={
            amount > 0
              ? `= ${formatKoreanAmount(amount)}`
              : "세금을 떼기 전 금액을 입력하세요 (퇴직금 제외)"
          }
        />

        <details className="group mt-4 rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-medium">
            <span>
              추가 조건
              <span className="ml-2 font-normal text-slate-500 dark:text-slate-400">
                부양가족 {dependents}명 · 자녀 {children}명 · 비과세 월{" "}
                {formatKoreanAmount(nonTaxable)}
              </span>
            </span>
            <span
              aria-hidden="true"
              className="text-slate-400 transition group-open:rotate-180"
            >
              ▾
            </span>
          </summary>

          <div className="space-y-5 border-t border-slate-200 px-4 py-4 dark:border-slate-800">
            <Stepper
              label="부양가족 수 (본인 포함)"
              hint="배우자, 부모님, 자녀 등 소득세를 줄여주는 가족이에요."
              value={dependents}
              min={1}
              max={MAX_DEPENDENTS}
              onChange={changeDependents}
            />
            <Stepper
              label="자녀 수 (8세 이상 20세 이하)"
              hint="부양가족에 포함된 자녀만 선택할 수 있어요."
              value={children}
              min={0}
              max={dependents - 1}
              onChange={setChildren}
            />
            <MoneyField
              label="월 비과세액"
              value={nonTaxable}
              onChange={setNonTaxable}
              hint="식대처럼 세금이 붙지 않는 금액이에요. 잘 모르면 그대로 두세요."
              compact
            />
          </div>
        </details>
      </section>

      {/* 2. 실수령액 */}
      <section
        aria-live="polite"
        aria-labelledby="result-heading"
        className="rounded-2xl bg-emerald-600 p-5 text-white shadow-sm sm:p-6 dark:bg-emerald-700"
      >
        <h2 id="result-heading" className="text-sm font-medium text-emerald-100">
          월 실수령액
        </h2>
        <p className="mt-1 text-4xl font-extrabold tracking-tight tabular-nums sm:text-5xl">
          {hasIncome ? formatWon(monthly.netPay) : "-"}
        </p>
        <p className="mt-2 text-sm text-emerald-100">
          연 실수령액{" "}
          <strong className="font-semibold text-white tabular-nums">
            {hasIncome ? formatWon(annual.netPay) : "-"}
          </strong>
        </p>

        {hasIncome ? (
          <>
            <div
              role="img"
              aria-label={`월급 중 실수령액 ${(100 - deductionRate).toFixed(1)}%, 공제 ${deductionRate.toFixed(1)}%`}
              className="mt-5 flex h-3 overflow-hidden rounded-full bg-emerald-900/40"
            >
              <div
                className="bg-white transition-[width]"
                style={{ width: `${100 - deductionRate}%` }}
              />
            </div>
            <p className="mt-2 text-sm text-emerald-50">
              월 {formatWon(monthly.gross)} 중{" "}
              <strong className="tabular-nums">
                {formatWon(monthly.totalDeduction)}
              </strong>
              ({deductionRate.toFixed(1)}%)이 세금·보험료로 빠져나가요.
            </p>
          </>
        ) : (
          <p className="mt-5 text-sm text-emerald-100">
            금액을 입력하면 바로 계산돼요.
          </p>
        )}
      </section>

      {/* 3. 공제 내역 */}
      <section className={CARD} aria-labelledby="breakdown-heading">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 id="breakdown-heading" className="text-base font-bold">
            공제 내역
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            단위: 원
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-500 dark:text-slate-400">
                <th scope="col" className="pb-2 text-left font-medium">
                  항목
                </th>
                <th scope="col" className="pb-2 pl-2 text-right font-medium">
                  월
                </th>
                <th scope="col" className="pb-2 pl-2 text-right font-medium">
                  연
                </th>
              </tr>
            </thead>
            <tbody>
              <Row
                label="세전 급여"
                monthly={monthly.gross}
                annual={annual.gross}
                strong
              />

              <GroupRow title="4대 보험" />
              <Row
                label="국민연금"
                desc={`노후 연금 적립 · 월급의 ${pct(RATES_2025.nationalPension)}`}
                monthly={monthly.nationalPension}
                annual={annual.nationalPension}
              />
              <Row
                label="건강보험"
                desc={`병원비 지원 · 월급의 ${pct(RATES_2025.healthInsurance)}`}
                monthly={monthly.healthInsurance}
                annual={annual.healthInsurance}
              />
              <Row
                label="장기요양보험"
                desc={`노인 돌봄 지원 · 건강보험료의 ${pct(RATES_2025.longTermCare)}`}
                monthly={monthly.longTermCare}
                annual={annual.longTermCare}
              />
              <Row
                label="고용보험"
                desc={`실직 시 실업급여 · 월급의 ${pct(RATES_2025.employmentInsurance)}`}
                monthly={monthly.employmentInsurance}
                annual={annual.employmentInsurance}
              />

              <GroupRow title="세금" />
              <Row
                label="소득세"
                desc={`소득이 클수록 세율이 올라가요 · 내 구간 ${pct(taxDetail.bracketRate)}`}
                monthly={monthly.incomeTax}
                annual={annual.incomeTax}
              />
              <Row
                label="지방소득세"
                desc={`소득세의 ${pct(RATES_2025.localIncomeTax)}`}
                monthly={monthly.localIncomeTax}
                annual={annual.localIncomeTax}
              />

              <Row
                label="공제 합계"
                monthly={monthly.totalDeduction}
                annual={annual.totalDeduction}
                strong
                topBorder
              />
              <NetRow monthly={monthly} annual={annual} />
            </tbody>
          </table>
        </div>
      </section>

      {/* 4. 소득세 계산 과정 */}
      <section className={CARD} aria-labelledby="tax-heading">
        <h2 id="tax-heading" className="text-base font-bold">
          소득세는 이렇게 계산돼요
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          1년치 기준이에요. 위에서부터 차례로 계산합니다.
        </p>

        <dl className="mt-3 divide-y divide-slate-200 text-sm dark:divide-slate-800">
          <Step label="총급여 (비과세 제외)" value={taxDetail.taxableGross} />
          <Step
            sign="−"
            label="근로소득공제"
            desc="일하는 사람에게 필요경비로 인정해 주는 금액"
            value={taxDetail.earnedIncomeDeduction}
          />
          <Step
            sign="−"
            label="인적공제"
            desc={`1인당 ${formatKoreanAmount(RATES_2025.personalDeductionPerPerson)} × ${dependents}명`}
            value={taxDetail.personalDeduction}
          />
          <Step
            sign="−"
            label="4대보험료 공제"
            desc="낸 보험료만큼 세금을 계산할 소득에서 뺍니다"
            value={taxDetail.insuranceDeduction}
          />
          <Step
            sign="="
            label="과세표준"
            desc="세금을 매기는 기준 금액"
            value={taxDetail.taxableBase}
            strong
          />
          <Step
            label={`산출세액 (세율 ${pct(taxDetail.bracketRate)} 구간)`}
            desc="아래 세율표에 따라 계산한 세금"
            value={taxDetail.calculatedTax}
          />
          <Step
            sign="−"
            label="근로소득세액공제"
            value={taxDetail.earnedIncomeTaxCredit}
          />
          {taxDetail.childTaxCredit > 0 && (
            <Step
              sign="−"
              label="자녀세액공제"
              value={taxDetail.childTaxCredit}
            />
          )}
          <Step
            sign="−"
            label="표준세액공제"
            value={taxDetail.standardTaxCredit}
          />
          <Step
            sign="="
            label="연간 소득세 (결정세액)"
            value={taxDetail.determinedTax}
            strong
          />
        </dl>

        <h3 className="mt-6 text-sm font-bold">소득세율표 (누진세율)</h3>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
          소득 전체에 한 번에 높은 세율을 매기는 게 아니라, 구간을 넘어선
          금액에만 그 구간의 세율이 적용돼요.
        </p>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-500 dark:text-slate-400">
                <th scope="col" className="pb-1 text-left font-medium">
                  과세표준
                </th>
                <th scope="col" className="pb-1 text-right font-medium">
                  세율
                </th>
              </tr>
            </thead>
            <tbody>
              {TAX_BRACKETS.map((b, i) => {
                const prev = i === 0 ? 0 : TAX_BRACKETS[i - 1].upTo;
                const range =
                  i === 0
                    ? `${formatKoreanAmount(b.upTo)} 이하`
                    : b.upTo === Infinity
                      ? `${formatKoreanAmount(prev)} 초과`
                      : `${formatKoreanAmount(prev)} 초과 ~ ${formatKoreanAmount(b.upTo)} 이하`;
                const current =
                  hasIncome && b.rate === taxDetail.bracketRate;
                return (
                  <tr
                    key={b.rate}
                    aria-current={current ? "true" : undefined}
                    className={
                      current
                        ? "bg-emerald-100 font-semibold text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200"
                        : ""
                    }
                  >
                    <td className="rounded-l-md px-2 py-1.5">{range}</td>
                    <td className="rounded-r-md px-2 py-1.5 text-right tabular-nums">
                      {pct(b.rate)}
                      {current && (
                        <span className="ml-1 text-xs font-normal">◀ 내 구간</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <p className="px-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        ※ 2025년 요율 기준, 연말정산 방식으로 계산한 참고용
        금액입니다. 실제 급여명세서의 원천징수액(간이세액표)이나 의료비·교육비·
        연금저축 등 추가 공제를 반영한 최종 세액과는 차이가 날 수 있어요.
      </p>
    </div>
  );
}

/* ---------- 작은 부품들 ---------- */

function GroupRow({ title }: { title: string }) {
  return (
    <tr>
      <th
        scope="rowgroup"
        colSpan={3}
        className="pb-1 pt-4 text-left text-xs font-semibold text-emerald-700 dark:text-emerald-400"
      >
        {title}
      </th>
    </tr>
  );
}

function Row({
  label,
  desc,
  monthly,
  annual,
  strong,
  topBorder,
}: {
  label: string;
  desc?: string;
  monthly: number;
  annual: number;
  strong?: boolean;
  topBorder?: boolean;
}) {
  return (
    <tr
      className={
        topBorder ? "border-t border-slate-300 dark:border-slate-700" : ""
      }
    >
      <th
        scope="row"
        className={`py-2 pr-2 text-left align-top ${strong ? "font-bold" : "font-medium"} ${topBorder ? "pt-3" : ""}`}
      >
        {label}
        {desc && (
          <span className="block text-xs font-normal text-slate-500 dark:text-slate-400">
            {desc}
          </span>
        )}
      </th>
      <td
        className={`whitespace-nowrap py-2 pl-2 text-right align-top tabular-nums ${strong ? "font-bold" : ""} ${topBorder ? "pt-3" : ""}`}
      >
        {num(monthly)}
      </td>
      <td
        className={`whitespace-nowrap py-2 pl-2 text-right align-top tabular-nums text-slate-600 dark:text-slate-400 ${strong ? "font-bold" : ""} ${topBorder ? "pt-3" : ""}`}
      >
        {num(annual)}
      </td>
    </tr>
  );
}

function NetRow({ monthly, annual }: { monthly: Breakdown; annual: Breakdown }) {
  return (
    <tr className="bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100">
      <th scope="row" className="rounded-l-lg px-2 py-3 text-left font-extrabold">
        실수령액
      </th>
      <td className="whitespace-nowrap px-2 py-3 text-right font-extrabold tabular-nums">
        {num(monthly.netPay)}
      </td>
      <td className="whitespace-nowrap rounded-r-lg px-2 py-3 text-right font-extrabold tabular-nums">
        {num(annual.netPay)}
      </td>
    </tr>
  );
}

function Step({
  sign,
  label,
  desc,
  value,
  strong,
}: {
  sign?: "−" | "=";
  label: string;
  desc?: string;
  value: number;
  strong?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <dt className={strong ? "font-bold" : ""}>
        {sign && (
          <span
            aria-hidden="true"
            className="mr-1.5 inline-block w-3 text-slate-400"
          >
            {sign}
          </span>
        )}
        {label}
        {desc && (
          <span className="block pl-[1.125rem] text-xs font-normal text-slate-500 dark:text-slate-400">
            {desc}
          </span>
        )}
      </dt>
      <dd
        className={`whitespace-nowrap tabular-nums ${strong ? "font-bold" : ""}`}
      >
        {num(value)}원
      </dd>
    </div>
  );
}
