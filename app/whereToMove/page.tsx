import type { Metadata } from "next";
import { estimateModes, straightKm, type LatLng, type Place } from "@/lib/whereToMove/commute";
import { complexKey } from "@/lib/whereToMove/complexes";
import { requireUser } from "@/lib/whereToMove/current-user";
import { fillLiveSites, kakaoAddress, kakaoComplex, kakaoLiveKey } from "@/lib/whereToMove/kakao-live";
import { deriveParams, evaluateDeal, filterDeals } from "@/lib/whereToMove/judge";
import type { MonthlyCalc } from "@/lib/whereToMove/monthly-help";
import { buildNotice } from "@/lib/whereToMove/notice";
import { getOrCreateSettings, lastNotifyLog, listComplexes, listDeals } from "@/lib/whereToMove/repo";
import DealBoard, { type Deal } from "./DealBoard";

export const metadata: Metadata = {
  title: "이사 어디",
  robots: { index: false, follow: false },
};

const KST_DATE = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" });

type Site = { status: "pending" | "ok" | "notfound"; lat: number | null; lng: number | null };

/** 단지 좌표가 있으면 장소마다 어림값을 붙인다. 없으면 trips null 과 좌표 상태. */
function tripsOf(site: Site | undefined, places: Place[]) {
  if (!site || site.status !== "ok" || site.lat === null || site.lng === null) return { trips: null, site: site?.status ?? ("pending" as const) };
  const pos = { lat: site.lat, lng: site.lng };
  return { trips: places.map((p) => ({ id: p.id, ...estimateModes(straightKm(pos, p), p.modes) })), pos, site: "ok" as const };
}

export default async function Page() {
  const user = await requireUser();
  const { data: settings, valid, notifyEnabled } = await getOrCreateSettings(user.id);
  const from = new Date();
  from.setMonth(from.getMonth() - 12);
  const stored = await listDeals(settings.regions.map((r) => r.sggCd), { dealDateFrom: KST_DATE.format(from) });
  const p = deriveParams(settings);
  // 임시(WTM_KAKAO_LIVE): 좌표가 없는 직장·학교·단지는 카카오로 그때그때 구한다. 결과는 저장하지 않는다.
  const live = kakaoLiveKey();
  const locate = async (a: { address: string; lat?: number; lng?: number }): Promise<LatLng | null> => {
    if (a.lat !== undefined && a.lng !== undefined) return { lat: a.lat, lng: a.lng };
    if (!live) return null;
    return kakaoAddress(a.address, live).catch((e) => { console.error("[whereToMove kakao live]", e instanceof Error ? e.message : e); return null; });
  };
  const wp = settings.workplaces[0];
  const wanted: (Omit<Place, "lat" | "lng"> & { src: { address: string; lat?: number; lng?: number } })[] = [
    ...(wp ? [{ id: "w", kind: "work" as const, label: wp.label, modes: ["transit" as const, "car" as const], src: wp }] : []),
    ...settings.schools.map((sc, i) => ({ id: `s${i}`, kind: "school" as const, label: sc.label, modes: sc.modes, src: sc })),
  ];
  // 좌표를 못 구한 장소는 뺀다(나머지 장소는 그대로 보인다).
  const located = await Promise.all(wanted.map(async ({ src, ...p }): Promise<Place | null> => {
    const at = await locate(src);
    return at ? { ...p, ...at } : null;
  }));
  const places = located.filter((p): p is Place => p !== null);
  const sites = places.length ? await listComplexes(settings.regions.map((r) => r.sggCd)) : new Map<string, Site>();
  const shown = filterDeals(settings, stored);
  if (places.length && live) {
    const label = (sggCd: string) => settings.regions.find((r) => r.sggCd === sggCd)?.label ?? "";
    await fillLiveSites(sites, shown.map((d) => ({ key: complexKey(d), q: { label: label(d.sggCd), dong: d.dong, apt: d.apt } })), (n) => kakaoComplex(n.q, live));
  }

  const deals: Deal[] = shown.map((d) => {
    const e = evaluateDeal(p, d);
    return {
      recorded: KST_DATE.format(d.firstSeenAt), type: d.type, sggCd: d.sggCd,
      region: settings.regions.find((r) => r.sggCd === d.sggCd)?.label ?? "", dong: d.dong, apt: d.apt, area: d.area, floor: d.floor,
      date: d.date, amount: d.amount, rent: d.rent, loan: Math.round(e.loan),
      monthly: Math.round(e.monthly * 10) / 10, margin: Math.round(e.margin * 10) / 10, ok: e.ok, reason: e.reasons.join(", "),
      ...(places.length ? tripsOf(sites.get(complexKey(d)), places) : {}),
    };
  });

  const log = await lastNotifyLog(user.id);
  const notice = buildNotice({ settingsValid: valid, notifyEnabled, lastLog: log });

  // 월 부담 ⓘ 계산용. 거래마다 설명 문장을 보내면 목록이 커져서, 값만 한 번 보내고 화면에서 만든다.
  const calc: MonthlyCalc = { p, rates: { mortgageRate: settings.mortgageRate, mortgageYears: settings.mortgageYears } };
  return <DealBoard deals={deals} regions={settings.regions} notice={notice} places={places} calc={calc} />;
}
