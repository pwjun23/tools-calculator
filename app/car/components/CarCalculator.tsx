"use client";

import { useId, useMemo, useState } from "react";
import {
  ESTIMATES,
  calculateCarCosts,
  estimateInsurance,
  type CostKey,
} from "@/lib/calculations/car-calculator";
import { formatKoreanAmount, formatWon } from "@/lib/format";
import MoneyField, { INPUT_CLASS } from "@/app/components/MoneyField";
import Stepper from "@/app/components/Stepper";

const CARD =
  "rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5 dark:border-slate-800 dark:bg-slate-900";

const num = (n: number) => n.toLocaleString("en-US");
const percent = (share: number) => `${Math.round(share * 100)}%`;

const ITEM_META: Record<CostKey, { label: string; dot: string }> = {
  fuel: { label: "연료비", dot: "bg-sky-500" },
  insurance: { label: "보험료", dot: "bg-amber-500" },
  maintenance: { label: "정비비", dot: "bg-violet-500" },
  carTax: { label: "자동차세", dot: "bg-rose-500" },
  initial: { label: "초기 비용 분할", dot: "bg-slate-500" },
};

function parseDecimal(text: string): number {
  const n = parseFloat(text);
  return Number.isFinite(n) ? n : 0;
}

export default function CarCalculator() {
  const [price, setPrice] = useState(30_000_000);
  const [displacement, setDisplacement] = useState(1_600);
  const [annualKm, setAnnualKm] = useState(15_000);
  const [efficiencyText, setEfficiencyText] = useState("12");
  const [fuelPrice, setFuelPrice] = useState(1_650);
  const [holdingYears, setHoldingYears] = useState(5);
  const [insuranceInput, setInsuranceInput] = useState(0);
  const [maintenanceInput, setMaintenanceInput] = useState(0);

  const efficiency = parseDecimal(efficiencyText);

  const result = useMemo(
    () =>
      calculateCarCosts({
        price,
        displacement,
        annualKm,
        fuelEfficiency: efficiency,
        fuelPrice,
        holdingYears,
        insuranceOverride: insuranceInput,
        maintenanceOverride: maintenanceInput,
      }),
    [
      price,
      displacement,
      annualKm,
      efficiency,
      fuelPrice,
      holdingYears,
      insuranceInput,
      maintenanceInput,
    ],
  );

  const { items, initial, carTax, maintenanceEstimate } = result;
  const item = (key: CostKey) => items.find((i) => i.key === key)!;
  const hasCost = result.annualTotal > 0;
  const ratePercent = Math.round(initial.acquisitionTaxRate * 100);

  return (
    <div className="space-y-4">
      {/* 1. 입력 */}
      <section className={CARD} aria-labelledby="input-heading">
        <h2 id="input-heading" className="sr-only">
          차량 정보 입력
        </h2>

        <MoneyField
          label="자동차 가격"
          value={price}
          onChange={setPrice}
          hint={
            price > 0
              ? `= ${formatKoreanAmount(price)}`
              : "차량 가격을 입력하면 보험료·정비비·초기 비용까지 계산돼요"
          }
        />

        <details className="group mt-4 rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-medium">
            <span>
              상세 조건
              <span className="ml-2 font-normal text-slate-500 dark:text-slate-400">
                {num(displacement)}cc · 연 {num(annualKm)}km · 연비{" "}
                {efficiencyText || 0}km/L · 휘발유 {num(fuelPrice)}원/L · 보유{" "}
                {holdingYears}년
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
            <MoneyField
              label="배기량"
              value={displacement}
              onChange={setDisplacement}
              unit="cc"
              max={10_000}
              compact
              hint="자동차세를 계산하는 기준이에요. 차량 등록증이나 제조사 사이트에서 확인할 수 있어요."
            />
            <MoneyField
              label="1년 주행거리"
              value={annualKm}
              onChange={setAnnualKm}
              unit="km"
              max={300_000}
              compact
              hint="보통 직장인은 연 1만~2만km를 타요."
            />
            <DecimalField
              label="연비"
              value={efficiencyText}
              onChange={setEfficiencyText}
              unit="km/L"
              hint="휘발유 1리터로 갈 수 있는 거리예요."
            />
            <MoneyField
              label="휘발유 가격"
              value={fuelPrice}
              onChange={setFuelPrice}
              unit="원/L"
              max={10_000}
              compact
              hint="기본값은 참고용이에요. 요즘 주유소 가격으로 바꿔 보세요."
            />
            <Stepper
              label="보유 기간"
              hint="취득세 같은 구매 비용을 몇 년에 나눠 계산할지 정해요."
              value={holdingYears}
              min={1}
              max={20}
              onChange={setHoldingYears}
            />

            <div className="border-t border-dashed border-slate-300 pt-5 dark:border-slate-700">
              <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
                아래 두 칸은 비워 두면 가격에 맞춰 <strong>추정값</strong>을
                써요. 실제 금액을 알면 입력하세요.
              </p>
              <div className="space-y-5">
                <MoneyField
                  label="연 보험료 (직접 입력)"
                  value={insuranceInput}
                  onChange={setInsuranceInput}
                  max={100_000_000}
                  compact
                  hint={`비워두면 추정 ${formatWon(estimateInsurance(price))}`}
                />
                <MoneyField
                  label="연 정비비 (직접 입력)"
                  value={maintenanceInput}
                  onChange={setMaintenanceInput}
                  max={100_000_000}
                  compact
                  hint={`비워두면 추정 ${formatWon(maintenanceEstimate.total)}`}
                />
              </div>
            </div>
          </div>
        </details>
      </section>

      {/* 2. 총 유지비 */}
      <section
        aria-live="polite"
        aria-labelledby="result-heading"
        className="rounded-2xl bg-emerald-600 p-5 text-white shadow-sm sm:p-6 dark:bg-emerald-700"
      >
        <h2 id="result-heading" className="text-sm font-medium text-emerald-100">
          월 평균 유지비
        </h2>
        <p className="mt-1 text-4xl font-extrabold tracking-tight tabular-nums sm:text-5xl">
          {hasCost ? formatWon(result.monthlyTotal) : "-"}
        </p>
        <p className="mt-2 text-sm text-emerald-100">
          연 평균 유지비{" "}
          <strong className="font-semibold text-white tabular-nums">
            {hasCost ? formatWon(result.annualTotal) : "-"}
          </strong>
        </p>
        <p className="mt-4 text-sm text-emerald-50">
          {hasCost
            ? `구매할 때 내는 취득세 등은 ${initial.holdingYears}년 동안 나눠서 포함했어요.`
            : "금액을 입력하면 바로 계산돼요."}
        </p>
      </section>

      {/* 3. 월 / 연 비교 */}
      <section className={CARD} aria-labelledby="breakdown-heading">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 id="breakdown-heading" className="text-base font-bold">
            항목별 월 / 연 비용
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            단위: 원
          </span>
        </div>

        {hasCost && (
          <div
            role="img"
            aria-label={items
              .map((i) => `${ITEM_META[i.key].label} ${percent(i.share)}`)
              .join(", ")}
            className="mb-4 flex h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
          >
            {items.map(
              (i) =>
                i.share > 0 && (
                  <div
                    key={i.key}
                    className={`${ITEM_META[i.key].dot} transition-[width]`}
                    style={{ width: `${i.share * 100}%` }}
                  />
                ),
            )}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-500 dark:text-slate-400">
                <th scope="col" className="pb-2 text-left font-medium">
                  항목
                </th>
                <th scope="col" className="pb-2 pl-2 text-right font-medium">
                  월 평균
                </th>
                <th scope="col" className="pb-2 pl-2 text-right font-medium">
                  연 평균
                </th>
              </tr>
            </thead>
            <tbody>
              <Row
                item={item("fuel")}
                desc={`연 ${num(annualKm)}km ÷ ${efficiencyText || 0}km/L × ${num(fuelPrice)}원`}
              />
              <Row
                item={item("insurance")}
                desc={
                  item("insurance").estimated
                    ? "차량 가격 기준 추정값"
                    : "직접 입력한 금액"
                }
              />
              <Row
                item={item("maintenance")}
                desc={
                  item("maintenance").estimated
                    ? `엔진오일 ${formatKoreanAmount(maintenanceEstimate.engineOil)} · 타이어 ${formatKoreanAmount(maintenanceEstimate.tires)} · 점검·소모품 ${formatKoreanAmount(maintenanceEstimate.service)}`
                    : "직접 입력한 금액"
                }
              />
              <Row
                item={item("carTax")}
                desc={`${num(displacement)}cc × ${carTax.ratePerCc}원 + 지방교육세 30%`}
              />
              <Row
                item={item("initial")}
                desc={`취득세 등 ${formatKoreanAmount(initial.total)} ÷ ${initial.holdingYears}년`}
              />

              <tr className="border-t border-slate-300 dark:border-slate-700">
                <th
                  scope="row"
                  className="pt-3 pr-2 pb-2 text-left align-top font-bold"
                >
                  합계
                </th>
                <td className="whitespace-nowrap pt-3 pb-2 pl-2 text-right align-top font-bold tabular-nums">
                  {num(result.monthlyTotal)}
                </td>
                <td className="whitespace-nowrap pt-3 pb-2 pl-2 text-right align-top font-bold tabular-nums">
                  {num(result.annualTotal)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          자동차세와 보험료는 보통 1년 단위로 한꺼번에 내는 돈이에요. 표의 “월
          평균”은 연 금액을 12로 나눠 매달 모아둔다고 가정한 값입니다.
        </p>
      </section>

      {/* 4. 초기 비용 */}
      <section className={CARD} aria-labelledby="initial-heading">
        <h2 id="initial-heading" className="text-base font-bold">
          구매할 때 한 번 내는 비용
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          차를 살 때 한 번만 내요. 위 유지비에는 {initial.holdingYears}년으로
          나눠 포함했어요.
        </p>

        <dl className="mt-3 divide-y divide-slate-200 text-sm dark:divide-slate-800">
          <Step
            label="취득세"
            desc={`부가세를 뺀 ${formatKoreanAmount(initial.taxBase)} × ${ratePercent}%${displacement < 1000 ? " (경차 세율)" : ""}`}
            value={initial.acquisitionTax}
          />
          <Step
            label="등록 부대비용"
            desc="공채 할인 손실, 번호판, 증지대 등 (추정)"
            value={initial.registrationCost}
          />
          <Step label="합계" value={initial.total} strong />
        </dl>

        {initial.total > 0 && (
          <p className="mt-3 rounded-xl bg-white p-3 text-sm dark:bg-slate-950">
            {initial.holdingYears}년 보유하면 매년{" "}
            <strong className="tabular-nums">
              {formatWon(initial.annualized)}
            </strong>
            , 매달{" "}
            <strong className="tabular-nums">
              {formatWon(item("initial").monthly)}
            </strong>
            씩 든 셈이에요.
          </p>
        )}
      </section>

      {/* 5. 추정 기준·면책 */}
      <section className={CARD}>
        <details>
          <summary className="cursor-pointer text-sm font-bold">
            추정값은 이렇게 계산했어요
          </summary>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
            <li>
              보험료: 기본 {formatKoreanAmount(ESTIMATES.insurance.base)} + 차량
              가격의 {(ESTIMATES.insurance.priceRate * 100).toFixed(1)}%
            </li>
            <li>
              엔진오일: {num(ESTIMATES.engineOil.intervalKm)}km마다{" "}
              {formatKoreanAmount(ESTIMATES.engineOil.costPerChange)}
            </li>
            <li>
              타이어: {num(ESTIMATES.tire.intervalKm)}km마다 교체, 한 세트{" "}
              {ESTIMATES.maintenanceTiers
                .map((t) => formatKoreanAmount(t.tireSet))
                .join(" / ")}{" "}
              (2,000만원 미만 / 5,000만원 미만 / 그 이상)
            </li>
            <li>
              점검·소모품: 연{" "}
              {ESTIMATES.maintenanceTiers
                .map((t) => formatKoreanAmount(t.service))
                .join(" / ")}{" "}
              (가격대별)
            </li>
            <li>
              등록 부대비용: {formatKoreanAmount(ESTIMATES.registration.fixed)} +
              차량 가격의 {(ESTIMATES.registration.priceRate * 100).toFixed(1)}%
            </li>
          </ul>
        </details>
      </section>

      <p className="px-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        ※ 휘발유 승용차를 새로 산다고 가정한 참고용 금액이에요. 보험료·정비비·
        등록 부대비용은 공식 통계가 아닌 대략적인 추정값이고, 차령에 따른
        자동차세 경감, 연납 할인, 경차 취득세 감면, 지역별 공채 차이는 반영하지
        않았어요. 감가상각, 주차비, 통행료, 세차비도 포함하지 않았습니다.
      </p>
    </div>
  );
}

/* ---------- 작은 부품들 ---------- */

function DecimalField({
  label,
  value,
  onChange,
  unit,
  hint,
}: {
  label: string;
  value: string;
  onChange: (text: string) => void;
  unit: string;
  hint?: string;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={value}
          placeholder="0"
          onChange={(e) => {
            // 숫자와 소수점 한 개만 허용, 최대 소수 1자리·정수 3자리
            const cleaned = e.target.value.replace(/[^0-9.]/g, "");
            const [int, ...rest] = cleaned.split(".");
            const next =
              rest.length > 0
                ? `${int.slice(0, 3)}.${rest.join("").slice(0, 1)}`
                : int.slice(0, 3);
            onChange(next);
          }}
          className={`${INPUT_CLASS} py-2.5 pr-14 text-base`}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-slate-500"
        >
          {unit}
        </span>
      </div>
      {hint && (
        <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
          {hint}
        </p>
      )}
    </div>
  );
}

function Row({
  item,
  desc,
}: {
  item: {
    key: CostKey;
    annual: number;
    monthly: number;
    share: number;
    estimated: boolean;
  };
  desc: string;
}) {
  const meta = ITEM_META[item.key];
  return (
    <tr>
      <th scope="row" className="py-2 pr-2 text-left align-top font-medium">
        <span
          aria-hidden="true"
          className={`mr-2 inline-block h-2.5 w-2.5 rounded-full ${meta.dot}`}
        />
        {meta.label}
        {item.estimated && (
          <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
            추정
          </span>
        )}
        <span className="block pl-[1.125rem] text-xs font-normal text-slate-500 dark:text-slate-400">
          {desc} · {percent(item.share)}
        </span>
      </th>
      <td className="whitespace-nowrap py-2 pl-2 text-right align-top tabular-nums">
        {num(item.monthly)}
      </td>
      <td className="whitespace-nowrap py-2 pl-2 text-right align-top tabular-nums text-slate-600 dark:text-slate-400">
        {num(item.annual)}
      </td>
    </tr>
  );
}

function Step({
  label,
  desc,
  value,
  strong,
}: {
  label: string;
  desc?: string;
  value: number;
  strong?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <dt className={strong ? "font-bold" : ""}>
        {label}
        {desc && (
          <span className="block text-xs font-normal text-slate-500 dark:text-slate-400">
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
