/** 숫자 칸 입력 해석. 빈 칸은 0, 숫자가 아니면 null(값을 바꾸지 않음). */
export function parseNumText(raw: string): number | null {
  if (raw.trim() === "") return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** 칸에 보일 글자. 입력 중인 글자가 지금 값과 같으면 그대로 두고(빈 칸·'3.'), 값이 밖에서 바뀌었으면 값을 보여 준다. */
export function numText(text: string, value: number): string {
  return parseNumText(text) === value ? text : String(value);
}
