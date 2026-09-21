"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  calculateJeonseVsLoan,
  type CostItem,
  type JeonseCostKey,
  type PurchaseCostKey,
} from "@/lib/calculations/jeonse-vs-loan-calculator";
import { formatKoreanAmount, formatWon } from "@/lib/format";
import Slider from "@/app/components/Slider";

const CARD =
  "rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5 dark:border-slate-800 dark:bg-slate-900";

/** <html class="dark"> 여부를 외부 스토어처럼 구독한다 (ThemeToggle과 동일한 패턴). */
function subscribeToTheme(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}
const getThemeSnapshot = () =>
  document.documentElement.classList.contains("dark");
const getThemeServerSnapshot = () => false;

/** 비용 항목을 4가지 역할로 묶어 구매/전세 차트·범례를 같은 색으로 맞춘다. */
type Category = "initial" | "interest" | "tax" | "maintenance";

const CATEGORY_META: Record<
  Category,
  { label: string; light: string; dark: string }
> = {
  initial: { label: "초기비용", light: "#2a78d6", dark: "#3987e5" },
  interest: { label: "이자·보증보험료", light: "#eb6834", dark: "#d95926" },
  tax: { label: "세금", light: "#1baf7a", dark: "#199e70" },
  maintenance: { label: "관리비", light: "#eda100", dark: "#c98500" },
};

const PURCHASE_CATEGORY: Record<PurchaseCostKey, Category> = {
  acquisitionTax: "initial",
  loanInterest: "interest",
  propertyTax: "tax",
  comprehensiveTax: "tax",
  maintenance: "maintenance",
};

const JEONSE_CATEGORY: Record<JeonseCostKey, Category> = {
  brokerageFee: "initial",
  guaranteeInsurance: "interest",
  maintenance: "maintenance",
};

const PURCHASE_LABEL: Record<PurchaseCostKey, string> = {
  acquisitionTax: "취득세",
  loanInterest: "대출이자",
  propertyTax: "재산세",
  comprehensiveTax: "종합부동산세",
  maintenance: "관리비",
};

const JEONSE_LABEL: Record<JeonseCostKey, string> = {
  brokerageFee: "중개보수",
  guaranteeInsurance: "보증보험료",
  maintenance: "관리비",
};

function itemTotal<K extends string>(items: CostItem<K>[], key: K): number {
  return items.find((i) => i.key === key)?.total ?? 0;
}

function formatAxisAmount(n: number): string {
  if (n >= ONE_EOK) return `${(n / ONE_EOK).toFixed(1)}억`;
  if (n >= 10_000) return `${Math.round(n / 10_000)}만`;
  return `${n}`;
}

const ONE_EOK = 100_000_000;

export default function JeonseVsLoanCalculator() {
  const isDark = useSyncExternalStore(
    subscribeToTheme,
    getThemeSnapshot,
    getThemeServerSnapshot,
  );

  const inputs = useJeonseVsLoanInputs();
  const {
    price,
    setPrice,
    years,
    setYears,
    loanRatePercent,
    setLoanRatePercent,
    ltvPercent,
    setLtvPercent,
    officialPriceRatioPercent,
    setOfficialPriceRatioPercent,
    monthlyMaintenanceFee,
    setMonthlyMaintenanceFee,
  } = inputs;

  const result = useMemo(
    () =>
      calculateJeonseVsLoan({
        price,
        years,
        loanRatePercent,
        ltvPercent,
        officialPriceRatioPercent,
        monthlyMaintenanceFee,
      }),
    [
      price,
      years,
      loanRatePercent,
      ltvPercent,
      officialPriceRatioPercent,
      monthlyMaintenanceFee,
    ],
  );

  const chartColor = (category: Category) =>
    isDark ? CATEGORY_META[category].dark : CATEGORY_META[category].light;
  const surface = isDark ? "#1a1a19" : "#fcfcfb";
  const gridColor = isDark ? "#2c2c2a" : "#e1e0d9";
  const tickColor = isDark ? "#c3c2b7" : "#52514e";

  const chartData = [
    {
      scenario: "구매",
      initial: itemTotal(result.purchase.items, "acquisitionTax"),
      interest: itemTotal(result.purchase.items, "loanInterest"),
      tax:
        itemTotal(result.purchase.items, "propertyTax") +
        itemTotal(result.purchase.items, "comprehensiveTax"),
      maintenance: itemTotal(result.purchase.items, "maintenance"),
    },
    {
      scenario: "전세",
      initial: itemTotal(result.jeonse.items, "brokerageFee"),
      interest: itemTotal(result.jeonse.items, "guaranteeInsurance"),
      tax: 0,
      maintenance: itemTotal(result.jeonse.items, "maintenance"),
    },
  ];

  const jeonseIsCheaperTotal = result.totalSavings > 0;
  const winnerLabel = jeonseIsCheaperTotal ? "전세" : "구매";

  return (
    <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
      {/* 좌측 1/3: 입력 */}
      <section className={`${CARD} lg:col-span-1`} aria-labelledby="input-heading">
        <h2 id="input-heading" className="mb-4 text-base font-bold">
          조건 입력
        </h2>
        <div className="space-y-6">
          <Slider
            label="아파트 가격"
            value={price}
            min={300_000_000}
            max={1_500_000_000}
            step={10_000_000}
            onChange={setPrice}
            formatValue={formatKoreanAmount}
          />
          <Slider
            label="거주 기간"
            value={years}
            min={1}
            max={30}
            onChange={setYears}
            formatValue={(n) => `${n}년`}
          />
          <Slider
            label="대출금리"
            value={loanRatePercent}
            min={2}
            max={8}
            step={0.1}
            onChange={setLoanRatePercent}
            formatValue={(n) => `${n.toFixed(1)}%`}
          />
          <Slider
            label="LTV (담보인정비율)"
            value={ltvPercent}
            min={50}
            max={90}
            onChange={setLtvPercent}
            formatValue={(n) => `${n}%`}
          />
          <Slider
            label="공시가격비율"
            value={officialPriceRatioPercent}
            min={50}
            max={90}
            onChange={setOfficialPriceRatioPercent}
            formatValue={(n) => `${n}%`}
          />
          <Slider
            label="월 관리비"
            value={monthlyMaintenanceFee}
            min={200_000}
            max={800_000}
            step={10_000}
            onChange={setMonthlyMaintenanceFee}
            formatValue={formatKoreanAmount}
          />
        </div>
      </section>

      {/* 우측 2/3: 결과 */}
      <div className="space-y-4 lg:col-span-2">
        {/* 결론 */}
        <section
          aria-live="polite"
          className="rounded-2xl bg-emerald-600 p-5 text-white shadow-sm sm:p-6 dark:bg-emerald-700"
        >
          <h2 className="text-sm font-medium text-emerald-100">
            {years}년 거주 기준 결론
          </h2>
          <p className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">
            {winnerLabel}가 더 유리해요
          </p>
          <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-emerald-100">월 절감액</dt>
              <dd className="text-lg font-bold tabular-nums">
                {formatWon(Math.abs(result.monthlySavings))}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-emerald-100">총 절감액</dt>
              <dd className="text-lg font-bold tabular-nums">
                {formatWon(Math.abs(result.totalSavings))}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-emerald-100">자산비교</dt>
              <dd className="text-lg font-bold tabular-nums">
                {result.assetDifference >= 0 ? "구매" : "전세"} 쪽이{" "}
                {formatWon(Math.abs(result.assetDifference))} 더 많아요
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-xs leading-relaxed text-emerald-50">
            구매 시 보유자산은 아파트가격, 전세 시 보유자산은 계약 종료 후
            돌려받는 전세금 기준이에요.
          </p>
        </section>

        {/* 구매 / 전세 요약 카드 */}
        <div className="grid gap-4 sm:grid-cols-2">
          <SummaryCard
            title="구매"
            monthly={result.purchase.monthlyAverageCost}
            total={result.purchase.totalCost}
            assetLabel="보유자산 (아파트가격)"
            assetValue={result.purchase.ownedAsset}
            rows={result.purchase.items.map((item) => ({
              label: PURCHASE_LABEL[item.key],
              category: PURCHASE_CATEGORY[item.key],
              item,
            }))}
            chartColor={chartColor}
          />
          <SummaryCard
            title="전세"
            monthly={result.jeonse.monthlyAverageCost}
            total={result.jeonse.totalCost}
            assetLabel="전세금 (반환 예정)"
            assetValue={result.jeonse.deposit}
            rows={result.jeonse.items.map((item) => ({
              label: JEONSE_LABEL[item.key],
              category: JEONSE_CATEGORY[item.key],
              item,
            }))}
            chartColor={chartColor}
          />
        </div>

        {/* 차트 */}
        <section className={CARD} aria-labelledby="chart-heading">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 id="chart-heading" className="text-base font-bold">
              {years}년 총비용 비교
            </h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              단위: 원
            </span>
          </div>
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer>
              <BarChart data={chartData} barSize={56}>
                <CartesianGrid
                  vertical={false}
                  stroke={gridColor}
                  strokeDasharray="0"
                />
                <XAxis
                  dataKey="scenario"
                  tick={{ fill: tickColor, fontSize: 13 }}
                  axisLine={{ stroke: gridColor }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: tickColor, fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={formatAxisAmount}
                  width={48}
                />
                <Tooltip
                  formatter={(value) => formatWon(Number(value ?? 0))}
                  contentStyle={{
                    background: surface,
                    border: `1px solid ${gridColor}`,
                    borderRadius: 8,
                    fontSize: 13,
                  }}
                  labelStyle={{ color: tickColor }}
                />
                <Legend
                  formatter={(value: string) =>
                    CATEGORY_META[value as Category].label
                  }
                  wrapperStyle={{ fontSize: 13, color: tickColor }}
                />
                <Bar
                  dataKey="initial"
                  name="initial"
                  stackId="cost"
                  fill={chartColor("initial")}
                  stroke={surface}
                  strokeWidth={2}
                />
                <Bar
                  dataKey="interest"
                  name="interest"
                  stackId="cost"
                  fill={chartColor("interest")}
                  stroke={surface}
                  strokeWidth={2}
                />
                <Bar
                  dataKey="tax"
                  name="tax"
                  stackId="cost"
                  fill={chartColor("tax")}
                  stroke={surface}
                  strokeWidth={2}
                />
                <Bar
                  dataKey="maintenance"
                  name="maintenance"
                  stackId="cost"
                  fill={chartColor("maintenance")}
                  stroke={surface}
                  strokeWidth={2}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <p className="px-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          ※ 취득세·재산세·종합부동산세는 1세대 1주택자 기준 법정 세율을
          단순화한 참고용 추정치예요. 지방교육세·농어촌특별세, 세액공제는
          반영하지 않았어요. 대출은 원금 상환 없이 이자만 낸다고 가정했고,
          집값과 전세금은 거주 기간 동안 변하지 않는다고 가정했어요. 전세금은
          아파트가격 × LTV로 근사한 값이라 실제 시세와 다를 수 있어요.
        </p>
      </div>
    </div>
  );
}

function useJeonseVsLoanInputs() {
  const [price, setPrice] = useState(900_000_000);
  const [years, setYears] = useState(10);
  const [loanRatePercent, setLoanRatePercent] = useState(4.5);
  const [ltvPercent, setLtvPercent] = useState(70);
  const [officialPriceRatioPercent, setOfficialPriceRatioPercent] =
    useState(67);
  const [monthlyMaintenanceFee, setMonthlyMaintenanceFee] =
    useState(400_000);

  return {
    price,
    setPrice,
    years,
    setYears,
    loanRatePercent,
    setLoanRatePercent,
    ltvPercent,
    setLtvPercent,
    officialPriceRatioPercent,
    setOfficialPriceRatioPercent,
    monthlyMaintenanceFee,
    setMonthlyMaintenanceFee,
  };
}

function SummaryCard({
  title,
  monthly,
  total,
  assetLabel,
  assetValue,
  rows,
  chartColor,
}: {
  title: string;
  monthly: number;
  total: number;
  assetLabel: string;
  assetValue: number;
  rows: { label: string; category: Category; item: CostItem<string> }[];
  chartColor: (category: Category) => string;
}) {
  return (
    <section className={CARD} aria-labelledby={`${title}-heading`}>
      <h2 id={`${title}-heading`} className="text-base font-bold">
        {title}
      </h2>
      <p className="mt-2 text-2xl font-extrabold tabular-nums">
        {formatWon(monthly)}
        <span className="ml-1 text-sm font-medium text-slate-500 dark:text-slate-400">
          /월
        </span>
      </p>
      <dl className="mt-3 space-y-1 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-slate-600 dark:text-slate-400">
            거주기간 총비용
          </dt>
          <dd className="font-semibold tabular-nums">{formatWon(total)}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-slate-600 dark:text-slate-400">{assetLabel}</dt>
          <dd className="font-semibold tabular-nums">
            {formatWon(assetValue)}
          </dd>
        </div>
      </dl>

      <ul className="mt-4 space-y-1.5 border-t border-slate-200 pt-3 text-xs dark:border-slate-800">
        {rows.map(({ label, category, item }) => (
          <li key={label} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
              <span
                aria-hidden="true"
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: chartColor(category) }}
              />
              {label}
            </span>
            <span className="tabular-nums">
              {formatWon(item.total)}
              <span className="ml-1 text-slate-400 dark:text-slate-500">
                ({Math.round(item.share * 100)}%)
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
