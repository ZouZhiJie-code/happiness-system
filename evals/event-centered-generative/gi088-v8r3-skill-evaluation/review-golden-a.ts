import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import type {
  Gi088GoldenReviewItem,
  Gi088ReviewCheckpoint,
  Gi088ReviewVisibleMessage
} from "@/features/interview/event-centered/gi088-review-workbench";

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function stripMarkdown(value: string) {
  return value
    .replace(/^#+\s*/gmu, "")
    .replace(/^[-*]\s*/gmu, "")
    .replace(/\*\*/gu, "")
    .replace(/`/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
}

function quotedTextAfter(value: string, heading: RegExp) {
  const match = heading.exec(value);
  if (!match) return null;
  const tail = value.slice(match.index + match[0].length);
  const quote = /(?:^|\n)>\s?(.*(?:\n>\s?.*)*)/u.exec(tail);
  return quote?.[1]?.replace(/\n>\s?/gu, "\n").trim() ?? null;
}

function parseRoleDialogue(value: string): Gi088ReviewVisibleMessage[] {
  const messages: Gi088ReviewVisibleMessage[] = [];
  const lines = value.split("\n");
  let role: "user" | "assistant" | null = null;
  let buffer: string[] = [];
  const flush = () => {
    if (role && buffer.length > 0) {
      messages.push({ role, content: buffer.join("\n").trim() });
    }
    buffer = [];
  };
  for (const line of lines) {
    if (/^\*\*用户[：:]\*\*\s*$/u.test(line.trim())) {
      flush();
      role = "user";
      continue;
    }
    if (/^\*\*AI[：:]\*\*\s*$/u.test(line.trim())) {
      flush();
      role = "assistant";
      continue;
    }
    if (/^>\s?/u.test(line) && role) {
      buffer.push(line.replace(/^>\s?/u, ""));
    } else if (buffer.length > 0 && line.trim() === "") {
      buffer.push("");
    } else if (buffer.length > 0) {
      flush();
    }
  }
  flush();
  return messages.filter((message) => message.content.length > 0);
}

function buildItem(input: {
  sourceId: string;
  workingTask: string;
  conversation: Gi088ReviewVisibleMessage[];
  response: string;
  action?: "ask" | "synthesize" | "acknowledge" | "pause";
  understanding?: string | null;
  latencyMs?: number | null;
}): Gi088GoldenReviewItem {
  const checkpoints: Gi088ReviewCheckpoint[] = [
    {
      visibleConversation: input.conversation.slice(-40),
      candidateVisibleOutput: {
        action:
          input.action ??
          (/[?？]/u.test(input.response) ? "ask" : "synthesize"),
        understanding: input.understanding ?? null,
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
    sampleId: sha256(`gi088-v8r3-golden-a:${input.sourceId}`).slice(0, 20),
    sourcePartition: "golden_calibration",
    contentFingerprint: sha256(JSON.stringify({ checkpoints })),
    workingTask: input.workingTask,
    checkpoints
  };
}

function sectionByHeading(markdown: string, heading: RegExp) {
  const match = heading.exec(markdown);
  if (!match) throw new Error("GI088_GOLDEN_HISTORICAL_SECTION_MISSING");
  const next = markdown.indexOf("\n## ", match.index + match[0].length);
  return markdown.slice(match.index, next < 0 ? markdown.length : next);
}

function board6Items(markdown: string) {
  return ["R1", "R2", "C1", "C2", "C4", "C5", "C6"].map((id) => {
    const section = sectionByHeading(
      markdown,
      new RegExp(`^## 卡片 ${id}\\b.*$`, "mu")
    );
    const taskMatch = /### 1\.[^\n]*\n\n([\s\S]*?)\n\n### 2\./u.exec(section);
    const workingTask = stripMarkdown(taskMatch?.[1] ?? id);
    const responseSection = /### 4\.[^\n]*([\s\S]*?)(?:\n### 5\.|$)/u.exec(section)?.[1] ?? "";
    const explicitResponse = /(?:^|\n)>\s?(.*(?:\n>\s?.*)*)/u
      .exec(responseSection)?.[1]
      ?.replace(/\n>\s?/gu, "\n")
      .trim();
    const dialogue = parseRoleDialogue(section.split("### 5.")[0] ?? section);
    let response = explicitResponse;
    let conversation = dialogue;
    if (!response) {
      const lastAssistant = [...dialogue]
        .map((message, index) => ({ message, index }))
        .reverse()
        .find(({ message }) => message.role === "assistant");
      if (!lastAssistant) throw new Error(`GI088_GOLDEN_BOARD6_RESPONSE_MISSING:${id}`);
      response = lastAssistant.message.content;
      conversation = dialogue.slice(0, lastAssistant.index);
    }
    if (conversation.length < 2) {
      const userText = quotedTextAfter(section, /### 3\.[^\n]*/u);
      if (!userText) throw new Error(`GI088_GOLDEN_BOARD6_CONTEXT_MISSING:${id}`);
      conversation = [
        { role: "assistant", content: "此刻你想聊点什么？" },
        { role: "user", content: userText }
      ];
    }
    return buildItem({
      sourceId: `board6-${id}`,
      workingTask,
      conversation,
      response
    });
  });
}

function gi081Items(markdown: string) {
  return ["H1", "T1", "T2", "H3", "H2", "T3"].map((id) => {
    const section = sectionByHeading(
      markdown,
      new RegExp(`^## 第 \\d+ 题｜${id}$`, "mu")
    );
    const workingTask = stripMarkdown(
      /^- 用户任务：(.+)$/mu.exec(section)?.[1] ?? id
    );
    const context = /### 完整语境\n([\s\S]*?)\n### 回应甲/u.exec(section)?.[1] ?? "";
    const response = quotedTextAfter(section, /### 回应甲/u);
    const conversation = parseRoleDialogue(context);
    if (!response || conversation.length < 1) {
      throw new Error(`GI088_GOLDEN_GI081_CONTENT_MISSING:${id}`);
    }
    const normalizedConversation =
      conversation.length >= 2
        ? conversation
        : [
            { role: "assistant" as const, content: "此刻你想聊点什么？" },
            ...conversation
          ];
    return buildItem({
      sourceId: `gi081-${id}`,
      workingTask,
      conversation: normalizedConversation,
      response
    });
  });
}

type LegacyMessage = { role: "user" | "assistant"; content: string; id?: string };
type LegacyBranch = {
  messages: LegacyMessage[];
  turns?: Array<{
    status?: string;
    visible?: { understanding?: string; response?: string } | null;
    calls?: Array<{ status?: string; latencyMs?: number | null }>;
  }>;
  semanticState?: { workingTask?: { summary?: string } | null };
  review?: { reason?: string } | null;
};

function legacyTasks(value: unknown) {
  const object = value as {
    batch?: { tasks?: unknown[] };
    record?: { state?: { tasks?: unknown[] } };
  };
  return (object.batch?.tasks ?? object.record?.state?.tasks ?? []) as Array<{
    taskId?: string;
    initialUserMessage?: string;
    branches?: { high?: LegacyBranch };
  }>;
}

function legacyItem(sourceId: string, task: ReturnType<typeof legacyTasks>[number]) {
  const branch = task.branches?.high;
  const messages = branch?.messages ?? [];
  const lastAssistantIndex = messages.reduce(
    (latest, message, index) => (message.role === "assistant" ? index : latest),
    -1
  );
  if (lastAssistantIndex < 1) {
    throw new Error(`GI088_GOLDEN_LEGACY_ASSISTANT_MISSING:${sourceId}`);
  }
  const response = messages[lastAssistantIndex]!.content;
  const assistantOrdinal = messages
    .slice(0, lastAssistantIndex + 1)
    .filter((message) => message.role === "assistant").length - 1;
  const turn = branch?.turns?.[Math.max(0, assistantOrdinal - 1)];
  const validCall = turn?.calls?.find((call) => call.status === "valid");
  return buildItem({
    sourceId,
    workingTask:
      branch?.semanticState?.workingTask?.summary ??
      task.initialUserMessage ??
      "沿当前对话继续理解用户想弄清的事情",
    conversation: messages.slice(0, lastAssistantIndex).map(({ role, content }) => ({
      role,
      content
    })),
    response,
    understanding: turn?.visible?.understanding ?? null,
    latencyMs: validCall?.latencyMs ?? null
  });
}

export async function createGi088V8r3GoldenAItems(input: {
  repositoryRoot: string;
  historicalPrivateRoot: string;
}): Promise<Gi088GoldenReviewItem[]> {
  const board6 = await readFile(
    resolve(
      input.repositoryRoot,
      "artifacts/generative-interview-board6/2026-08-06/board6-calibration-8cards-v1-blind.md"
    ),
    "utf8"
  );
  const gi081 = await readFile(
    resolve(
      input.repositoryRoot,
      "artifacts/generative-interview-board7/2026-08-06-board7a-real-output-ab-v1/board7a-six-case-ab-v1-blind-review-run.md"
    ),
    "utf8"
  );
  const privateFiles = {
    v6: resolve(
      input.historicalPrivateRoot,
      "artifacts/local-runtime/gi088/2026-08-09-gi088-human-eval-v6-single-focus/gi088-v6-2-of-4-private-export.json"
    ),
    v7r4: resolve(
      input.historicalPrivateRoot,
      "artifacts/local-runtime/gi088-v7r4-sealed/v7r4-sealed-export.json"
    ),
    v8: resolve(
      input.historicalPrivateRoot,
      "artifacts/local-runtime/gi088-v8-sealed/v8-sealed-export.json"
    ),
    v1: resolve(
      input.historicalPrivateRoot,
      "artifacts/local-runtime/generative-interview-board7/2026-08-09-gi088-human-eval-v1/gi088-human-eval-v1-readonly-db-snapshot.json"
    )
  };
  const legacy = Object.fromEntries(
    await Promise.all(
      Object.entries(privateFiles).map(async ([key, path]) => [
        key,
        JSON.parse(await readFile(path, "utf8")) as unknown
      ])
    )
  );
  const select = (key: keyof typeof privateFiles, count: number) =>
    legacyTasks(legacy[key])
      .filter((task) => (task.branches?.high?.messages?.length ?? 0) >= 2)
      .slice(0, count)
      .map((task, index) => legacyItem(`${key}-${index + 1}`, task));
  const items = [
    ...board6Items(board6),
    ...gi081Items(gi081),
    ...select("v6", 2),
    ...select("v7r4", 2),
    ...select("v8", 1),
    ...select("v1", 2)
  ];
  if (items.length !== 20) throw new Error("GI088_GOLDEN_A_REQUIRES_20_ITEMS");
  return items;
}
