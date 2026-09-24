"use client";

import { useRef, useState, useTransition } from "react";
import { bulkCreateAction, bulkUpdateMetaAction } from "../actions";
import type { Report } from "@/lib/wordpress/types";

type Kind = "create" | "meta";
type Result = { ok: true; report: Report } | { ok: false; error: string } | null;

export function BulkUploadForm() {
  const [kind, setKind] = useState<Kind>("create");
  const [text, setText] = useState("");
  const [format, setFormat] = useState<"json" | "csv">("json");
  const [publish, setPublish] = useState(false);
  const [result, setResult] = useState<Result>(null);
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setText(await file.text());
    setFormat(file.name.endsWith(".csv") ? "csv" : "json");
  }

  function submit() {
    startTransition(async () => {
      const r = kind === "create" ? await bulkCreateAction(text, format, publish) : await bulkUpdateMetaAction(text, format);
      setResult(r);
    });
  }

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-base font-bold">일괄 등록 / 메타 수정</h2>
      <div role="radiogroup" className="flex gap-3 text-sm">
        <label className="flex items-center gap-1.5">
          <input type="radio" checked={kind === "create"} onChange={() => setKind("create")} />
          새 글 여러 건
        </label>
        <label className="flex items-center gap-1.5">
          <input type="radio" checked={kind === "meta"} onChange={() => setKind("meta")} />
          SEO 메타 일괄 수정
        </label>
      </div>
      <input ref={fileInput} type="file" accept=".json,.csv" onChange={onFileChange} className="text-sm" />
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="JSON 배열 또는 CSV 텍스트를 붙여넣으세요"
        rows={8}
        className="w-full rounded-xl border border-slate-300 px-4 py-2 font-mono text-sm dark:border-slate-700 dark:bg-slate-950"
      />
      <div className="flex items-center gap-4 text-sm">
        <label className="flex items-center gap-1.5">
          <input type="radio" checked={format === "json"} onChange={() => setFormat("json")} /> JSON
        </label>
        <label className="flex items-center gap-1.5">
          <input type="radio" checked={format === "csv"} onChange={() => setFormat("csv")} /> CSV
        </label>
        {kind === "create" && (
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} />
            예약 없는 행은 지금 발행
          </label>
        )}
      </div>
      <button
        type="button"
        onClick={submit}
        disabled={pending || !text.trim()}
        className="rounded-xl bg-emerald-600 px-4 py-2 font-semibold text-white disabled:opacity-50"
      >
        {pending ? "처리 중..." : "일괄 실행"}
      </button>

      {result && !result.ok && (
        <p role="alert" className="rounded-lg bg-rose-100 px-3 py-2 text-sm text-rose-900 dark:bg-rose-900/30 dark:text-rose-200">
          ✗ {result.error}
        </p>
      )}
      {result && result.ok && (
        <div className="space-y-1 text-sm">
          <p className="font-semibold">
            성공 {result.report.success} / 실패 {result.report.failed}
          </p>
          <ul className="space-y-1">
            {result.report.items.map((item, i) => (
              <li key={i} className={item.status === "error" ? "text-rose-700 dark:text-rose-400" : "text-emerald-700 dark:text-emerald-400"}>
                {item.status === "success"
                  ? `✓ id ${item.result?.id} — ${item.result?.url}${item.result?.warning ? ` (⚠ ${item.result.warning})` : ""}`
                  : `✗ ${item.error}`}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
