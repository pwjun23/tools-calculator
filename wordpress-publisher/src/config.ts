import type { ResolvedConfig } from "./types.ts";

interface RawConfig {
  wordpress_url: string;
  api_endpoint: string;
  default_category?: string;
  default_tags?: string[];
}

export function loadConfig(
  env: Pick<NodeJS.ProcessEnv, "WP_USERNAME" | "WP_APP_PASSWORD">,
  raw: RawConfig,
): ResolvedConfig {
  const username = env.WP_USERNAME;
  if (!username) {
    throw new Error("WP_USERNAME이 .env에 설정되어 있지 않습니다.");
  }
  const appPassword = env.WP_APP_PASSWORD;
  if (!appPassword) {
    throw new Error("WP_APP_PASSWORD가 .env에 설정되어 있지 않습니다.");
  }
  return {
    baseUrl: `${raw.wordpress_url.replace(/\/$/, "")}${raw.api_endpoint}`,
    username,
    appPassword,
    defaultCategory: raw.default_category,
    defaultTags: raw.default_tags ?? [],
  };
}
