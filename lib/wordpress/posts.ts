import { createTaxonomyResolver } from "./taxonomy";
import type { WpClient } from "./client";
import type {
  PostInput,
  PostPatch,
  PostResult,
  ResolvedConfig,
  ScheduleInput,
  SeoMetaInput,
} from "./types";

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const KST_PATTERN = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/;

export function kstToUtc(kst: string, now: Date = new Date()): Date {
  const match = KST_PATTERN.exec(kst.trim());
  if (!match) {
    throw new Error(`발행 시각 형식이 올바르지 않습니다: "${kst}" (예: "2026-09-28 09:00")`);
  }
  const [, y, mo, d, h, mi] = match;
  const utcMs =
    Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi)) - KST_OFFSET_MS;

  if (utcMs <= now.getTime()) {
    throw new Error(`발행 시각이 과거입니다: "${kst}" (한국 시간 기준)`);
  }
  return new Date(utcMs);
}

export function toWpDateGmt(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "");
}

/** WordPress의 date_gmt(오프셋 없는 UTC 문자열)를 "YYYY-MM-DD HH:mm" 한국시간 문자열로 바꾼다. */
export function formatDateGmtAsKst(dateGmt: string): string {
  const iso = dateGmt.endsWith("Z") ? dateGmt : `${dateGmt}Z`;
  const kst = new Date(new Date(iso).getTime() + KST_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${kst.getUTCFullYear()}-${pad(kst.getUTCMonth() + 1)}-${pad(kst.getUTCDate())} ${pad(kst.getUTCHours())}:${pad(kst.getUTCMinutes())}`;
}

interface WpPostResponse {
  id: number;
  link: string;
  status: string;
}

interface WpPostResponseWithMeta extends WpPostResponse {
  meta?: Record<string, string>;
}

function buildSeoMeta(seo?: SeoMetaInput): Record<string, string> | undefined {
  if (!seo) return undefined;
  const meta: Record<string, string> = {};
  if (seo.focusKeyword !== undefined) meta._yoast_wpseo_focuskw = seo.focusKeyword;
  if (seo.metaDescription !== undefined) meta._yoast_wpseo_metadesc = seo.metaDescription;
  return meta;
}

async function resolveTaxonomy(
  client: WpClient,
  config: ResolvedConfig,
  category: string | undefined,
  tags: string[] | undefined,
): Promise<{ categoryId?: number; tagIds: number[] }> {
  const taxonomy = createTaxonomyResolver(client);
  const categoryName = category ?? config.defaultCategory;
  const tagNames = tags ?? config.defaultTags;
  const [categoryId, tagIds] = await Promise.all([
    categoryName ? taxonomy.resolveCategoryId(categoryName) : Promise.resolve(undefined),
    taxonomy.resolveTagIds(tagNames),
  ]);
  return { categoryId, tagIds };
}

export async function createPost(
  client: WpClient,
  config: ResolvedConfig,
  input: PostInput,
  opts: { publish?: boolean } = {},
): Promise<PostResult> {
  const { categoryId, tagIds } = await resolveTaxonomy(client, config, input.category, input.tags);
  const status = opts.publish ? input.status ?? "publish" : "draft";

  const body: Record<string, unknown> = { title: input.title, content: input.contentHtml, status };
  if (categoryId !== undefined) body.categories = [categoryId];
  if (tagIds.length > 0) body.tags = tagIds;
  const meta = buildSeoMeta(input.seo);
  if (meta) body.meta = meta;

  const response = await client.request<WpPostResponse>({ method: "POST", path: "/posts", body });
  return { id: response.id, url: response.link, status: response.status };
}

async function buildPatchBody(
  client: WpClient,
  patch: PostPatch,
  opts: { publish?: boolean },
): Promise<Record<string, unknown>> {
  const body: Record<string, unknown> = {};
  if (patch.title !== undefined) body.title = patch.title;
  if (patch.contentHtml !== undefined) body.content = patch.contentHtml;

  if (patch.category !== undefined || patch.tags !== undefined) {
    const taxonomy = createTaxonomyResolver(client);
    if (patch.category !== undefined) {
      body.categories = [await taxonomy.resolveCategoryId(patch.category)];
    }
    if (patch.tags !== undefined) {
      body.tags = await taxonomy.resolveTagIds(patch.tags);
    }
  }

  if (patch.status !== undefined) {
    body.status = opts.publish ? patch.status : "draft";
  }

  const meta = buildSeoMeta(patch.seo);
  if (meta) body.meta = meta;

  return body;
}

export async function updatePost(
  client: WpClient,
  config: ResolvedConfig,
  id: number,
  patch: PostPatch,
  opts: { publish?: boolean } = {},
): Promise<PostResult> {
  const body = await buildPatchBody(client, patch, opts);
  const response = await client.request<WpPostResponse>({ method: "POST", path: `/posts/${id}`, body });
  return { id: response.id, url: response.link, status: response.status };
}

export async function addSeoMeta(
  client: WpClient,
  config: ResolvedConfig,
  id: number,
  meta: SeoMetaInput,
): Promise<PostResult & { warning?: string }> {
  const body = { meta: buildSeoMeta(meta) };
  const response = await client.request<WpPostResponseWithMeta>({
    method: "POST",
    path: `/posts/${id}`,
    body,
  });

  const applied = response.meta ?? {};
  const mismatch =
    (meta.focusKeyword !== undefined && applied._yoast_wpseo_focuskw !== meta.focusKeyword) ||
    (meta.metaDescription !== undefined && applied._yoast_wpseo_metadesc !== meta.metaDescription);

  return {
    id: response.id,
    url: response.link,
    status: response.status,
    warning: mismatch
      ? "WordPress가 Yoast 메타를 저장하지 않았습니다. wp-content/mu-plugins/enable-yoast-rest-meta.php를 사이트에 설치했는지 확인하세요."
      : undefined,
  };
}

export async function schedulePost(
  client: WpClient,
  config: ResolvedConfig,
  input: ScheduleInput,
  opts: { now?: Date } = {},
): Promise<PostResult> {
  const utc = kstToUtc(input.publishAtKst, opts.now);
  const { categoryId, tagIds } = await resolveTaxonomy(client, config, input.category, input.tags);

  const body: Record<string, unknown> = {
    title: input.title,
    content: input.contentHtml,
    status: "future",
    date_gmt: toWpDateGmt(utc),
  };
  if (categoryId !== undefined) body.categories = [categoryId];
  if (tagIds.length > 0) body.tags = tagIds;
  const meta = buildSeoMeta(input.seo);
  if (meta) body.meta = meta;

  const response = await client.request<WpPostResponse>({ method: "POST", path: "/posts", body });
  return { id: response.id, url: response.link, status: response.status };
}
