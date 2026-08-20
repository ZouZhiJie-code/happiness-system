import {
  Prisma,
  PrismaClient
} from "@prisma/gi088-evaluation-client";

import type {
  Gi088BatchState,
  Gi088StoredBatch
} from "@/server/services/evaluation/gi088/types";
import type {
  Gi088CreateBatchInput,
  Gi088EvaluationStore
} from "@/server/services/evaluation/gi088/store";
import { isGi088BatchPersistenceCoherent } from "@/server/services/evaluation/gi088/store";
import { resolveGi088EvaluationDatabaseUrl } from "@/server/services/evaluation/gi088/access";

const globalForGi088 = globalThis as typeof globalThis & {
  __gi088EvaluationPrisma__?: PrismaClient;
};

export function getGi088PrismaClient() {
  const databaseUrl = resolveGi088EvaluationDatabaseUrl(process.env);
  const client =
    globalForGi088.__gi088EvaluationPrisma__ ??
    new PrismaClient({
      datasources: {
        db: { url: databaseUrl }
      },
      log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"]
    });
  globalForGi088.__gi088EvaluationPrisma__ = client;
  return client;
}

function toStoredBatch(value: {
  id: string;
  ownerUserId: string;
  evaluationVersion: string;
  candidateFingerprint: string;
  executionFingerprint: string;
  status: string;
  state: Prisma.JsonValue;
  revision: number;
  createdAt: Date;
  updatedAt: Date;
  sealedAt: Date | null;
}): Gi088StoredBatch {
  if (
    value.status !== "running" &&
    value.status !== "sealed" &&
    value.status !== "early_stopped"
  ) {
    throw new Error("GI088_STORED_BATCH_STATUS_INVALID");
  }
  const stored: Gi088StoredBatch = {
    id: value.id,
    ownerUserId: value.ownerUserId,
    evaluationVersion: value.evaluationVersion,
    candidateFingerprint: value.candidateFingerprint,
    executionFingerprint: value.executionFingerprint,
    status: value.status,
    state: value.state as unknown as Gi088BatchState,
    revision: value.revision,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    sealedAt: value.sealedAt
  };
  if (!isGi088BatchPersistenceCoherent(stored)) {
    throw new Error("GI088_STORED_BATCH_TERMINAL_STATE_INVALID");
  }
  return stored;
}

export class Gi088PrismaStore implements Gi088EvaluationStore {
  private readonly client: PrismaClient;

  constructor(client = getGi088PrismaClient()) {
    this.client = client;
  }

  async findByOwnerAndVersion(ownerUserId: string, evaluationVersion: string) {
    const value = await this.client.gi088EvaluationBatch.findFirst({
      where: { ownerUserId, evaluationVersion },
      orderBy: [{ runOrdinal: "desc" }, { createdAt: "desc" }]
    });
    return value ? toStoredBatch(value) : null;
  }

  async create(input: Gi088CreateBatchInput) {
    if (!isGi088BatchPersistenceCoherent({
      status: "running",
      state: input.state,
      sealedAt: null
    })) {
      throw new Error("GI088_BATCH_PERSISTENCE_STATE_INVALID");
    }
    try {
      return toStoredBatch(
        await this.client.gi088EvaluationBatch.create({
          data: {
            id: input.state.batchId,
            ownerUserId: input.ownerUserId,
            evaluationVersion: input.evaluationVersion,
            candidateFingerprint: input.candidateFingerprint,
            executionFingerprint: input.executionFingerprint,
            status: "running",
            state: input.state as unknown as Prisma.InputJsonValue
          }
        })
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const existing = await this.findByOwnerAndVersion(
          input.ownerUserId,
          input.evaluationVersion
        );
        if (existing) return existing;
      }
      throw error;
    }
  }

  async compareAndSet(input: {
    id: string;
    expectedRevision: number;
    status: Gi088StoredBatch["status"];
    state: Gi088BatchState;
    sealedAt: Date | null;
  }) {
    if (!isGi088BatchPersistenceCoherent(input)) {
      throw new Error("GI088_BATCH_PERSISTENCE_STATE_INVALID");
    }
    const result = await this.client.gi088EvaluationBatch.updateMany({
      where: { id: input.id, revision: input.expectedRevision },
      data: {
        status: input.status,
        state: input.state as unknown as Prisma.InputJsonValue,
        sealedAt: input.sealedAt,
        revision: { increment: 1 }
      }
    });
    return result.count === 1;
  }
}

export function createGi088PrismaStore() {
  return new Gi088PrismaStore();
}
