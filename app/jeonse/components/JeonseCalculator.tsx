"use client";

import { useMemo, useState } from "react";
import { calculateJeonse } from "@/lib/calculations/jeonse-calculator";
import { formatKoreanAmount, formatWon } from "@/lib/format";
import DecimalField from "@/app/components/DecimalField";
import MoneyField from "@/app/components/MoneyField";
import Stepper from "@/app/components/Stepper";

const CARD =
  "rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5 dark:border-slate-800 dark:bg-slate-900";
const ROW_HIGHLIGHT =
  "bg-emerald-100 font-semibold text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200";

const RATE_CHIPS = [3, 4, 5];
const LABEL = { jeonse: "전세", wolse: "월세" } as const;

const num = (n: number) => n.toLocaleString("en-US");
const won = (n: number) => `${num(n)}원`;
const signed = (n: number) =>
  n > 0 ? `+${won(n)}` : n < 0 ? `−${won(-n)}` : "0원";
const rateText = (r: number) => `${Number(r.toFixed(2))}%`;

function parseDecimal(text: string): number {
  const n = parseFloat(text);
  return Number.isFinite(n) ? n : 0;
}

export default function JeonseCalculator() {
  const [jeonseDeposit, setJeonseDeposit] = useState(300_000_000);
  const [rentDeposit, setRentDeposit] = useState(50_000_000);
  const [monthlyRent, setMonthlyRent] = useState(1_000_000);
  const [ratePercentText, setRatePercentText] = useState("4");
  const [years, setYears] = useState(2);

  const rate = parseDecimal(ratePercentText);

  const result = useMemo(
    () =>
      calculateJeonse({
        jeonseDeposit,
        rentDeposit,
        monthlyRent,
        interestRatePercent: rate,
        years,
      }),
    [jeonseDeposit, rentDeposit, monthlyRent, rate, years],
  );

  const { jeonse, wolse, difference, cheaper, rentImpact, conversionRate } =
    result;
  const hasInput = jeonse.totalCost > 0 || wolse.totalCost > 0;
  const depositTooHigh = jeonseDeposit > 0 && rentDeposit >= jeonseDeposit;

  return (
    <div className="space-y-4">
      {/* 1. 입력 */}
      <section className={CARD} aria-labelledby="input-heading">
        <h2 id="input-heading" className="sr-only">
          조건 입력
        </h2>

        <div className="space-y-5">
          <MoneyField
            label="전세금"
            value={jeonseDeposit}
            onChange={setJeonseDeposit}
            hint={jeonseDeposit > 0 ? `= ${formatKoreanAmount(jeonseDeposit)}` : undefined}
          />

          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
            <p className="mb-3 text-sm font-bold">
              같은 집을 월세로 계약한다면
            </p>
            <div className="space-y-4">
              <MoneyField
                label="월세 보증금"
                value={rentDeposit}
                onChange={setRentDeposit}
                hint={rentDeposit > 0 ? `= ${formatKoreanAmount(rentDeposit)}` : undefined}
                compact
              />
              <MoneyField
                label="월세 (매달)"
                value={monthlyRent}
                onChange={setMonthlyRent}
                hint={monthlyRent > 0 ? `= ${formatKoreanAmount(monthlyRent)}` : undefined}
                compact
              />
            </div>
            {depositTooHigh && (
              <p
                role="alert"
                className="mt-3 rounded-lg bg-amber-100 px-3 py-2 text-xs text-amber-900 dark:bg-amber-900/30 dark:text-amber-200"
              >
                월세 보증금이 전세금 이상이에요. 보증금을 낮추는 대신 월세를
                내는 게 일반적이니 금액을 다시 확인해 보세요.
              </p>
            )}
          </div>

          <div>
            <DecimalField
              label="이자율 (연)"
              value={ratePercentText}
              onChange={setRatePercentText}
              unit="%"
              maxDecimals={2}
              maxIntDigits={2}
              hint="전세금을 대출받았다면 대출 이자율, 내 돈이라면 예금에 넣었을 때 받을 이자율이에요."
            />
            <div className="mt-2 flex gap-2" role="group" aria-label="이자율 빠른 선택">
              {RATE_CHIPS.map((r) => (
                <button
                  key={r}
                  type="button"
                  aria-pressed={rate === r}
                  onClick={() => setRatePercentText(String(r))}
                  className={`flex-1 rounded-lg border py-2 text-sm font-semibold transition ${
                    rate === r
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                      : "border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                  }`}
                >
                  {r}%
                </button>
              ))}
            </div>
          </div>

          <Stepper
            label="계약 기간 (년)"
            hint="보통 2년 계약이고, 갱신하면 최대 4년까지 살 수 있어요."
            value={years}
            min={1}
            max={10}
            onChange={setYears}
          />
        </div>
      </section>

      {/* 2. 결론 */}
      <section
        aria-live="polite"
        aria-labelledby="result-heading"
        className="rounded-2xl bg-emerald-600 p-5 text-white shadow-sm sm:p-6 dark:bg-emerald-700"
      >
        <h2 id="result-heading" className="text-sm font-medium text-emerald-100">
          전세 vs 월세 · {result.years}년 총 비용 기준
        </h2>
        {!hasInput ? (
          <p className="mt-2 text-lg font-bold">금액을 입력하면 바로 계산돼요.</p>
        ) : cheaper === "same" ? (
          <p className="mt-2 text-2xl font-extrabold">두 조건의 비용이 같아요</p>
        ) : (
          <>
            <p className="mt-2 text-2xl font-extrabold">
              {LABEL[cheaper]}가 더 저렴해요
            </p>
            <p className="mt-1 text-4xl font-extrabold tracking-tight tabular-nums sm:text-5xl">
              {formatWon(Math.abs(difference.total))}
              <span className="ml-1 text-lg font-semibold text-emerald-100">
                절약
              </span>
            </p>
            <p className="mt-3 text-sm text-emerald-50">
              한 달로 보면 약{" "}
              <strong className="tabular-nums">
                {formatWon(Math.abs(difference.monthly))}
              </strong>
              , 1년으로 보면{" "}
              <strong className="tabular-nums">
                {formatWon(Math.abs(difference.annual))}
              </strong>{" "}
              차이예요.
            </p>
          </>
        )}
      </section>

      {/* 3. 전세 / 월세 비용표 */}
      <section className={CARD} aria-labelledby="compare-heading">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 id="compare-heading" className="text-base font-bold">
            월별 · 연별 · 총 비용
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
                  전세
                  {hasInput && cheaper === "jeonse" && <Badge />}
                </th>
                <th scope="col" className="pb-2 pl-2 text-right font-medium">
                  월세
                  {hasInput && cheaper === "wolse" && <Badge />}
                </th>
              </tr>
            </thead>
            <tbody>
              <CompareRow
                label="보증금"
                a={jeonse.deposit}
                b={wolse.deposit}
              />
              <CompareRow
                label="월 이자"
                desc="보증금 × 이자율 ÷ 12"
                a={jeonse.monthlyInterest}
                b={wolse.monthlyInterest}
              />
              <CompareRow
                label="월세"
                a={jeonse.monthlyRent}
                b={wolse.monthlyRent}
              />
              <CompareRow
                label="월 비용"
                desc="월 이자 + 월세"
                a={jeonse.monthlyCost}
                b={wolse.monthlyCost}
                strong
                topBorder
              />
              <CompareRow
                label="연 비용"
                a={jeonse.annualCost}
                b={wolse.annualCost}
                strong
              />
              <CompareRow
                label={`${result.years}년 총 비용`}
                a={jeonse.totalCost}
                b={wolse.totalCost}
                strong
                highlight
              />
            </tbody>
          </table>
        </div>
      </section>

      {/* 4. 월세 추가 영향도 */}
      <section className={CARD} aria-labelledby="impact-heading">
        <h2 id="impact-heading" className="text-base font-bold">
          월세가 붙으면 한 달 비용이 얼마나 달라질까?
        </h2>

        {rentImpact.depositReduction > 0 ? (
          <>
            <dl className="mt-3 divide-y divide-slate-200 text-sm dark:divide-slate-800">
              <div className="flex items-start justify-between gap-3 py-2">
                <dt>
                  보증금을 낮춰요
                  <span className="block text-xs text-slate-500 dark:text-slate-400">
                    전세금 → 월세 보증금
                  </span>
                </dt>
                <dd className="whitespace-nowrap tabular-nums">
                  −{formatKoreanAmount(rentImpact.depositReduction)}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3 py-2">
                <dt>
                  이자가 줄어요
                  <span className="block text-xs text-slate-500 dark:text-slate-400">
                    묶인 돈이 줄어서
                  </span>
                </dt>
                <dd className="whitespace-nowrap tabular-nums text-emerald-700 dark:text-emerald-400">
                  −{won(rentImpact.monthlyInterestSaved)}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3 py-2">
                <dt>
                  월세가 새로 나가요
                  <span className="block text-xs text-slate-500 dark:text-slate-400">
                    매달 내는 돈
                  </span>
                </dt>
                <dd className="whitespace-nowrap tabular-nums text-rose-700 dark:text-rose-400">
                  +{won(rentImpact.monthlyRentAdded)}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3 py-2 font-bold">
                <dt>
                  월 비용 변화
                  <span className="block text-xs font-normal text-slate-500 dark:text-slate-400">
                    순수 전세와 비교한 한 달 차이
                  </span>
                </dt>
                <dd className="whitespace-nowrap tabular-nums">
                  {signed(rentImpact.monthlyNet)}
                  {rentImpact.percentChange !== null && (
                    <span className="block text-right text-xs font-normal text-slate-500 dark:text-slate-400">
                      전세 대비 {rentImpact.percentChange > 0 ? "+" : ""}
                      {rentImpact.percentChange.toFixed(1)}%
                    </span>
                  )}
                </dd>
              </div>
            </dl>
          </>
        ) : (
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            월세 보증금이 전세금보다 낮아야 월세가 붙었을 때의 영향을 비교할 수
            있어요.
          </p>
        )}
      </section>

      {/* 5. 전월세 전환율 */}
      {conversionRate !== null && (
        <section className={CARD} aria-labelledby="conversion-heading">
          <h2 id="conversion-heading" className="text-base font-bold">
            전월세 전환율 {rateText(conversionRate)}
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            보증금을 {formatKoreanAmount(rentImpact.depositReduction)} 덜 내는
            대신, 매년 그 금액의 {rateText(conversionRate)}를 월세로 내는
            셈이에요. (월세 × 12 ÷ 줄어든 보증금)
          </p>
          <p className="mt-3 rounded-xl bg-white p-3 text-sm dark:bg-slate-950">
            {cheaper === "jeonse" && (
              <>
                내 이자율 <strong>{rateText(rate)}</strong>가 전환율{" "}
                <strong>{rateText(conversionRate)}</strong>보다 낮아요. 묶어둔
                돈의 이자보다 월세가 더 비싸서 <strong>전세가 유리</strong>해요.
              </>
            )}
            {cheaper === "wolse" && (
              <>
                내 이자율 <strong>{rateText(rate)}</strong>가 전환율{" "}
                <strong>{rateText(conversionRate)}</strong>보다 높아요. 보증금에
                묶인 돈의 이자가 월세보다 커서 <strong>월세가 유리</strong>해요.
              </>
            )}
            {cheaper === "same" && (
              <>
                내 이자율과 전환율이 같아서 <strong>비용이 같아요</strong>.
              </>
            )}
          </p>
        </section>
      )}

      {/* 6. 계약 기간별 */}
      <section className={CARD} aria-labelledby="period-heading">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 id="period-heading" className="text-base font-bold">
            계약 기간별 총 비용
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
                  기간
                </th>
                <th scope="col" className="pb-2 pl-2 text-right font-medium">
                  전세
                </th>
                <th scope="col" className="pb-2 pl-2 text-right font-medium">
                  월세
                </th>
                <th scope="col" className="pb-2 pl-2 text-right font-medium">
                  더 저렴
                </th>
              </tr>
            </thead>
            <tbody>
              {result.byPeriod.map((p) => (
                <tr
                  key={p.years}
                  aria-current={p.years === result.years ? "true" : undefined}
                  className={p.years === result.years ? ROW_HIGHLIGHT : ""}
                >
                  <th scope="row" className="rounded-l-md px-2 py-1.5 text-left font-medium">
                    {p.years}년
                  </th>
                  <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">
                    {num(p.jeonse)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">
                    {num(p.wolse)}
                  </td>
                  <td className="whitespace-nowrap rounded-r-md px-2 py-1.5 text-right tabular-nums">
                    <Winner difference={p.difference} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 7. 이자율별 */}
      <section className={CARD} aria-labelledby="rate-heading">
        <div className="mb-1 flex items-baseline justify-between">
          <h2 id="rate-heading" className="text-base font-bold">
            이자율에 따라 달라져요
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {result.years}년 · 단위: 원
          </span>
        </div>
        <p className="mb-3 text-xs text-slate-600 dark:text-slate-400">
          이자율이 오르면 보증금이 큰 전세의 부담이 더 빨리 커져요.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-500 dark:text-slate-400">
                <th scope="col" className="pb-2 text-left font-medium">
                  이자율
                </th>
                <th scope="col" className="pb-2 pl-2 text-right font-medium">
                  전세
                </th>
                <th scope="col" className="pb-2 pl-2 text-right font-medium">
                  월세
                </th>
                <th scope="col" className="pb-2 pl-2 text-right font-medium">
                  더 저렴
                </th>
              </tr>
            </thead>
            <tbody>
              {result.byRate.map((r) => (
                <tr
                  key={r.ratePercent}
                  aria-current={r.ratePercent === rate ? "true" : undefined}
                  className={r.ratePercent === rate ? ROW_HIGHLIGHT : ""}
                >
                  <th scope="row" className="rounded-l-md px-2 py-1.5 text-left font-medium">
                    {rateText(r.ratePercent)}
                  </th>
                  <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">
                    {num(r.jeonse)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">
                    {num(r.wolse)}
                  </td>
                  <td className="whitespace-nowrap rounded-r-md px-2 py-1.5 text-right tabular-nums">
                    <Winner difference={r.difference} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="px-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        ※ 비용은 “보증금 × 이자율(연 단리) + 월세”로 계산한 참고용 금액이에요.
        중개수수료, 관리비, 대출 원금 상환, 보증보험료, 집값 변동, 월세 세액공제와
        대출이자 소득공제 같은 세제 혜택은 포함하지 않았어요. 실제 대출은
        원리금 상환 방식에 따라 이자가 달라질 수 있습니다.
      </p>
    </div>
  );
}

/* ---------- 작은 부품들 ---------- */

function Badge() {
  return (
    <span className="ml-1 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
      저렴
    </span>
  );
}

/** difference = 월세 - 전세. 양수면 전세가 저렴하다. */
function Winner({ difference }: { difference: number }) {
  if (difference === 0) return <span>같음</span>;
  const who = difference > 0 ? "전세" : "월세";
  return (
    <span>
      <span className="mr-1 text-xs font-normal">{who}</span>
      {num(Math.abs(difference))}
    </span>
  );
}

function CompareRow({
  label,
  desc,
  a,
  b,
  strong,
  topBorder,
  highlight,
}: {
  label: string;
  desc?: string;
  a: number;
  b: number;
  strong?: boolean;
  topBorder?: boolean;
  highlight?: boolean;
}) {
  const weight = strong ? "font-bold" : "";
  const pad = topBorder ? "pt-3" : "";
  return (
    <tr
      className={
        highlight
          ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100"
          : topBorder
            ? "border-t border-slate-300 dark:border-slate-700"
            : ""
      }
    >
      <th
        scope="row"
        className={`py-2 pr-2 text-left align-top ${highlight ? "rounded-l-lg pl-2" : ""} ${strong ? "font-bold" : "font-medium"} ${pad}`}
      >
        {label}
        {desc && (
          <span className="block text-xs font-normal text-slate-500 dark:text-slate-400">
            {desc}
          </span>
        )}
      </th>
      <td
        className={`whitespace-nowrap py-2 pl-2 text-right align-top tabular-nums ${weight} ${pad}`}
      >
        {num(a)}
      </td>
      <td
        className={`whitespace-nowrap py-2 pl-2 text-right align-top tabular-nums ${highlight ? "rounded-r-lg pr-2" : ""} ${weight} ${pad}`}
      >
        {num(b)}
      </td>
    </tr>
  );
}
