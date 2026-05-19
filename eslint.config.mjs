import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname
});

const eslintConfig = [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/.worktrees/**",
      "**/.claude/worktrees/**",
      "next-env.d.ts"
    ]
  },
  ...compat.config({
    extends: ["next/core-web-vitals", "next/typescript"]
  })
];

export default eslintConfig;
