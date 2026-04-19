import type { JoyEntryDraft, JoyInterviewStage, JoySnapshot } from "@/types/interview";

export const openingQuestion = "今天有没有一个让你真心开心的瞬间？先讲那个具体时刻。";

export interface JoySignalFields {
  event: string | null;
  feeling: string | null;
  whyItMattered: string | null;
  happinessType: string | null;
  selfPattern: string | null;
}

export function createEmptySnapshot(): JoySnapshot {
  return buildJoySnapshot({
    event: null,
    feeling: null,
    whyItMattered: null,
    happinessType: null,
    selfPattern: null
  });
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function trimTrailingPunctuation(value: string) {
  return value.replace(/[。！？!?,，；;:\s]+$/g, "").trim();
}

function normalizeSlotValue(value: string | null | undefined, maxLength: number) {
  if (!value) {
    return null;
  }

  const normalized = trimTrailingPunctuation(normalizeText(value));

  if (!normalized) {
    return null;
  }

  return normalized.slice(0, maxLength);
}

function preferRicherValue(previous: string | null, candidate: string | null) {
  if (!candidate) {
    return previous;
  }

  if (!previous) {
    return candidate;
  }

  if (candidate.includes(previous) || candidate.length >= previous.length + 10) {
    return candidate;
  }

  return previous;
}

export function buildJoySnapshot(fields: JoySignalFields): JoySnapshot {
  const normalizedFields = {
    event: normalizeSlotValue(fields.event, 140),
    feeling: normalizeSlotValue(fields.feeling, 48),
    whyItMattered: normalizeSlotValue(fields.whyItMattered, 160),
    happinessType: normalizeSlotValue(fields.happinessType, 40),
    selfPattern: normalizeSlotValue(fields.selfPattern, 72)
  };
  const missingSlots = [
    normalizedFields.event ? null : "event",
    normalizedFields.whyItMattered ? null : "whyItMattered",
    normalizedFields.happinessType || normalizedFields.selfPattern ? null : "happinessTypeOrSelfPattern"
  ].filter(Boolean) as string[];
  const filledCount = 3 - missingSlots.length;

  return {
    ...normalizedFields,
    confidence: Math.min(0.32 + filledCount * 0.22, 0.96),
    missingSlots
  };
}

export function mergeJoySignals(previous: JoySnapshot, candidate: JoySignalFields): JoySnapshot {
  return buildJoySnapshot({
    event: preferRicherValue(previous.event, normalizeSlotValue(candidate.event, 140)),
    feeling: preferRicherValue(previous.feeling, normalizeSlotValue(candidate.feeling, 48)),
    whyItMattered: preferRicherValue(previous.whyItMattered, normalizeSlotValue(candidate.whyItMattered, 160)),
    happinessType: previous.happinessType ?? normalizeSlotValue(candidate.happinessType, 40),
    selfPattern: preferRicherValue(previous.selfPattern, normalizeSlotValue(candidate.selfPattern, 72))
  });
}

function inferEvent(message: string) {
  const normalized = normalizeText(message);
  const eventPart = normalized.split(/(?:因为|所以|也让我|这让我|让我觉得|我发现|说明我)/)[0] ?? normalized;
  const cleaned = trimTrailingPunctuation(eventPart);

  return cleaned.length > 4 ? cleaned.slice(0, 120) : null;
}

function inferReason(message: string) {
  const normalized = normalizeText(message);
  const matched = normalized.match(/(?:因为|所以|也让我|这让我|让我觉得|我发现|说明我)(.+)$/);

  if (!matched) {
    return null;
  }

  const cleaned = trimTrailingPunctuation(matched[0]);

  return cleaned.length > 4 ? cleaned.slice(0, 120) : null;
}

function inferFeeling(message: string) {
  const normalized = normalizeText(message);

  if (/(轻松|踏实|安心|松了一口气)/.test(normalized)) return "轻松踏实";
  if (/(兴奋|激动|雀跃|惊喜)/.test(normalized)) return "兴奋雀跃";
  if (/(温暖|被理解|被看见|陪伴)/.test(normalized)) return "温暖被理解";
  return normalized.length > 12 ? "开心而有能量" : null;
}

function inferHappinessType(message: string) {
  const normalized = normalizeText(message);

  if (/(朋友|家人|同事|老师|伴侣|一起|聊天|陪)/.test(normalized)) return "关系型开心";
  if (/(完成|解决|搞定|进展|交付|通过|做好)/.test(normalized)) return "成就型开心";
  if (/(阳光|散步|咖啡|饭|音乐|风景|天气)/.test(normalized)) return "感官型开心";
  return null;
}

function inferSelfPattern(message: string) {
  const normalized = normalizeText(message);

  if (/(我发现|原来我|说明我|其实我)/.test(normalized)) {
    return normalized.slice(0, 48);
  }

  return null;
}

export function extractJoySignals(message: string, previous: JoySnapshot): JoySnapshot {
  const normalized = normalizeText(message);

  return mergeJoySignals(previous, {
    event: inferEvent(normalized),
    feeling: inferFeeling(normalized),
    whyItMattered: inferReason(normalized),
    happinessType: inferHappinessType(normalized),
    selfPattern: inferSelfPattern(normalized)
  });
}

export function getNextStage(snapshot: JoySnapshot, turnCount: number): JoyInterviewStage {
  if (!snapshot.event) return "collect_event";
  if (!snapshot.whyItMattered) return "probe_reason";
  if (!snapshot.happinessType && !snapshot.selfPattern && turnCount < 4) return "probe_pattern";
  if (turnCount >= 4 || snapshot.happinessType || snapshot.selfPattern) return "wrap_up";

  return "collect_event";
}

export function buildAssistantQuestion(stage: JoyInterviewStage, snapshot: JoySnapshot) {
  switch (stage) {
    case "collect_event":
      return "我先想抓住那个画面。那一刻具体发生了什么？";
    case "probe_reason":
      return "听起来这件事有分量。它为什么会让你这么开心？";
    case "probe_pattern":
      if (snapshot.happinessType === "关系型开心") {
        return "这份开心像是来自连接感。你觉得自己在关系里最在乎什么？";
      }

      if (snapshot.happinessType === "成就型开心") {
        return "这份开心有点像把事情真正做成了。它说明了你重视什么？";
      }

      return "如果往深一点看，这份开心更像哪一种满足？它好像说明了你怎样的在乎或特质？";
    case "wrap_up":
      return "我已经抓到核心了。接下来我会先替你整理成一份开心日志草稿。";
    case "finalize":
      return "日志草稿已经准备好了。";
  }
}

export function createDraft(snapshot: JoySnapshot): JoyEntryDraft {
  const title = snapshot.event ? `今天的开心：${snapshot.event.slice(0, 18)}` : "今天的开心";
  const reasonText = snapshot.whyItMattered ? trimTrailingPunctuation(snapshot.whyItMattered) : null;
  const contentLines = [
    snapshot.event ? `今天让我开心的事情是：${trimTrailingPunctuation(snapshot.event)}。` : null,
    snapshot.feeling ? `当时我的感受是：${trimTrailingPunctuation(snapshot.feeling)}。` : null,
    reasonText
      ? `${reasonText.startsWith("因为") ? "这件事之所以重要，" : "这件事之所以重要，是因为："}${reasonText}。`
      : null,
    snapshot.happinessType ? `如果给这份开心命名，它更像：${trimTrailingPunctuation(snapshot.happinessType)}。` : null,
    snapshot.selfPattern ? `它也让我看见自己的一种模式：${trimTrailingPunctuation(snapshot.selfPattern)}。` : null
  ].filter(Boolean);

  const tags = [snapshot.happinessType, snapshot.feeling].filter(Boolean) as string[];

  return {
    title,
    content: contentLines.join("\n"),
    event: snapshot.event,
    feeling: snapshot.feeling,
    whyItMattered: snapshot.whyItMattered,
    happinessType: snapshot.happinessType,
    selfPattern: snapshot.selfPattern,
    tags,
    source: "ai_draft_direct"
  };
}
