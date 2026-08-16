import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type JsonRecord = Record<string, unknown>;

type AssetGroup =
  | "hard_boundary"
  | "development"
  | "hidden_v2"
  | "preview_4_plus_2";

type EvidenceLayer =
  | "bottom_line"
  | "local_action"
  | "complete_trajectory"
  | "user_experience";

export type ReviewItem = {
  reviewItemId: string;
  sourceCaseId: string;
  sourceVersion: string;
  assetGroup: AssetGroup;
  assetLabel: string;
  evidenceLayer: EvidenceLayer;
  evaluationUnitLabel: string;
  productMode: "chat" | "capture" | "mixed" | "unspecified";
  currentScopeSignal: "in_scope" | "out_of_scope" | "needs_review";
  riskLevel: string;
  privacyLevel: string;
  sourceClass: string;
  title: string;
  scene: unknown;
  userGoal: unknown;
  minimumContext: unknown;
  actualMaterial: unknown;
  constructUnderTest: unknown;
  whyAdded: unknown;
  allowedOutcomeRange: unknown;
  expectedKeyActions: unknown;
  prohibitedBehaviors: unknown;
  blockerPolicy: unknown;
  objectiveChecks: unknown;
  source: unknown;
  lineage: unknown;
  authorizationStatus: string;
  factualReadiness: {
    concreteRuntimeInput: boolean;
    sourceRecorded: boolean;
    privacyRecorded: boolean;
    lineageRecorded: boolean;
  };
  factualNotes: string[];
};

type PreviewBlueprint = {
  caseId: string;
  title: string;
  mode: ReviewItem["productMode"];
  layer: EvidenceLayer;
  riskLevel: string;
  scene: string;
  userGoal: string;
  construct: string;
  expected: string[];
  prohibited: string[];
  objectiveChecks: string[];
};

type SourceDocuments = {
  hard: JsonRecord;
  development: JsonRecord;
  hidden: JsonRecord;
};

const PACKAGE_VERSION = "2026-08-16.gi088-evaluation-asset-review-v1";

const PREVIEW_BLUEPRINTS: PreviewBlueprint[] = [
  {
    caseId: "PREVIEW-P1",
    title: "真实【帮我记】正常记录",
    mode: "capture",
    layer: "user_experience",
    riskLevel: "P1",
    scene: "产品负责人使用自己的真实记录任务，完成一次从表达、连续补充到主动生成日志的完整体验。",
    userGoal: "低负担地说完真实材料，并获得忠实、可编辑的记录。",
    construct: "零追问承接、连续输入、多片段组织、用户主动生成和日志忠实。",
    expected: ["完整任务与日志闭环", "用户原话和事实来源保持可追溯"],
    prohibited: ["主动追问改变记录模式", "日志加入用户没有表达的事实"],
    objectiveChecks: []
  },
  {
    caseId: "PREVIEW-P2",
    title: "【帮我记】风险轨迹",
    mode: "capture",
    layer: "user_experience",
    riskLevel: "P0",
    scene: "脚本化触发纠正、直接向 AI 提问、稀疏内容或独立片段等风险。",
    userGoal: "在复杂表达下继续保持记录控制和来源边界。",
    construct: "纠正、直接提问、稀疏内容和独立片段下的模式稳定性。",
    expected: ["保持记录模式", "正确吸收纠正", "独立材料不串线"],
    prohibited: ["进入访谈追问", "忽略纠正", "拼接无关事件"],
    objectiveChecks: []
  },
  {
    caseId: "PREVIEW-P3",
    title: "真实【陪我聊】价值轨迹",
    mode: "chat",
    layer: "user_experience",
    riskLevel: "P1",
    scene: "产品负责人用一个真实、自然展开的话题完成开放式多轮反思。",
    userGoal: "从模糊期待出发，逐渐梳理想法并形成至少一个对自己有帮助的认识。",
    construct: "焦点对齐、问题价值、认识增量、自然收束和日志忠实。",
    expected: ["至少形成一个有效认识", "完整聊天与日志闭环", "问题值得回答且负担合适"],
    prohibited: ["重复索取同一材料", "把模型推断写成用户事实", "强迫形成预设结论"],
    objectiveChecks: []
  },
  {
    caseId: "PREVIEW-P4",
    title: "【陪我聊】风险与边界轨迹",
    mode: "chat",
    layer: "user_experience",
    riskLevel: "P0",
    scene: "脚本化触发纠正、拒答、说不清、求建议、外部信息或事件边界。",
    userGoal: "在边界情境中仍保有控制感，并获得合格暂停或自然退出。",
    construct: "纠正、拒答、低清晰表达、建议请求、外部信息和事件隔离的处理。",
    expected: ["控制与纠正得到可感知响应", "允许 qualified_pause 或 user_control_exit"],
    prohibited: ["忽略停止或拒答", "越权给出权威判断", "独立事件串线"],
    objectiveChecks: []
  },
  {
    caseId: "PREVIEW-S1",
    title: "完整链路与恢复冒烟",
    mode: "mixed",
    layer: "bottom_line",
    riskLevel: "P0",
    scene: "检查两种模式入口、会话恢复、生成日志和结束后新记录入口。",
    userGoal: "关键产品链路可以完成、恢复并回到下一次记录。",
    construct: "入口、恢复、日志和结束状态的端到端完整性。",
    expected: ["两模式入口可用", "恢复保持同一会话事实", "生成日志和新记录入口可达"],
    prohibited: ["恢复丢失原话", "重复生成造成状态冲突"],
    objectiveChecks: ["入口状态", "恢复状态", "日志生成状态", "结束与新记录入口"]
  },
  {
    caseId: "PREVIEW-S2",
    title: "隔离与回退冒烟",
    mode: "mixed",
    layer: "bottom_line",
    riskLevel: "P0",
    scene: "检查旧五维入口、事件中心隔离、恢复和 Production 当前策略。",
    userGoal: "新的评测与候选工作保持隔离，既有产品路径可以安全回退。",
    construct: "环境隔离、旧路径兼容和 Production 回退边界。",
    expected: ["Production 当前策略保持 event_centered + baseline", "评测数据与真实用户链路隔离"],
    prohibited: ["私有评测进入 Production", "评测数据污染真实用户数据"],
    objectiveChecks: ["环境身份", "数据隔离", "Production 策略", "回退路径"]
  }
];

function resolvePaths(cwd = process.cwd()) {
  const assetRoot = path.join(
    cwd,
    "artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1"
  );
  const privateRoot = path.join(assetRoot, ".private/evaluation-asset-review-v1");
  return {
    assetRoot,
    privateRoot,
    hard: path.join(assetRoot, "hard-boundary-regression-24.json"),
    development: path.join(assetRoot, "development-challenge-28.json"),
    hidden: path.join(assetRoot, ".private/independent-admission-v2/hidden-cases.json"),
    previewSpec: path.join(
      cwd,
      "docs/technical/interview-event-centered/04x-07-evaluation-preview-and-handoff.md"
    ),
    template: path.join(cwd, "scripts/gi088-evaluation-asset-review-template.html"),
    privatePacket: path.join(privateRoot, "review-packet.json"),
    privateDecisions: path.join(privateRoot, "review-decisions.json"),
    privateSummary: path.join(privateRoot, "review-summary.json"),
    privateHtml: path.join(privateRoot, "index.html"),
    publicReceipt: path.join(assetRoot, "evaluation-asset-review-v1-receipt.json")
  };
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asRecord(value: unknown): JsonRecord {
  return isRecord(value) ? value : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown, fallback = "源资产未提供") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function hasValue(value: unknown) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (isRecord(value)) return Object.keys(value).length > 0;
  return true;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalize(value[key])])
  );
}

function canonicalJson(value: unknown) {
  return JSON.stringify(canonicalize(value));
}

function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

async function readJson(filePath: string): Promise<JsonRecord> {
  return JSON.parse(await readFile(filePath, "utf8")) as JsonRecord;
}

async function fileHash(filePath: string) {
  return sha256(await readFile(filePath));
}

function productMode(value: unknown): ReviewItem["productMode"] {
  if (value === "chat") return "chat";
  if (value === "capture") return "capture";
  if (value === "mixed") return "mixed";
  return "unspecified";
}

function scopeSignal(mode: ReviewItem["productMode"]): ReviewItem["currentScopeSignal"] {
  if (mode === "chat") return "in_scope";
  if (mode === "capture") return "out_of_scope";
  return "needs_review";
}

function normalizeHardCases(document: JsonRecord): ReviewItem[] {
  const identity = asRecord(document.datasetIdentity);
  return asArray(document.cases).map((rawCase, index) => {
    const item = asRecord(rawCase);
    const source = item.source;
    return {
      reviewItemId: "HB-" + String(index + 1).padStart(2, "0"),
      sourceCaseId: asString(item.caseId),
      sourceVersion: asString(item.version, asString(identity.version)),
      assetGroup: "hard_boundary",
      assetLabel: "必须守住的底线",
      evidenceLayer: "bottom_line",
      evaluationUnitLabel: "底线规则",
      productMode: "unspecified",
      currentScopeSignal: "needs_review",
      riskLevel: asString(item.riskLevel),
      privacyLevel: asString(item.privacyLevel),
      sourceClass: asString(asRecord(source).type, "产品规则或历史事故合同"),
      title: asString(item.title),
      scene: item.scene,
      userGoal: item.userGoal,
      minimumContext: "当前目录只记录场景与目标，尚未提供可直接运行的输入、消息或故障注入步骤。",
      actualMaterial: {
        scene: item.scene,
        userGoal: item.userGoal
      },
      constructUnderTest: item.family,
      whyAdded: item.whyAdded,
      allowedOutcomeRange: item.expectedBehavior,
      expectedKeyActions: item.expectedBehavior,
      prohibitedBehaviors: item.prohibitedBehavior,
      blockerPolicy: "源资产风险级别：" + asString(item.riskLevel),
      objectiveChecks: item.objectiveChecks,
      source,
      lineage: source,
      authorizationStatus: "源资产未提供单题授权字段；当前材料为产品规则或去标识历史合同。",
      factualReadiness: {
        concreteRuntimeInput: false,
        sourceRecorded: hasValue(source),
        privacyRecorded: hasValue(item.privacyLevel),
        lineageRecorded: hasValue(source)
      },
      factualNotes: [
        "当前资产状态字段为 " + asString(item.status) + "。",
        "objectiveChecks 为检查名称目录，仍需逐项确认能否客观执行。",
        "当前产品范围为【陪我聊】，本题模式需要产品负责人判断。"
      ]
    };
  });
}

function normalizeDevelopmentCases(document: JsonRecord): ReviewItem[] {
  const identity = asRecord(document.datasetIdentity);
  return asArray(document.cases).map((rawCase, index) => {
    const item = asRecord(rawCase);
    const source = item.source;
    const caseType = asString(item.caseType);
    const factualNotes = [
      "当前资产状态字段为 " + asString(item.status) + "。",
      "当前目录缺少自包含运行输入，需判断它继续承担开发发现、回归或退出身份。"
    ];
    if (caseType === "single_variable_counterfactual") {
      factualNotes.push("本题标记为单变量反事实，需要检查父案例和变化变量是否完整。");
    }
    if (asString(item.status, "") === "ready_with_legacy_axis_note") {
      factualNotes.push("本题带有旧判尺备注，需要按当前产品规则重新确认。");
    }
    return {
      reviewItemId: "DEV-" + String(index + 1).padStart(2, "0"),
      sourceCaseId: asString(item.caseId),
      sourceVersion: asString(item.version, asString(identity.version)),
      assetGroup: "development",
      assetLabel: "开发问题集",
      evidenceLayer: "local_action",
      evaluationUnitLabel: "局部对话动作",
      productMode: "unspecified",
      currentScopeSignal: "needs_review",
      riskLevel: asString(item.riskLevel),
      privacyLevel: asString(item.privacyLevel),
      sourceClass: caseType,
      title: asString(item.title),
      scene: item.scene,
      userGoal: item.userGoal,
      minimumContext: "当前目录只提供场景、用户目标和判尺摘要；历史失败重放载荷或完整反事实输入仍待补齐。",
      actualMaterial: {
        scene: item.scene,
        userGoal: item.userGoal,
        historicalGoldLabel: item.goldLabel ?? asRecord(source).goldLabel ?? null
      },
      constructUnderTest: item.capability,
      whyAdded: item.whyAdded,
      allowedOutcomeRange: item.expectedBehavior,
      expectedKeyActions: item.expectedBehavior,
      prohibitedBehaviors: item.prohibitedBehavior,
      blockerPolicy: "源资产风险级别：" + asString(item.riskLevel),
      objectiveChecks: [],
      source,
      lineage: {
        semanticLineageKey: item.semanticLineageKey,
        source
      },
      authorizationStatus: "按源资产隐私字段处理；单题授权字段未提供。",
      factualReadiness: {
        concreteRuntimeInput: false,
        sourceRecorded: hasValue(source),
        privacyRecorded: hasValue(item.privacyLevel),
        lineageRecorded: hasValue(item.semanticLineageKey) || hasValue(source)
      },
      factualNotes
    };
  });
}

function normalizeHiddenCases(document: JsonRecord): ReviewItem[] {
  return asArray(document.cases).map((rawCase, index) => {
    const item = asRecord(rawCase);
    const mode = productMode(item.recordMode);
    const body = asRecord(item.body);
    const anchors = asRecord(item.scoringAnchors);
    const isTrajectory = item.caseType === "complete_trajectory";
    const lineage = item.lineage;
    const sourceClass = asString(item.sourceClass);
    return {
      reviewItemId: "HID-" + String(index + 1).padStart(2, "0"),
      sourceCaseId: asString(item.caseId),
      sourceVersion: asString(item.version, asString(document.version)),
      assetGroup: "hidden_v2",
      assetLabel: "隐藏 v2 审题材料",
      evidenceLayer: isTrajectory ? "complete_trajectory" : "local_action",
      evaluationUnitLabel: isTrajectory ? "完整聊天轨迹" : "局部对话动作",
      productMode: mode,
      currentScopeSignal: scopeSignal(mode),
      riskLevel: "按禁区与评分锚点逐题确认",
      privacyLevel: asString(item.privacyLevel),
      sourceClass,
      title: asString(item.userGoal, asString(item.caseId)),
      scene: body.openingUserMaterial ?? body.openingUserInput ?? body.currentUserInput ?? body.currentUserSubmission,
      userGoal: item.userGoal,
      minimumContext: {
        startingState: body.startingState,
        priorUserMaterial: body.priorUserMaterial,
        priorKnownMaterial: body.priorKnownMaterial,
        interactionProtocol: body.interactionProtocol
      },
      actualMaterial: body,
      constructUnderTest: body.evaluationTarget ?? item.capabilityArea,
      whyAdded: {
        capabilityArea: item.capabilityArea,
        sourceClass: item.sourceClass
      },
      allowedOutcomeRange: item.expectedBehavior,
      expectedKeyActions: {
        expectedBehavior: item.expectedBehavior,
        requiredEvidence: anchors.requiredEvidence
      },
      prohibitedBehaviors: item.prohibitedBehavior,
      blockerPolicy: anchors.singleCaseBlocker,
      objectiveChecks: [],
      source: {
        sourceClass: item.sourceClass,
        privacyLevel: item.privacyLevel
      },
      lineage,
      authorizationStatus:
        sourceClass === "product_owner_private_new_topic"
          ? "两条真实话题授权 2/2；本页仅在 Git 排除区展示。"
          : "独立评测者合成材料，无真人个人授权需求。",
      factualReadiness: {
        concreteRuntimeInput: hasValue(body),
        sourceRecorded: hasValue(item.sourceClass),
        privacyRecorded: hasValue(item.privacyLevel),
        lineageRecorded: hasValue(lineage)
      },
      factualNotes: [
        "本轮审题会话已经读取正文，当前按产品审题与开发回归材料管理。",
        "未来正式独立准入建设语义不同的隐藏 v3。",
        mode === "capture"
          ? "当前产品范围为【陪我聊】，本题明确属于范围外。"
          : "当前产品范围为【陪我聊】，本题明确属于范围内。"
      ]
    };
  });
}

function normalizePreviewCases(): ReviewItem[] {
  return PREVIEW_BLUEPRINTS.map((item, index) => ({
    reviewItemId: "PRE-" + String(index + 1).padStart(2, "0"),
    sourceCaseId: item.caseId,
    sourceVersion: "GI-074-preview-blueprint-v1",
    assetGroup: "preview_4_plus_2",
    assetLabel: "4＋2 真人 Preview 蓝图",
    evidenceLayer: item.layer,
    evaluationUnitLabel:
      item.caseId.startsWith("PREVIEW-S") ? "端到端底座冒烟" : "完整用户体验",
    productMode: item.mode,
    currentScopeSignal: scopeSignal(item.mode),
    riskLevel: item.riskLevel,
    privacyLevel: item.caseId === "PREVIEW-P1" || item.caseId === "PREVIEW-P3"
      ? "private_real_task"
      : "synthetic_or_operational",
    sourceClass: item.caseId.startsWith("PREVIEW-P") ? "preview_trajectory_blueprint" : "preview_smoke_blueprint",
    title: item.title,
    scene: item.scene,
    userGoal: item.userGoal,
    minimumContext: "当前只完成场景与通过门蓝图，具体开场、风险触发点、结束条件、评审卡或逐步检查单仍待建设。",
    actualMaterial: {
      scene: item.scene,
      userGoal: item.userGoal,
      concreteExecutionInputs: []
    },
    constructUnderTest: item.construct,
    whyAdded: "承担候选进入受控真人体验前的完整产品验收。",
    allowedOutcomeRange: item.expected,
    expectedKeyActions: item.expected,
    prohibitedBehaviors: item.prohibited,
    blockerPolicy: "单例阻断为 0；质量失败为 0。",
    objectiveChecks: item.objectiveChecks,
    source: "docs/technical/interview-event-centered/04x-07-evaluation-preview-and-handoff.md#10",
    lineage: "GI-074 4＋2 Preview 蓝图",
    authorizationStatus: "真实任务在正式 Preview 前逐题确认；本轮只审蓝图。",
    factualReadiness: {
      concreteRuntimeInput: false,
      sourceRecorded: true,
      privacyRecorded: true,
      lineageRecorded: true
    },
    factualNotes: [
      "当前候选的具体执行包尚未形成。",
      item.mode === "capture"
        ? "当前产品范围为【陪我聊】，本项明确属于范围外。"
        : item.mode === "chat"
          ? "当前产品范围为【陪我聊】，本项明确属于范围内。"
          : "本项同时涉及多个模式或环境，需要产品负责人判断当前去向。"
    ]
  }));
}

export function buildReviewItems(documents: SourceDocuments): ReviewItem[] {
  return [
    ...normalizeHardCases(documents.hard),
    ...normalizeDevelopmentCases(documents.development),
    ...normalizeHiddenCases(documents.hidden),
    ...normalizePreviewCases()
  ];
}

function summarizeItems(items: ReviewItem[]) {
  const byGroup = Object.fromEntries(
    ["hard_boundary", "development", "hidden_v2", "preview_4_plus_2"].map((group) => [
      group,
      items.filter((item) => item.assetGroup === group).length
    ])
  );
  const byLayer = Object.fromEntries(
    ["bottom_line", "local_action", "complete_trajectory", "user_experience"].map((layer) => [
      layer,
      items.filter((item) => item.evidenceLayer === layer).length
    ])
  );
  const byMode = Object.fromEntries(
    ["chat", "capture", "mixed", "unspecified"].map((mode) => [
      mode,
      items.filter((item) => item.productMode === mode).length
    ])
  );
  return {
    total: items.length,
    byGroup,
    byLayer,
    byMode,
    concreteRuntimeInputs: items.filter((item) => item.factualReadiness.concreteRuntimeInput).length,
    sourceRecorded: items.filter((item) => item.factualReadiness.sourceRecorded).length,
    privacyRecorded: items.filter((item) => item.factualReadiness.privacyRecorded).length,
    lineageRecorded: items.filter((item) => item.factualReadiness.lineageRecorded).length
  };
}

export async function buildEvaluationAssetReview(cwd = process.cwd()) {
  const paths = resolvePaths(cwd);
  const [hard, development, hidden, template] = await Promise.all([
    readJson(paths.hard),
    readJson(paths.development),
    readJson(paths.hidden),
    readFile(paths.template, "utf8")
  ]);
  const items = buildReviewItems({ hard, development, hidden });
  const summary = summarizeItems(items);
  if (
    summary.total !== 70 ||
    summary.byGroup.hard_boundary !== 24 ||
    summary.byGroup.development !== 28 ||
    summary.byGroup.hidden_v2 !== 12 ||
    summary.byGroup.preview_4_plus_2 !== 6
  ) {
    throw new Error("GI088_ASSET_REVIEW_COUNT_MISMATCH");
  }

  const sourceFingerprints = {
    hardBoundary24: await fileHash(paths.hard),
    development28: await fileHash(paths.development),
    hiddenV2Body: await fileHash(paths.hidden),
    preview4Plus2Specification: await fileHash(paths.previewSpec)
  };
  const generatedAt = new Date().toISOString();
  const packetCore = {
    schemaVersion: "1.0",
    packageVersion: PACKAGE_VERSION,
    purpose:
      "产品负责人审查现有评测题目是否真实、清楚、可复现、可稳定判断，并适合承担当前证据职责。",
    supportedDecision: "评测题目资产是否可以保留、修改、降级、升级、退出或等待产品规则决定。",
    unsupportedDecisions: [
      "候选质量",
      "Judge 资格",
      "独立准入",
      "真人 Preview 结果",
      "发布资格"
    ],
    currentProductScope: "accompany_me_chat",
    codexOpinionCount: 0,
    hiddenV2Role: "product_review_and_development_regression_material",
    futureIndependentAdmissionDataset: "hidden_v3_required",
    sources: sourceFingerprints,
    assetSummaries: [
      {
        assetGroup: "hard_boundary",
        label: "必须守住的底线",
        count: 24,
        initialStatus: "catalog_ready_runtime_inputs_pending",
        question: "它是否真属于严重风险、能否稳定判断、会不会误伤正常表达？"
      },
      {
        assetGroup: "development",
        label: "开发问题集",
        count: 28,
        initialStatus: "catalog_ready_replay_payloads_pending",
        question: "它是否来自真实问题、材料能否重放、反事实是否只改变一个变量？"
      },
      {
        assetGroup: "hidden_v2",
        label: "隐藏 v2 审题材料",
        count: 12,
        initialStatus: "product_review_and_development_regression_material",
        question: "故事是否自然、考点是否清楚、判尺是否适合开放式多轮反思？"
      },
      {
        assetGroup: "preview_4_plus_2",
        label: "4＋2 真人 Preview 蓝图",
        count: 6,
        initialStatus: "blueprint_ready_concrete_pack_pending",
        question: "场景是否完整、是否符合【陪我聊】、能否形成端到端体验验收？"
      }
    ],
    reviewQuestions: [
      "scopeFit",
      "representative",
      "contextSufficient",
      "constructClear",
      "multipleValidPaths",
      "expectedBehaviorValid",
      "blockerLevelValid",
      "evidenceLayerValid",
      "finalDisposition"
    ],
    dispositions: [
      "keep_current_role",
      "revise_then_keep",
      "development_exploration",
      "upgrade_to_complete_trajectory",
      "retire_and_replace",
      "await_product_rule"
    ],
    items
  };
  const reviewPacketFingerprint = sha256(canonicalJson(packetCore));
  const packet = {
    ...packetCore,
    generatedAt,
    reviewPacketFingerprint
  };
  const decisionTemplate = {
    schemaVersion: "1.0",
    packageVersion: PACKAGE_VERSION,
    reviewPacketFingerprint,
    status: "draft",
    reviewerRole: "product_owner",
    answers: {},
    revisions: {}
  };
  const initialSummary = {
    schemaVersion: "1.0",
    packageVersion: PACKAGE_VERSION,
    reviewPacketFingerprint,
    status: "waiting_product_owner_review",
    factualSummary: summary,
    reviewedCount: 0,
    decisionCounts: {},
    completionGate: "70_of_70_items_adjudicated",
    conclusionBoundary: packetCore.unsupportedDecisions
  };
  const embedded = JSON.stringify(packet).replaceAll("<", "\\u003c");
  if (!template.includes("__GI088_REVIEW_PACKET__")) {
    throw new Error("GI088_ASSET_REVIEW_TEMPLATE_PLACEHOLDER_MISSING");
  }
  const html = template.replace("__GI088_REVIEW_PACKET__", embedded);

  await mkdir(paths.privateRoot, { recursive: true });
  await Promise.all([
    writeFile(paths.privatePacket, JSON.stringify(packet, null, 2) + "\n"),
    writeFile(paths.privateDecisions, JSON.stringify(decisionTemplate, null, 2) + "\n"),
    writeFile(paths.privateSummary, JSON.stringify(initialSummary, null, 2) + "\n"),
    writeFile(paths.privateHtml, html)
  ]);

  const publicReceipt = {
    schemaVersion: "1.0",
    receiptVersion: PACKAGE_VERSION,
    generatedAt,
    status: "review_pack_ready_waiting_product_owner",
    purpose: packetCore.purpose,
    reviewItemCount: summary.total,
    assetCounts: summary.byGroup,
    evidenceLayerCounts: summary.byLayer,
    explicitModeCounts: summary.byMode,
    factualCompleteness: {
      concreteRuntimeInputs: summary.concreteRuntimeInputs,
      sourceRecorded: summary.sourceRecorded,
      privacyRecorded: summary.privacyRecorded,
      lineageRecorded: summary.lineageRecorded
    },
    sourceFingerprints,
    reviewPacketFingerprint,
    privateHtmlFingerprint: sha256(html),
    publicContentBoundary: {
      hiddenTitles: 0,
      hiddenStories: 0,
      hiddenInputs: 0,
      hiddenScoringAnchors: 0,
      productOwnerDecisions: 0,
      codexOpinions: 0
    },
    hiddenV2Role: packetCore.hiddenV2Role,
    futureIndependentAdmissionDataset: packetCore.futureIndependentAdmissionDataset,
    executionBoundary: {
      businessModelCalls: 0,
      judgeModelCalls: 0,
      databaseChanges: 0,
      previewChanges: 0,
      productionChanges: 0
    },
    conclusionBoundary: {
      supported: packetCore.supportedDecision,
      unsupported: packetCore.unsupportedDecisions
    }
  };
  await writeFile(paths.publicReceipt, JSON.stringify(publicReceipt, null, 2) + "\n");

  return {
    paths,
    summary,
    reviewPacketFingerprint,
    publicReceipt
  };
}

if (process.env.VITEST !== "true") {
  buildEvaluationAssetReview()
    .then((result) => {
      process.stdout.write(
        JSON.stringify(
          {
            status: "GI088_EVALUATION_ASSET_REVIEW_PACK_READY",
            privateHtml: result.paths.privateHtml,
            publicReceipt: result.paths.publicReceipt,
            reviewItemCount: result.summary.total,
            assetCounts: result.summary.byGroup,
            reviewPacketFingerprint: result.reviewPacketFingerprint
          },
          null,
          2
        ) + "\n"
      );
    })
    .catch((error) => {
      process.stderr.write(
        (error instanceof Error ? error.stack ?? error.message : String(error)) + "\n"
      );
      process.exitCode = 1;
    });
}
