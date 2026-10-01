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

function renderImageHtml(image: ImageInput): string {
  const img = `<img src="${escapeHtml(image.url)}" alt="${escapeHtml(image.alt)}" loading="lazy" />`;
  return image.caption
    ? `<figure>${img}<figcaption>${escapeHtml(image.caption)}</figcaption></figure>`
    : img;
}

function buildImagesHtml(images: ImageInput[]): string {
  if (images.length === 0) return "";
  return images.map(renderImageHtml).join("\n");
}

const IMAGE_PLACEHOLDER = /\{\{image\}\}/g;

/**
 * contentHtml에 있는 {{image}} 마커를 앞에서부터 images로 순서대로 채운다.
 * 마커가 없으면(기존 동작) 모든 이미지를 본문 끝에 붙인다.
 * 이미지가 마커보다 많으면 남는 이미지는 본문 끝에 붙이고,
 * 마커가 이미지보다 많으면 에러를 던진다.
 */
function insertImages(contentHtml: string, images: ImageInput[] | undefined): string {
  if (!images || images.length === 0) return contentHtml;

  const markerCount = (contentHtml.match(IMAGE_PLACEHOLDER) ?? []).length;
  if (markerCount > images.length) {
    throw new Error(
      `본문의 {{image}} 마커(${markerCount}개)가 images 배열(${images.length}개)보다 많습니다.`,
    );
  }

  let index = 0;
  const withInlineImages = contentHtml.replace(IMAGE_PLACEHOLDER, () => renderImageHtml(images[index++]));

  const trailing = buildImagesHtml(images.slice(index));
  return trailing ? `${withInlineImages}\n\n${trailing}` : withInlineImages;
}

function buildCalculatorCtaHtml(slug?: string): string {
  if (!slug) return "";
  const calculator = resolveCalculator(slug);
  return `<p><strong>${escapeHtml(calculator.title)}</strong>로 직접 계산해보세요 → <a href="${calculator.url}" target="_blank" rel="noopener">${escapeHtml(calculator.url)}</a></p>`;
}

const CALCULATOR_PLACEHOLDER = /\{\{calculator\}\}/g;

/**
 * contentHtml에 {{calculator}} 마커가 있으면 그 자리(들)에 계산기 CTA를 끼워넣고,
 * 없으면 그대로 돌려준다(끝에 붙이는 건 buildFinalContentHtml이 처리).
 * 마커는 있는데 calculator 필드가 없으면 에러를 던진다.
 */
function insertCalculatorCta(contentHtml: string, slug: string | undefined): string {
  const hasMarker = CALCULATOR_PLACEHOLDER.test(contentHtml);
  CALCULATOR_PLACEHOLDER.lastIndex = 0;
  if (!hasMarker) return contentHtml;

  if (!slug) {
    throw new Error("본문에 {{calculator}} 마커가 있는데 calculator 필드가 없습니다.");
  }
  const cta = buildCalculatorCtaHtml(slug);
  return contentHtml.replace(CALCULATOR_PLACEHOLDER, () => cta);
}

function buildInternalLinksHtml(links?: InternalLink[]): string {
  if (!links || links.length === 0) return "";
  const items = links
    .map((link) => `<li><a href="${escapeHtml(link.url)}">${escapeHtml(link.anchorText)}</a></li>`)
    .join("\n");
  return `<h3>함께 보면 좋은 글</h3>\n<ul>\n${items}\n</ul>`;
}

/**
 * 이미지, 계산기 CTA, 관련 글 링크를 자동으로 채워 넣는다.
 * 이미지는 본문에 {{image}} 마커가 있으면 그 자리에, 없으면 본문 끝에 붙인다.
 * 계산기 CTA는 본문에 {{calculator}} 마커가 있으면 그 자리에, 없으면 본문 끝에 붙인다.
 * 관련 글 링크는 항상 맨 끝에 붙는다.
 * internalLinks를 직접 주지 않고 seo.relatedKeywords만 있으면 WordPress에서 관련 글을 검색해 채운다
 * (dry-run에서는 검색하지 않는다).
 */
export async function buildFinalContentHtml(
  client: WpClient,
  input: ContentBuildInput,
  opts: { excludeId?: number } = {},
): Promise<string> {
  validateImages(input.images);

  const withImages = insertImages(input.contentHtml, input.images);
  const calculatorInlined = CALCULATOR_PLACEHOLDER.test(withImages);
  CALCULATOR_PLACEHOLDER.lastIndex = 0;
  const withCalculator = insertCalculatorCta(withImages, input.calculator);

  const links =
    input.internalLinks ??
    (input.seo?.relatedKeywords?.length
      ? await findRelatedPosts(client, input.seo.relatedKeywords, opts)
      : undefined);

  const blocks = [
    withCalculator,
    calculatorInlined ? "" : buildCalculatorCtaHtml(input.calculator),
    buildInternalLinksHtml(links),
  ].filter(Boolean);

  return blocks.join("\n\n");
}
