import { getInterviewDimensionConfig } from "@/features/interview/server/dimension-config";
import type { InterviewDimension, JoyEntryDraft, JoyInterviewStage, JoySnapshot } from "@/types/interview";

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
  if (/(专注|投入|沉浸)/.test(normalized)) return "投入专注";
  if (/(惭愧|遗憾|着急|懊恼)/.test(normalized)) return "警觉想调整";
  if (/(感谢|感激|被接住|被支持)/.test(normalized)) return "感激被支持";
  return normalized.length > 12 ? "开心而有能量" : null;
}

function inferSummaryByDimension(message: string, dimension: InterviewDimension) {
  const normalized = normalizeText(message);

  switch (dimension) {
    case "joy":
      if (/(朋友|家人|同事|老师|伴侣|一起|聊天|陪)/.test(normalized)) return "关系型开心";
      if (/(完成|解决|搞定|进展|交付|通过|做好)/.test(normalized)) return "成就型开心";
      if (/(阳光|散步|咖啡|饭|音乐|风景|天气)/.test(normalized)) return "感官型开心";
      return null;
    case "fulfillment":
      if (/(完成|推进|整理完|收尾|交付|解决|推进完)/.test(normalized)) return "进展型充实";
      if (/(专心|沉浸|投入|专注|练习|学习)/.test(normalized)) return "投入型充实";
      if (/(帮助|协作|一起|支持|配合)/.test(normalized)) return "协作型充实";
      return null;
    case "reflection":
      if (/(意识到|原来|重新看待|想明白|理解到)/.test(normalized)) return "洞察型思考";
      if (/(纠结|犹豫|选择|到底|要不要)/.test(normalized)) return "判断型思考";
      if (/(关系|沟通|他人|朋友|家人)/.test(normalized)) return "关系型思考";
      return null;
    case "improvement":
      if (/(表达|说话|沟通|开会|回复)/.test(normalized)) return "表达型改进";
      if (/(着急|节奏|拖延|时间|准备)/.test(normalized)) return "节奏型改进";
      if (/(合作|配合|反馈|交接|协作)/.test(normalized)) return "协作型改进";
      return null;
    case "gratitude":
      if (/(帮助|支持|提醒|照顾|接住)/.test(normalized)) return "支持型感谢";
      if (/(陪伴|聊天|听我说|一起|等我)/.test(normalized)) return "陪伴型感谢";
      if (/(体谅|理解|包容|关心|善意)/.test(normalized)) return "善意型感谢";
      return null;
  }
}

function inferSelfPattern(message: string) {
  const normalized = normalizeText(message);

  if (/(我发现|原来我|说明我|其实我)/.test(normalized)) {
    return normalized.slice(0, 48);
  }

  return null;
}

export function extractJoySignals(dimension: InterviewDimension, message: string, previous: JoySnapshot): JoySnapshot {
  const normalized = normalizeText(message);

  return mergeJoySignals(previous, {
    event: inferEvent(normalized),
    feeling: inferFeeling(normalized),
    whyItMattered: inferReason(normalized),
    happinessType: inferSummaryByDimension(normalized, dimension),
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

export function getOpeningQuestion(dimension: InterviewDimension) {
  return getInterviewDimensionConfig(dimension).openingQuestion;
}

export function getCompletedRestartMessage(dimension: InterviewDimension) {
  return getInterviewDimensionConfig(dimension).completedRestartMessage;
}

export function buildAssistantQuestion(
  dimension: InterviewDimension,
  stage: JoyInterviewStage,
  snapshot: JoySnapshot
) {
  const config = getInterviewDimensionConfig(dimension);

  switch (stage) {
    case "collect_event":
      return "我先想抓住那个画面。那一刻具体发生了什么？";
    case "probe_reason":
      return config.reasonQuestion;
    case "probe_pattern":
      if (dimension === "joy" && snapshot.happinessType === "关系型开心") {
        return "这份开心像是来自连接感。你觉得自己在关系里最在乎什么？";
      }

      if (dimension === "joy" && snapshot.happinessType === "成就型开心") {
        return "这份开心有点像把事情真正做成了。它说明了你重视什么？";
      }

      if (dimension === "gratitude" && snapshot.happinessType === "支持型感谢") {
        return "这种被支持的感觉很明确。你觉得自己最想感谢的，到底是哪一种被接住？";
      }

      if (dimension === "improvement" && snapshot.happinessType === "表达型改进") {
        return "如果把焦点放回那一刻，你最想调的是表达方式，还是表达时机？";
      }

      return config.genericPatternQuestion;
    case "wrap_up":
      return config.wrapUpMessage;
    case "finalize":
      return "日志草稿已经准备好了。";
  }
}

export function createDraft(dimension: InterviewDimension, snapshot: JoySnapshot): JoyEntryDraft {
  const config = getInterviewDimensionConfig(dimension);
  const title = snapshot.event ? `${config.draftTitlePrefix}：${snapshot.event.slice(0, 18)}` : config.draftTitlePrefix;
  const reasonText = snapshot.whyItMattered ? trimTrailingPunctuation(snapshot.whyItMattered) : null;
  const contentLines = [
    snapshot.event ? `${config.eventLinePrefix}${trimTrailingPunctuation(snapshot.event)}。` : null,
    snapshot.feeling ? `当时我的感受是：${trimTrailingPunctuation(snapshot.feeling)}。` : null,
    reasonText
      ? `${reasonText.startsWith("因为") ? "这件事之所以重要，" : config.reasonLinePrefix}${reasonText}。`
      : null,
    snapshot.happinessType ? `${config.summaryLinePrefix}${trimTrailingPunctuation(snapshot.happinessType)}。` : null,
    snapshot.selfPattern ? `${config.selfPatternLinePrefix}${trimTrailingPunctuation(snapshot.selfPattern)}。` : null
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
