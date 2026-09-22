import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parse as parseCsv } from "csv-parse/sync";
import { createPost, schedulePost } from "./posts.ts";
import type { WpClient } from "./client.ts";
import type { PostInput, Report, ResolvedConfig } from "./types.ts";

type BulkRow = PostInput & { publishAtKst?: string };

function parseCsvRows(filePath: string): BulkRow[] {
  const rows = parseCsv(readFileSync(filePath, "utf8"), {
    columns: true,
    skip_empty_lines: true,
  }) as Record<string, string>[];
  const baseDir = dirname(filePath);

  return rows.map((row) => ({
    title: row.title,
    contentHtml: row.content_file
      ? readFileSync(join(baseDir, row.content_file), "utf8")
      : row.content ?? "",
    category: row.category || undefined,
    tags: row.tags ? row.tags.split(";").map((t) => t.trim()).filter(Boolean) : undefined,
    seo:
      row.focus_keyword || row.meta_description
        ? { focusKeyword: row.focus_keyword || undefined, metaDescription: row.meta_description || undefined }
        : undefined,
    publishAtKst: row.publish_at_kst || undefined,
  }));
}

export function parseBulkCreateRows(filePath: string): BulkRow[] {
  if (filePath.endsWith(".csv")) return parseCsvRows(filePath);
  return JSON.parse(readFileSync(filePath, "utf8")) as BulkRow[];
}

export async function bulkCreate(
  client: WpClient,
  config: ResolvedConfig,
  filePath: string,
  opts: { publish?: boolean },
): Promise<Report> {
  const rows = parseBulkCreateRows(filePath);
  const report: Report = { success: 0, failed: 0, items: [] };

  for (const row of rows) {
    try {
      const { publishAtKst, ...post } = row;
      const result = publishAtKst
        ? await schedulePost(client, config, { ...post, publishAtKst })
        : await createPost(client, config, post, opts);
      report.success += 1;
      report.items.push({ input: row, status: "success", result });
    } catch (e) {
      report.failed += 1;
      report.items.push({ input: row, status: "error", error: (e as Error).message });
    }
  }
  return report;
}
