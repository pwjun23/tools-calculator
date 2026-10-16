import type { DealType } from "./types";

export interface MessageDeal {
  type: DealType;
  dong: string;
  apt: string;
  area: number;
  amount: number;
  rent: number;
  date: string;
  ok: boolean;
  monthly: number;
}

/** 20000 → 2억, 12820 → 1.28억, 5000 → 5000만 */
export function shortWon(v: number): string {
  return v >= 10000 ? `${Math.round(v / 100) / 100}억` : `${Math.round(v)}만`;
}

const clip = (s: string, max: number) => (s.length <= max ? s : s.slice(0, max - 1) + "…");

/** Code.gs buildMessage_ 와 같은 형식(첫 줄 이름만 이사 어디). */
export function buildWeeklyMessage(deals: MessageDeal[], max = 200): string {
  const cnt = (t: DealType) => deals.filter((d) => d.type === t).length;
  const okDeals = deals.filter((d) => d.ok).sort((a, b) => (a.date < b.date ? 1 : -1));
  let text = `[이사 어디 주간] 신규 신고 ${deals.length}건 (매매 ${cnt("매매")}, 전세 ${cnt("전세")}, 월세 ${cnt("월세")})\n예산 적합 ${okDeals.length}건`;
  for (const d of okDeals.slice(0, 3)) {
    const price = d.type === "월세" ? `${shortWon(d.amount)}/${d.rent}만` : shortWon(d.amount);
    const line = `\n· ${d.dong} ${d.apt} ${d.area}㎡ ${d.type} ${price} (월 ${Math.round(d.monthly)}만)`;
    if ((text + line).length > max - 1) break;
    text += line;
  }
  return clip(text, max);
}
