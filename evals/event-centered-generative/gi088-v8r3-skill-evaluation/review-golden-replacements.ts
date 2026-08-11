import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import type {
  Gi088GoldenReviewItem,
  Gi088ReviewCheckpoint
} from "@/features/interview/event-centered/gi088-review-workbench";
import {
  GI088_V8R3_GOLDEN_REPLACEMENT_TARGETS,
  type Gi088GoldenReplacement
} from "@/features/interview/event-centered/gi088-golden-revision-workbench";

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function buildItem(input: {
  sourceId: string;
  workingTask: string;
  conversation: Array<{ role: "user" | "assistant"; content: string }>;
  action: "ask" | "synthesize" | "acknowledge" | "pause";
  understanding: string | null;
  response: string;
  latencyMs?: number | null;
}): Gi088GoldenReviewItem {
  const checkpoints: Gi088ReviewCheckpoint[] = [
    {
      visibleConversation: input.conversation,
      candidateVisibleOutput: {
        action: input.action,
        understanding: input.understanding,
        response: input.response
      },
      safeTrace: {
        latencyMs: input.latencyMs ?? null,
        automaticRecoveryCount: 0,
        contractValid: true,
        technicalFailure: false
      }
    }
  ];
  return {
    sampleId: sha256(`gi088-v8r3-golden-revision:${input.sourceId}`).slice(0, 20),
    sourcePartition: "golden_calibration",
    contentFingerprint: sha256(JSON.stringify({ checkpoints })),
    workingTask: input.workingTask,
    checkpoints
  };
}

type HistoricalTask = {
  taskId?: string;
  initialUserMessage?: string;
  branches?: {
    high?: {
      messages?: Array<{
        role: "user" | "assistant";
        content: string;
      }>;
      turns?: Array<{
        status?: string;
        visible?: {
          understanding?: string | null;
          response?: string;
        } | null;
        calls?: Array<{ status?: string; latencyMs?: number | null }>;
      }>;
      semanticState?: { workingTask?: { summary?: string } | null };
      review?: { quality?: string } | null;
    };
  };
};

function historicalTasks(value: unknown): HistoricalTask[] {
  const source = value as {
    batch?: { tasks?: HistoricalTask[] };
    record?: { state?: { tasks?: HistoricalTask[] } };
  };
  return source.batch?.tasks ?? source.record?.state?.tasks ?? [];
}

function historicalReplacement(
  task: HistoricalTask,
  sourceId: string
): Gi088GoldenReviewItem {
  const branch = task.branches?.high;
  const messages = branch?.messages ?? [];
  const lastAssistantIndex = messages.reduce(
    (latest, message, index) => (message.role === "assistant" ? index : latest),
    -1
  );
  if (
    branch?.review?.quality !== "direct_use" ||
    lastAssistantIndex < 2 ||
    messages[lastAssistantIndex]?.content.trim().length === 0
  ) {
    throw new Error(`GI088_GOLDEN_REVISION_HISTORICAL_SOURCE_INVALID:${sourceId}`);
  }
  const assistantOrdinal = messages
    .slice(0, lastAssistantIndex + 1)
    .filter((message) => message.role === "assistant").length - 1;
  const turn = branch.turns?.[Math.max(0, assistantOrdinal - 1)];
  const validCall = turn?.calls?.find((call) => call.status === "valid");
  const response = messages[lastAssistantIndex]!.content.trim();
  return buildItem({
    sourceId,
    workingTask:
      branch.semanticState?.workingTask?.summary ??
      task.initialUserMessage ??
      "沿当前对话继续理解用户想弄清的事情",
    conversation: messages.slice(0, lastAssistantIndex),
    action: /[?？]/u.test(response) ? "ask" : "synthesize",
    understanding: turn?.visible?.understanding ?? null,
    response,
    latencyMs: validCall?.latencyMs ?? null
  });
}

const goldenBReplacements = [
  {
    replacesSampleId: "0531ff06e571750e1433",
    sourceId: "revision-b-open-synthesis",
    workingTask: "看清加班后持续刷手机的起点，并验证已经选定的调整",
    conversation: [
      { role: "user" as const, content: "我发现自己总在加班后刷手机刷到很晚。" },
      {
        role: "assistant" as const,
        content: "你想弄清楚明明已经很累，为什么还会继续刷。最近一次拿起手机前发生了什么？"
      },
      {
        role: "user" as const,
        content: "就是脑子很累，不想再做选择，手机又在手边。我准备回家后把手机放客厅，洗澡就睡。继续。"
      }
    ],
    action: "synthesize" as const,
    understanding: "你已经找到刷下去的起点，也选了一个直接作用在起点上的调整。",
    response:
      "可以先把这条认识留下：加班后的决策疲劳和手机在手边一起拉长了刷屏，把手机放客厅正好减少这个入口。接下来几晚的实际变化还能继续校准它。"
  },
  {
    replacesSampleId: "6cf63c06acd9f3c506df",
    sourceId: "revision-b-open-hypotheses",
    workingTask: "用可观察证据区分室友反复不收碗的原因",
    conversation: [
      { role: "user" as const, content: "室友最近连续几次都不把洗好的碗收起来。" },
      {
        role: "assistant" as const,
        content: "你想知道他反复这么做的原因。你提醒过他以后，他当时怎么回应？"
      },
      {
        role: "user" as const,
        content: "我提醒过一次，他说晚点弄，最后还是没收。他到底为什么这样？"
      }
    ],
    action: "ask" as const,
    understanding: "目前能确认的是他多次把碗留在原处，提醒后仍没收，具体原因还缺证据。",
    response:
      "可能是他容易忘，也可能是他认为放在沥水架已经算收好。你观察到他对别的家务也会答应后忘记，还是只在收碗这件事上这样？"
  },
  {
    replacesSampleId: "82a60aa011cf10f4d7f3",
    sourceId: "revision-b-risk-reask",
    workingTask: "理解公开汇报后反复复盘的原因",
    conversation: [
      { role: "user" as const, content: "会上我把一个数字说错了，后来已经更正，但回家后还在反复想。" },
      {
        role: "assistant" as const,
        content: "数字已经更正，脑子却还停在那个失误上。你最担心别人因此怎么看你？"
      },
      { role: "user" as const, content: "我担心他们觉得我准备不充分，也觉得自己当时很丢脸。" }
    ],
    action: "ask" as const,
    understanding: "你担心大家觉得你准备不充分，也明确说到了丢脸。",
    response: "这种担心让你心里是什么感觉？"
  },
  {
    replacesSampleId: "973716c2abdb150af397",
    sourceId: "revision-b-risk-drift",
    workingTask: "弄清写了提纲后汇报顺序仍会乱的触发点",
    conversation: [
      { role: "user" as const, content: "周会上我一开口就容易把汇报顺序讲乱。" },
      {
        role: "assistant" as const,
        content: "你可能很担心同事觉得你准备不足。最近一次讲乱时，你最在意谁的反应？"
      },
      {
        role: "user" as const,
        content: "我其实不在意他们怎么看。我想弄清楚的是，明明写了提纲，开口后为什么还是会乱。"
      }
    ],
    action: "ask" as const,
    understanding: "你还是很在意别人如何评价你的准备程度。",
    response: "如果他们觉得你准备得不够好，你最担心接下来会发生什么？"
  },
  {
    replacesSampleId: "edff7a14bf7b283fb83d",
    sourceId: "revision-b-risk-burden",
    workingTask: "看清休息时仍然内疚的触发条件",
    conversation: [
      { role: "user" as const, content: "我周末休息时总会内疚，感觉别人都在进步。" },
      {
        role: "assistant" as const,
        content: "你把休息和落后联系在了一起。最近一次这种内疚最明显是什么时候？"
      },
      { role: "user" as const, content: "昨天下午。我本来想睡一会儿，一看到同事发学习打卡就睡不着了。" }
    ],
    action: "ask" as const,
    understanding: "同事的学习打卡触发了你休息就会落后的担心。",
    response:
      "你当时最怕自己落后在哪一方面？这种比较最早从什么时候开始？如果不休息你准备做什么？"
  }
];

export async function createGi088V8r3GoldenReplacementItems(input: {
  historicalPrivateRoot: string;
}): Promise<readonly [Gi088GoldenReplacement[], Gi088GoldenReplacement[]]> {
  const sourcePath = resolve(
    input.historicalPrivateRoot,
    "artifacts/local-runtime/generative-interview-board7/2026-08-09-gi088-human-eval-v1/gi088-human-eval-v1-readonly-db-snapshot.json"
  );
  const source = JSON.parse(await readFile(sourcePath, "utf8")) as unknown;
  const tasks = historicalTasks(source);
  const historicalTargets = [
    ["ad32bd47c838f5b21c21", "A3"],
    ["71019b39a3c9df4438e0", "A5"],
    ["a2d65e0d286a53c2e930", "A8"]
  ] as const;
  const goldenA = historicalTargets.map(([replacesSampleId, taskId]) => {
    const task = tasks.find((candidate) => candidate.taskId === taskId);
    if (!task) {
      throw new Error(`GI088_GOLDEN_REVISION_HISTORICAL_TASK_MISSING:${taskId}`);
    }
    return {
      replacesSampleId,
      item: historicalReplacement(task, `revision-a-v1-${taskId.toLowerCase()}`)
    };
  });
  const goldenB = goldenBReplacements
    .map((replacement) => ({
      replacesSampleId: replacement.replacesSampleId,
      item: buildItem(replacement)
    }))
    .sort(
      (left, right) =>
        GI088_V8R3_GOLDEN_REPLACEMENT_TARGETS.goldenB.indexOf(
          left.replacesSampleId as (typeof GI088_V8R3_GOLDEN_REPLACEMENT_TARGETS.goldenB)[number]
        ) -
        GI088_V8R3_GOLDEN_REPLACEMENT_TARGETS.goldenB.indexOf(
          right.replacesSampleId as (typeof GI088_V8R3_GOLDEN_REPLACEMENT_TARGETS.goldenB)[number]
        )
    );
  return [goldenA, goldenB];
}
