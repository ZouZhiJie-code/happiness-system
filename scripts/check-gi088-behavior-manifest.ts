import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";

import {
  GI088_BEHAVIOR_FILE_SPECS,
  GI088_BEHAVIOR_MANIFEST,
  createGi088BehaviorManifest,
  verifyGi088BehaviorManifest
} from "../src/server/services/evaluation/gi088/behavior-manifest";

function readBehaviorFiles(projectRoot: string) {
  return Object.fromEntries(
    GI088_BEHAVIOR_FILE_SPECS.map((spec) => {
      try {
        return [spec.path, readFileSync(resolve(projectRoot, spec.path))];
      } catch (error) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "ENOENT"
        ) {
          throw new Error(`GI088_BEHAVIOR_FILE_MISSING:${spec.path}`);
        }
        throw error;
      }
    })
  );
}

function main() {
  if (process.argv.includes("--require-tracked")) {
    execFileSync(
      "git",
      [
        "ls-files",
        "--error-unmatch",
        ...GI088_BEHAVIOR_FILE_SPECS.map((spec) => spec.path)
      ],
      { cwd: process.cwd(), stdio: "ignore" }
    );
  }
  const actual = createGi088BehaviorManifest({
    fileContents: readBehaviorFiles(process.cwd())
  });
  if (process.argv.includes("--write")) {
    const target = resolve(
      process.cwd(),
      "src/server/services/evaluation/gi088/gi088-behavior-manifest-v1.json"
    );
    writeFileSync(target, `${JSON.stringify(actual, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o644
    });
    console.log(JSON.stringify({ written: target, fileCount: actual.files.length }, null, 2));
    return;
  }
  if (process.argv.includes("--print-current")) {
    console.log(JSON.stringify(actual, null, 2));
    return;
  }
  console.log(JSON.stringify(verifyGi088BehaviorManifest({
    expected: GI088_BEHAVIOR_MANIFEST,
    actual
  }), null, 2));
}

main();
