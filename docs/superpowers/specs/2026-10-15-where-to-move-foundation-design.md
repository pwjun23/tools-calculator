# 이사 실거래 모아보기(whereToMove) 1단계: 기반 — 설계

- 상태: 검토 대기 (설계 대화 승인 2026-10-15, 문서 검토 전)
- 대상: `tools.molespapa.com/whereToMove` (Vercel에 배포된 이 Next.js 앱)
- 위치: 이 앱의 `app/whereToMove/`, `app/api/where-to-move/`, `lib/whereToMove/`, `proxy.ts`
- 이 저장소는 **공개 저장소**다. 사용자의 실제 소득·대출·자산 값은 코드, 테스트, 문서, 커밋 어디에도 넣지 않는다.

## 1. 배경과 목적

지금 구조는 Google Sheet(조건·내자산부채 입력) + Apps Script(국토부 실거래 수집, 판정, 카카오톡
"나에게 보내기", 웹앱 JSON) + 이 앱의 `/whereToMove`(목록 화면)다. 조건을 시트에서만 바꿀 수 있고,
사용자가 한 명으로 고정되어 있으며, 대상 지역이 코드에 김포로 박혀 있다.

전체 목표는 네 단계다.

1. **기반 (이 문서)**: 조건·판정·수집·알림을 이 앱과 DB로 옮기고, 웹에서 조건을 설정한다.
2. 지역 확장: 수도권 시·군·구를 공용으로 수집하고 사용자가 지역을 고른다.
3. 통근 기준: 사용자가 기준 장소를 여러 개(기본값 도심·강남·여의도) 두고, 켜진 장소 중 가장 먼 곳까지의
   대중교통 시간이 N분 이내인 지역을 후보로 삼는다.
4. 공개: 가입 개방, 카카오 비즈 앱 검수, 개인정보 처리방침, 사용량 제한.

1단계는 실제 사용자는 운영자 가족(허용 목록)뿐이지만, 데이터 구조는 처음부터 여러 사용자를 전제로 만든다.
2~4단계는 각각 별도 설계 → 계획 → 구현을 거친다.

## 2. 범위

**포함**
- 카카오 로그인 (허용된 카카오 ID만 입장)
- 웹 설정 화면: 현재 `조건`·`내자산부채` 시트의 입력 항목 전체
- 공용 거래 수집 (매일 1회, 1단계 대상은 김포시 `41570`)
- 화면을 열 때 사용자 조건으로 즉시 판정 (판정 결과를 저장하지 않음)
- 사용자별 주간 카카오톡 "나에게 보내기"
- 현재 시트 값 1회 이전, Apps Script와 병행 운영 후 전환

**제외**
- 지역 확장, 통근 시간 (2·3단계)
- 공개 가입, 비즈 앱 검수 (4단계)
- 시트의 `매물점검`·`월세표`·`한도계산` 화면 이전 (설정 화면의 계산 결과 요약으로 대신하고, 필요하면 나중에)
- 판정 결과 저장, "기록 다시 판정" 기능 (즉시 판정이라 필요 없음)

## 3. 결정된 사항 (사용자 승인)

| 항목 | 결정 |
|---|---|
| 전체 구조 | A안: Next.js(이 앱) + Postgres. Apps Script·시트는 전환 기간 뒤 정리 |
| DB | Vercel Marketplace의 Neon Postgres |
| 인증 | 카카오 OAuth를 지원하는 인증 라이브러리(Better Auth 예정). 카카오 refresh token을 우리 DB가 보관해야 하므로 외부 인증 SaaS(Clerk, Auth0)는 쓰지 않음 |
| 알림 | 사용자별 카카오 로그인 토큰으로 "나에게 보내기" |
| 통근 기준(3단계) | 기준 장소 여러 개, 기본값 도심·강남·여의도 |
| 공개 범위(4단계) | 공개 서비스 |
| 판정 시점 | 저장하지 않고 요청마다 계산 |
| 조건 저장 | 사용자당 1행, JSON 한 칸 + 코드에서 스키마 검증 |

## 4. 구조

```
[Vercel Cron 매일 06시 KST]   → GET /api/where-to-move/cron/collect → 국토부 API → wtm_deals
[Vercel Cron 월요일 08시 KST] → GET /api/where-to-move/cron/notify  → 사용자별 판정 → 카카오 나에게 보내기
[브라우저] /whereToMove (목록) · /whereToMove/settings (설정) · /whereToMove/login (카카오 로그인)
                              ↓ 읽기/쓰기
                    Postgres(Neon): 인증 표 · wtm_settings · wtm_deals · wtm_notify_log
```

### 모듈

| 파일 | 하는 일 | 의존 |
|---|---|---|
| `lib/whereToMove/settings.ts` | 설정 타입, 기본값, 검증(범위·필수값) | 없음 |
| `lib/whereToMove/judge.ts` | `deriveParams(설정)`, `evaluateDeal(params, 거래)`, `filterDeals(설정, 거래들)` | 없음 (순수 함수) |
| `lib/whereToMove/molit.ts` | 국토부 API 호출, XML 파싱, 거래 정규화(해제·갱신 표시 포함) | fetch |
| `lib/whereToMove/message.ts` | 주간 메시지 문자열 생성 (200자 제한, 적합 상위 3건) | 없음 |
| `lib/whereToMove/kakao.ts` | access token 갱신, 나에게 보내기 | fetch |
| `lib/whereToMove/db.ts` | 표 정의와 조회·저장 함수 | DB 클라이언트 |
| `lib/whereToMove/auth.ts` | 인증 라이브러리 설정(카카오, 허용 목록, 토큰 암호화) | 인증 라이브러리 |

화면과 Cron 주소는 이 모듈만 조합한다. 판정·파싱·메시지는 DB·네트워크 없이 테스트할 수 있어야 한다.

## 5. 데이터 모델

| 표 | 열 (주요) | 비고 |
|---|---|---|
| 인증 표 (user, account, session 등) | 인증 라이브러리 스키마를 따름 | `account`에 카카오 access/refresh token, 만료 시각, 동의 범위 저장. 토큰은 암호화 |
| `wtm_settings` | `user_id` PK, `data` jsonb, `updated_at`, `last_notified_at`, `notify_enabled` | `data`는 6장의 설정 스키마 |
| `wtm_deals` | `deal_key` PK, `type`(매매/전세/월세), `sgg_cd`, `dong`, `apt`, `area`(반올림), `area_raw`, `floor`, `deal_date`, `amount`, `rent`, `renewal`, `cancelled`, `first_seen_at`, `updated_at` | 모든 사용자 공용. `deal_key`는 현재 Apps Script 키 형식(`유형|단지|동|면적|층|계약일|금액|월세`)을 그대로 쓴다 |
| `wtm_notify_log` | `id`, `user_id`, `sent_at`, `new_count`, `ok_count`, `status`, `error` | 실패 원인 추적용 |

- 갱신 계약과 최소 면적은 **수집할 때 거르지 않고** 저장한 뒤, 보여 줄 때 사용자 설정으로 거른다.
- 해제 거래: 매일 최근 2개월을 다시 수집하면서 해제 표시(`cdealType = 'O'` 또는 해제일 있음)가 보이면
  `cancelled = true`로 갱신한다. 목록과 알림에서 제외한다.

## 6. 설정 스키마 (`wtm_settings.data`)

금액은 만원, 비율은 0~1 소수, 기간은 년.

- **지역**: `regions: [{ sggCd, dongs: string[] }]` — 1단계 기본값 김포 `41570`의 구래동·마산동·양촌읍
- **기본**: `cash`, `monthlyBudget`, `monthlyMgmt`, `minArea`, `excludeRenewal`
- **매매**: `mortgageRate`, `mortgageYears`, `ltvBuy`, `buyFeeRate`, `mortgageCap`
- **전세·보증금**: `rentLoanRate`, `ltvRent`, `rentLoanCap`
- **소득·DSR**: `annualIncome`(0이면 DSR 계산 생략), `dsrRatio`
- **기존 대출 목록**: `[{ name, balance, rate, years, repayment: 'amortizing' | 'bullet', repaidIfHomeSold }]`
- **보유 주택**: `ownedHome: { has, price, sellCostRate, planOnMove: 'keep' | 'sell', rentLoanAllowedIfKept, mortgageAllowedIfKept }`

검증에 실패하면 저장하지 않고 항목별 오류를 화면에 보여 준다.

## 7. 판정 계산 (`judge.ts`)

`deriveParams(설정)`은 현재 시트의 "계산값"을 그대로 재현한다.

| 값 | 계산 |
|---|---|
| 관리비 제외 월 가용액 | `max(monthlyBudget - monthlyMgmt, 0)` |
| 월 상환계수 | 원리금균등. 금리 0이면 `1 / (years × 12)` |
| 기존 대출 월 상환액 | 원리금균등 대출은 월 원리금, 만기일시는 월 이자. 보유 주택을 팔고 `repaidIfHomeSold`인 대출은 0 |
| 매도 시 추가 현금 | `planOnMove = 'sell'`이면 `max(price × (1 - sellCostRate) - 매도 시 갚는 대출 잔액, 0)` |
| 적용 현금 | `cash + 매도 시 추가 현금` |
| 월 대출 상환 한도 | 소득이 있으면 `min(월 가용액, (annualIncome × dsrRatio - 기존 대출 월 상환액 × 12) / 12)` (음수는 0), 없으면 월 가용액 |
| 적용 매매 대출 비율 | 보유 주택을 유지하고 `mortgageAllowedIfKept = false`면 0, 아니면 `ltvBuy` |
| 적용 전세 대출 비율 | 보유 주택을 유지하고 `rentLoanAllowedIfKept = false`면 0, 아니면 `ltvRent` |

`evaluateDeal(params, 거래)`은 현재 Code.gs `evaluateDeal_`과 같다.

- 매매: 필요 대출 `= max(금액 × (1 + 부대비용률) - 적용 현금, 0)`. 대출 비율(`≤ 금액 × 적용 매매 비율`)과
  주담대 최대 금액을 검사한다. 월 비용은 `대출 × 상환계수`다.
- 전세·월세: 필요 대출 `= max(보증금 - 적용 현금, 0)`. 대출 비율과 보증기관 한도를 검사한다.
  월 비용은 `대출 × 금리 / 12`다.
- 월 부담 `= (월세면 월세) + 관리비 + 월 비용`이다. DSR(`월 비용 ≤ 월 상환 한도`)과 예산(`월 부담 ≤ 월 총 예산`)을 검사한다.
- 결과: `ok`, `loan`, `monthly`, `margin`, `reasons`(대출 한도 초과 / 대출 비율 초과 / DSR 초과 / 예산 초과).

화면으로 내보내는 결과에는 지금처럼 사용자 조건 수치(현금, 소득, 비율, 한도)를 넣지 않는다. 필요 대출,
월 부담, 여유, 사유 이름만 내보낸다.

## 8. 수집

- `GET /api/where-to-move/cron/collect`: `Authorization: Bearer ${CRON_SECRET}`가 맞을 때만 실행한다.
- 대상 시·군·구는 모든 사용자 설정의 `regions[].sggCd`를 합친 것이다(1단계는 `41570`).
- 시·군·구마다 매매·전월세 API × 이번 달·지난달을 호출한다. 응답 전체를 `deal_key` 기준으로
  upsert한다. 새 행은 `first_seen_at = now()`이고, 기존 행은 `cancelled`·`updated_at`만 갱신한다.
- 공공데이터 키는 `DATA_GO_KR_KEY`(전월세 키가 다르면 `DATA_GO_KR_KEY_RENT`)를 쓴다.
  Decoding/Encoding 키 처리는 현재 Apps Script `apiKeyParam_`과 같다.
- 실패하면 로그만 남긴다. 다음 날 최근 2개월을 다시 받으므로 빠지는 거래는 없다.

## 9. 주간 알림

- `GET /api/where-to-move/cron/notify`: `CRON_SECRET`으로 보호한다. 월요일 08시 KST(`0 23 * * 0` UTC)에 실행한다.
- `notify_enabled`인 사용자마다 다음을 한다.
  1. `first_seen_at > last_notified_at`이고 해제되지 않았으며 사용자 지역·면적·갱신 조건에 맞는 거래를 고른다.
  2. 판정하고 메시지를 만든다. 형식은 현재와 같다:
     `[{지역} 주간] 신규 신고 N건 (매매 a, 전세 b, 월세 c)` + 예산 적합 건수 + 적합 상위 3건, 200자 제한.
  3. 카카오 refresh token으로 access token을 받는다. 새 refresh token이 오면 저장한다.
  4. 나에게 보내기를 한다. 버튼은 `https://tools.molespapa.com/whereToMove`다.
  5. **성공했을 때만** `last_notified_at`을 갱신하고, 결과를 `wtm_notify_log`에 남긴다.
- 한 사용자가 실패해도 다음 사용자는 계속 처리한다.
- 카카오 토큰이 만료되거나 동의가 철회되면 로그에 남기고, 웹 화면에 "카카오 다시 연결" 안내를 띄운다.
- 처음 알림을 켠 사용자는 `last_notified_at`을 켠 시각으로 둔다(과거 거래를 한꺼번에 보내지 않음).

## 10. 화면

- **`/whereToMove/login`**: "카카오로 로그인" 버튼. 동의 항목은 닉네임, 카카오톡 메시지 전송이다.
  허용 목록에 없는 계정은 "준비 중입니다" 안내를 띄우고 세션을 만들지 않는다.
- **`/whereToMove`**: 현재 목록 화면(필터, 카드, 네이버·호갱노노 링크, 다크모드)을 유지한다. 데이터는 서버에서 DB를 읽어
  사용자 설정으로 걸러 판정한 뒤 넘긴다. 요청마다 렌더링하므로 10분 캐시와 "새로 받기" 버튼은 없앤다.
  상단에 설정 화면 링크를 둔다.
- **`/whereToMove/settings`**: 6장의 항목을 묶음별로 입력한다. 저장 버튼 옆에 계산 결과(월 가용액, DSR 월 한도,
  적용 현금, 적용 대출 비율, 전세금 상한, 매매가 상한)를 보여 준다. 상한 계산은 현재 `한도계산` 시트와 같다.
  알림 켜기/끄기도 여기에 둔다.
- 로그인하지 않은 요청은 `proxy.ts`가 `/whereToMove/login`으로 보낸다. 기존 `/admin` 보호는 그대로 둔다.

## 11. 보안·개인정보

- 허용 목록: `WTM_ALLOWED_KAKAO_IDS`(쉼표 구분) 환경변수.
- 설정(소득, 대출, 자산)은 서버에서 본인 것만 읽고 쓴다. 다른 사용자의 설정을 읽는 경로를 만들지 않는다.
- 카카오 토큰은 암호화해 저장한다. 인증 라이브러리의 토큰 암호화 옵션을 쓰고, 없으면 `WTM_TOKEN_KEY`로 AES-GCM 암호화한다.
- Cron 주소는 `CRON_SECRET`으로만 호출할 수 있다.
- 공개 저장소이므로 테스트 픽스처는 가상의 값만 쓴다. 실제 시트 값과의 비교는 로컬 스크립트로만 하고, 그 입력과 결과는 커밋하지 않는다.
- 전환이 끝나면 `GIMPO_USER`/`GIMPO_PASS` 폼 로그인, `GIMPO_API_URL`/`GIMPO_API_TOKEN` 호출,
  `/api/where-to-move/revalidate`를 삭제한다.

## 12. 환경변수

| 이름 | 용도 |
|---|---|
| `DATABASE_URL` 등 | Neon 연결 (Marketplace가 자동 설정) |
| 인증 라이브러리 비밀값 (예: `BETTER_AUTH_SECRET`) | 세션 서명 |
| `KAKAO_CLIENT_ID`, `KAKAO_CLIENT_SECRET` | 카카오 OAuth (현재 Apps Script와 같은 카카오 앱) |
| `WTM_ALLOWED_KAKAO_IDS` | 1단계 허용 목록 |
| `DATA_GO_KR_KEY`, `DATA_GO_KR_KEY_RENT`(선택) | 국토부 API |
| `CRON_SECRET` | Cron 주소 보호 |
| `WTM_TOKEN_KEY` (필요할 때만) | 토큰 암호화 |

## 13. 테스트

- `judge.test.ts`: 가상 설정으로 계산값과 판정을 검증한다. 시트 수식과 같은 결과가 나오는 기준 사례를 포함하고,
  보유 주택 유지/매도, 소득 0, 금리 0, 대출 0 같은 경계도 다룬다.
- `molit.test.ts`: 저장해 둔 API 응답 XML(가상의 거래로 만든 것)로 파싱, 동 필터, 해제·갱신 표시를 검사한다.
- `message.test.ts`: 200자 자르기, 적합 상위 3건 선택을 검사한다.
- `settings.test.ts`: 검증 규칙(범위, 필수값, 기본값)을 검사한다.
- Cron 주소: 비밀값이 없거나 틀리면 401이 나오는지 검사한다.
- 로컬 전용 비교 스크립트: 실제 시트의 설정과 `거래기록`을 읽어 `judge.ts` 결과와 한 건씩 비교한다(커밋하지 않는 파일로 입력).

## 14. 전환 순서

1. Neon 연결(Marketplace), 표 생성, 카카오 앱에 리다이렉트 URI(`https://tools.molespapa.com/api/auth/callback/kakao`, 로컬 개발용 주소)와
   동의 항목 추가. 콘솔 작업은 사용자가 한다.
2. 로그인, 설정, 목록, 수집을 배포한다. 현재 시트 값을 한 번만 DB에 넣는다(코드·git에 남기지 않음).
   기존 폼 로그인은 이 시점에 카카오 로그인으로 바뀐다.
3. 알림을 배포한다. 1~2주 동안 Apps Script 카톡과 새 카톡을 함께 받으며 건수와 판정을 비교한다.
4. 결과가 같으면 Apps Script 트리거를 끈다. 시트는 기록용으로 남긴다. 11장의 옛 경로와 환경변수를 삭제한다.

## 15. 열린 질문 (계획 단계에서 확인)

- 인증 라이브러리의 카카오 지원 여부, Next 16과의 호환성, 토큰 암호화 옵션 (Better Auth 문서·패키지 확인)
- DB 접근 방식(ORM·쿼리 빌더)과 표 생성(마이그레이션) 방식
- 이 프로젝트의 Vercel 요금제와 Cron 개수·주기 제한
