import { describe, expect, it } from "vitest";
import { numText, parseNumText } from "./num-input";

describe("parseNumText", () => {
  it("빈 칸은 0으로 본다(칸은 비운 채 둔다)", () => expect(parseNumText("")).toBe(0));
  it("앞의 0은 무시", () => expect(parseNumText("075")).toBe(75));
  it("소수", () => expect(parseNumText("3.5")).toBe(3.5));
  it("숫자가 아니면 null(값을 바꾸지 않음)", () => expect(parseNumText("-")).toBeNull());
});

describe("numText", () => {
  it("입력 중인 글자가 같은 값이면 그대로 둔다(빈 칸·'3.' 유지)", () => {
    expect(numText("", 0)).toBe("");
    expect(numText("3.", 3)).toBe("3.");
  });
  it("값이 밖에서 바뀌었으면 값을 보여 준다", () => expect(numText("5", 7)).toBe("7"));
});
