import data from "./regions.json";
import type { RegionTree, SggEntry } from "./regions-build";

/** 법정동코드로 만든 전국 지역 목록(scripts/where-to-move/build-regions.ts 가 만든다). */
export const REGION_TREE = data as RegionTree;
const BY_CD = new Map<string, SggEntry>(REGION_TREE.sidos.flatMap((s) => s.sggs.map((g) => [g.cd, g] as const)));

export const findSgg = (cd: string) => BY_CD.get(cd);
export const regionLabel = (cd: string) => BY_CD.get(cd)?.label;

/** 시·군·구가 목록에 없으면 null, 있으면 그 시·군·구에 없는 동 이름들. */
export function invalidDongs(sggCd: string, dongs: string[]): string[] | null {
  const g = BY_CD.get(sggCd);
  if (!g) return null;
  return dongs.filter((d) => !g.dongs.includes(d));
}
