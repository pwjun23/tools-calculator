import { describe, expect, it } from "vitest";
import { auth } from "./auth";

describe("auth 세션", () => {
  it("예전 로그인 쿠키처럼 180일 유지한다 (월요일 카톡 버튼으로만 들어와도 끊기지 않게)", () => {
    expect(auth.options.session?.expiresIn).toBe(60 * 60 * 24 * 180);
  });
});
