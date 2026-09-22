import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export interface LogEntryInput {
  action: string;
  input: unknown;
  status: "success" | "error";
  postId?: number;
  url?: string;
  error?: string;
}

export interface RunLogger {
  log(entry: LogEntryInput): void;
  summary(): { success: number; failed: number };
  finish(): void;
}

export function createLogger(logDir: string): RunLogger {
  mkdirSync(logDir, { recursive: true });
  const filePath = join(logDir, `run-${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`);
  let success = 0;
  let failed = 0;

  return {
    log(entry) {
      if (entry.status === "success") success += 1;
      else failed += 1;
      const line = JSON.stringify({ timestamp: new Date().toISOString(), ...entry });
      appendFileSync(filePath, line + "\n", "utf8");
    },
    summary() {
      return { success, failed };
    },
    finish() {
      const { success: s, failed: f } = this.summary();
      console.log(`\n성공 ${s} / 실패 ${f}`);
    },
  };
}
