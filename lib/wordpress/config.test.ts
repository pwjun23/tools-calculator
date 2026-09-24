import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadConfig } from "./config";

const ORIGINAL = {
  WP_USERNAME: process.env.WP_USERNAME,
  WP_APP_PASSWORD: process.env.WP_APP_PASSWORD,
};

beforeEach(() => {
  process.env.WP_USERNAME = "editor";
  process.env.WP_APP_PASSWORD = "abcd efgh";
});

afterEach(() => {
  process.env.WP_USERNAME = ORIGINAL.WP_USERNAME;
  process.env.WP_APP_PASSWORD = ORIGINAL.WP_APP_PASSWORD;
});

describe("loadConfig", () => {
  it("env에서 자격증명을 읽고 고정된 기본값을 채운다", () => {
    const config = loadConfig(process.env);
    expect(config).toEqual({
      baseUrl: "https://molespapa.com/wp-json/wp/v2",
      username: "editor",
      appPassword: "abcd efgh",
      defaultCategory: "부동산",
      defaultTags: ["계산기", "금융"],
    });
  });

  it("WP_USERNAME이 없으면 에러를 던진다", () => {
    delete process.env.WP_USERNAME;
    expect(() => loadConfig(process.env)).toThrow(/WP_USERNAME/);
  });

  it("WP_APP_PASSWORD가 없으면 에러를 던진다", () => {
    delete process.env.WP_APP_PASSWORD;
    expect(() => loadConfig(process.env)).toThrow(/WP_APP_PASSWORD/);
  });
});
