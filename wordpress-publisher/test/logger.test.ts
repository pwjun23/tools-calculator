import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createLogger } from "../src/logger.ts";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "wp-log-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("createLogger", () => {
  it("성공/실패 항목을 jsonl 파일에 한 줄씩 쓴다", () => {
    const logger = createLogger(dir);
    logger.log({ action: "createPost", input: { title: "t" }, status: "success", postId: 1, url: "u" });
    logger.log({ action: "createPost", input: { title: "t2" }, status: "error", error: "실패" });
    logger.finish();

    const files = require("node:fs").readdirSync(dir) as string[];
    expect(files).toHaveLength(1);
    const lines = readFileSync(join(dir, files[0]), "utf8").trim().split("\n");
    expect(lines).toHaveLength(2);
    const first = JSON.parse(lines[0]);
    expect(first).toMatchObject({ action: "createPost", status: "success", postId: 1 });
    expect(typeof first.timestamp).toBe("string");
  });

  it("summary()는 성공/실패 개수를 센다", () => {
    const logger = createLogger(dir);
    logger.log({ action: "a", input: {}, status: "success" });
    logger.log({ action: "a", input: {}, status: "success" });
    logger.log({ action: "a", input: {}, status: "error", error: "x" });

    expect(logger.summary()).toEqual({ success: 2, failed: 1 });
  });
});
