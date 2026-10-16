import type { MolitDeal } from "./types";

export type ComplexSeed = { sggCd: string; dong: string; apt: string; aptSeq: string; roadAddr: string; jibunAddr: string };

/** 단지 키. 거래 표와 같은 (시·군·구, 동(umdNm 그대로), 단지명). */
export const complexKey = (c: { sggCd: string; dong: string; apt: string }) => `${c.sggCd}|${c.dong}|${c.apt}`;

/** 거래들에서 단지를 하나씩 꺼낸다. 같은 단지면 비어 있는 주소·단지 번호를 다른 거래 값으로 채운다. */
export function complexSeeds(deals: MolitDeal[]): ComplexSeed[] {
  const out = new Map<string, ComplexSeed>();
  for (const d of deals) {
    if (!d.apt) continue;
    const k = complexKey(d);
    const cur = out.get(k);
    const next: ComplexSeed = { sggCd: d.sggCd, dong: d.dong, apt: d.apt, aptSeq: d.aptSeq ?? "", roadAddr: d.roadAddr ?? "", jibunAddr: d.jibunAddr ?? "" };
    if (!cur) { out.set(k, next); continue; }
    cur.roadAddr ||= next.roadAddr;
    cur.jibunAddr ||= next.jibunAddr;
    cur.aptSeq ||= next.aptSeq;
  }
  return [...out.values()];
}
