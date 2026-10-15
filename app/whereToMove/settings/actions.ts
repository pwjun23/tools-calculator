"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/whereToMove/current-user";
import { saveSettings } from "@/lib/whereToMove/repo";
import { parseSettings } from "@/lib/whereToMove/settings";

export async function saveSettingsAction(input: { data: unknown; notifyEnabled: boolean }) {
  const user = await requireUser();
  const parsed = parseSettings(input.data);
  if (!parsed.ok) return parsed;
  await saveSettings(user.id, parsed.settings, input.notifyEnabled === true);
  revalidatePath("/whereToMove");
  return { ok: true as const };
}
