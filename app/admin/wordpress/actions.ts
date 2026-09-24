"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/wordpress/client";
import { loadConfig } from "@/lib/wordpress/config";
import { createPost, schedulePost } from "@/lib/wordpress/posts";
import { bulkCreate, bulkUpdateMeta, parseBulkCreateRows, parseBulkMetaRows } from "@/lib/wordpress/batch";
import { isValidSessionCookie } from "@/lib/admin/session";
import type { PostInput, Report, ScheduleInput } from "@/lib/wordpress/types";

async function requireAdmin(): Promise<void> {
  const cookieStore = await cookies();
  const value = cookieStore.get("admin_session")?.value;
  if (!(await isValidSessionCookie(value))) {
    throw new Error("인증이 필요합니다. 다시 로그인해 주세요.");
  }
}

function client() {
  const config = loadConfig(process.env);
  return { client: createClient({ baseUrl: config.baseUrl, username: config.username, appPassword: config.appPassword }), config };
}

function requireTitle(input: { title: string }): void {
  if (!input.title || !input.title.trim()) {
    throw new Error("제목을 입력해 주세요.");
  }
}

export async function createPostAction(
  input: PostInput,
  publish: boolean,
): Promise<{ ok: true; id: number; url: string; status: string } | { ok: false; error: string }> {
  await requireAdmin();
  try {
    requireTitle(input);
    const { client: c, config } = client();
    const result = await createPost(c, config, input, { publish });
    return { ok: true, ...result };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function scheduleAction(
  input: ScheduleInput,
): Promise<{ ok: true; id: number; url: string; status: string } | { ok: false; error: string }> {
  await requireAdmin();
  try {
    requireTitle(input);
    const { client: c, config } = client();
    const result = await schedulePost(c, config, input);
    return { ok: true, ...result };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function bulkCreateAction(
  text: string,
  format: "json" | "csv",
  publish: boolean,
): Promise<{ ok: true; report: Report } | { ok: false; error: string }> {
  await requireAdmin();
  try {
    const rows = parseBulkCreateRows(text, format);
    const { client: c, config } = client();
    const report = await bulkCreate(c, config, rows, { publish });
    return { ok: true, report };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function bulkUpdateMetaAction(
  text: string,
  format: "json" | "csv",
): Promise<{ ok: true; report: Report } | { ok: false; error: string }> {
  await requireAdmin();
  try {
    const rows = parseBulkMetaRows(text, format);
    const { client: c, config } = client();
    const report = await bulkUpdateMeta(c, config, rows);
    return { ok: true, report };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export interface ScheduledPostSummary {
  id: number;
  title: string;
  dateGmt: string;
  link: string;
}

export async function listScheduledAction(): Promise<ScheduledPostSummary[]> {
  await requireAdmin();
  const { client: c } = client();
  const posts = await c.request<Array<{ id: number; title: { rendered: string }; date_gmt: string; link: string }>>({
    method: "GET",
    path: "/posts?status=future&per_page=50&context=edit",
  });
  return posts.map((p) => ({ id: p.id, title: p.title.rendered, dateGmt: p.date_gmt, link: p.link }));
}
