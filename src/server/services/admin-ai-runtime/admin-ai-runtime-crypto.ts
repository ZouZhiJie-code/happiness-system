import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const SECRET_KEY_BYTES = 32;
const IV_BYTES = 12;
const ALGORITHM = "aes-256-gcm";
const PAYLOAD_VERSION = "v1";

export class AdminAIRuntimeCryptoError extends Error {
  constructor(
    readonly code:
      | "AI_RUNTIME_SECRET_NOT_CONFIGURED"
      | "AI_RUNTIME_SECRET_INVALID"
      | "AI_RUNTIME_DECRYPT_FAILED",
    message?: string
  ) {
    super(message ?? code);
    this.name = "AdminAIRuntimeCryptoError";
  }
}

function readAIRuntimeSecretKey(env: NodeJS.ProcessEnv = process.env) {
  const secret = env.AI_RUNTIME_CONFIG_SECRET?.trim();

  if (!secret) {
    throw new AdminAIRuntimeCryptoError("AI_RUNTIME_SECRET_NOT_CONFIGURED");
  }

  const key = Buffer.from(secret, "base64");

  if (key.length !== SECRET_KEY_BYTES) {
    throw new AdminAIRuntimeCryptoError("AI_RUNTIME_SECRET_INVALID");
  }

  return key;
}

export function maskAIRuntimeApiKey(apiKey: string) {
  const value = apiKey.trim();

  if (value.length <= 8) {
    return `${value.slice(0, 2)}***${value.slice(-2)}`;
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export function encryptAIRuntimeApiKey(apiKey: string, env: NodeJS.ProcessEnv = process.env) {
  const key = readAIRuntimeSecretKey(env);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(apiKey, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    ciphertext: [PAYLOAD_VERSION, iv.toString("base64url"), authTag.toString("base64url"), encrypted.toString("base64url")].join("."),
    mask: maskAIRuntimeApiKey(apiKey)
  };
}

export function decryptAIRuntimeApiKey(ciphertext: string, env: NodeJS.ProcessEnv = process.env) {
  const key = readAIRuntimeSecretKey(env);
  const [version, ivEncoded, authTagEncoded, payloadEncoded] = ciphertext.split(".");

  if (version !== PAYLOAD_VERSION || !ivEncoded || !authTagEncoded || !payloadEncoded) {
    throw new AdminAIRuntimeCryptoError("AI_RUNTIME_DECRYPT_FAILED");
  }

  try {
    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivEncoded, "base64url"));
    decipher.setAuthTag(Buffer.from(authTagEncoded, "base64url"));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(payloadEncoded, "base64url")),
      decipher.final()
    ]);

    return decrypted.toString("utf8");
  } catch {
    throw new AdminAIRuntimeCryptoError("AI_RUNTIME_DECRYPT_FAILED");
  }
}

export function hasAIRuntimeConfigSecret(env: NodeJS.ProcessEnv = process.env) {
  try {
    readAIRuntimeSecretKey(env);
    return true;
  } catch {
    return false;
  }
}
