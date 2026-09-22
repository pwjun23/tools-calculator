import { createTaxonomyResolver } from "./taxonomy.ts";
import { isDryRunResult } from "./types.ts";
import type { WpClient } from "./client.ts";
import type { PostInput, PostResult, ResolvedConfig } from "./types.ts";

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
