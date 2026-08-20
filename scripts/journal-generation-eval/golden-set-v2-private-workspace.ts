import { execFile } from "node:child_process";
import { chmod, lstat, mkdir, open, readFile, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const GOLDEN_SET_V2_PRIVATE_ROOT =
  "artifacts/production-evidence-hardening/2026-08-19/golden-set-v2/.private" as const;
export const GOLDEN_SET_V2_LOCAL_CONFIRMATION = "I_UNDERSTAND" as const;

const PRIVATE_DIRECTORIES = [
  "authorizations",
  "cases",
  "reviews",
  "reconciliation",
  "quarantine",
  "locks"
] as const;

const PRIVATE_LEDGER_FILES = [
  "authorizations/source-authorizations.ndjson",
  "reviews/reviews.ndjson",
  "reconciliation/reconciliation.ndjson",
  "reconciliation/withdrawals.ndjson"
] as const;

export type GoldenSetV2PrivateWorkspaceErrorCode =
  | "GOLDEN_SET_V2_PRODUCTION_CONTEXT_FORBIDDEN"
  | "GOLDEN_SET_V2_VERCEL_CONTEXT_FORBIDDEN"
  | "GOLDEN_SET_V2_LOCAL_CONFIRMATION_REQUIRED"
  | "GOLDEN_SET_V2_PRIVATE_PATH_OUTSIDE_ROOT"
  | "GOLDEN_SET_V2_PRIVATE_SYMLINK_FORBIDDEN"
  | "GOLDEN_SET_V2_PRIVATE_GITIGNORE_INVALID"
  | "GOLDEN_SET_V2_PRIVATE_PATH_NOT_IGNORED"
  | "GOLDEN_SET_V2_PRIVATE_FILE_TRACKED"
  | "GOLDEN_SET_V2_PRIVATE_PERMISSION_INVALID";

export class GoldenSetV2PrivateWorkspaceError extends Error {
  constructor(
    public readonly code: GoldenSetV2PrivateWorkspaceErrorCode,
    message: string
  ) {
    super(message);
  }
}

export interface GoldenSetV2PrivateWorkspaceEnv {
  NODE_ENV?: string;
  VERCEL_ENV?: string;
  NEXT_PUBLIC_VERCEL_ENV?: string;
  GOLDEN_SET_V2_LOCAL_ENABLED?: string;
  GOLDEN_SET_V2_PRIVATE_DIR?: string;
}

function fail(code: GoldenSetV2PrivateWorkspaceErrorCode, message: string): never {
  throw new GoldenSetV2PrivateWorkspaceError(code, message);
}

function isWithinOrEqual(parent: string, child: string) {
  const childRelative = relative(parent, child);
  return childRelative === ""
    || (!childRelative.startsWith("..") && !isAbsolute(childRelative));
}

export function validateGoldenSetV2PrivateWorkspace(
  env: GoldenSetV2PrivateWorkspaceEnv,
  projectRoot = process.cwd()
) {
  if (env.NODE_ENV === "production") {
    fail(
      "GOLDEN_SET_V2_PRODUCTION_CONTEXT_FORBIDDEN",
      "Golden Set v2 私有评审目录禁止在 production 环境初始化。"
    );
  }
  if (env.VERCEL_ENV?.trim() || env.NEXT_PUBLIC_VERCEL_ENV?.trim()) {
    fail(
      "GOLDEN_SET_V2_VERCEL_CONTEXT_FORBIDDEN",
      "Golden Set v2 私有评审目录禁止在 Vercel 环境初始化。"
    );
  }
  if (env.GOLDEN_SET_V2_LOCAL_ENABLED !== GOLDEN_SET_V2_LOCAL_CONFIRMATION) {
    fail(
      "GOLDEN_SET_V2_LOCAL_CONFIRMATION_REQUIRED",
      `必须显式设置 GOLDEN_SET_V2_LOCAL_ENABLED=${GOLDEN_SET_V2_LOCAL_CONFIRMATION}。`
    );
  }

  const privateRoot = resolve(projectRoot, GOLDEN_SET_V2_PRIVATE_ROOT);
  const configuredDirectory = env.GOLDEN_SET_V2_PRIVATE_DIR?.trim();
  const dataDirectory = configuredDirectory
    ? resolve(projectRoot, configuredDirectory)
    : privateRoot;
  if (!isWithinOrEqual(privateRoot, dataDirectory)) {
    fail(
      "GOLDEN_SET_V2_PRIVATE_PATH_OUTSIDE_ROOT",
      "Golden Set v2 私有数据目录必须位于固定 .private 根目录内。"
    );
  }

  return {
    privateRoot,
    dataDirectory,
    productionOrPreview: false as const
  };
}

async function assertNoSymlinkOnPath(projectRoot: string, targetPath: string) {
  const relativeTarget = relative(projectRoot, targetPath);
  if (relativeTarget.startsWith("..") || isAbsolute(relativeTarget)) {
    fail(
      "GOLDEN_SET_V2_PRIVATE_PATH_OUTSIDE_ROOT",
      "Golden Set v2 私有路径离开项目根目录。"
    );
  }

  const segments = relativeTarget.split(sep).filter(Boolean);
  let current = projectRoot;
  for (const segment of segments) {
    current = resolve(current, segment);
    try {
      const metadata = await lstat(current);
      if (metadata.isSymbolicLink()) {
        fail(
          "GOLDEN_SET_V2_PRIVATE_SYMLINK_FORBIDDEN",
          "Golden Set v2 私有路径中检测到符号链接。"
        );
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }
  }
}

export async function assertGoldenSetV2PrivateGitProtection(
  projectRoot = process.cwd(),
  dependencies: {
    execFile?: typeof execFileAsync;
  } = {}
) {
  const run = dependencies.execFile ?? execFileAsync;
  const privateRoot = resolve(projectRoot, GOLDEN_SET_V2_PRIVATE_ROOT);
  const gitignorePath = resolve(privateRoot, ".gitignore");
  await assertNoSymlinkOnPath(projectRoot, gitignorePath);
  let gitignore: string;
  try {
    gitignore = await readFile(gitignorePath, "utf8");
  } catch {
    fail(
      "GOLDEN_SET_V2_PRIVATE_GITIGNORE_INVALID",
      "Golden Set v2 .private/.gitignore 缺失或不可读。"
    );
  }
  const rules = gitignore.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
  if (rules.length !== 2 || rules[0] !== "*" || rules[1] !== "!.gitignore") {
    fail(
      "GOLDEN_SET_V2_PRIVATE_GITIGNORE_INVALID",
      "Golden Set v2 .private 必须忽略全部内容并仅放行 .gitignore。"
    );
  }

  const probeRelative = `${GOLDEN_SET_V2_PRIVATE_ROOT}/cases/__privacy_probe__.json`;
  try {
    await run("git", ["-C", projectRoot, "check-ignore", "--no-index", "--quiet", probeRelative]);
  } catch {
    fail(
      "GOLDEN_SET_V2_PRIVATE_PATH_NOT_IGNORED",
      "Golden Set v2 私有内容探针未被 Git 忽略。"
    );
  }

  const { stdout } = await run("git", [
    "-C",
    projectRoot,
    "ls-files",
    "--",
    GOLDEN_SET_V2_PRIVATE_ROOT
  ]);
  const trackedPrivateFiles = stdout
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(
      (line) => line.length > 0 && line !== `${GOLDEN_SET_V2_PRIVATE_ROOT}/.gitignore`
    );
  if (trackedPrivateFiles.length > 0) {
    fail(
      "GOLDEN_SET_V2_PRIVATE_FILE_TRACKED",
      "Golden Set v2 .private 下存在被 Git 跟踪的私有文件。"
    );
  }

  return {
    gitignorePath,
    probeIgnored: true as const,
    trackedPrivateFileCount: 0 as const
  };
}

async function ensureDirectory(directoryPath: string) {
  await mkdir(directoryPath, { recursive: true, mode: 0o700 });
  await chmod(directoryPath, 0o700);
}

async function ensurePrivateFile(filePath: string) {
  const file = await open(filePath, "a", 0o600);
  await file.close();
  await chmod(filePath, 0o600);
}

function permissionBits(mode: number) {
  return mode & 0o777;
}

export async function inspectGoldenSetV2PrivateWorkspace(
  env: GoldenSetV2PrivateWorkspaceEnv,
  projectRoot = process.cwd()
) {
  const isolation = validateGoldenSetV2PrivateWorkspace(env, projectRoot);
  await assertNoSymlinkOnPath(projectRoot, isolation.privateRoot);
  await assertNoSymlinkOnPath(projectRoot, isolation.dataDirectory);
  for (const directory of PRIVATE_DIRECTORIES) {
    await assertNoSymlinkOnPath(projectRoot, resolve(isolation.dataDirectory, directory));
  }
  const git = await assertGoldenSetV2PrivateGitProtection(projectRoot);
  return {
    status: "safe_to_initialize" as const,
    privateRoot: isolation.privateRoot,
    dataDirectory: isolation.dataDirectory,
    git,
    filesystemWriteCount: 0 as const,
    productionAccessPerformed: false as const,
    modelCallCount: 0 as const
  };
}

export async function initializeGoldenSetV2PrivateWorkspace(
  env: GoldenSetV2PrivateWorkspaceEnv,
  projectRoot = process.cwd()
) {
  const inspection = await inspectGoldenSetV2PrivateWorkspace(env, projectRoot);
  await ensureDirectory(inspection.privateRoot);
  await ensureDirectory(inspection.dataDirectory);
  for (const directory of PRIVATE_DIRECTORIES) {
    const directoryPath = resolve(inspection.dataDirectory, directory);
    await assertNoSymlinkOnPath(projectRoot, directoryPath);
    await ensureDirectory(directoryPath);
  }

  const gitignorePath = resolve(inspection.privateRoot, ".gitignore");
  await assertNoSymlinkOnPath(projectRoot, gitignorePath);
  await chmod(gitignorePath, 0o600);
  for (const ledger of PRIVATE_LEDGER_FILES) {
    const ledgerPath = resolve(inspection.dataDirectory, ledger);
    await assertNoSymlinkOnPath(projectRoot, ledgerPath);
    await ensurePrivateFile(ledgerPath);
  }

  const directoryModes = await Promise.all(
    [...new Set([
      inspection.privateRoot,
      inspection.dataDirectory,
      ...PRIVATE_DIRECTORIES.map((directory) => resolve(inspection.dataDirectory, directory))
    ])]
      .map(async (directory) => ({
        directory,
        mode: permissionBits((await stat(directory)).mode)
      }))
  );
  const fileModes = await Promise.all(
    [gitignorePath, ...PRIVATE_LEDGER_FILES.map((file) => resolve(inspection.dataDirectory, file))]
      .map(async (file) => ({ file, mode: permissionBits((await stat(file)).mode) }))
  );
  if (directoryModes.some((entry) => entry.mode !== 0o700)
    || fileModes.some((entry) => entry.mode !== 0o600)) {
    fail(
      "GOLDEN_SET_V2_PRIVATE_PERMISSION_INVALID",
      "Golden Set v2 私有目录或账本权限未达到 0700/0600。"
    );
  }

  return {
    status: "private_workspace_ready" as const,
    privateRoot: inspection.privateRoot,
    dataDirectory: inspection.dataDirectory,
    directoryCount: directoryModes.length,
    ledgerFileCount: PRIVATE_LEDGER_FILES.length,
    directoryMode: "0700" as const,
    fileMode: "0600" as const,
    productionAccessPerformed: false as const,
    modelCallCount: 0 as const
  };
}
