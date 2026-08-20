import { spawn } from "node:child_process";
import { resolve } from "node:path";

import {
  resolveGi088EvaluationDatabaseUrl,
  validateGi088EvaluationDatabaseUrl
} from "../src/server/services/evaluation/gi088/access";

async function main() {
  if (
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV === "production"
  ) {
    throw new Error("GI088_EVALUATION_SCHEMA_DEPLOY_PRODUCTION_FORBIDDEN");
  }
  validateGi088EvaluationDatabaseUrl();
  if (process.env.GI088_EVALUATION_SCHEMA_DEPLOY !== "I_UNDERSTAND") {
    throw new Error("GI088_EVALUATION_SCHEMA_DEPLOY_AUTHORIZATION_REQUIRED");
  }
  const migrationEnv = {
    ...process.env,
    EVALUATION_DATABASE_URL: resolveGi088EvaluationDatabaseUrl()
  };
  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn(
      resolve(process.cwd(), "node_modules/.bin/prisma"),
      ["migrate", "deploy", "--schema", "prisma/evaluation/schema.prisma"],
      { stdio: "inherit", env: migrationEnv }
    );
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`GI088_EVALUATION_SCHEMA_DEPLOY_FAILED:${code ?? "unknown"}`));
    });
  });
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "GI088_EVALUATION_SCHEMA_DEPLOY_FAILED"
  );
  process.exitCode = 1;
});
