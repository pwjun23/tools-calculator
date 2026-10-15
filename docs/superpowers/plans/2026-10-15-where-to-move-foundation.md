# whereToMove 1단계(기반) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 조건·판정·수집·알림을 Google Sheet/Apps Script에서 이 Next.js 앱 + Neon Postgres로 옮기고, 카카오 로그인과 웹 설정 화면을 만든다.

**Architecture:** 판정·파싱·메시지는 `lib/whereToMove/`의 순수 함수(테스트 대상)이고, DB 접근은 `repo.ts` 한 곳에 모은다. 수집과 주간 알림은 Vercel Cron이 부르는 Route Handler이며 `CRON_SECRET`으로 보호한다. 로그인은 Better Auth(카카오 소셜, drizzle 어댑터)이고, 카카오 토큰은 암호화해 `account` 표에 저장한 뒤 알림에 재사용한다.

**Tech Stack:** Next.js 16.3.5 (App Router, `proxy.ts`), React 19, TypeScript, Vitest, better-auth 1.7.8, drizzle-orm 0.45.x + drizzle-kit 0.31.x, pg 8, zod 4.6.x, fast-xml-parser 5.x, tsx(스크립트 실행), Vercel Cron, Neon(Vercel Marketplace)

**Spec:** `docs/superpowers/specs/2026-10-15-where-to-move-foundation-design.md`

## Global Constraints

- 이 저장소는 공개 저장소다. 실제 소득·대출·자산·카카오 ID·API 키 값을 코드, 테스트, 문서, 커밋에 넣지 않는다. 테스트 값은 모두 가상이다.
- 금액 단위는 만원, 비율은 0~1 소수, 기간은 년이다(설정 JSON과 판정 함수 모두).
- 화면으로 내보내는 판정 결과에는 사용자 조건 수치(현금, 소득, 비율, 한도)를 넣지 않는다. 필요 대출·월 부담·여유·사유 이름만 내보낸다.
- 부적합 사유 문자열은 정확히 `대출 한도 초과`, `대출 비율 초과`, `DSR 초과`, `예산 초과`이며 이 순서로 나열한다.
- 거래 키 형식은 `유형|단지|동|면적|층|계약일|금액|월세`(현재 Apps Script `dealKey_`와 같음)이다.
- Cron 일정: 수집 `0 21 * * *`(매일 06시 KST), 알림 `0 23 * * 0`(월요일 08시 KST).
- 카카오 동의 범위는 `profile_nickname`, `talk_message`만 요청한다(`account_email`은 비즈 앱 전용이라 요청하지 않음).
- 카카오 메시지 버튼 주소는 `https://tools.molespapa.com/whereToMove`, 버튼 이름은 `실거래 보기`다.
- Next.js 코드를 쓰기 전에 `node_modules/next/dist/docs/`의 해당 문서를 확인한다(이 저장소 AGENTS.md 규칙).
- 커밋 메시지 끝에는 다음 두 줄을 붙인다:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01FSrCBnDvxCnDf8cKSTEwxh`
- 작업 브랜치는 `feature/where-to-move-foundation`이다. main 머지와 push는 사용자 확인 뒤에만 한다.

## Review Focus

1. 카카오 로그인 때 `talk_message` 동의를 거부한 사용자: 로그인은 되지만 알림 전송이 403으로 실패한다. 실패를 기록하고 목록 화면에 안내 배너를 띄워야 한다 → Task 9(`sendKakaoMemo`가 비정상 응답에서 상태 코드를 담은 오류를 던지는 테스트), Task 7(배너).
2. 국토부 응답에 거래가 0건(`<items/>`)이거나 1건(배열이 아닌 객체)인 경우: 파싱이 깨지지 않아야 한다 → Task 4 테스트.
3. 금액에 공백·쉼표가 섞이거나 월세 칸이 비어 있는 경우: 0이나 올바른 숫자로 읽어야 한다 → Task 4 테스트.
4. DB에 저장된 예전 설정 JSON에 새로 생긴 항목이 없는 경우: 기본값으로 채워서 읽어야 한다 → Task 2 `normalizeStoredSettings` 테스트.
5. 금리 0, 소득 0, 대출 비율 100% 같은 경계값: 0으로 나누기나 NaN 없이 계산돼야 한다 → Task 3 테스트.

---

## 파일 구조

| 파일 | 책임 |
|---|---|
| `lib/whereToMove/types.ts` | 공용 타입: `DealType`, `MolitDeal`, `StoredDeal` |
| `lib/whereToMove/settings.ts` | 설정 스키마(zod), 기본값, `parseSettings`, `normalizeStoredSettings` |
| `lib/whereToMove/judge.ts` | `monthlyPayment`, `deriveParams`, `evaluateDeal`, `filterDeals`, `priceLimits` |
| `lib/whereToMove/molit.ts` | 국토부 API 키 처리, XML 파싱, 거래 정규화, `fetchDeals`, `recentMonths` |
| `lib/whereToMove/message.ts` | `shortWon`, `buildWeeklyMessage` |
| `lib/whereToMove/kakao.ts` | `buildMemoTemplate`, `sendKakaoMemo` |
| `lib/whereToMove/cron.ts` | `isCronAuthorized` |
| `lib/whereToMove/allowlist.ts` | `isAllowedKakaoId` |
| `lib/whereToMove/schema.ts` | drizzle 표 정의(인증 4개 + wtm 3개) |
| `lib/whereToMove/db.ts` | pg Pool + drizzle 인스턴스 |
| `lib/whereToMove/repo.ts` | DB 조회·저장 함수 |
| `lib/whereToMove/auth.ts` | Better Auth 서버 설정 |
| `lib/whereToMove/auth-client.ts` | Better Auth 브라우저 클라이언트 |
| `lib/whereToMove/current-user.ts` | `requireUser()` (세션 없으면 로그인으로) |
| `app/api/auth/[...all]/route.ts` | Better Auth 핸들러 |
| `app/api/where-to-move/cron/collect/route.ts` | 수집 Cron |
| `app/api/where-to-move/cron/notify/route.ts` | 알림 Cron |
| `app/whereToMove/login/page.tsx`, `KakaoLoginButton.tsx` | 카카오 로그인 화면 |
| `app/whereToMove/page.tsx`, `GimpoBoard.tsx` | 목록(DB에서 읽음) |
| `app/whereToMove/settings/page.tsx`, `SettingsForm.tsx`, `actions.ts` | 설정 화면 |
| `proxy.ts` | `/whereToMove` 세션 쿠키 확인 |
| `vercel.json` | Cron 일정 |
| `drizzle.config.ts`, `drizzle/` | 마이그레이션 |
| `scripts/where-to-move/import-settings.ts`, `compare-sheet.ts` | 1회 이전, 로컬 비교(입력 파일은 저장소 밖) |

삭제: `lib/whereToMove/session.ts`, `lib/whereToMove/session.test.ts`, `app/whereToMove/login/actions.ts`, `app/whereToMove/login/layout.tsx`(Task 6), `app/whereToMove/actions.ts`(Task 7). `app/api/where-to-move/revalidate/route.ts`는 Task 11(정리)에서 삭제한다.

---

### Task 1: 의존성, Neon 연결, DB 스키마

**Files:**
- Modify: `package.json`
- Create: `lib/whereToMove/types.ts`, `lib/whereToMove/schema.ts`, `lib/whereToMove/db.ts`, `drizzle.config.ts`, `drizzle/`(생성됨)

**Interfaces:**
- Produces: `DealType`, `MolitDeal`, `StoredDeal`(types.ts). 표 `user`, `session`, `account`, `verification`, `wtmSettings`, `wtmDeals`, `wtmNotifyLog`(schema.ts). `db`(db.ts).

- [ ] **Step 1: 패키지 설치**

```bash
cd D:/prj/tools-calculator
npm i better-auth@1.7.8 drizzle-orm@^0.45.4 pg@^8 zod@^4.6.7 fast-xml-parser@^5.11.2
npm i -D drizzle-kit@^0.31.11 @types/pg@^8 tsx@^4
```

- [ ] **Step 2: Vercel 프로젝트 연결과 Neon 추가 (사용자 확인 단계)**

```bash
vercel link            # tools.molespapa.com 이 연결된 프로젝트를 고른다. 이름이 확실하지 않으면 사용자에게 묻는다.
vercel integration add neon --no-claim
vercel env pull .env.local --yes
```

`integration add`가 브라우저나 약관 동의를 요구하면 멈추고, 사용자에게 완료를 부탁한 뒤 이어서 진행한다.
`.env.local`에 `DATABASE_URL`이 있는지 이름만 확인한다(값은 출력하지 않는다):

```bash
grep -o '^[A-Z_]*' .env.local | grep DATABASE
```

Expected: `DATABASE_URL`(과 보통 `DATABASE_URL_UNPOOLED`)가 보인다. `.gitignore`의 `.env*` 규칙 때문에 이 파일은 커밋되지 않는다.

- [ ] **Step 3: `lib/whereToMove/types.ts` 작성**

```ts
export type DealType = "매매" | "전세" | "월세";

/** 국토부 API 응답 한 건을 정규화한 거래. 금액·월세는 만원. */
export interface MolitDeal {
  key: string;
  type: DealType;
  sggCd: string;
  dong: string;
  apt: string;
  /** 전용면적 반올림(㎡) */
  area: number;
  /** 전용면적 원래 값(㎡) */
  areaRaw: number;
  floor: string;
  /** 계약일 YYYY-MM-DD */
  date: string;
  amount: number;
  rent: number;
  renewal: boolean;
  cancelled: boolean;
}

/** DB에 저장된 거래 */
export interface StoredDeal extends MolitDeal {
  firstSeenAt: Date;
}
```

- [ ] **Step 4: `lib/whereToMove/schema.ts` 작성**

인증 표는 Better Auth 1.7.8 코어 스키마(`@better-auth/core/dist/db/get-tables.mjs`)의 필드 이름을 그대로 JS 키로 쓴다. 칸 이름은 snake_case다.

```ts
import { boolean, date, index, integer, jsonb, pgTable, real, serial, text, timestamp } from "drizzle-orm/pg-core";
import type { Settings } from "./settings";
import type { DealType } from "./types";

// ---- Better Auth 표 ----
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---- whereToMove 표 ----
export const wtmSettings = pgTable("wtm_settings", {
  userId: text("user_id").primaryKey().references(() => user.id, { onDelete: "cascade" }),
  data: jsonb("data").$type<Settings>().notNull(),
  notifyEnabled: boolean("notify_enabled").notNull().default(true),
  lastNotifiedAt: timestamp("last_notified_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const wtmDeals = pgTable(
  "wtm_deals",
  {
    dealKey: text("deal_key").primaryKey(),
    type: text("type").$type<DealType>().notNull(),
    sggCd: text("sgg_cd").notNull(),
    dong: text("dong").notNull(),
    apt: text("apt").notNull(),
    area: integer("area").notNull(),
    areaRaw: real("area_raw").notNull(),
    floor: text("floor").notNull(),
    dealDate: date("deal_date").notNull(),
    amount: integer("amount").notNull(),
    rent: integer("rent").notNull(),
    renewal: boolean("renewal").notNull(),
    cancelled: boolean("cancelled").notNull().default(false),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("wtm_deals_sgg_date_idx").on(t.sggCd, t.dealDate), index("wtm_deals_first_seen_idx").on(t.firstSeenAt)],
);

export const wtmNotifyLog = pgTable("wtm_notify_log", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  newCount: integer("new_count").notNull(),
  okCount: integer("ok_count").notNull(),
  status: text("status").$type<"sent" | "failed">().notNull(),
  error: text("error"),
});
```

`schema.ts`는 `./settings`의 `Settings` 타입을 쓴다. Task 2보다 먼저 컴파일하면 실패하므로, 이 단계에서는 `lib/whereToMove/settings.ts`에 임시로 `export type Settings = Record<string, unknown>;` 한 줄만 두고 Task 2에서 덮어쓴다.

- [ ] **Step 5: `lib/whereToMove/db.ts` 작성**

```ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// 요청 사이에 Fluid Compute 인스턴스가 재사용되므로 Pool 하나를 모듈 수준에서 공유한다.
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });

export const db = drizzle(pool, { schema });
```

- [ ] **Step 6: `drizzle.config.ts`와 npm 스크립트**

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./lib/whereToMove/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "" },
});
```

`package.json`의 `scripts`에 추가:

```json
"db:generate": "drizzle-kit generate",
"db:migrate": "node --env-file=.env.local ./node_modules/drizzle-kit/bin.cjs migrate"
```

`node_modules/drizzle-kit/bin.cjs`가 있는지 `ls node_modules/drizzle-kit/bin.cjs`로 확인한다. 없으면 `package.json`의 `bin` 항목이 가리키는 파일로 바꾼다.

- [ ] **Step 7: 마이그레이션 생성과 적용**

```bash
npm run db:generate
npm run db:migrate
```

Expected: `drizzle/0000_*.sql`이 생기고, migrate가 오류 없이 끝난다. 표가 생겼는지 확인:

```bash
node --env-file=.env.local -e "const {Pool}=require('pg');const p=new Pool({connectionString:process.env.DATABASE_URL});p.query(\"select table_name from information_schema.tables where table_schema='public' order by 1\").then(r=>{console.log(r.rows.map(x=>x.table_name).join(','));return p.end()})"
```

Expected: `__drizzle_migrations`(스키마에 따라 다를 수 있음)와 `account,session,user,verification,wtm_deals,wtm_notify_log,wtm_settings`가 보인다.

- [ ] **Step 8: 타입 검사와 커밋**

```bash
npx tsc --noEmit
git add package.json package-lock.json lib/whereToMove/types.ts lib/whereToMove/schema.ts lib/whereToMove/db.ts lib/whereToMove/settings.ts drizzle.config.ts drizzle
git commit -m "feat(whereToMove): DB 스키마와 Neon 연결"
```

---

### Task 2: 설정 스키마와 기본값

**Files:**
- Create: `lib/whereToMove/settings.ts` (Task 1의 임시 내용을 덮어씀)
- Test: `lib/whereToMove/settings.test.ts`

**Interfaces:**
- Produces:
  - `type Settings`, `type Loan`
  - `const DEFAULT_SETTINGS: Settings`
  - `parseSettings(input: unknown): { ok: true; settings: Settings } | { ok: false; errors: Record<string, string> }`
  - `normalizeStoredSettings(raw: unknown): Settings`

- [ ] **Step 1: 실패하는 테스트 작성** — `lib/whereToMove/settings.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, normalizeStoredSettings, parseSettings } from "./settings";

describe("parseSettings", () => {
  it("기본값은 통과한다", () => {
    const r = parseSettings(DEFAULT_SETTINGS);
    expect(r.ok).toBe(true);
  });

  it("비율이 1을 넘으면 항목 경로와 함께 오류를 낸다", () => {
    const r = parseSettings({ ...DEFAULT_SETTINGS, ltvRent: 1.2 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors)).toContain("ltvRent");
  });

  it("기존 대출 항목의 잘못된 상환 방식을 잡는다", () => {
    const r = parseSettings({
      ...DEFAULT_SETTINGS,
      loans: [{ name: "가상 대출", balance: 1000, rate: 0.05, years: 10, repayment: "weird", repaidIfHomeSold: false }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors)).toContain("loans.0.repayment");
  });

  it("지역 동 목록이 비면 실패한다", () => {
    const r = parseSettings({ ...DEFAULT_SETTINGS, regions: [{ sggCd: "41570", label: "김포", dongs: [] }] });
    expect(r.ok).toBe(false);
  });
});

describe("normalizeStoredSettings", () => {
  it("예전 JSON에 없는 항목은 기본값으로 채운다", () => {
    const old: Record<string, unknown> = { ...DEFAULT_SETTINGS, cash: 1234 };
    delete old.mortgageCap;
    const s = normalizeStoredSettings(old);
    expect(s.cash).toBe(1234);
    expect(s.mortgageCap).toBe(DEFAULT_SETTINGS.mortgageCap);
  });

  it("검증에 실패한 저장값이면 기본값을 돌려준다", () => {
    expect(normalizeStoredSettings({ cash: -5 })).toEqual(DEFAULT_SETTINGS);
    expect(normalizeStoredSettings(null)).toEqual(DEFAULT_SETTINGS);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run lib/whereToMove/settings.test.ts`
Expected: FAIL (`DEFAULT_SETTINGS`가 없음)

- [ ] **Step 3: 구현** — `lib/whereToMove/settings.ts`

```ts
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

const settingsSchema = z.object({
  // 1단계는 지역 1개만 쓴다(2단계에서 여러 개로 넓힘).
  regions: z
    .array(
      z.object({
        sggCd: z.string().regex(/^\d{5}$/),
        label: z.string().trim().min(1).max(20),
        dongs: z.array(z.string().trim().min(1)).min(1),
      }),
    )
    .length(1),
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

/** 처음 로그인한 사용자의 설정. 실제 개인 값이 아닌 일반적인 출발점이다. */
export const DEFAULT_SETTINGS: Settings = {
  regions: [{ sggCd: "41570", label: "김포", dongs: ["구래동", "마산동", "양촌읍"] }],
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

/** DB에서 읽은 설정에 새로 생긴 항목이 없으면 기본값으로 채운다. 그래도 맞지 않으면 기본값. */
export function normalizeStoredSettings(raw: unknown): Settings {
  if (!raw || typeof raw !== "object") return DEFAULT_SETTINGS;
  const merged = {
    ...DEFAULT_SETTINGS,
    ...(raw as Record<string, unknown>),
    ownedHome: { ...DEFAULT_SETTINGS.ownedHome, ...((raw as { ownedHome?: object }).ownedHome ?? {}) },
  };
  const r = parseSettings(merged);
  return r.ok ? r.settings : DEFAULT_SETTINGS;
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run lib/whereToMove/settings.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: 커밋**

```bash
npx tsc --noEmit
git add lib/whereToMove/settings.ts lib/whereToMove/settings.test.ts
git commit -m "feat(whereToMove): 설정 스키마와 기본값"
```

---

### Task 3: 판정 계산

**Files:**
- Create: `lib/whereToMove/judge.ts`
- Test: `lib/whereToMove/judge.test.ts`

**Interfaces:**
- Consumes: `Settings`(Task 2), `DealType`(Task 1)
- Produces:
  - `interface JudgeParams { cash; budget; mgmt; fee; factor; rentRate; rentCap; mortgageCap; dsrMonthly; ltvBuy; ltvRent }` (모두 number)
  - `interface Derived extends JudgeParams { available: number; existingMonthly: number; sellExtra: number }`
  - `type RejectReason = "대출 한도 초과" | "대출 비율 초과" | "DSR 초과" | "예산 초과"`
  - `interface Evaluation { ok: boolean; loan: number; carry: number; monthly: number; margin: number; reasons: RejectReason[] }`
  - `monthlyPayment(balance: number, rate: number, years: number): number`
  - `deriveParams(s: Settings): Derived`
  - `evaluateDeal(p: JudgeParams, d: { type: DealType; amount: number; rent: number }): Evaluation`
  - `filterDeals<T extends { dong: string; areaRaw: number; renewal: boolean; cancelled: boolean; sggCd: string }>(s: Settings, deals: T[]): T[]`
  - `priceLimits(p: JudgeParams): { jeonseMax: number; buyMax: number }`

- [ ] **Step 1: 실패하는 테스트 작성** — `lib/whereToMove/judge.test.ts`

모든 값은 가상이다. 기대값은 현재 시트 수식(`조건`·`내자산부채`·`한도계산`)과 Code.gs `evaluateDeal_`로 손계산한 값이다.

```ts
import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, type Settings } from "./settings";
import { deriveParams, evaluateDeal, filterDeals, monthlyPayment, priceLimits, type JudgeParams } from "./judge";

const base: Settings = {
  ...DEFAULT_SETTINGS,
  cash: 5000,
  monthlyBudget: 150,
  monthlyMgmt: 25,
  annualIncome: 3000,
  dsrRatio: 0.4,
  loans: [
    { name: "가상 주택대출", balance: 10000, rate: 0.03, years: 20, repayment: "amortizing", repaidIfHomeSold: true },
    { name: "가상 만기대출", balance: 2000, rate: 0.06, years: 1, repayment: "bullet", repaidIfHomeSold: false },
  ],
  ownedHome: { has: true, price: 30000, sellCostRate: 0.03, planOnMove: "keep", rentLoanAllowedIfKept: true, mortgageAllowedIfKept: false },
};

describe("monthlyPayment", () => {
  it("원리금균등 월 상환액", () => {
    expect(monthlyPayment(1, 0.04, 30)).toBeCloseTo(0.004774152954654538, 12);
    expect(monthlyPayment(10000, 0.03, 20)).toBeCloseTo(55.459759785392066, 9);
  });
  it("금리 0이면 원금 / 개월 수", () => {
    expect(monthlyPayment(1200, 0, 10)).toBe(10);
  });
});

describe("deriveParams", () => {
  it("보유 유지: 기존 대출이 DSR 한도를 줄이고, 주담대 불가면 매매 비율 0", () => {
    const p = deriveParams(base);
    expect(p.available).toBe(125);
    expect(p.factor).toBeCloseTo(0.004774152954654538, 12);
    expect(p.existingMonthly).toBeCloseTo(65.45975978539207, 9);
    expect(p.dsrMonthly).toBeCloseTo(34.540240214607934, 9);
    expect(p.sellExtra).toBe(0);
    expect(p.cash).toBe(5000);
    expect(p.ltvBuy).toBe(0);
    expect(p.ltvRent).toBe(0.8);
  });

  it("매도: 매도 순현금이 현금에 더해지고 그 집 대출은 DSR에서 빠진다", () => {
    const p = deriveParams({ ...base, ownedHome: { ...base.ownedHome, planOnMove: "sell" } });
    expect(p.sellExtra).toBe(19100);
    expect(p.cash).toBe(24100);
    expect(p.dsrMonthly).toBe(90);
    expect(p.ltvBuy).toBe(0.7);
  });

  it("소득 0이면 DSR 대신 월 가용액", () => {
    const p = deriveParams({ ...base, annualIncome: 0 });
    expect(p.dsrMonthly).toBe(125);
  });

  it("기존 대출 상환이 DSR 한도를 넘으면 0", () => {
    const p = deriveParams({ ...base, annualIncome: 100 });
    expect(p.dsrMonthly).toBe(0);
  });

  it("관리비가 예산보다 크면 가용액 0", () => {
    expect(deriveParams({ ...base, monthlyMgmt: 200 }).available).toBe(0);
  });
});

const P: JudgeParams = {
  cash: 5000, budget: 150, mgmt: 25, fee: 0.012, factor: 0.004774152954654538,
  rentRate: 0.04, rentCap: 20000, mortgageCap: 60000, dsrMonthly: 90, ltvBuy: 0.7, ltvRent: 0.8,
};

describe("evaluateDeal", () => {
  it("전세 적합", () => {
    const e = evaluateDeal(P, { type: "전세", amount: 20000, rent: 0 });
    expect(e).toMatchObject({ ok: true, loan: 15000, carry: 50, monthly: 75, margin: 75, reasons: [] });
  });

  it("전세: 한도와 비율 초과는 여유가 있어도 부적합", () => {
    const e = evaluateDeal(P, { type: "전세", amount: 26000, rent: 0 });
    expect(e.ok).toBe(false);
    expect(e.margin).toBe(55);
    expect(e.reasons).toEqual(["대출 한도 초과", "대출 비율 초과"]);
  });

  it("월세 적합", () => {
    const e = evaluateDeal(P, { type: "월세", amount: 10000, rent: 60 });
    expect(e.ok).toBe(true);
    expect(e.monthly).toBeCloseTo(101.66666666666667, 9);
  });

  it("월세 예산 초과", () => {
    const e = evaluateDeal(P, { type: "월세", amount: 3000, rent: 130 });
    expect(e).toMatchObject({ ok: false, loan: 0, monthly: 155, margin: -5, reasons: ["예산 초과"] });
  });

  it("매매: 비율과 DSR 초과", () => {
    const e = evaluateDeal(P, { type: "매매", amount: 30000, rent: 0 });
    expect(e.loan).toBe(25360);
    expect(e.carry).toBeCloseTo(121.07251893003908, 9);
    expect(e.reasons).toEqual(["대출 비율 초과", "DSR 초과"]);
  });

  it("매매: 주담대 최대 금액 초과", () => {
    const e = evaluateDeal({ ...P, ltvBuy: 1, dsrMonthly: 1e9, budget: 1e9 }, { type: "매매", amount: 100000, rent: 0 });
    expect(e.loan).toBe(96200);
    expect(e.reasons).toEqual(["대출 한도 초과"]);
  });

  it("대출 비율 100%여도 NaN이 없다", () => {
    const e = evaluateDeal({ ...P, ltvRent: 1, rentRate: 0 }, { type: "전세", amount: 20000, rent: 0 });
    expect(Number.isFinite(e.monthly)).toBe(true);
  });
});

describe("priceLimits", () => {
  it("한도계산 시트와 같은 상한 (10만원 단위 내림)", () => {
    expect(priceLimits(P)).toEqual({ jeonseMax: 25000, buyMax: 16020 });
  });
  it("금리 0이어도 유한한 값", () => {
    const r = priceLimits({ ...P, rentRate: 0 });
    expect(Number.isFinite(r.jeonseMax)).toBe(true);
  });
});

describe("filterDeals", () => {
  const mk = (o: Partial<{ dong: string; areaRaw: number; renewal: boolean; cancelled: boolean; sggCd: string }>) => ({
    dong: "구래동", areaRaw: 84.9, renewal: false, cancelled: false, sggCd: "41570", ...o,
  });

  it("지역 동, 최소 면적, 갱신, 해제를 거른다", () => {
    const s: Settings = { ...DEFAULT_SETTINGS, minArea: 75, excludeRenewal: true };
    const out = filterDeals(s, [
      mk({}),
      mk({ dong: "장기동" }),
      mk({ areaRaw: 59.9 }),
      mk({ renewal: true }),
      mk({ cancelled: true }),
      mk({ sggCd: "11110" }),
    ]);
    expect(out).toHaveLength(1);
  });

  it("갱신 포함 설정이면 갱신 거래도 남긴다", () => {
    const s: Settings = { ...DEFAULT_SETTINGS, excludeRenewal: false };
    expect(filterDeals(s, [mk({ renewal: true })])).toHaveLength(1);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run lib/whereToMove/judge.test.ts`
Expected: FAIL (`./judge` 모듈 없음)

- [ ] **Step 3: 구현** — `lib/whereToMove/judge.ts`

```ts
import type { Settings } from "./settings";
import type { DealType } from "./types";

export interface JudgeParams {
  cash: number;
  budget: number;
  mgmt: number;
  fee: number;
  factor: number;
  rentRate: number;
  rentCap: number;
  mortgageCap: number;
  dsrMonthly: number;
  ltvBuy: number;
  ltvRent: number;
}

export interface Derived extends JudgeParams {
  available: number;
  existingMonthly: number;
  sellExtra: number;
}

export type RejectReason = "대출 한도 초과" | "대출 비율 초과" | "DSR 초과" | "예산 초과";

export interface Evaluation {
  ok: boolean;
  loan: number;
  carry: number;
  monthly: number;
  margin: number;
  reasons: RejectReason[];
}

const EPS = 1e-9;
const HUGE = 1e9;

/** 원리금균등 월 상환액. 금리 0이면 원금 / 개월 수. */
export function monthlyPayment(balance: number, rate: number, years: number): number {
  const n = years * 12;
  if (n <= 0) return 0;
  if (rate === 0) return balance / n;
  const r = rate / 12;
  return (balance * r) / (1 - Math.pow(1 + r, -n));
}

/** 시트 '조건'·'내자산부채'의 계산값을 재현한다. */
export function deriveParams(s: Settings): Derived {
  const selling = s.ownedHome.has && s.ownedHome.planOnMove === "sell";
  const keeping = s.ownedHome.has && s.ownedHome.planOnMove === "keep";

  const remainingLoans = s.loans.filter((l) => !(selling && l.repaidIfHomeSold));
  const existingMonthly = remainingLoans.reduce(
    (sum, l) => sum + (l.repayment === "amortizing" ? monthlyPayment(l.balance, l.rate, l.years) : (l.balance * l.rate) / 12),
    0,
  );
  const repaidOnSale = s.loans.filter((l) => l.repaidIfHomeSold).reduce((sum, l) => sum + l.balance, 0);
  const sellExtra = selling ? Math.max(s.ownedHome.price * (1 - s.ownedHome.sellCostRate) - repaidOnSale, 0) : 0;

  const available = Math.max(s.monthlyBudget - s.monthlyMgmt, 0);
  const dsrMonthly =
    s.annualIncome > 0
      ? Math.min(available, Math.max(s.annualIncome * s.dsrRatio - existingMonthly * 12, 0) / 12)
      : available;

  return {
    cash: s.cash + sellExtra,
    budget: s.monthlyBudget,
    mgmt: s.monthlyMgmt,
    fee: s.buyFeeRate,
    factor: monthlyPayment(1, s.mortgageRate, s.mortgageYears),
    rentRate: s.rentLoanRate,
    rentCap: s.rentLoanCap,
    mortgageCap: s.mortgageCap,
    dsrMonthly,
    ltvBuy: keeping && !s.ownedHome.mortgageAllowedIfKept ? 0 : s.ltvBuy,
    ltvRent: keeping && !s.ownedHome.rentLoanAllowedIfKept ? 0 : s.ltvRent,
    available,
    existingMonthly,
    sellExtra,
  };
}

/** Code.gs evaluateDeal_ 와 같은 판정. */
export function evaluateDeal(p: JudgeParams, d: { type: DealType; amount: number; rent: number }): Evaluation {
  let loan: number;
  let ratioOk: boolean;
  let capOk: boolean;
  let carry: number;
  if (d.type === "매매") {
    loan = Math.max(d.amount * (1 + p.fee) - p.cash, 0);
    ratioOk = loan <= d.amount * p.ltvBuy + EPS;
    capOk = loan <= p.mortgageCap + EPS;
    carry = loan * p.factor;
  } else {
    loan = Math.max(d.amount - p.cash, 0);
    ratioOk = loan <= d.amount * p.ltvRent + EPS;
    capOk = loan <= p.rentCap + EPS;
    carry = (loan * p.rentRate) / 12;
  }
  const monthly = (d.type === "월세" ? d.rent : 0) + p.mgmt + carry;
  const reasons: RejectReason[] = [];
  if (!capOk) reasons.push("대출 한도 초과");
  if (!ratioOk) reasons.push("대출 비율 초과");
  if (carry > p.dsrMonthly + EPS) reasons.push("DSR 초과");
  if (monthly > p.budget + EPS) reasons.push("예산 초과");
  return { ok: reasons.length === 0, loan, carry, monthly, margin: p.budget - monthly, reasons };
}

/** 사용자 지역·면적·갱신 조건과 해제 여부로 거른다. */
export function filterDeals<T extends { dong: string; areaRaw: number; renewal: boolean; cancelled: boolean; sggCd: string }>(
  s: Settings,
  deals: T[],
): T[] {
  return deals.filter((d) => {
    if (d.cancelled) return false;
    const region = s.regions.find((r) => r.sggCd === d.sggCd);
    if (!region || !region.dongs.includes(d.dong)) return false;
    if (s.minArea > 0 && d.areaRaw < s.minArea) return false;
    if (s.excludeRenewal && d.renewal) return false;
    return true;
  });
}

const floor10 = (v: number) => Math.floor(v / 10) * 10;

/** 시트 '한도계산'의 전세금 상한·매매가 상한. */
export function priceLimits(p: JudgeParams): { jeonseMax: number; buyMax: number } {
  const jeonseByDsr = p.rentRate > 0 ? p.cash + (p.dsrMonthly * 12) / p.rentRate : HUGE;
  const jeonseByRatio = p.ltvRent < 1 ? p.cash / (1 - p.ltvRent) : HUGE;
  const jeonseByCap = p.cash + p.rentCap;

  const buyByDsr = p.factor > 0 ? (p.cash + p.dsrMonthly / p.factor) / (1 + p.fee) : HUGE;
  const buyByRatio = 1 + p.fee - p.ltvBuy > 0 ? p.cash / (1 + p.fee - p.ltvBuy) : HUGE;
  const buyByCap = (p.cash + p.mortgageCap) / (1 + p.fee);

  return {
    jeonseMax: floor10(Math.min(jeonseByDsr, jeonseByRatio, jeonseByCap)),
    buyMax: floor10(Math.min(buyByDsr, buyByRatio, buyByCap)),
  };
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run lib/whereToMove/judge.test.ts`
Expected: PASS (전부)

- [ ] **Step 5: 커밋**

```bash
git add lib/whereToMove/judge.ts lib/whereToMove/judge.test.ts
git commit -m "feat(whereToMove): 판정 계산 (시트·Code.gs 이식)"
```

---

### Task 4: 국토부 API 파싱과 정규화

**Files:**
- Create: `lib/whereToMove/molit.ts`
- Test: `lib/whereToMove/molit.test.ts`

**Interfaces:**
- Consumes: `MolitDeal`, `DealType`(Task 1)
- Produces:
  - `TRADE_URL`, `RENT_URL` (string 상수)
  - `apiKeyParam(raw: string): string`
  - `parseMoney(s: unknown): number`
  - `parseItems(xml: string): { total: number; rows: Record<string, string>[] }` (오류 코드면 throw)
  - `normalizeTrade(it: Record<string, string>, sggCd: string): MolitDeal | null`
  - `normalizeRent(it: Record<string, string>, sggCd: string): MolitDeal | null`
  - `dealKey(d: Pick<MolitDeal, "type"|"apt"|"dong"|"area"|"floor"|"date"|"amount"|"rent">): string`
  - `recentMonths(n: number, now?: Date): string[]` (KST 기준 `YYYYMM`, 이번 달부터)
  - `fetchDeals(sggCd: string, ym: string, keys: { trade: string; rent: string }, fetchFn?: typeof fetch): Promise<MolitDeal[]>`

- [ ] **Step 1: 실패하는 테스트 작성** — `lib/whereToMove/molit.test.ts`

XML은 가상의 거래로 만든 것이다. 실제 응답과 같은 태그 이름(`umdNm`, `aptNm`, `excluUseAr`, `dealAmount`, `deposit`, `monthlyRent`, `contractType`, `cdealType`)을 쓴다.

```ts
import { describe, expect, it } from "vitest";
import { apiKeyParam, dealKey, fetchDeals, normalizeRent, normalizeTrade, parseItems, parseMoney, recentMonths } from "./molit";

const wrap = (items: string, total: number) =>
  `<?xml version="1.0" encoding="UTF-8"?><response><header><resultCode>000</resultCode><resultMsg>OK</resultMsg></header>` +
  `<body><items>${items}</items><numOfRows>1000</numOfRows><pageNo>1</pageNo><totalCount>${total}</totalCount></body></response>`;

const tradeItem = (o: Record<string, string>) =>
  `<item>${Object.entries({ umdNm: "구래동", aptNm: "가상아파트", excluUseAr: "84.97", floor: "7", dealYear: "2026", dealMonth: "9", dealDay: "3", dealAmount: " 35,500", cdealType: "", cdealDay: "", ...o })
    .map(([k, v]) => `<${k}>${v}</${k}>`).join("")}</item>`;

describe("parseItems", () => {
  it("여러 건", () => {
    const r = parseItems(wrap(tradeItem({}) + tradeItem({ floor: "8" }), 2));
    expect(r.total).toBe(2);
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0].dealAmount).toBe("35,500");
  });
  it("한 건이어도 배열", () => {
    expect(parseItems(wrap(tradeItem({}), 1)).rows).toHaveLength(1);
  });
  it("0건", () => {
    expect(parseItems(wrap("", 0))).toEqual({ total: 0, rows: [] });
  });
  it("오류 코드면 throw", () => {
    const xml = `<response><header><resultCode>30</resultCode><resultMsg>SERVICE KEY IS NOT REGISTERED</resultMsg></header></response>`;
    expect(() => parseItems(xml)).toThrow(/30/);
  });
  it("response가 아니면 throw", () => {
    expect(() => parseItems("<OpenAPI_ServiceResponse><cmmMsgHeader/></OpenAPI_ServiceResponse>")).toThrow();
  });
});

describe("parseMoney", () => {
  it.each([[" 35,500", 35500], ["", 0], [undefined, 0], ["120", 120]])("%s → %i", (s, n) => {
    expect(parseMoney(s)).toBe(n);
  });
});

describe("normalizeTrade", () => {
  it("매매 정규화", () => {
    const d = normalizeTrade(parseItems(wrap(tradeItem({}), 1)).rows[0], "41570")!;
    expect(d).toMatchObject({ type: "매매", sggCd: "41570", dong: "구래동", area: 85, areaRaw: 84.97, floor: "7", date: "2026-09-03", amount: 35500, rent: 0, renewal: false, cancelled: false });
    expect(d.key).toBe("매매|가상아파트|구래동|85|7|2026-09-03|35500|0");
  });
  it("해제 거래는 cancelled", () => {
    const row = parseItems(wrap(tradeItem({ cdealType: "O", cdealDay: "26.09.20" }), 1)).rows[0];
    expect(normalizeTrade(row, "41570")!.cancelled).toBe(true);
  });
  it("동 이름이 없으면 null", () => {
    expect(normalizeTrade({ aptNm: "x" }, "41570")).toBeNull();
  });
});

describe("normalizeRent", () => {
  const rentRow = (o: Record<string, string>) => ({
    umdNm: "마산동", aptNm: "가상전세", excluUseAr: "84.9", floor: "3", dealYear: "2026", dealMonth: "10", dealDay: "1",
    deposit: "20,000", monthlyRent: "0", contractType: "신규", ...o,
  });
  it("월세 0이면 전세", () => {
    expect(normalizeRent(rentRow({}), "41570")).toMatchObject({ type: "전세", amount: 20000, rent: 0, renewal: false });
  });
  it("월세 있으면 월세, 갱신 표시", () => {
    expect(normalizeRent(rentRow({ monthlyRent: "45", contractType: "갱신" }), "41570")).toMatchObject({ type: "월세", rent: 45, renewal: true });
  });
  it("월세 칸이 비어 있으면 전세", () => {
    expect(normalizeRent(rentRow({ monthlyRent: "" }), "41570")!.type).toBe("전세");
  });
});

describe("apiKeyParam", () => {
  it("Decoding 키는 인코딩, Encoding 키는 그대로, 공백·따옴표 제거", () => {
    expect(apiKeyParam(' "ab+c/=" \n')).toBe("ab%2Bc%2F%3D");
    expect(apiKeyParam("ab%2Bc")).toBe("ab%2Bc");
  });
});

describe("recentMonths", () => {
  it("KST 기준 이번 달부터", () => {
    // 2026-09-30 16:00 UTC = 2026-10-01 01:00 KST
    expect(recentMonths(2, new Date("2026-09-30T16:00:00Z"))).toEqual(["202610", "202609"]);
    expect(recentMonths(2, new Date("2026-01-10T00:00:00Z"))).toEqual(["202601", "202512"]);
  });
});

describe("dealKey", () => {
  it("Apps Script 키 형식", () => {
    expect(dealKey({ type: "월세", apt: "A", dong: "B", area: 77, floor: "11", date: "2026-09-04", amount: 10211, rent: 50 }))
      .toBe("월세|A|B|77|11|2026-09-04|10211|50");
  });
});

describe("fetchDeals", () => {
  it("매매·전월세를 모두 받아 페이지를 넘긴다", async () => {
    const calls: string[] = [];
    const fake = (async (url: string) => {
      calls.push(url);
      const body = url.includes("Trade") ? wrap(tradeItem({}), 1) : wrap("", 0);
      return new Response(body, { status: 200 });
    }) as unknown as typeof fetch;
    const deals = await fetchDeals("41570", "202610", { trade: "K1", rent: "K2" }, fake);
    expect(deals).toHaveLength(1);
    expect(calls.some((u) => u.includes("serviceKey=K1") && u.includes("LAWD_CD=41570") && u.includes("DEAL_YMD=202610"))).toBe(true);
    expect(calls.some((u) => u.includes("serviceKey=K2"))).toBe(true);
  });
  it("HTTP 오류면 throw", async () => {
    const fake = (async () => new Response("down", { status: 500 })) as unknown as typeof fetch;
    await expect(fetchDeals("41570", "202610", { trade: "K", rent: "K" }, fake)).rejects.toThrow(/500/);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run lib/whereToMove/molit.test.ts`
Expected: FAIL (`./molit` 모듈 없음)

- [ ] **Step 3: 구현** — `lib/whereToMove/molit.ts`

```ts
import { XMLParser } from "fast-xml-parser";
import type { DealType, MolitDeal } from "./types";

export const TRADE_URL = "https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev";
export const RENT_URL = "https://apis.data.go.kr/1613000/RTMSDataSvcAptRent/getRTMSDataSvcAptRent";
const PAGE_SIZE = 1000;

const parser = new XMLParser({ parseTagValue: false, isArray: (name) => name === "item" });

/** 복사하며 섞인 공백·따옴표를 지우고, Decoding 키면 인코딩한다(Encoding 키는 그대로). */
export function apiKeyParam(raw: string): string {
  const k = raw.replace(/\s/g, "").replace(/^["']+|["']+$/g, "");
  return k.includes("%") ? k : encodeURIComponent(k);
}

export function parseMoney(s: unknown): number {
  const n = parseInt(String(s ?? "").replace(/[,\s]/g, ""), 10);
  return Number.isNaN(n) ? 0 : n;
}

const clip = (s: string, max = 200) => (s.length <= max ? s : s.slice(0, max - 1) + "…");

export function parseItems(xml: string): { total: number; rows: Record<string, string>[] } {
  const doc = parser.parse(xml) as { response?: { header?: { resultCode?: string; resultMsg?: string }; body?: { items?: { item?: Record<string, string>[] } | string; totalCount?: string } } };
  const res = doc.response;
  if (!res) throw new Error("API 응답 형식이 다릅니다. 인증키나 신청 상태를 확인하세요: " + clip(xml));
  const code = res.header?.resultCode;
  if (code && code !== "00" && code !== "000") throw new Error(`API 오류 ${code}: ${res.header?.resultMsg ?? ""}`);
  const items = res.body?.items;
  const rows = items && typeof items === "object" && Array.isArray(items.item) ? items.item : [];
  return { total: parseMoney(res.body?.totalCount), rows: rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, String(v ?? "").trim()]))) };
}

const pad2 = (n: number) => String(n).padStart(2, "0");
const dealDate = (y: string, m: string, d: string) => `${y}-${pad2(parseInt(m, 10))}-${pad2(parseInt(d, 10))}`;

export function dealKey(d: Pick<MolitDeal, "type" | "apt" | "dong" | "area" | "floor" | "date" | "amount" | "rent">): string {
  return [d.type, d.apt, d.dong, d.area, d.floor, d.date, d.amount, d.rent].join("|");
}

function build(it: Record<string, string>, sggCd: string, type: DealType, amount: number, rent: number, renewal: boolean, cancelled: boolean): MolitDeal | null {
  if (!it.umdNm) return null;
  const areaRaw = parseFloat(it.excluUseAr) || 0;
  const base = {
    type, sggCd, dong: it.umdNm, apt: it.aptNm ?? "", area: Math.round(areaRaw), areaRaw,
    floor: it.floor ?? "", date: dealDate(it.dealYear, it.dealMonth, it.dealDay), amount, rent, renewal, cancelled,
  };
  return { ...base, key: dealKey(base) };
}

export function normalizeTrade(it: Record<string, string>, sggCd: string): MolitDeal | null {
  const cancelled = it.cdealType === "O" || (it.cdealDay ?? "").length > 0;
  return build(it, sggCd, "매매", parseMoney(it.dealAmount), 0, false, cancelled);
}

export function normalizeRent(it: Record<string, string>, sggCd: string): MolitDeal | null {
  const rent = parseMoney(it.monthlyRent);
  return build(it, sggCd, rent > 0 ? "월세" : "전세", parseMoney(it.deposit), rent, (it.contractType ?? "").includes("갱신"), false);
}

/** KST 기준 이번 달부터 n개월의 YYYYMM. */
export function recentMonths(n: number, now: Date = new Date()): string[] {
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear();
  const m = kst.getUTCMonth();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(y, m - i, 1));
    return `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}`;
  });
}

async function fetchPaged(baseUrl: string, key: string, sggCd: string, ym: string, fetchFn: typeof fetch) {
  const rows: Record<string, string>[] = [];
  for (let page = 1; ; page++) {
    const url = `${baseUrl}?serviceKey=${key}&LAWD_CD=${sggCd}&DEAL_YMD=${ym}&pageNo=${page}&numOfRows=${PAGE_SIZE}`;
    const res = await fetchFn(url, { cache: "no-store" });
    const text = await res.text();
    if (!res.ok) throw new Error(`API 호출 실패 (${res.status}): ${clip(text)}`);
    const parsed = parseItems(text);
    rows.push(...parsed.rows);
    if (rows.length >= parsed.total || parsed.rows.length === 0) break;
  }
  return rows;
}

export async function fetchDeals(sggCd: string, ym: string, keys: { trade: string; rent: string }, fetchFn: typeof fetch = fetch): Promise<MolitDeal[]> {
  const trades = (await fetchPaged(TRADE_URL, keys.trade, sggCd, ym, fetchFn)).map((r) => normalizeTrade(r, sggCd));
  const rents = (await fetchPaged(RENT_URL, keys.rent, sggCd, ym, fetchFn)).map((r) => normalizeRent(r, sggCd));
  return [...trades, ...rents].filter((d): d is MolitDeal => d !== null);
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run lib/whereToMove/molit.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add lib/whereToMove/molit.ts lib/whereToMove/molit.test.ts
git commit -m "feat(whereToMove): 국토부 실거래 API 파싱"
```

---

### Task 5: 주간 메시지, 카카오 전송, Cron 인증, 허용 목록

작은 순수 모듈 네 개를 한 번에 만든다. 모두 다음 Task들의 Route Handler가 쓴다.

**Files:**
- Create: `lib/whereToMove/message.ts`, `lib/whereToMove/kakao.ts`, `lib/whereToMove/cron.ts`, `lib/whereToMove/allowlist.ts`
- Test: `lib/whereToMove/message.test.ts`, `lib/whereToMove/kakao.test.ts`, `lib/whereToMove/cron.test.ts`, `lib/whereToMove/allowlist.test.ts`

**Interfaces:**
- Produces:
  - `interface MessageDeal { type: DealType; dong: string; apt: string; area: number; amount: number; rent: number; date: string; ok: boolean; monthly: number }`
  - `shortWon(v: number): string`
  - `buildWeeklyMessage(label: string, deals: MessageDeal[], max?: number): string`
  - `LINK_URL = "https://tools.molespapa.com/whereToMove"`
  - `buildMemoTemplate(text: string, linkUrl: string): string` (JSON 문자열)
  - `sendKakaoMemo(accessToken: string, text: string, linkUrl: string, fetchFn?: typeof fetch): Promise<void>`
  - `isCronAuthorized(authHeader: string | null, secret: string | undefined): boolean`
  - `isAllowedKakaoId(id: string, raw: string | undefined): boolean`

- [ ] **Step 1: 실패하는 테스트 작성**

`lib/whereToMove/message.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildWeeklyMessage, shortWon, type MessageDeal } from "./message";

const d = (o: Partial<MessageDeal>): MessageDeal => ({
  type: "월세", dong: "구래동", apt: "가상단지", area: 85, amount: 13574, rent: 46, date: "2026-10-01", ok: true, monthly: 107.9, ...o,
});

describe("shortWon", () => {
  it.each([[20000, "2억"], [12820, "1.28억"], [5000, "5000만"]])("%i → %s", (v, s) => expect(shortWon(v)).toBe(s));
});

describe("buildWeeklyMessage", () => {
  it("건수 요약과 적합 상위 3건(최신순)", () => {
    const msg = buildWeeklyMessage("김포", [
      d({ date: "2026-10-01", apt: "A" }),
      d({ date: "2026-10-05", apt: "B" }),
      d({ type: "전세", rent: 0, amount: 20000, ok: false, apt: "C" }),
      d({ date: "2026-10-03", apt: "D" }),
      d({ date: "2026-09-20", apt: "E" }),
    ]);
    expect(msg.startsWith("[김포 부동산 주간] 신규 신고 5건 (매매 0, 전세 1, 월세 4)\n예산 적합 4건")).toBe(true);
    const lines = msg.split("\n").filter((l) => l.startsWith("· "));
    expect(lines.map((l) => l.split(" ")[2])).toEqual(["B", "D", "A"]);
    expect(lines[0]).toBe("· 구래동 B 85㎡ 월세 1.36억/46만 (월 108만)");
  });

  it("0건이어도 요약은 보낸다", () => {
    expect(buildWeeklyMessage("김포", [])).toBe("[김포 부동산 주간] 신규 신고 0건 (매매 0, 전세 0, 월세 0)\n예산 적합 0건");
  });

  it("200자를 넘지 않는다", () => {
    const many = Array.from({ length: 10 }, (_, i) => d({ apt: "아주긴단지이름".repeat(5) + i }));
    expect(buildWeeklyMessage("김포", many).length).toBeLessThanOrEqual(200);
  });
});
```

`lib/whereToMove/kakao.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildMemoTemplate, sendKakaoMemo } from "./kakao";

describe("buildMemoTemplate", () => {
  it("텍스트 템플릿과 버튼", () => {
    expect(JSON.parse(buildMemoTemplate("안녕", "https://x.test/a"))).toEqual({
      object_type: "text", text: "안녕", link: { web_url: "https://x.test/a", mobile_web_url: "https://x.test/a" }, button_title: "실거래 보기",
    });
  });
});

describe("sendKakaoMemo", () => {
  it("Bearer 토큰과 template_object로 보낸다", async () => {
    const seen: { url: string; init: RequestInit }[] = [];
    const fake = (async (url: string, init: RequestInit) => { seen.push({ url, init }); return new Response('{"result_code":0}', { status: 200 }); }) as unknown as typeof fetch;
    await sendKakaoMemo("tok", "msg", "https://x.test", fake);
    expect(seen[0].url).toBe("https://kapi.kakao.com/v2/api/talk/memo/default/send");
    expect((seen[0].init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
    expect(String(seen[0].init.body)).toContain("template_object=");
  });

  it("동의 거부(403) 같은 실패는 상태 코드를 담아 throw", async () => {
    const fake = (async () => new Response('{"code":-402,"msg":"insufficient scopes"}', { status: 403 })) as unknown as typeof fetch;
    await expect(sendKakaoMemo("tok", "msg", "https://x.test", fake)).rejects.toThrow(/403/);
  });
});
```

`lib/whereToMove/cron.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isCronAuthorized } from "./cron";

describe("isCronAuthorized", () => {
  it("Bearer 비밀값이 맞을 때만 true", () => {
    expect(isCronAuthorized("Bearer s3", "s3")).toBe(true);
    expect(isCronAuthorized("Bearer nope", "s3")).toBe(false);
    expect(isCronAuthorized(null, "s3")).toBe(false);
  });
  it("비밀값이 설정되지 않았으면 항상 false", () => {
    expect(isCronAuthorized("Bearer ", undefined)).toBe(false);
    expect(isCronAuthorized("Bearer ", "")).toBe(false);
  });
});
```

`lib/whereToMove/allowlist.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isAllowedKakaoId } from "./allowlist";

describe("isAllowedKakaoId", () => {
  it("쉼표 목록에 있으면 true (공백 무시)", () => {
    expect(isAllowedKakaoId("111", "111, 222")).toBe(true);
    expect(isAllowedKakaoId("222", "111, 222")).toBe(true);
    expect(isAllowedKakaoId("333", "111, 222")).toBe(false);
  });
  it("목록이 비었거나 id가 비면 false", () => {
    expect(isAllowedKakaoId("111", undefined)).toBe(false);
    expect(isAllowedKakaoId("111", "")).toBe(false);
    expect(isAllowedKakaoId("", "111")).toBe(false);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run lib/whereToMove/message.test.ts lib/whereToMove/kakao.test.ts lib/whereToMove/cron.test.ts lib/whereToMove/allowlist.test.ts`
Expected: FAIL (모듈 없음)

- [ ] **Step 3: 구현**

`lib/whereToMove/message.ts`:

```ts
import type { DealType } from "./types";

export interface MessageDeal {
  type: DealType;
  dong: string;
  apt: string;
  area: number;
  amount: number;
  rent: number;
  date: string;
  ok: boolean;
  monthly: number;
}

/** 20000 → 2억, 12820 → 1.28억, 5000 → 5000만 */
export function shortWon(v: number): string {
  return v >= 10000 ? `${Math.round(v / 100) / 100}억` : `${Math.round(v)}만`;
}

const clip = (s: string, max: number) => (s.length <= max ? s : s.slice(0, max - 1) + "…");

/** Code.gs buildMessage_ 와 같은 형식. */
export function buildWeeklyMessage(label: string, deals: MessageDeal[], max = 200): string {
  const cnt = (t: DealType) => deals.filter((d) => d.type === t).length;
  const okDeals = deals.filter((d) => d.ok).sort((a, b) => (a.date < b.date ? 1 : -1));
  let text = `[${label} 부동산 주간] 신규 신고 ${deals.length}건 (매매 ${cnt("매매")}, 전세 ${cnt("전세")}, 월세 ${cnt("월세")})\n예산 적합 ${okDeals.length}건`;
  for (const d of okDeals.slice(0, 3)) {
    const price = d.type === "월세" ? `${shortWon(d.amount)}/${d.rent}만` : shortWon(d.amount);
    const line = `\n· ${d.dong} ${d.apt} ${d.area}㎡ ${d.type} ${price} (월 ${Math.round(d.monthly)}만)`;
    if ((text + line).length > max - 1) break;
    text += line;
  }
  return clip(text, max);
}
```

`lib/whereToMove/kakao.ts`:

```ts
export const KAKAO_MEMO_URL = "https://kapi.kakao.com/v2/api/talk/memo/default/send";
export const LINK_URL = "https://tools.molespapa.com/whereToMove";

export function buildMemoTemplate(text: string, linkUrl: string): string {
  return JSON.stringify({
    object_type: "text",
    text,
    link: { web_url: linkUrl, mobile_web_url: linkUrl },
    button_title: "실거래 보기",
  });
}

/** 카카오톡 나에게 보내기. 실패하면 상태 코드와 응답 본문을 담아 throw. */
export async function sendKakaoMemo(accessToken: string, text: string, linkUrl: string, fetchFn: typeof fetch = fetch): Promise<void> {
  const res = await fetchFn(KAKAO_MEMO_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
    body: new URLSearchParams({ template_object: buildMemoTemplate(text, linkUrl) }).toString(),
  });
  if (!res.ok) throw new Error(`카카오톡 발송 실패 (${res.status}): ${(await res.text()).slice(0, 200)}`);
}
```

`lib/whereToMove/cron.ts`:

```ts
/** Vercel Cron 은 Authorization: Bearer ${CRON_SECRET} 헤더를 붙여 호출한다. */
export function isCronAuthorized(authHeader: string | null, secret: string | undefined): boolean {
  if (!secret) return false;
  return authHeader === `Bearer ${secret}`;
}
```

`lib/whereToMove/allowlist.ts`:

```ts
/** WTM_ALLOWED_KAKAO_IDS(쉼표 구분)에 있는 카카오 회원번호만 허용한다. */
export function isAllowedKakaoId(id: string, raw: string | undefined): boolean {
  if (!id || !raw) return false;
  return raw.split(",").map((s) => s.trim()).filter(Boolean).includes(id);
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run lib/whereToMove`
Expected: PASS (Task 2~5 테스트 전부)

- [ ] **Step 5: 커밋**

```bash
git add lib/whereToMove/message.ts lib/whereToMove/message.test.ts lib/whereToMove/kakao.ts lib/whereToMove/kakao.test.ts lib/whereToMove/cron.ts lib/whereToMove/cron.test.ts lib/whereToMove/allowlist.ts lib/whereToMove/allowlist.test.ts
git commit -m "feat(whereToMove): 주간 메시지, 카카오 전송, Cron 인증, 허용 목록"
```

---

### Task 6: DB 함수와 카카오 로그인

**Files:**
- Create: `lib/whereToMove/repo.ts`, `lib/whereToMove/auth.ts`, `lib/whereToMove/auth-client.ts`, `lib/whereToMove/current-user.ts`, `app/api/auth/[...all]/route.ts`, `app/whereToMove/login/KakaoLoginButton.tsx`
- Modify: `app/whereToMove/login/page.tsx`(전면 교체), `proxy.ts`
- Delete: `lib/whereToMove/session.ts`, `lib/whereToMove/session.test.ts`, `app/whereToMove/login/actions.ts`, `app/whereToMove/login/layout.tsx`

**Interfaces:**
- Consumes: `db`, 표들(Task 1), `Settings`, `DEFAULT_SETTINGS`, `normalizeStoredSettings`(Task 2), `MolitDeal`, `StoredDeal`(Task 1), `isAllowedKakaoId`(Task 5)
- Produces (repo.ts):
  - `upsertDeals(deals: MolitDeal[]): Promise<number>`
  - `listDeals(sggCds: string[], opts: { firstSeenAfter?: Date; dealDateFrom?: string }): Promise<StoredDeal[]>`
  - `getOrCreateSettings(userId: string): Promise<{ data: Settings; notifyEnabled: boolean; lastNotifiedAt: Date | null }>`
  - `saveSettings(userId: string, data: Settings, notifyEnabled: boolean): Promise<void>`
  - `listNotifyTargets(): Promise<{ userId: string; data: Settings; lastNotifiedAt: Date | null }[]>`
  - `markNotified(userId: string, at: Date): Promise<void>`
  - `logNotify(row: { userId: string; newCount: number; okCount: number; status: "sent" | "failed"; error?: string }): Promise<void>`
  - `lastNotifyLog(userId: string): Promise<{ status: "sent" | "failed"; error: string | null; sentAt: Date } | null>`
  - `kakaoAccountId(userId: string): Promise<string | null>` (Better Auth `account.id`)
  - `allRegionSggCds(): Promise<string[]>`
- Produces (auth): `auth`(서버), `authClient`(브라우저), `requireUser(): Promise<{ id: string; name: string }>`

- [ ] **Step 1: Next.js 문서 확인**

```bash
ls node_modules/next/dist/docs/01-app/01-getting-started/ | grep -i -E "proxy|route|server"
sed -n 1,80p node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md
```

`proxy.ts` 규칙(이 저장소는 이미 `proxy` 함수를 쓰고 있음)과 Route Handler 규칙을 확인한다.

- [ ] **Step 2: `lib/whereToMove/repo.ts` 작성**

```ts
import { and, desc, eq, gt, gte, inArray, sql } from "drizzle-orm";
import { db } from "./db";
import { account, wtmDeals, wtmNotifyLog, wtmSettings } from "./schema";
import { DEFAULT_SETTINGS, normalizeStoredSettings, type Settings } from "./settings";
import type { MolitDeal, StoredDeal } from "./types";

const CHUNK = 500;

/** 거래를 키 기준으로 넣는다. 이미 있으면 해제 여부와 갱신 시각만 바꾼다(first_seen_at 유지). */
export async function upsertDeals(deals: MolitDeal[]): Promise<number> {
  for (let i = 0; i < deals.length; i += CHUNK) {
    const rows = deals.slice(i, i + CHUNK).map((d) => ({
      dealKey: d.key, type: d.type, sggCd: d.sggCd, dong: d.dong, apt: d.apt, area: d.area, areaRaw: d.areaRaw,
      floor: d.floor, dealDate: d.date, amount: d.amount, rent: d.rent, renewal: d.renewal, cancelled: d.cancelled,
    }));
    await db
      .insert(wtmDeals)
      .values(rows)
      .onConflictDoUpdate({ target: wtmDeals.dealKey, set: { cancelled: sql`excluded.cancelled`, updatedAt: sql`now()` } });
  }
  return deals.length;
}

export async function listDeals(sggCds: string[], opts: { firstSeenAfter?: Date; dealDateFrom?: string }): Promise<StoredDeal[]> {
  if (!sggCds.length) return [];
  const conds = [inArray(wtmDeals.sggCd, sggCds), eq(wtmDeals.cancelled, false)];
  if (opts.firstSeenAfter) conds.push(gt(wtmDeals.firstSeenAt, opts.firstSeenAfter));
  if (opts.dealDateFrom) conds.push(gte(wtmDeals.dealDate, opts.dealDateFrom));
  const rows = await db.select().from(wtmDeals).where(and(...conds)).orderBy(desc(wtmDeals.dealDate));
  return rows.map((r) => ({
    key: r.dealKey, type: r.type, sggCd: r.sggCd, dong: r.dong, apt: r.apt, area: r.area, areaRaw: r.areaRaw,
    floor: r.floor, date: r.dealDate, amount: r.amount, rent: r.rent, renewal: r.renewal, cancelled: r.cancelled,
    firstSeenAt: r.firstSeenAt,
  }));
}

/** 처음이면 기본값으로 만든다. 알림 기준 시각은 만든 시각(과거 거래를 한꺼번에 보내지 않음). */
export async function getOrCreateSettings(userId: string) {
  await db.insert(wtmSettings).values({ userId, data: DEFAULT_SETTINGS, lastNotifiedAt: new Date() }).onConflictDoNothing();
  const [row] = await db.select().from(wtmSettings).where(eq(wtmSettings.userId, userId));
  return { data: normalizeStoredSettings(row.data), notifyEnabled: row.notifyEnabled, lastNotifiedAt: row.lastNotifiedAt };
}

/** 알림을 꺼져 있다가 켜면 기준 시각을 지금으로 옮긴다. */
export async function saveSettings(userId: string, data: Settings, notifyEnabled: boolean): Promise<void> {
  await db
    .update(wtmSettings)
    .set({
      data,
      notifyEnabled,
      updatedAt: new Date(),
      lastNotifiedAt: sql`case when ${wtmSettings.notifyEnabled} = false and ${notifyEnabled} = true then now() else ${wtmSettings.lastNotifiedAt} end`,
    })
    .where(eq(wtmSettings.userId, userId));
}

export async function listNotifyTargets() {
  const rows = await db.select().from(wtmSettings).where(eq(wtmSettings.notifyEnabled, true));
  return rows.map((r) => ({ userId: r.userId, data: normalizeStoredSettings(r.data), lastNotifiedAt: r.lastNotifiedAt }));
}

export async function markNotified(userId: string, at: Date): Promise<void> {
  await db.update(wtmSettings).set({ lastNotifiedAt: at }).where(eq(wtmSettings.userId, userId));
}

export async function logNotify(row: { userId: string; newCount: number; okCount: number; status: "sent" | "failed"; error?: string }) {
  await db.insert(wtmNotifyLog).values({ ...row, error: row.error ?? null });
}

export async function lastNotifyLog(userId: string) {
  const [row] = await db.select().from(wtmNotifyLog).where(eq(wtmNotifyLog.userId, userId)).orderBy(desc(wtmNotifyLog.sentAt)).limit(1);
  return row ? { status: row.status, error: row.error, sentAt: row.sentAt } : null;
}

export async function kakaoAccountId(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ id: account.id })
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, "kakao")))
    .limit(1);
  return row?.id ?? null;
}

/** 모든 사용자 설정의 지역 코드. 사용자가 없으면 기본 지역. */
export async function allRegionSggCds(): Promise<string[]> {
  const rows = await db.select({ data: wtmSettings.data }).from(wtmSettings);
  const set = new Set<string>(DEFAULT_SETTINGS.regions.map((r) => r.sggCd));
  for (const r of rows) for (const reg of normalizeStoredSettings(r.data).regions) set.add(reg.sggCd);
  return [...set];
}
```

- [ ] **Step 3: `lib/whereToMove/auth.ts` 작성**

```ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { isAllowedKakaoId } from "./allowlist";
import { db } from "./db";
import { account, session, user, verification } from "./schema";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "pg", schema: { user, session, account, verification } }),
  // 카카오 access/refresh token 을 DB에 암호화해 둔다(주간 알림에 재사용).
  account: { encryptOAuthTokens: true },
  socialProviders: {
    kakao: {
      clientId: process.env.KAKAO_CLIENT_ID ?? "",
      clientSecret: process.env.KAKAO_CLIENT_SECRET ?? "",
      // account_email 은 비즈 앱 전용이라 요청하지 않는다. 메시지 전송 동의를 함께 받는다.
      disableDefaultScope: true,
      scope: ["profile_nickname", "talk_message"],
      // Better Auth 는 이메일이 필수라, 카카오 회원번호로 실제로 쓰이지 않는 주소를 만든다(.invalid 는 예약된 TLD).
      mapProfileToUser: (profile) => ({
        email: `kakao-${profile.id}@kakao.invalid`,
        name: profile.kakao_account?.profile?.nickname || "카카오 사용자",
      }),
    },
  },
  user: {
    // 1단계는 허용 목록의 카카오 회원번호만 받는다. 거절 화면에 본인 번호를 보여 줘 운영자가 목록에 넣을 수 있게 한다.
    validateUserInfo: ({ source }) => {
      if (source.oauth?.providerId !== "kakao") return;
      const id = String(source.oauth.profile?.id ?? "");
      if (!isAllowedKakaoId(id, process.env.WTM_ALLOWED_KAKAO_IDS)) {
        return { error: "not_allowed", errorDescription: `준비 중인 서비스입니다. (카카오 회원번호 ${id})` };
      }
    },
  },
  plugins: [nextCookies()],
});
```

타입 오류가 나면 `node_modules/@better-auth/core/dist/types/init-options.d.mts`의 `validateUserInfo` 시그니처와 `node_modules/@better-auth/core/dist/social-providers/kakao.d.mts`의 `KakaoProfile`을 보고 맞춘다(1.7.8 기준으로 위 코드와 같음을 확인했다).

- [ ] **Step 4: 클라이언트·세션 도우미·핸들러**

`lib/whereToMove/auth-client.ts`:

```ts
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient();
```

`lib/whereToMove/current-user.ts`:

```ts
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";

/** 로그인 사용자. 없으면 로그인 화면으로 보낸다. */
export async function requireUser(): Promise<{ id: string; name: string }> {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) redirect("/whereToMove/login");
  return { id: s.user.id, name: s.user.name };
}
```

`app/api/auth/[...all]/route.ts`:

```ts
import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/whereToMove/auth";

export const { GET, POST } = toNextJsHandler(auth);
```

- [ ] **Step 5: 로그인 화면 교체**

삭제:

```bash
git rm lib/whereToMove/session.ts lib/whereToMove/session.test.ts app/whereToMove/login/actions.ts app/whereToMove/login/layout.tsx
```

`app/whereToMove/login/KakaoLoginButton.tsx`:

```tsx
"use client";

import { useState } from "react";
import { authClient } from "@/lib/whereToMove/auth-client";

export default function KakaoLoginButton() {
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await authClient.signIn.social({ provider: "kakao", callbackURL: "/whereToMove", errorCallbackURL: "/whereToMove/login" });
      }}
      className="w-full rounded-xl bg-[#FEE500] py-3 font-semibold text-[#191919] disabled:opacity-50"
    >
      {pending ? "카카오로 이동 중..." : "카카오로 로그인"}
    </button>
  );
}
```

`app/whereToMove/login/page.tsx` (전체 교체):

```tsx
import type { Metadata } from "next";
import ThemeToggle from "@/app/components/ThemeToggle";
import KakaoLoginButton from "./KakaoLoginButton";

export const metadata: Metadata = {
  title: "로그인 · 이사 실거래 모아보기",
  robots: { index: false, follow: false },
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; error_description?: string }> }) {
  const { error, error_description } = await searchParams;
  return (
    <main className="mx-auto flex min-h-full w-full max-w-sm flex-1 flex-col justify-center px-4">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">이사 실거래 모아보기</h1>
        <ThemeToggle />
      </div>
      <KakaoLoginButton />
      {error && (
        <p role="alert" className="mt-4 text-sm text-rose-600 dark:text-rose-400">
          {error_description || "로그인하지 못했습니다. 다시 시도해 주세요."}
        </p>
      )}
      <p className="mt-4 text-center text-xs text-slate-500 dark:text-slate-400">
        주간 알림을 카카오톡으로 받으려면 &apos;카카오톡 메시지 전송&apos;에 동의해 주세요.
      </p>
    </main>
  );
}
```

Better Auth가 오류 리다이렉트에 붙이는 쿼리 이름이 `error`/`error_description`인지, 로그인 거절을 한 번 재현해 주소창으로 확인한다(Step 8). 다르면 이 화면의 읽는 이름을 맞춘다.

- [ ] **Step 6: `proxy.ts` 수정**

`checkWhereToMove`를 세션 쿠키 확인으로 바꾼다. 쿠키가 있는지만 보고(빠른 차단), 진짜 세션 검증은 각 페이지의 `requireUser()`가 한다. `/admin` 부분은 그대로 둔다.

```ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { isValidSessionCookie } from "@/lib/admin/session";

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/whereToMove")) {
    return checkWhereToMove(request);
  }

  if (request.nextUrl.pathname === "/admin/login") {
    return NextResponse.next();
  }

  const cookie = request.cookies.get("admin_session")?.value;
  if (await isValidSessionCookie(cookie)) {
    return NextResponse.next();
  }

  return NextResponse.redirect(new URL("/admin/login", request.url));
}

// /whereToMove 는 카카오 로그인(Better Auth) 세션 쿠키가 있어야 들어간다. 세션 검증은 페이지에서 한다.
function checkWhereToMove(request: NextRequest) {
  if (request.nextUrl.pathname === "/whereToMove/login") return NextResponse.next();
  if (getSessionCookie(request)) return NextResponse.next();
  return NextResponse.redirect(new URL("/whereToMove/login", request.url));
}

export const config = {
  matcher: ["/admin/:path*", "/whereToMove", "/whereToMove/:path*"],
};
```

- [ ] **Step 7: 환경변수와 카카오 콘솔 (사용자 단계)**

사용자에게 부탁한다(값은 채팅에 붙여넣지 않음):
1. 카카오 개발자 콘솔 → 앱 → 플랫폼 키 → REST API 키 → 카카오 로그인 리다이렉트 URI에 추가:
   `https://tools.molespapa.com/api/auth/callback/kakao`, `http://localhost:3000/api/auth/callback/kakao`
2. 카카오 로그인 → 동의항목: `닉네임`(필수 또는 선택), `카카오톡 메시지 전송`(선택) 사용 설정
3. Vercel 환경변수(Production, Development) 등록:
   ```
   ! vercel env add KAKAO_CLIENT_ID          # REST API 키
   ! vercel env add KAKAO_CLIENT_SECRET      # 카카오 로그인 클라이언트 시크릿
   ! vercel env add BETTER_AUTH_URL          # Production: https://tools.molespapa.com / Development: http://localhost:3000
   ```
   `BETTER_AUTH_SECRET`과 `CRON_SECRET`은 값이 화면에 나오지 않게 생성해 등록한다:
   ```bash
   node -e "process.stdout.write(require('crypto').randomBytes(32).toString('base64url'))" | vercel env add BETTER_AUTH_SECRET production
   node -e "process.stdout.write(require('crypto').randomBytes(32).toString('base64url'))" | vercel env add BETTER_AUTH_SECRET development
   ```
   `WTM_ALLOWED_KAKAO_IDS`는 Step 8에서 회원번호를 확인한 뒤 등록한다.
4. `vercel env pull .env.local --yes`

- [ ] **Step 8: 로컬 확인**

```bash
npx tsc --noEmit && npx eslint proxy.ts lib/whereToMove app/whereToMove app/api && npm test
npm run dev
```

브라우저로 `http://localhost:3000/whereToMove` → 로그인 화면으로 이동하는지 본다. "카카오로 로그인" → 카카오 동의 → 허용 목록이 비어 있으므로 로그인 화면으로 돌아와 "준비 중인 서비스입니다. (카카오 회원번호 N)"이 보여야 한다. 주소창의 쿼리 이름도 확인한다.
사용자에게 그 번호로 `WTM_ALLOWED_KAKAO_IDS`를 등록해 달라고 부탁한다(`! vercel env add WTM_ALLOWED_KAKAO_IDS`, Production·Development). `vercel env pull .env.local --yes` 후 dev 서버를 재시작하고 다시 로그인한다. 이번에는 `/whereToMove`로 들어가야 한다(목록은 Task 7 전이라 아직 옛 화면일 수 있음).

DB 확인(값은 출력하지 않음):

```bash
node --env-file=.env.local -e "const {Pool}=require('pg');const p=new Pool({connectionString:process.env.DATABASE_URL});p.query(\"select provider_id, scope, refresh_token is not null as has_refresh from account\").then(r=>{console.log(r.rows);return p.end()})"
```

Expected: `provider_id: 'kakao'`, `scope`에 `talk_message`, `has_refresh: true`.

- [ ] **Step 9: 커밋**

```bash
git add lib/whereToMove/repo.ts lib/whereToMove/auth.ts lib/whereToMove/auth-client.ts lib/whereToMove/current-user.ts "app/api/auth/[...all]/route.ts" app/whereToMove/login proxy.ts
git commit -m "feat(whereToMove): 카카오 로그인(Better Auth)과 DB 함수"
```

---

### Task 7: 수집 Cron과 목록 화면 DB 전환

**Files:**
- Create: `app/api/where-to-move/cron/collect/route.ts`, `vercel.json`
- Modify: `app/whereToMove/page.tsx`(전면 교체), `app/whereToMove/GimpoBoard.tsx`
- Delete: `app/whereToMove/actions.ts`

**Interfaces:**
- Consumes: `isCronAuthorized`(Task 5), `apiKeyParam`, `fetchDeals`, `recentMonths`(Task 4), `upsertDeals`, `listDeals`, `allRegionSggCds`, `getOrCreateSettings`, `lastNotifyLog`(Task 6), `deriveParams`, `evaluateDeal`, `filterDeals`(Task 3), `requireUser`(Task 6)
- Produces: `GET /api/where-to-move/cron/collect` → `{ ok: boolean; results: { sggCd; ym; count?; error? }[] }`. `GimpoBoard` props `{ deals: Deal[]; title: string; subtitle: string; notice?: string }`.

- [ ] **Step 1: 수집 Route Handler** — `app/api/where-to-move/cron/collect/route.ts`

```ts
import { isCronAuthorized } from "@/lib/whereToMove/cron";
import { apiKeyParam, fetchDeals, recentMonths } from "@/lib/whereToMove/molit";
import { allRegionSggCds, upsertDeals } from "@/lib/whereToMove/repo";

// 매일 06시 KST. 사용자 지역의 최근 2개월 매매·전월세를 모두 받아 upsert 한다.
export async function GET(request: Request) {
  if (!isCronAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return Response.json({ ok: false }, { status: 401 });
  }
  const raw = process.env.DATA_GO_KR_KEY;
  if (!raw) return Response.json({ ok: false, error: "DATA_GO_KR_KEY 없음" }, { status: 500 });
  const keys = { trade: apiKeyParam(raw), rent: apiKeyParam(process.env.DATA_GO_KR_KEY_RENT || raw) };

  const results: { sggCd: string; ym: string; count?: number; error?: string }[] = [];
  for (const sggCd of await allRegionSggCds()) {
    for (const ym of recentMonths(2)) {
      try {
        const deals = await fetchDeals(sggCd, ym, keys);
        results.push({ sggCd, ym, count: await upsertDeals(deals) });
      } catch (e) {
        console.error("[whereToMove collect]", sggCd, ym, e);
        results.push({ sggCd, ym, error: e instanceof Error ? e.message : String(e) });
      }
    }
  }
  return Response.json({ ok: results.every((r) => !r.error), results });
}
```

- [ ] **Step 2: Cron 일정** — `vercel.json`

```json
{
  "crons": [
    { "path": "/api/where-to-move/cron/collect", "schedule": "0 21 * * *" },
    { "path": "/api/where-to-move/cron/notify", "schedule": "0 23 * * 0" }
  ]
}
```

- [ ] **Step 3: 공공데이터 키와 CRON_SECRET 등록 (사용자 단계 포함)**

```
! vercel env add DATA_GO_KR_KEY        # Production, Development (Apps Script 스크립트 속성과 같은 값)
```

`CRON_SECRET`은 값이 보이지 않게 생성한다:

```bash
node -e "process.stdout.write(require('crypto').randomBytes(32).toString('base64url'))" | vercel env add CRON_SECRET production
node -e "process.stdout.write(require('crypto').randomBytes(32).toString('base64url'))" | vercel env add CRON_SECRET development
vercel env pull .env.local --yes
```

- [ ] **Step 4: 수집 로컬 확인**

```bash
npm run dev   # 다른 터미널
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/where-to-move/cron/collect
node --env-file=.env.local -e "fetch('http://localhost:3000/api/where-to-move/cron/collect',{headers:{authorization:'Bearer '+process.env.CRON_SECRET}}).then(r=>r.json()).then(j=>console.log(JSON.stringify(j)))"
```

Expected: 첫 줄 `401`. 둘째는 `{"ok":true,"results":[{"sggCd":"41570","ym":"2026..","count":N},...]}` (N은 수백 건 수준).
같은 명령을 한 번 더 실행해도 오류 없이 끝나야 한다(upsert).

- [ ] **Step 5: 목록 페이지** — `app/whereToMove/page.tsx` (전체 교체)

먼저 `node_modules/next/dist/docs/` 에서 동적 렌더링(`headers()` 사용 시 자동으로 요청마다 렌더링) 문서를 확인한다.

```tsx
import type { Metadata } from "next";
import { requireUser } from "@/lib/whereToMove/current-user";
import { deriveParams, evaluateDeal, filterDeals } from "@/lib/whereToMove/judge";
import { getOrCreateSettings, lastNotifyLog, listDeals } from "@/lib/whereToMove/repo";
import GimpoBoard, { type Deal } from "./GimpoBoard";

export const metadata: Metadata = {
  title: "이사 실거래 모아보기",
  robots: { index: false, follow: false },
};

const KST_DATE = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" });

export default async function Page() {
  const user = await requireUser();
  const { data: settings } = await getOrCreateSettings(user.id);
  const from = new Date();
  from.setMonth(from.getMonth() - 12);
  const stored = await listDeals(settings.regions.map((r) => r.sggCd), { dealDateFrom: KST_DATE.format(from) });
  const p = deriveParams(settings);

  const deals: Deal[] = filterDeals(settings, stored).map((d) => {
    const e = evaluateDeal(p, d);
    return {
      recorded: KST_DATE.format(d.firstSeenAt), type: d.type, dong: d.dong, apt: d.apt, area: d.area, floor: d.floor,
      date: d.date, amount: d.amount, rent: d.rent, loan: Math.round(e.loan),
      monthly: Math.round(e.monthly * 10) / 10, margin: Math.round(e.margin * 10) / 10, ok: e.ok, reason: e.reasons.join(", "),
    };
  });

  const log = await lastNotifyLog(user.id);
  const notice = log?.status === "failed"
    ? `지난 카카오톡 알림을 보내지 못했습니다. 로그아웃 후 다시 카카오로 로그인하면 연결이 갱신됩니다. (${log.error ?? ""})`
    : undefined;

  const region = settings.regions[0];
  return <GimpoBoard deals={deals} title={`${region.label} 실거래 모아보기`} subtitle={region.dongs.join(" · ")} notice={notice} />;
}
```

- [ ] **Step 6: `GimpoBoard.tsx` 수정**

1. `import { useMemo, useState, useTransition } from 'react';` → `import { useMemo, useState } from 'react';`
2. `import { refreshData } from './actions';` 줄 삭제, `import Link from 'next/link';` 추가
3. `naverUrl`의 `김포 ` 하드코딩을 없애고 지역 이름을 받는다:
   ```tsx
   const naverUrl = (d: Deal, label: string) => `https://m.search.naver.com/search.naver?query=${encodeURIComponent(`${label} ${d.dong} ${d.apt}`)}`;
   ```
   카드에서 `naverUrl(d)` → `naverUrl(d, label)`.
4. 컴포넌트 시그니처:
   ```tsx
   export default function GimpoBoard({ deals, title, subtitle, notice }: { deals: Deal[]; title: string; subtitle: string; notice?: string }) {
     const label = title.split(' ')[0];
   ```
5. `const [refreshing, startRefresh] = useTransition();` 줄 삭제
6. 헤더 교체:
   ```tsx
   <header className={s.head}>
     <div>
       <h1 className={s.title}>{title}</h1>
       <p className={s.sub}>{subtitle}</p>
     </div>
     <div className={s.tools}>
       <Link className={s.chip} href="/whereToMove/settings">설정</Link>
       <ThemeToggle />
     </div>
   </header>
   {notice && <p className={s.error}>{notice}</p>}
   ```
7. 기존 `{error && <p className={s.error}>{error}</p>}` 줄과, 빈 목록 조건의 `!error` 부분을 지운다(`{!rows.length && (`).
8. `gimpo.module.css`의 `.chip`에 링크 밑줄이 생기면 `.tools a { text-decoration: none; }`를 추가한다.

```bash
git rm app/whereToMove/actions.ts
```

- [ ] **Step 7: 확인**

```bash
npx tsc --noEmit && npx eslint app/whereToMove app/api && npm test && npm run build
```

dev 서버에서 로그인 상태로 `/whereToMove`를 연다. Step 4에서 모은 거래가 보이고, 유형·동·적합 필터가 동작해야 한다. 설정 링크는 Task 8 전이라 404여도 된다.

- [ ] **Step 8: 커밋**

```bash
git add app/api/where-to-move/cron/collect vercel.json app/whereToMove
git commit -m "feat(whereToMove): 수집 Cron과 목록 화면 DB 전환"
```

---

### Task 8: 설정 화면

**Files:**
- Create: `app/whereToMove/settings/page.tsx`, `app/whereToMove/settings/SettingsForm.tsx`, `app/whereToMove/settings/actions.ts`

**Interfaces:**
- Consumes: `requireUser`, `getOrCreateSettings`, `saveSettings`(Task 6), `parseSettings`, `Settings`, `Loan`(Task 2), `deriveParams`, `priceLimits`(Task 3)
- Produces: `saveSettingsAction(input: { data: unknown; notifyEnabled: boolean }): Promise<{ ok: true } | { ok: false; errors: Record<string, string> }>`

- [ ] **Step 1: Server Action** — `app/whereToMove/settings/actions.ts`

먼저 `node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md`를 읽고 Server Function 규칙을 확인한다.

```ts
"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/whereToMove/current-user";
import { saveSettings } from "@/lib/whereToMove/repo";
import { parseSettings } from "@/lib/whereToMove/settings";

export async function saveSettingsAction(input: { data: unknown; notifyEnabled: boolean }) {
  const user = await requireUser();
  const parsed = parseSettings(input.data);
  if (!parsed.ok) return parsed;
  await saveSettings(user.id, parsed.settings, input.notifyEnabled === true);
  revalidatePath("/whereToMove");
  return { ok: true as const };
}
```

- [ ] **Step 2: 페이지** — `app/whereToMove/settings/page.tsx`

```tsx
import type { Metadata } from "next";
import { requireUser } from "@/lib/whereToMove/current-user";
import { getOrCreateSettings } from "@/lib/whereToMove/repo";
import SettingsForm from "./SettingsForm";

export const metadata: Metadata = {
  title: "설정 · 이사 실거래 모아보기",
  robots: { index: false, follow: false },
};

export default async function SettingsPage() {
  const user = await requireUser();
  const { data, notifyEnabled } = await getOrCreateSettings(user.id);
  return <SettingsForm initial={data} initialNotify={notifyEnabled} />;
}
```

- [ ] **Step 3: 폼** — `app/whereToMove/settings/SettingsForm.tsx`

비율은 화면에서 %로 입력받고 저장할 때 100으로 나눈다. 계산 결과는 `deriveParams`·`priceLimits`를 브라우저에서 바로 돌려 보여 준다(순수 함수라 가능).

```tsx
"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import ThemeToggle from "@/app/components/ThemeToggle";
import { deriveParams, priceLimits } from "@/lib/whereToMove/judge";
import type { Loan, Settings } from "@/lib/whereToMove/settings";
import { saveSettingsAction } from "./actions";

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
      if (r.ok) { setErrors({}); setSaved(true); } else { setErrors(r.errors); setSaved(false); }
    });

  const err = (path: string) => errors[path] && <span className="text-xs text-rose-600 dark:text-rose-400">{errors[path]}</span>;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
      <header className="mb-6 flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">설정</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">지역: {s.regions[0].label} ({s.regions[0].dongs.join(" · ")})</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/whereToMove" className="rounded-full border border-slate-300 px-3 py-1 text-sm dark:border-slate-700">목록</Link>
          <ThemeToggle />
        </div>
      </header>

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

      {errors._ && <p className="mb-2 text-sm text-rose-600">{errors._}</p>}
      {Object.keys(errors).length > 0 && <p className="mb-2 text-sm text-rose-600">입력값을 확인해 주세요.</p>}
      <button type="button" onClick={save} disabled={pending} className="w-full rounded-xl bg-emerald-600 py-3 font-semibold text-white disabled:opacity-50">
        {pending ? "저장 중..." : saved ? "저장했습니다" : "저장"}
      </button>
    </main>
  );
}
```

- [ ] **Step 4: 확인**

```bash
npx tsc --noEmit && npx eslint app/whereToMove && npm test && npm run build
```

dev 서버에서 `/whereToMove/settings`:
- 값을 바꾸면 "계산 결과"가 즉시 바뀐다.
- 대출 비율에 `120`을 넣고 저장하면 그 칸 아래에 오류가 보이고 저장되지 않는다.
- 정상 값으로 저장 → "저장했습니다" → 목록으로 가면 판정이 새 조건으로 바뀌어 있다.

- [ ] **Step 5: 커밋**

```bash
git add app/whereToMove/settings
git commit -m "feat(whereToMove): 웹 설정 화면"
```

---

### Task 9: 주간 알림 Cron

**Files:**
- Create: `app/api/where-to-move/cron/notify/route.ts`

**Interfaces:**
- Consumes: `isCronAuthorized`(Task 5), `listNotifyTargets`, `listDeals`, `kakaoAccountId`, `markNotified`, `logNotify`(Task 6), `filterDeals`, `deriveParams`, `evaluateDeal`(Task 3), `buildWeeklyMessage`(Task 5), `sendKakaoMemo`, `LINK_URL`(Task 5), `auth`(Task 6)
- Produces: `GET /api/where-to-move/cron/notify` → `{ ok: boolean; results: { userId: string; status: "sent" | "failed"; error?: string }[] }`

- [ ] **Step 1: Route Handler** — `app/api/where-to-move/cron/notify/route.ts`

```ts
import { auth } from "@/lib/whereToMove/auth";
import { isCronAuthorized } from "@/lib/whereToMove/cron";
import { deriveParams, evaluateDeal, filterDeals } from "@/lib/whereToMove/judge";
import { LINK_URL, sendKakaoMemo } from "@/lib/whereToMove/kakao";
import { buildWeeklyMessage } from "@/lib/whereToMove/message";
import { kakaoAccountId, listDeals, listNotifyTargets, logNotify, markNotified } from "@/lib/whereToMove/repo";

// 월요일 08시 KST. 사용자마다 지난 알림 이후 새로 들어온 거래를 판정해 카카오톡 나에게 보내기로 보낸다.
export async function GET(request: Request) {
  if (!isCronAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return Response.json({ ok: false }, { status: 401 });
  }
  const runAt = new Date();
  const results: { userId: string; status: "sent" | "failed"; error?: string }[] = [];

  for (const t of await listNotifyTargets()) {
    let newCount = 0;
    let okCount = 0;
    try {
      const since = t.lastNotifiedAt ?? runAt;
      const fresh = filterDeals(t.data, await listDeals(t.data.regions.map((r) => r.sggCd), { firstSeenAfter: since }));
      const p = deriveParams(t.data);
      const judged = fresh.map((d) => ({ ...d, ...evaluateDeal(p, d) }));
      newCount = judged.length;
      okCount = judged.filter((d) => d.ok).length;
      const text = buildWeeklyMessage(t.data.regions[0].label, judged);

      const accountId = await kakaoAccountId(t.userId);
      if (!accountId) throw new Error("카카오 계정 연결이 없습니다");
      const { accessToken } = await auth.api.getAccessToken({ body: { accountId, userId: t.userId } });
      if (!accessToken) throw new Error("카카오 access token 을 받지 못했습니다");
      await sendKakaoMemo(accessToken, text, LINK_URL);

      await markNotified(t.userId, runAt);
      await logNotify({ userId: t.userId, newCount, okCount, status: "sent" });
      results.push({ userId: t.userId, status: "sent" });
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      console.error("[whereToMove notify]", t.userId, error);
      await logNotify({ userId: t.userId, newCount, okCount, status: "failed", error });
      results.push({ userId: t.userId, status: "failed", error });
    }
  }
  return Response.json({ ok: results.every((r) => r.status === "sent"), results });
}
```

`judged`는 `StoredDeal & Evaluation`이라 `MessageDeal`(`type, dong, apt, area, amount, rent, date, ok, monthly`)의 필드를 모두 갖는다. 타입 오류가 나면 `judged.map(({ type, dong, apt, area, amount, rent, date, ok, monthly }) => ({ type, dong, apt, area, amount, rent, date, ok, monthly }))`로 넘긴다.

- [ ] **Step 2: 로컬 확인 (실제 카톡 1통 발송)**

사용자에게 "테스트 카톡 1통이 갑니다"라고 알린 뒤:

```bash
npx tsc --noEmit && npx eslint app/api && npm test
npm run dev   # 다른 터미널
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/where-to-move/cron/notify
node --env-file=.env.local -e "fetch('http://localhost:3000/api/where-to-move/cron/notify',{headers:{authorization:'Bearer '+process.env.CRON_SECRET}}).then(r=>r.json()).then(j=>console.log(JSON.stringify(j)))"
```

Expected: `401`, 그다음 `{"ok":true,"results":[{"userId":"...","status":"sent"}]}`. 카톡에 `[김포 부동산 주간] 신규 신고 0건 ...`(처음엔 기준 시각이 로그인 시각이라 0건일 수 있음)이 온다. "실거래 보기" 버튼이 목록으로 연결된다.
한 번 더 실행하면 `last_notified_at`이 갱신되어 신규 0건 메시지가 온다.

- [ ] **Step 3: 커밋**

```bash
git add app/api/where-to-move/cron/notify
git commit -m "feat(whereToMove): 주간 카카오톡 알림 Cron"
```

---

### Task 10: 시트 값 이전, 판정 비교, 배포, 병행 운영

**Files:**
- Create: `scripts/where-to-move/import-settings.ts`, `scripts/where-to-move/compare-sheet.ts`
- 입력 JSON은 저장소 밖(작업용 임시 폴더)에 두고 커밋하지 않는다.

**Interfaces:**
- Consumes: `parseSettings`(Task 2), `deriveParams`, `evaluateDeal`(Task 3), `saveSettings`(Task 6), `db`, `account`(Task 1)

- [ ] **Step 1: 이전 스크립트** — `scripts/where-to-move/import-settings.ts`

```ts
// 사용법: npx tsx --env-file=.env.local scripts/where-to-move/import-settings.ts <설정 JSON 경로> <카카오 회원번호>
// 설정 JSON 은 개인 재무정보라 저장소 밖에 두고 커밋하지 않는다.
import { readFileSync } from "node:fs";
import { and, eq } from "drizzle-orm";
import { db } from "../../lib/whereToMove/db";
import { getOrCreateSettings, saveSettings } from "../../lib/whereToMove/repo";
import { account } from "../../lib/whereToMove/schema";
import { parseSettings } from "../../lib/whereToMove/settings";

const [path, kakaoId] = process.argv.slice(2);
if (!path || !kakaoId) throw new Error("사용법: import-settings.ts <json> <카카오 회원번호>");

const parsed = parseSettings(JSON.parse(readFileSync(path, "utf8")));
if (!parsed.ok) {
  console.error(parsed.errors);
  process.exit(1);
}
const [row] = await db.select({ userId: account.userId }).from(account)
  .where(and(eq(account.providerId, "kakao"), eq(account.accountId, kakaoId)));
if (!row) throw new Error("그 카카오 회원번호로 로그인한 사용자가 없습니다. 먼저 웹에서 로그인하세요.");
const current = await getOrCreateSettings(row.userId);
await saveSettings(row.userId, parsed.settings, current.notifyEnabled);
console.log("설정을 저장했습니다:", row.userId);
process.exit(0);
```

`repo.ts`·`db.ts`는 `@/` 별칭 없이 상대 경로만 쓰므로 tsx로 바로 실행된다. 실행 전에 `npx tsx --help | grep env-file`로 `--env-file` 지원을 확인하고, 없으면 `node --env-file=.env.local --import tsx scripts/...`로 실행한다.

- [ ] **Step 2: 비교 스크립트** — `scripts/where-to-move/compare-sheet.ts`

```ts
// 사용법: npx tsx scripts/where-to-move/compare-sheet.ts <설정 JSON> <거래기록 JSON>
// 거래기록 JSON: [{ "type": "전세", "amount": 20947, "rent": 0, "verdict": "부적합" }, ...] (시트 '거래기록' C·I·J·N 열)
import { readFileSync } from "node:fs";
import { deriveParams, evaluateDeal } from "../../lib/whereToMove/judge";
import { parseSettings } from "../../lib/whereToMove/settings";
import type { DealType } from "../../lib/whereToMove/types";

const [settingsPath, rowsPath] = process.argv.slice(2);
const parsed = parseSettings(JSON.parse(readFileSync(settingsPath, "utf8")));
if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
const p = deriveParams(parsed.settings);
const rows = JSON.parse(readFileSync(rowsPath, "utf8")) as { type: DealType; amount: number; rent: number; verdict: string }[];

let mismatch = 0;
for (const r of rows) {
  const ok = evaluateDeal(p, r).ok;
  if (ok !== (r.verdict === "적합")) {
    mismatch++;
    console.log("불일치:", r.type, r.amount, r.rent, "시트", r.verdict, "새 판정", ok ? "적합" : "부적합");
  }
}
console.log(`비교 ${rows.length}건, 불일치 ${mismatch}건`);
process.exit(mismatch ? 1 : 0);
```

- [ ] **Step 3: 커밋 (스크립트만)**

```bash
npx tsc --noEmit
git add scripts/where-to-move
git commit -m "chore(whereToMove): 시트 설정 이전·판정 비교 스크립트"
```

- [ ] **Step 4: 운영 배포 (사용자 확인 후)**

사용자에게 "main 머지 + push로 운영 배포합니다. 배포 직후부터 `/whereToMove`는 카카오 로그인으로 바뀝니다"라고 확인을 받는다.

```bash
npm test && npm run build
git switch main && git merge --no-ff feature/where-to-move-foundation -m "Merge branch 'feature/where-to-move-foundation'"
git push origin main
```

배포가 끝나면(1~2분) 확인:

```bash
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" https://tools.molespapa.com/whereToMove
curl -s -o /dev/null -w "%{http_code}\n" https://tools.molespapa.com/api/where-to-move/cron/collect
```

Expected: `307 https://tools.molespapa.com/whereToMove/login`, `401`. 사용자에게 휴대폰 카톡 인앱 브라우저에서 카카오 로그인을 해 달라고 부탁한다.
운영 DB에 거래를 처음 채우기 위해 수집을 한 번 직접 호출한다:

```bash
node --env-file=.env.local -e "fetch('https://tools.molespapa.com/api/where-to-move/cron/collect',{headers:{authorization:'Bearer '+process.env.CRON_SECRET}}).then(r=>r.json()).then(j=>console.log(j.ok, j.results.length))"
```

(`.env.local`의 `CRON_SECRET`은 Development 값이므로 Production 값과 다르면 401이 난다. 그 경우 `vercel env pull --environment=production .env.production.local --yes` 후 그 파일로 실행하고, 끝나면 파일을 지운다.)

- [ ] **Step 5: 시트 값 이전**

1. Google Sheets 커넥터로 `조건` A1:C27과 `내자산부채` A1:D31을 읽는다.
2. 6장의 스키마로 설정 JSON을 만들어 scratchpad에 저장한다. 빌라 대출은 `repayment: "amortizing", repaidIfHomeSold: true`, 차량 대출은 `repayment: "bullet", repaidIfHomeSold: false`다. 비율은 0~1이다.
3. 실행:
   ```bash
   npx tsx --env-file=.env.production.local scripts/where-to-move/import-settings.ts "<scratchpad>/wtm-settings.json" <카카오 회원번호>
   ```
4. 웹 `/whereToMove/settings`의 "계산 결과"가 시트 `조건`의 계산값(월 가용액, DSR 반영 한도, 적용 현금, 적용 비율)과 같은지 사용자와 함께 확인한다.

- [ ] **Step 6: 판정 비교**

1. 시트 메뉴 "기록 다시 판정"을 사용자가 실행한다(시트 판정을 현재 조건에 맞춤).
2. 커넥터로 `거래기록` C:N을 읽어 `{type, amount, rent, verdict}` 배열 JSON을 scratchpad에 저장한다.
3. `npx tsx scripts/where-to-move/compare-sheet.ts "<scratchpad>/wtm-settings.json" "<scratchpad>/wtm-rows.json"`
   Expected: `불일치 0건`. 불일치가 있으면 원인을 찾아 `judge.ts`를 고치고(가상 값 테스트 추가) 다시 비교한다.
4. 비교가 끝나면 scratchpad의 JSON 파일을 지운다.

- [ ] **Step 7: 병행 운영 안내**

사용자에게 안내한다: 다음 1~2주 월요일에 Apps Script 카톡과 새 카톡이 둘 다 온다. 두 메시지의 "신규 신고"와 "예산 적합" 건수가 다르면 알려 달라. 새 알림은 로그인 시각 이후 수집분만 세므로 첫 주는 건수가 적을 수 있다.

---

### Task 11: 정리 (병행 운영 뒤, 사용자 확인 후)

**Files:**
- Delete: `app/api/where-to-move/revalidate/route.ts`
- Modify: `(로컬 인계 폴더)/CLAUDE.md`, `Code.gs`(선택)

- [ ] **Step 1: Apps Script 끄기**

사용자에게 시트 메뉴 "자동 발송 상태 확인"에서 트리거를 지우거나, Apps Script 편집기 → 트리거에서 `weeklyReport`를 삭제해 달라고 부탁한다. 웹앱 배포는 보관(archive)해도 된다.

- [ ] **Step 2: 옛 경로와 환경변수 삭제**

```bash
git switch -c chore/where-to-move-cleanup
git rm app/api/where-to-move/revalidate/route.ts
grep -rn "GIMPO_" app lib proxy.ts
```

Expected: `grep` 결과 없음. 있으면 해당 코드를 지운다.

```bash
npx tsc --noEmit && npm test && npm run build
git commit -m "chore(whereToMove): Apps Script 연동 경로 삭제"
```

사용자 확인 후 main 머지·push. 그 뒤 Vercel 환경변수 `GIMPO_USER`, `GIMPO_PASS`, `GIMPO_API_URL`, `GIMPO_API_TOKEN`을 삭제한다(`vercel env rm <이름> production`, 사용자 확인 후).

- [ ] **Step 3: 인계 문서 갱신**

`(로컬 인계 폴더)/CLAUDE.md`의 "구성"과 "현재 상태"를 새 구조(Neon, Better Auth, Cron, 설정 화면)로 바꾸고, 시트·Apps Script는 기록용이라고 적는다.
