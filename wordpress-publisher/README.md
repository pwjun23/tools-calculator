# wordpress-publisher

molespapa.com(WordPress)에 글을 만들고/수정하고/SEO 메타를 채우고/예약 발행하는 CLI 도구입니다.
WordPress REST API(`/wp-json/wp/v2`)를 Application Password로 인증해 호출합니다.

## 1. 설치

```bash
cd wordpress-publisher
npm install
```

## 2. WordPress 자격증명 준비 (Application Password)

1. WordPress 관리자 페이지에 로그인합니다.
2. **사용자 → 프로필**로 이동합니다.
3. 화면 아래 **Application Passwords** 섹션에서 이름에 `Claude Automation`을 입력하고
   **새 애플리케이션 비밀번호 추가**를 누릅니다.
4. 발급된 비밀번호(공백이 포함된 형태, 예: `abcd efgh ijkl mnop`)를 그 자리에서 복사합니다.
   화면을 벗어나면 다시 볼 수 없으므로 즉시 복사해야 합니다.
5. `wordpress-publisher/.env.example`을 복사해 `.env`를 만들고 값을 채웁니다.

   ```bash
   cp .env.example .env
   ```

   ```env
   WP_USERNAME=워드프레스_로그인_아이디
   WP_APP_PASSWORD=abcd efgh ijkl mnop
   ```

   `WP_APP_PASSWORD`는 공백을 제거하지 말고 발급된 그대로 붙여넣습니다.

`.env`는 `.gitignore`에 포함되어 있어 커밋되지 않습니다. 사이트 주소, API 엔드포인트,
기본 카테고리/태그는 `.env`가 아니라 `config.json`에 있습니다(현재 값: `wordpress_url`,
`api_endpoint`, `default_category`, `default_tags`).

## 3. Yoast SEO 메타 쓰기 확인 (mu-plugin)

WordPress 코어 REST API는 기본적으로 Yoast SEO의 포커스 키워드/메타 디스크립션 메타 필드를
쓰기 허용하지 않습니다. 이 저장소의 `wp-content/mu-plugins/enable-yoast-rest-meta.php`가 그
필드를 REST에 노출시켜줍니다.

1. `wp-content/mu-plugins/enable-yoast-rest-meta.php` 파일을 워드프레스 서버의
   `wp-content/mu-plugins/` 폴더에 그대로 업로드합니다(활성화 절차 없이 자동 적용됩니다).
2. 아래 명령으로 실제로 메타가 저장되는지 진단합니다.

   ```bash
   npm run check-yoast
   ```

   이 스크립트는 진단용 draft 글을 하나 만들어 포커스 키워드/메타 디스크립션을 써본 뒤 실제로
   저장됐는지 확인합니다. `✓ Yoast 메타 쓰기가 이미 가능합니다`가 나오면 mu-plugin 설치가
   필요 없다는 뜻이고, `✗`가 나오면 위 mu-plugin을 설치한 뒤 다시 실행하세요. 생성된 진단용
   draft 글은 WordPress 관리자에서 확인 후 삭제해도 됩니다.

   `add-seo`/`batch-update-meta` 실행 시에도 응답에 메타가 반영되지 않으면 동일한 안내가
   경고로 출력됩니다.

## 4. 명령어 사용법

모든 명령은 `npm run cli --` 뒤에 `<command> --flag value ...` 형태로 실행합니다
(`--`는 npm이 뒤의 인자를 그대로 스크립트에 전달하도록 하는 구분자입니다).

### create — 새 글 작성

```bash
npm run cli -- create --title "글 제목" --content-file ./post.html --category 부동산 --tags 계산기,금융 --dry-run
npm run cli -- create --title "글 제목" --content-file ./post.html --publish
```

| 플래그 | 설명 |
| --- | --- |
| `--title` | 글 제목 (필수) |
| `--content-file` | 본문 HTML 파일 경로. 지정하면 `--content`보다 우선합니다. |
| `--content` | 본문 HTML을 문자열로 직접 전달 |
| `--category` | 카테고리 이름 (생략 시 `config.json`의 `default_category`) |
| `--tags` | 태그 이름을 **쉼표(,)**로 구분해 전달 (생략 시 `default_tags`) |
| `--focus-keyword` | Yoast 포커스 키워드 (선택) |
| `--meta-description` | Yoast 메타 디스크립션 (선택) |
| `--dry-run` | 실제 요청을 보내지 않고 WordPress에 보낼 요청(method/url/body)만 출력 |
| `--publish` | 즉시 발행. 생략하면 항상 `draft`로 생성됩니다 |

### update — 기존 글 수정

```bash
npm run cli -- update --id 123 --title "새 제목"
```

| 플래그 | 설명 |
| --- | --- |
| `--id` | 수정할 글의 ID (필수) |
| `--title` | 새 제목 (선택) |
| `--category` | 새 카테고리 (선택) |
| `--tags` | 새 태그, 쉼표로 구분 (선택) |
| `--dry-run` | 실제 요청을 보내지 않고 미리보기만 출력 |

주의:
- 현재 `update` 명령은 본문(`--content`/`--content-file`)이나 SEO 메타 플래그를 CLI에서
  받지 않습니다(내부 `updatePost`는 지원하지만 `cli.ts`가 아직 그 플래그들을 연결하지
  않았습니다). SEO 메타를 바꾸려면 `add-seo` 명령을 쓰세요.
- `--publish` 플래그를 줄 수는 있지만, `update`는 title/category/tags만 바꾸고 발행 상태
  (`status`)는 건드리지 않으므로 현재는 눈에 보이는 효과가 없습니다.

### add-seo — Yoast SEO 메타 채우기

```bash
npm run cli -- add-seo --id 123 --focus-keyword 전세 --meta-description "전세 관련 설명"
```

| 플래그 | 설명 |
| --- | --- |
| `--id` | 대상 글 ID (필수) |
| `--focus-keyword` | 포커스 키워드 (선택) |
| `--meta-description` | 메타 디스크립션 (선택) |
| `--dry-run` | 실제 요청을 보내지 않고 미리보기만 출력 (다른 모든 명령과 동일하게 지원) |

WordPress가 응답에서 값을 실제로 반영하지 않았으면(mu-plugin 미설치 등) 콘솔에 `⚠` 경고가
추가로 출력됩니다(`--dry-run`일 때는 이 확인을 하지 않으므로 경고가 뜨지 않습니다).

### schedule — 예약 발행

```bash
npm run cli -- schedule --title "글 제목" --content-file ./post.html --publish-at "2026-09-28 09:00"
```

| 플래그 | 설명 |
| --- | --- |
| `--title`, `--content-file`/`--content`, `--category`, `--tags` | create와 동일 |
| `--publish-at` | 발행 시각. **한국시간(KST) 기준** `"YYYY-MM-DD HH:mm"` 형식 (예: `"2026-09-28 09:00"`). 과거 시각을 넣으면 에러가 나고 요청을 보내지 않습니다 |
| `--dry-run` | 실제 요청을 보내지 않고 미리보기만 출력 |

`schedule`은 항상 `status: future`로 등록되며 `--publish` 플래그는 받지 않습니다(예약 자체가
발행 예정 상태이기 때문입니다). WordPress가 지정 시각에 자동으로 발행합니다.

### batch-create — CSV/JSON으로 여러 글 일괄 생성

```bash
npm run cli -- batch-create --file ./posts.csv --dry-run
```

| 플래그 | 설명 |
| --- | --- |
| `--file` | `.csv` 또는 `.json` 파일 경로 (필수) |
| `--dry-run` / `--publish` | create와 동일하게 각 행에 적용됩니다 |

행에 예약 발행 컬럼(`publish_at_kst`/`publishAtKst`)이 있으면 해당 행만 `schedule`과 동일하게
예약 발행으로 처리되고(그 행은 항상 `status: future`이므로 `--publish`가 적용되지 않습니다.
단 `--dry-run`은 클라이언트 전체에 걸리므로 이 행에도 적용됩니다), 나머지 행은 `create`로
처리됩니다. 한 행이 실패해도 나머지 행 처리는 계속됩니다.

### batch-update-meta — CSV/JSON으로 여러 글 SEO 메타 일괄 수정

```bash
npm run cli -- batch-update-meta --file ./meta.json
```

| 플래그 | 설명 |
| --- | --- |
| `--file` | `.csv` 또는 `.json` 파일 경로 (필수) |
| `--dry-run` | 실제 요청을 보내지 않고 미리보기만 출력 (각 행에 적용) |

각 행이 `add-seo`와 동일하게 처리되며, 한 행이 실패해도 나머지 행 처리는 계속됩니다.

## 5. CSV/JSON 스키마

### batch-create 입력

**CSV** (헤더는 snake_case, 태그는 **세미콜론(;)**으로 구분, `content_file`은 CSV 파일 기준
상대경로):

| 컬럼 | 필수 | 설명 |
| --- | --- | --- |
| `title` | O | 글 제목 |
| `content_file` | 택1 | 본문 HTML 파일 경로 (CSV 파일이 있는 폴더 기준 상대경로) |
| `content` | 택1 | 본문 HTML 문자열 (`content_file`이 없을 때 사용) |
| `category` | X | 카테고리 이름 |
| `tags` | X | 태그, **세미콜론(;)**으로 구분 (예: `계산기;금융`) |
| `focus_keyword` | X | Yoast 포커스 키워드 |
| `meta_description` | X | Yoast 메타 디스크립션 |
| `publish_at_kst` | X | 있으면 해당 행을 예약 발행으로 처리 (KST `"YYYY-MM-DD HH:mm"`) |

예시:

```csv
title,content_file,category,tags,focus_keyword,meta_description,publish_at_kst
"전세 대출 계산기",post1.html,부동산,계산기;금융,전세대출,전세 대출 이자 계산 방법
```

**JSON** (camelCase, `PostInput` 형태를 그대로 배열로 작성; 태그는 배열, SEO는 객체):

```json
[
  {
    "title": "전세 대출 계산기",
    "contentHtml": "<p>본문 HTML</p>",
    "category": "부동산",
    "tags": ["계산기", "금융"],
    "seo": { "focusKeyword": "전세대출", "metaDescription": "전세 대출 이자 계산 방법" },
    "publishAtKst": "2026-09-28 09:00"
  }
]
```

`publishAtKst`가 없는 항목은 `create`로, 있는 항목은 `schedule`로 처리됩니다.

### batch-update-meta 입력

**CSV**:

| 컬럼 | 필수 | 설명 |
| --- | --- | --- |
| `id` | O | 글 ID |
| `focus_keyword` | X | Yoast 포커스 키워드 |
| `meta_description` | X | Yoast 메타 디스크립션 |

```csv
id,focus_keyword,meta_description
123,전세,전세 관련 설명
```

**JSON** (camelCase):

```json
[{ "id": 123, "focusKeyword": "전세", "metaDescription": "전세 관련 설명" }]
```

## 6. dry-run / publish / draft 기본 규칙

- **기본값은 언제나 draft입니다.** `create`/`update`/`batch-create`에서 `--publish`를 주지
  않으면 WordPress에 `status: draft`로 저장됩니다. 입력에 `status: "publish"`가 있어도
  `--publish` 없이는 `draft`로 강제 하향됩니다.
- **`--publish`**: 즉시 공개 발행(`status: publish`)합니다. `create`/`update`/`batch-create`에서만
  의미가 있습니다.
- **`--dry-run`**: 모든 명령(`create`/`update`/`add-seo`/`schedule`/`batch-create`/`batch-update-meta`)에서
  공통으로 지원됩니다. 실제 HTTP 요청을 WordPress로 보내지 않고, 대신 어떤
  `method`/`url`/`body`가 전송될지 콘솔에 출력해 미리 확인할 수 있습니다(응답의 글 `id`는
  `0`, `url`은 `"(dry-run)"`으로 표시됩니다). `--publish`와 함께 써도 실제 발행은 되지
  않습니다.
- **`schedule`**은 항상 `status: future` + 지정 시각으로 등록되며 `--publish` 플래그를 받지
  않습니다(예약 자체가 미래 발행이므로 별도 옵션이 필요 없습니다).
- **`add-seo`/`batch-update-meta`**는 발행 상태를 바꾸지 않고 메타 필드만 갱신합니다.

## 7. 실행 로그

모든 CLI 실행은 `wordpress-publisher/logs/run-<ISO 타임스탬프>.jsonl` 파일에 한 줄(JSON)씩
기록됩니다(예: `logs/run-2026-09-23T01-02-03-000Z.jsonl`). `logs/`는 `.gitignore`에 포함되어
커밋되지 않습니다.

각 줄은 다음 필드를 가진 JSON 객체입니다:

```json
{"timestamp":"2026-09-23T01:02:03.456Z","action":"create","input":{...},"status":"success","postId":123,"url":"https://molespapa.com/?p=123"}
```

- `action`: 실행한 명령 이름 (`create`/`update`/`add-seo`/`schedule`/`batch-create`/`batch-update-meta`)
- `input`: 그 행/명령에 사용된 입력 값
- `status`: `success` 또는 `error`
- `postId`, `url`: 성공 시 WordPress가 반환한 글 ID/링크
- `error`: 실패 시 에러 메시지

`batch-create`/`batch-update-meta`는 파일의 각 행마다 한 줄씩 기록되므로, 몇 번째 행이
실패했는지 로그로 확인할 수 있습니다. CLI 종료 시 콘솔에도 `성공 N / 실패 M` 요약이
출력됩니다.

## 8. 테스트 / 타입체크

```bash
npx vitest run
npx tsc --noEmit
```
