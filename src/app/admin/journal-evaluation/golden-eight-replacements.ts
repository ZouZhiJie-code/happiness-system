import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export type GoldenEightReplacementCard = {
  caseId: string;
  label: string;
  mode: "帮我记" | "陪我聊";
  title: string;
  content: string;
};

export const GOLDEN_EIGHT_REPLACEMENT_ROUND_ID =
  "2026-08-11.gi088-v8r3-golden-replacements-v1" as const;

export const GOLDEN_EIGHT_REPLACEMENT_TARGETS = [
  "ad32bd47c838f5b21c21",
  "71019b39a3c9df4438e0",
  "a2d65e0d286a53c2e930",
  "82a60aa011cf10f4d7f3",
  "6cf63c06acd9f3c506df",
  "0531ff06e571750e1433",
  "973716c2abdb150af397",
  "edff7a14bf7b283fb83d"
] as const;

const HISTORICAL_SNAPSHOT_PATH = resolve(
  process.cwd(),
  "artifacts/local-runtime/generative-interview-board7/2026-08-09-gi088-human-eval-v1/gi088-human-eval-v1-readonly-db-snapshot.json"
);

type HistoricalMessage = { role?: string; content?: string };
type HistoricalTask = {
  taskId?: string;
  initialUserMessage?: string;
  branches?: {
    high?: {
      messages?: HistoricalMessage[];
      review?: { quality?: string } | null;
      semanticState?: { workingTask?: { summary?: string } | null };
    };
  };
};

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function formatConversation(messages: HistoricalMessage[]) {
  return messages
    .filter((message) => (message.role === "user" || message.role === "assistant") && message.content?.trim())
    .map((message) => `${message.role === "user" ? "用户" : "AI"}：\n${message.content!.trim()}`)
    .join("\n\n");
}

function historicalCard(
  task: HistoricalTask,
  targetId: string,
  ordinal: number,
  taskId: string
): GoldenEightReplacementCard {
  const branch = task.branches?.high;
  const messages = branch?.messages ?? [];
  const responseIndex = messages.reduce(
    (latest, message, index) => (message.role === "assistant" ? index : latest),
    -1
  );
  if (
    branch?.review?.quality !== "direct_use" ||
    responseIndex < 1 ||
    !messages[responseIndex]?.content?.trim()
  ) {
    throw new Error(`GOLDEN_EIGHT_REPLACEMENT_HISTORICAL_SOURCE_INVALID:${taskId}`);
  }
  const response = messages[responseIndex]!.content!.trim();
  const conversation = formatConversation(messages.slice(0, responseIndex));
  const workingTask =
    branch.semanticState?.workingTask?.summary ??
    task.initialUserMessage ??
    "沿当前对话继续理解用户想弄清的事情";
  return {
    caseId: targetId,
    label: `替换项 ${ordinal}`,
    mode: "陪我聊",
    title: "真实对话中的高质量回应",
    content: [
      "### 用户想完成什么",
      workingTask,
      "",
      "### 已有对话语境",
      conversation,
      "",
      "### 候选可见回应",
      `> ${response}`
    ].join("\n")
  };
}

function buildSyntheticCard(input: {
  targetId: string;
  ordinal: number;
  title: string;
  workingTask: string;
  conversation: string;
  response: string;
  action: string;
  mode?: "帮我记" | "陪我聊";
}) {
  return {
    caseId: input.targetId,
    label: `替换项 ${input.ordinal}`,
    mode: input.mode ?? "陪我聊",
    title: input.title,
    content: [
      "### 用户想完成什么",
      input.workingTask,
      "",
      "### 已有对话语境",
      input.conversation,
      "",
      "### 候选可见回应",
      `动作：${input.action}`,
      `> ${input.response}`
    ].join("\n")
  } satisfies GoldenEightReplacementCard;
}

const B_REPLACEMENTS = [
  buildSyntheticCard({
    targetId: GOLDEN_EIGHT_REPLACEMENT_TARGETS[5],
    ordinal: 6,
    title: "信息已经充分时的自然整理",
    workingTask: "看清加班后持续刷手机的起点，并验证已经选定的调整",
    conversation: "用户：我发现自己总在加班后刷手机刷到很晚。\n\nAI：你想弄清明明已经很累，为什么还会继续刷。最近一次拿起手机前发生了什么？\n\n用户：就是脑子很累，不想再做选择，手机又在手边。我准备回家后把手机放客厅，洗澡就睡。继续。",
    action: "synthesize",
    response: "可以先把这条认识留下：加班后的决策疲劳和手机在手边一起拉长了刷屏，把手机放客厅正好减少这个入口。接下来几晚的实际变化还能继续校准它。"
  }),
  buildSyntheticCard({
    targetId: GOLDEN_EIGHT_REPLACEMENT_TARGETS[4],
    ordinal: 5,
    title: "证据有限时给出可修正假设",
    workingTask: "用可观察证据区分室友反复不收碗的原因",
    conversation: "用户：室友最近连续几次都不把洗好的碗收起来。\n\nAI：你想知道他反复这么做的原因。你提醒过他以后，他当时怎么回应？\n\n用户：我提醒过一次，他说晚点弄，最后还是没收。他到底为什么这样？",
    action: "ask",
    response: "可能是他容易忘，也可能是他认为放在沥水架已经算收好。你观察到他对别的家务也会答应后忘记，还是只在收碗这件事上这样？"
  }),
  buildSyntheticCard({
    targetId: GOLDEN_EIGHT_REPLACEMENT_TARGETS[3],
    ordinal: 4,
    title: "避免把已经说过的感受再问一遍",
    workingTask: "理解公开汇报后反复复盘的原因",
    conversation: "用户：会上我把一个数字说错了，后来已经更正，但回家后还在反复想。\n\nAI：数字已经更正，脑子却还停在那个失误上。你最担心别人因此怎么看你？\n\n用户：我担心他们觉得我准备不充分，也觉得自己当时很丢脸。",
    action: "ask",
    response: "这种担心让你心里是什么感觉？"
  }),
  buildSyntheticCard({
    targetId: GOLDEN_EIGHT_REPLACEMENT_TARGETS[6],
    ordinal: 7,
    title: "用户纠正后回到新的共同任务",
    workingTask: "弄清写了提纲后汇报顺序仍会乱的触发点",
    conversation: "用户：周会上我一开口就容易把汇报顺序讲乱。\n\nAI：你可能很担心同事觉得你准备不足。最近一次讲乱时，你最在意谁的反应？\n\n用户：我其实不在意他们怎么看。我想弄清楚的是，明明写了提纲，开口后为什么还是会乱。",
    action: "ask",
    response: "你把重点纠正清楚了：现在要理解的是准备充分后，表达顺序仍会乱。最近一次开始乱，是刚开口时，还是讲到某个具体部分之后？"
  }),
  buildSyntheticCard({
    targetId: GOLDEN_EIGHT_REPLACEMENT_TARGETS[7],
    ordinal: 8,
    title: "一轮只保留一个可回答的问题",
    workingTask: "看清休息时仍然内疚的触发条件",
    conversation: "用户：我周末休息时总会内疚，感觉别人都在进步。\n\nAI：你把休息和落后联系在了一起。最近一次这种内疚最明显是什么时候？\n\n用户：昨天下午。我本来想睡一会儿，一看到同事发学习打卡就睡不着了。",
    action: "ask",
    response: "同事的学习打卡触发了你休息就会落后的担心。那一刻你最想守住的，是休息本身，还是不被比较牵着走？"
  })
] as const;

export async function loadGoldenEightReplacementCards(): Promise<GoldenEightReplacementCard[]> {
  const source = JSON.parse(await readFile(HISTORICAL_SNAPSHOT_PATH, "utf8")) as {
    batch?: { tasks?: HistoricalTask[] };
    record?: { state?: { tasks?: HistoricalTask[] } };
  };
  const tasks = source.batch?.tasks ?? source.record?.state?.tasks ?? [];
  const historical = (["A3", "A5", "A8"] as const).map((taskId, index) => {
    const task = tasks.find((candidate) => candidate.taskId === taskId);
    if (!task) throw new Error(`GOLDEN_EIGHT_REPLACEMENT_HISTORICAL_TASK_MISSING:${taskId}`);
    return historicalCard(task, GOLDEN_EIGHT_REPLACEMENT_TARGETS[index]!, index + 1, taskId);
  });
  const replacementsByTarget = new Map(B_REPLACEMENTS.map((card) => [card.caseId, card]));
  const orderedB = GOLDEN_EIGHT_REPLACEMENT_TARGETS.slice(3).map((targetId) => {
    const card = replacementsByTarget.get(targetId);
    if (!card) throw new Error(`GOLDEN_EIGHT_REPLACEMENT_CASE_MISSING:${targetId}`);
    return card;
  });
  return [...historical, ...orderedB];
}

export function goldenEightReplacementSourceSha256(cards: readonly GoldenEightReplacementCard[]) {
  return sha256(JSON.stringify(cards));
}
