import { basename } from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertJournalDailyEvalPrivateIgnore,
  JournalDailyEvalIsolationError,
  validateJournalDailyEvalIsolation
} from "./isolation-guard";

export async function checkLocalJournalDailyEvalIsolation(
  env: NodeJS.ProcessEnv = process.env,
  projectRoot = process.cwd()
) {
  const isolation = validateJournalDailyEvalIsolation(env, projectRoot);
  const privacy = await assertJournalDailyEvalPrivateIgnore(projectRoot);
  return {
    status: "safe_local_isolation" as const,
    base_url: isolation.base_url,
    database: {
      host: isolation.database.hostname,
      port: isolation.database.port,
      name: isolation.database.database,
      schema: isolation.database.schema
    },
    direct: {
      host: isolation.direct.hostname,
      port: isolation.direct.port,
      name: isolation.direct.database,
      schema: isolation.direct.schema
    },
    data_directory: isolation.data_directory,
    private_gitignore_verified: privacy.probe_ignored,
    tracked_private_file_count: privacy.tracked_private_file_count,
    database_connection_performed: false
  };
}

async function main() {
  const result = await checkLocalJournalDailyEvalIsolation();
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

const isCli = process.argv.some(
  (argument) => basename(argument) === basename(fileURLToPath(import.meta.url))
);
if (isCli) {
  main().catch((error: unknown) => {
    const code = error instanceof JournalDailyEvalIsolationError
      ? error.code
      : "JOURNAL_DAILY_EVAL_ISOLATION_CHECK_FAILED";
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${code}: ${message}\n`);
    process.exitCode = 1;
  });
}
