import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const previewContract = `# Vercel preview environment contract
DATABASE_URL=""
AI_PROVIDER="volcengine-ark"
VOLCENGINE_ARK_API_KEY=""
VOLCENGINE_ARK_ENDPOINT_ID=""
VOLCENGINE_ARK_BASE_URL="https://ark.cn-beijing.volces.com/api/v3"
VOLCENGINE_ARK_EMBEDDING_ENDPOINT_ID="" # optional: only set this when embeddings are enabled
APP_URL="https://your-project-git-branch-your-team.vercel.app" # optional: user-defined APP_URL is optional only when Vercel system env exposure/runtime readback is verified elsewhere
`;

const productionContract = `# Vercel production environment contract
DATABASE_URL=""
AI_PROVIDER="volcengine-ark"
VOLCENGINE_ARK_API_KEY=""
VOLCENGINE_ARK_ENDPOINT_ID=""
VOLCENGINE_ARK_BASE_URL="https://ark.cn-beijing.volces.com/api/v3"
VOLCENGINE_ARK_EMBEDDING_ENDPOINT_ID="" # optional: only set this when embeddings are enabled
APP_URL="https://your-domain.example.com" # optional: user-defined APP_URL is optional only when Vercel system env exposure/runtime readback is verified elsewhere
`;

const vercelEnvLsTable = `Vercel CLI 39.1.0
> Environment Variables found for zouzhijies-projects/xingfuxitong [221ms]

 name          value       environments                      created
 DATABASE_URL  Encrypted   Production, Preview, Development  2d ago
 DIRECT_URL    Encrypted   Production, Preview, Development  2d ago
 APP_URL       Encrypted   Preview                           1d ago
`;

const tempDirs: string[] = [];

type AuditResult = {
  project: string | null;
  contract: {
    preview: {
      required: string[];
      optional: string[];
      conditionalOptional: Array<{ name: string; reason: string }>;
    };
    production: {
      required: string[];
      optional: string[];
      conditionalOptional: Array<{ name: string; reason: string }>;
    };
  };
  live: Record<string, string[]>;
  audit: {
    Preview: {
      presentRequired: string[];
      missingRequired: string[];
      presentOptional: string[];
      missingOptional: string[];
      unverifiedConditionalOptional: Array<{ name: string; reason: string }>;
    };
    Production: {
      presentRequired: string[];
      missingRequired: string[];
      presentOptional: string[];
      missingOptional: string[];
      unverifiedConditionalOptional: Array<{ name: string; reason: string }>;
    };
  };
};

type AuditModule = {
  auditVercelEnvText(input: {
    previewContractText: string;
    productionContractText: string;
    vercelEnvLsText: string;
  }): AuditResult;
  buildEnvironmentContract(input: string): AuditResult["contract"]["preview"];
  parseVercelEnvLsTable(input: string): Record<string, string[]>;
};

async function loadModule(): Promise<AuditModule> {
  // @ts-expect-error Vitest imports the runtime-authored .mjs script directly in this lane.
  return import("../../scripts/vercel-env-audit.mjs");
}

function runCli(args: string[]) {
  return spawnSync("node", ["scripts/vercel-env-audit.mjs", ...args], {
    cwd: resolve(__dirname, "../.."),
    encoding: "utf8"
  });
}

describe("vercel env audit script", () => {
  afterEach(() => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();

      if (dir) {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it("parses contract files and reports missing required vars by preview and production", async () => {
    const { auditVercelEnvText } = await loadModule();

    const result = auditVercelEnvText({
      previewContractText: previewContract,
      productionContractText: productionContract,
      vercelEnvLsText: vercelEnvLsTable
    });

    expect(result.contract.preview.required).toEqual([
      "DATABASE_URL",
      "AI_PROVIDER",
      "VOLCENGINE_ARK_API_KEY",
      "VOLCENGINE_ARK_ENDPOINT_ID",
      "VOLCENGINE_ARK_BASE_URL"
    ]);
    expect(result.contract.preview.optional).toEqual([
      "VOLCENGINE_ARK_EMBEDDING_ENDPOINT_ID",
      "APP_URL"
    ]);
    expect(result.contract.preview.conditionalOptional).toEqual([
      {
        name: "APP_URL",
        reason:
          "user-defined APP_URL is optional only when Vercel system env exposure/runtime readback is verified elsewhere"
      }
    ]);
    expect(result.audit.Preview.missingRequired).toEqual([
      "AI_PROVIDER",
      "VOLCENGINE_ARK_API_KEY",
      "VOLCENGINE_ARK_ENDPOINT_ID",
      "VOLCENGINE_ARK_BASE_URL"
    ]);
    expect(result.audit.Preview.presentRequired).toEqual(["DATABASE_URL"]);
    expect(result.audit.Preview.presentOptional).toEqual(["APP_URL"]);
    expect(result.audit.Preview.missingOptional).toEqual(["VOLCENGINE_ARK_EMBEDDING_ENDPOINT_ID"]);
    expect(result.audit.Preview.unverifiedConditionalOptional).toEqual([
      {
        name: "APP_URL",
        reason:
          "user-defined APP_URL is optional only when Vercel system env exposure/runtime readback is verified elsewhere"
      }
    ]);
    expect(result.audit.Production.presentRequired).toEqual(["DATABASE_URL"]);
    expect(result.audit.Production.missingRequired).toEqual([
      "AI_PROVIDER",
      "VOLCENGINE_ARK_API_KEY",
      "VOLCENGINE_ARK_ENDPOINT_ID",
      "VOLCENGINE_ARK_BASE_URL"
    ]);
    expect(result.audit.Production.missingOptional).toEqual([
      "VOLCENGINE_ARK_EMBEDDING_ENDPOINT_ID",
      "APP_URL"
    ]);
    expect(result.audit.Production.unverifiedConditionalOptional).toEqual([
      {
        name: "APP_URL",
        reason:
          "user-defined APP_URL is optional only when Vercel system env exposure/runtime readback is verified elsewhere"
      }
    ]);
    expect(result.project).toBe("zouzhijies-projects/xingfuxitong");
  });

  it("classifies optional variables from explanatory contract annotations instead of a hardcoded variable name list", async () => {
    const { auditVercelEnvText } = await loadModule();

    const result = auditVercelEnvText({
      previewContractText: `DATABASE_URL=""
APP_URL="https://preview.example.com" # optional: user-defined APP_URL is optional only when Vercel system env exposure/runtime readback is verified elsewhere
VOLCENGINE_ARK_EMBEDDING_ENDPOINT_ID=""
`,
      productionContractText: `DATABASE_URL=""
APP_URL="https://prod.example.com" # optional: user-defined APP_URL is optional only when Vercel system env exposure/runtime readback is verified elsewhere
VOLCENGINE_ARK_EMBEDDING_ENDPOINT_ID=""
`,
      vercelEnvLsText: vercelEnvLsTable
    });

    expect(result.contract.preview.optional).toEqual(["APP_URL"]);
    expect(result.contract.preview.required).toEqual([
      "DATABASE_URL",
      "VOLCENGINE_ARK_EMBEDDING_ENDPOINT_ID"
    ]);
    expect(result.contract.preview.conditionalOptional).toEqual([
      {
        name: "APP_URL",
        reason:
          "user-defined APP_URL is optional only when Vercel system env exposure/runtime readback is verified elsewhere"
      }
    ]);
  });

  it("parses vercel env ls style text into environment buckets", async () => {
    const { parseVercelEnvLsTable } = await loadModule();

    expect(parseVercelEnvLsTable(vercelEnvLsTable)).toEqual({
      Development: ["DATABASE_URL", "DIRECT_URL"],
      Preview: ["APP_URL", "DATABASE_URL", "DIRECT_URL"],
      Production: ["DATABASE_URL", "DIRECT_URL"]
    });
  });

  it("supports a no-network CLI mode with --input-file and prints JSON", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "vercel-env-audit-"));
    tempDirs.push(tempDir);

    const inputPath = join(tempDir, "env-ls.txt");
    writeFileSync(inputPath, vercelEnvLsTable);

    const output = execFileSync(
      "node",
      ["scripts/vercel-env-audit.mjs", "--input-file", inputPath],
      {
        cwd: resolve(__dirname, "../.."),
        encoding: "utf8",
        env: {
          ...process.env
        }
      }
    );

    const parsed = JSON.parse(output) as {
      project: string;
      contract: {
        preview: {
          conditionalOptional: Array<{ name: string; reason: string }>;
        };
      };
      audit: {
        Preview: {
          missingRequired: string[];
          presentOptional: string[];
          unverifiedConditionalOptional: Array<{ name: string; reason: string }>;
        };
        Production: {
          missingRequired: string[];
          unverifiedConditionalOptional: Array<{ name: string; reason: string }>;
        };
      };
    };

    expect(parsed.project).toBe("zouzhijies-projects/xingfuxitong");
    expect(parsed.audit.Preview.missingRequired).toContain("AI_PROVIDER");
    expect(parsed.audit.Preview.missingRequired).not.toContain("APP_URL");
    expect(parsed.audit.Preview.presentOptional).toContain("APP_URL");
    expect(parsed.audit.Production.missingRequired).not.toContain("APP_URL");
    expect(parsed.contract.preview.conditionalOptional).toContainEqual({
      name: "APP_URL",
      reason:
        "user-defined APP_URL is optional only when Vercel system env exposure/runtime readback is verified elsewhere"
    });
    expect(parsed.audit.Preview.unverifiedConditionalOptional).toContainEqual({
      name: "APP_URL",
      reason:
        "user-defined APP_URL is optional only when Vercel system env exposure/runtime readback is verified elsewhere"
    });
    expect(parsed.audit.Production.unverifiedConditionalOptional).toContainEqual({
      name: "APP_URL",
      reason:
        "user-defined APP_URL is optional only when Vercel system env exposure/runtime readback is verified elsewhere"
    });
  });

  it("locks the checked-in contract split from the real example files", async () => {
    const { buildEnvironmentContract } = await loadModule();
    const repoRoot = resolve(__dirname, "../..");
    const previewFile = readFileSync(resolve(repoRoot, ".env.preview.example"), "utf8");
    const productionFile = readFileSync(resolve(repoRoot, ".env.production.example"), "utf8");

    expect(buildEnvironmentContract(previewFile)).toEqual({
      required: [
        "DATABASE_URL",
        "AI_PROVIDER",
        "VOLCENGINE_ARK_API_KEY",
        "VOLCENGINE_ARK_ENDPOINT_ID",
        "VOLCENGINE_ARK_BASE_URL"
      ],
      optional: ["VOLCENGINE_ARK_EMBEDDING_ENDPOINT_ID", "APP_URL"],
      conditionalOptional: [
        {
          name: "APP_URL",
          reason:
            "user-defined APP_URL is optional only when Vercel system env exposure/runtime readback is verified elsewhere"
        }
      ]
    });
    expect(buildEnvironmentContract(productionFile)).toEqual({
      required: [
        "DATABASE_URL",
        "AI_PROVIDER",
        "VOLCENGINE_ARK_API_KEY",
        "VOLCENGINE_ARK_ENDPOINT_ID",
        "VOLCENGINE_ARK_BASE_URL"
      ],
      optional: ["VOLCENGINE_ARK_EMBEDDING_ENDPOINT_ID", "APP_URL"],
      conditionalOptional: [
        {
          name: "APP_URL",
          reason:
            "user-defined APP_URL is optional only when Vercel system env exposure/runtime readback is verified elsewhere"
        }
      ]
    });
  });

  it("rejects the unsupported --project flag instead of pretending to target a project", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "vercel-env-audit-"));
    tempDirs.push(tempDir);

    const inputPath = join(tempDir, "env-ls.txt");
    writeFileSync(inputPath, vercelEnvLsTable);

    const result = runCli(["--input-file", inputPath, "--project", "zouzhijies-projects/xingfuxitong"]);

    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toMatch(/unsupported option: --project/i);
  });

  it("fails fast when --input-file or --scope is missing a usable value", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "vercel-env-audit-"));
    tempDirs.push(tempDir);

    const inputPath = join(tempDir, "env-ls.txt");
    writeFileSync(inputPath, vercelEnvLsTable);

    const missingInputFileValue = runCli(["--input-file"]);
    expect(missingInputFileValue.status).toBe(1);
    expect(missingInputFileValue.stderr).toMatch(/missing value for --input-file/i);

    const inputFileValueIsFlag = runCli(["--input-file", "--scope", "team-scope"]);
    expect(inputFileValueIsFlag.status).toBe(1);
    expect(inputFileValueIsFlag.stderr).toMatch(/missing value for --input-file/i);

    const missingScopeValue = runCli(["--scope"]);
    expect(missingScopeValue.status).toBe(1);
    expect(missingScopeValue.stderr).toMatch(/missing value for --scope/i);

    const scopeValueIsFlag = runCli(["--scope", "--input-file", inputPath]);
    expect(scopeValueIsFlag.status).toBe(1);
    expect(scopeValueIsFlag.stderr).toMatch(/missing value for --scope/i);
  });

  it("rejects unexpected positional arguments", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "vercel-env-audit-"));
    tempDirs.push(tempDir);

    const inputPath = join(tempDir, "env-ls.txt");
    writeFileSync(inputPath, vercelEnvLsTable);

    const result = runCli(["--input-file", inputPath, "extra-positional"]);

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/unexpected positional argument: extra-positional/i);
  });
});
