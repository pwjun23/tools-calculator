import { describe, expect, it } from "vitest";
import { parseArgs } from "../src/cli-args.ts";

describe("parseArgs", () => {
  it("첫 인자를 command로, --key value를 flags로 뽑는다", () => {
    expect(
      parseArgs(["create", "--title", "글 제목", "--category", "부동산"]),
    ).toEqual({
      command: "create",
      flags: { title: "글 제목", category: "부동산" },
    });
  });

  it("값이 없는 플래그(--dry-run, --publish)는 true로 표시한다", () => {
    expect(parseArgs(["create", "--title", "t", "--dry-run", "--publish"])).toEqual({
      command: "create",
      flags: { title: "t", "dry-run": true, publish: true },
    });
  });

  it("command가 없으면 에러를 던진다", () => {
    expect(() => parseArgs([])).toThrow(/명령/);
  });
});
