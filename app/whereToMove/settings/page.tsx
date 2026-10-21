import type { Metadata } from "next";
import { requireUser } from "@/lib/whereToMove/current-user";
import { umdOf } from "@/lib/whereToMove/dong";
import { getOrCreateSettings, listComplexNames } from "@/lib/whereToMove/repo";
import SettingsForm from "./SettingsForm";

export const metadata: Metadata = {
  title: "설정 · 이사 어디",
  robots: { index: false, follow: false },
};

// 저장 액션이 새 지역의 지난 12개월을 after() 로 받으므로 함수 시간을 늘린다.
export const maxDuration = 300;

export default async function SettingsPage() {
  const user = await requireUser();
  const { data, valid, notifyEnabled } = await getOrCreateSettings(user.id);
  // 통학버스 정류장에 연결할 단지 후보. 설정한 동의 단지만.
  const wanted = new Set(data.regions.flatMap((r) => r.dongs.map((d) => `${r.sggCd}|${umdOf(d)}`)));
  const complexes = (await listComplexNames(data.regions.map((r) => r.sggCd))).filter((c) => wanted.has(`${c.sggCd}|${c.dong}`));
  return (
    <>
      {!valid && (
        <p role="alert" className="mx-auto w-full max-w-2xl px-4 pt-6 text-sm text-rose-600 dark:text-rose-400">
          저장된 설정을 읽지 못해 기본값을 보여 줍니다. 값을 확인한 뒤 저장해 주세요. 그 전까지 주간 알림은 보내지 않습니다.
        </p>
      )}
      <SettingsForm initial={data} initialNotify={notifyEnabled} complexes={complexes} />
    </>
  );
}
