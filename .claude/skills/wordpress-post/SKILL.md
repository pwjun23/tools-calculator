---
name: wordpress-post
description: Draft a blog post for tools.molespapa.com (WordPress) in this chat and publish or update it via the wordpress-publisher CLI's REST API integration — creating drafts, publishing immediately, scheduling, or editing an existing post by ID. Use this whenever the user wants to write a post and get it onto the blog, asks to "포스팅해줘"/"블로그에 올려줘"/"글 발행해줘"/"워드프레스에 올려줘", wants a calculator (salary/freelancer/car/jeonse/jeonse-vs-loan) linked from a post, needs images with alt text placed inline, wants related posts linked automatically, or wants to update/edit a post that's already live — even if they don't mention the CLI or REST API by name.
---

# WordPress 포스팅

이 채팅을 "포스팅 창"으로 써서 tools.molespapa.com(WordPress)에 글을 쓰고 그대로 REST API로
올리거나, 이미 올라간 글을 수정한다. 실제 업로드는 `wordpress-publisher/` CLI가 처리하므로,
이 스킬의 역할은 대화에서 필요한 정보를 모아 그 CLI가 이해하는 형태로 넘겨주는 것이다.

## 준비 확인

`wordpress-publisher/.env`에 `WP_USERNAME`/`WP_APP_PASSWORD`가 없으면 CLI가 곧바로 에러를
던진다. 처음 쓰는 세션이면 파일 존재 여부만 조용히 확인하고, 없으면
`wordpress-publisher/README.md`의 "2. WordPress 자격증명 준비" 절차를 사용자에게 안내한 뒤
계속한다 — 자격증명 자체를 대신 발급하거나 추측하지 않는다.

## 정보 수집

글을 쓰기 전에 대화로 자연스럽게 채운다. 사용자가 이미 준 정보는 다시 묻지 않는다.

- **제목, 카테고리, 태그** — 카테고리/태그를 생략하면 `wordpress-publisher/config.json`의
  기본값이 쓰인다.
- **본문** — 시맨틱 HTML로 직접 작성한다(`<p>`, `<h2>`, `<ul>` 등). 사용자가 러프한 텍스트나
  개요만 주면, 이 스킬을 쓰는 이유가 바로 그 초안을 완성된 글로 다듬어 주는 것이므로 알아서
  문단을 나누고 소제목을 붙여 완성한다.
- **이미지** — 사용자가 이미지 URL을 주면 반드시 `alt` 텍스트를 같이 정한다(비어 있으면 CLI가
  업로드 전에 에러를 던진다). 본문 중간 특정 위치에 넣고 싶다면 그 자리에 `{{image}}` 마커를
  써넣는다 — 마커 개수만큼 앞에서부터 이미지가 채워지고, 남는 이미지는 본문 끝에 자동으로
  붙는다. 마커가 이미지보다 많으면 에러이므로 마커 개수 ≤ 이미지 개수를 지킨다.
- **계산기 연동** — 글 내용이 이 사이트의 계산기(연봉/프리랜서/자동차/전세이자/전세vs대출)와
  관련 있으면 `calculator` 슬러그(`salary`/`freelancer`/`car`/`jeonse`/`jeonse-vs-loan`, 앞에
  `/`를 붙여 `/jeonse-vs-loan`처럼 써도 된다)를 넣을지 물어본다. 본문의 특정 위치(예: "아래
  계산기로 비교해보세요" 바로 뒤)에 넣고 싶으면 그 자리에 `{{calculator}}` 마커를 쓴다 — 없으면
  본문 끝에 자동으로 붙는다. `/calculator/jeonse-vs-loan`처럼 다른 경로 조각이 섞이면 여전히
  에러이니, 사이트 실제 주소(`tools.molespapa.com/<슬러그>`)와 똑같이 쓴다.
- **슬러그** — 사용자가 한글 SEO 슬러그를 원하면 `slug` 필드로 지정한다(생략하면 워드프레스가
  제목에서 자동으로 만든다).
- **관련 글** — 명시적으로 링크하고 싶은 글이 있으면 `internalLinks`로 직접 준다. 없지만
  주제와 관련된 검색어가 있으면 `seo.relatedKeywords`만 채워도 된다 — 실제 발행 시 그
  키워드로 기존 워드프레스 글을 검색해 "함께 보면 좋은 글" 섹션을 자동으로 채운다(단
  `--dry-run`에서는 검색하지 않는다).
- **SEO** — `focusKeyword`, `metaDescription`을 자연스럽게 제안한다(글 내용에서 뽑아낼 수
  있으면 먼저 제안하고 확인만 받는다).
- **발행 방식** — 초안(draft, 기본값) / 즉시 발행(publish) / 예약(schedule, KST
  `"YYYY-MM-DD HH:mm"`) 중 어느 것인지 확실히 정한다. **명시적으로 "발행해줘"/"publish"라고
  하지 않는 한 항상 draft로 만든다** — 초안으로 올려두고 나중에 검토 후 발행하는 편이 되돌릴
  수 없는 실수보다 낫다.
- **기존 글 수정인가?** — "이미 올라간 글 고쳐줘" 같은 요청이면 새 글이 아니라 수정이다. 글
  ID를 모르면 사용자에게 물어보거나, `wordpress-publisher/src/cli.ts`가 목록 조회 명령을
  제공하지 않으므로 WordPress 관리자 화면에서 확인해 달라고 요청한다.

각 필드의 정확한 스키마와 타입은 `wordpress-publisher/README.md`의 5절(CSV/JSON 스키마)과
5-1절(calculator/images/internalLinks/relatedKeywords 자동 보강 규칙)에 전부 정리돼 있다 —
헷갈리면 그 문서를 다시 읽는다.

## claude.ai에서 초안을 받았을 때

사용자가 다른 claude.ai 채팅에서 쓴 초안(JSON이든 텍스트든)을 붙여넣는 경우가 많다. 그 초안은
이 CLI의 실제 스키마를 모르고 쓰였을 수 있으므로, 그대로 실행하지 말고 아래를 먼저 확인한다.

- **`id`/`action: "UPDATE"` 같은 필드가 있으면** — 진짜 molespapa.com에 올라가 있는 글의
  워드프레스 글 ID인지 반드시 확인한다. claude.ai 쪽에서 임의로 붙인 초안 번호(예: `id: 1`)일
  수 있다 — 확실하지 않으면 새 글(`create`/`schedule`)인지 진짜 수정(`update --id`)인지
  사용자에게 직접 물어본다.
- **이미지가 실제 URL이 아니라 주제/설명만 있으면**(`image_subjects: ["부동산 비교", ...]`
  같은 형태) — 이 CLI는 이미지를 생성하거나 찾아주지 않는다. 실제 이미지 URL과 alt 텍스트를
  요청하거나, 없으면 이미지 없이 먼저 올릴지 물어본다.
- **본문에 `{{image}}`/`{{calculator}}`가 아닌 다른 형태의 자리표시자가 있으면**(예: 중괄호
  하나짜리 `{calculator_id}`, `[IMAGE_HERE]` 같은 것) — 그대로 두면 그 글자가 실제 발행물에
  그대로 노출된다. 의도를 파악해서 이 CLI가 실제로 지원하는 `{{image}}`/`{{calculator}}` 마커로
  바꾸거나, 마커가 지원하지 않는 위치 지정이면 사용자에게 알리고 대안(본문 끝에 붙이기, 또는
  마커를 새로 지원하도록 코드를 고치는 것)을 상의한다.

## 실행 절차

1. **JSON으로 정리한다.** 여러 항목을 한 번에 묻기보다, 모은 정보를
   `wordpress-publisher/README.md`의 `PostInput` 스키마 형태로 정리해 사용자에게 먼저
   보여주고 확인받는다(예: "이렇게 올릴게요" + JSON 블록). 파일로 쓸 필요는 없다 — 새 글
   하나면 `create`/`schedule`의 CLI 플래그로 바로 넘겨도 되고, 이미지·internalLinks처럼
   구조가 있는 배열이 필요하면 `wordpress-publisher/posts.json` 같은 임시 파일을 만들어
   `batch-create --file`로 넘긴다(끝나면 지운다).
2. **반드시 `--dry-run`으로 먼저 실행한다.** `cd wordpress-publisher &&
   WP_USERNAME=... WP_APP_PASSWORD=... npm run cli -- create --title "..." --dry-run` 형태로
   실제 요청을 보내지 않고 조립된 본문·메타를 미리 본다(환경변수는 보통 `.env`에 이미 있으니
   직접 줄 필요는 없다 — CLI가 `dotenv/config`로 읽는다). `{{image}}` 치환, calculator CTA,
   관련 글 섹션이 원하는 대로 들어갔는지 결과를 사용자에게 보여준다.
3. **사용자 확인 후에만 실제로 실행한다.** dry-run 결과를 보여주고 승인을 받은 다음
   `--dry-run`을 빼고 다시 실행한다. 즉시 발행이면 `--publish`를 추가한다.
4. **결과를 보고한다.** 반환된 글 ID/URL과 최종 상태(draft/publish/future)를 사용자에게
   알려준다. draft로 올렸다면 그 사실을 분명히 언급한다 — 사용자가 "다 됐다"고 착각해서
   비공개 초안을 공개된 걸로 오해하지 않게 한다.
5. **글 수정은 `update --id <id>`로 같은 흐름을 따른다.** 본문을 바꾸려면
   `--content`/`--content-file`을 반드시 같이 준다 — `calculator`/`images`/`internalLinks`는
   본문 없이 단독으로 주면 에러가 난다(어디에 이어붙일지 알 수 없기 때문). 제목/카테고리/
   태그/SEO만 바꾸는 거라면 본문 없이 그 필드만 줘도 된다. 이미 있는 글을 특정 시각에
   (재)발행되도록 예약하려면 `--publish-at "YYYY-MM-DD HH:mm"`(KST)을 준다 — 상태를 `future`로
   바꾸며, 과거 시각이면 에러가 난다.

## 하지 말아야 할 것

- 사용자가 명시적으로 요청하지 않았는데 `--publish`를 붙이지 않는다.
- dry-run 없이 곧바로 실제 요청을 보내지 않는다 — 조립된 HTML(특히 `{{image}}` 치환 결과와
  자동 검색된 관련 글 목록)은 실제로 눈으로 확인하기 전까지 예측하기 쉽지 않다.
- `wordpress-publisher/.env`의 자격증명을 대화에 그대로 출력하거나 로그로 남기지 않는다.
