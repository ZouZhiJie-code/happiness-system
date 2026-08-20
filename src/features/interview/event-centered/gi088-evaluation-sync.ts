"use client";

export const GI088_EVALUATION_SYNC_CHANNEL =
  "daily-light:gi088:evaluation-sync:v8r2" as const;

export type Gi088EvaluationUpdateNotice = {
  type: "run_updated";
  runId: string;
  taskId: string | null;
  revision: number | null;
  sourceId: string;
  emittedAt: string;
};

type Gi088EvaluationUpdateInput = Pick<
  Gi088EvaluationUpdateNotice,
  "runId" | "taskId" | "revision"
>;

type Gi088BroadcastChannelLike = {
  postMessage(message: unknown): void;
  addEventListener(type: "message", listener: (event: MessageEvent) => void): void;
  removeEventListener(type: "message", listener: (event: MessageEvent) => void): void;
  close(): void;
};

type Gi088EvaluationSyncDependencies = {
  sourceId?: string;
  now?: () => Date;
  createChannel?: (name: string) => Gi088BroadcastChannelLike | null;
};

function createSourceId() {
  const random = globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `gi088-tab-${random}`;
}

function validNotice(value: unknown): value is Gi088EvaluationUpdateNotice {
  if (!value || typeof value !== "object") return false;
  const notice = value as Partial<Gi088EvaluationUpdateNotice>;
  return notice.type === "run_updated" &&
    typeof notice.runId === "string" && notice.runId.length > 0 &&
    (notice.taskId === null ||
      (typeof notice.taskId === "string" && notice.taskId.length > 0)) &&
    (notice.revision === null ||
      (typeof notice.revision === "number" &&
        Number.isSafeInteger(notice.revision) &&
        notice.revision >= 0)) &&
    typeof notice.sourceId === "string" && notice.sourceId.length > 0 &&
    typeof notice.emittedAt === "string";
}

function defaultCreateChannel(name: string) {
  if (typeof BroadcastChannel === "undefined") return null;
  return new BroadcastChannel(name) satisfies Gi088BroadcastChannelLike;
}

/**
 * 跨标签页通道只传递“有新状态”提示。调用方收到提示后仍需通过 GET
 * 读取服务端事实；消息本身不包含 session，也不触发写操作。
 */
export function createGi088EvaluationSync(
  dependencies: Gi088EvaluationSyncDependencies = {}
) {
  const sourceId = dependencies.sourceId ?? createSourceId();
  const now = dependencies.now ?? (() => new Date());
  const channel = dependencies.createChannel
    ? dependencies.createChannel(GI088_EVALUATION_SYNC_CHANNEL)
    : defaultCreateChannel(GI088_EVALUATION_SYNC_CHANNEL);
  const listeners = new Set<(notice: Gi088EvaluationUpdateNotice) => void>();
  let closed = false;

  const onMessage = (event: MessageEvent) => {
    if (closed || !validNotice(event.data) || event.data.sourceId === sourceId) {
      return;
    }
    for (const listener of listeners) listener(event.data);
  };

  channel?.addEventListener("message", onMessage);

  return {
    sourceId,
    available: Boolean(channel),
    publish(input: Gi088EvaluationUpdateInput) {
      if (closed || !channel || !input.runId) return false;
      const notice: Gi088EvaluationUpdateNotice = {
        type: "run_updated",
        runId: input.runId,
        taskId: input.taskId,
        revision: input.revision,
        sourceId,
        emittedAt: now().toISOString()
      };
      channel.postMessage(notice);
      return true;
    },
    subscribe(listener: (notice: Gi088EvaluationUpdateNotice) => void) {
      if (closed) return () => undefined;
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    close() {
      if (closed) return;
      closed = true;
      listeners.clear();
      channel?.removeEventListener("message", onMessage);
      channel?.close();
    }
  };
}
