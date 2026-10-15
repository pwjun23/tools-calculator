import { describe, expect, it } from "vitest";
import { buildWeeklyMessage, shortWon, type MessageDeal } from "./message";

const d = (o: Partial<MessageDeal>): MessageDeal => ({
  type: "월세", dong: "구래동", apt: "가상단지", area: 85, amount: 13574, rent: 46, date: "2026-10-01", ok: true, monthly: 107.9, ...o,
});

describe("shortWon", () => {
  it.each([[20000, "2억"], [12820, "1.28억"], [5000, "5000만"]])("%i → %s", (v, s) => expect(shortWon(v)).toBe(s));
});

describe("buildWeeklyMessage", () => {
  it("건수 요약과 적합 상위 3건(최신순)", () => {
    const msg = buildWeeklyMessage("김포", [
      d({ date: "2026-10-01", apt: "A" }),
      d({ date: "2026-10-05", apt: "B" }),
      d({ type: "전세", rent: 0, amount: 20000, ok: false, apt: "C" }),
      d({ date: "2026-10-03", apt: "D" }),
      d({ date: "2026-09-20", apt: "E" }),
    ]);
    expect(msg.startsWith("[김포 부동산 주간] 신규 신고 5건 (매매 0, 전세 1, 월세 4)\n예산 적합 4건")).toBe(true);
    const lines = msg.split("\n").filter((l) => l.startsWith("· "));
    expect(lines.map((l) => l.split(" ")[2])).toEqual(["B", "D", "A"]);
    expect(lines[0]).toBe("· 구래동 B 85㎡ 월세 1.36억/46만 (월 108만)");
  });

  it("0건이어도 요약은 보낸다", () => {
    expect(buildWeeklyMessage("김포", [])).toBe("[김포 부동산 주간] 신규 신고 0건 (매매 0, 전세 0, 월세 0)\n예산 적합 0건");
  });

  it("200자를 넘지 않는다", () => {
    const many = Array.from({ length: 10 }, (_, i) => d({ apt: "아주긴단지이름".repeat(5) + i }));
    expect(buildWeeklyMessage("김포", many).length).toBeLessThanOrEqual(200);
  });
});
