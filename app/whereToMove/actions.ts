"use server";

import { revalidatePath } from "next/cache";

// '새로 받기' 버튼: 시트 데이터를 바로 다시 가져온다. (/whereToMove 는 proxy 에서 로그인 확인)
export async function refreshData() {
  revalidatePath("/whereToMove");
}
