import { resolveCalculator } from "./calculators.ts";
import { findRelatedPosts } from "./internal-links.ts";
import type { WpClient } from "./client.ts";
import type { ImageInput, InternalLink, SeoMetaInput } from "./types.ts";

export interface ContentBuildInput {
  contentHtml: string;
  calculator?: string;
  images?: ImageInput[];
  internalLinks?: InternalLink[];
  seo?: Pick<SeoMetaInput, "relatedKeywords">;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** alt 텍스트가 없는 이미지가 있으면 에러를 던진다. */
export function validateImages(images: ImageInput[] | undefined): void {
  if (!images) return;
  images.forEach((image, index) => {
    if (!image.alt || !image.alt.trim()) {
      throw new Error(`images[${index}] (${image.url})에는 alt 텍스트가 필요합니다.`);
    }
  });
}

function buildImagesHtml(images?: ImageInput[]): string {
  if (!images || images.length === 0) return "";
  return images
    .map((image) => {
      const img = `<img src="${escapeHtml(image.url)}" alt="${escapeHtml(image.alt)}" loading="lazy" />`;
      return image.caption
        ? `<figure>${img}<figcaption>${escapeHtml(image.caption)}</figcaption></figure>`
        : img;
    })
    .join("\n");
}

function buildCalculatorCtaHtml(slug?: string): string {
  if (!slug) return "";
  const calculator = resolveCalculator(slug);
  return `<p><strong>${escapeHtml(calculator.title)}</strong>로 직접 계산해보세요 → <a href="${calculator.url}" target="_blank" rel="noopener">${escapeHtml(calculator.url)}</a></p>`;
}

function buildInternalLinksHtml(links?: InternalLink[]): string {
  if (!links || links.length === 0) return "";
  const items = links
    .map((link) => `<li><a href="${escapeHtml(link.url)}">${escapeHtml(link.anchorText)}</a></li>`)
    .join("\n");
  return `<h3>함께 보면 좋은 글</h3>\n<ul>\n${items}\n</ul>`;
}

/**
 * 본문 끝에 이미지, 계산기 CTA, 관련 글 링크를 자동으로 이어붙인다.
 * internalLinks를 직접 주지 않고 seo.relatedKeywords만 있으면 WordPress에서 관련 글을 검색해 채운다
 * (dry-run에서는 검색하지 않는다).
 */
export async function buildFinalContentHtml(
  client: WpClient,
  input: ContentBuildInput,
  opts: { excludeId?: number } = {},
): Promise<string> {
  validateImages(input.images);

  const links =
    input.internalLinks ??
    (input.seo?.relatedKeywords?.length
      ? await findRelatedPosts(client, input.seo.relatedKeywords, opts)
      : undefined);

  const blocks = [
    input.contentHtml,
    buildImagesHtml(input.images),
    buildCalculatorCtaHtml(input.calculator),
    buildInternalLinksHtml(links),
  ].filter(Boolean);

  return blocks.join("\n\n");
}
