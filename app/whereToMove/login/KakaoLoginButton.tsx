"use client";

import { useState } from "react";
import { authClient } from "@/lib/whereToMove/auth-client";

export default function KakaoLoginButton() {
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await authClient.signIn.social({ provider: "kakao", callbackURL: "/whereToMove", errorCallbackURL: "/whereToMove/login" });
      }}
      className="w-full rounded-xl bg-[#FEE500] py-3 font-semibold text-[#191919] disabled:opacity-50"
    >
      {pending ? "카카오로 이동 중..." : "카카오로 로그인"}
    </button>
  );
}
