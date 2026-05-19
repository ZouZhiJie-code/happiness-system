#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
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
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=.*?(?:#\s*(optional))?\s*$/i);
    const variable = match?.[1];

    if (!variable || seen.has(variable)) {
      continue;
    }

    seen.add(variable);
    variables.push({
      name: variable,
      optional: match?.[2]?.toLowerCase() === "optional"
    });
  }

  return variables;
}

export function buildEnvironmentContract(contractText) {
  const variables = parseContractVariables(contractText);

  return {
    required: variables.filter((variable) => !variable.optional).map((variable) => variable.name),
    optional: variables.filter((variable) => variable.optional).map((variable) => variable.name)
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

function summarizeEnvironment(contract, liveVariables) {
  return {
    presentRequired: contract.required.filter((variable) => liveVariables.includes(variable)),
    missingRequired: contract.required.filter((variable) => !liveVariables.includes(variable)),
    presentOptional: contract.optional.filter((variable) => liveVariables.includes(variable)),
    missingOptional: contract.optional.filter((variable) => !liveVariables.includes(variable))
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
    scope: null
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
      throw new Error("unsupported option: --project");
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

  return execFileSync("vercel", args, {
    cwd: process.cwd(),
    encoding: "utf8"
  });
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const contracts = readContractFiles();
  const vercelEnvLsText = readVercelEnvText(args);
  const result = auditVercelEnvText({
    ...contracts,
    vercelEnvLsText
  });

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
