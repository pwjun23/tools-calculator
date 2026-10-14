import type { Metadata } from 'next';
import GimpoBoard, { Deal } from './GimpoBoard';

export const metadata: Metadata = {
  title: '김포 실거래 모아보기',
  robots: { index: false, follow: false },
};

// 10분마다 시트 데이터를 새로 가져옵니다.
export const revalidate = 600;

async function load(): Promise<{ updated: string; deals: Deal[]; error?: string }> {
  const url = process.env.GIMPO_API_URL;
  const token = process.env.GIMPO_API_TOKEN;
  if (!url || !token) return { updated: '', deals: [], error: '환경변수(GIMPO_API_URL, GIMPO_API_TOKEN)가 없습니다.' };
  try {
    const res = await fetch(`${url}?token=${encodeURIComponent(token)}`, { next: { revalidate: 600 } });
    const json = await res.json();
    if (json.error) return { updated: '', deals: [], error: '데이터 주소 인증에 실패했습니다.' };
    return json;
  } catch {
    return { updated: '', deals: [], error: '데이터를 불러오지 못했습니다.' };
  }
}

export default async function Page() {
  const data = await load();
  return <GimpoBoard deals={data.deals} updated={data.updated} error={data.error} />;
}
