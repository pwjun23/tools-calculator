"use client";

import { useState, useTransition } from "react";
import { createPostAction, scheduleAction } from "../actions";
import { ResultPanel, type ActionResult } from "./ResultPanel";

type Mode = "draft" | "publish" | "schedule";

export function SinglePostForm() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState("");
  const [mode, setMode] = useState<Mode>("draft");
  const [publishAt, setPublishAt] = useState("");
  const [result, setResult] = useState<ActionResult>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!title.trim()) {
      setResult({ ok: false, error: "제목을 입력해 주세요." });
      return;
    }
    const tagList = tags.split(",").map((t) => t.trim()).filter(Boolean);
    const input = {
      title,
      contentHtml: content,
      category: category || undefined,
      tags: tagList.length > 0 ? tagList : undefined,
    };

    startTransition(async () => {
      const r =
        mode === "schedule"
          ? await scheduleAction({ ...input, publishAtKst: publishAt })
          : await createPostAction(input, mode === "publish");
      setResult(r);
    });
  }

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-base font-bold">단일 글 등록</h2>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="제목"
        className="w-full rounded-xl border border-slate-300 px-4 py-2 dark:border-slate-700 dark:bg-slate-950"
      />
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="내용 (HTML)"
        rows={6}
        className="w-full rounded-xl border border-slate-300 px-4 py-2 dark:border-slate-700 dark:bg-slate-950"
      />
      <div className="flex gap-3">
        <input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="카테고리"
          className="flex-1 rounded-xl border border-slate-300 px-4 py-2 dark:border-slate-700 dark:bg-slate-950"
        />
        <input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="태그 (쉼표로 구분)"
          className="flex-1 rounded-xl border border-slate-300 px-4 py-2 dark:border-slate-700 dark:bg-slate-950"
        />
      </div>
      <div role="radiogroup" className="flex gap-3 text-sm">
        {(["draft", "publish", "schedule"] as const).map((m) => (
          <label key={m} className="flex items-center gap-1.5">
            <input type="radio" checked={mode === m} onChange={() => setMode(m)} />
            {m === "draft" ? "초안" : m === "publish" ? "지금 발행" : "예약"}
          </label>
        ))}
      </div>
      {mode === "schedule" && (
        <input
          value={publishAt}
          onChange={(e) => setPublishAt(e.target.value)}
          placeholder="2026-09-28 09:00 (한국 시간)"
          className="w-full rounded-xl border border-slate-300 px-4 py-2 dark:border-slate-700 dark:bg-slate-950"
        />
      )}
      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className="rounded-xl bg-emerald-600 px-4 py-2 font-semibold text-white disabled:opacity-50"
      >
        {pending ? "처리 중..." : "등록"}
      </button>
      <ResultPanel result={result} />
    </section>
  );
}
