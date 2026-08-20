import { prisma } from "@/server/db/prisma";
import {
  BOARD8_GI058_PREVIEW_REVIEW,
  board8PreviewAngleLabel,
  type Board8PreviewReviewCaseDefinition
} from "@/features/interview/event-centered/board8-preview-review";
import { parseEventCenteredAssistantPayload } from "@/features/interview/event-centered/dialogue-state";
import { getEventCenteredInterviewWorkspaceData } from "@/server/repositories/event-centered-interview.repository";

export type Board8PreviewReviewTimelineItem = {
  id: string;
  order: number;
  role: "user" | "assistant" | "control";
  content: string;
  understanding: string | null;
  createdAt: string;
};

export type Board8PreviewReviewJournal = {
  id: string;
  title: string;
  content: string;
  status: "draft" | "saved" | "modified";
  savedAt: string | null;
  editedAt: string | null;
  contentRevision: number;
};

export type Board8PreviewReviewCase = Omit<Board8PreviewReviewCaseDefinition, "rootSessionId"> & {
  rootSessionId: string;
  eventId: string;
  timeline: Board8PreviewReviewTimelineItem[];
  journal: Board8PreviewReviewJournal | null;
};

export type Board8PreviewReviewPacket = {
  packetVersion: "board8.gi058.local-review.v1";
  candidate: {
    id: string;
    label: string;
    strategyVersion: string;
    promptVersion: string;
    semanticArtifactVersion: string;
  };
  cases: Board8PreviewReviewCase[];
};

function recordOf(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function labelForControlAction(input: {
  action: string;
  eventOperationData: unknown;
}) {
  const operation = recordOf(input.eventOperationData);
  const angle = stringValue(operation.angle);
  const angleLabel = angle && angle in board8PreviewAngleLabel
    ? board8PreviewAngleLabel[angle as keyof typeof board8PreviewAngleLabel]
    : null;

  switch (input.action) {
    case "select_exploration_angle":
      return angleLabel ? `选择「${angleLabel}」角度继续复盘` : "选择一个复盘角度";
    case "select_current_event":
      return "选择一件事继续聚焦";
    case "continue_exploration":
      return "选择继续深入";
    case "correct_understanding":
      return "更正前面的理解";
    case "regenerate_response":
      return "请求换一种说法";
    case "switch_response_version":
      return "切换到另一版回应";
    case "resume_turn":
      return "继续生成上一轮回应";
    case "generate_event_journal":
      return "生成事件日志";
    case "exit_event":
      return "结束本次事件复盘";
    default:
      return "完成一次系统操作";
  }
}

function toTimelineItem(message: {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  rawText: string | null;
  sequence: number;
  createdAt: string;
}): Board8PreviewReviewTimelineItem | null {
  if (message.role === "system") return null;
  if (message.role === "user") {
    const content = (message.rawText ?? message.content).trim();
    if (!content) return null;
    return {
      id: message.id,
      order: message.sequence * 10,
      role: "user",
      content,
      understanding: null,
      createdAt: message.createdAt
    };
  }

  const payload = parseEventCenteredAssistantPayload(message.content);
  if (payload?.presentation === "hidden") return null;
  const content = (payload?.naturalResponse ?? message.content).trim();
  if (!content) return null;
  return {
    id: message.id,
    order: message.sequence * 10,
    role: "assistant",
    content,
    understanding: payload?.naturalUnderstanding.trim() || null,
    createdAt: message.createdAt
  };
}

async function readBoard8PreviewReviewCase(definition: Board8PreviewReviewCaseDefinition): Promise<Board8PreviewReviewCase> {
  const root = await prisma.interviewSession.findFirst({
    where: {
      id: definition.rootSessionId,
      mode: "event_centered",
      parentSessionId: null
    },
    select: { id: true, userId: true }
  });
  if (!root) throw new Error("BOARD8_GI058_REVIEW_ROOT_SESSION_NOT_FOUND");

  const workspace = await getEventCenteredInterviewWorkspaceData(root.userId, root.id);
  if (!workspace?.identity.eventId) {
    throw new Error("BOARD8_GI058_REVIEW_WORKSPACE_NOT_FOUND");
  }

  const activeBranchSessionIds = Array.from(new Set(
    workspace.messages.map((message) => message.branchSessionId)
  ));
  const [turns, entry] = await Promise.all([
    prisma.interviewUserTurn.findMany({
      where: { sessionId: { in: activeBranchSessionIds } },
      orderBy: [{ baseMessageSequence: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        action: true,
        baseMessageSequence: true,
        eventOperationData: true,
        createdAt: true
      }
    }),
    prisma.journalEventEntry.findFirst({
      where: { eventId: workspace.identity.eventId },
      select: {
        id: true,
        title: true,
        content: true,
        status: true,
        savedAt: true,
        editedAt: true,
        contentRevision: true
      }
    })
  ]);

  const timeline = [
    ...workspace.messages.flatMap((message) => {
      const item = toTimelineItem(message);
      return item ? [item] : [];
    }),
    ...turns
      .filter((turn) => turn.action !== "reply")
      .map((turn) => ({
        id: `control:${turn.id}`,
        order: turn.baseMessageSequence * 10 + 5,
        role: "control" as const,
        content: labelForControlAction(turn),
        understanding: null,
        createdAt: turn.createdAt.toISOString()
      }))
  ].sort((left, right) =>
    left.order - right.order || left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id)
  );

  return {
    ...definition,
    rootSessionId: root.id,
    eventId: workspace.identity.eventId,
    timeline,
    journal: entry
      ? {
          id: entry.id,
          title: entry.title,
          content: entry.content,
          status: entry.status,
          savedAt: entry.savedAt?.toISOString() ?? null,
          editedAt: entry.editedAt?.toISOString() ?? null,
          contentRevision: entry.contentRevision
        }
      : null
  };
}

/**
 * 只供本机受控 Preview 页面读取。返回值故意包含完整对话与日志，
 * 因此调用方必须先通过 `canOpenBoard8Gi058PreviewReview` 的环境门。
 */
export async function readBoard8Gi058PreviewReviewPacket(): Promise<Board8PreviewReviewPacket> {
  const cases = await Promise.all(
    BOARD8_GI058_PREVIEW_REVIEW.cases.map((definition) => readBoard8PreviewReviewCase(definition))
  );
  return {
    packetVersion: "board8.gi058.local-review.v1",
    candidate: {
      id: BOARD8_GI058_PREVIEW_REVIEW.candidateId,
      label: BOARD8_GI058_PREVIEW_REVIEW.candidateLabel,
      strategyVersion: BOARD8_GI058_PREVIEW_REVIEW.strategyVersion,
      promptVersion: BOARD8_GI058_PREVIEW_REVIEW.promptVersion,
      semanticArtifactVersion: BOARD8_GI058_PREVIEW_REVIEW.semanticArtifactVersion
    },
    cases
  };
}
