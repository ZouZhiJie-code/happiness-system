import { FlatCompat } from "@eslint/eslintrc";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";
import { globalIgnores } from "eslint/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const configDirectory = path.dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({
  baseDirectory: configDirectory
});

const nextLintConfig = Array.isArray(nextCoreWebVitals) && Array.isArray(nextTypeScript)
  ? [...nextCoreWebVitals, ...nextTypeScript]
  : compat.extends("next/core-web-vitals", "next/typescript");

const config = [
  globalIgnores(
    [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/.next-dev/**",
      "**/.worktrees/**",
      "**/.claude/worktrees/**",
      "**/playwright-report/**",
      "**/test-results/**",
      "next-env.d.ts"
    ],
    "daily-light/ignores"
  ),
  ...nextLintConfig,
  {
    name: "daily-light/rule-exceptions",
    rules: {
      "react-hooks/error-boundaries": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off"
    }
  }
];

export default config;
