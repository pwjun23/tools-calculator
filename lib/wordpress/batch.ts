import { parse as parseCsv } from "csv-parse/sync";
import { addSeoMeta, createPost, schedulePost } from "./posts";
import type { WpClient } from "./client";
import type { PostInput, Report, ResolvedConfig, SeoMetaInput } from "./types";

type BulkRow = PostInput & { publishAtKst?: string };
type MetaRow = SeoMetaInput & { id: number };

export function parseBulkCreateRows(text: string, format: "json" | "csv"): BulkRow[] {
  if (format === "json") {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) {
      throw new Error("JSON은 배열 형식이어야 합니다.");
    }
    return parsed as BulkRow[];
  }
  const rows = parseCsv(text, { columns: true, skip_empty_lines: true }) as Record<string, string>[];
  return rows.map((row) => ({
    title: row.title,
    contentHtml: row.content ?? "",
    category: row.category || undefined,
    tags: row.tags ? row.tags.split(";").map((t) => t.trim()).filter(Boolean) : undefined,
    seo:
      row.focus_keyword || row.meta_description
        ? { focusKeyword: row.focus_keyword || undefined, metaDescription: row.meta_description || undefined }
        : undefined,
    publishAtKst: row.publish_at_kst || undefined,
  }));
}

export async function bulkCreate(
  client: WpClient,
  config: ResolvedConfig,
  rows: BulkRow[],
  opts: { publish?: boolean },
): Promise<Report> {
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
      report.items.push({ input: row, status: "error", error: e instanceof Error ? e.message : String(e) });
    }
  }
  return report;
}

export function parseBulkMetaRows(text: string, format: "json" | "csv"): MetaRow[] {
  if (format === "json") {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) {
      throw new Error("JSON은 배열 형식이어야 합니다.");
    }
    return parsed as MetaRow[];
  }
  const rows = parseCsv(text, { columns: true, skip_empty_lines: true }) as Record<string, string>[];
  return rows.map((row) => ({
    id: Number(row.id),
    focusKeyword: row.focus_keyword || undefined,
    metaDescription: row.meta_description || undefined,
  }));
}

export async function bulkUpdateMeta(
  client: WpClient,
  config: ResolvedConfig,
  rows: MetaRow[],
): Promise<Report> {
  const report: Report = { success: 0, failed: 0, items: [] };

  for (const row of rows) {
    try {
      const result = await addSeoMeta(client, config, row.id, row);
      report.success += 1;
      report.items.push({ input: row, status: "success", result });
    } catch (e) {
      report.failed += 1;
      report.items.push({ input: row, status: "error", error: e instanceof Error ? e.message : String(e) });
    }
  }
  return report;
}
