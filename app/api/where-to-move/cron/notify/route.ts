import { auth } from "@/lib/whereToMove/auth";
import { isCronAuthorized } from "@/lib/whereToMove/cron";
import { deriveParams, evaluateDeal, filterDeals } from "@/lib/whereToMove/judge";
import { LINK_URL, sendKakaoMemo } from "@/lib/whereToMove/kakao";
import { buildWeeklyMessage } from "@/lib/whereToMove/message";
import { kakaoAccountId, listDeals, listNotifyTargets, logNotify, markNotified } from "@/lib/whereToMove/repo";

// 월요일 08시 KST. 사용자마다 지난 알림 이후 새로 들어온 거래를 판정해 카카오톡 나에게 보내기로 보낸다.
export async function GET(request: Request) {
  if (!isCronAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return Response.json({ ok: false }, { status: 401 });
  }
  const runAt = new Date();
  const results: { userId: string; status: "sent" | "failed"; error?: string }[] = [];

  for (const t of await listNotifyTargets()) {
    let newCount = 0;
    let okCount = 0;
    try {
      // 저장된 설정을 읽지 못했으면 기본값으로 판정한 알림을 보내지 않는다.
      if (!t.valid) throw new Error("저장된 설정을 읽지 못했습니다. 설정 화면에서 다시 저장해 주세요");
      const since = t.lastNotifiedAt ?? runAt;
      const fresh = filterDeals(t.data, await listDeals(t.data.regions.map((r) => r.sggCd), { firstSeenAfter: since }));
      const p = deriveParams(t.data);
      const judged = fresh.map((d) => ({ ...d, ...evaluateDeal(p, d) }));
      newCount = judged.length;
      okCount = judged.filter((d) => d.ok).length;
      const text = buildWeeklyMessage(t.data.regions[0].label, judged);

      const accountId = await kakaoAccountId(t.userId);
      if (!accountId) throw new Error("카카오 계정 연결이 없습니다");
      const { accessToken } = await auth.api.getAccessToken({ body: { accountId, userId: t.userId } });
      if (!accessToken) throw new Error("카카오 access token 을 받지 못했습니다");
      await sendKakaoMemo(accessToken, text, LINK_URL);

      await markNotified(t.userId, runAt);
      await logNotify({ userId: t.userId, newCount, okCount, status: "sent" });
      results.push({ userId: t.userId, status: "sent" });
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      console.error("[whereToMove notify]", t.userId, error);
      await logNotify({ userId: t.userId, newCount, okCount, status: "failed", error });
      results.push({ userId: t.userId, status: "failed", error });
    }
  }
  return Response.json({ ok: results.every((r) => r.status === "sent"), results });
}
