import { describe, expect, it } from "vitest";
import { buildNotice } from "./notice";

const failed = { status: "failed" as const, error: "카카오톡 발송 실패 (403)" };

describe("buildNotice", () => {
  it("알림 발송이 실패했으면 다시 로그인 버튼과 함께 안내한다", () => {
    const n = buildNotice({ settingsValid: true, notifyEnabled: true, lastLog: failed });
    expect(n?.relogin).toBe(true);
    expect(n?.text).toContain("카카오톡 메시지 전송");
  });

  it("알림을 꺼 두었으면 지난 실패를 보여 주지 않는다", () => {
    expect(buildNotice({ settingsValid: true, notifyEnabled: false, lastLog: failed })).toBeUndefined();
  });

  it("마지막 발송이 성공이면 안내가 없다", () => {
    expect(buildNotice({ settingsValid: true, notifyEnabled: true, lastLog: { status: "sent", error: null } })).toBeUndefined();
    expect(buildNotice({ settingsValid: true, notifyEnabled: true, lastLog: null })).toBeUndefined();
  });

  it("저장된 설정을 읽지 못했으면 그 안내가 먼저다 (다시 로그인 버튼 없음)", () => {
    const n = buildNotice({ settingsValid: false, notifyEnabled: true, lastLog: failed });
    expect(n?.relogin).toBe(false);
    expect(n?.text).toContain("설정");
  });
});
