import type { WpClient } from "./client.ts";
import type { InternalLink } from "./types.ts";

interface WpSearchResult {
  id: number;
  link: string;
  title: string | { rendered: string };
}

const MAX_AUTO_LINKS = 3;

/**
 * relatedKeywords로 기존 WordPress 글을 검색해 "관련 글" 내부 링크를 자동으로 만든다.
 * dry-run에서는 실제 검색을 하지 않고 빈 배열을 돌려준다.
 */
export async function findRelatedPosts(
  client: WpClient,
  keywords: string[],
  opts: { excludeId?: number } = {},
): Promise<InternalLink[]> {
  if (client.dryRun || keywords.length === 0) return [];

  const found = new Map<number, InternalLink>();

  for (const keyword of keywords) {
    if (found.size >= MAX_AUTO_LINKS) break;

    const results = (await client.request<WpSearchResult[]>({
      method: "GET",
      path: `/posts?search=${encodeURIComponent(keyword)}&per_page=${MAX_AUTO_LINKS}&_fields=id,link,title`,
    })) as WpSearchResult[];

    for (const post of results) {
      if (found.size >= MAX_AUTO_LINKS) break;
      if (post.id === opts.excludeId || found.has(post.id)) continue;
      const anchorText = typeof post.title === "string" ? post.title : post.title.rendered;
      found.set(post.id, { url: post.link, anchorText });
    }
  }

  return [...found.values()];
}
