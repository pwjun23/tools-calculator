export interface SeoMetaInput {
  focusKeyword?: string;
  metaDescription?: string;
}

export interface PostInput {
  title: string;
  contentHtml: string;
  category?: string;
  tags?: string[];
  status?: "draft" | "publish";
  seo?: SeoMetaInput;
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
  result?: PostResult;
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
