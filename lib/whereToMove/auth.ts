import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { isAllowedKakaoId } from "./allowlist";
import { db } from "./db";
import { account, session, user, verification } from "./schema";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "pg", schema: { user, session, account, verification } }),
  // 카카오 access/refresh token 을 DB에 암호화해 둔다(주간 알림에 재사용).
  account: { encryptOAuthTokens: true },
  // 예전 로그인 쿠키(180일)처럼 오래 유지한다. 하루에 한 번 이상 들어오면 만료가 뒤로 밀린다.
  session: { expiresIn: 60 * 60 * 24 * 180 },
  socialProviders: {
    kakao: {
      clientId: process.env.KAKAO_CLIENT_ID ?? "",
      clientSecret: process.env.KAKAO_CLIENT_SECRET ?? "",
      // account_email 은 비즈 앱 전용이라 요청하지 않는다. 메시지 전송 동의를 함께 받는다.
      disableDefaultScope: true,
      scope: ["profile_nickname", "talk_message"],
      // Better Auth 는 이메일이 필수라, 카카오 회원번호로 실제로 쓰이지 않는 주소를 만든다(.invalid 는 예약된 TLD).
      mapProfileToUser: (profile) => ({
        email: `kakao-${profile.id}@kakao.invalid`,
        name: profile.kakao_account?.profile?.nickname || "카카오 사용자",
      }),
    },
  },
  user: {
    // 1단계는 허용 목록의 카카오 회원번호만 받는다. 거절 화면에 본인 번호를 보여 줘 운영자가 목록에 넣을 수 있게 한다.
    validateUserInfo: ({ source }) => {
      if (source.oauth?.providerId !== "kakao") return;
      const id = String(source.oauth.profile?.id ?? "");
      if (!isAllowedKakaoId(id, process.env.WTM_ALLOWED_KAKAO_IDS)) {
        return { error: "not_allowed", errorDescription: `준비 중인 서비스입니다. (카카오 회원번호 ${id})` };
      }
    },
  },
  plugins: [nextCookies()],
});
