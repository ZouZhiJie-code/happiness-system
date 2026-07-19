import { Prisma } from "@prisma/client";

function getErrorCode(error: unknown): string | null {
  if (error instanceof Prisma.PrismaClientKnownRequestError) return error.code;
  if (error instanceof Prisma.PrismaClientInitializationError) return error.errorCode ?? null;
  if (error && typeof error === "object" && "cause" in error) {
    return getErrorCode((error as { cause?: unknown }).cause);
  }
  if (error instanceof Error) {
    if (error.message.includes("P1001")) return "P1001";
    if (error.message.includes("P2024")) return "P2024";
  }
  return null;
}

export function getTransientAdminReadErrorCode(error: unknown) {
  const code = getErrorCode(error);
  return code === "P1001" || code === "P2024" ? code : null;
}

export async function withAdminReadRetry<T>(operation: () => Promise<T>, delayMs = 300): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!getTransientAdminReadErrorCode(error)) throw error;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return operation();
  }
}
