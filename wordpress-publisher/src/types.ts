export interface SeoMetaInput {
  focusKeyword?: string;
  metaDescription?: string;
  /**
   * 추가 관련 키워드. Yoast Premium의 관련 키프레이즈 필드(_yoast_wpseo_focuskeywords)에
   * 매핑되고, internalLinks를 직접 주지 않았을 때 관련 글 자동 검색의 검색어로도 쓰인다.
   */
  relatedKeywords?: string[];
}

export interface ImageInput {
  url: string;
  /** 접근성을 위해 필수. 비어 있으면 에러를 던진다. */
  alt: string;
  caption?: string;
}

export interface InternalLink {
  url: string;
  anchorText: string;
}

export interface PostInput {
  title: string;
  contentHtml: string;
  /** 워드프레스 글 주소(퍼머링크)에 쓸 슬러그. 생략하면 워드프레스가 제목에서 자동으로 만든다. */
  slug?: string;
  category?: string;
  tags?: string[];
  status?: "draft" | "publish";
  seo?: SeoMetaInput;
  /**
   * calculators.ts의 슬러그. contentHtml에 {{calculator}} 마커가 있으면 그 자리에,
   * 없으면 본문 끝에 해당 계산기로 연결되는 CTA를 자동으로 붙인다.
   */
  calculator?: string;
  /** 지정하면 이 목록으로 "관련 글" 섹션을 만든다. 생략하면 seo.relatedKeywords로 자동 검색한다. */
  internalLinks?: InternalLink[];
  /**
   * contentHtml에 있는 {{image}} 마커 자리에 순서대로 삽입되고, 마커가 없거나 이미지가 더
   * 많으면 남는 이미지는 본문 끝에 붙는다. alt 텍스트가 없는 이미지가 있으면 에러를 던진다.
   */
  images?: ImageInput[];
}

export type PostPatch = Partial<PostInput>;

export interface ScheduleInput extends PostInput {
  publishAtKst: string;
}

export interface PostResult {
  id: number;
  url: string;
  status: string;
}

export interface WpDryRunResult {
  dryRun: true;
  method: "GET" | "POST";
  url: string;
  body?: unknown;
}

export function isDryRunResult(value: unknown): value is WpDryRunResult {
  return typeof value === "object" && value !== null && (value as { dryRun?: unknown }).dryRun === true;
}

export interface ReportItem {
  input: unknown;
  status: "success" | "error";
  result?: PostResult & { warning?: string };
  error?: string;
}

export interface Report {
  success: number;
  failed: number;
  items: ReportItem[];
}

export interface ResolvedConfig {
  baseUrl: string;
  username: string;
  appPassword: string;
  defaultCategory?: string;
  defaultTags: string[];
}
