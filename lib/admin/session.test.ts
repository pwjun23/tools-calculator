import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createSessionCookieValue, hashPassword, isValidSessionCookie } from "./session";

const ORIGINAL_ENV = process.env.ADMIN_PASSWORD;

beforeEach(() => {
  process.env.ADMIN_PASSWORD = "test-admin-secret";
});

afterEach(() => {
  process.env.ADMIN_PASSWORD = ORIGINAL_ENV;
});

describe("hashPassword", () => {
  it("같은 입력이면 항상 같은 해시를 만든다", async () => {
    const a = await hashPassword("hello");
    const b = await hashPassword("hello");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("다른 입력이면 다른 해시를 만든다", async () => {
    const a = await hashPassword("hello");
    const b = await hashPassword("hello2");
    expect(a).not.toBe(b);
  });
});

describe("createSessionCookieValue / isValidSessionCookie", () => {
  it("현재 ADMIN_PASSWORD의 해시값을 만든다", async () => {
    const value = await createSessionCookieValue();
    expect(value).toBe(await hashPassword("test-admin-secret"));
  });

  it("올바른 쿠키 값은 유효하다", async () => {
    const value = await createSessionCookieValue();
    await expect(isValidSessionCookie(value)).resolves.toBe(true);
  });

  it("잘못된 쿠키 값은 무효하다", async () => {
    await expect(isValidSessionCookie("aaaaaaaa")).resolves.toBe(false);
  });

  it("쿠키가 없으면 무효하다", async () => {
    await expect(isValidSessionCookie(undefined)).resolves.toBe(false);
  });

  it("ADMIN_PASSWORD를 바꾸면 예전 쿠키가 무효해진다", async () => {
    const oldValue = await createSessionCookieValue();
    process.env.ADMIN_PASSWORD = "new-secret";
    await expect(isValidSessionCookie(oldValue)).resolves.toBe(false);
  });

  it("ADMIN_PASSWORD가 설정되어 있지 않으면 에러를 던진다", async () => {
    delete process.env.ADMIN_PASSWORD;
    await expect(createSessionCookieValue()).rejects.toThrow();
  });

  it("ADMIN_PASSWORD가 없으면 빈 문자열 해시(공개적으로 알려진 값)로도 통과하지 않는다", async () => {
    delete process.env.ADMIN_PASSWORD;
    await expect(
      isValidSessionCookie(await hashPassword("")),
    ).resolves.toBe(false);
  });
});
