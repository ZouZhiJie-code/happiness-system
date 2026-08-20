import { basename } from "node:path";
import { fileURLToPath } from "node:url";

import {
  GoldenSetV2PrivateWorkspaceError,
  initializeGoldenSetV2PrivateWorkspace,
  inspectGoldenSetV2PrivateWorkspace
} from "./golden-set-v2-private-workspace";

export type GoldenSetV2PrivateCliMode = "inspect" | "execute";

export function parseGoldenSetV2PrivateCliMode(argv: string[]): GoldenSetV2PrivateCliMode {
  if (argv.length === 0 || (argv.length === 1 && argv[0] === "--inspect")) return "inspect";
  if (argv.length === 1 && argv[0] === "--execute") return "execute";
  throw new Error("GOLDEN_SET_V2_PRIVATE_ARGUMENT_INVALID");
}

async function main() {
  const mode = parseGoldenSetV2PrivateCliMode(process.argv.slice(2));
  const result = mode === "execute"
    ? await initializeGoldenSetV2PrivateWorkspace(process.env)
    : await inspectGoldenSetV2PrivateWorkspace(process.env);
  process.stdout.write(`${JSON.stringify({ mode, ...result })}\n`);
}

const isCli = process.argv.some(
  (argument) => basename(argument) === basename(fileURLToPath(import.meta.url))
);
if (isCli) {
  main().catch((error: unknown) => {
    const code = error instanceof GoldenSetV2PrivateWorkspaceError
      ? error.code
      : error instanceof Error ? error.message : "GOLDEN_SET_V2_PRIVATE_INITIALIZATION_FAILED";
    process.stderr.write(`${code}\n`);
    process.exitCode = 1;
  });
}
