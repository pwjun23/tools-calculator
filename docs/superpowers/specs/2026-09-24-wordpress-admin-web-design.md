# WordPress 발행 관리 웹 화면 — 설계

- 상태: 승인됨 (사용자 승인 2026-09-24)
- 대상: `tools.molespapa.com` (Vercel에 배포된 이 Next.js 앱)
- 위치: 이 앱의 `app/admin/wordpress/`, `lib/wordpress/`, `middleware.ts`

## 1. 배경과 목적

`wordpress-publisher/` CLI 도구(이미 완성, molespapa.com에 실제 draft 등록까지 검증됨)를
터미널 없이 브라우저에서 쓸 수 있게 만든다. 즉석 단일 글 등록, JSON 일괄 등록, 예약 발행,
예약된 글 목록 조회를 지원한다.

## 2. 범위

**포함**
- `/admin/wordpress` 관리 페이지 (단일 비밀번호로 보호)
- 단일 글 등록 (제목/내용/카테고리/태그, 즉시 발행 또는 예약)
- JSON 붙여넣기/파일 업로드로 일괄 등록 (CLI의 `bulkCreate`와 동일한 배열 스키마)
- 예약된 글 목록 조회 (WordPress `status=future` 글을 그대로 조회, 별도 저장소 없음)
- 최근 실행 결과를 화면에 표시 (영구 로그 없음)

**제외** (이번 범위 아님)
- AI가 스스로 글감을 정해서 쓰는 기능 (사용자가 직접 확인함 — 나중에 별도 설계)
- 여러 관리자 계정/역할 구분
- 영구 실행 로그 저장소(DB)
- CLI 도구(`wordpress-publisher/`)와 로직 통합(공유 패키지화) — 지금은 복사해서 둘 다 유지
- 태그/카테고리 자동 생성 UI (CLI와 동일하게, 없으면 명확한 에러만 보여줌 — 워드프레스 관리자에서
  직접 만들어야 함)

## 3. 결정된 사항 (사용자 승인)

| 항목 | 결정 |
|---|---|
| 코드 공유 방식 | CLI(`wordpress-publisher/`)는 그대로 두고, 핵심 로직을 이 앱의 `lib/wordpress/`에 이 앱 관례(확장자 없는 상대 임포트)로 다시 작성. 중복은 감당하고 나중에 필요하면 통합 |
| 관리자 인증 | 단일 비밀번호 게이트. `ADMIN_PASSWORD` 환경변수, 로그인 성공 시 서명된 httpOnly 쿠키 |
| 노출 방식 | `/admin/wordpress` 경로만, 홈 카드 목록(`lib/tools.ts`)에는 추가하지 않음 |
| 예약 글 목록 | 별도 DB 없이 WordPress REST API `GET /posts?status=future`를 그대로 조회 |
| 실행 로그 | 영구 저장 없음(Vercel 서버리스는 파일시스템이 요청마다 초기화됨). 화면에 결과만 표시 |
| 초기 상태 | 이 CLI와 동일하게, 일괄/단일 등록 모두 기본은 draft. `--publish` 대응 UI 토글이 있어야 실제 발행 |

## 4. 파일 구조

```
middleware.ts                          # /admin/* 보호, 쿠키 검증
app/admin/
  login/
    page.tsx                           # 비밀번호 입력 폼
    actions.ts                         # verifyPassword(password): 쿠키 발급
  wordpress/
    page.tsx                           # 관리 화면 (단일 등록 + 일괄 등록 + 예약 목록)
    actions.ts                         # Server Actions: createPostAction, scheduleAction,
                                        #   bulkCreateAction, listScheduledAction
    components/
      SinglePostForm.tsx                # 'use client'
      BulkUploadForm.tsx                # 'use client'
      ScheduledList.tsx                 # 서버 컴포넌트 (매 방문 시 재조회)
      ResultPanel.tsx                    # 실행 결과 표시 (성공/실패 목록)
lib/wordpress/
  types.ts            # wordpress-publisher/src/types.ts 와 동일 타입 (독립 복사)
  config.ts           # env에서 WP_USERNAME/WP_APP_PASSWORD 로드 + wordpress_url 등 비밀
                        #   아닌 기본값은 이 파일 안 상수로 (별도 JSON 파일 없음 —
                        #   서버리스 환경에서 파일시스템 읽기를 피한다)
  client.ts           # 인증 fetch 래퍼 (dry-run 없음 — 웹에서는 항상 실사용)
  taxonomy.ts          # 카테고리/태그 이름 -> ID
  posts.ts             # createPost / updatePost / addSeoMeta / schedulePost
  batch.ts             # bulkCreate / bulkUpdateMeta
test/
  lib/wordpress/*.test.ts   # vitest, fetch 모킹 (CLI 때와 동일한 스타일)
```

`lib/wordpress/*.ts`는 CLI의 대응 파일에서 로직을 그대로 가져오되, 두 가지만 다르게 한다:
1. `import`에서 `.ts` 확장자를 뺀다 (이 앱의 다른 `lib/` 파일들과 동일한 관례).
2. `client.ts`에 dry-run 분기를 넣지 않는다 — 이 웹 화면은 실제 서비스 도구이므로 항상 실요청을
   보낸다. 대신 `SinglePostForm`이 "예약 발행" 없이 직접 "지금 발행"을 누르기 전엔 항상 draft로
   보내는 건 CLI와 동일하게 유지한다 (아래 §7).

## 5. 인증 흐름

1. `middleware.ts`가 `/admin` 이하 모든 경로에서 쿠키 `admin_session`을 확인한다. 없거나
   유효하지 않으면 `/admin/login`으로 리다이렉트한다.
2. `/admin/login`에서 비밀번호를 입력하면 `actions.ts`의 `verifyPassword`가
   `process.env.ADMIN_PASSWORD`와 상수시간 비교(`crypto.timingSafeEqual`)한다.
3. 맞으면 HMAC 서명된 값(`admin_session=<timestamp>.<hmac>`, 서명 키는
   `process.env.ADMIN_PASSWORD` 자체를 키로 사용)을 httpOnly, secure, sameSite=strict 쿠키로
   30일 유지 설정한다. `middleware.ts`는 이 서명을 재검증해서 위조를 막는다.
4. WordPress 자격증명(`WP_USERNAME`/`WP_APP_PASSWORD`)은 Server Action/서버 컴포넌트 안에서만
   읽는다 — 클라이언트 컴포넌트나 응답 JSON에 절대 포함하지 않는다.

## 6. 데이터 모델 (요청/응답 형태)

```ts
// lib/wordpress/types.ts — wordpress-publisher/src/types.ts 와 필드 동일
export interface PostInput {
  title: string;
  contentHtml: string;
  category?: string;
  tags?: string[];
  status?: "draft" | "publish";
  seo?: { focusKeyword?: string; metaDescription?: string };
}
export interface ScheduleInput extends PostInput {
  publishAtKst: string; // "2026-09-28 09:00"
}
export interface PostResult {
  id: number;
  url: string;
  status: string;
}
export interface Report {
  success: number;
  failed: number;
  items: Array<{ input: unknown; status: "success" | "error"; result?: PostResult; error?: string }>;
}
```

화면의 각 폼은 위 타입과 1:1로 매칭되는 필드를 받는다. 일괄 등록의 JSON 붙여넣기는
`PostInput[]` (예약 행은 `publishAtKst` 포함) 배열을 그대로 받는다 — CLI의 JSON 배치 스키마와
완전히 동일해서, 클로드 에이전트가 CLI용으로 만든 JSON을 그대로 웹에 붙여넣어도 동작한다.

## 7. 화면별 동작

### 단일 글 등록 (`SinglePostForm`)
- 필드: 제목(필수), 내용(HTML, 필수), 카테고리, 태그(쉼표 구분), 발행 방식 라디오(초안/지금 발행/예약),
  예약 선택 시 날짜시간 입력(KST).
- "초안"이나 "예약"이 아니라 "지금 발행"을 명시적으로 선택해야만 `createPostAction`이
  `{ publish: true }`로 `createPost`를 호출한다. 그 외엔 CLI와 동일하게 무조건 draft.
- "예약"을 선택하면 `scheduleAction`이 `schedulePost`를 호출한다(과거 시각이면 CLI와 동일하게
  에러, 요청 자체를 보내지 않음).
- 제출 후 `ResultPanel`에 결과(포스트 ID, URL, 상태) 또는 에러 메시지를 표시한다.

### 일괄 등록 (`BulkUploadForm`)
- JSON 텍스트 붙여넣기 또는 `.json`/`.csv` 파일 업로드(브라우저 File API로 읽어서 텍스트를
  Server Action에 전달 — 서버는 파일시스템에 아무것도 쓰지 않는다. CSV는 CLI와 동일하게
  `content_file` 컬럼 없이 `content` 컬럼에 HTML을 직접 담는 방식만 지원한다 — 웹에는
  "CSV 옆의 로컬 파일"이라는 개념이 없기 때문이다).
- "지금 발행" 체크박스가 없으면(기본) 전부 draft. 체크하면 `publishAtKst`가 없는 행만 발행되고,
  `publishAtKst`가 있는 행은 CLI와 동일하게 항상 예약(`status: future`)으로 간다.
- 결과는 `ResultPanel`에 행별 성공/실패 목록으로 표시한다(CLI의 `성공 N / 실패 M` 요약과 동일한
  정보를 화면에 표로 보여준다).

### 예약된 글 목록 (`ScheduledList`)
- 서버 컴포넌트에서 페이지 방문마다 `GET /wp-json/wp/v2/posts?status=future&per_page=50`을
  조회해서 제목/예약 시각/링크를 표로 보여준다. 클릭하면 워드프레스 편집 화면으로 이동(수정은
  이 화면에서 하지 않고 워드프레스 자체에서 하도록 안내).

## 8. 안전장치

- 필수 입력은 CLI와 동일하게 **제목만** 검증한다(내용이 비어 있어도 막지 않음 — CLI의 관용을
  그대로 따른다). Server Action 진입 시점에 검증하고, 실패하면 실제 WordPress 요청 전에
  명확한 한글 에러를 `ResultPanel`에 표시한다 (CLI의 최종 리뷰에서 고친 필수 플래그 검증과
  동일한 원칙).
- "지금 발행"은 라디오에서 명시적으로 선택해야 하고, 기본 선택값은 항상 "초안"이다.
- WordPress 자격증명은 서버 환경변수에서만 읽고, 어떤 응답 JSON·에러 메시지·콘솔 로그에도
  포함하지 않는다 (CLI와 동일한 원칙, `lib/wordpress/client.ts`가 그대로 지킨다).
- 관리자 비밀번호 비교는 상수시간 비교(`crypto.timingSafeEqual`)를 쓴다.

## 9. 테스트 전략

- `lib/wordpress/*.ts`의 순수 로직: CLI 때와 동일하게 vitest로, `fetch`를 모킹해 실제 네트워크
  요청 없이 검증한다. CLI의 테스트를 그대로 가져와 임포트 경로(확장자 제거)만 고친다.
- Server Actions/페이지 자체: CLI의 `cli.ts`가 그랬듯 단위 테스트 대상이 아니다. 구현 후
  로컬(`npm run dev`)에서 실제 화면으로 한 번 확인하고, 실제 molespapa.com에 대한 등록은
  사용자 승인 하에 1건만 진행한다(이미 CLI로 검증된 자격증명/서버 설정을 그대로 사용하므로
  이번엔 서버 쪽 문제가 재발할 걱정은 없다).

## 10. 완료 조건

- `lib/wordpress/` 전체 vitest 통과, 타입체크 클린
- `/admin/login` → `/admin/wordpress` 흐름이 로컬에서 정상 동작 (비밀번호 틀리면 거부, 맞으면
  진입)
- 단일 등록 폼으로 실제 draft 글 1건 생성 성공 (사용자 승인 하에)
- 일괄 등록 폼으로 2건 이상 JSON 업로드 성공(최소 1건은 예약 포함)
- 예약된 글 목록에 방금 예약한 글이 표시됨
- 홈 화면(`lib/tools.ts`, sitemap)에는 이 페이지가 추가되지 않았음을 확인
