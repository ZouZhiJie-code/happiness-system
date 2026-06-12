import { defineConfig } from "vitest/config";

export default defineConfig({
  // 对齐 Next.js 的自动 JSX runtime，使 src/components/ui/* 这类不显式 import React 的组件可被测试。
  esbuild: {
    jsx: "automatic"
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/.worktrees/**",
      "**/.claude/worktrees/**"
    ]
  },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname
    }
  }
});
