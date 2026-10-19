"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/whereToMove/current-user";
import { addExcluded, removeExcluded } from "@/lib/whereToMove/exclude";
import { getOrCreateSettings, saveSettings } from "@/lib/whereToMove/repo";
import { MAX_EXCLUDED, parseSettings } from "@/lib/whereToMove/settings";

/** 단지를 목록·알림에서 빼거나(exclude=true) 다시 보이게 한다. 다른 설정은 저장된 값 그대로 둔다. */
export async function setExcludedAction(ref: { sggCd: string; dong: string; apt: string }, exclude: boolean): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();
  const { data, valid, notifyEnabled } = await getOrCreateSettings(user.id);
  if (!valid) return { ok: false, error: "저장된 설정을 읽지 못했습니다. 설정 화면에서 다시 저장해 주세요." };
  const a = { sggCd: String(ref?.sggCd ?? ""), dong: String(ref?.dong ?? ""), apt: String(ref?.apt ?? "") };
  const list = exclude ? addExcluded(data.excludedApts, a) : removeExcluded(data.excludedApts, a);
  if (!list) return { ok: false, error: `단지는 ${MAX_EXCLUDED}곳까지 뺄 수 있습니다. 설정에서 정리해 주세요.` };
  const parsed = parseSettings({ ...data, excludedApts: list });
  if (!parsed.ok) return { ok: false, error: "단지 정보가 올바르지 않습니다." };
  await saveSettings(user.id, parsed.settings, notifyEnabled);
  revalidatePath("/whereToMove");
  return { ok: true };
}
