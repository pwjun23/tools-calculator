// 실제 키로 한 번 불러 응답 모양을 확인한다. 키는 출력하지 않는다.
// 실행: npx tsx --env-file=.env.local scripts/where-to-move/probe-juso.ts
import { coordOf, searchAddress } from "../../lib/whereToMove/juso";

const search = process.env.JUSO_SEARCH_KEY?.trim();
const coord = process.env.JUSO_COORD_KEY?.trim();
if (!search) throw new Error("JUSO_SEARCH_KEY 가 .env.local 에 없습니다");
const [c] = await searchAddress("경기도 김포시 사우중로 1", search);
console.log("검색 첫 후보:", c ?? "(없음)");
console.log("지번 검색:", (await searchAddress("경기도 김포시 풍무동 936", search))[0]?.roadAddr ?? "(없음)");
console.log("없는 주소:", (await searchAddress("가상시 없는로 99999", search)).length, "건");
if (!coord) console.log("JUSO_COORD_KEY 없음 — 좌표 확인은 건너뜀");
else if (c) console.log("김포시청 좌표(기대 약 37.615, 126.716):", await coordOf(c, coord));
