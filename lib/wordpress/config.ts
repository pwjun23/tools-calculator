import type { ResolvedConfig } from "./types";

const WORDPRESS_URL = "https://molespapa.com";
const API_ENDPOINT = "/wp-json/wp/v2";
const DEFAULT_CATEGORY = "부동산";
const DEFAULT_TAGS = ["계산기", "금융"];

export function loadConfig(env: NodeJS.ProcessEnv): ResolvedConfig {
  const username = env.WP_USERNAME;
  if (!username) {
    throw new Error("WP_USERNAME 환경변수가 설정되어 있지 않습니다.");
  }
  const appPassword = env.WP_APP_PASSWORD;
  if (!appPassword) {
    throw new Error("WP_APP_PASSWORD 환경변수가 설정되어 있지 않습니다.");
  }
  return {
    baseUrl: `${WORDPRESS_URL}${API_ENDPOINT}`,
    username,
    appPassword,
    defaultCategory: DEFAULT_CATEGORY,
    defaultTags: DEFAULT_TAGS,
  };
}
