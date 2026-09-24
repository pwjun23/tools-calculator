import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.ts";

const rawConfig = {
  wordpress_url: "https://molespapa.com",
  api_endpoint: "/wp-json/wp/v2",
  default_category: "부동산",
  default_tags: ["계산기", "금융"],
};

describe("loadConfig", () => {
  it("config와 env를 합쳐 baseUrl/자격증명을 만든다", () => {
    const config = loadConfig(
      { WP_USERNAME: "editor", WP_APP_PASSWORD: "abcd efgh" },
      rawConfig,
    );
    expect(config).toEqual({
      baseUrl: "https://molespapa.com/wp-json/wp/v2",
      username: "editor",
      appPassword: "abcd efgh",
      defaultCategory: "부동산",
      defaultTags: ["계산기", "금융"],
    });
  });

  it("WP_USERNAME이 없으면 에러를 던진다", () => {
    expect(() => loadConfig({ WP_APP_PASSWORD: "x" }, rawConfig)).toThrow(
      /WP_USERNAME/,
    );
  });

  it("WP_APP_PASSWORD가 없으면 에러를 던진다", () => {
    expect(() => loadConfig({ WP_USERNAME: "editor" }, rawConfig)).toThrow(
      /WP_APP_PASSWORD/,
    );
  });

  it("default_tags가 없으면 빈 배열로 채운다", () => {
    const config = loadConfig(
      { WP_USERNAME: "e", WP_APP_PASSWORD: "p" },
      { wordpress_url: "https://x.com", api_endpoint: "/wp-json/wp/v2" },
    );
    expect(config.defaultTags).toEqual([]);
    expect(config.defaultCategory).toBeUndefined();
  });
});
