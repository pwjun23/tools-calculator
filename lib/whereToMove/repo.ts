import { and, asc, desc, eq, gt, gte, inArray, sql } from "drizzle-orm";
import { db } from "./db";
import { account, wtmCollectLog, wtmComplexes, wtmDeals, wtmNotifyLog, wtmSettings, type ComplexStatus } from "./schema";
import { complexKey, complexSeeds, type ComplexSeed } from "./complexes";
import { umdOf } from "./dong";
import { excludedKey } from "./exclude";
import { DEFAULT_SETTINGS, normalizeStoredSettings, readStoredSettings, type Settings } from "./settings";
import { fetchDeals, uniqueByKey } from "./molit";
import type { CollectDeps } from "./collect";
import type { GeocodeDeps } from "./geocode";
import { locateAddress } from "./juso";
import type { MolitDeal, StoredDeal } from "./types";

const CHUNK = 500;

/**
 * 거래를 키 기준으로 넣는다. 이미 있으면 해제 여부·계약 기간(새 값이 있을 때)과 갱신 시각만 바꾼다(first_seen_at 유지).
 * seenAt 을 주면 새 행의 first_seen_at 을 그 값으로 넣는다(처음 받는 달).
 */
export async function upsertDeals(all: MolitDeal[], seenAt?: (d: MolitDeal) => Date): Promise<number> {
  const deals = uniqueByKey(all);
  for (let i = 0; i < deals.length; i += CHUNK) {
    const rows = deals.slice(i, i + CHUNK).map((d) => ({
      dealKey: d.key, type: d.type, sggCd: d.sggCd, dong: d.dong, apt: d.apt, area: d.area, areaRaw: d.areaRaw,
      floor: d.floor, dealDate: d.date, amount: d.amount, rent: d.rent, renewal: d.renewal, cancelled: d.cancelled, term: d.term ?? "",
      ...(seenAt ? { firstSeenAt: seenAt(d) } : {}),
    }));
    await db
      .insert(wtmDeals)
      .values(rows)
      .onConflictDoUpdate({
        target: wtmDeals.dealKey,
        set: {
          cancelled: sql`excluded.cancelled`,
          term: sql`case when excluded.contract_term <> '' then excluded.contract_term else ${wtmDeals.term} end`,
          updatedAt: sql`now()`,
        },
      });
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
    floor: r.floor, date: r.dealDate, amount: r.amount, rent: r.rent, renewal: r.renewal, cancelled: r.cancelled, term: r.term,
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

export async function loggedMonths(sggCd: string): Promise<Set<string>> {
  const rows = await db.select({ ym: wtmCollectLog.ym }).from(wtmCollectLog).where(eq(wtmCollectLog.sggCd, sggCd));
  return new Set(rows.map((r) => r.ym));
}

export async function markCollected(sggCd: string, ym: string): Promise<void> {
  await db
    .insert(wtmCollectLog)
    .values({ sggCd, ym })
    .onConflictDoUpdate({ target: [wtmCollectLog.sggCd, wtmCollectLog.ym], set: { collectedAt: sql`now()` } });
}

/** collectRegion 에 넘길 실제 의존성(국토부 API + DB). */
export function collectDeps(keys: { trade: string; rent: string }): CollectDeps {
  return {
    fetchMonth: (sggCd, ym) => fetchDeals(sggCd, ym, keys), loggedMonths, upsert: upsertDeals, markCollected,
    seedComplexes: (deals) => upsertComplexes(complexSeeds(deals)),
  };
}

/** 새 단지는 pending 으로 넣고, 있는 단지는 비어 있던 주소·단지 번호만 채운다. */
export async function upsertComplexes(seeds: ComplexSeed[]): Promise<void> {
  for (let i = 0; i < seeds.length; i += CHUNK) {
    await db
      .insert(wtmComplexes)
      .values(seeds.slice(i, i + CHUNK))
      .onConflictDoUpdate({
        target: [wtmComplexes.sggCd, wtmComplexes.dong, wtmComplexes.apt],
        set: {
          roadAddr: sql`case when ${wtmComplexes.roadAddr} = '' then excluded.road_addr else ${wtmComplexes.roadAddr} end`,
          jibunAddr: sql`case when ${wtmComplexes.jibunAddr} = '' then excluded.jibun_addr else ${wtmComplexes.jibunAddr} end`,
          aptSeq: sql`case when ${wtmComplexes.aptSeq} = '' then excluded.apt_seq else ${wtmComplexes.aptSeq} end`,
        },
      });
  }
}

export async function pendingComplexes(limit: number): Promise<ComplexSeed[]> {
  return db
    .select({ sggCd: wtmComplexes.sggCd, dong: wtmComplexes.dong, apt: wtmComplexes.apt, aptSeq: wtmComplexes.aptSeq, roadAddr: wtmComplexes.roadAddr, jibunAddr: wtmComplexes.jibunAddr })
    .from(wtmComplexes)
    .where(eq(wtmComplexes.status, "pending"))
    .orderBy(asc(wtmComplexes.updatedAt))
    .limit(limit);
}

/** 좌표를 저장한다. null 이면 주소를 찾지 못한 것(notfound)으로 둔다. */
export async function saveComplexCoord(c: { sggCd: string; dong: string; apt: string }, p: { lat: number; lng: number } | null): Promise<void> {
  await db
    .update(wtmComplexes)
    .set(p ? { lat: p.lat, lng: p.lng, status: "ok", updatedAt: new Date() } : { status: "notfound", updatedAt: new Date() })
    .where(and(eq(wtmComplexes.sggCd, c.sggCd), eq(wtmComplexes.dong, c.dong), eq(wtmComplexes.apt, c.apt)));
}

/** 시·군·구들의 단지 좌표. 키는 complexKey. */
/** 오류가 난 단지를 대기열 뒤로 보낸다(계속 실패하는 단지가 새 단지를 막지 않게). */
export async function deferComplex(c: { sggCd: string; dong: string; apt: string }): Promise<void> {
  await db
    .update(wtmComplexes)
    .set({ updatedAt: new Date() })
    .where(and(eq(wtmComplexes.sggCd, c.sggCd), eq(wtmComplexes.dong, c.dong), eq(wtmComplexes.apt, c.apt)));
}

export async function listComplexes(sggCds: string[]) {
  const out = new Map<string, { status: ComplexStatus; lat: number | null; lng: number | null }>();
  if (!sggCds.length) return out;
  const rows = await db.select().from(wtmComplexes).where(inArray(wtmComplexes.sggCd, sggCds));
  for (const r of rows) out.set(complexKey(r), { status: r.status, lat: r.lat, lng: r.lng });
  return out;
}

/** 설정 화면 단지 고르기용 이름 목록. 읍·면·동 단위(리 이름 뺌)로 겹침 없이. */
export async function listComplexNames(sggCds: string[]): Promise<{ sggCd: string; dong: string; apt: string }[]> {
  if (!sggCds.length) return [];
  const rows = await db.select({ sggCd: wtmComplexes.sggCd, dong: wtmComplexes.dong, apt: wtmComplexes.apt }).from(wtmComplexes).where(inArray(wtmComplexes.sggCd, sggCds));
  const out = new Map<string, { sggCd: string; dong: string; apt: string }>();
  for (const r of rows) {
    const a = { sggCd: r.sggCd, dong: umdOf(r.dong), apt: r.apt };
    out.set(excludedKey(a), a);
  }
  return [...out.values()].sort((x, y) => x.apt.localeCompare(y.apt, "ko"));
}

export async function resetNotFound(): Promise<number> {
  const rows = await db.update(wtmComplexes).set({ status: "pending" }).where(eq(wtmComplexes.status, "notfound")).returning({ apt: wtmComplexes.apt });
  return rows.length;
}

/** geocodePending 에 넘길 실제 의존성(도로명주소 API + DB). */
export function geocodeDeps(keys: { search: string; coord: string }): GeocodeDeps {
  return { pending: pendingComplexes, locate: (a) => locateAddress(a, keys), save: saveComplexCoord, defer: deferComplex };
}
