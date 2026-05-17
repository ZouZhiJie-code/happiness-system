const {
  mockAddProfileFact,
  mockDeleteProfileFact,
  mockGetAllProfiles,
  mockUpdateProfileFact
} = vi.hoisted(() => ({
  mockAddProfileFact: vi.fn(),
  mockDeleteProfileFact: vi.fn(),
  mockGetAllProfiles: vi.fn(),
  mockUpdateProfileFact: vi.fn()
}));

const { mockRequireCurrentUserFromRequest } = vi.hoisted(() => ({
  mockRequireCurrentUserFromRequest: vi.fn()
}));

vi.mock("@/server/services/memory/profile.service", () => ({
  ProfileError: class ProfileError extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.code = code;
    }
  },
  addProfileFact: mockAddProfileFact,
  deleteProfileFact: mockDeleteProfileFact,
  getAllProfiles: mockGetAllProfiles,
  updateProfileFact: mockUpdateProfileFact
}));

vi.mock("@/server/services/auth/current-user.service", () => ({
  AuthenticationError: class AuthenticationError extends Error {},
  requireCurrentUserFromRequest: mockRequireCurrentUserFromRequest
}));

import { DELETE, GET, PATCH, POST } from "@/app/api/profile/route";

describe("profile api auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireCurrentUserFromRequest.mockResolvedValue({
      id: "user-1",
      username: "daily_light_01"
    });
  });

  it("passes the authenticated user into GET profiles", async () => {
    mockGetAllProfiles.mockResolvedValue({
      joy: [],
      fulfillment: [],
      reflection: [],
      improvement: [],
      gratitude: []
    });

    const response = await GET(new Request("http://localhost/api/profile"));

    expect(response.status).toBe(200);
    expect(mockGetAllProfiles).toHaveBeenCalledWith("user-1");
  });

  it("passes the authenticated user into POST profile creation", async () => {
    mockAddProfileFact.mockResolvedValue({ id: "mem-1" });

    const response = await POST(
      new Request("http://localhost/api/profile", {
        method: "POST",
        body: JSON.stringify({
          dimension: "joy",
          summary: "我喜欢在雨天读书",
          topicTags: ["阅读"]
        })
      })
    );

    expect(response.status).toBe(201);
    expect(mockAddProfileFact).toHaveBeenCalledWith({
      userId: "user-1",
      dimension: "joy",
      summary: "我喜欢在雨天读书",
      topicTags: ["阅读"]
    });
  });

  it("passes the authenticated user into PATCH profile updates", async () => {
    mockUpdateProfileFact.mockResolvedValue({ id: "mem-1" });

    const response = await PATCH(
      new Request("http://localhost/api/profile", {
        method: "PATCH",
        body: JSON.stringify({
          id: "mem-1",
          summary: "更新后的摘要",
          topicTags: ["新标签"]
        })
      })
    );

    expect(response.status).toBe(200);
    expect(mockUpdateProfileFact).toHaveBeenCalledWith({
      id: "mem-1",
      userId: "user-1",
      summary: "更新后的摘要",
      topicTags: ["新标签"]
    });
  });

  it("passes the authenticated user into DELETE profile removal", async () => {
    const response = await DELETE(new Request("http://localhost/api/profile?id=mem-1"));

    expect(response.status).toBe(200);
    expect(mockDeleteProfileFact).toHaveBeenCalledWith("mem-1", "user-1");
  });
});
