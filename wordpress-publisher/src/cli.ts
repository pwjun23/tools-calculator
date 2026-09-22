import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseArgs } from "./cli-args.ts";
import { loadConfig } from "./config.ts";
import { createClient } from "./client.ts";
import { createLogger } from "./logger.ts";
import { createPost, updatePost, addSeoMeta, schedulePost } from "./posts.ts";
import { bulkCreate, bulkUpdateMeta } from "./batch.ts";
import type { PostInput } from "./types.ts";

function readConfigJson(): { wordpress_url: string; api_endpoint: string; default_category?: string; default_tags?: string[] } {
  return JSON.parse(readFileSync(new URL("../config.json", import.meta.url), "utf8"));
}

function splitTags(value: string | true | undefined): string[] | undefined {
  if (typeof value !== "string") return undefined;
  return value.split(",").map((t) => t.trim()).filter(Boolean);
}

async function main() {
  const logger = createLogger(fileURLToPath(new URL("../logs", import.meta.url)));
  let command = "unknown";
  let flags: Record<string, string | true> = {};

  try {
    ({ command, flags } = parseArgs(process.argv.slice(2)));
    const config = loadConfig(
      { WP_USERNAME: process.env.WP_USERNAME, WP_APP_PASSWORD: process.env.WP_APP_PASSWORD },
      readConfigJson(),
    );
    const dryRun = flags["dry-run"] === true;
    const publish = flags.publish === true;
    const client = createClient({
      baseUrl: config.baseUrl,
      username: config.username,
      appPassword: config.appPassword,
      dryRun,
    });

    if (command === "create") {
      const input: PostInput = {
        title: String(flags.title ?? ""),
        contentHtml: String(flags["content-file"] ? readFileSync(String(flags["content-file"]), "utf8") : flags.content ?? ""),
        category: typeof flags.category === "string" ? flags.category : undefined,
        tags: splitTags(flags.tags),
        seo: flags["focus-keyword"] || flags["meta-description"] ? {
          focusKeyword: typeof flags["focus-keyword"] === "string" ? flags["focus-keyword"] : undefined,
          metaDescription: typeof flags["meta-description"] === "string" ? flags["meta-description"] : undefined,
        } : undefined,
      };
      const result = await createPost(client, config, input, { publish });
      logger.log({ action: "create", input, status: "success", postId: result.id, url: result.url });
      console.log(result);
    } else if (command === "update") {
      const id = Number(flags.id);
      const result = await updatePost(client, config, id, {
        title: typeof flags.title === "string" ? flags.title : undefined,
        category: typeof flags.category === "string" ? flags.category : undefined,
        tags: splitTags(flags.tags),
      }, { publish });
      logger.log({ action: "update", input: { id, flags }, status: "success", postId: result.id, url: result.url });
      console.log(result);
    } else if (command === "add-seo") {
      const id = Number(flags.id);
      const result = await addSeoMeta(client, config, id, {
        focusKeyword: typeof flags["focus-keyword"] === "string" ? flags["focus-keyword"] : undefined,
        metaDescription: typeof flags["meta-description"] === "string" ? flags["meta-description"] : undefined,
      });
      logger.log({ action: "add-seo", input: { id }, status: "success", postId: result.id, url: result.url });
      console.log(result);
      if (result.warning) console.warn(`\n⚠ ${result.warning}`);
    } else if (command === "schedule") {
      const input = {
        title: String(flags.title ?? ""),
        contentHtml: String(flags["content-file"] ? readFileSync(String(flags["content-file"]), "utf8") : flags.content ?? ""),
        category: typeof flags.category === "string" ? flags.category : undefined,
        tags: splitTags(flags.tags),
        publishAtKst: String(flags["publish-at"] ?? ""),
      };
      const result = await schedulePost(client, config, input);
      logger.log({ action: "schedule", input, status: "success", postId: result.id, url: result.url });
      console.log(result);
    } else if (command === "batch-create") {
      const report = await bulkCreate(client, config, String(flags.file), { publish });
      report.items.forEach((item) =>
        logger.log({
          action: "batch-create",
          input: item.input,
          status: item.status,
          postId: item.result?.id,
          url: item.result?.url,
          error: item.error,
        }),
      );
      console.log(`성공 ${report.success} / 실패 ${report.failed}`);
    } else if (command === "batch-update-meta") {
      const report = await bulkUpdateMeta(client, config, String(flags.file));
      report.items.forEach((item) => {
        logger.log({
          action: "batch-update-meta",
          input: item.input,
          status: item.status,
          postId: item.result?.id,
          url: item.result?.url,
          error: item.error,
          warning: item.result?.warning,
        });
        if (item.result?.warning) {
          console.warn(`\n⚠ post ${item.result.id}: ${item.result.warning}`);
        }
      });
      console.log(`성공 ${report.success} / 실패 ${report.failed}`);
    } else {
      throw new Error(`알 수 없는 명령입니다: ${command}`);
    }
  } catch (e) {
    logger.log({ action: command, input: flags, status: "error", error: (e as Error).message });
    console.error(`\n✗ ${(e as Error).message}`);
    process.exitCode = 1;
  } finally {
    logger.finish();
  }
}

main();
