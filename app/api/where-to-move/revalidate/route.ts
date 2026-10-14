import { revalidatePath } from "next/cache";
import type { NextRequest } from "next/server";

// Apps Script(weeklyReport, rejudgeLog)가 시트를 고친 뒤 호출해 /whereToMove 캐시를 비운다.
// 토큰은 Apps Script 의 API_TOKEN 과 같은 GIMPO_API_TOKEN 이다.
export async function POST(request: NextRequest) {
  const token = process.env.GIMPO_API_TOKEN;
  const auth = request.headers.get("authorization") ?? "";
  if (!token || auth !== `Bearer ${token}`) {
    return Response.json({ ok: false }, { status: 401 });
  }

  revalidatePath("/whereToMove");
  return Response.json({ ok: true });
}
