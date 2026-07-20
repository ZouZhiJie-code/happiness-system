import { AI_FEEDBACK_TAGS } from "@/features/ai-feedback/feedback-config";

export type AIQualityArtifactType = keyof typeof AI_FEEDBACK_TAGS;

type IssueRule = {
  pattern: RegExp;
  label: string;
  description: string;
  expectedImprovement: string;
};

const FEEDBACK_LABEL_BY_CODE = new Map<string, string>(
  Object.values(AI_FEEDBACK_TAGS)
    .flat()
    .map((item) => [item.code, item.label] as const)
);

const ISSUE_RULES: IssueRule[] = [
  {
    pattern: /schema|provider|generation_not_completed|missing_final_output|database|trace|request_log|invalid_.*payload/iu,
    label: "生成异常",
    description: "生成过程出现技术异常，影响了最终回复。",
    expectedImprovement: "复现异常、修复生成链路，并完成自动化回归检查。"
  },
  {
    pattern: /repetitive_question|repeat.*question/iu,
    label: "追问重复",
    description: "AI 重复询问用户已经回答或明确拒绝回答的内容。",
    expectedImprovement: "让 AI 识别已经回答和已经拒绝的内容，改用新的低压具体锚点。"
  },
  {
    pattern: /misunderstood|misunderstand/iu,
    label: "理解偏差",
    description: "AI 对用户刚刚表达的重点理解不准确。",
    expectedImprovement: "让 AI 先依据用户原话确认重点，再生成下一步回应。"
  },
  {
    pattern: /boundary|ignored_boundary|stop_request|user_override/iu,
    label: "忽视停止边界",
    description: "用户已经想停下或直接整理，AI 仍继续追问。",
    expectedImprovement: "让 AI 在用户表达停止、拒绝继续或整理意图时及时收住。"
  },
  {
    pattern: /too_abstract|abstract|clarity|multiple_questions|question_/iu,
    label: "问题太抽象",
    description: "AI 的问题偏抽象，或一次提出了多个问题。",
    expectedImprovement: "让 AI 每次只问一个具体、容易回答的问题。"
  },
  {
    pattern: /ground|hallucin|anchor|factually_wrong|missing_supporting|faithful/iu,
    label: "事实或依据有误",
    description: "回复加入了用户没有表达过的内容，或遗漏了关键事实依据。",
    expectedImprovement: "让 AI 只使用用户真正表达过的事实，并保留关键场景。"
  },
  {
    pattern: /tone_uncomfortable|tone|diagnosis|pressure|advice|self_blame|safety/iu,
    label: "语气不舒服",
    description: "回复语气带来压力、说教感或不恰当的判断。",
    expectedImprovement: "让 AI 的语气更自然、温和，并尊重用户节奏。"
  },
  {
    pattern: /bad_title|title/iu,
    label: "标题不合适",
    description: "日志标题不够自然、准确，或没有概括具体体验。",
    expectedImprovement: "让日志标题简短自然，并准确概括用户经历。"
  },
  {
    pattern: /missing_key_detail/iu,
    label: "遗漏重要内容",
    description: "日志遗漏了用户表达过的重要事实或感受。",
    expectedImprovement: "让日志完整保留决定这段经历意义的关键信息。"
  },
  {
    pattern: /dimension_mismatch/iu,
    label: "偏离当前维度",
    description: "回复的重点偏离了当前维度的产品目标。",
    expectedImprovement: "让回复围绕当前维度的核心问题组织材料。"
  },
  {
    pattern: /voice_mismatch/iu,
    label: "文风不像用户",
    description: "生成内容的语气和表达方式偏离用户原本的说话方式。",
    expectedImprovement: "让正文沿用用户的自然语言和表达节奏。"
  },
  {
    pattern: /awkward_writing/iu,
    label: "表达不自然",
    description: "生成内容的结构或中文表达不够自然。",
    expectedImprovement: "让内容按真实经历展开，并使用自然、可读的中文。"
  }
];

function normalizeIssueCode(issueCode: string | null | undefined) {
  return issueCode?.trim().toLowerCase() ?? "";
}

function getFeedbackCode(issueCode: string) {
  return issueCode.replace(/^(?:user_downvote|feedback):/u, "");
}

function getFeedbackLabel(issueCode: string, artifactType?: AIQualityArtifactType | null) {
  const feedbackCode = getFeedbackCode(issueCode);
  if (artifactType) {
    const match = AI_FEEDBACK_TAGS[artifactType].find((item) => item.code === feedbackCode);
    if (match) return match.label;
  }
  return FEEDBACK_LABEL_BY_CODE.get(feedbackCode) ?? null;
}

function getIssueRule(issueCode: string) {
  return ISSUE_RULES.find((rule) => rule.pattern.test(issueCode)) ?? null;
}

export function getAIQualityIssueLabel(
  issueCode: string | null | undefined,
  artifactType?: AIQualityArtifactType | null
) {
  const normalized = normalizeIssueCode(issueCode);
  if (!normalized) return "待确认问题";
  if (getFeedbackCode(normalized) === "free_text") return "补充文字反馈";
  return getFeedbackLabel(normalized, artifactType) ?? getIssueRule(normalized)?.label ?? "其他质量问题";
}

export function getAIQualityIssueDescription(
  issueCode: string | null | undefined,
  artifactType?: AIQualityArtifactType | null
) {
  const normalized = normalizeIssueCode(issueCode);
  if (!normalized) return "系统发现了一组需要管理员确认的回复。";
  if (getFeedbackCode(normalized) === "free_text") return "用户通过文字补充了具体问题，需要结合原对话判断。";
  const feedbackLabel = getFeedbackLabel(normalized, artifactType);
  const rule = getIssueRule(normalized);
  if (rule) return rule.description;
  if (feedbackLabel) return `用户反馈这条回复存在“${feedbackLabel}”的问题。`;
  return "系统发现了一组需要管理员进一步判断的相似质量问题。";
}

export function getAIQualityExpectedImprovement(issueCode: string | null | undefined) {
  const normalized = normalizeIssueCode(issueCode);
  if (!normalized) return "让 AI 的回复更准确、自然，并符合当前产品目标。";
  if (getFeedbackCode(normalized) === "free_text") return "结合用户文字反馈和原对话，形成可验证的具体调整。";
  return getIssueRule(normalized)?.expectedImprovement ?? "降低这一具体问题再次出现的概率。";
}
