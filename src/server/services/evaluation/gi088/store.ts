import type { Gi088BatchState, Gi088StoredBatch } from "./types";

export function isGi088BatchPersistenceCoherent(input: {
  status: Gi088StoredBatch["status"];
  state: Gi088BatchState;
  sealedAt: Date | null;
}) {
  if (input.state.status !== input.status) return false;
  if (input.status === "running") {
    return input.sealedAt === null &&
      input.state.sealedAt === null &&
      !input.state.earlyStop;
  }
  const terminalAt = input.sealedAt?.toISOString() ?? null;
  if (!terminalAt || input.state.sealedAt !== terminalAt) return false;
  if (input.status === "sealed") return !input.state.earlyStop;
  return input.state.earlyStop?.stoppedAt === terminalAt;
}

export type Gi088CreateBatchInput = {
  ownerUserId: string;
  evaluationVersion: string;
  candidateFingerprint: string;
  executionFingerprint: string;
  state: Gi088BatchState;
};

export interface Gi088EvaluationStore {
  findByOwnerAndVersion(
    ownerUserId: string,
    evaluationVersion: string
  ): Promise<Gi088StoredBatch | null>;
  create(input: Gi088CreateBatchInput): Promise<Gi088StoredBatch>;
  compareAndSet(input: {
    id: string;
    expectedRevision: number;
    status: Gi088StoredBatch["status"];
    state: Gi088BatchState;
    sealedAt: Date | null;
  }): Promise<boolean>;
}

export class Gi088MemoryStore implements Gi088EvaluationStore {
  private readonly records = new Map<string, Gi088StoredBatch>();

  async findByOwnerAndVersion(ownerUserId: string, evaluationVersion: string) {
    const value = [...this.records.values()].find(
      (item) =>
        item.ownerUserId === ownerUserId &&
        item.evaluationVersion === evaluationVersion
    );
    return value ? structuredClone(value) : null;
  }

  async create(input: Gi088CreateBatchInput) {
    if (!isGi088BatchPersistenceCoherent({
      status: "running",
      state: input.state,
      sealedAt: null
    })) {
      throw new Error("GI088_BATCH_PERSISTENCE_STATE_INVALID");
    }
    const existing = await this.findByOwnerAndVersion(
      input.ownerUserId,
      input.evaluationVersion
    );
    if (existing) return existing;
    const now = new Date();
    const value: Gi088StoredBatch = {
      id: input.state.batchId,
      ownerUserId: input.ownerUserId,
      evaluationVersion: input.evaluationVersion,
      candidateFingerprint: input.candidateFingerprint,
      executionFingerprint: input.executionFingerprint,
      status: "running",
      state: structuredClone(input.state),
      revision: 0,
      createdAt: now,
      updatedAt: now,
      sealedAt: null
    };
    this.records.set(value.id, value);
    return structuredClone(value);
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
    const current = this.records.get(input.id);
    if (!current || current.revision !== input.expectedRevision) return false;
    this.records.set(input.id, {
      ...current,
      status: input.status,
      state: structuredClone(input.state),
      revision: current.revision + 1,
      updatedAt: new Date(),
      sealedAt: input.sealedAt
    });
    return true;
  }
}
