import { createHash, randomBytes } from "node:crypto";

export async function createSessionToken() {
  const value = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(value).digest("hex");

  return {
    value,
    hash
  };
}

