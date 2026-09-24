# WordPress 관리 웹 화면 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `tools.molespapa.com`(이 Next.js 앱)에 `/admin/wordpress` 관리 화면을 추가해, 단일 글
등록·JSON 일괄 등록·예약 발행·예약 글 목록 조회를 브라우저에서 할 수 있게 한다.

**Architecture:** `wordpress-publisher/` CLI의 핵심 로직(인증 클라이언트, 카테고리/태그 해석,
글 CRUD/SEO/예약, 일괄 처리)을 이 앱의 `lib/wordpress/`에 이 앱 관례(확장자 없는 상대 임포트,
dry-run 없음)로 다시 작성한다. `proxy.ts`(Next.js 16의 middleware 대체)가 `/admin/*`을
비밀번호 쿠키로 보호하고, Server Action들이 이중으로 같은 쿠키를 재검증한다(Next.js 문서:
Server Function은 UI를 거치지 않고 직접 POST로도 호출될 수 있어, 액션 내부에서도 반드시
인증을 확인해야 한다).

**Tech Stack:** Next.js 16(App Router, Server Actions, `proxy.ts`), React 19, TypeScript,
Web Crypto API(`crypto.subtle`, Node/Edge 런타임 모두에서 동작), vitest.

**Spec:** `docs/superpowers/specs/2026-09-24-wordpress-admin-web-design.md`

## Global Constraints

- 위치: 이 앱(`D:\prj\tools-calculator`) 안. 독립 프로젝트였던 `wordpress-publisher/`는
  건드리지 않는다 — 로직을 복사해서 `lib/wordpress/`에 다시 쓴다(스펙 §3에서 승인된 방식).
- `lib/wordpress/client.ts`에는 **dry-run이 없다** — 이 화면은 항상 실제 요청을 보낸다. 그래서
  CLI의 `WpDryRunResult`/`isDryRunResult`/`client.dryRun` 관련 코드는 전부 뺀다.
- `create`/`update`/`batch-create`(발행 아닌 것)는 명시적으로 "지금 발행"을 선택하지 않으면
  항상 `status: draft`. `schedule`은 예외로 항상 `status: "future"`.
- 발행 시각은 KST로 입력받아 UTC로 변환한다. 과거 시각이면 요청을 보내기 전에 에러.
- 관리자 비밀번호(`ADMIN_PASSWORD`)와 워드프레스 자격증명(`WP_USERNAME`/`WP_APP_PASSWORD`)은
  서버 환경변수에서만 읽는다. 클라이언트 컴포넌트, 응답 JSON, 에러 메시지 어디에도 원문을
  포함하지 않는다.
- **간소화(스펙 §5/§8의 "HMAC 서명"/"상수시간 비교"에서 조정)**: 세션 쿠키는 HMAC 대신
  `SHA-256(ADMIN_PASSWORD)`를 값으로 쓴다 — 비밀번호를 알아야만 같은 값을 만들 수 있고,
  `ADMIN_PASSWORD`를 바꾸면 기존 쿠키가 전부 무효화되어 스펙의 의도(위조 불가능, 폐기 가능)를
  그대로 만족한다. 별도 서명 라이브러리나 타임스탬프가 필요 없어 Node/Edge 런타임 어디서든
  `crypto.subtle`만으로 동작한다. 비밀번호 비교 자체는 단일 관리자용 낮은 위협 모델이라 일반
  문자열 비교(`===`)로 충분하다고 보고 상수시간 비교는 넣지 않는다.
- 매 태스크 커밋마다 관련 `npx vitest run`이 통과해야 한다.
- 실제 molespapa.com에 대한 요청은 이 플랜의 마지막 태스크 전까지 발생하지 않는다(전부
  `fetch` 모킹으로 테스트).

---

## Task 1: 관리자 세션 (`lib/admin/session.ts`)

**Files:**
- Create: `lib/admin/session.ts`
- Test: `lib/admin/session.test.ts`

**Interfaces:**
- Produces: `hashPassword(password: string): Promise<string>`,
  `createSessionCookieValue(): Promise<string>` (= `hashPassword(process.env.ADMIN_PASSWORD)`),
  `isValidSessionCookie(value: string | undefined): Promise<boolean>`

- [ ] **Step 1: 실패하는 테스트 작성**

`lib/admin/session.test.ts`:
```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createSessionCookieValue, hashPassword, isValidSessionCookie } from "./session";

const ORIGINAL_ENV = process.env.ADMIN_PASSWORD;

beforeEach(() => {
  process.env.ADMIN_PASSWORD = "test-admin-secret";
});

afterEach(() => {
  process.env.ADMIN_PASSWORD = ORIGINAL_ENV;
});

describe("hashPassword", () => {
  it("같은 입력이면 항상 같은 해시를 만든다", async () => {
    const a = await hashPassword("hello");
    const b = await hashPassword("hello");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("다른 입력이면 다른 해시를 만든다", async () => {
    const a = await hashPassword("hello");
    const b = await hashPassword("hello2");
    expect(a).not.toBe(b);
  });
});

describe("createSessionCookieValue / isValidSessionCookie", () => {
  it("현재 ADMIN_PASSWORD의 해시값을 만든다", async () => {
    const value = await createSessionCookieValue();
    expect(value).toBe(await hashPassword("test-admin-secret"));
  });

  it("올바른 쿠키 값은 유효하다", async () => {
    const value = await createSessionCookieValue();
    await expect(isValidSessionCookie(value)).resolves.toBe(true);
  });

  it("잘못된 쿠키 값은 무효하다", async () => {
    await expect(isValidSessionCookie("aaaaaaaa")).resolves.toBe(false);
  });

  it("쿠키가 없으면 무효하다", async () => {
    await expect(isValidSessionCookie(undefined)).resolves.toBe(false);
  });

  it("ADMIN_PASSWORD를 바꾸면 예전 쿠키가 무효해진다", async () => {
    const oldValue = await createSessionCookieValue();
    process.env.ADMIN_PASSWORD = "new-secret";
    await expect(isValidSessionCookie(oldValue)).resolves.toBe(false);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run lib/admin/session.test.ts`
Expected: FAIL — `./session` 모듈이 없어서 에러

- [ ] **Step 3: `session.ts` 구현**

`lib/admin/session.ts`:
```ts
export async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function createSessionCookieValue(): Promise<string> {
  const password = process.env.ADMIN_PASSWORD ?? "";
  return hashPassword(password);
}

export async function isValidSessionCookie(
  value: string | undefined,
): Promise<boolean> {
  if (!value) return false;
  return value === (await createSessionCookieValue());
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run lib/admin/session.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: 커밋**

```bash
git add lib/admin/session.ts lib/admin/session.test.ts
git commit -m "admin: add session cookie hashing helpers"
```

---

## Task 2: 관리자 로그인 (`app/admin/login`)

**Files:**
- Create: `app/admin/login/page.tsx`
- Create: `app/admin/login/actions.ts`

**Interfaces:**
- Consumes: `hashPassword` (session.ts) — 직접 쓰지 않고, `login` 액션에서 비밀번호 비교 후
  `createSessionCookieValue()`를 호출해 쿠키를 만든다.
- Produces: `login(formData: FormData)` (Server Action, `app/admin/login/actions.ts`)

이 태스크는 폼/액션 자체라 단위테스트 대상이 아니다(브리핑 4에서 `npm run dev`로 수동 확인).

- [ ] **Step 1: Server Action 작성**

`app/admin/login/actions.ts`:
```ts
"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSessionCookieValue } from "@/lib/admin/session";

export async function login(formData: FormData): Promise<{ error?: string }> {
  const password = String(formData.get("password") ?? "");
  const expected = process.env.ADMIN_PASSWORD ?? "";

  if (!expected || password !== expected) {
    return { error: "비밀번호가 올바르지 않습니다." };
  }

  const cookieStore = await cookies();
  cookieStore.set("admin_session", await createSessionCookieValue(), {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30일
  });

  redirect("/admin/wordpress");
}
```

- [ ] **Step 2: 로그인 페이지 작성**

`app/admin/login/page.tsx`:
```tsx
"use client";

import { useActionState } from "react";
import { login } from "./actions";

const initialState: { error?: string } = {};

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(
    async (_prev: typeof initialState, formData: FormData) => login(formData),
    initialState,
  );

  return (
    <main className="mx-auto flex min-h-full max-w-sm flex-1 flex-col justify-center px-4">
      <h1 className="mb-6 text-xl font-bold">관리자 로그인</h1>
      <form action={formAction} className="space-y-4">
        <input
          type="password"
          name="password"
          autoFocus
          required
          placeholder="비밀번호"
          className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-950"
        />
        {state.error && (
          <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
            {state.error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-xl bg-emerald-600 py-3 font-semibold text-white disabled:opacity-50"
        >
          {pending ? "확인 중..." : "로그인"}
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 3: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 4: 커밋**

```bash
git add app/admin/login
git commit -m "admin: add login page and server action"
```

---

## Task 3: `/admin` 보호 (`proxy.ts`)

**Files:**
- Create: `proxy.ts` (프로젝트 루트, `app/`과 같은 레벨)

**Interfaces:**
- Consumes: `isValidSessionCookie` (`lib/admin/session.ts`)

Next.js 16에서는 `middleware.ts`가 `proxy.ts`로 이름이 바뀌었다(`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` 참고 — 반드시 `proxy.ts`로 만들어야 하며, `middleware.ts`로 만들면 동작하지 않는다). 이 태스크도 단위테스트 대상이 아니다(브리핑 4에서 수동 확인).

- [ ] **Step 1: `proxy.ts` 작성**

`proxy.ts`:
```ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isValidSessionCookie } from "@/lib/admin/session";

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/admin/login") {
    return NextResponse.next();
  }

  const cookie = request.cookies.get("admin_session")?.value;
  if (await isValidSessionCookie(cookie)) {
    return NextResponse.next();
  }

  return NextResponse.redirect(new URL("/admin/login", request.url));
}

export const config = {
  matcher: ["/admin/:path*"],
};
```

- [ ] **Step 2: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add proxy.ts
git commit -m "admin: protect /admin/* routes with a proxy auth gate"
```

---

## Task 4: `lib/wordpress/types.ts` + `config.ts`

**Files:**
- Create: `lib/wordpress/types.ts`
- Create: `lib/wordpress/config.ts`
- Test: `lib/wordpress/config.test.ts`

**Interfaces:**
- Produces: `PostInput`, `PostResult`, `SeoMetaInput`, `ScheduleInput`, `Report`, `ReportItem`,
  `ResolvedConfig` (types.ts, dry-run 관련 타입 없음), `loadConfig(env): ResolvedConfig`
  (config.ts)

- [ ] **Step 1: `types.ts` 작성** (테스트 없음 — 순수 타입 선언)

`lib/wordpress/types.ts`:
```ts
export interface SeoMetaInput {
  focusKeyword?: string;
  metaDescription?: string;
}

export interface PostInput {
  title: string;
  contentHtml: string;
  category?: string;
  tags?: string[];
  status?: "draft" | "publish";
  seo?: SeoMetaInput;
}

export type PostPatch = Partial<PostInput>;

export interface ScheduleInput extends PostInput {
  publishAtKst: string;
}

export interface PostResult {
  id: number;
  url: string;
  status: string;
}

export interface ReportItem {
  input: unknown;
  status: "success" | "error";
  result?: PostResult & { warning?: string };
  error?: string;
}

export interface Report {
  success: number;
  failed: number;
  items: ReportItem[];
}

export interface ResolvedConfig {
  baseUrl: string;
  username: string;
  appPassword: string;
  defaultCategory?: string;
  defaultTags: string[];
}
```

- [ ] **Step 2: 실패하는 테스트 작성**

`lib/wordpress/config.test.ts`:
```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadConfig } from "./config";

const ORIGINAL = {
  WP_USERNAME: process.env.WP_USERNAME,
  WP_APP_PASSWORD: process.env.WP_APP_PASSWORD,
};

beforeEach(() => {
  process.env.WP_USERNAME = "editor";
  process.env.WP_APP_PASSWORD = "abcd efgh";
});

afterEach(() => {
  process.env.WP_USERNAME = ORIGINAL.WP_USERNAME;
  process.env.WP_APP_PASSWORD = ORIGINAL.WP_APP_PASSWORD;
});

describe("loadConfig", () => {
  it("env에서 자격증명을 읽고 고정된 기본값을 채운다", () => {
    const config = loadConfig(process.env);
    expect(config).toEqual({
      baseUrl: "https://molespapa.com/wp-json/wp/v2",
      username: "editor",
      appPassword: "abcd efgh",
      defaultCategory: "부동산",
      defaultTags: ["계산기", "금융"],
    });
  });

  it("WP_USERNAME이 없으면 에러를 던진다", () => {
    delete process.env.WP_USERNAME;
    expect(() => loadConfig(process.env)).toThrow(/WP_USERNAME/);
  });

  it("WP_APP_PASSWORD가 없으면 에러를 던진다", () => {
    delete process.env.WP_APP_PASSWORD;
    expect(() => loadConfig(process.env)).toThrow(/WP_APP_PASSWORD/);
  });
});
```

- [ ] **Step 3: 테스트가 실패하는지 확인**

Run: `npx vitest run lib/wordpress/config.test.ts`
Expected: FAIL — `./config` 모듈이 없어서 에러

- [ ] **Step 4: `config.ts` 구현**

`lib/wordpress/config.ts`:
```ts
import type { ResolvedConfig } from "./types";

const WORDPRESS_URL = "https://molespapa.com";
const API_ENDPOINT = "/wp-json/wp/v2";
const DEFAULT_CATEGORY = "부동산";
const DEFAULT_TAGS = ["계산기", "금융"];

export function loadConfig(
  env: Pick<NodeJS.ProcessEnv, "WP_USERNAME" | "WP_APP_PASSWORD">,
): ResolvedConfig {
  const username = env.WP_USERNAME;
  if (!username) {
    throw new Error("WP_USERNAME 환경변수가 설정되어 있지 않습니다.");
  }
  const appPassword = env.WP_APP_PASSWORD;
  if (!appPassword) {
    throw new Error("WP_APP_PASSWORD 환경변수가 설정되어 있지 않습니다.");
  }
  return {
    baseUrl: `${WORDPRESS_URL}${API_ENDPOINT}`,
    username,
    appPassword,
    defaultCategory: DEFAULT_CATEGORY,
    defaultTags: DEFAULT_TAGS,
  };
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run lib/wordpress/config.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 6: 커밋**

```bash
git add lib/wordpress/types.ts lib/wordpress/config.ts lib/wordpress/config.test.ts
git commit -m "wordpress-admin: add types and config loader (no dry-run)"
```

---

## Task 5: `lib/wordpress/client.ts`

**Files:**
- Create: `lib/wordpress/client.ts`
- Test: `lib/wordpress/client.test.ts`

**Interfaces:**
- Produces: `WpApiError` (class, `status: number`, `code?: string`), `WpRequest`,
  `WpClientOptions`, `WpClient` (`{ request<T>(req): Promise<T> }` — dry-run 없음),
  `createClient(opts: WpClientOptions): WpClient`

- [ ] **Step 1: 실패하는 테스트 작성**

`lib/wordpress/client.test.ts`:
```ts
import { describe, expect, it, vi } from "vitest";
import { createClient, WpApiError } from "./client";

function fakeFetch(status: number, body: unknown) {
  return vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  })) as unknown as typeof fetch;
}

describe("createClient", () => {
  it("Authorization 헤더를 Basic base64(username:password)로 붙인다", async () => {
    const fetchImpl = fakeFetch(200, { id: 1 });
    const client = createClient({
      baseUrl: "https://molespapa.com/wp-json/wp/v2",
      username: "editor",
      appPassword: "abcd efgh",
      fetchImpl,
    });

    await client.request({ method: "GET", path: "/posts/1" });

    const [, init] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0];
    const expected = "Basic " + Buffer.from("editor:abcd efgh").toString("base64");
    expect((init.headers as Record<string, string>).Authorization).toBe(expected);
  });

  it("실패 응답은 WpApiError로 던진다", async () => {
    const client = createClient({
      baseUrl: "https://molespapa.com/wp-json/wp/v2",
      username: "editor",
      appPassword: "x",
      fetchImpl: fakeFetch(403, { code: "rest_forbidden", message: "권한 없음" }),
    });

    await expect(
      client.request({ method: "POST", path: "/posts", body: { title: "t" } }),
    ).rejects.toMatchObject({ status: 403, code: "rest_forbidden" });
  });

  it("에러 메시지에 비밀번호가 절대 포함되지 않는다", async () => {
    const client = createClient({
      baseUrl: "https://molespapa.com/wp-json/wp/v2",
      username: "editor",
      appPassword: "super-secret-password",
      fetchImpl: fakeFetch(500, { message: "서버 오류" }),
    });

    try {
      await client.request({ method: "GET", path: "/posts/1" });
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(WpApiError);
      expect((e as Error).message).not.toContain("super-secret-password");
    }
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run lib/wordpress/client.test.ts`
Expected: FAIL — `./client` 모듈이 없어서 에러

- [ ] **Step 3: `client.ts` 구현**

`lib/wordpress/client.ts`:
```ts
export class WpApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "WpApiError";
    this.status = status;
    this.code = code;
  }
}

export interface WpRequest {
  method: "GET" | "POST";
  path: string;
  body?: unknown;
}

export interface WpClientOptions {
  baseUrl: string;
  username: string;
  appPassword: string;
  fetchImpl?: typeof fetch;
}

export interface WpClient {
  request<T>(req: WpRequest): Promise<T>;
}

export function createClient(opts: WpClientOptions): WpClient {
  const authHeader = "Basic " + Buffer.from(`${opts.username}:${opts.appPassword}`).toString("base64");
  const fetchImpl = opts.fetchImpl ?? fetch;

  return {
    async request<T>(req: WpRequest): Promise<T> {
      const url = `${opts.baseUrl}${req.path}`;
      const res = await fetchImpl(url, {
        method: req.method,
        headers: { "Content-Type": "application/json", Authorization: authHeader },
        body: req.body !== undefined ? JSON.stringify(req.body) : undefined,
      });
      const json: unknown = await res.json().catch(() => ({}));

      if (!res.ok) {
        const errBody = json as { message?: string; code?: string };
        throw new WpApiError(
          errBody.message ?? `WordPress API 오류 (HTTP ${res.status})`,
          res.status,
          errBody.code,
        );
      }
      return json as T;
    },
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run lib/wordpress/client.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: 커밋**

```bash
git add lib/wordpress/client.ts lib/wordpress/client.test.ts
git commit -m "wordpress-admin: add authenticated HTTP client (no dry-run)"
```

---

## Task 6: `lib/wordpress/taxonomy.ts`

**Files:**
- Create: `lib/wordpress/taxonomy.ts`
- Test: `lib/wordpress/taxonomy.test.ts`

**Interfaces:**
- Consumes: `WpClient`, `WpApiError` (client.ts)
- Produces: `createTaxonomyResolver(client: WpClient): { resolveCategoryId(name): Promise<number>; resolveTagIds(names): Promise<number[]> }`

- [ ] **Step 1: 실패하는 테스트 작성**

`lib/wordpress/taxonomy.test.ts`:
```ts
import { describe, expect, it, vi } from "vitest";
import { createTaxonomyResolver } from "./taxonomy";
import type { WpClient } from "./client";

describe("createTaxonomyResolver", () => {
  it("이름이 검색 결과에 있으면 해당 id를 반환한다", async () => {
    const request = vi.fn(async () => [
      { id: 5, name: "다른이름" },
      { id: 9, name: "부동산" },
    ]);
    const resolver = createTaxonomyResolver({ request } as unknown as WpClient);

    await expect(resolver.resolveCategoryId("부동산")).resolves.toBe(9);
    expect(request).toHaveBeenCalledWith({
      method: "GET",
      path: "/categories?search=%EB%B6%80%EB%8F%99%EC%82%B0",
    });
  });

  it("이름이 없으면 생성해서 새 id를 반환한다", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ id: 42, name: "새카테고리" });
    const resolver = createTaxonomyResolver({ request } as unknown as WpClient);

    await expect(resolver.resolveCategoryId("새카테고리")).resolves.toBe(42);
    expect(request).toHaveBeenLastCalledWith({
      method: "POST",
      path: "/categories",
      body: { name: "새카테고리" },
    });
  });

  it("생성 권한이 없으면(403) 사람이 읽을 수 있는 에러를 던진다", async () => {
    const { WpApiError } = await import("./client");
    const request = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new WpApiError("forbidden", 403));
    const resolver = createTaxonomyResolver({ request } as unknown as WpClient);

    await expect(resolver.resolveCategoryId("새카테고리")).rejects.toThrow(
      /권한이 없습니다/,
    );
  });

  it("여러 태그 이름을 병렬로 id 배열로 바꾼다", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce([{ id: 1, name: "계산기" }])
      .mockResolvedValueOnce([{ id: 2, name: "금융" }]);
    const resolver = createTaxonomyResolver({ request } as unknown as WpClient);

    await expect(resolver.resolveTagIds(["계산기", "금융"])).resolves.toEqual([1, 2]);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run lib/wordpress/taxonomy.test.ts`
Expected: FAIL — `./taxonomy` 모듈이 없어서 에러

- [ ] **Step 3: `taxonomy.ts` 구현**

`lib/wordpress/taxonomy.ts`:
```ts
import { WpApiError } from "./client";
import type { WpClient } from "./client";

type Kind = "categories" | "tags";

interface TaxonomyItem {
  id: number;
  name: string;
}

function labelFor(kind: Kind): string {
  return kind === "categories" ? "카테고리" : "태그";
}

export function createTaxonomyResolver(client: WpClient) {
  async function findOrCreate(kind: Kind, name: string): Promise<number> {
    const found = await client.request<TaxonomyItem[]>({
      method: "GET",
      path: `/${kind}?search=${encodeURIComponent(name)}`,
    });
    const exact = found.find((item) => item.name === name);
    if (exact) return exact.id;

    try {
      const created = await client.request<TaxonomyItem>({
        method: "POST",
        path: `/${kind}`,
        body: { name },
      });
      return created.id;
    } catch (e) {
      if (e instanceof WpApiError && (e.status === 401 || e.status === 403)) {
        throw new Error(
          `"${name}" ${labelFor(kind)}가 없고, 현재 계정에는 새로 만들 권한이 없습니다. WordPress 관리자에서 먼저 만들어 주세요.`,
        );
      }
      throw e;
    }
  }

  return {
    resolveCategoryId: (name: string) => findOrCreate("categories", name),
    resolveTagIds: (names: string[]) =>
      Promise.all(names.map((name) => findOrCreate("tags", name))),
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run lib/wordpress/taxonomy.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: 커밋**

```bash
git add lib/wordpress/taxonomy.ts lib/wordpress/taxonomy.test.ts
git commit -m "wordpress-admin: resolve category/tag names to ids"
```

---

## Task 7: `lib/wordpress/posts.ts`

**Files:**
- Create: `lib/wordpress/posts.ts`
- Test: `lib/wordpress/posts.test.ts`

**Interfaces:**
- Consumes: `WpClient`, `createTaxonomyResolver`, `PostInput`/`PostPatch`/`ScheduleInput`/
  `PostResult`/`SeoMetaInput`/`ResolvedConfig` (types.ts)
- Produces: `createPost(client, config, input, opts?: {publish?}): Promise<PostResult>`,
  `updatePost(client, config, id, patch, opts?: {publish?}): Promise<PostResult>`,
  `addSeoMeta(client, config, id, meta): Promise<PostResult & {warning?}>`,
  `kstToUtc(kst: string, now?: Date): Date`, `toWpDateGmt(date: Date): string`,
  `schedulePost(client, config, input: ScheduleInput, opts?: {now?}): Promise<PostResult>`

- [ ] **Step 1: 실패하는 테스트 작성 (날짜 변환)**

`lib/wordpress/posts.test.ts` 맨 위:
```ts
import { describe, expect, it, vi } from "vitest";
import {
  addSeoMeta,
  createPost,
  kstToUtc,
  schedulePost,
  toWpDateGmt,
  updatePost,
} from "./posts";
import type { WpClient } from "./client";
import type { ResolvedConfig } from "./types";

describe("kstToUtc", () => {
  it("KST 오전 9시는 UTC 0시다", () => {
    const utc = kstToUtc("2026-09-28 09:00", new Date("2026-09-01T00:00:00.000Z"));
    expect(utc.toISOString()).toBe("2026-09-28T00:00:00.000Z");
  });

  it("형식이 잘못되면 에러를 던진다", () => {
    expect(() => kstToUtc("2026/09/28 09:00")).toThrow(/형식/);
  });

  it("과거 시각이면 에러를 던진다", () => {
    const now = new Date("2026-09-28T00:00:00.000Z");
    expect(() => kstToUtc("2026-09-28 08:00", now)).toThrow(/과거/);
  });
});

describe("toWpDateGmt", () => {
  it("초 단위, Z 없는 형식으로 만든다", () => {
    expect(toWpDateGmt(new Date("2026-09-28T00:00:00.000Z"))).toBe("2026-09-28T00:00:00");
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run lib/wordpress/posts.test.ts`
Expected: FAIL — `./posts` 모듈이 없어서 에러

- [ ] **Step 3: `posts.ts`에 날짜 헬퍼 + `createPost` 구현**

`lib/wordpress/posts.ts` (파일 시작 부분):
```ts
import { createTaxonomyResolver } from "./taxonomy";
import type { WpClient } from "./client";
import type {
  PostInput,
  PostPatch,
  PostResult,
  ResolvedConfig,
  ScheduleInput,
  SeoMetaInput,
} from "./types";

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const KST_PATTERN = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/;

export function kstToUtc(kst: string, now: Date = new Date()): Date {
  const match = KST_PATTERN.exec(kst.trim());
  if (!match) {
    throw new Error(`발행 시각 형식이 올바르지 않습니다: "${kst}" (예: "2026-09-28 09:00")`);
  }
  const [, y, mo, d, h, mi] = match;
  const utcMs =
    Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi)) - KST_OFFSET_MS;

  if (utcMs <= now.getTime()) {
    throw new Error(`발행 시각이 과거입니다: "${kst}" (한국 시간 기준)`);
  }
  return new Date(utcMs);
}

export function toWpDateGmt(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "");
}

interface WpPostResponse {
  id: number;
  link: string;
  status: string;
}

interface WpPostResponseWithMeta extends WpPostResponse {
  meta?: Record<string, string>;
}

function buildSeoMeta(seo?: SeoMetaInput): Record<string, string> | undefined {
  if (!seo) return undefined;
  const meta: Record<string, string> = {};
  if (seo.focusKeyword !== undefined) meta._yoast_wpseo_focuskw = seo.focusKeyword;
  if (seo.metaDescription !== undefined) meta._yoast_wpseo_metadesc = seo.metaDescription;
  return meta;
}

async function resolveTaxonomy(
  client: WpClient,
  config: ResolvedConfig,
  category: string | undefined,
  tags: string[] | undefined,
): Promise<{ categoryId?: number; tagIds: number[] }> {
  const taxonomy = createTaxonomyResolver(client);
  const categoryName = category ?? config.defaultCategory;
  const tagNames = tags ?? config.defaultTags;
  const [categoryId, tagIds] = await Promise.all([
    categoryName ? taxonomy.resolveCategoryId(categoryName) : Promise.resolve(undefined),
    taxonomy.resolveTagIds(tagNames),
  ]);
  return { categoryId, tagIds };
}

export async function createPost(
  client: WpClient,
  config: ResolvedConfig,
  input: PostInput,
  opts: { publish?: boolean } = {},
): Promise<PostResult> {
  const { categoryId, tagIds } = await resolveTaxonomy(client, config, input.category, input.tags);
  const status = opts.publish ? input.status ?? "publish" : "draft";

  const body: Record<string, unknown> = { title: input.title, content: input.contentHtml, status };
  if (categoryId !== undefined) body.categories = [categoryId];
  if (tagIds.length > 0) body.tags = tagIds;
  const meta = buildSeoMeta(input.seo);
  if (meta) body.meta = meta;

  const response = await client.request<WpPostResponse>({ method: "POST", path: "/posts", body });
  return { id: response.id, url: response.link, status: response.status };
}
```

- [ ] **Step 4: 테스트 통과 확인 (날짜 헬퍼만)**

Run: `npx vitest run lib/wordpress/posts.test.ts`
Expected: PASS (4 tests — `createPost`는 아직 테스트가 없으니 실행되는 4개만 통과)

- [ ] **Step 5: `createPost`에 대한 실패하는 테스트 추가**

`lib/wordpress/posts.test.ts`에 추가:
```ts
function clientReturning(responses: unknown[]): WpClient {
  const queue = [...responses];
  const request = vi.fn(async () => queue.shift());
  return { request: request as never };
}

const config: ResolvedConfig = {
  baseUrl: "https://molespapa.com/wp-json/wp/v2",
  username: "editor",
  appPassword: "x",
  defaultCategory: "부동산",
  defaultTags: ["계산기", "금융"],
};

describe("createPost", () => {
  it("category/tags를 id로 바꿔 /posts에 POST하고, 기본 상태는 draft다", async () => {
    const client = clientReturning([
      [{ id: 9, name: "부동산" }],
      [{ id: 1, name: "계산기" }],
      [{ id: 2, name: "금융" }],
      { id: 123, link: "https://molespapa.com/?p=123", status: "draft" },
    ]);

    const result = await createPost(client, config, { title: "글 제목", contentHtml: "<p>본문</p>" });

    expect(result).toEqual({ id: 123, url: "https://molespapa.com/?p=123", status: "draft" });
    expect((client.request as ReturnType<typeof vi.fn>).mock.calls[3][0]).toMatchObject({
      method: "POST",
      path: "/posts",
      body: { title: "글 제목", content: "<p>본문</p>", status: "draft", categories: [9], tags: [1, 2] },
    });
  });

  it("opts.publish가 true면 status: publish를 보낸다", async () => {
    const client = clientReturning([
      [{ id: 9, name: "부동산" }],
      [{ id: 1, name: "계산기" }],
      [{ id: 2, name: "금융" }],
      { id: 1, link: "u", status: "publish" },
    ]);

    await createPost(client, config, { title: "t", contentHtml: "c" }, { publish: true });

    const body = (client.request as ReturnType<typeof vi.fn>).mock.calls[3][0].body;
    expect(body.status).toBe("publish");
  });

  it("opts.publish가 없으면 입력에 status: publish가 있어도 draft로 낮춘다", async () => {
    const client = clientReturning([
      [{ id: 9, name: "부동산" }],
      [{ id: 1, name: "계산기" }],
      [{ id: 2, name: "금융" }],
      { id: 1, link: "u", status: "draft" },
    ]);

    await createPost(client, config, { title: "t", contentHtml: "c", status: "publish" });

    const body = (client.request as ReturnType<typeof vi.fn>).mock.calls[3][0].body;
    expect(body.status).toBe("draft");
  });

  it("seo가 있으면 meta에 야스트 필드를 담는다", async () => {
    const client = clientReturning([
      [{ id: 9, name: "부동산" }],
      [{ id: 1, name: "계산기" }],
      [{ id: 2, name: "금융" }],
      { id: 1, link: "u", status: "draft" },
    ]);

    await createPost(client, config, {
      title: "t",
      contentHtml: "c",
      seo: { focusKeyword: "전세", metaDescription: "전세 설명" },
    });

    const body = (client.request as ReturnType<typeof vi.fn>).mock.calls[3][0].body;
    expect(body.meta).toEqual({ _yoast_wpseo_focuskw: "전세", _yoast_wpseo_metadesc: "전세 설명" });
  });
});
```

- [ ] **Step 6: 테스트가 실패하는지 확인**

Run: `npx vitest run lib/wordpress/posts.test.ts`
Expected: PASS (Step 3의 구현이 이미 `createPost`를 담고 있으므로 8개 전부 PASS. 만약 Step 3을
건너뛰고 여기 왔다면 FAIL 확인 후 Step 3을 적용한다.)

- [ ] **Step 7: `updatePost`/`addSeoMeta`에 대한 실패하는 테스트 추가**

`lib/wordpress/posts.test.ts`에 추가:
```ts
describe("updatePost", () => {
  it("바뀐 필드만 PATCH 본문에 담아 /posts/{id}에 보낸다", async () => {
    const client = clientReturning([{ id: 123, link: "u", status: "draft", meta: {} }]);

    await updatePost(client, config, 123, { title: "새 제목" });

    expect((client.request as ReturnType<typeof vi.fn>).mock.calls[0][0]).toEqual({
      method: "POST",
      path: "/posts/123",
      body: { title: "새 제목" },
    });
  });

  it("opts.publish 없이 status를 patch에 넣으면 draft로 강제한다", async () => {
    const client = clientReturning([{ id: 1, link: "u", status: "draft", meta: {} }]);

    await updatePost(client, config, 1, { status: "publish" });

    const body = (client.request as ReturnType<typeof vi.fn>).mock.calls[0][0].body;
    expect(body.status).toBe("draft");
  });
});

describe("addSeoMeta", () => {
  it("meta 필드로 얇게 위임하고, 응답에 값이 반영됐으면 경고가 없다", async () => {
    const client = clientReturning([
      {
        id: 123,
        link: "u",
        status: "publish",
        meta: { _yoast_wpseo_focuskw: "전세", _yoast_wpseo_metadesc: "설명" },
      },
    ]);

    const result = await addSeoMeta(client, config, 123, {
      focusKeyword: "전세",
      metaDescription: "설명",
    });

    expect(result.warning).toBeUndefined();
  });

  it("응답에 메타가 반영 안 되어 있으면 mu-plugin 설치를 안내하는 경고를 반환한다", async () => {
    const client = clientReturning([{ id: 123, link: "u", status: "publish", meta: {} }]);

    const result = await addSeoMeta(client, config, 123, {
      focusKeyword: "전세",
      metaDescription: "설명",
    });

    expect(result.warning).toMatch(/mu-plugin/);
  });
});
```

- [ ] **Step 8: 테스트가 실패하는지 확인**

Run: `npx vitest run lib/wordpress/posts.test.ts`
Expected: FAIL — `updatePost`/`addSeoMeta`가 정의되어 있지 않음

- [ ] **Step 9: `posts.ts`에 `updatePost`/`addSeoMeta` 추가**

`lib/wordpress/posts.ts` 끝에 추가:
```ts
async function buildPatchBody(
  client: WpClient,
  patch: PostPatch,
  opts: { publish?: boolean },
): Promise<Record<string, unknown>> {
  const body: Record<string, unknown> = {};
  if (patch.title !== undefined) body.title = patch.title;
  if (patch.contentHtml !== undefined) body.content = patch.contentHtml;

  if (patch.category !== undefined || patch.tags !== undefined) {
    const taxonomy = createTaxonomyResolver(client);
    if (patch.category !== undefined) {
      body.categories = [await taxonomy.resolveCategoryId(patch.category)];
    }
    if (patch.tags !== undefined) {
      body.tags = await taxonomy.resolveTagIds(patch.tags);
    }
  }

  if (patch.status !== undefined) {
    body.status = opts.publish ? patch.status : "draft";
  }

  const meta = buildSeoMeta(patch.seo);
  if (meta) body.meta = meta;

  return body;
}

export async function updatePost(
  client: WpClient,
  config: ResolvedConfig,
  id: number,
  patch: PostPatch,
  opts: { publish?: boolean } = {},
): Promise<PostResult> {
  const body = await buildPatchBody(client, patch, opts);
  const response = await client.request<WpPostResponse>({ method: "POST", path: `/posts/${id}`, body });
  return { id: response.id, url: response.link, status: response.status };
}

export async function addSeoMeta(
  client: WpClient,
  config: ResolvedConfig,
  id: number,
  meta: SeoMetaInput,
): Promise<PostResult & { warning?: string }> {
  const body = { meta: buildSeoMeta(meta) };
  const response = await client.request<WpPostResponseWithMeta>({
    method: "POST",
    path: `/posts/${id}`,
    body,
  });

  const applied = response.meta ?? {};
  const mismatch =
    (meta.focusKeyword !== undefined && applied._yoast_wpseo_focuskw !== meta.focusKeyword) ||
    (meta.metaDescription !== undefined && applied._yoast_wpseo_metadesc !== meta.metaDescription);

  return {
    id: response.id,
    url: response.link,
    status: response.status,
    warning: mismatch
      ? "WordPress가 Yoast 메타를 저장하지 않았습니다. wp-content/mu-plugins/enable-yoast-rest-meta.php를 사이트에 설치했는지 확인하세요."
      : undefined,
  };
}
```

- [ ] **Step 10: 테스트 통과 확인**

Run: `npx vitest run lib/wordpress/posts.test.ts`
Expected: PASS (12개)

- [ ] **Step 11: `schedulePost`에 대한 실패하는 테스트 추가**

`lib/wordpress/posts.test.ts`에 추가:
```ts
describe("schedulePost", () => {
  it("status: future와 date_gmt를 포함해 createPost와 같은 방식으로 등록한다", async () => {
    const client = clientReturning([
      [{ id: 9, name: "부동산" }],
      [{ id: 1, name: "계산기" }],
      [{ id: 2, name: "금융" }],
      { id: 1, link: "u", status: "future" },
    ]);

    const now = new Date("2026-09-01T00:00:00.000Z");
    await schedulePost(
      client,
      config,
      { title: "t", contentHtml: "c", publishAtKst: "2026-09-28 09:00" },
      { now },
    );

    const body = (client.request as ReturnType<typeof vi.fn>).mock.calls[3][0].body;
    expect(body.status).toBe("future");
    expect(body.date_gmt).toBe("2026-09-28T00:00:00");
  });

  it("과거 시각이면 요청 없이 에러를 던진다", async () => {
    const client = clientReturning([]);
    const now = new Date("2026-10-01T00:00:00.000Z");

    await expect(
      schedulePost(
        client,
        config,
        { title: "t", contentHtml: "c", publishAtKst: "2026-09-28 09:00" },
        { now },
      ),
    ).rejects.toThrow(/과거/);
    expect(client.request).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 12: 테스트가 실패하는지 확인**

Run: `npx vitest run lib/wordpress/posts.test.ts`
Expected: FAIL — `schedulePost`가 정의되어 있지 않음

- [ ] **Step 13: `posts.ts`에 `schedulePost` 추가**

`lib/wordpress/posts.ts` 끝에 추가:
```ts
export async function schedulePost(
  client: WpClient,
  config: ResolvedConfig,
  input: ScheduleInput,
  opts: { now?: Date } = {},
): Promise<PostResult> {
  const utc = kstToUtc(input.publishAtKst, opts.now);
  const { categoryId, tagIds } = await resolveTaxonomy(client, config, input.category, input.tags);

  const body: Record<string, unknown> = {
    title: input.title,
    content: input.contentHtml,
    status: "future",
    date_gmt: toWpDateGmt(utc),
  };
  if (categoryId !== undefined) body.categories = [categoryId];
  if (tagIds.length > 0) body.tags = tagIds;
  const meta = buildSeoMeta(input.seo);
  if (meta) body.meta = meta;

  const response = await client.request<WpPostResponse>({ method: "POST", path: "/posts", body });
  return { id: response.id, url: response.link, status: response.status };
}
```

- [ ] **Step 14: 테스트 통과 확인**

Run: `npx vitest run lib/wordpress/posts.test.ts`
Expected: PASS (14개 전체)

- [ ] **Step 15: 커밋**

```bash
git add lib/wordpress/posts.ts lib/wordpress/posts.test.ts
git commit -m "wordpress-admin: implement createPost/updatePost/addSeoMeta/schedulePost"
```

---

## Task 8: `lib/wordpress/batch.ts`

**Files:**
- Create: `lib/wordpress/batch.ts`
- Test: `lib/wordpress/batch.test.ts`

**Interfaces:**
- Consumes: `createPost`, `schedulePost`, `addSeoMeta` (posts.ts), `PostInput`, `Report`,
  `ResolvedConfig` (types.ts)
- Produces: `parseBulkCreateRows(text: string, format: "json" | "csv"): Array<PostInput & {publishAtKst?: string}>`,
  `bulkCreate(client, config, rows, opts: {publish?}): Promise<Report>`,
  `parseBulkMetaRows(text: string, format: "json" | "csv"): Array<{id: number} & SeoMetaInput>`,
  `bulkUpdateMeta(client, config, rows): Promise<Report>`

CLI와의 차이: 웹에는 로컬 파일 시스템이 없으므로 CSV의 `content_file` 컬럼(다른 파일 경로)은
지원하지 않는다 — CSV는 `content` 컬럼에 HTML을 직접 담아야 한다. 파싱 함수는 파일 경로 대신
**텍스트 문자열**(브라우저에서 읽은 파일 내용 또는 붙여넣은 텍스트)을 받는다.

- [ ] **Step 1: 실패하는 테스트 작성**

`lib/wordpress/batch.test.ts`:
```ts
import { describe, expect, it, vi } from "vitest";
import { bulkCreate, bulkUpdateMeta, parseBulkCreateRows, parseBulkMetaRows } from "./batch";
import type { WpClient } from "./client";
import type { ResolvedConfig } from "./types";

const config: ResolvedConfig = {
  baseUrl: "https://molespapa.com/wp-json/wp/v2",
  username: "e",
  appPassword: "p",
  defaultTags: [],
};

describe("parseBulkCreateRows", () => {
  it("JSON 배열을 그대로 읽는다", () => {
    const text = JSON.stringify([{ title: "t1", contentHtml: "<p>1</p>" }]);
    expect(parseBulkCreateRows(text, "json")).toEqual([{ title: "t1", contentHtml: "<p>1</p>" }]);
  });

  it("CSV는 content 컬럼에서 HTML을 직접 읽는다", () => {
    const csv = 'title,content,category,tags\n"글1","<p>본문1</p>",부동산,계산기;금융\n';
    expect(parseBulkCreateRows(csv, "csv")).toEqual([
      { title: "글1", contentHtml: "<p>본문1</p>", category: "부동산", tags: ["계산기", "금융"] },
    ]);
  });
});

describe("bulkCreate", () => {
  it("각 행마다 createPost를 호출하고 성공/실패를 리포트한다", async () => {
    const rows = [
      { title: "성공글", contentHtml: "<p>1</p>" },
      { title: "실패글", contentHtml: "<p>2</p>" },
    ];
    const request = vi
      .fn()
      .mockResolvedValueOnce({ id: 1, link: "u1", status: "draft" })
      .mockRejectedValueOnce(new Error("서버 오류"));
    const client = { request } as unknown as WpClient;

    const report = await bulkCreate(client, config, rows, {});

    expect(report.success).toBe(1);
    expect(report.failed).toBe(1);
    expect(report.items[1].status).toBe("error");
    expect(report.items[1].error).toBe("서버 오류");
  });
});

describe("parseBulkMetaRows", () => {
  it("JSON 배열을 그대로 읽는다", () => {
    const text = JSON.stringify([{ id: 5, metaDescription: "설명" }]);
    expect(parseBulkMetaRows(text, "json")).toEqual([{ id: 5, metaDescription: "설명" }]);
  });

  it("CSV에서 id/focus_keyword/meta_description을 읽는다", () => {
    const csv = "id,focus_keyword,meta_description\n123,전세,전세 설명\n";
    expect(parseBulkMetaRows(csv, "csv")).toEqual([
      { id: 123, focusKeyword: "전세", metaDescription: "전세 설명" },
    ]);
  });
});

describe("bulkUpdateMeta", () => {
  it("각 행마다 addSeoMeta를 호출하고 실패해도 계속한다", async () => {
    const rows = [
      { id: 1, metaDescription: "성공" },
      { id: 2, metaDescription: "실패" },
    ];
    const request = vi
      .fn()
      .mockResolvedValueOnce({ id: 1, link: "u", status: "publish", meta: { _yoast_wpseo_metadesc: "성공" } })
      .mockRejectedValueOnce(new Error("찾을 수 없음"));
    const client = { request } as unknown as WpClient;

    const report = await bulkUpdateMeta(client, config, rows);

    expect(report.success).toBe(1);
    expect(report.failed).toBe(1);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run lib/wordpress/batch.test.ts`
Expected: FAIL — `./batch` 모듈이 없어서 에러

- [ ] **Step 3: `csv-parse` 의존성 추가**

`package.json`의 `dependencies`에 `"csv-parse": "^5.5.6"` 추가 후:
Run: `npm install`

- [ ] **Step 4: `batch.ts` 구현**

`lib/wordpress/batch.ts`:
```ts
import { parse as parseCsv } from "csv-parse/sync";
import { addSeoMeta, createPost, schedulePost } from "./posts";
import type { WpClient } from "./client";
import type { PostInput, Report, ResolvedConfig, SeoMetaInput } from "./types";

type BulkRow = PostInput & { publishAtKst?: string };
type MetaRow = SeoMetaInput & { id: number };

export function parseBulkCreateRows(text: string, format: "json" | "csv"): BulkRow[] {
  if (format === "json") {
    return JSON.parse(text) as BulkRow[];
  }
  const rows = parseCsv(text, { columns: true, skip_empty_lines: true }) as Record<string, string>[];
  return rows.map((row) => ({
    title: row.title,
    contentHtml: row.content ?? "",
    category: row.category || undefined,
    tags: row.tags ? row.tags.split(";").map((t) => t.trim()).filter(Boolean) : undefined,
    seo:
      row.focus_keyword || row.meta_description
        ? { focusKeyword: row.focus_keyword || undefined, metaDescription: row.meta_description || undefined }
        : undefined,
    publishAtKst: row.publish_at_kst || undefined,
  }));
}

export async function bulkCreate(
  client: WpClient,
  config: ResolvedConfig,
  rows: BulkRow[],
  opts: { publish?: boolean },
): Promise<Report> {
  const report: Report = { success: 0, failed: 0, items: [] };

  for (const row of rows) {
    try {
      const { publishAtKst, ...post } = row;
      const result = publishAtKst
        ? await schedulePost(client, config, { ...post, publishAtKst })
        : await createPost(client, config, post, opts);
      report.success += 1;
      report.items.push({ input: row, status: "success", result });
    } catch (e) {
      report.failed += 1;
      report.items.push({ input: row, status: "error", error: (e as Error).message });
    }
  }
  return report;
}

export function parseBulkMetaRows(text: string, format: "json" | "csv"): MetaRow[] {
  if (format === "json") {
    return JSON.parse(text) as MetaRow[];
  }
  const rows = parseCsv(text, { columns: true, skip_empty_lines: true }) as Record<string, string>[];
  return rows.map((row) => ({
    id: Number(row.id),
    focusKeyword: row.focus_keyword || undefined,
    metaDescription: row.meta_description || undefined,
  }));
}

export async function bulkUpdateMeta(
  client: WpClient,
  config: ResolvedConfig,
  rows: MetaRow[],
): Promise<Report> {
  const report: Report = { success: 0, failed: 0, items: [] };

  for (const row of rows) {
    try {
      const result = await addSeoMeta(client, config, row.id, row);
      report.success += 1;
      report.items.push({ input: row, status: "success", result });
    } catch (e) {
      report.failed += 1;
      report.items.push({ input: row, status: "error", error: (e as Error).message });
    }
  }
  return report;
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run lib/wordpress/batch.test.ts`
Expected: PASS (6개)

- [ ] **Step 6: 커밋**

```bash
git add lib/wordpress/batch.ts lib/wordpress/batch.test.ts package.json package-lock.json
git commit -m "wordpress-admin: add bulk create and bulk meta update"
```

---

## Task 9: Server Actions (`app/admin/wordpress/actions.ts`)

**Files:**
- Create: `app/admin/wordpress/actions.ts`

**Interfaces:**
- Consumes: `loadConfig` (config.ts), `createClient` (client.ts), `createPost`/`schedulePost`
  (posts.ts), `bulkCreate`/`bulkUpdateMeta`/`parseBulkCreateRows`/`parseBulkMetaRows` (batch.ts),
  `isValidSessionCookie` (`lib/admin/session.ts`)
- Produces: `createPostAction`, `scheduleAction`, `bulkCreateAction`, `bulkUpdateMetaAction`,
  `listScheduledAction` (모두 Server Actions)

이 태스크는 wiring이라 단위테스트 대상이 아니다(Task 12에서 실제 화면으로 확인). Next.js
문서(`node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md`)의 경고대로,
Server Function은 UI 없이 직접 POST로도 호출될 수 있으므로 **모든 액션이 시작할 때 관리자
쿠키를 다시 확인**한다.

- [ ] **Step 1: `actions.ts` 작성**

`app/admin/wordpress/actions.ts`:
```ts
"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/wordpress/client";
import { loadConfig } from "@/lib/wordpress/config";
import { createPost, schedulePost } from "@/lib/wordpress/posts";
import { bulkCreate, bulkUpdateMeta, parseBulkCreateRows, parseBulkMetaRows } from "@/lib/wordpress/batch";
import { isValidSessionCookie } from "@/lib/admin/session";
import type { PostInput, Report, ScheduleInput } from "@/lib/wordpress/types";

async function requireAdmin(): Promise<void> {
  const cookieStore = await cookies();
  const value = cookieStore.get("admin_session")?.value;
  if (!(await isValidSessionCookie(value))) {
    throw new Error("인증이 필요합니다. 다시 로그인해 주세요.");
  }
}

function client() {
  const config = loadConfig(process.env);
  return { client: createClient({ baseUrl: config.baseUrl, username: config.username, appPassword: config.appPassword }), config };
}

function requireTitle(input: { title: string }): void {
  if (!input.title || !input.title.trim()) {
    throw new Error("제목을 입력해 주세요.");
  }
}

export async function createPostAction(
  input: PostInput,
  publish: boolean,
): Promise<{ ok: true; id: number; url: string; status: string } | { ok: false; error: string }> {
  await requireAdmin();
  try {
    requireTitle(input);
    const { client: c, config } = client();
    const result = await createPost(c, config, input, { publish });
    return { ok: true, ...result };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function scheduleAction(
  input: ScheduleInput,
): Promise<{ ok: true; id: number; url: string; status: string } | { ok: false; error: string }> {
  await requireAdmin();
  try {
    requireTitle(input);
    const { client: c, config } = client();
    const result = await schedulePost(c, config, input);
    return { ok: true, ...result };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function bulkCreateAction(
  text: string,
  format: "json" | "csv",
  publish: boolean,
): Promise<{ ok: true; report: Report } | { ok: false; error: string }> {
  await requireAdmin();
  try {
    const rows = parseBulkCreateRows(text, format);
    const { client: c, config } = client();
    const report = await bulkCreate(c, config, rows, { publish });
    return { ok: true, report };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function bulkUpdateMetaAction(
  text: string,
  format: "json" | "csv",
): Promise<{ ok: true; report: Report } | { ok: false; error: string }> {
  await requireAdmin();
  try {
    const rows = parseBulkMetaRows(text, format);
    const { client: c, config } = client();
    const report = await bulkUpdateMeta(c, config, rows);
    return { ok: true, report };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export interface ScheduledPostSummary {
  id: number;
  title: string;
  dateGmt: string;
  link: string;
}

export async function listScheduledAction(): Promise<ScheduledPostSummary[]> {
  await requireAdmin();
  const { client: c } = client();
  const posts = await c.request<Array<{ id: number; title: { rendered: string }; date_gmt: string; link: string }>>({
    method: "GET",
    path: "/posts?status=future&per_page=50&context=edit",
  });
  return posts.map((p) => ({ id: p.id, title: p.title.rendered, dateGmt: p.date_gmt, link: p.link }));
}
```

- [ ] **Step 2: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add app/admin/wordpress/actions.ts
git commit -m "admin: add wordpress server actions with per-action auth check"
```

---

## Task 10: 단일 글 등록 폼

**Files:**
- Create: `app/admin/wordpress/components/ResultPanel.tsx`
- Create: `app/admin/wordpress/components/SinglePostForm.tsx`

**Interfaces:**
- Consumes: `createPostAction`, `scheduleAction` (actions.ts)

단위테스트 대상이 아니다(UI, Task 12에서 화면으로 확인).

- [ ] **Step 1: `ResultPanel.tsx` 작성**

`app/admin/wordpress/components/ResultPanel.tsx`:
```tsx
"use client";

export type ActionResult =
  | { ok: true; id: number; url: string; status: string }
  | { ok: false; error: string }
  | null;

export function ResultPanel({ result }: { result: ActionResult }) {
  if (!result) return null;

  if (!result.ok) {
    return (
      <p role="alert" className="mt-3 rounded-lg bg-rose-100 px-3 py-2 text-sm text-rose-900 dark:bg-rose-900/30 dark:text-rose-200">
        ✗ {result.error}
      </p>
    );
  }

  return (
    <p className="mt-3 rounded-lg bg-emerald-100 px-3 py-2 text-sm text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200">
      ✓ 성공 — id {result.id}, 상태 {result.status}.{" "}
      <a href={result.url} target="_blank" rel="noreferrer" className="underline">
        {result.url}
      </a>
    </p>
  );
}
```

- [ ] **Step 2: `SinglePostForm.tsx` 작성**

`app/admin/wordpress/components/SinglePostForm.tsx`:
```tsx
"use client";

import { useState, useTransition } from "react";
import { createPostAction, scheduleAction } from "../actions";
import { ResultPanel, type ActionResult } from "./ResultPanel";

type Mode = "draft" | "publish" | "schedule";

export function SinglePostForm() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState("");
  const [mode, setMode] = useState<Mode>("draft");
  const [publishAt, setPublishAt] = useState("");
  const [result, setResult] = useState<ActionResult>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!title.trim()) {
      setResult({ ok: false, error: "제목을 입력해 주세요." });
      return;
    }
    const tagList = tags.split(",").map((t) => t.trim()).filter(Boolean);
    const input = {
      title,
      contentHtml: content,
      category: category || undefined,
      tags: tagList.length > 0 ? tagList : undefined,
    };

    startTransition(async () => {
      const r =
        mode === "schedule"
          ? await scheduleAction({ ...input, publishAtKst: publishAt })
          : await createPostAction(input, mode === "publish");
      setResult(r);
    });
  }

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-base font-bold">단일 글 등록</h2>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="제목"
        className="w-full rounded-xl border border-slate-300 px-4 py-2 dark:border-slate-700 dark:bg-slate-950"
      />
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="내용 (HTML)"
        rows={6}
        className="w-full rounded-xl border border-slate-300 px-4 py-2 dark:border-slate-700 dark:bg-slate-950"
      />
      <div className="flex gap-3">
        <input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="카테고리"
          className="flex-1 rounded-xl border border-slate-300 px-4 py-2 dark:border-slate-700 dark:bg-slate-950"
        />
        <input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="태그 (쉼표로 구분)"
          className="flex-1 rounded-xl border border-slate-300 px-4 py-2 dark:border-slate-700 dark:bg-slate-950"
        />
      </div>
      <div role="radiogroup" className="flex gap-3 text-sm">
        {(["draft", "publish", "schedule"] as const).map((m) => (
          <label key={m} className="flex items-center gap-1.5">
            <input type="radio" checked={mode === m} onChange={() => setMode(m)} />
            {m === "draft" ? "초안" : m === "publish" ? "지금 발행" : "예약"}
          </label>
        ))}
      </div>
      {mode === "schedule" && (
        <input
          value={publishAt}
          onChange={(e) => setPublishAt(e.target.value)}
          placeholder="2026-09-28 09:00 (한국 시간)"
          className="w-full rounded-xl border border-slate-300 px-4 py-2 dark:border-slate-700 dark:bg-slate-950"
        />
      )}
      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className="rounded-xl bg-emerald-600 px-4 py-2 font-semibold text-white disabled:opacity-50"
      >
        {pending ? "처리 중..." : "등록"}
      </button>
      <ResultPanel result={result} />
    </section>
  );
}
```

- [ ] **Step 3: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 4: 커밋**

```bash
git add app/admin/wordpress/components/ResultPanel.tsx app/admin/wordpress/components/SinglePostForm.tsx
git commit -m "admin: add single post registration form"
```

---

## Task 11: 일괄 등록 폼

**Files:**
- Create: `app/admin/wordpress/components/BulkUploadForm.tsx`

**Interfaces:**
- Consumes: `bulkCreateAction`, `bulkUpdateMetaAction` (actions.ts)

단위테스트 대상이 아니다(UI).

- [ ] **Step 1: `BulkUploadForm.tsx` 작성**

`app/admin/wordpress/components/BulkUploadForm.tsx`:
```tsx
"use client";

import { useRef, useState, useTransition } from "react";
import { bulkCreateAction, bulkUpdateMetaAction } from "../actions";
import type { Report } from "@/lib/wordpress/types";

type Kind = "create" | "meta";
type Result = { ok: true; report: Report } | { ok: false; error: string } | null;

export function BulkUploadForm() {
  const [kind, setKind] = useState<Kind>("create");
  const [text, setText] = useState("");
  const [format, setFormat] = useState<"json" | "csv">("json");
  const [publish, setPublish] = useState(false);
  const [result, setResult] = useState<Result>(null);
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setText(await file.text());
    setFormat(file.name.endsWith(".csv") ? "csv" : "json");
  }

  function submit() {
    startTransition(async () => {
      const r = kind === "create" ? await bulkCreateAction(text, format, publish) : await bulkUpdateMetaAction(text, format);
      setResult(r);
    });
  }

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-base font-bold">일괄 등록 / 메타 수정</h2>
      <div role="radiogroup" className="flex gap-3 text-sm">
        <label className="flex items-center gap-1.5">
          <input type="radio" checked={kind === "create"} onChange={() => setKind("create")} />
          새 글 여러 건
        </label>
        <label className="flex items-center gap-1.5">
          <input type="radio" checked={kind === "meta"} onChange={() => setKind("meta")} />
          SEO 메타 일괄 수정
        </label>
      </div>
      <input ref={fileInput} type="file" accept=".json,.csv" onChange={onFileChange} className="text-sm" />
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="JSON 배열 또는 CSV 텍스트를 붙여넣으세요"
        rows={8}
        className="w-full rounded-xl border border-slate-300 px-4 py-2 font-mono text-sm dark:border-slate-700 dark:bg-slate-950"
      />
      <div className="flex items-center gap-4 text-sm">
        <label className="flex items-center gap-1.5">
          <input type="radio" checked={format === "json"} onChange={() => setFormat("json")} /> JSON
        </label>
        <label className="flex items-center gap-1.5">
          <input type="radio" checked={format === "csv"} onChange={() => setFormat("csv")} /> CSV
        </label>
        {kind === "create" && (
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} />
            예약 없는 행은 지금 발행
          </label>
        )}
      </div>
      <button
        type="button"
        onClick={submit}
        disabled={pending || !text.trim()}
        className="rounded-xl bg-emerald-600 px-4 py-2 font-semibold text-white disabled:opacity-50"
      >
        {pending ? "처리 중..." : "일괄 실행"}
      </button>

      {result && !result.ok && (
        <p role="alert" className="rounded-lg bg-rose-100 px-3 py-2 text-sm text-rose-900 dark:bg-rose-900/30 dark:text-rose-200">
          ✗ {result.error}
        </p>
      )}
      {result && result.ok && (
        <div className="space-y-1 text-sm">
          <p className="font-semibold">
            성공 {result.report.success} / 실패 {result.report.failed}
          </p>
          <ul className="space-y-1">
            {result.report.items.map((item, i) => (
              <li key={i} className={item.status === "error" ? "text-rose-700 dark:text-rose-400" : "text-emerald-700 dark:text-emerald-400"}>
                {item.status === "success"
                  ? `✓ id ${item.result?.id} — ${item.result?.url}${item.result?.warning ? ` (⚠ ${item.result.warning})` : ""}`
                  : `✗ ${item.error}`}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 2: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add app/admin/wordpress/components/BulkUploadForm.tsx
git commit -m "admin: add bulk upload form for create and meta update"
```

---

## Task 12: 예약 글 목록 + 페이지 조립 + 최종 검증

**Files:**
- Create: `app/admin/wordpress/components/ScheduledList.tsx`
- Create: `app/admin/wordpress/page.tsx`

**Interfaces:**
- Consumes: `listScheduledAction` (actions.ts), `SinglePostForm`, `BulkUploadForm`,
  `ScheduledList`

단위테스트 대상이 아니다. 마지막 두 단계(Step 4, 5)는 실제 자격증명이 필요하므로 사용자
승인 하에만 진행한다.

- [ ] **Step 1: `ScheduledList.tsx` 작성**

`app/admin/wordpress/components/ScheduledList.tsx`:
```tsx
import { listScheduledAction } from "../actions";

export async function ScheduledList() {
  const posts = await listScheduledAction();

  if (posts.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">예약된 글이 없습니다.</p>;
  }

  return (
    <ul className="divide-y divide-slate-200 text-sm dark:divide-slate-800">
      {posts.map((p) => (
        <li key={p.id} className="flex items-center justify-between gap-3 py-2">
          <span>{p.title}</span>
          <span className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
            {p.dateGmt} UTC
            <a href={p.link} target="_blank" rel="noreferrer" className="underline">
              편집
            </a>
          </span>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 2: `page.tsx` 작성**

`app/admin/wordpress/page.tsx`:
```tsx
import { Suspense } from "react";
import { BulkUploadForm } from "./components/BulkUploadForm";
import { ScheduledList } from "./components/ScheduledList";
import { SinglePostForm } from "./components/SinglePostForm";

export default function WordpressAdminPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-4 px-4 py-6">
      <h1 className="text-2xl font-bold">WordPress 관리</h1>
      <SinglePostForm />
      <BulkUploadForm />
      <section className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-base font-bold">예약된 글</h2>
        <Suspense fallback={<p className="text-sm text-slate-500">불러오는 중...</p>}>
          <ScheduledList />
        </Suspense>
      </section>
    </main>
  );
}
```

- [ ] **Step 3: 전체 테스트/타입체크/빌드**

Run: `npx vitest run && npx tsc --noEmit && npx next build`
Expected: 전체 PASS, 타입 에러 없음, 빌드 성공

- [ ] **Step 4: 커밋**

```bash
git add app/admin/wordpress/components/ScheduledList.tsx app/admin/wordpress/page.tsx
git commit -m "admin: assemble wordpress admin page"
```

- [ ] **Step 5: (사용자 승인 후) 로컬에서 실제 자격증명으로 확인**

`.env.local`에 `ADMIN_PASSWORD`, `WP_USERNAME`, `WP_APP_PASSWORD`를 채우고 `npm run dev`로
`http://localhost:3000/admin/login` → 로그인 → `/admin/wordpress`에서 실제 draft 글 1건을
등록해 확인한다. 확인 후 홈(`lib/tools.ts`)과 `app/sitemap.ts`에 이 페이지가 추가되지
**않았는지** 확인한다.
