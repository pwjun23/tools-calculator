import type { Metadata } from "next";
import { requireUser } from "@/lib/whereToMove/current-user";
import { getOrCreateSettings } from "@/lib/whereToMove/repo";
import SettingsForm from "./SettingsForm";

export const metadata: Metadata = {
  title: "설정 · 이사 실거래 모아보기",
  robots: { index: false, follow: false },
};

export default async function SettingsPage() {
  const user = await requireUser();
  const { data, valid, notifyEnabled } = await getOrCreateSettings(user.id);
  return (
    <>
      {!valid && (
        <p role="alert" className="mx-auto w-full max-w-2xl px-4 pt-6 text-sm text-rose-600 dark:text-rose-400">
          저장된 설정을 읽지 못해 기본값을 보여 줍니다. 값을 확인한 뒤 저장해 주세요. 그 전까지 주간 알림은 보내지 않습니다.
        </p>
      )}
      <SettingsForm initial={data} initialNotify={notifyEnabled} />
    </>
  );
}
