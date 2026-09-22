import { createTaxonomyResolver } from "./taxonomy.ts";
import { isDryRunResult } from "./types.ts";
import type { WpClient } from "./client.ts";
import type { PostInput, PostResult, ResolvedConfig, PostPatch, SeoMetaInput } from "./types.ts";

interface WpPostResponse {
  id: number;
  link: string;
  status: string;
}

function buildSeoMeta(seo?: PostInput["seo"]): Record<string, string> | undefined {
  if (!seo) return undefined;
  const meta: Record<string, string> = {};
  if (seo.focusKeyword !== undefined) meta._yoast_wpseo_focuskw = seo.focusKeyword;
  if (seo.metaDescription !== undefined) meta._yoast_wpseo_metadesc = seo.metaDescription;
  return meta;
}

export async function createPost(
  client: WpClient,
  config: ResolvedConfig,
  input: PostInput,
  opts: { publish?: boolean } = {},
): Promise<PostResult> {
  const taxonomy = createTaxonomyResolver(client);
  const categoryName = input.category ?? config.defaultCategory;
  const tagNames = input.tags ?? config.defaultTags;

  const [categoryId, tagIds] = await Promise.all([
    categoryName ? taxonomy.resolveCategoryId(categoryName) : Promise.resolve(undefined),
    taxonomy.resolveTagIds(tagNames),
  ]);

  const status = opts.publish ? input.status ?? "publish" : "draft";

  const body: Record<string, unknown> = {
    title: input.title,
    content: input.contentHtml,
    status,
  };
  if (categoryId !== undefined) body.categories = [categoryId];
  if (tagIds.length > 0) body.tags = tagIds;
  const meta = buildSeoMeta(input.seo);
  if (meta) body.meta = meta;

  const response = await client.request<WpPostResponse>({
    method: "POST",
    path: "/posts",
    body,
  });

  if (isDryRunResult(response)) {
    return { id: 0, url: "(dry-run)", status };
  }
  return { id: response.id, url: response.link, status: response.status };
}

interface WpPostResponseWithMeta extends WpPostResponse {
  meta?: Record<string, string>;
}

async function buildPatchBody(
  client: WpClient,
  config: ResolvedConfig,
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
  const body = await buildPatchBody(client, config, patch, opts);
  const response = await client.request<WpPostResponse>({
    method: "POST",
    path: `/posts/${id}`,
    body,
  });

  if (isDryRunResult(response)) {
    return { id, url: "(dry-run)", status: "(변경 없음)" };
  }
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

  if (isDryRunResult(response)) {
    return { id, url: "(dry-run)", status: "(변경 없음)" };
  }

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
