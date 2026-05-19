#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const CONTRACT_FILES = {
  preview: ".env.preview.example",
  production: ".env.production.example"
};
const KNOWN_ENVIRONMENTS = ["Development", "Preview", "Production"];

function sortUnique(values) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

export function parseContractVariables(contractText) {
  const seen = new Set();
  const variables = [];

  for (const line of contractText.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=.*?(?:#\s*(optional)(?:\s*:\s*(.*))?)?\s*$/i);
    const variable = match?.[1];
    const annotation = match?.[3]?.trim() ?? null;

    if (!variable || seen.has(variable)) {
      continue;
    }

    seen.add(variable);
    variables.push({
      name: variable,
      optional: match?.[2]?.toLowerCase() === "optional",
      annotation,
      requiresExternalVerification:
        match?.[2]?.toLowerCase() === "optional" && /verified elsewhere/i.test(annotation ?? "")
    });
  }

  return variables;
}

export function buildEnvironmentContract(contractText) {
  const variables = parseContractVariables(contractText);

  return {
    required: variables.filter((variable) => !variable.optional).map((variable) => variable.name),
    optional: variables.filter((variable) => variable.optional).map((variable) => variable.name),
    conditionalOptional: variables
      .filter((variable) => variable.requiresExternalVerification)
      .map((variable) => ({
        name: variable.name,
        reason: variable.annotation
      }))
  };
}

export function parseVercelEnvLsProject(vercelEnvLsText) {
  return (
    vercelEnvLsText.match(/Environment Variables found for\s+([^\s\[]+)/)?.[1] ??
    null
  );
}

export function parseVercelEnvLsTable(vercelEnvLsText) {
  const liveByEnvironment = Object.fromEntries(
    KNOWN_ENVIRONMENTS.map((environment) => [environment, []])
  );

  for (const line of vercelEnvLsText.split(/\r?\n/)) {
    const nameMatch = line.match(/^\s*([A-Z0-9_]+)\b/);

    if (!nameMatch) {
      continue;
    }

    const environments = KNOWN_ENVIRONMENTS.filter((environment) =>
      new RegExp(`\\b${environment}\\b`).test(line)
    );

    if (environments.length === 0) {
      continue;
    }

    for (const environment of environments) {
      liveByEnvironment[environment].push(nameMatch[1]);
    }
  }

  return Object.fromEntries(
    Object.entries(liveByEnvironment).map(([environment, values]) => [environment, sortUnique(values)])
  );
}

function hasVercelProjectLink(targetCwd, fileExists = existsSync) {
  return fileExists(resolve(targetCwd, ".vercel/project.json"));
}

export function resolveVercelCommandCwd({
  currentCwd = process.cwd(),
  env = process.env,
  fileExists = existsSync
} = {}) {
  if (env.VERCEL_ENV_AUDIT_CWD) {
    return env.VERCEL_ENV_AUDIT_CWD;
  }

  const worktreeMarker = `${resolve("/")}.worktrees${resolve("/")}`;
  const markerIndex = currentCwd.indexOf(worktreeMarker);

  if (markerIndex >= 0) {
    const parentRepoRoot = currentCwd.slice(0, markerIndex);
    if (parentRepoRoot && hasVercelProjectLink(parentRepoRoot, fileExists)) {
      return parentRepoRoot;
    }
  }

  return currentCwd;
}

function summarizeEnvironment(contract, liveVariables) {
  return {
    presentRequired: contract.required.filter((variable) => liveVariables.includes(variable)),
    missingRequired: contract.required.filter((variable) => !liveVariables.includes(variable)),
    presentOptional: contract.optional.filter((variable) => liveVariables.includes(variable)),
    missingOptional: contract.optional.filter((variable) => !liveVariables.includes(variable)),
    unverifiedConditionalOptional: contract.conditionalOptional
  };
}

export function auditVercelEnvText({
  previewContractText,
  productionContractText,
  vercelEnvLsText
}) {
  const contract = {
    preview: buildEnvironmentContract(previewContractText),
    production: buildEnvironmentContract(productionContractText)
  };
  const live = parseVercelEnvLsTable(vercelEnvLsText);

  return {
    project: parseVercelEnvLsProject(vercelEnvLsText),
    contract,
    live,
    audit: {
      Preview: summarizeEnvironment(contract.preview, live.Preview ?? []),
      Production: summarizeEnvironment(contract.production, live.Production ?? [])
    }
  };
}

function parseArgs(argv) {
  const parsed = {
    inputFile: null,
    scope: null,
    expectedProject: null
  };

  function readOptionValue(optionName, value) {
    if (!value || value.startsWith("--")) {
      throw new Error(`missing value for ${optionName}`);
    }

    return value;
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = argv[index + 1];

    if (arg === "--input-file") {
      parsed.inputFile = readOptionValue("--input-file", value);
      index += 1;
      continue;
    }

    if (arg === "--project") {
      parsed.expectedProject = readOptionValue("--project", value);
      index += 1;
      continue;
    }

    if (arg === "--scope") {
      parsed.scope = readOptionValue("--scope", value);
      index += 1;
      continue;
    }

    if (arg.startsWith("--")) {
      throw new Error(`unsupported option: ${arg}`);
    }

    throw new Error(`unexpected positional argument: ${arg}`);
  }

  return parsed;
}

function readContractFiles() {
  return {
    previewContractText: readFileSync(resolve(process.cwd(), CONTRACT_FILES.preview), "utf8"),
    productionContractText: readFileSync(resolve(process.cwd(), CONTRACT_FILES.production), "utf8")
  };
}

function readVercelEnvText({ inputFile, scope }) {
  if (inputFile) {
    return readFileSync(resolve(process.cwd(), inputFile), "utf8");
  }

  const args = ["env", "ls"];

  if (scope) {
    args.push("--scope", scope);
  }

  const command = spawnSync("vercel", args, {
    cwd: resolveVercelCommandCwd(),
    encoding: "utf8"
  });

  if (command.error) {
    throw command.error;
  }

  if (command.status !== 0) {
    const stderr = command.stderr?.trim();
    const stdout = command.stdout?.trim();
    throw new Error(stderr || stdout || `vercel env ls failed with status ${command.status}`);
  }

  return [command.stdout, command.stderr].filter(Boolean).join("\n");
}

function assertExpectedProject(expectedProject, auditedProject) {
  if (!expectedProject) {
    return;
  }

  if (!auditedProject) {
    throw new Error(
      `expected project ${expectedProject} but could not determine audited project from vercel env ls output`
    );
  }

  if (auditedProject !== expectedProject) {
    throw new Error(`expected project ${expectedProject} but audited project was ${auditedProject}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const contracts = readContractFiles();
  const vercelEnvLsText = readVercelEnvText(args);
  const result = auditVercelEnvText({
    ...contracts,
    vercelEnvLsText
  });
  assertExpectedProject(args.expectedProject, result.project);

  console.log(JSON.stringify(result, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    main();
  } catch (error) {
    console.error(`[vercel-env-audit] ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
