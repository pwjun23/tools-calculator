import { describe, expect, it } from "vitest";
import { groupDongs } from "./board";

describe("groupDongs", () => {
  it("설정에서 고른 동을 거래 유무와 관계없이 지역별로 가나다순으로 보여 준다", () => {
    const g = groupDongs([
      { sggCd: "A", label: "가 시", dongs: ["하성면", "구래동", "중앙동"] },
      { sggCd: "B", label: "나 시", dongs: ["중앙동"] },
    ]);
    expect(g).toEqual([
      { sggCd: "A", label: "가 시", dongs: ["구래동", "중앙동", "하성면"] },
      { sggCd: "B", label: "나 시", dongs: ["중앙동"] },
    ]);
  });
});
