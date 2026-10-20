"use client";

import { useState } from "react";
import { numText, parseNumText } from "@/lib/whereToMove/num-input";

/**
 * 숫자 칸. 값을 숫자로만 들고 있으면 칸을 비우는 순간 0이 다시 채워져 0을 지울 수 없어서(075·750 입력),
 * 입력 중인 글자를 따로 둔다. 빈 칸은 0으로 저장한다.
 */
export default function NumInput({ value, onChange, ...rest }: { value: number; onChange: (v: number) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type">) {
  const [text, setText] = useState(String(value));
  return (
    <input {...rest} type="number" value={numText(text, value)}
      onChange={(e) => {
        setText(e.target.value);
        const n = parseNumText(e.target.value);
        if (n !== null) onChange(n);
      }} />
  );
}
