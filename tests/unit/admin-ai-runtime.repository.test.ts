const {
  mockAIRuntimeConfigAggregate,
  mockAIRuntimeConfigCreate,
  mockAIRuntimeConfigFindFirst,
  mockAIRuntimeConfigFindMany,
  mockAIRuntimeConfigFindUnique,
  mockAIRuntimeConfigUpdate,
  mockAIRuntimeProbeCreate,
  mockPrismaTransaction
} = vi.hoisted(() => ({
  mockAIRuntimeConfigAggregate: vi.fn(),
  mockAIRuntimeConfigCreate: vi.fn(),
  mockAIRuntimeConfigFindFirst: vi.fn(),
  mockAIRuntimeConfigFindMany: vi.fn(),
  mockAIRuntimeConfigFindUnique: vi.fn(),
  mockAIRuntimeConfigUpdate: vi.fn(),
  mockAIRuntimeProbeCreate: vi.fn(),
  mockPrismaTransaction: vi.fn()
}));

vi.mock("@/server/db/prisma", () => ({
  prisma: {
    aIRuntimeConfig: {
      aggregate: mockAIRuntimeConfigAggregate,
      create: mockAIRuntimeConfigCreate,
      findFirst: mockAIRuntimeConfigFindFirst,
      findMany: mockAIRuntimeConfigFindMany,
      findUnique: mockAIRuntimeConfigFindUnique,
      update: mockAIRuntimeConfigUpdate
    },
    aIRuntimeProbe: {
      create: mockAIRuntimeProbeCreate
    },
    $transaction: mockPrismaTransaction
  }
}));

import {
  getAIRuntimeDraftRecord,
  getAIRuntimeHistoryRecords,
  getNextAIRuntimeVersion,
  publishAIRuntimeConfigRecord,
  recordAIRuntimeProbe,
  rollbackAIRuntimeConfigRecord,
  saveAIRuntimeDraftRecord
} from "@/server/repositories/admin-ai-runtime.repository";

describe("admin ai runtime repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads the latest draft with probe history", async () => {
    mockAIRuntimeConfigFindFirst.mockResolvedValue({ id: "draft-chat-1" });

    const result = await getAIRuntimeDraftRecord("chat");

    expect(result).toEqual({ id: "draft-chat-1" });
    expect(mockAIRuntimeConfigFindFirst).toHaveBeenCalledWith({
      where: {
        capability: "chat",
        status: "draft"
      },
      orderBy: {
        updatedAt: "desc"
      },
      include: {
        probes: {
          orderBy: {
            createdAt: "desc"
          }
        }
      }
    });
  });

  it("creates a new draft when no draft id is supplied", async () => {
    mockAIRuntimeConfigCreate.mockResolvedValue({ id: "draft-chat-1" });

    const result = await saveAIRuntimeDraftRecord({
      capability: "chat",
      provider: "openai",
      enabled: true,
      displayName: "OpenAI Chat",
      apiKeyCiphertext: "ciphertext",
      apiKeyMask: "sk-...1234",
      configJson: {
        model: "gpt-5",
        baseUrl: "https://api.openai.com/v1"
      },
      configChecksum: "checksum-1",
      version: 3,
      createdBy: "admin_user"
    });

    expect(result).toEqual({ id: "draft-chat-1" });
    expect(mockAIRuntimeConfigCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        capability: "chat",
        provider: "openai",
        status: "draft",
        version: 3
      }),
      include: {
        probes: {
          orderBy: {
            createdAt: "desc"
          }
        }
      }
    });
  });

  it("records connectivity probe rows", async () => {
    mockAIRuntimeProbeCreate.mockResolvedValue({ id: "probe-1" });

    const result = await recordAIRuntimeProbe({
      configId: "draft-chat-1",
      capability: "chat",
      provider: "openai",
      configChecksum: "checksum-1",
      success: true,
      httpStatus: 200,
      errorCode: null,
      latencyMs: 180,
      summary: "测试通过",
      testedBy: "admin_user"
    });

    expect(result).toEqual({ id: "probe-1" });
    expect(mockAIRuntimeProbeCreate).toHaveBeenCalledWith({
      data: {
        configId: "draft-chat-1",
        capability: "chat",
        provider: "openai",
        configChecksum: "checksum-1",
        success: true,
        httpStatus: 200,
        errorCode: null,
        latencyMs: 180,
        summary: "测试通过",
        testedBy: "admin_user"
      }
    });
  });

  it("archives the current published config and promotes the draft inside a transaction", async () => {
    mockPrismaTransaction.mockImplementation(
      async (callback: (tx: { aIRuntimeConfig: { update: typeof mockAIRuntimeConfigUpdate } }) => Promise<unknown>) =>
      callback({
        aIRuntimeConfig: {
          update: mockAIRuntimeConfigUpdate
        }
      })
    );

    await publishAIRuntimeConfigRecord({
      capability: "chat",
      draftId: "draft-chat-1",
      publishedBy: "admin_user"
    });

    expect(mockPrismaTransaction).toHaveBeenCalledTimes(1);
    expect(mockAIRuntimeConfigUpdate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: {
          id: "draft-chat-1"
        },
        data: expect.objectContaining({
          status: "published",
          publishedBy: "admin_user"
        })
      })
    );
  });

  it("lists history and computes the next version number", async () => {
    mockAIRuntimeConfigFindMany.mockResolvedValue([{ id: "published-chat-1" }]);
    mockAIRuntimeConfigAggregate.mockResolvedValue({
      _max: {
        version: 8
      }
    });

    const history = await getAIRuntimeHistoryRecords("chat");
    const nextVersion = await getNextAIRuntimeVersion("chat");

    expect(history).toEqual([{ id: "published-chat-1" }]);
    expect(nextVersion).toBe(9);
  });

  it("rolls a historical version forward as a new published record", async () => {
    mockAIRuntimeConfigFindUnique.mockResolvedValue({
      id: "history-1",
      capability: "chat",
      provider: "openai",
      enabled: true,
      displayName: "OpenAI Chat",
      apiKeyCiphertext: "cipher",
      apiKeyMask: "sk-...1234",
      configJson: {
        model: "gpt-5",
        baseUrl: "https://api.openai.com/v1"
      },
      configChecksum: "checksum-1",
      version: 4
    });
    mockPrismaTransaction.mockImplementation(
      async (callback: (tx: {
        aIRuntimeConfig: {
          create: typeof mockAIRuntimeConfigCreate;
          updateMany: ReturnType<typeof vi.fn>;
          findUnique: typeof mockAIRuntimeConfigFindUnique;
        };
      }) => Promise<unknown>) =>
      callback({
        aIRuntimeConfig: {
          create: mockAIRuntimeConfigCreate,
          updateMany: vi.fn(),
          findUnique: mockAIRuntimeConfigFindUnique
        }
      })
    );
    mockAIRuntimeConfigCreate.mockResolvedValue({ id: "published-chat-9" });

    const result = await rollbackAIRuntimeConfigRecord({
      capability: "chat",
      rollbackFromId: "history-1",
      publishedBy: "admin_user",
      version: 9
    });

    expect(result).toEqual({ id: "published-chat-9" });
    expect(mockAIRuntimeConfigCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          rollbackFromId: "history-1",
          status: "published",
          version: 9
        })
      })
    );
  });
});
