# WordPress 글 자동 등록·수정 시스템 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `wordpress-publisher/` 아래에 molespapa.com에 글을 등록·수정하는 독립 Node.js/TypeScript CLI를 만든다.

**Architecture:** 얇은 인증 fetch 클라이언트(`client.ts`) 위에 카테고리/태그 이름 변환(`taxonomy.ts`), 글 CRUD·SEO·예약발행(`posts.ts`), 일괄 처리(`batch.ts`), 로깅(`logger.ts`)을 쌓고, `cli.ts`가 이들을 명령줄 하위 명령으로 노출한다. 순수 로직(페이로드 조립, 날짜 변환, CSV/JSON 파싱, draft 강제 규칙)은 `fetch`를 모킹해 vitest로 검증하고, 실제 molespapa.com 호출은 이 플랜의 마지막 태스크에서 사용자 승인 하에 1회만 한다.

**Tech Stack:** Node.js(내장 `fetch`), TypeScript, vitest(테스트), `tsx`(개발 실행), `csv-parse`(CSV 파싱). 그 외 런타임 의존성 없음.

**Spec:** `docs/superpowers/specs/2026-09-22-wordpress-publisher-design.md`

## Global Constraints

- 위치: 저장소 루트의 `wordpress-publisher/` 독립 폴더. `app/`, `lib/`(Next.js 앱)는 건드리지 않는다.
- 비밀번호는 `.env`에만 존재한다. `config.json`, 로그, 에러 메시지, 콘솔 출력 어디에도 `WP_APP_PASSWORD` 값이나 `Authorization` 헤더 값을 출력하지 않는다.
- `create`/`update`/`batch-create`는 `--publish` 플래그가 없으면 항상 `status: draft`로 강제한다. `schedule`은 예외로, 미래 시각이 확인되면 `--publish` 없이도 `status: future`를 보낸다.
- `--dry-run`이 켜지면 상태를 바꾸는 요청(POST)은 **전혀 보내지 않는다**. 카테고리/태그 조회도 하지 않고 자리표시자(`-1`)로 대체한다 — dry-run은 "요청을 전혀 보내지 않는다"는 스펙 문언을 그대로 지킨다(§9).
- 실제 molespapa.com에 대한 호출은 Task 12(마지막) 전에는 발생하지 않는다. 그 전 모든 태스크의 테스트는 `fetch`를 모킹하거나 로컬 임시 디렉토리만 사용한다.
- 커밋마다 `npx vitest run`이 전부 통과해야 한다.

---

## Task 1: 프로젝트 뼈대 + 타입 + 설정 로딩

**Files:**
- Create: `wordpress-publisher/package.json`
- Create: `wordpress-publisher/tsconfig.json`
- Create: `wordpress-publisher/vitest.config.ts`
- Create: `wordpress-publisher/.gitignore`
- Create: `wordpress-publisher/.env.example`
- Create: `wordpress-publisher/config.json`
- Create: `wordpress-publisher/src/types.ts`
- Create: `wordpress-publisher/src/config.ts`
- Test: `wordpress-publisher/test/config.test.ts`

**Interfaces:**
- Produces: `PostInput`, `PostResult`, `SeoMetaInput`, `ScheduleInput`, `WpDryRunResult`, `Report` (types.ts). `loadConfig(env: NodeJS.ProcessEnv, configPath?: string): ResolvedConfig` (config.ts), where `ResolvedConfig = { baseUrl: string; username: string; appPassword: string; defaultCategory?: string; defaultTags: string[] }`.

- [ ] **Step 1: 폴더와 고정 파일 작성**

`wordpress-publisher/package.json`:
```json
{
  "name": "wordpress-publisher",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "cli": "tsx src/cli.ts",
    "check-yoast": "tsx scripts/check-yoast.ts",
    "build": "tsc -p .",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "csv-parse": "^5.5.6"
  },
  "devDependencies": {
    "@types/node": "^24.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vitest": "^5.0.1"
  }
}
```

`wordpress-publisher/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "."
  },
  "include": ["src", "scripts"]
}
```

`wordpress-publisher/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { environment: "node", include: ["test/**/*.test.ts"] },
});
```

`wordpress-publisher/.gitignore`:
```
node_modules
dist
logs
.env
.env.local
*.tsbuildinfo
```

`wordpress-publisher/.env.example`:
```
WP_USERNAME=
WP_APP_PASSWORD=
```

`wordpress-publisher/config.json`:
```json
{
  "wordpress_url": "https://molespapa.com",
  "api_endpoint": "/wp-json/wp/v2",
  "default_category": "부동산",
  "default_tags": ["계산기", "금융"]
}
```

- [ ] **Step 2: `types.ts` 작성**

`wordpress-publisher/src/types.ts`:
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

export interface WpDryRunResult {
  dryRun: true;
  method: "GET" | "POST";
  url: string;
  body?: unknown;
}

export function isDryRunResult(value: unknown): value is WpDryRunResult {
  return typeof value === "object" && value !== null && (value as { dryRun?: unknown }).dryRun === true;
}

export interface ReportItem {
  input: unknown;
  status: "success" | "error";
  result?: PostResult;
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

- [ ] **Step 3: 실패하는 테스트 작성**

`wordpress-publisher/test/config.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.ts";

const rawConfig = {
  wordpress_url: "https://molespapa.com",
  api_endpoint: "/wp-json/wp/v2",
  default_category: "부동산",
  default_tags: ["계산기", "금융"],
};

describe("loadConfig", () => {
  it("config와 env를 합쳐 baseUrl/자격증명을 만든다", () => {
    const config = loadConfig(
      { WP_USERNAME: "editor", WP_APP_PASSWORD: "abcd efgh" },
      rawConfig,
    );
    expect(config).toEqual({
      baseUrl: "https://molespapa.com/wp-json/wp/v2",
      username: "editor",
      appPassword: "abcd efgh",
      defaultCategory: "부동산",
      defaultTags: ["계산기", "금융"],
    });
  });

  it("WP_USERNAME이 없으면 에러를 던진다", () => {
    expect(() => loadConfig({ WP_APP_PASSWORD: "x" }, rawConfig)).toThrow(
      /WP_USERNAME/,
    );
  });

  it("WP_APP_PASSWORD가 없으면 에러를 던진다", () => {
    expect(() => loadConfig({ WP_USERNAME: "editor" }, rawConfig)).toThrow(
      /WP_APP_PASSWORD/,
    );
  });

  it("default_tags가 없으면 빈 배열로 채운다", () => {
    const config = loadConfig(
      { WP_USERNAME: "e", WP_APP_PASSWORD: "p" },
      { wordpress_url: "https://x.com", api_endpoint: "/wp-json/wp/v2" },
    );
    expect(config.defaultTags).toEqual([]);
    expect(config.defaultCategory).toBeUndefined();
  });
});
```

- [ ] **Step 4: 테스트가 실패하는지 확인**

Run: `cd wordpress-publisher && npm install && npx vitest run test/config.test.ts`
Expected: FAIL — `../src/config.ts` 모듈이 없어서 에러

- [ ] **Step 5: `config.ts` 최소 구현**

`wordpress-publisher/src/config.ts`:
```ts
import type { ResolvedConfig } from "./types.ts";

interface RawConfig {
  wordpress_url: string;
  api_endpoint: string;
  default_category?: string;
  default_tags?: string[];
}

export function loadConfig(
  env: Pick<NodeJS.ProcessEnv, "WP_USERNAME" | "WP_APP_PASSWORD">,
  raw: RawConfig,
): ResolvedConfig {
  const username = env.WP_USERNAME;
  if (!username) {
    throw new Error("WP_USERNAME이 .env에 설정되어 있지 않습니다.");
  }
  const appPassword = env.WP_APP_PASSWORD;
  if (!appPassword) {
    throw new Error("WP_APP_PASSWORD가 .env에 설정되어 있지 않습니다.");
  }
  return {
    baseUrl: `${raw.wordpress_url.replace(/\/$/, "")}${raw.api_endpoint}`,
    username,
    appPassword,
    defaultCategory: raw.default_category,
    defaultTags: raw.default_tags ?? [],
  };
}
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `npx vitest run test/config.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 7: 커밋**

```bash
git add wordpress-publisher
git commit -m "wordpress-publisher: scaffold project, types, config loader"
```

---

## Task 2: 인증 HTTP 클라이언트 (dry-run 포함)

**Files:**
- Create: `wordpress-publisher/src/client.ts`
- Test: `wordpress-publisher/test/client.test.ts`

**Interfaces:**
- Consumes: `WpDryRunResult`, `isDryRunResult` (types.ts)
- Produces: `WpApiError` (class, `status: number`, `code?: string`), `WpClientOptions`, `WpClient` (`{ request<T>(req): Promise<T | WpDryRunResult>; dryRun: boolean }`), `createClient(opts: WpClientOptions): WpClient`

- [ ] **Step 1: 실패하는 테스트 작성**

`wordpress-publisher/test/client.test.ts`:
```ts
import { describe, expect, it, vi } from "vitest";
import { createClient, WpApiError } from "../src/client.ts";

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

  it("dryRun이면 fetch를 호출하지 않고 요청 내용만 반환한다", async () => {
    const fetchImpl = vi.fn();
    const client = createClient({
      baseUrl: "https://molespapa.com/wp-json/wp/v2",
      username: "editor",
      appPassword: "x",
      dryRun: true,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const result = await client.request({
      method: "POST",
      path: "/posts",
      body: { title: "t" },
    });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result).toEqual({
      dryRun: true,
      method: "POST",
      url: "https://molespapa.com/wp-json/wp/v2/posts",
      body: { title: "t" },
    });
    expect(client.dryRun).toBe(true);
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

Run: `npx vitest run test/client.test.ts`
Expected: FAIL — `../src/client.ts` 모듈이 없어서 에러

- [ ] **Step 3: `client.ts` 구현**

`wordpress-publisher/src/client.ts`:
```ts
import { type WpDryRunResult } from "./types.ts";

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
  dryRun?: boolean;
  fetchImpl?: typeof fetch;
}

export interface WpClient {
  dryRun: boolean;
  request<T>(req: WpRequest): Promise<T | WpDryRunResult>;
}

export function createClient(opts: WpClientOptions): WpClient {
  const authHeader = "Basic " + Buffer.from(`${opts.username}:${opts.appPassword}`).toString("base64");
  const fetchImpl = opts.fetchImpl ?? fetch;
  const dryRun = opts.dryRun ?? false;

  return {
    dryRun,
    async request<T>(req: WpRequest): Promise<T | WpDryRunResult> {
      const url = `${opts.baseUrl}${req.path}`;

      if (dryRun) {
        return { dryRun: true, method: req.method, url, body: req.body };
      }

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

Run: `npx vitest run test/client.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: 커밋**

```bash
git add wordpress-publisher/src/client.ts wordpress-publisher/test/client.test.ts
git commit -m "wordpress-publisher: add authenticated HTTP client with dry-run"
```

---

## Task 3: 카테고리/태그 이름 → ID 변환

**Files:**
- Create: `wordpress-publisher/src/taxonomy.ts`
- Test: `wordpress-publisher/test/taxonomy.test.ts`

**Interfaces:**
- Consumes: `WpClient` (client.ts)
- Produces: `createTaxonomyResolver(client: WpClient): { resolveCategoryId(name: string): Promise<number>; resolveTagIds(names: string[]): Promise<number[]> }`

- [ ] **Step 1: 실패하는 테스트 작성**

`wordpress-publisher/test/taxonomy.test.ts`:
```ts
import { describe, expect, it, vi } from "vitest";
import { createTaxonomyResolver } from "../src/taxonomy.ts";
import type { WpClient } from "../src/client.ts";

function makeClient(dryRun: boolean, request: WpClient["request"]): WpClient {
  return { dryRun, request };
}

describe("createTaxonomyResolver", () => {
  it("이름이 검색 결과에 있으면 해당 id를 반환한다", async () => {
    const request = vi.fn(async () => [
      { id: 5, name: "다른이름" },
      { id: 9, name: "부동산" },
    ]);
    const resolver = createTaxonomyResolver(makeClient(false, request as never));

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
    const resolver = createTaxonomyResolver(makeClient(false, request as never));

    await expect(resolver.resolveCategoryId("새카테고리")).resolves.toBe(42);
    expect(request).toHaveBeenLastCalledWith({
      method: "POST",
      path: "/categories",
      body: { name: "새카테고리" },
    });
  });

  it("생성 권한이 없으면(403) 사람이 읽을 수 있는 에러를 던진다", async () => {
    const request = vi.fn().mockResolvedValueOnce([]).mockRejectedValueOnce(
      Object.assign(new Error("forbidden"), { status: 403, name: "WpApiError" }),
    );
    const resolver = createTaxonomyResolver(makeClient(false, request as never));

    await expect(resolver.resolveCategoryId("새카테고리")).rejects.toThrow(
      /권한이 없습니다/,
    );
  });

  it("여러 태그 이름을 병렬로 id 배열로 바꾼다", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce([{ id: 1, name: "계산기" }])
      .mockResolvedValueOnce([{ id: 2, name: "금융" }]);
    const resolver = createTaxonomyResolver(makeClient(false, request as never));

    await expect(resolver.resolveTagIds(["계산기", "금융"])).resolves.toEqual([1, 2]);
  });

  it("dryRun 클라이언트에서는 네트워크 호출 없이 -1을 반환한다", async () => {
    const request = vi.fn();
    const resolver = createTaxonomyResolver(makeClient(true, request as never));

    await expect(resolver.resolveCategoryId("부동산")).resolves.toBe(-1);
    await expect(resolver.resolveTagIds(["계산기", "금융"])).resolves.toEqual([-1, -1]);
    expect(request).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run test/taxonomy.test.ts`
Expected: FAIL — `../src/taxonomy.ts` 모듈이 없어서 에러

- [ ] **Step 3: `taxonomy.ts` 구현**

`wordpress-publisher/src/taxonomy.ts`:
```ts
import { WpApiError } from "./client.ts";
import type { WpClient } from "./client.ts";

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
    if (client.dryRun) {
      return -1;
    }

    const found = (await client.request<TaxonomyItem[]>({
      method: "GET",
      path: `/${kind}?search=${encodeURIComponent(name)}`,
    })) as TaxonomyItem[];
    const exact = found.find((item) => item.name === name);
    if (exact) return exact.id;

    try {
      const created = (await client.request<TaxonomyItem>({
        method: "POST",
        path: `/${kind}`,
        body: { name },
      })) as TaxonomyItem;
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

Run: `npx vitest run test/taxonomy.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: 커밋**

```bash
git add wordpress-publisher/src/taxonomy.ts wordpress-publisher/test/taxonomy.test.ts
git commit -m "wordpress-publisher: resolve category/tag names to ids"
```

---

## Task 4: `createPost`

**Files:**
- Create: `wordpress-publisher/src/posts.ts`
- Test: `wordpress-publisher/test/posts.test.ts`

**Interfaces:**
- Consumes: `WpClient`, `createTaxonomyResolver` (taxonomy.ts), `PostInput`/`PostResult`/`isDryRunResult` (types.ts), `ResolvedConfig` (config.ts)
- Produces: `createPost(client: WpClient, config: ResolvedConfig, input: PostInput, opts?: { publish?: boolean }): Promise<PostResult>`

- [ ] **Step 1: 실패하는 테스트 작성**

`wordpress-publisher/test/posts.test.ts`:
```ts
import { describe, expect, it, vi } from "vitest";
import { createPost } from "../src/posts.ts";
import type { WpClient } from "../src/client.ts";
import type { ResolvedConfig } from "../src/types.ts";

const config: ResolvedConfig = {
  baseUrl: "https://molespapa.com/wp-json/wp/v2",
  username: "editor",
  appPassword: "x",
  defaultCategory: "부동산",
  defaultTags: ["계산기", "금융"],
};

// dryRun이면 실제 client.ts와 같은 불변 규칙을 지킨다: request()는 큐에 든 값과 무관하게
// 항상 { dryRun: true, ... } 를 돌려준다. dryRun=false일 때만 큐(responses)를 순서대로 소비한다.
function clientReturning(responses: unknown[], dryRun = false): WpClient {
  const queue = [...responses];
  const request = vi.fn(async (req: { method: string; path: string; body?: unknown }) => {
    if (dryRun) {
      return { dryRun: true, method: req.method, url: `https://molespapa.com/wp-json/wp/v2${req.path}`, body: req.body };
    }
    return queue.shift();
  });
  return { dryRun, request: request as never };
}

describe("createPost", () => {
  it("category/tags를 id로 바꿔 /posts에 POST하고, 기본 상태는 draft다", async () => {
    const client = clientReturning([
      [{ id: 9, name: "부동산" }], // category lookup
      [{ id: 1, name: "계산기" }], // tag lookup
      [{ id: 2, name: "금융" }], // tag lookup
      { id: 123, link: "https://molespapa.com/?p=123", status: "draft" },
    ]);

    const result = await createPost(client, config, {
      title: "글 제목",
      contentHtml: "<p>본문</p>",
    });

    expect(result).toEqual({ id: 123, url: "https://molespapa.com/?p=123", status: "draft" });
    expect((client.request as ReturnType<typeof vi.fn>).mock.calls[3][0]).toMatchObject({
      method: "POST",
      path: "/posts",
      body: {
        title: "글 제목",
        content: "<p>본문</p>",
        status: "draft",
        categories: [9],
        tags: [1, 2],
      },
    });
  });

  it("category/tags를 지정하지 않으면 config의 기본값을 쓴다", async () => {
    const client = clientReturning([
      [{ id: 9, name: "부동산" }],
      [{ id: 1, name: "계산기" }],
      [{ id: 2, name: "금융" }],
      { id: 1, link: "u", status: "draft" },
    ]);

    await createPost(client, config, { title: "t", contentHtml: "c" });

    const call = (client.request as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.path).toContain("categories?search=");
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

    await createPost(client, config, {
      title: "t",
      contentHtml: "c",
      status: "publish",
    });

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
    expect(body.meta).toEqual({
      _yoast_wpseo_focuskw: "전세",
      _yoast_wpseo_metadesc: "전세 설명",
    });
  });

  it("dry-run이면 실제 id 0으로 미리보기 결과를 반환한다", async () => {
    const client = clientReturning([], true);

    const result = await createPost(client, config, { title: "t", contentHtml: "c" });

    expect(result).toEqual({ id: 0, url: "(dry-run)", status: "draft" });
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run test/posts.test.ts`
Expected: FAIL — `createPost`가 정의되어 있지 않음

- [ ] **Step 3: `posts.ts`에 `createPost` 구현**

`wordpress-publisher/src/posts.ts`:
```ts
import { createTaxonomyResolver } from "./taxonomy.ts";
import { isDryRunResult } from "./types.ts";
import type { WpClient } from "./client.ts";
import type { PostInput, PostResult, ResolvedConfig } from "./types.ts";

interface WpPostResponse {
  id: number;
  link: string;
  status: string;
}

function buildSeoMeta(seo?: PostInput["seo"]): Record<string, string> | undefined {
  if (!seo) return undefined;
  const meta: Record<string, string> = {};
  if (seo.focusKeyword !== undefined) meta._yoast_wpseo_focuskw = seo.focusKeyword;
  if (seo.metaDescription !== undefined) meta._yoast_wpseo_metadesc = seo.metaDescription;
  return meta;
}

export async function createPost(
  client: WpClient,
  config: ResolvedConfig,
  input: PostInput,
  opts: { publish?: boolean } = {},
): Promise<PostResult> {
  const taxonomy = createTaxonomyResolver(client);
  const categoryName = input.category ?? config.defaultCategory;
  const tagNames = input.tags ?? config.defaultTags;

  const [categoryId, tagIds] = await Promise.all([
    categoryName ? taxonomy.resolveCategoryId(categoryName) : Promise.resolve(undefined),
    taxonomy.resolveTagIds(tagNames),
  ]);

  const status = opts.publish ? input.status ?? "publish" : "draft";

  const body: Record<string, unknown> = {
    title: input.title,
    content: input.contentHtml,
    status,
  };
  if (categoryId !== undefined) body.categories = [categoryId];
  if (tagIds.length > 0) body.tags = tagIds;
  const meta = buildSeoMeta(input.seo);
  if (meta) body.meta = meta;

  const response = await client.request<WpPostResponse>({
    method: "POST",
    path: "/posts",
    body,
  });

  if (isDryRunResult(response)) {
    return { id: 0, url: "(dry-run)", status };
  }
  return { id: response.id, url: response.link, status: response.status };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run test/posts.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: 커밋**

```bash
git add wordpress-publisher/src/posts.ts wordpress-publisher/test/posts.test.ts
git commit -m "wordpress-publisher: implement createPost"
```

---

## Task 5: `updatePost` / `addSeoMeta`

**Files:**
- Modify: `wordpress-publisher/src/posts.ts`
- Modify: `wordpress-publisher/test/posts.test.ts`

**Interfaces:**
- Produces (added to posts.ts): `updatePost(client, config, id: number, patch: PostPatch, opts?: { publish?: boolean }): Promise<PostResult>`, `addSeoMeta(client, config, id: number, meta: SeoMetaInput): Promise<PostResult & { warning?: string }>`

- [ ] **Step 1: 실패하는 테스트 추가**

`wordpress-publisher/test/posts.test.ts`에 추가:
```ts
import { addSeoMeta, updatePost } from "../src/posts.ts";

describe("updatePost", () => {
  it("바뀐 필드만 PATCH 본문에 담아 /posts/{id}에 보낸다", async () => {
    const client = clientReturning([
      { id: 123, link: "u", status: "draft", meta: {} },
    ]);

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

  it("dry-run이면 실제 요청 없이 미리보기 결과를 반환한다", async () => {
    const client = clientReturning([], true);

    const result = await updatePost(client, config, 5, { title: "t" });

    expect(result).toEqual({ id: 5, url: "(dry-run)", status: "(변경 없음)" });
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
    const body = (client.request as ReturnType<typeof vi.fn>).mock.calls[0][0].body;
    expect(body.meta).toEqual({
      _yoast_wpseo_focuskw: "전세",
      _yoast_wpseo_metadesc: "설명",
    });
  });

  it("응답에 메타가 반영 안 되어 있으면 mu-plugin 설치를 안내하는 경고를 반환한다", async () => {
    const client = clientReturning([{ id: 123, link: "u", status: "publish", meta: {} }]);

    const result = await addSeoMeta(client, config, 123, {
      focusKeyword: "전세",
      metaDescription: "설명",
    });

    expect(result.warning).toMatch(/mu-plugin/);
  });

  it("dry-run이면 반영 여부를 확인하지 않고 경고 없이 미리보기 결과를 반환한다", async () => {
    const client = clientReturning([], true);

    const result = await addSeoMeta(client, config, 123, { focusKeyword: "전세" });

    expect(result.warning).toBeUndefined();
    expect(result.id).toBe(123);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run test/posts.test.ts`
Expected: FAIL — `updatePost`/`addSeoMeta`가 정의되어 있지 않음

- [ ] **Step 3: `posts.ts`에 두 함수 추가**

`wordpress-publisher/src/posts.ts` 끝에 추가:
```ts
import type { PostPatch, SeoMetaInput } from "./types.ts";

interface WpPostResponseWithMeta extends WpPostResponse {
  meta?: Record<string, string>;
}

async function buildPatchBody(
  client: WpClient,
  config: ResolvedConfig,
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
  const body = await buildPatchBody(client, config, patch, opts);
  const response = await client.request<WpPostResponse>({
    method: "POST",
    path: `/posts/${id}`,
    body,
  });

  if (isDryRunResult(response)) {
    return { id, url: "(dry-run)", status: "(변경 없음)" };
  }
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

  if (isDryRunResult(response)) {
    return { id, url: "(dry-run)", status: "(변경 없음)" };
  }

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

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run test/posts.test.ts`
Expected: PASS (12 tests)

- [ ] **Step 5: 커밋**

```bash
git add wordpress-publisher/src/posts.ts wordpress-publisher/test/posts.test.ts
git commit -m "wordpress-publisher: implement updatePost and addSeoMeta"
```

---

## Task 6: `schedulePost` (KST → UTC 변환)

**Files:**
- Create: `wordpress-publisher/src/schedule.ts`
- Modify: `wordpress-publisher/src/posts.ts` (schedulePost export)
- Test: `wordpress-publisher/test/schedule.test.ts`

**Interfaces:**
- Consumes: `createPost` 내부 로직 재사용을 위해 posts.ts에서 body 조립 부분을 공유(아래 구현 참고)
- Produces: `kstToUtc(kst: string, now?: Date): Date` (schedule.ts), `schedulePost(client, config, input: ScheduleInput, opts?): Promise<PostResult>` (posts.ts)

- [ ] **Step 1: 실패하는 테스트 작성**

`wordpress-publisher/test/schedule.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { kstToUtc, toWpDateGmt } from "../src/schedule.ts";

describe("kstToUtc", () => {
  it("KST 오전 9시는 UTC 0시다", () => {
    const utc = kstToUtc("2026-09-28 09:00");
    expect(utc.toISOString()).toBe("2026-09-28T00:00:00.000Z");
  });

  it("형식이 잘못되면 에러를 던진다", () => {
    expect(() => kstToUtc("2026/09/28 09:00")).toThrow(/형식/);
  });

  it("현재보다 과거 시각이면 에러를 던진다", () => {
    const now = new Date("2026-09-28T00:00:00.000Z");
    expect(() => kstToUtc("2026-09-28 08:00", now)).toThrow(/과거/);
  });
});

describe("toWpDateGmt", () => {
  it("WordPress date_gmt 형식(초 단위, Z 없음)으로 만든다", () => {
    const date = new Date("2026-09-28T00:00:00.000Z");
    expect(toWpDateGmt(date)).toBe("2026-09-28T00:00:00");
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run test/schedule.test.ts`
Expected: FAIL — `../src/schedule.ts` 모듈이 없어서 에러

- [ ] **Step 3: `schedule.ts` 구현**

`wordpress-publisher/src/schedule.ts`:
```ts
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
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run test/schedule.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: `posts.ts`에 `schedulePost` 추가하는 실패 테스트 작성**

`wordpress-publisher/test/posts.test.ts`에 추가:
```ts
import { schedulePost } from "../src/posts.ts";

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

- [ ] **Step 6: 테스트가 실패하는지 확인**

Run: `npx vitest run test/posts.test.ts`
Expected: FAIL — `schedulePost`가 정의되어 있지 않음

- [ ] **Step 7: `posts.ts`에 `schedulePost` 구현**

`wordpress-publisher/src/posts.ts`에 추가 (import에 `kstToUtc`, `toWpDateGmt`, `ScheduleInput` 추가):
```ts
import { kstToUtc, toWpDateGmt } from "./schedule.ts";
import type { ScheduleInput } from "./types.ts";

export async function schedulePost(
  client: WpClient,
  config: ResolvedConfig,
  input: ScheduleInput,
  opts: { now?: Date } = {},
): Promise<PostResult> {
  const utc = kstToUtc(input.publishAtKst, opts.now);
  const { publishAtKst, ...rest } = input;

  const taxonomy = createTaxonomyResolver(client);
  const categoryName = rest.category ?? config.defaultCategory;
  const tagNames = rest.tags ?? config.defaultTags;
  const [categoryId, tagIds] = await Promise.all([
    categoryName ? taxonomy.resolveCategoryId(categoryName) : Promise.resolve(undefined),
    taxonomy.resolveTagIds(tagNames),
  ]);

  const body: Record<string, unknown> = {
    title: rest.title,
    content: rest.contentHtml,
    status: "future",
    date_gmt: toWpDateGmt(utc),
  };
  if (categoryId !== undefined) body.categories = [categoryId];
  if (tagIds.length > 0) body.tags = tagIds;
  const meta = buildSeoMeta(rest.seo);
  if (meta) body.meta = meta;

  const response = await client.request<WpPostResponse>({
    method: "POST",
    path: "/posts",
    body,
  });

  if (isDryRunResult(response)) {
    return { id: 0, url: "(dry-run)", status: "future" };
  }
  return { id: response.id, url: response.link, status: response.status };
}
```

- [ ] **Step 8: 테스트 통과 확인**

Run: `npx vitest run test/posts.test.ts test/schedule.test.ts`
Expected: PASS (전체)

- [ ] **Step 9: 커밋**

```bash
git add wordpress-publisher/src/schedule.ts wordpress-publisher/src/posts.ts wordpress-publisher/test/schedule.test.ts wordpress-publisher/test/posts.test.ts
git commit -m "wordpress-publisher: implement schedulePost with KST->UTC conversion"
```

---

## Task 7: 로거

**Files:**
- Create: `wordpress-publisher/src/logger.ts`
- Test: `wordpress-publisher/test/logger.test.ts`

**Interfaces:**
- Produces: `createLogger(logDir: string): RunLogger`, `RunLogger = { log(entry): void; summary(): { success: number; failed: number }; finish(): void }`

- [ ] **Step 1: 실패하는 테스트 작성**

`wordpress-publisher/test/logger.test.ts`:
```ts
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createLogger } from "../src/logger.ts";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "wp-log-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("createLogger", () => {
  it("성공/실패 항목을 jsonl 파일에 한 줄씩 쓴다", () => {
    const logger = createLogger(dir);
    logger.log({ action: "createPost", input: { title: "t" }, status: "success", postId: 1, url: "u" });
    logger.log({ action: "createPost", input: { title: "t2" }, status: "error", error: "실패" });
    logger.finish();

    const files = require("node:fs").readdirSync(dir) as string[];
    expect(files).toHaveLength(1);
    const lines = readFileSync(join(dir, files[0]), "utf8").trim().split("\n");
    expect(lines).toHaveLength(2);
    const first = JSON.parse(lines[0]);
    expect(first).toMatchObject({ action: "createPost", status: "success", postId: 1 });
    expect(typeof first.timestamp).toBe("string");
  });

  it("summary()는 성공/실패 개수를 센다", () => {
    const logger = createLogger(dir);
    logger.log({ action: "a", input: {}, status: "success" });
    logger.log({ action: "a", input: {}, status: "success" });
    logger.log({ action: "a", input: {}, status: "error", error: "x" });

    expect(logger.summary()).toEqual({ success: 2, failed: 1 });
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run test/logger.test.ts`
Expected: FAIL — `../src/logger.ts` 모듈이 없어서 에러

- [ ] **Step 3: `logger.ts` 구현**

`wordpress-publisher/src/logger.ts`:
```ts
import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export interface LogEntryInput {
  action: string;
  input: unknown;
  status: "success" | "error";
  postId?: number;
  url?: string;
  error?: string;
}

export interface RunLogger {
  log(entry: LogEntryInput): void;
  summary(): { success: number; failed: number };
  finish(): void;
}

export function createLogger(logDir: string): RunLogger {
  mkdirSync(logDir, { recursive: true });
  const filePath = join(logDir, `run-${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`);
  let success = 0;
  let failed = 0;

  return {
    log(entry) {
      if (entry.status === "success") success += 1;
      else failed += 1;
      const line = JSON.stringify({ timestamp: new Date().toISOString(), ...entry });
      appendFileSync(filePath, line + "\n", "utf8");
    },
    summary() {
      return { success, failed };
    },
    finish() {
      const { success: s, failed: f } = this.summary();
      console.log(`\n성공 ${s} / 실패 ${f}`);
    },
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run test/logger.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: 커밋**

```bash
git add wordpress-publisher/src/logger.ts wordpress-publisher/test/logger.test.ts
git commit -m "wordpress-publisher: add jsonl run logger with summary"
```

---

## Task 8: 단일 명령 CLI (`create`/`update`/`add-seo`/`schedule`)

**Files:**
- Create: `wordpress-publisher/src/cli-args.ts`
- Create: `wordpress-publisher/src/cli.ts`
- Test: `wordpress-publisher/test/cli-args.test.ts`

**Interfaces:**
- Consumes: `createClient`, `createPost`, `updatePost`, `addSeoMeta`, `schedulePost`, `loadConfig`, `createLogger`
- Produces: `parseArgs(argv: string[]): { command: string; flags: Record<string, string | true> }`

- [ ] **Step 1: 실패하는 테스트 작성**

`wordpress-publisher/test/cli-args.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { parseArgs } from "../src/cli-args.ts";

describe("parseArgs", () => {
  it("첫 인자를 command로, --key value를 flags로 뽑는다", () => {
    expect(
      parseArgs(["create", "--title", "글 제목", "--category", "부동산"]),
    ).toEqual({
      command: "create",
      flags: { title: "글 제목", category: "부동산" },
    });
  });

  it("값이 없는 플래그(--dry-run, --publish)는 true로 표시한다", () => {
    expect(parseArgs(["create", "--title", "t", "--dry-run", "--publish"])).toEqual({
      command: "create",
      flags: { title: "t", "dry-run": true, publish: true },
    });
  });

  it("command가 없으면 에러를 던진다", () => {
    expect(() => parseArgs([])).toThrow(/명령/);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run test/cli-args.test.ts`
Expected: FAIL — `../src/cli-args.ts` 모듈이 없어서 에러

- [ ] **Step 3: `cli-args.ts` 구현**

`wordpress-publisher/src/cli-args.ts`:
```ts
const BOOLEAN_FLAGS = new Set(["dry-run", "publish"]);

export interface ParsedArgs {
  command: string;
  flags: Record<string, string | true>;
}

export function parseArgs(argv: string[]): ParsedArgs {
  const [command, ...rest] = argv;
  if (!command) {
    throw new Error("명령을 지정해야 합니다 (create/update/add-seo/schedule/batch-create/batch-update-meta)");
  }

  const flags: Record<string, string | true> = {};
  for (let i = 0; i < rest.length; i++) {
    const token = rest[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    if (BOOLEAN_FLAGS.has(key)) {
      flags[key] = true;
      continue;
    }
    flags[key] = rest[i + 1];
    i += 1;
  }
  return { command, flags };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run test/cli-args.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: `cli.ts` 작성 (테스트 없음 — I/O 진입점이라 수동 확인으로 대체, Task 12에서 dry-run으로 검증)**

`wordpress-publisher/src/cli.ts`:
```ts
import "dotenv/config";
import { readFileSync } from "node:fs";
import { parseArgs } from "./cli-args.ts";
import { loadConfig } from "./config.ts";
import { createClient } from "./client.ts";
import { createLogger } from "./logger.ts";
import { createPost, updatePost, addSeoMeta, schedulePost } from "./posts.ts";
import type { PostInput } from "./types.ts";

function readConfigJson(): { wordpress_url: string; api_endpoint: string; default_category?: string; default_tags?: string[] } {
  return JSON.parse(readFileSync(new URL("../config.json", import.meta.url), "utf8"));
}

function splitTags(value: string | true | undefined): string[] | undefined {
  if (typeof value !== "string") return undefined;
  return value.split(",").map((t) => t.trim()).filter(Boolean);
}

async function main() {
  const { command, flags } = parseArgs(process.argv.slice(2));
  const config = loadConfig(process.env, readConfigJson());
  const dryRun = flags["dry-run"] === true;
  const publish = flags.publish === true;
  const client = createClient({
    baseUrl: config.baseUrl,
    username: config.username,
    appPassword: config.appPassword,
    dryRun,
  });
  const logger = createLogger(new URL("../logs", import.meta.url).pathname);

  try {
    if (command === "create") {
      const input: PostInput = {
        title: String(flags.title ?? ""),
        contentHtml: String(flags["content-file"] ? readFileSync(String(flags["content-file"]), "utf8") : flags.content ?? ""),
        category: typeof flags.category === "string" ? flags.category : undefined,
        tags: splitTags(flags.tags),
        seo: flags["focus-keyword"] || flags["meta-description"] ? {
          focusKeyword: typeof flags["focus-keyword"] === "string" ? flags["focus-keyword"] : undefined,
          metaDescription: typeof flags["meta-description"] === "string" ? flags["meta-description"] : undefined,
        } : undefined,
      };
      const result = await createPost(client, config, input, { publish });
      logger.log({ action: "create", input, status: "success", postId: result.id, url: result.url });
      console.log(result);
    } else if (command === "update") {
      const id = Number(flags.id);
      const result = await updatePost(client, config, id, {
        title: typeof flags.title === "string" ? flags.title : undefined,
        category: typeof flags.category === "string" ? flags.category : undefined,
        tags: splitTags(flags.tags),
      }, { publish });
      logger.log({ action: "update", input: { id, flags }, status: "success", postId: result.id, url: result.url });
      console.log(result);
    } else if (command === "add-seo") {
      const id = Number(flags.id);
      const result = await addSeoMeta(client, config, id, {
        focusKeyword: typeof flags["focus-keyword"] === "string" ? flags["focus-keyword"] : undefined,
        metaDescription: typeof flags["meta-description"] === "string" ? flags["meta-description"] : undefined,
      });
      logger.log({ action: "add-seo", input: { id }, status: "success", postId: result.id, url: result.url });
      console.log(result);
      if (result.warning) console.warn(`\n⚠ ${result.warning}`);
    } else if (command === "schedule") {
      const input = {
        title: String(flags.title ?? ""),
        contentHtml: String(flags["content-file"] ? readFileSync(String(flags["content-file"]), "utf8") : flags.content ?? ""),
        category: typeof flags.category === "string" ? flags.category : undefined,
        tags: splitTags(flags.tags),
        publishAtKst: String(flags["publish-at"] ?? ""),
      };
      const result = await schedulePost(client, config, input);
      logger.log({ action: "schedule", input, status: "success", postId: result.id, url: result.url });
      console.log(result);
    } else {
      throw new Error(`알 수 없는 명령입니다: ${command}`);
    }
  } catch (e) {
    logger.log({ action: command, input: flags, status: "error", error: (e as Error).message });
    console.error(`\n✗ ${(e as Error).message}`);
    process.exitCode = 1;
  } finally {
    logger.finish();
  }
}

main();
```

- [ ] **Step 6: `dotenv` 의존성 추가**

`wordpress-publisher/package.json`의 `dependencies`에 `"dotenv": "^16.4.5"` 추가 후:
Run: `cd wordpress-publisher && npm install`

- [ ] **Step 7: 커밋**

```bash
git add wordpress-publisher/src/cli-args.ts wordpress-publisher/src/cli.ts wordpress-publisher/test/cli-args.test.ts wordpress-publisher/package.json wordpress-publisher/package-lock.json
git commit -m "wordpress-publisher: add CLI entry point for single-post commands"
```

---

## Task 9: CSV/JSON 일괄 등록 (`bulkCreate`)

**Files:**
- Create: `wordpress-publisher/src/batch.ts`
- Test: `wordpress-publisher/test/batch.test.ts`

**Interfaces:**
- Consumes: `createPost`, `schedulePost` (posts.ts), `PostInput`, `Report` (types.ts)
- Produces: `parseBulkCreateRows(filePath: string): PostInput[] & 예약행은 { ...PostInput, publishAtKst? }[]`, `bulkCreate(client, config, filePath: string, opts: { publish?: boolean }): Promise<Report>`

- [ ] **Step 1: 실패하는 테스트 작성**

`wordpress-publisher/test/batch.test.ts`:
```ts
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bulkCreate, parseBulkCreateRows } from "../src/batch.ts";
import type { WpClient } from "../src/client.ts";
import type { ResolvedConfig } from "../src/types.ts";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "wp-batch-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const config: ResolvedConfig = {
  baseUrl: "https://molespapa.com/wp-json/wp/v2",
  username: "e",
  appPassword: "p",
  defaultTags: [],
};

describe("parseBulkCreateRows", () => {
  it("JSON 배열을 그대로 읽는다", () => {
    const file = join(dir, "posts.json");
    writeFileSync(file, JSON.stringify([{ title: "t1", contentHtml: "<p>1</p>" }]), "utf8");

    expect(parseBulkCreateRows(file)).toEqual([{ title: "t1", contentHtml: "<p>1</p>" }]);
  });

  it("CSV의 content_file 경로를 CSV 파일 기준 상대경로로 읽는다", () => {
    writeFileSync(join(dir, "post1.html"), "<p>본문1</p>", "utf8");
    const csv = join(dir, "posts.csv");
    writeFileSync(
      csv,
      "title,content_file,category,tags\n" + '"글1",post1.html,부동산,계산기;금융\n',
      "utf8",
    );

    expect(parseBulkCreateRows(csv)).toEqual([
      {
        title: "글1",
        contentHtml: "<p>본문1</p>",
        category: "부동산",
        tags: ["계산기", "금융"],
      },
    ]);
  });
});

describe("bulkCreate", () => {
  it("각 행마다 createPost를 호출하고 성공/실패를 리포트한다", async () => {
    const file = join(dir, "posts.json");
    writeFileSync(
      file,
      JSON.stringify([
        { title: "성공글", contentHtml: "<p>1</p>" },
        { title: "실패글", contentHtml: "<p>2</p>" },
      ]),
      "utf8",
    );

    const request = vi
      .fn()
      .mockResolvedValueOnce({ id: 1, link: "u1", status: "draft" })
      .mockRejectedValueOnce(new Error("서버 오류"));
    const client: WpClient = { dryRun: false, request: request as never };

    const report = await bulkCreate(client, config, file, {});

    expect(report.success).toBe(1);
    expect(report.failed).toBe(1);
    expect(report.items[1].status).toBe("error");
    expect(report.items[1].error).toBe("서버 오류");
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run test/batch.test.ts`
Expected: FAIL — `../src/batch.ts` 모듈이 없어서 에러

- [ ] **Step 3: `batch.ts`에 CSV/JSON 파싱과 `bulkCreate` 구현**

`wordpress-publisher/src/batch.ts`:
```ts
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parse as parseCsv } from "csv-parse/sync";
import { createPost, schedulePost } from "./posts.ts";
import type { WpClient } from "./client.ts";
import type { PostInput, Report, ResolvedConfig } from "./types.ts";

type BulkRow = PostInput & { publishAtKst?: string };

function parseCsvRows(filePath: string): BulkRow[] {
  const rows = parseCsv(readFileSync(filePath, "utf8"), {
    columns: true,
    skip_empty_lines: true,
  }) as Record<string, string>[];
  const baseDir = dirname(filePath);

  return rows.map((row) => ({
    title: row.title,
    contentHtml: row.content_file
      ? readFileSync(join(baseDir, row.content_file), "utf8")
      : row.content ?? "",
    category: row.category || undefined,
    tags: row.tags ? row.tags.split(";").map((t) => t.trim()).filter(Boolean) : undefined,
    seo:
      row.focus_keyword || row.meta_description
        ? { focusKeyword: row.focus_keyword || undefined, metaDescription: row.meta_description || undefined }
        : undefined,
    publishAtKst: row.publish_at_kst || undefined,
  }));
}

export function parseBulkCreateRows(filePath: string): BulkRow[] {
  if (filePath.endsWith(".csv")) return parseCsvRows(filePath);
  return JSON.parse(readFileSync(filePath, "utf8")) as BulkRow[];
}

export async function bulkCreate(
  client: WpClient,
  config: ResolvedConfig,
  filePath: string,
  opts: { publish?: boolean },
): Promise<Report> {
  const rows = parseBulkCreateRows(filePath);
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
```

- [ ] **Step 4: `csv-parse` 설치 확인 및 테스트 통과**

Run: `cd wordpress-publisher && npm install && npx vitest run test/batch.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: 커밋**

```bash
git add wordpress-publisher/src/batch.ts wordpress-publisher/test/batch.test.ts wordpress-publisher/package.json wordpress-publisher/package-lock.json
git commit -m "wordpress-publisher: add CSV/JSON bulk create"
```

---

## Task 10: 일괄 메타 수정 (`bulkUpdateMeta`) + CLI 연결

**Files:**
- Modify: `wordpress-publisher/src/batch.ts`
- Modify: `wordpress-publisher/test/batch.test.ts`
- Modify: `wordpress-publisher/src/cli.ts`

**Interfaces:**
- Produces (batch.ts에 추가): `parseBulkMetaRows(filePath: string): Array<{ id: number; focusKeyword?: string; metaDescription?: string }>`, `bulkUpdateMeta(client, config, filePath: string): Promise<Report>`

- [ ] **Step 1: 실패하는 테스트 추가**

`wordpress-publisher/test/batch.test.ts`에 추가:
```ts
import { bulkUpdateMeta, parseBulkMetaRows } from "../src/batch.ts";

describe("parseBulkMetaRows", () => {
  it("CSV에서 id/focus_keyword/meta_description을 읽는다", () => {
    const csv = join(dir, "meta.csv");
    writeFileSync(csv, "id,focus_keyword,meta_description\n123,전세,전세 설명\n", "utf8");

    expect(parseBulkMetaRows(csv)).toEqual([
      { id: 123, focusKeyword: "전세", metaDescription: "전세 설명" },
    ]);
  });

  it("JSON 배열을 그대로 읽는다", () => {
    const file = join(dir, "meta.json");
    writeFileSync(file, JSON.stringify([{ id: 5, metaDescription: "설명" }]), "utf8");

    expect(parseBulkMetaRows(file)).toEqual([{ id: 5, metaDescription: "설명" }]);
  });
});

describe("bulkUpdateMeta", () => {
  it("각 행마다 addSeoMeta를 호출하고 실패해도 계속한다", async () => {
    const file = join(dir, "meta.json");
    writeFileSync(
      file,
      JSON.stringify([
        { id: 1, metaDescription: "성공" },
        { id: 2, metaDescription: "실패" },
      ]),
      "utf8",
    );

    const request = vi
      .fn()
      .mockResolvedValueOnce({ id: 1, link: "u", status: "publish", meta: { _yoast_wpseo_metadesc: "성공" } })
      .mockRejectedValueOnce(new Error("찾을 수 없음"));
    const client: WpClient = { dryRun: false, request: request as never };

    const report = await bulkUpdateMeta(client, config, file);

    expect(report.success).toBe(1);
    expect(report.failed).toBe(1);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run test/batch.test.ts`
Expected: FAIL — `bulkUpdateMeta`/`parseBulkMetaRows`가 정의되어 있지 않음

- [ ] **Step 3: `batch.ts`에 추가 구현**

`wordpress-publisher/src/batch.ts` 끝에 추가 (import에 `addSeoMeta` 추가):
```ts
import { addSeoMeta } from "./posts.ts";

interface MetaRow {
  id: number;
  focusKeyword?: string;
  metaDescription?: string;
}

export function parseBulkMetaRows(filePath: string): MetaRow[] {
  if (filePath.endsWith(".csv")) {
    const rows = parseCsv(readFileSync(filePath, "utf8"), {
      columns: true,
      skip_empty_lines: true,
    }) as Record<string, string>[];
    return rows.map((row) => ({
      id: Number(row.id),
      focusKeyword: row.focus_keyword || undefined,
      metaDescription: row.meta_description || undefined,
    }));
  }
  return JSON.parse(readFileSync(filePath, "utf8")) as MetaRow[];
}

export async function bulkUpdateMeta(
  client: WpClient,
  config: ResolvedConfig,
  filePath: string,
): Promise<Report> {
  const rows = parseBulkMetaRows(filePath);
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

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run test/batch.test.ts`
Expected: PASS (전체)

- [ ] **Step 5: `cli.ts`에 `batch-create`/`batch-update-meta` 명령 추가**

`wordpress-publisher/src/cli.ts`의 `import` 블록에 추가:
```ts
import { bulkCreate, bulkUpdateMeta } from "./batch.ts";
```
`else if (command === "schedule") { ... }` 블록 뒤, `else { throw ... }` 앞에 추가:
```ts
    } else if (command === "batch-create") {
      const report = await bulkCreate(client, config, String(flags.file), { publish });
      report.items.forEach((item) =>
        logger.log({
          action: "batch-create",
          input: item.input,
          status: item.status,
          postId: item.result?.id,
          url: item.result?.url,
          error: item.error,
        }),
      );
      console.log(`성공 ${report.success} / 실패 ${report.failed}`);
    } else if (command === "batch-update-meta") {
      const report = await bulkUpdateMeta(client, config, String(flags.file));
      report.items.forEach((item) =>
        logger.log({
          action: "batch-update-meta",
          input: item.input,
          status: item.status,
          postId: item.result?.id,
          url: item.result?.url,
          error: item.error,
        }),
      );
      console.log(`성공 ${report.success} / 실패 ${report.failed}`);
```

- [ ] **Step 6: 타입체크**

Run: `cd wordpress-publisher && npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 7: 커밋**

```bash
git add wordpress-publisher/src/batch.ts wordpress-publisher/test/batch.test.ts wordpress-publisher/src/cli.ts
git commit -m "wordpress-publisher: add bulk meta update and wire batch CLI commands"
```

---

## Task 11: Yoast REST 진단 스크립트 + mu-plugin 스니펫

**Files:**
- Create: `wordpress-publisher/wp-content/mu-plugins/enable-yoast-rest-meta.php`
- Create: `wordpress-publisher/scripts/check-yoast.ts`

**Interfaces:**
- Consumes: `createClient`, `createPost` (posts.ts), `loadConfig`

이 태스크는 순수 로직이 아니라 진단용 스크립트라 vitest 단위테스트 대상이 아니다. 대신 Step 3에서 `--dry-run`으로 직접 실행해 정상 동작(에러 없이 끝까지 실행)을 확인한다.

- [ ] **Step 1: mu-plugin 스니펫 작성**

`wordpress-publisher/wp-content/mu-plugins/enable-yoast-rest-meta.php`:
```php
<?php
/**
 * Plugin Name: Enable Yoast REST Meta
 * Description: Yoast SEO의 메타 디스크립션/포커스 키워드를 REST API로 쓸 수 있게 노출합니다.
 *              wp-content/mu-plugins/ 에 이 파일을 그대로 올리면 자동으로 적용됩니다.
 */

add_action('rest_api_init', function () {
    $fields = ['_yoast_wpseo_metadesc', '_yoast_wpseo_focuskw'];

    foreach ($fields as $field) {
        register_post_meta('post', $field, [
            'show_in_rest' => true,
            'single' => true,
            'type' => 'string',
            'auth_callback' => function () {
                return current_user_can('edit_posts');
            },
        ]);
    }
});
```

- [ ] **Step 2: 진단 스크립트 작성**

`wordpress-publisher/scripts/check-yoast.ts`:
```ts
import "dotenv/config";
import { readFileSync } from "node:fs";
import { createClient } from "../src/client.ts";
import { loadConfig } from "../src/config.ts";
import { createPost } from "../src/posts.ts";

async function main() {
  const config = loadConfig(
    process.env,
    JSON.parse(readFileSync(new URL("../config.json", import.meta.url), "utf8")),
  );
  const client = createClient({
    baseUrl: config.baseUrl,
    username: config.username,
    appPassword: config.appPassword,
  });

  console.log("진단용 draft 글을 만들어 Yoast 메타 쓰기를 테스트합니다...");
  const testValue = `check-${Date.now()}`;
  const result = await createPost(client, config, {
    title: "WP Publisher — Yoast 진단용 (삭제 가능)",
    contentHtml: "<p>이 글은 Yoast REST 메타 쓰기가 되는지 확인하기 위한 테스트 draft입니다. 확인 후 삭제해도 됩니다.</p>",
    seo: { focusKeyword: testValue, metaDescription: testValue },
  });

  const raw = (await client.request<{ meta?: Record<string, string> }>({
    method: "GET",
    path: `/posts/${result.id}?context=edit`,
  })) as { meta?: Record<string, string> };

  const ok = raw.meta?._yoast_wpseo_focuskw === testValue && raw.meta?._yoast_wpseo_metadesc === testValue;

  console.log(`\n글 ID: ${result.id} (${result.url})`);
  if (ok) {
    console.log("✓ Yoast 메타 쓰기가 이미 가능합니다. mu-plugin을 설치할 필요 없습니다.");
  } else {
    console.log(
      "✗ Yoast 메타가 저장되지 않았습니다. wp-content/mu-plugins/enable-yoast-rest-meta.php를 사이트의 " +
        "wp-content/mu-plugins/ 폴더에 업로드한 뒤 다시 실행해 보세요.",
    );
  }
  console.log("\n이 테스트 draft 글은 WordPress 관리자에서 삭제해도 됩니다.");
}

main();
```

- [ ] **Step 3: dry-run으로 실행해 에러 없이 끝까지 도는지 확인**

Run: `cd wordpress-publisher && WP_USERNAME=x WP_APP_PASSWORD=y npx tsx scripts/check-yoast.ts`

(자격증명이 없어도 dry-run 클라이언트가 아니라 실제 클라이언트를 쓰므로 이 스크립트는 실제 자격증명 없이는 끝까지 돌지 않는다 — 이건 의도된 동작이다. 이 단계에서는 `createClient`/`createPost` import에 문법 오류나 타입 오류가 없는지 `npx tsc --noEmit`으로만 확인한다.)

Run: `npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 4: 커밋**

```bash
git add wordpress-publisher/wp-content wordpress-publisher/scripts
git commit -m "wordpress-publisher: add Yoast REST diagnostic script and mu-plugin snippet"
```

---

## Task 12: README + 전체 검증 + 실제 draft 테스트 등록 (사용자 승인 필요)

**Files:**
- Create: `wordpress-publisher/README.md`

이 태스크의 마지막 두 단계는 **molespapa.com에 실제로 요청을 보낸다.** 사용자가 Application
Password를 만들고 `.env`를 채운 뒤, 명시적으로 진행해도 좋다고 확인한 다음에만 Step 4, 5를 실행한다.

- [ ] **Step 1: README 작성**

`wordpress-publisher/README.md`에 다음 내용을 담아 작성한다: (1) Application Password 발급 절차
(WordPress 관리자 → 사용자 → 프로필 → Application Passwords → 이름 "Claude Automation" → 생성 →
`.env`의 `WP_APP_PASSWORD`에 공백 포함 그대로 붙여넣기), (2) `npm install` 안내, (3) mu-plugin
설치 절차와 `npm run check-yoast`로 확인하는 법, (4) 명령어별 사용 예시:
```bash
npm run cli -- create --title "글 제목" --content-file ./post.html --category 부동산 --tags 계산기,금융 --dry-run
npm run cli -- create --title "글 제목" --content-file ./post.html --publish
npm run cli -- update --id 123 --title "새 제목"
npm run cli -- add-seo --id 123 --focus-keyword 전세 --meta-description "전세 관련 설명"
npm run cli -- schedule --title "글 제목" --content-file ./post.html --publish-at "2026-09-28 09:00"
npm run cli -- batch-create --file ./posts.csv --dry-run
npm run cli -- batch-update-meta --file ./meta.json
```
(5) CSV/JSON 스키마(Task 9, 10의 컬럼 정의를 표로), (6) `--dry-run`/`--publish`/기본 draft 규칙 설명,
(7) `logs/run-*.jsonl` 위치와 형식.

- [ ] **Step 2: 전체 테스트·타입체크 실행**

Run: `cd wordpress-publisher && npx vitest run && npx tsc --noEmit`
Expected: 전체 PASS, 타입 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add wordpress-publisher/README.md
git commit -m "wordpress-publisher: add usage README"
```

- [ ] **Step 4: (사용자 승인 후) 사용자가 `.env`에 실제 자격증명을 채웠는지 확인**

사용자에게 다음을 확인받는다: WordPress에서 Application Password를 만들었는지, `wordpress-publisher/.env`에
`WP_USERNAME`/`WP_APP_PASSWORD`를 넣었는지, mu-plugin을 설치했는지(Yoast 메타 테스트를 원할 경우).
확인 전에는 이 단계를 실행하지 않는다.

- [ ] **Step 5: (사용자 승인 후) 실제 draft 테스트 등록 1건**

Run: `cd wordpress-publisher && npm run cli -- create --title "테스트 글 (삭제 가능)" --content "<p>WordPress Publisher 첫 테스트입니다.</p>" --category 부동산 --tags 계산기,금융`

`--publish`를 넣지 않았으므로 draft로 만들어진다. 콘솔에 출력된 `id`/`url`을 사용자에게 보여주고,
WordPress 관리자에서 확인 후 삭제하거나 그대로 둘지 물어본다.
