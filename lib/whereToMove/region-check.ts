import { invalidDongs, regionLabel } from "./regions";
import type { Settings } from "./settings";

/** 저장 전에 법정동 목록으로 지역을 검사하고 label 을 목록 값으로 채운다. */
export function checkRegions(
  regions: Settings["regions"],
): { ok: true; regions: Settings["regions"] } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const out = regions.map((r, i) => {
    const bad = invalidDongs(r.sggCd, r.dongs);
    if (bad === null) errors[`regions.${i}`] = "목록에 없는 시·군·구입니다";
    else if (bad.length) errors[`regions.${i}`] = `이 시·군·구에 없는 동: ${bad.join(", ")}`;
    return { ...r, label: regionLabel(r.sggCd) ?? r.label };
  });
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, regions: out };
}
