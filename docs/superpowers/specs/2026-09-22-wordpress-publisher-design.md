# WordPress 글 자동 등록·수정 시스템 — 설계

- 상태: 승인됨 (사용자 승인 2026-09-22)
- 대상 사이트: `https://molespapa.com`
- 위치: `wordpress-publisher/` (이 저장소 내 독립 프로젝트, Next.js 앱과 무관)

## 1. 배경과 목적

molespapa.com(WordPress)에 글을 자동으로 등록·수정하는 CLI 도구를 만든다.
Yoast SEO 메타(포커스 키워드, 메타 디스크립션) 설정, 카테고리/태그 지정,
일괄 등록·수정, 예약발행을 지원한다.

## 2. 범위

**포함**
- 단일 글 등록 (`createPost`), 수정 (`updatePost`)
- Yoast SEO 메타 추가/수정 (`addSeoMeta`)
- 예약발행 (`schedulePost`) — WordPress 자체 예약발행(WP-Cron) 사용
- 카테고리/태그를 이름으로 지정 (내부에서 ID로 변환, 없으면 생성 시도)
- CSV/JSON 파일에서 일괄 등록, 일괄 메타 수정
- 실행 로그(성공/실패)와 요약 리포트
- 드라이런 모드 (`--dry-run`): 실제 요청을 보내지 않고 계획만 출력
- Yoast REST 쓰기 진단 스크립트, 필요 시 추가할 WordPress mu-plugin 스니펫

**제외** (이번 범위 아님)
- 이미지/미디어 업로드
- AI를 이용한 본문/제목 생성
- WordPress 플러그인·파일의 원격 설치/배포 (mu-plugin 파일은 만들어 주지만 사이트에 올리는 건 사용자가 직접 함)
- 큐 기반 자동 발행 스케줄러(정해진 요일마다 다음 글을 자동으로 뽑아 예약) — 필요해지면 후속 작업으로 분리

## 3. 결정된 사항 (사용자 승인)

| 항목 | 결정 |
|---|---|
| 언어/런타임 | Node.js + TypeScript, Node 18+ 내장 `fetch` 사용, 외부 HTTP 라이브러리 없음 |
| 저장 위치 | 이 저장소의 `wordpress-publisher/` 독립 폴더 (별도 `package.json`) |
| 자격증명 | `config.json`에는 비밀 아닌 값만. `WP_USERNAME`/`WP_APP_PASSWORD`는 `.env`(저장소 루트 `.gitignore`의 `.env*`로 이미 무시됨)에서 읽음 |
| Yoast 메타 쓰기 | 사전 설정 여부 불확실 → 진단 스크립트 + mu-plugin 스니펫을 함께 제공 |
| 예약발행 방식 | WordPress 자체 예약발행(`status: future` + `date_gmt`). 외부 cron 불필요 |
| 기본 발행 상태 | 항상 `draft`가 기본값. 실제 발행은 명시적 플래그(`--publish`)가 있어야 함 |
| 발행 시각 입력 | 한국 시간(KST, Asia/Seoul)으로 입력받아 UTC로 변환해 WordPress에 전달 |

## 4. 파일 구조

```
wordpress-publisher/
  package.json
  tsconfig.json
  vitest.config.ts
  .env.example
  config.json
  README.md
  src/
    config.ts          # config.json + .env 로드, 필수값 검증
    client.ts          # 인증(Basic Auth: base64(username:app_password)) fetch 래퍼, 에러 정규화
    taxonomy.ts         # 카테고리/태그 이름 <-> ID 변환, 없으면 생성 시도
    posts.ts            # createPost / updatePost / addSeoMeta / schedulePost
    batch.ts            # CSV/JSON 일괄 등록·메타 수정
    logger.ts           # logs/run-<timestamp>.jsonl 기록 + 콘솔 요약
    cli.ts              # 명령줄 진입점 (create/update/add-seo/schedule/batch-create/batch-update-meta)
  wp-content/mu-plugins/
    enable-yoast-rest-meta.php   # 사용자가 직접 사이트에 올려야 하는 스니펫
  scripts/
    check-yoast.ts       # Yoast REST 쓰기 가능 여부 진단
  test/
    *.test.ts            # vitest, HTTP는 모킹
  logs/                  # 실행 로그 (gitignore)
```

## 5. 설정 파일 예시

`wordpress-publisher/config.json` (커밋됨, 비밀 없음):
```json
{
  "wordpress_url": "https://molespapa.com",
  "api_endpoint": "/wp-json/wp/v2",
  "default_category": "부동산",
  "default_tags": ["계산기", "금융"]
}
```

`wordpress-publisher/.env.example` (커밋됨, 값은 비워둠):
```
WP_USERNAME=
WP_APP_PASSWORD=
```

`.env`는 위 예시를 복사해 실제 값을 채운 파일이며, 저장소 루트 `.gitignore`의 `.env*` 규칙에
걸려 하위 폴더에서도 자동으로 커밋되지 않는다.

## 6. 인증 흐름

1. WordPress 관리자 → 사용자 → 프로필 → "Application Passwords" 섹션에서
   이름 "Claude Automation"으로 새 Application Password를 만든다.
2. 생성된 비밀번호(공백 포함 문자열)를 `.env`의 `WP_APP_PASSWORD`에 그대로 붙여넣는다.
   워드프레스 사용자명(로그인 ID)을 `WP_USERNAME`에 넣는다.
3. `client.ts`는 모든 요청에 `Authorization: Basic base64(username:app_password)` 헤더를 붙인다.
4. 에러 로그·콘솔 출력 어디에도 `Authorization` 헤더 값이나 비밀번호 원문이 남지 않도록 마스킹한다.

## 7. 데이터 모델

```ts
interface PostInput {
  title: string;
  contentHtml: string;
  category?: string;           // 이름. 없으면 config.default_category
  tags?: string[];              // 이름 배열. 없으면 config.default_tags
  status?: "draft" | "publish"; // 기본 draft
  seo?: { focusKeyword?: string; metaDescription?: string };
}

interface PostResult {
  id: number;
  url: string;
  status: string;
}

interface SeoMetaInput {
  focusKeyword?: string;
  metaDescription?: string;
}

interface ScheduleInput extends PostInput {
  publishAtKst: string; // "2026-09-28 09:00" 형식, KST 기준
}
```

## 8. 함수별 동작

### `createPost(input: PostInput): Promise<PostResult>`
1. `category`/`tags` 이름을 `taxonomy.ts`로 ID 변환 (조회 → 없으면 생성 시도 → 생성 권한 없으면 명확한 에러)
2. `seo`가 있으면 `meta` 필드에 `_yoast_wpseo_focuskw`, `_yoast_wpseo_metadesc` 포함
3. `status` 기본값 `draft`
4. `POST /wp/v2/posts` 호출, 결과에서 `id`, `link`(URL), `status` 추출
5. 로그 기록 후 반환

### `updatePost(id: number, patch: Partial<PostInput>): Promise<PostResult>`
- 부분 수정. `POST /wp/v2/posts/{id}`로 변경된 필드만 전송
- 일괄 SEO 수정의 기반 함수 (`addSeoMeta`가 내부에서 이 함수를 호출)

### `addSeoMeta(id: number, meta: SeoMetaInput): Promise<PostResult>`
- `updatePost(id, { seo: meta })`의 얇은 래퍼
- 실행 전 `scripts/check-yoast.ts`로 검증했는지와 무관하게 항상 시도하고, 응답의 `meta`에 실제로 값이 반영됐는지 확인해서 반영 안 됐으면(무시된 경우) 경고와 함께 mu-plugin 설치 안내를 출력

### `schedulePost(input: ScheduleInput): Promise<PostResult>`
1. `publishAtKst`를 Asia/Seoul 기준으로 파싱해 UTC로 변환
2. `createPost`와 동일한 처리 + `status: "future"`, `date_gmt: <변환된 UTC>`
3. 과거 시각이면 에러로 막음 (WordPress가 즉시 발행해버리는 걸 방지)

### `bulkCreate(filePath: string, opts): Promise<Report>`
- CSV: 헤더 `title,content_file,category,tags,status,focus_keyword,meta_description,publish_at_kst`
  (`content_file`은 로컬 `.html` 파일 경로. `tags`는 `;`로 구분)
- JSON: `PostInput[]`을 그대로 배열로, `contentHtml` 직접 포함 가능
- 각 행마다 `createPost` 또는 `schedulePost` 호출(`publish_at_kst` 유무로 분기), 실패해도 나머지 행 계속 진행
- 끝나면 `{ success: number, failed: number, results: [...] }` 리포트 반환 + 콘솔 출력

### `bulkUpdateMeta(filePath: string, opts): Promise<Report>`
- CSV/JSON: `{ id, focusKeyword?, metaDescription? }[]`
- 각 행마다 `addSeoMeta` 호출, 실패해도 계속 진행

## 9. 드라이런 / 안전장치

- 모든 CLI 명령은 `--dry-run` 플래그를 받는다. 켜지면 `client.ts`가 실제 `fetch`를 호출하지 않고,
  보낼 method·URL·body를 콘솔에 출력한 뒤 가짜 결과(`id: 0` 등 명시적으로 구분되는 값)를 반환한다.
- `create`/`batch-create`는 `--publish`가 없으면 무조건 `status: draft`로 강제한다.
  입력에 `status: "publish"`가 있어도 플래그가 없으면 draft로 낮추고 경고를 출력한다.
- `schedule`/`batch-create`의 예약발행 행은 이 규칙의 예외다: `--publish` 없이도 `status: future`를
  그대로 보낸다. 예약은 즉시 공개되지 않고 지정한 미래 시각에만 발행되므로, 사용자가 예약 시각을
  명시적으로 입력한 것 자체가 "발행 의도"이기 때문이다. 단 과거 시각이 들어오면 즉시 발행으로
  이어지므로 (`schedulePost` 3단계) 에러로 막는다.
- `.env` 파일 자체나 그 안의 값은 로그·에러 메시지에 절대 출력하지 않는다.

## 10. 로깅

- `logs/run-<ISO타임스탬프>.jsonl`: 한 줄에 하나의 액션
  `{ timestamp, action, input: <민감정보 제거된 요약>, status: "success"|"error", postId?, url?, error? }`
- 실행이 끝나면 콘솔에 `성공 N / 실패 M` 요약과 실패 항목 목록을 출력
- `logs/`는 `.gitignore`에 추가

## 11. Yoast SEO 메타 사전 조건

기본 WordPress REST API는 Yoast 메타를 읽기만 허용한다. `enable-yoast-rest-meta.php`는
`_yoast_wpseo_metadesc`, `_yoast_wpseo_focuskw`를 `register_post_meta`로 REST에 노출시킨다.
사용자가 이 파일을 사이트의 `wp-content/mu-plugins/`에 직접 올려야 동작한다(SFTP, 호스팅
파일관리자, 또는 스니펫 플러그인). `scripts/check-yoast.ts`가 이미 되어 있는지 실행 전에
확인해 알려준다.

## 12. 테스트 전략

- vitest로 순수 로직을 테스트: 설정 로드/검증, 카테고리·태그 이름 처리, 날짜(KST→UTC) 변환,
  CSV/JSON 파싱, draft 강제 규칙, 페이로드 조립.
- HTTP 호출은 모두 모킹(`fetch`를 주입 가능하게 설계). 실제 네트워크 요청은 테스트에서 발생시키지 않는다.
- 실제 molespapa.com에 대한 테스트는 이 스펙의 범위가 아니라 구현 완료 후, 사용자가 Application
  Password를 발급하고 `.env`를 채운 다음 사용자 승인 하에 별도로 진행한다(첫 테스트는 draft로만).

## 13. 완료 조건

- 위 함수 전부 구현 + vitest 통과
- `README.md`: Application Password 발급 절차, `.env` 설정, mu-plugin 설치 절차, 각 명령어 사용법과
  예시, 일괄 등록 CSV/JSON 스키마 설명
- 실제 molespapa.com에 대한 draft 테스트 등록 1건 (사용자가 자격증명을 준비하고 승인한 뒤)
