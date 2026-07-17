const {
  mockGetUserMemorySettings,
  mockRequireCurrentUserFromRequest,
  mockUpdateUserMemorySettings
} = vi.hoisted(() => ({
  mockGetUserMemorySettings: vi.fn(),
  mockRequireCurrentUserFromRequest: vi.fn(),
  mockUpdateUserMemorySettings: vi.fn()
}));

vi.mock("@/server/repositories/user-settings.repository", () => ({
  getUserMemorySettings: mockGetUserMemorySettings,
  updateUserMemorySettings: mockUpdateUserMemorySettings
}));

vi.mock("@/server/services/auth/current-user.service", () => ({
  requireCurrentUserFromRequest: mockRequireCurrentUserFromRequest,
  isAuthenticationRequiredError: (error: unknown) =>
    error instanceof Error && error.message === "AUTHENTICATION_REQUIRED"
}));

import { GET, PATCH } from "@/app/api/settings/route";

describe("settings api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireCurrentUserFromRequest.mockResolvedValue({ id: "user-1", username: "daily_light_01" });
  });

  it("returns the persisted memory setting", async () => {
    mockGetUserMemorySettings.mockResolvedValue({ memoryEnabled: true });

    const response = await GET(new Request("http://localhost/api/settings"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ memoryEnabled: true });
    expect(mockGetUserMemorySettings).toHaveBeenCalledWith("user-1");
  });

  it("rejects unauthenticated access", async () => {
    mockRequireCurrentUserFromRequest.mockRejectedValue(new Error("AUTHENTICATION_REQUIRED"));

    const response = await GET(new Request("http://localhost/api/settings"));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "AUTHENTICATION_REQUIRED" });
  });

  it("validates and upserts a memory setting", async () => {
    mockUpdateUserMemorySettings.mockResolvedValue({ memoryEnabled: true });

    const response = await PATCH(
      new Request("http://localhost/api/settings", {
        method: "PATCH",
        body: JSON.stringify({ memoryEnabled: true })
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ memoryEnabled: true });
    expect(mockUpdateUserMemorySettings).toHaveBeenCalledWith("user-1", true);
  });

  it("rejects malformed updates before writing", async () => {
    const response = await PATCH(
      new Request("http://localhost/api/settings", {
        method: "PATCH",
        body: JSON.stringify({ memoryEnabled: "yes" })
      })
    );

    expect(response.status).toBe(400);
    expect(mockUpdateUserMemorySettings).not.toHaveBeenCalled();
  });
});
