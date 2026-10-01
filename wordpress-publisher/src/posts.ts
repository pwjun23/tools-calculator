import { createTaxonomyResolver } from "./taxonomy.ts";
import { buildFinalContentHtml } from "./content.ts";
import { isDryRunResult } from "./types.ts";
import { kstToUtc, toWpDateGmt } from "./schedule.ts";
import type { WpClient } from "./client.ts";
import type { PostInput, PostResult, ResolvedConfig, PostPatch, SeoMetaInput, ScheduleInput } from "./types.ts";

interface WpPostResponse {
  id: number;
  link: string;
  status: string;
}

function buildSeoMeta(seo?: SeoMetaInput): Record<string, string> | undefined {
  if (!seo) return undefined;
  const meta: Record<string, string> = {};
  if (seo.focusKeyword !== undefined) meta._yoast_wpseo_focuskw = seo.focusKeyword;
  if (seo.metaDescription !== undefined) meta._yoast_wpseo_metadesc = seo.metaDescription;
  if (seo.relatedKeywords !== undefined && seo.relatedKeywords.length > 0) {
    meta._yoast_wpseo_focuskeywords = JSON.stringify(
      seo.relatedKeywords.map((keyword) => ({ keyword, score: "0" })),
    );
  }
  return meta;
}

export async function createPost(
  client: WpClient,
  config: ResolvedConfig,
  input: PostInput,
  opts: { publish?: boolean } = {},
): Promise<PostResult> {
  const content = await buildFinalContentHtml(client, input);

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
    content,
    status,
  };
  if (input.slug !== undefined) body.slug = input.slug;
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
  id: number,
  patch: PostPatch,
  opts: { publish?: boolean; now?: Date },
): Promise<Record<string, unknown>> {
  const body: Record<string, unknown> = {};
  if (patch.title !== undefined) body.title = patch.title;
  if (patch.slug !== undefined) body.slug = patch.slug;

  const hasContentExtras =
    patch.calculator !== undefined || patch.images !== undefined || patch.internalLinks !== undefined;

  if (patch.contentHtml !== undefined) {
    body.content = await buildFinalContentHtml(
      client,
      {
        contentHtml: patch.contentHtml,
        calculator: patch.calculator,
        images: patch.images,
        internalLinks: patch.internalLinks,
        seo: patch.seo,
      },
      { excludeId: id },
    );
  } else if (hasContentExtras) {
    throw new Error("calculator/images/internalLinks를 지정하려면 contentHtml도 함께 전달해야 합니다.");
  }

  if (patch.category !== undefined || patch.tags !== undefined) {
    const taxonomy = createTaxonomyResolver(client);
    if (patch.category !== undefined) {
      body.categories = [await taxonomy.resolveCategoryId(patch.category)];
    }
    if (patch.tags !== undefined) {
      body.tags = await taxonomy.resolveTagIds(patch.tags);
    }
  }

  if (patch.publishAtKst !== undefined) {
    if (patch.status !== undefined) {
      throw new Error("publishAtKst와 status를 동시에 지정할 수 없습니다.");
    }
    const utc = kstToUtc(patch.publishAtKst, opts.now);
    body.status = "future";
    body.date_gmt = toWpDateGmt(utc);
  } else if (patch.status !== undefined) {
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
  opts: { publish?: boolean; now?: Date } = {},
): Promise<PostResult> {
  const body = await buildPatchBody(client, config, id, patch, opts);
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
    (meta.metaDescription !== undefined && applied._yoast_wpseo_metadesc !== meta.metaDescription) ||
    (meta.relatedKeywords !== undefined &&
      meta.relatedKeywords.length > 0 &&
      !applied._yoast_wpseo_focuskeywords);

  return {
    id: response.id,
    url: response.link,
    status: response.status,
    warning: mismatch
      ? "WordPress가 Yoast 메타를 저장하지 않았습니다. wp-content/mu-plugins/enable-yoast-rest-meta.php를 사이트에 설치했는지 확인하세요 (relatedKeywords는 Yoast Premium 전용 필드입니다)."
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
  const { publishAtKst, ...rest } = input;

  const content = await buildFinalContentHtml(client, rest);

  const taxonomy = createTaxonomyResolver(client);
  const categoryName = rest.category ?? config.defaultCategory;
  const tagNames = rest.tags ?? config.defaultTags;
  const [categoryId, tagIds] = await Promise.all([
    categoryName ? taxonomy.resolveCategoryId(categoryName) : Promise.resolve(undefined),
    taxonomy.resolveTagIds(tagNames),
  ]);

  const body: Record<string, unknown> = {
    title: rest.title,
    content,
    status: "future",
    date_gmt: toWpDateGmt(utc),
  };
  if (rest.slug !== undefined) body.slug = rest.slug;
  if (categoryId !== undefined) body.categories = [categoryId];
  if (tagIds.length > 0) body.tags = tagIds;
  const meta = buildSeoMeta(rest.seo);
  if (meta) body.meta = meta;

  const response = await client.request<WpPostResponse>({
    method: "POST",
    path: "/posts",
    body,
  });

  if (isDryRunResult(response)) {
    return { id: 0, url: "(dry-run)", status: "future" };
  }
  return { id: response.id, url: response.link, status: response.status };
}
