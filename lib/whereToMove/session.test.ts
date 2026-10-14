import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createSessionCookieValue, isValidLogin, isValidSessionCookie } from "./session";

const ORIGINAL_USER = process.env.GIMPO_USER;
const ORIGINAL_PASS = process.env.GIMPO_PASS;

beforeEach(() => {
  process.env.GIMPO_USER = "mole";
  process.env.GIMPO_PASS = "test-secret";
});

afterEach(() => {
  process.env.GIMPO_USER = ORIGINAL_USER;
  process.env.GIMPO_PASS = ORIGINAL_PASS;
});

describe("isValidLogin", () => {
  it("아이디와 비밀번호가 모두 맞아야 통과한다", () => {
    expect(isValidLogin("mole", "test-secret")).toBe(true);
    expect(isValidLogin("mole", "wrong")).toBe(false);
    expect(isValidLogin("other", "test-secret")).toBe(false);
  });

  it("환경변수가 없으면 항상 실패한다", () => {
    delete process.env.GIMPO_PASS;
    expect(isValidLogin("mole", "")).toBe(false);
  });
});

describe("createSessionCookieValue / isValidSessionCookie", () => {
  it("만든 쿠키 값은 유효하다", async () => {
    expect(await isValidSessionCookie(await createSessionCookieValue())).toBe(true);
  });

  it("비밀번호가 바뀌면 기존 쿠키는 무효가 된다", async () => {
    const old = await createSessionCookieValue();
    process.env.GIMPO_PASS = "new-secret";
    expect(await isValidSessionCookie(old)).toBe(false);
  });

  it("빈 값이나 엉뚱한 값은 무효다", async () => {
    expect(await isValidSessionCookie(undefined)).toBe(false);
    expect(await isValidSessionCookie("abc")).toBe(false);
  });
});
