"use client";

import { useEffect, useState } from "react";
import {
  calculateContractAmount,
  calculateNetIncome,
  estimateHealthInsurance,
} from "@/lib/calculations";

type Tab = "toNet" | "toContract";

function parseAmount(value: string): number {
  const digitsOnly = value.replace(/[^0-9]/g, "");
  return digitsOnly === "" ? 0 : Number(digitsOnly);
}

function formatAmount(value: number): string {
  return value.toLocaleString("ko-KR");
}

function getInitialIsDark(): boolean {
  if (typeof window === "undefined") return false;
  const stored = localStorage.getItem("theme");
  if (stored) return stored === "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function useDarkMode() {
  const [isDark, setIsDark] = useState(getInitialIsDark);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    localStorage.setItem("theme", isDark ? "dark" : "light");
  }, [isDark]);

  return { isDark, toggle: () => setIsDark((prev) => !prev) };
}

export default function FreelancerCalculator() {
  const { isDark, toggle } = useDarkMode();
  const [tab, setTab] = useState<Tab>("toNet");
  const [contractInput, setContractInput] = useState("");
  const [netInput, setNetInput] = useState("");

  const contractAmount = parseAmount(contractInput);
  const netIncomeInput = parseAmount(netInput);

  const netResult = calculateNetIncome(contractAmount);
  const contractResult = calculateContractAmount(netIncomeInput);

  const activeMonthlyIncome = tab === "toNet" ? netResult.netIncome : netIncomeInput;
  const healthInsurance = estimateHealthInsurance(activeMonthlyIncome);

  return (
    <div className="mx-auto w-full max-w-lg">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            프리랜서 실수령액 계산기
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            3.3% 원천징수 기준으로 계산해요
          </p>
        </div>
        <button
          type="button"
          onClick={toggle}
          aria-label="다크모드 전환"
          suppressHydrationWarning
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-200 text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          {isDark ? "🌙" : "☀️"}
        </button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
        <button
          type="button"
          onClick={() => setTab("toNet")}
          className={`rounded-md py-2 text-sm font-medium transition-colors ${
            tab === "toNet"
              ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50"
              : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          계약금액 → 실수령액
        </button>
        <button
          type="button"
          onClick={() => setTab("toContract")}
          className={`rounded-md py-2 text-sm font-medium transition-colors ${
            tab === "toContract"
              ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50"
              : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          실수령액 → 계약금액
        </button>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        {tab === "toNet" ? (
          <div>
            <label
              htmlFor="contractAmount"
              className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              계약금액 (세전)
            </label>
            <div className="relative">
              <input
                id="contractAmount"
                type="text"
                inputMode="numeric"
                placeholder="0"
                value={contractInput === "" ? "" : formatAmount(contractAmount)}
                onChange={(e) => setContractInput(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-transparent px-4 py-3 pr-10 text-right text-lg text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:text-zinc-50 dark:focus:border-zinc-400"
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400">
                원
              </span>
            </div>

            <div className="mt-6 space-y-3 border-t border-zinc-100 pt-4 dark:border-zinc-800">
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-500 dark:text-zinc-400">원천징수세 (3.3%)</span>
                <span className="text-zinc-700 dark:text-zinc-300">
                  -{formatAmount(netResult.tax)}원
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium text-zinc-700 dark:text-zinc-300">실수령액</span>
                <span className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                  {formatAmount(netResult.netIncome)}원
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <label
              htmlFor="netIncome"
              className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              희망 실수령액
            </label>
            <div className="relative">
              <input
                id="netIncome"
                type="text"
                inputMode="numeric"
                placeholder="0"
                value={netInput === "" ? "" : formatAmount(netIncomeInput)}
                onChange={(e) => setNetInput(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-transparent px-4 py-3 pr-10 text-right text-lg text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:text-zinc-50 dark:focus:border-zinc-400"
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400">
                원
              </span>
            </div>

            <div className="mt-6 space-y-3 border-t border-zinc-100 pt-4 dark:border-zinc-800">
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-500 dark:text-zinc-400">원천징수세 (3.3%)</span>
                <span className="text-zinc-700 dark:text-zinc-300">
                  +{formatAmount(contractResult.tax)}원
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium text-zinc-700 dark:text-zinc-300">필요 계약금액</span>
                <span className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                  {formatAmount(contractResult.contractAmount)}원
                </span>
              </div>
            </div>
          </div>
        )}

        {healthInsurance.exceedsThreshold && activeMonthlyIncome > 0 && (
          <div className="mt-4 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-400">
            <span>⚠️</span>
            <span>
              월 소득이 {formatAmount(healthInsurance.threshold)}원 이상이에요. 건강보험 지역가입자
              전환 등으로 건보료가 부과될 수 있으니 확인해 보세요.
            </span>
          </div>
        )}
      </div>

      <p className="mt-4 text-center text-xs text-zinc-400 dark:text-zinc-500">
        실제 세금·보험료는 개인 상황에 따라 달라질 수 있어요. 참고용으로만 사용해 주세요.
      </p>
    </div>
  );
}
