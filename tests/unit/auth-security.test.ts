import { createSessionToken } from "@/server/services/auth/session-token.service";
import { hashPassword, verifyPassword } from "@/server/services/auth/password.service";

describe("auth security services", () => {
  it("hashes the same password differently on different calls", async () => {
    const first = await hashPassword("supersecret1");
    const second = await hashPassword("supersecret1");

    expect(first).not.toBe(second);
  });

  it("verifies a correct password against its stored hash", async () => {
    const hash = await hashPassword("supersecret1");

    await expect(verifyPassword("supersecret1", hash)).resolves.toBe(true);
  });

  it("rejects an incorrect password against its stored hash", async () => {
    const hash = await hashPassword("supersecret1");

    await expect(verifyPassword("wrong-password", hash)).resolves.toBe(false);
  });

  it("creates a raw session token and a distinct hash", async () => {
    const token = await createSessionToken();

    expect(token.value).toEqual(expect.any(String));
    expect(token.hash).toEqual(expect.any(String));
    expect(token.value).not.toBe(token.hash);
    expect(token.value.length).toBeGreaterThan(20);
  });
});
