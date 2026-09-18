const group = (n: number) => n.toLocaleString("en-US");

/** 1234567 → "1,234,567원" */
export function formatWon(n: number): string {
  return `${group(n)}원`;
}

/** 120000000 → "1억 2,000만원" (자릿수를 읽기 쉽게 한글 단위로 표기) */
export function formatKoreanAmount(n: number): string {
  if (n === 0) return "0원";

  const eok = Math.floor(n / 100_000_000);
  const man = Math.floor((n % 100_000_000) / 10_000);
  const rest = n % 10_000;

  const parts = [
    eok > 0 && `${group(eok)}억`,
    man > 0 && `${group(man)}만`,
    rest > 0 && group(rest),
  ].filter(Boolean);

  return `${parts.join(" ")}원`;
}
