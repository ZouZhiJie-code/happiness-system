import { execFile } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, rm, stat, symlink, unlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";

import { parseGoldenSetV2PrivateCliMode } from "../../scripts/journal-generation-eval/initialize-golden-set-v2-private";
import {
  assertGoldenSetV2PrivateGitProtection,
  GOLDEN_SET_V2_LOCAL_CONFIRMATION,
  GOLDEN_SET_V2_PRIVATE_ROOT,
  initializeGoldenSetV2PrivateWorkspace,
  inspectGoldenSetV2PrivateWorkspace,
  validateGoldenSetV2PrivateWorkspace
} from "../../scripts/journal-generation-eval/golden-set-v2-private-workspace";

const execFileAsync = promisify(execFile);
const temporaryRoots: string[] = [];
const safeEnv = {
  NODE_ENV: "test",
  VERCEL_ENV: "",
  NEXT_PUBLIC_VERCEL_ENV: "",
  GOLDEN_SET_V2_LOCAL_ENABLED: GOLDEN_SET_V2_LOCAL_CONFIRMATION
} as const;

async function makeProjectRoot() {
  const projectRoot = await mkdtemp(join(tmpdir(), "golden-set-v2-private-"));
  temporaryRoots.push(projectRoot);
  const privateRoot = resolve(projectRoot, GOLDEN_SET_V2_PRIVATE_ROOT);
  await mkdir(privateRoot, { recursive: true });
  await writeFile(resolve(privateRoot, ".gitignore"), "*\n!.gitignore\n", { mode: 0o644 });
  await execFileAsync("git", ["init", "-q"], { cwd: projectRoot });
  return { projectRoot, privateRoot };
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("Golden Set v2 private workspace", () => {
  it("requires an explicit local-only confirmation and rejects deployment contexts", () => {
    try {
      validateGoldenSetV2PrivateWorkspace({ NODE_ENV: "test" }, "/tmp/project");
      expect.unreachable("missing local confirmation must fail closed");
    } catch (error) {
      expect(error).toEqual(expect.objectContaining({
        code: "GOLDEN_SET_V2_LOCAL_CONFIRMATION_REQUIRED"
      }));
    }
    expect(() => validateGoldenSetV2PrivateWorkspace({
      ...safeEnv,
      NODE_ENV: "production"
    }, "/tmp/project")).toThrow("production");
    expect(() => validateGoldenSetV2PrivateWorkspace({
      ...safeEnv,
      VERCEL_ENV: "preview"
    }, "/tmp/project")).toThrow("Vercel");
  });

  it("rejects a configured data path outside the fixed private root", () => {
    expect(() => validateGoldenSetV2PrivateWorkspace({
      ...safeEnv,
      GOLDEN_SET_V2_PRIVATE_DIR: "../outside"
    }, "/tmp/project")).toThrow("固定 .private 根目录内");

    const contained = validateGoldenSetV2PrivateWorkspace({
      ...safeEnv,
      GOLDEN_SET_V2_PRIVATE_DIR: `${GOLDEN_SET_V2_PRIVATE_ROOT}/run-v1`
    }, "/tmp/project");
    expect(contained.dataDirectory).toBe(resolve(
      "/tmp/project",
      GOLDEN_SET_V2_PRIVATE_ROOT,
      "run-v1"
    ));
  });

  it("inspects Git protection without writing files", async () => {
    const { projectRoot, privateRoot } = await makeProjectRoot();
    const before = await readFile(resolve(privateRoot, ".gitignore"), "utf8");
    const result = await inspectGoldenSetV2PrivateWorkspace(safeEnv, projectRoot);

    expect(result).toMatchObject({
      status: "safe_to_initialize",
      filesystemWriteCount: 0,
      productionAccessPerformed: false,
      modelCallCount: 0,
      git: { probeIgnored: true, trackedPrivateFileCount: 0 }
    });
    expect(await readFile(resolve(privateRoot, ".gitignore"), "utf8")).toBe(before);
  });

  it("initializes only ignored local ledgers with 0700/0600 permissions", async () => {
    const { projectRoot, privateRoot } = await makeProjectRoot();
    await chmod(privateRoot, 0o755);
    const result = await initializeGoldenSetV2PrivateWorkspace(safeEnv, projectRoot);

    expect(result).toMatchObject({
      status: "private_workspace_ready",
      directoryMode: "0700",
      fileMode: "0600",
      ledgerFileCount: 4,
      productionAccessPerformed: false,
      modelCallCount: 0
    });

    for (const directory of [
      privateRoot,
      join(privateRoot, "authorizations"),
      join(privateRoot, "cases"),
      join(privateRoot, "reviews"),
      join(privateRoot, "reconciliation"),
      join(privateRoot, "quarantine"),
      join(privateRoot, "locks")
    ]) {
      expect((await stat(directory)).mode & 0o777).toBe(0o700);
    }
    for (const file of [
      join(privateRoot, ".gitignore"),
      join(privateRoot, "authorizations/source-authorizations.ndjson"),
      join(privateRoot, "reviews/reviews.ndjson"),
      join(privateRoot, "reconciliation/reconciliation.ndjson"),
      join(privateRoot, "reconciliation/withdrawals.ndjson")
    ]) {
      expect((await stat(file)).mode & 0o777).toBe(0o600);
      if (!file.endsWith(".gitignore")) expect(await readFile(file, "utf8")).toBe("");
    }

    await expect(assertGoldenSetV2PrivateGitProtection(projectRoot)).resolves.toMatchObject({
      probeIgnored: true,
      trackedPrivateFileCount: 0
    });
  });

  it("rejects symlink escapes and tracked private payloads", async () => {
    const first = await makeProjectRoot();
    const externalDirectory = await mkdtemp(join(tmpdir(), "golden-set-v2-external-"));
    temporaryRoots.push(externalDirectory);
    await symlink(externalDirectory, join(first.privateRoot, "cases"));

    await expect(initializeGoldenSetV2PrivateWorkspace(safeEnv, first.projectRoot)).rejects.toEqual(
      expect.objectContaining({
        code: "GOLDEN_SET_V2_PRIVATE_SYMLINK_FORBIDDEN"
      })
    );

    const second = await makeProjectRoot();
    const trackedPayload = join(second.privateRoot, "private-content.json");
    await writeFile(trackedPayload, "PRIVATE CONTENT");
    await execFileAsync(
      "git",
      ["add", "-f", `${GOLDEN_SET_V2_PRIVATE_ROOT}/private-content.json`],
      { cwd: second.projectRoot }
    );
    await expect(assertGoldenSetV2PrivateGitProtection(second.projectRoot)).rejects.toEqual(
      expect.objectContaining({
        code: "GOLDEN_SET_V2_PRIVATE_FILE_TRACKED"
      })
    );

    const third = await makeProjectRoot();
    await writeFile(resolve(third.privateRoot, ".gitignore"), "*\n!.gitignore\n!cases/**\n");
    await expect(assertGoldenSetV2PrivateGitProtection(third.projectRoot)).rejects.toEqual(
      expect.objectContaining({
        code: "GOLDEN_SET_V2_PRIVATE_GITIGNORE_INVALID"
      })
    );

    const fourth = await makeProjectRoot();
    const externalGitignore = resolve(externalDirectory, "external-gitignore");
    await writeFile(externalGitignore, "*\n!.gitignore\n");
    await unlink(resolve(fourth.privateRoot, ".gitignore"));
    await symlink(externalGitignore, resolve(fourth.privateRoot, ".gitignore"));
    await expect(assertGoldenSetV2PrivateGitProtection(fourth.projectRoot)).rejects.toEqual(
      expect.objectContaining({
        code: "GOLDEN_SET_V2_PRIVATE_SYMLINK_FORBIDDEN"
      })
    );

    const fifth = await makeProjectRoot();
    const nestedGitignore = resolve(fifth.privateRoot, "cases/.gitignore");
    await mkdir(resolve(fifth.privateRoot, "cases"), { recursive: true });
    await writeFile(nestedGitignore, "PRIVATE CONTENT");
    await execFileAsync(
      "git",
      ["add", "-f", `${GOLDEN_SET_V2_PRIVATE_ROOT}/cases/.gitignore`],
      { cwd: fifth.projectRoot }
    );
    await expect(assertGoldenSetV2PrivateGitProtection(fifth.projectRoot)).rejects.toEqual(
      expect.objectContaining({
        code: "GOLDEN_SET_V2_PRIVATE_FILE_TRACKED"
      })
    );
  });

  it("keeps CLI initialization behind an explicit execute flag", () => {
    expect(parseGoldenSetV2PrivateCliMode([])).toBe("inspect");
    expect(parseGoldenSetV2PrivateCliMode(["--inspect"])).toBe("inspect");
    expect(parseGoldenSetV2PrivateCliMode(["--execute"])).toBe("execute");
    expect(() => parseGoldenSetV2PrivateCliMode(["--execute", "--inspect"])).toThrow(
      "GOLDEN_SET_V2_PRIVATE_ARGUMENT_INVALID"
    );
  });
});
