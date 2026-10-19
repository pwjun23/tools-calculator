import { z } from "zod";

z.config(z.locales.ko());

const money = z.number().min(0);
const ratio = z.number().min(0).max(1);
const rate = z.number().min(0).max(0.3);

const loanSchema = z.object({
  name: z.string().trim().min(1).max(30),
  balance: money,
  rate,
  years: z.number().min(0.1).max(50),
  repayment: z.enum(["amortizing", "bullet"]),
  repaidIfHomeSold: z.boolean(),
});

/** 한 사용자가 고를 수 있는 시·군·구 수(공공 API 호출량 보호). */
export const MAX_REGIONS = 5;

/** 직장 수. 지금은 1곳, 나중에 늘린다. */
export const MAX_WORKPLACES = 1;

/** 학교 수. 아이 여럿·학교급이 다를 수 있어 4곳까지. */
export const MAX_SCHOOLS = 4;
export const SCHOOL_MODES = ["walk", "shuttle", "car", "transit"] as const;

/** 목록·알림에서 뺄 단지 수. */
export const MAX_EXCLUDED = 50;

const excludedAptSchema = z.object({
  sggCd: z.string().regex(/^\d{5}$/),
  dong: z.string().trim().min(1).max(30),
  apt: z.string().trim().min(1).max(100),
});

// 좌표는 도로명주소 좌표 API로 구해 저장한다. 그 키 승인 전 임시(카카오 실시간)에는 좌표 없이 주소만 저장하고,
// 목록을 열 때 주소로 좌표를 구한다(카카오 결과는 저장 금지).
const workplaceSchema = z
  .object({
    label: z.string().trim().min(1).max(20),
    address: z.string().trim().min(1).max(200),
    lat: z.number().min(33).max(39).optional(),
    lng: z.number().min(124).max(132).optional(),
  })
  .refine((w) => (w.lat === undefined) === (w.lng === undefined), { message: "위도와 경도는 함께 있어야 합니다", path: ["lat"] });

const schoolSchema = z
  .object({
    label: z.string().trim().min(1).max(20),
    address: z.string().trim().min(1).max(200),
    lat: z.number().min(33).max(39).optional(),
    lng: z.number().min(124).max(132).optional(),
    modes: z
      .array(z.enum(SCHOOL_MODES))
      .min(1, { message: "수단을 하나 이상 골라 주세요" })
      .refine((m) => new Set(m).size === m.length, { message: "같은 수단을 두 번 고를 수 없습니다" }),
  })
  .refine((w) => (w.lat === undefined) === (w.lng === undefined), { message: "위도와 경도는 함께 있어야 합니다", path: ["lat"] });

const settingsSchema = z.object({
  regions: z
    .array(
      z.object({
        sggCd: z.string().regex(/^\d{5}$/),
        label: z.string().trim().min(1).max(30),
        dongs: z.array(z.string().trim().min(1)).min(1),
      }),
    )
    .min(1)
    .max(MAX_REGIONS)
    .refine((rs) => new Set(rs.map((r) => r.sggCd)).size === rs.length, { message: "같은 시·군·구를 두 번 고를 수 없습니다" }),
  workplaces: z.array(workplaceSchema).max(MAX_WORKPLACES),
  schools: z.array(schoolSchema).max(MAX_SCHOOLS),
  /** 목록·알림에서 뺄 단지(예: 지금 사는 단지). 시세 계산에는 그대로 쓴다. */
  excludedApts: z.array(excludedAptSchema).max(MAX_EXCLUDED),
  cash: money,
  monthlyBudget: z.number().positive(),
  monthlyMgmt: money,
  minArea: money,
  excludeRenewal: z.boolean(),
  mortgageRate: rate,
  mortgageYears: z.number().min(1).max(50),
  ltvBuy: ratio,
  buyFeeRate: z.number().min(0).max(0.2),
  mortgageCap: money,
  rentLoanRate: rate,
  ltvRent: ratio,
  rentLoanCap: money,
  /** 월세를 전세로 환산할 때 쓰는 연 전환율(시세 비교용). 0이면 환산이 무한대라 1% 이상. */
  rentConvRate: z.number().min(0.01).max(0.2),
  annualIncome: money,
  dsrRatio: ratio,
  loans: z.array(loanSchema).max(10),
  ownedHome: z.object({
    has: z.boolean(),
    price: money,
    sellCostRate: z.number().min(0).max(0.2),
    planOnMove: z.enum(["keep", "sell"]),
    rentLoanAllowedIfKept: z.boolean(),
    mortgageAllowedIfKept: z.boolean(),
  }),
});

export type Settings = z.infer<typeof settingsSchema>;
export type Loan = z.infer<typeof loanSchema>;
export type Workplace = z.infer<typeof workplaceSchema>;
export type School = z.infer<typeof schoolSchema>;
export type ExcludedApt = z.infer<typeof excludedAptSchema>;

/** 처음 로그인한 사용자의 설정. 실제 개인 값이 아닌 일반적인 출발점이다. */
export const DEFAULT_SETTINGS: Settings = {
  regions: [{ sggCd: "41570", label: "경기 김포시", dongs: ["구래동", "마산동", "양촌읍"] }],
  workplaces: [],
  schools: [],
  excludedApts: [],
  cash: 5000,
  monthlyBudget: 150,
  monthlyMgmt: 25,
  minArea: 0,
  excludeRenewal: true,
  mortgageRate: 0.04,
  mortgageYears: 30,
  ltvBuy: 0.7,
  buyFeeRate: 0.012,
  mortgageCap: 60000,
  rentLoanRate: 0.04,
  ltvRent: 0.8,
  rentLoanCap: 20000,
  rentConvRate: 0.05,
  annualIncome: 0,
  dsrRatio: 0.4,
  loans: [],
  ownedHome: {
    has: false,
    price: 0,
    sellCostRate: 0.03,
    planOnMove: "keep",
    rentLoanAllowedIfKept: true,
    mortgageAllowedIfKept: true,
  },
};

export function parseSettings(
  input: unknown,
): { ok: true; settings: Settings } | { ok: false; errors: Record<string, string> } {
  const r = settingsSchema.safeParse(input);
  if (r.success) return { ok: true, settings: r.data };
  const errors: Record<string, string> = {};
  for (const issue of r.error.issues) {
    const path = issue.path.join(".") || "_";
    if (!errors[path]) errors[path] = issue.message;
  }
  return { ok: false, errors };
}

const LOAN_DEFAULT: Loan = { name: "대출", balance: 0, rate: 0, years: 1, repayment: "amortizing", repaidIfHomeSold: false };

/**
 * DB에서 읽은 설정에 새로 생긴 항목이 없으면 기본값으로 채운다(대출 항목 안쪽까지).
 * 그래도 맞지 않으면 기본값을 주되 valid=false 로 알린다. 호출하는 쪽은 이 값으로 알림을 보내거나 덮어쓰지 않는다.
 */
export function readStoredSettings(raw: unknown): { settings: Settings; valid: boolean } {
  if (!raw || typeof raw !== "object") return { settings: DEFAULT_SETTINGS, valid: true };
  const obj = raw as Record<string, unknown>;
  const merged = {
    ...DEFAULT_SETTINGS,
    ...obj,
    ownedHome: { ...DEFAULT_SETTINGS.ownedHome, ...((obj.ownedHome as object | undefined) ?? {}) },
    loans: Array.isArray(obj.loans) ? obj.loans.map((l) => ({ ...LOAN_DEFAULT, ...(l as object) })) : DEFAULT_SETTINGS.loans,
  };
  const r = parseSettings(merged);
  if (r.ok) return { settings: r.settings, valid: true };
  console.error("[whereToMove settings] 저장된 설정을 읽지 못했습니다", r.errors);
  return { settings: DEFAULT_SETTINGS, valid: false };
}

/** readStoredSettings 의 설정만 돌려준다. */
export function normalizeStoredSettings(raw: unknown): Settings {
  return readStoredSettings(raw).settings;
}
