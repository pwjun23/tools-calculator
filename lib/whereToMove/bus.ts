import { excludedKey } from "./exclude";
import type { BusRoute } from "./settings";

/** 통학버스: 정류장 붙여넣기 해석, 정류장 이름으로 단지 추천, 단지별 탑승 줄. */
type AptRef = { sggCd: string; dong: string; apt: string };

const TIME = /(\d{1,2}):(\d{2})$/;

/** 한 줄에 '정류장 이름 시각'. 앞 번호(1, 1., 1))와 탭은 정리한다. */
export function parseStops(text: string): { stops: { name: string; time: string }[]; errors: string[] } {
  const stops: { name: string; time: string }[] = [];
  const errors: string[] = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.replace(/\t/g, " ").trim();
    if (!line) return;
    const m = line.match(TIME);
    const h = m ? Number(m[1]) : NaN;
    const min = m ? Number(m[2]) : NaN;
    const name = m ? line.slice(0, m.index).replace(/^\d+[.)]?\s+/, "").trim() : "";
    if (!m || h > 23 || min > 59 || !name) {
      errors.push(`${i + 1}번째 줄: 끝에 시각(예: 08:02)이 없습니다`);
      return;
    }
    stops.push({ name: name.slice(0, 40), time: `${String(h).padStart(2, "0")}:${m[2]}` });
  });
  return { stops, errors };
}

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
/** 탑승 → 도착 분. 도착이 앞서면 null. */
export function minutesBetween(from: string, to: string): number | null {
  const d = toMin(to) - toMin(from);
  return d >= 0 ? d : null;
}

// 정류장 이름에 붙는 말과 국토부·안내문 표기 차이.
const NOISE = /아파트|버스정류장|정류장|정문|후문|입구|건너편|우회전|차로|[\s(),.·\-]/g;
const norm = (s: string) => s.toLowerCase().replace(/이편한/g, "e편한").replace(/엘에이치/g, "lh").replace(NOISE, "");
const bigrams = (s: string) => new Set(Array.from({ length: Math.max(0, s.length - 1) }, (_, i) => s.slice(i, i + 2)));

/** 정류장 이름과 글자 두 개 묶음이 많이 겹치는 단지 순. 확정은 사용자가 한다. */
export function suggestApts<T extends AptRef>(stop: string, list: T[], n = 5): T[] {
  const want = bigrams(norm(stop));
  if (!want.size) return [];
  return list
    .map((a) => {
      const name = norm(a.apt);
      let hit = 0;
      for (const b of want) if (name.includes(b)) hit++;
      return { a, score: hit / want.size };
    })
    .filter((x) => x.score > 0.3)
    .sort((x, y) => y.score - x.score)
    .slice(0, n)
    .map((x) => x.a);
}

/** 단지 → 탑승 줄(`🚌 2호차 ○○정문 08:02 탑승 · 학교 도착까지 51분`). 읍·면·동과 단지 이름으로 맞춘다. */
export function busIndex(routes: BusRoute[]): (d: AptRef) => string[] {
  const at = new Map<string, string[]>();
  for (const r of routes)
    for (const st of r.stops) {
      const m = minutesBetween(st.time, r.arrive);
      const line = `🚌 ${r.label} ${st.name} ${st.time} 탑승${m === null ? "" : ` · ${r.dest} 도착까지 ${m}분`}`;
      for (const a of st.apts) {
        const k = excludedKey(a);
        at.set(k, [...(at.get(k) ?? []), line]);
      }
    }
  return (d) => at.get(excludedKey(d)) ?? [];
}

/** 단지 검색: 띄어쓰기·표기 차이(이편한/e편한, 엘에이치/LH)를 무시하고 포함 여부. 빈 검색어는 false. */
export function nameMatches(q: string, apt: string): boolean {
  const k = norm(q);
  return k.length > 0 && norm(apt).includes(k);
}
