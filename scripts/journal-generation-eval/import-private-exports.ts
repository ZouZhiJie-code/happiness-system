import { homedir } from "node:os";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { importPrivateExports } from "./private-export-importer";

interface ImportCliOptions {
  sourceDirs: string[];
  sourceIndexPath: string;
  outputPath: string;
  dryRun: boolean;
}

export function parseImportArgs(argv: string[]): ImportCliOptions {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const projectRoot = resolve(scriptDir, "../..");
  const options: ImportCliOptions = {
    sourceDirs: [resolve(homedir(), "Downloads"), resolve(projectRoot, "artifacts/local-runtime")],
    sourceIndexPath: resolve(projectRoot, "artifacts/journal-generation-evaluation/private-source-index.json"),
    outputPath: resolve(projectRoot, "artifacts/journal-generation-evaluation/.private/imported-manifest.json"),
    dryRun: false
  };
  let customSourceDirs = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--source-dir" && argv[index + 1]) {
      if (!customSourceDirs) {
        options.sourceDirs = [];
        customSourceDirs = true;
      }
      options.sourceDirs.push(resolve(argv[index + 1]));
      index += 1;
    } else if (argument === "--source-index" && argv[index + 1]) {
      options.sourceIndexPath = resolve(argv[index + 1]);
      index += 1;
    } else if (argument === "--output" && argv[index + 1]) {
      options.outputPath = resolve(argv[index + 1]);
      index += 1;
    } else if (argument === "--dry-run") {
      options.dryRun = true;
    } else {
      throw new Error(`未知参数：${argument}`);
    }
  }
  return options;
}

async function main() {
  const options = parseImportArgs(process.argv.slice(2));
  const manifest = await importPrivateExports({
    sourceIndexPath: options.sourceIndexPath,
    sourceDirs: options.sourceDirs,
    outputPath: options.outputPath,
    dryRun: options.dryRun,
    strict: true
  });
  process.stdout.write(
    `私有导入完成：${manifest.summary.matched_source_count}/${manifest.summary.expected_source_count} 份文件，` +
    `${manifest.summary.unique_content_count} 份唯一内容，${manifest.summary.trajectory_case_count} 条已完成轨迹。\n`
  );
}

const isCli = process.argv[1]
  && basename(process.argv[1]) === basename(fileURLToPath(import.meta.url));
if (isCli) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
