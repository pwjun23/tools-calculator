import { Suspense } from "react";
import { BulkUploadForm } from "./components/BulkUploadForm";
import { ScheduledList } from "./components/ScheduledList";
import { SinglePostForm } from "./components/SinglePostForm";

export default function WordpressAdminPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-4 px-4 py-6">
      <h1 className="text-2xl font-bold">WordPress 관리</h1>
      <SinglePostForm />
      <BulkUploadForm />
      <section className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-base font-bold">예약된 글</h2>
        <Suspense fallback={<p className="text-sm text-slate-500">불러오는 중...</p>}>
          <ScheduledList />
        </Suspense>
      </section>
    </main>
  );
}
