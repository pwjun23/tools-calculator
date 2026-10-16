"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { collectRegion } from "@/lib/whereToMove/collect";
import { requireUser } from "@/lib/whereToMove/current-user";
import { collectKeys } from "@/lib/whereToMove/molit";
import { checkRegions } from "@/lib/whereToMove/region-check";
import { collectDeps, loggedMonths, saveSettings } from "@/lib/whereToMove/repo";
import { parseSettings } from "@/lib/whereToMove/settings";

export async function saveSettingsAction(input: { data: unknown; notifyEnabled: boolean }) {
  const user = await requireUser();
  const parsed = parseSettings(input.data);
  if (!parsed.ok) return parsed;
  // 지역은 법정동 목록에 있는 것만 받고, label 은 목록 값으로 바꾼다.
  const checked = checkRegions(parsed.settings.regions);
  if (!checked.ok) return checked;
  const settings = { ...parsed.settings, regions: checked.regions };
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
    });
  }
  revalidatePath("/whereToMove");
  return { ok: true as const, collecting: fresh.length > 0 && keys !== null };
}
