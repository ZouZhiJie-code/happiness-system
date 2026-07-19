import { getTransientAdminReadErrorCode, withAdminReadRetry } from "@/server/services/admin-read-retry";

describe("admin read retry", () => {
  it.each(["P1001", "P2024"])("retries one transient %s read failure", async (code) => {
    const operation = vi.fn()
      .mockRejectedValueOnce(new Error(`Prisma read failed with ${code}`))
      .mockResolvedValueOnce("ready");

    await expect(withAdminReadRetry(operation, 0)).resolves.toBe("ready");
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("unwraps a transient database code from a service error cause", () => {
    const wrapped = Object.assign(new Error("ADMIN_ANALYTICS_QUERY_FAILED"), {
      cause: new Error("P2024 connection pool timeout")
    });
    expect(getTransientAdminReadErrorCode(wrapped)).toBe("P2024");
  });

  it("does not retry a non-transient read failure", async () => {
    const operation = vi.fn().mockRejectedValue(new Error("INVALID_RANGE"));
    await expect(withAdminReadRetry(operation, 0)).rejects.toThrow("INVALID_RANGE");
    expect(operation).toHaveBeenCalledTimes(1);
  });
});
