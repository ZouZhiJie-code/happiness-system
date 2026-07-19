import { FlatCompat } from "@eslint/eslintrc";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname
});

const nextLintCompat = compat.extends("next/core-web-vitals", "next/typescript");

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/.next-dev/**",
      "**/.worktrees/**",
      "**/.claude/worktrees/**",
      "next-env.d.ts"
    ]
  },
  ...nextLintCompat
];
