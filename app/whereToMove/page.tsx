import type { Metadata } from "next";
import { requireUser } from "@/lib/whereToMove/current-user";
import { deriveParams, evaluateDeal, filterDeals } from "@/lib/whereToMove/judge";
import { buildNotice } from "@/lib/whereToMove/notice";
import { getOrCreateSettings, lastNotifyLog, listDeals } from "@/lib/whereToMove/repo";
import GimpoBoard, { type Deal } from "./GimpoBoard";

export const metadata: Metadata = {
  title: "이사 실거래 모아보기",
  robots: { index: false, follow: false },
};

const KST_DATE = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" });

export default async function Page() {
  const user = await requireUser();
  const { data: settings, valid, notifyEnabled } = await getOrCreateSettings(user.id);
  const from = new Date();
  from.setMonth(from.getMonth() - 12);
  const stored = await listDeals(settings.regions.map((r) => r.sggCd), { dealDateFrom: KST_DATE.format(from) });
  const p = deriveParams(settings);

  const deals: Deal[] = filterDeals(settings, stored).map((d) => {
    const e = evaluateDeal(p, d);
    return {
      recorded: KST_DATE.format(d.firstSeenAt), type: d.type, dong: d.dong, apt: d.apt, area: d.area, floor: d.floor,
      date: d.date, amount: d.amount, rent: d.rent, loan: Math.round(e.loan),
      monthly: Math.round(e.monthly * 10) / 10, margin: Math.round(e.margin * 10) / 10, ok: e.ok, reason: e.reasons.join(", "),
    };
  });

  const log = await lastNotifyLog(user.id);
  const notice = buildNotice({ settingsValid: valid, notifyEnabled, lastLog: log });

  const region = settings.regions[0];
  return <GimpoBoard deals={deals} title={`${region.label} 실거래 모아보기`} subtitle={region.dongs.join(" · ")} notice={notice} />;
}
