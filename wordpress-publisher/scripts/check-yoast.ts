import "dotenv/config";
import { readFileSync } from "node:fs";
import { createClient } from "../src/client.ts";
import { loadConfig } from "../src/config.ts";
import { createPost } from "../src/posts.ts";

async function main() {
  try {
    const config = loadConfig(
      process.env as Pick<NodeJS.ProcessEnv, "WP_USERNAME" | "WP_APP_PASSWORD">,
      JSON.parse(readFileSync(new URL("../config.json", import.meta.url), "utf8")),
    );
    const client = createClient({
      baseUrl: config.baseUrl,
      username: config.username,
      appPassword: config.appPassword,
    });

    console.log("진단용 draft 글을 만들어 Yoast 메타 쓰기를 테스트합니다...");
    const testValue = `check-${Date.now()}`;
    const result = await createPost(client, config, {
      title: "WP Publisher — Yoast 진단용 (삭제 가능)",
      contentHtml: "<p>이 글은 Yoast REST 메타 쓰기가 되는지 확인하기 위한 테스트 draft입니다. 확인 후 삭제해도 됩니다.</p>",
      seo: { focusKeyword: testValue, metaDescription: testValue },
    });

    const raw = (await client.request<{ meta?: Record<string, string> }>({
      method: "GET",
      path: `/posts/${result.id}?context=edit`,
    })) as { meta?: Record<string, string> };

    const ok = raw.meta?._yoast_wpseo_focuskw === testValue && raw.meta?._yoast_wpseo_metadesc === testValue;

    console.log(`\n글 ID: ${result.id} (${result.url})`);
    if (ok) {
      console.log("✓ Yoast 메타 쓰기가 이미 가능합니다. mu-plugin을 설치할 필요 없습니다.");
    } else {
      console.log(
        "✗ Yoast 메타가 저장되지 않았습니다. wp-content/mu-plugins/enable-yoast-rest-meta.php를 사이트의 " +
          "wp-content/mu-plugins/ 폴더에 업로드한 뒤 다시 실행해 보세요.",
      );
      process.exitCode = 1;
    }
    console.log("\n이 테스트 draft 글은 WordPress 관리자에서 삭제해도 됩니다.");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`\n진단 스크립트 실행 중 오류가 발생했습니다: ${errorMessage}`);
    process.exitCode = 1;
  }
}

main();
