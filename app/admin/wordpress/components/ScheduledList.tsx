import { listScheduledAction } from "../actions";

export async function ScheduledList() {
  const posts = await listScheduledAction();

  if (posts.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">예약된 글이 없습니다.</p>;
  }

  return (
    <ul className="divide-y divide-slate-200 text-sm dark:divide-slate-800">
      {posts.map((p) => (
        <li key={p.id} className="flex items-center justify-between gap-3 py-2">
          <span>{p.title}</span>
          <span className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
            {p.dateGmt} UTC
            <a href={p.link} target="_blank" rel="noreferrer" className="underline">
              편집
            </a>
          </span>
        </li>
      ))}
    </ul>
  );
}
