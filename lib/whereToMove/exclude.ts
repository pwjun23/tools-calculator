import { umdOf } from "./dong";
import { MAX_EXCLUDED, type ExcludedApt } from "./settings";

/** 목록·알림에서 뺄 단지(예: 지금 사는 단지). 읍·면·동과 단지 이름으로 맞춘다. */
type AptRef = { sggCd: string; dong: string; apt: string };

export const excludedKey = (a: AptRef) => [a.sggCd, umdOf(a.dong), a.apt].join("|");

export function isExcluded(list: ExcludedApt[], d: AptRef): boolean {
  if (!list.length) return false;
  const k = excludedKey(d);
  return list.some((e) => excludedKey(e) === k);
}

/** 단지를 더한다. 이미 있으면 그대로, 한도를 넘으면 null. */
export function addExcluded(list: ExcludedApt[], d: AptRef): ExcludedApt[] | null {
  if (isExcluded(list, d)) return list;
  if (list.length >= MAX_EXCLUDED) return null;
  return [...list, { sggCd: d.sggCd, dong: umdOf(d.dong), apt: d.apt }];
}

export function removeExcluded(list: ExcludedApt[], d: AptRef): ExcludedApt[] {
  const k = excludedKey(d);
  return list.filter((e) => excludedKey(e) !== k);
}
