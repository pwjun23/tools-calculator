/** 목록 화면 위쪽 안내. 설정을 읽지 못했거나, 알림을 켜 둔 상태에서 지난 발송이 실패했을 때만 보인다. */
export function buildNotice(o: {
  settingsValid: boolean;
  notifyEnabled: boolean;
  lastLog: { status: "sent" | "failed"; error: string | null } | null;
}): { text: string; relogin: boolean } | undefined {
  if (!o.settingsValid) {
    return { text: "저장된 설정을 읽지 못해 기본값으로 보여 줍니다. 설정 화면에서 값을 확인하고 다시 저장해 주세요.", relogin: false };
  }
  if (o.notifyEnabled && o.lastLog?.status === "failed") {
    return {
      text: "지난 카카오톡 알림을 보내지 못했습니다. 아래 버튼으로 카카오에 다시 로그인하면서 '카카오톡 메시지 전송'에 동의해 주세요.",
      relogin: true,
    };
  }
  return undefined;
}
