import s from './board.module.css';

/** 목록을 서버에서 만드는 동안(거래 조회, 임시 카카오 좌표 조회) 보이는 화면. */
export default function Loading() {
  return (
    <main className={s.wrap}>
      <div className={s.loading} role="status" aria-live="polite">
        <span className={s.spinner} aria-hidden="true" />
        <p>거래 목록을 불러오는 중…</p>
      </div>
    </main>
  );
}
