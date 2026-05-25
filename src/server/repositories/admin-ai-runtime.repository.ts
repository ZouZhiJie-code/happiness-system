import { Prisma } from "@prisma/client";

import type { AIRuntimeCapability, AIRuntimeProvider } from "@/features/admin-ai-runtime/types";
import { prisma } from "@/server/db/prisma";

const includeProbes = {
  probes: {
    orderBy: {
      createdAt: "desc" as const
    }
  }
};

export async function getAIRuntimeDraftRecord(capability: AIRuntimeCapability) {
  return prisma.aIRuntimeConfig.findFirst({
    where: {
      capability,
      status: "draft"
    },
    orderBy: {
      updatedAt: "desc"
    },
    include: includeProbes
  });
}

export async function getPublishedAIRuntimeConfigRecord(capability: AIRuntimeCapability) {
  return prisma.aIRuntimeConfig.findFirst({
    where: {
      capability,
      status: "published"
    },
    orderBy: {
      publishedAt: "desc"
    },
    include: includeProbes
  });
}

export async function getAIRuntimeConfigRecordById(id: string) {
  return prisma.aIRuntimeConfig.findUnique({
    where: {
      id
    },
    include: includeProbes
  });
}

export async function getAIRuntimeHistoryRecords(capability: AIRuntimeCapability) {
  return prisma.aIRuntimeConfig.findMany({
    where: {
      capability,
      status: {
        in: ["published", "archived"]
      }
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    include: includeProbes
  });
}

export async function getNextAIRuntimeVersion(capability: AIRuntimeCapability) {
  const result = await prisma.aIRuntimeConfig.aggregate({
    where: {
      capability
    },
    _max: {
      version: true
    }
  });

  return (result._max.version ?? 0) + 1;
}

export async function saveAIRuntimeDraftRecord(input: {
  draftId?: string;
  capability: AIRuntimeCapability;
  provider: AIRuntimeProvider;
  enabled: boolean;
  displayName: string;
  apiKeyCiphertext: string | null;
  apiKeyMask: string | null;
  configJson: Record<string, unknown>;
  configChecksum: string;
  version: number;
  createdBy: string;
}) {
  if (input.draftId) {
    return prisma.aIRuntimeConfig.update({
      where: {
        id: input.draftId
      },
      data: {
        provider: input.provider,
        enabled: input.enabled,
        displayName: input.displayName,
        apiKeyCiphertext: input.apiKeyCiphertext,
        apiKeyMask: input.apiKeyMask,
        configJson: input.configJson as Prisma.InputJsonValue,
        configChecksum: input.configChecksum
      },
      include: includeProbes
    });
  }

  return prisma.aIRuntimeConfig.create({
    data: {
      capability: input.capability,
      provider: input.provider,
      status: "draft",
      enabled: input.enabled,
      displayName: input.displayName,
      apiKeyCiphertext: input.apiKeyCiphertext,
      apiKeyMask: input.apiKeyMask,
      configJson: input.configJson as Prisma.InputJsonValue,
      configChecksum: input.configChecksum,
      version: input.version,
      createdBy: input.createdBy
    },
    include: includeProbes
  });
}

export async function recordAIRuntimeProbe(input: {
  configId: string;
  capability: AIRuntimeCapability;
  provider: AIRuntimeProvider;
  configChecksum: string;
  success: boolean;
  httpStatus: number | null;
  errorCode: string | null;
  latencyMs: number | null;
  summary: string;
  testedBy: string;
}) {
  return prisma.aIRuntimeProbe.create({
    data: input
  });
}

export async function publishAIRuntimeConfigRecord(input: {
  capability: AIRuntimeCapability;
  draftId: string;
  publishedBy: string;
}) {
  return prisma.$transaction(async (tx) => {
    const now = new Date();

    if ("updateMany" in tx.aIRuntimeConfig && typeof tx.aIRuntimeConfig.updateMany === "function") {
      await tx.aIRuntimeConfig.updateMany({
        where: {
          capability: input.capability,
          status: "published"
        },
        data: {
          status: "archived",
          archivedAt: now
        }
      });
    }

    return tx.aIRuntimeConfig.update({
      where: {
        id: input.draftId
      },
      data: {
        status: "published",
        publishedBy: input.publishedBy,
        publishedAt: now,
        archivedAt: null
      },
      include: includeProbes
    });
  });
}

export async function rollbackAIRuntimeConfigRecord(input: {
  capability: AIRuntimeCapability;
  rollbackFromId: string;
  publishedBy: string;
  version: number;
}) {
  return prisma.$transaction(async (tx) => {
    const source = await tx.aIRuntimeConfig.findUnique({
      where: {
        id: input.rollbackFromId
      }
    });

    if (!source) {
      return null;
    }

    const now = new Date();

    if ("updateMany" in tx.aIRuntimeConfig && typeof tx.aIRuntimeConfig.updateMany === "function") {
      await tx.aIRuntimeConfig.updateMany({
        where: {
          capability: input.capability,
          status: "published"
        },
        data: {
          status: "archived",
          archivedAt: now
        }
      });
    }

    return tx.aIRuntimeConfig.create({
      data: {
        capability: source.capability,
        provider: source.provider,
        status: "published",
        enabled: source.enabled,
        displayName: source.displayName,
        apiKeyCiphertext: source.apiKeyCiphertext,
        apiKeyMask: source.apiKeyMask,
        configJson: source.configJson as Prisma.InputJsonValue,
        configChecksum: source.configChecksum,
        version: input.version,
        createdBy: input.publishedBy,
        publishedBy: input.publishedBy,
        publishedAt: now,
        rollbackFromId: source.id
      },
      include: includeProbes
    });
  });
}
