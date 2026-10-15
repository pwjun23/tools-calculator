import { and, desc, eq, gt, gte, inArray, sql } from "drizzle-orm";
import { db } from "./db";
import { account, wtmDeals, wtmNotifyLog, wtmSettings } from "./schema";
import { DEFAULT_SETTINGS, normalizeStoredSettings, readStoredSettings, type Settings } from "./settings";
import { uniqueByKey } from "./molit";
import type { MolitDeal, StoredDeal } from "./types";

const CHUNK = 500;

/** 거래를 키 기준으로 넣는다. 이미 있으면 해제 여부와 갱신 시각만 바꾼다(first_seen_at 유지). */
export async function upsertDeals(all: MolitDeal[]): Promise<number> {
  const deals = uniqueByKey(all);
  for (let i = 0; i < deals.length; i += CHUNK) {
    const rows = deals.slice(i, i + CHUNK).map((d) => ({
      dealKey: d.key, type: d.type, sggCd: d.sggCd, dong: d.dong, apt: d.apt, area: d.area, areaRaw: d.areaRaw,
      floor: d.floor, dealDate: d.date, amount: d.amount, rent: d.rent, renewal: d.renewal, cancelled: d.cancelled,
    }));
    await db
      .insert(wtmDeals)
      .values(rows)
      .onConflictDoUpdate({ target: wtmDeals.dealKey, set: { cancelled: sql`excluded.cancelled`, updatedAt: sql`now()` } });
  }
  return deals.length;
}

export async function listDeals(sggCds: string[], opts: { firstSeenAfter?: Date; dealDateFrom?: string }): Promise<StoredDeal[]> {
  if (!sggCds.length) return [];
  const conds = [inArray(wtmDeals.sggCd, sggCds), eq(wtmDeals.cancelled, false)];
  if (opts.firstSeenAfter) conds.push(gt(wtmDeals.firstSeenAt, opts.firstSeenAfter));
  if (opts.dealDateFrom) conds.push(gte(wtmDeals.dealDate, opts.dealDateFrom));
  const rows = await db.select().from(wtmDeals).where(and(...conds)).orderBy(desc(wtmDeals.dealDate));
  return rows.map((r) => ({
    key: r.dealKey, type: r.type, sggCd: r.sggCd, dong: r.dong, apt: r.apt, area: r.area, areaRaw: r.areaRaw,
    floor: r.floor, date: r.dealDate, amount: r.amount, rent: r.rent, renewal: r.renewal, cancelled: r.cancelled,
    firstSeenAt: r.firstSeenAt,
  }));
}

/** 처음이면 기본값으로 만든다. 알림 기준 시각은 만든 시각(과거 거래를 한꺼번에 보내지 않음). */
export async function getOrCreateSettings(userId: string) {
  await db.insert(wtmSettings).values({ userId, data: DEFAULT_SETTINGS, lastNotifiedAt: new Date() }).onConflictDoNothing();
  const [row] = await db.select().from(wtmSettings).where(eq(wtmSettings.userId, userId));
  const { settings, valid } = readStoredSettings(row.data);
  return { data: settings, valid, notifyEnabled: row.notifyEnabled, lastNotifiedAt: row.lastNotifiedAt };
}

/** 알림을 꺼져 있다가 켜면 기준 시각을 지금으로 옮긴다. */
export async function saveSettings(userId: string, data: Settings, notifyEnabled: boolean): Promise<void> {
  await db
    .update(wtmSettings)
    .set({
      data,
      notifyEnabled,
      updatedAt: new Date(),
      lastNotifiedAt: sql`case when ${wtmSettings.notifyEnabled} = false and ${notifyEnabled} = true then now() else ${wtmSettings.lastNotifiedAt} end`,
    })
    .where(eq(wtmSettings.userId, userId));
}

export async function listNotifyTargets() {
  const rows = await db.select().from(wtmSettings).where(eq(wtmSettings.notifyEnabled, true));
  return rows.map((r) => {
    const { settings, valid } = readStoredSettings(r.data);
    return { userId: r.userId, data: settings, valid, lastNotifiedAt: r.lastNotifiedAt };
  });
}

export async function markNotified(userId: string, at: Date): Promise<void> {
  await db.update(wtmSettings).set({ lastNotifiedAt: at }).where(eq(wtmSettings.userId, userId));
}

export async function logNotify(row: { userId: string; newCount: number; okCount: number; status: "sent" | "failed"; error?: string }) {
  await db.insert(wtmNotifyLog).values({ ...row, error: row.error ?? null });
}

export async function lastNotifyLog(userId: string) {
  const [row] = await db.select().from(wtmNotifyLog).where(eq(wtmNotifyLog.userId, userId)).orderBy(desc(wtmNotifyLog.sentAt)).limit(1);
  return row ? { status: row.status, error: row.error, sentAt: row.sentAt } : null;
}

export async function kakaoAccountId(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ id: account.id })
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, "kakao")))
    .limit(1);
  return row?.id ?? null;
}

/** 모든 사용자 설정의 지역 코드. 사용자가 없으면 기본 지역. */
export async function allRegionSggCds(): Promise<string[]> {
  const rows = await db.select({ data: wtmSettings.data }).from(wtmSettings);
  const set = new Set<string>(DEFAULT_SETTINGS.regions.map((r) => r.sggCd));
  for (const r of rows) for (const reg of normalizeStoredSettings(r.data).regions) set.add(reg.sggCd);
  return [...set];
}
