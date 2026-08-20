import { PrismaClient } from "@prisma/client";

let database: PrismaClient | null = null;

export function getE2EDatabase() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url || !/^postgres(?:ql)?:\/\//u.test(url)) {
    throw new Error("DAILY_LIGHT_E2E_DATABASE_URL_REQUIRED");
  }
  const parsed = new URL(url);
  const schema = parsed.searchParams.get("schema") ?? "";
  if (
    !["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname) ||
    !/^daily_light_e2e_[a-z0-9_]{6,44}$/u.test(schema)
  ) {
    throw new Error("DAILY_LIGHT_E2E_DATABASE_NOT_ISOLATED");
  }
  database ??= new PrismaClient({ datasources: { db: { url } } });
  return database;
}

export async function disconnectE2EDatabase() {
  await database?.$disconnect();
  database = null;
}
