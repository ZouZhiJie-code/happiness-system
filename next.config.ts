import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  outputFileTracingRoot: path.resolve(process.cwd()),
  outputFileTracingIncludes: {
    "/api/preview/gi088/**": [
      "./node_modules/@prisma/gi088-evaluation-client/**/*"
    ],
    "/preview/gi088-evaluation/**": [
      "./node_modules/@prisma/gi088-evaluation-client/**/*"
    ]
  }
};

export default nextConfig;
