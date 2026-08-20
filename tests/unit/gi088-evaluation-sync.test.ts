import {
  GI088_EVALUATION_SYNC_CHANNEL,
  createGi088EvaluationSync
} from "@/features/interview/event-centered/gi088-evaluation-sync";

type MessageListener = (event: MessageEvent) => void;

class FakeBroadcastChannel {
  static instances: FakeBroadcastChannel[] = [];

  readonly listeners = new Set<MessageListener>();
  readonly sent: unknown[] = [];
  closed = false;

  constructor(readonly name: string) {
    FakeBroadcastChannel.instances.push(this);
  }

  postMessage(message: unknown) {
    this.sent.push(message);
    for (const peer of FakeBroadcastChannel.instances) {
      if (peer === this || peer.closed || peer.name !== this.name) continue;
      peer.emit(message);
    }
  }

  addEventListener(_type: "message", listener: MessageListener) {
    this.listeners.add(listener);
  }

  removeEventListener(_type: "message", listener: MessageListener) {
    this.listeners.delete(listener);
  }

  emit(data: unknown) {
    for (const listener of this.listeners) {
      listener(new MessageEvent("message", { data }));
    }
  }

  close() {
    this.closed = true;
    this.listeners.clear();
  }
}

describe("GI-088 evaluation tab sync", () => {
  beforeEach(() => {
    FakeBroadcastChannel.instances = [];
  });

  it("只向另一标签页发送服务端状态已更新提示", () => {
    const createChannel = (name: string) => new FakeBroadcastChannel(name);
    const first = createGi088EvaluationSync({
      sourceId: "tab-1",
      now: () => new Date("2026-08-10T12:00:00.000Z"),
      createChannel
    });
    const second = createGi088EvaluationSync({
      sourceId: "tab-2",
      createChannel
    });
    const firstListener = vi.fn();
    const secondListener = vi.fn();
    first.subscribe(firstListener);
    second.subscribe(secondListener);

    expect(first.publish({ runId: "run-1", taskId: "A1", revision: 7 })).toBe(true);

    expect(firstListener).not.toHaveBeenCalled();
    expect(secondListener).toHaveBeenCalledWith({
      type: "run_updated",
      runId: "run-1",
      taskId: "A1",
      revision: 7,
      sourceId: "tab-1",
      emittedAt: "2026-08-10T12:00:00.000Z"
    });
    const posted = FakeBroadcastChannel.instances[0]!.sent[0] as Record<string, unknown>;
    expect(posted).not.toHaveProperty("session");
    expect(posted).not.toHaveProperty("payload");
    expect(FakeBroadcastChannel.instances[0]!.name).toBe(
      GI088_EVALUATION_SYNC_CHANNEL
    );

    first.close();
    second.close();
  });

  it("忽略自身、畸形消息与关闭后的消息", () => {
    const channel = new FakeBroadcastChannel(GI088_EVALUATION_SYNC_CHANNEL);
    const sync = createGi088EvaluationSync({
      sourceId: "tab-1",
      createChannel: () => channel
    });
    const listener = vi.fn();
    sync.subscribe(listener);

    channel.emit({ type: "run_updated", runId: "run-1" });
    channel.emit({
      type: "run_updated",
      runId: "run-1",
      taskId: null,
      revision: null,
      sourceId: "tab-1",
      emittedAt: "2026-08-10T12:00:00.000Z"
    });
    expect(listener).not.toHaveBeenCalled();

    sync.close();
    channel.emit({
      type: "run_updated",
      runId: "run-1",
      taskId: null,
      revision: null,
      sourceId: "tab-2",
      emittedAt: "2026-08-10T12:00:00.000Z"
    });
    expect(listener).not.toHaveBeenCalled();
  });

  it("浏览器不支持 BroadcastChannel 时安全降级为纯本地状态", () => {
    const sync = createGi088EvaluationSync({
      sourceId: "tab-no-channel",
      createChannel: () => null
    });
    const listener = vi.fn();
    sync.subscribe(listener);

    expect(sync.available).toBe(false);
    expect(sync.publish({ runId: "run-1", taskId: null, revision: null })).toBe(false);
    expect(listener).not.toHaveBeenCalled();
    sync.close();
  });
});
