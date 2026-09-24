const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const KST_PATTERN = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/;

export function kstToUtc(kst: string, now: Date = new Date()): Date {
  const match = KST_PATTERN.exec(kst.trim());
  if (!match) {
    throw new Error(`발행 시각 형식이 올바르지 않습니다: "${kst}" (예: "2026-09-28 09:00")`);
  }
  const [, y, mo, d, h, mi] = match;
  const utcMs =
    Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi)) - KST_OFFSET_MS;

  if (utcMs <= now.getTime()) {
    throw new Error(`발행 시각이 과거입니다: "${kst}" (한국 시간 기준)`);
  }
  return new Date(utcMs);
}

export function toWpDateGmt(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "");
}
