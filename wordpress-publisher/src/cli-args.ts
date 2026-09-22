const BOOLEAN_FLAGS = new Set(["dry-run", "publish"]);

export interface ParsedArgs {
  command: string;
  flags: Record<string, string | true>;
}

export function parseArgs(argv: string[]): ParsedArgs {
  const [command, ...rest] = argv;
  if (!command) {
    throw new Error("명령을 지정해야 합니다 (create/update/add-seo/schedule/batch-create/batch-update-meta)");
  }

  const flags: Record<string, string | true> = {};
  for (let i = 0; i < rest.length; i++) {
    const token = rest[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    if (BOOLEAN_FLAGS.has(key)) {
      flags[key] = true;
      continue;
    }
    flags[key] = rest[i + 1];
    i += 1;
  }
  return { command, flags };
}
