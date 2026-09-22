import { type WpDryRunResult } from "./types.ts";

export class WpApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "WpApiError";
    this.status = status;
    this.code = code;
  }
}

export interface WpRequest {
  method: "GET" | "POST";
  path: string;
  body?: unknown;
}

export interface WpClientOptions {
  baseUrl: string;
  username: string;
  appPassword: string;
  dryRun?: boolean;
  fetchImpl?: typeof fetch;
}

export interface WpClient {
  dryRun: boolean;
  request<T>(req: WpRequest): Promise<T | WpDryRunResult>;
}

export function createClient(opts: WpClientOptions): WpClient {
  const authHeader = "Basic " + Buffer.from(`${opts.username}:${opts.appPassword}`).toString("base64");
  const fetchImpl = opts.fetchImpl ?? fetch;
  const dryRun = opts.dryRun ?? false;

  return {
    dryRun,
    async request<T>(req: WpRequest): Promise<T | WpDryRunResult> {
      const url = `${opts.baseUrl}${req.path}`;

      if (dryRun) {
        return { dryRun: true, method: req.method, url, body: req.body };
      }

      const res = await fetchImpl(url, {
        method: req.method,
        headers: { "Content-Type": "application/json", Authorization: authHeader },
        body: req.body !== undefined ? JSON.stringify(req.body) : undefined,
      });
      const json: unknown = await res.json().catch(() => ({}));

      if (!res.ok) {
        const errBody = json as { message?: string; code?: string };
        throw new WpApiError(
          errBody.message ?? `WordPress API 오류 (HTTP ${res.status})`,
          res.status,
          errBody.code,
        );
      }
      return json as T;
    },
  };
}
