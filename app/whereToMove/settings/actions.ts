"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { collectRegion } from "@/lib/whereToMove/collect";
import { requireUser } from "@/lib/whereToMove/current-user";
import { geocodePending } from "@/lib/whereToMove/geocode";
import { cleanKeyword, coordOf, jusoKeys, jusoSearchKey, searchAddress, type JusoRef } from "@/lib/whereToMove/juso";
import { collectKeys } from "@/lib/whereToMove/molit";
import { checkRegions } from "@/lib/whereToMove/region-check";
import { collectDeps, geocodeDeps, getOrCreateSettings, loggedMonths, saveSettings } from "@/lib/whereToMove/repo";
import { inputErrors, parseSettings } from "@/lib/whereToMove/settings";

export async function saveSettingsAction(input: { data: unknown; notifyEnabled: boolean }) {
  const user = await requireUser();
  const parsed = parseSettings(input.data);
  if (!parsed.ok) return parsed;
  const typo = inputErrors(parsed.settings);
  if (Object.keys(typo).length) return { ok: false as const, errors: typo };
  // 지역은 법정동 목록에 있는 것만 받고, label 은 목록 값으로 바꾼다.
  const checked = checkRegions(parsed.settings.regions);
  if (!checked.ok) return checked;
  // 뺀 단지는 목록 화면에서 따로 바꾸므로, 열어 둔 설정 화면의 예전 값으로 덮어쓰지 않게 저장된 값을 쓴다.
  const stored = await getOrCreateSettings(user.id);
  const settings = { ...parsed.settings, regions: checked.regions, excludedApts: stored.valid ? stored.data.excludedApts : parsed.settings.excludedApts };
  await saveSettings(user.id, settings, input.notifyEnabled === true);

  // 한 번도 받지 않은 시·군·구는 응답 뒤에 바로 지난 12개월을 받는다. 실패하면 다음 날 Cron 이 이어서 받는다.
  const fresh: string[] = [];
  for (const r of settings.regions) if ((await loggedMonths(r.sggCd)).size === 0) fresh.push(r.sggCd);
  const keys = collectKeys();
  if (fresh.length && keys) {
    after(async () => {
      for (const sggCd of fresh) {
        try {
          await collectRegion(sggCd, collectDeps(keys), { now: new Date(), maxBackfill: 10 });
        } catch (e) {
          console.error("[whereToMove backfill]", sggCd, e);
        }
      }
      // 새 지역 단지의 좌표도 바로 찾는다. 남은 단지는 다음 날 Cron 이 이어서 한다.
      const jk = jusoKeys();
      if (jk) {
        const started = Date.now();
        await geocodePending(geocodeDeps(jk), { limit: 100, deadline: started + 120_000 }).catch((e) => console.error("[whereToMove geocode]", e));
      }
    });
  }
  revalidatePath("/whereToMove");
  return { ok: true as const, collecting: fresh.length > 0 && keys !== null };
}

const NO_JUSO = "주소 검색을 쓸 수 없습니다. 잠시 뒤 다시 시도해 주세요.";

/** 직장 주소 후보를 찾는다(도로명주소 검색 API). */
export async function searchAddressAction(keyword: string) {
  await requireUser();
  const key = jusoSearchKey();
  if (!key) return { ok: false as const, error: NO_JUSO };
  const kw = cleanKeyword(String(keyword ?? "")).slice(0, 80);
  if (kw.length < 2) return { ok: false as const, error: "주소를 두 글자 이상 입력해 주세요." };
  try {
    const candidates = await searchAddress(kw, key);
    return candidates.length ? { ok: true as const, candidates } : { ok: false as const, error: "검색 결과가 없습니다. 도로명이나 건물 이름으로 다시 찾아 주세요." };
  } catch (e) {
    console.error("[whereToMove juso search]", e instanceof Error ? e.message : e);
    return { ok: false as const, error: NO_JUSO };
  }
}

/** 고른 후보의 좌표(도로명주소 좌표 API). */
export async function locateCandidateAction(ref: JusoRef): Promise<{ ok: true; lat: number; lng: number } | { ok: false; error: string }> {
  await requireUser();
  const jk = jusoKeys();
  let notFound = false;
  if (jk) {
    try {
      const p = await coordOf(ref, jk.coord);
      if (p) return { ok: true, ...p };
      notFound = true;
    } catch (e) {
      console.error("[whereToMove juso coord]", e instanceof Error ? e.message : e);
    }
  }
  return { ok: false, error: notFound ? "이 주소의 위치를 찾지 못했습니다. 다른 후보를 골라 주세요." : NO_JUSO };
}
