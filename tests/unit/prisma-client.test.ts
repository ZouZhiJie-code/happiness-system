import { beforeEach, describe, expect, it, vi } from "vitest";

const { PrismaClientMock } = vi.hoisted(() => ({
  PrismaClientMock: vi.fn(() => ({}))
}));

vi.mock("@prisma/client", () => ({
  PrismaClient: PrismaClientMock
}));

describe("server prisma client", () => {
  beforeEach(() => {
    PrismaClientMock.mockClear();
    delete (globalThis as typeof globalThis & { __prisma__?: unknown }).__prisma__;
    vi.resetModules();
  });

  it("raises interactive transaction timeouts for remote database latency", async () => {
    await import("@/server/db/prisma");

    expect(PrismaClientMock).toHaveBeenCalledWith(
      expect.objectContaining({
        transactionOptions: {
          maxWait: 10_000,
          timeout: 20_000
        }
      })
    );
  });
});
