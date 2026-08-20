import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

export function hasLocalPrivateAssets(...relativePaths: string[]) {
  return relativePaths.every((path) => existsSync(resolve(process.cwd(), path)));
}

export function hasLocalPrivatePackage(input: {
  root: string;
  directoryPrefix: string;
}) {
  const root = resolve(process.cwd(), input.root);
  if (!existsSync(root)) return false;

  try {
    return readdirSync(root, { withFileTypes: true }).some(
      (entry) => entry.isDirectory() && entry.name.startsWith(input.directoryPrefix)
    );
  } catch {
    return false;
  }
}
