# 학교 등하원 어림값 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (사용자가 Native 선택). Steps use checkbox (`- [ ]`) syntax.

**Goal:** 설정에 학교를 최대 4곳(학교마다 수단 여러 개) 넣고, 거래 카드에 장소별 어림 시간 줄·길찾기를 보여 주며 장소별 필터로 거른다.

**Architecture:** 어림값·필터는 `lib/whereToMove/commute.ts` 순수 함수로 일반화한다(장소 `Place`, 수단 `TripMode`). 설정은 `schools` 필드를 추가한다. 페이지가 직장+학교를 `places`로 만들고 거래마다 `trips`를 붙인다. 주소 검색 UI는 직장·학교가 같이 쓰는 `AddressSearch`로 뺀다.

**Tech Stack:** Next 16, React, zod 4, vitest.

**Spec:** `docs/superpowers/specs/2026-10-17-where-to-move-schools-design.md`

## Global Constraints
- 학교 최대 4곳(`MAX_SCHOOLS = 4`), 수단 `walk | shuttle | car | transit`, 1개 이상·중복 없음.
- 도보 시속 3~4km, 통학차량 = 자가용 [최솟값×1.5, 최댓값×2], 5분 단위, 최솟값 최소 5분. car·transit 은 `estimateCommute`와 같은 값.
- 필터 값 `{id}:{mode}:{max}`, 직장 시간 30·45·60·90·120, 학교 10·15·20·30. 최솟값 기준, trips null 은 숨기지 않음.
- 카카오 결과는 어디에도 저장하지 않는다(DB·로컬스토리지 X).
- 테스트는 가상 값만.

## Review Focus
1. 학교를 지운 뒤 필터 값이 없는 장소를 가리킬 때 → `전체`로 동작.
2. 수단 체크를 모두 해제하려 할 때 → 마지막 하나는 해제되지 않음(저장 오류 방지).
3. 좌표를 못 구한 장소(카카오 실패)만 빠지고 나머지 장소 줄은 보임.
4. 예전 설정(schools 없음) → `[]`, valid 유지.
5. 장소 0개 → 통근 UI 전부 숨김.

---

### Task 1: commute.ts 일반화
**Files:** Modify `lib/whereToMove/commute.ts`, `lib/whereToMove/commute.test.ts`

**Produces:**
- `type TripMode = "walk" | "shuttle" | "car" | "transit"`, `TRIP_MODES: TripMode[]`(표시 순서), `TRIP_ICON: Record<TripMode, string>`
- `type Trip = { km: number; times: Partial<Record<TripMode, [number, number]>> }`
- `estimateModes(km: number, modes: TripMode[]): Trip`
- `type Place = LatLng & { id: string; kind: "work" | "school"; label: string; modes: TripMode[] }`
- `tripChoices(places: Place[]): { label: string; options: { value: string; label: string }[] }[]`
- `parseTripChoice(v: string, places: Place[]): { id: string; mode: TripMode; max: number } | null`
- `passesTrip(trips: (Trip & { id: string })[] | null, c: ReturnType<typeof parseTripChoice>): boolean`
- `kakaoRouteUrl(by: "traffic" | "car" | "walk", …)`
- `commuteHelp()` 문구 갱신. `COMMUTE_CHOICES`·`parseCommuteChoice`·`passesCommute`·`CommuteMode` 삭제.

- [ ] 테스트: estimateModes(도보 0.6km → [5,5]? 계산값, 2km, shuttle = car×1.5~2, car/transit = estimateCommute, 고른 수단만), tripChoices(직장 2수단×5, 학교 수단×4, 그룹 label), parseTripChoice(정상, 없는 장소, 장소에 없는 수단, 틀린 형식 → null), passesTrip(최솟값 기준, null 통과, 없는 장소 통과), kakaoRouteUrl walk, commuteHelp 도보·통학차량 문장 → RED
- [ ] 구현 → GREEN, 커밋

### Task 2: settings.schools
**Files:** Modify `lib/whereToMove/settings.ts`, `settings.test.ts`
- `MAX_SCHOOLS`, `SCHOOL_MODES`, `School` 타입, `schools` 기본 `[]`.
- [ ] 테스트(0·4 허용, 5 거부, modes 빈·중복·모르는 값 거부, 좌표 하나 거부, 예전 설정 []) → RED → 구현 → GREEN, 커밋

### Task 3: page.tsx — places·trips
**Files:** Modify `app/whereToMove/page.tsx`, `app/whereToMove/DealBoard.tsx`(Deal 타입)
- `Deal.trips?: (Trip & { id: string })[] | null`, `Deal.pos?: LatLng`, `Deal.site`. `commute` 삭제.
- places: 직장 `w`(transit, car), 학교 `s{i}`(고른 수단). 좌표 없으면 임시 카카오로 주소 조회, 실패하면 뺀다.
- tsc 로 확인, 커밋은 Task 4와 함께.

### Task 4: DealBoard — 장소별 줄·링크·필터
**Files:** Modify `app/whereToMove/DealBoard.tsx`
- props `places?: Place[]`. 줄: 장소마다 `{label} {km} · {icon} 약 a~b분…`, ⓘ 첫 줄. 위치 없음 한 줄. 링크: 직장 🚇·🚗, 학교 `{label} 길찾기`(walk 또는 car). 필터 select + optgroup.
- [ ] tsc·lint·build, 커밋

### Task 5: 설정 화면 학교 섹션
**Files:** Create `app/whereToMove/settings/AddressSearch.tsx`, `app/whereToMove/settings/SchoolPicker.tsx`; Modify `WorkplacePicker.tsx`, `SettingsForm.tsx`
- `AddressSearch({ placeholder, onPick(c, at) })`: 검색·후보·좌표 액션 호출(직장 코드에서 이동).
- `SchoolPicker({ value, onChange, errors })`: 학교별 이름·주소·수단 체크(마지막 하나 해제 불가)·삭제, 4곳 미만이면 AddressSearch.
- 수단 토글 순수 함수 `toggleMode(modes, m)`를 `lib/whereToMove/commute.ts`에 두고 테스트(마지막 하나 유지, 순서 TRIP_MODES).
- [ ] 테스트 RED → 구현 → 전체 테스트·tsc·lint·build, 커밋

### Task 6: 최종 리뷰
- review-package → opus 리뷰어 → Critical/Important 한 번에 수정.
