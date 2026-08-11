export type Gi088IssueAction =
  | "read_latest_state"
  | "return_to_current_task"
  | "reconfirm_submission"
  | "generate_again"
  | "seal_and_export"
  | "none";

export type Gi088ErrorCatalogEntry = {
  message: string;
  dataSaved: "yes" | "partial" | "no" | "unknown";
  impact: "request" | "turn" | "task" | "run" | "environment";
  action: Gi088IssueAction;
  retryable: boolean;
  status: number;
};

const input = (message: string): Gi088ErrorCatalogEntry => ({
  message,
  dataSaved: "no",
  impact: "request",
  action: "reconfirm_submission",
  retryable: false,
  status: 400
});

const conflict = (
  message: string,
  action: Gi088IssueAction = "read_latest_state"
): Gi088ErrorCatalogEntry => ({
  message,
  dataSaved: "yes",
  impact: "request",
  action,
  retryable: false,
  status: 409
});

const unavailable = (message: string): Gi088ErrorCatalogEntry => ({
  message,
  dataSaved: "yes",
  impact: "environment",
  action: "read_latest_state",
  retryable: true,
  status: 503
});

export const GI088_ERROR_CATALOG = {
  GI088_RUN_ID_REQUIRED: input("缺少评测运行编号，请从运行列表重新进入。"),
  GI088_RUN_NOT_FOUND: { ...conflict("找不到这次评测运行。", "return_to_current_task"), status: 404 },
  GI088_RUN_INPUT_INVALID: input("创建评测运行的信息不完整。"),
  GI088_RUN_ALREADY_ACTIVE: conflict("当前候选已有进行中的评测，已返回该运行。", "return_to_current_task"),
  GI088_RUN_READ_ONLY: conflict("这次历史评测保持只读，可继续查看和导出。", "seal_and_export"),
  GI088_STORED_FINGERPRINT_MISMATCH: conflict("评测运行属于另一套执行指纹，已切换为历史只读。", "seal_and_export"),
  GI088_OPERATION_PAYLOAD_CONFLICT: conflict("同一操作编号对应了不同内容，请重新确认提交。", "reconfirm_submission"),
  GI088_OPERATION_IN_PROGRESS: conflict("该操作正在处理中，请读取最新状态。"),
  GI088_TURN_OUT_OF_DATE: conflict("对话已更新，请读取最新回答后重新确认这段内容。", "reconfirm_submission"),
  GI088_REVIEW_SNAPSHOT_OUT_OF_DATE: conflict("对话或复核证据已更新，请重新阅读后提交评价。", "reconfirm_submission"),
  GI088_REVIEW_DURING_PROCESSING: conflict("当前回答仍在生成，完成后再提交问题复核。"),
  GI088_RESULT_PERSISTENCE_UNKNOWN: {
    message: "模型结果的落库状态暂时无法确认。系统会保留调用账本并停止自动重调，请读取最新状态。",
    dataSaved: "unknown",
    impact: "turn",
    action: "read_latest_state",
    retryable: true,
    status: 503
  },
  GI088_CALL_DISPATCH_UNAVAILABLE: conflict("该调用已被其他请求接管或已结束。"),
  GI088_CALL_FINALIZATION_FAILED: { ...unavailable("已保存模型结果，确定性收口暂时失败；读取最新状态可继续对账。"), dataSaved: "yes", impact: "turn" },
  GI088_PROVIDER_PREFLIGHT_FAILED: unavailable("模型运行配置未通过调用前检查，本次模型调用数为零。"),
  GI088_PROVIDER_RESULT_INVALID: conflict("模型结果未通过合同保护，原始诊断已安全保留。", "generate_again"),
  GI088_ABORT_INPUT_INVALID: input("终止当前任务需要填写原因并确认。"),
  GI088_ABORT_UNAVAILABLE: conflict("当前仍有活动调用，请等待收口后再终止任务。"),
  GI088_INTERVENTION_REVIEW_INPUT_INVALID: input("程序介入复核信息不完整。"),
  GI088_INTERVENTION_NOT_FOUND: { ...conflict("找不到该程序介入记录。"), status: 404 },
  GI088_OPERATION_EVENT_INPUT_INVALID: input("操作事件格式无效。"),
  GI088_EXPORT_INPUT_INVALID: input("导出需要指定评测运行。"),
  GI088_EXPORT_VERIFICATION_FAILED: conflict("导出收据校验失败，已停止下载。"),
  GI088_EXPORT_FAILED: unavailable("评测证据导出暂时失败，请稍后再次下载。"),
  GI088_START_INPUT_INVALID: input("开始任务的信息不完整。"),
  GI088_TURN_INPUT_INVALID: input("提交内容的信息不完整。"),
  GI088_RETRY_INPUT_INVALID: input("再次生成的信息不完整。"),
  GI088_QUESTION_REVIEW_INPUT_INVALID: input("问题复核信息不完整。"),
  GI088_END_INPUT_INVALID: input("轨迹评价信息不完整。"),
  GI088_COMPARE_INPUT_INVALID: input("分支比较信息不完整。"),
  GI088_EARLY_STOP_INPUT_INVALID: input("提前结束需要填写原因并确认。"),
  GI088_SEAL_INPUT_INVALID: input("封存操作需要再次确认。"),
  GI088_SMOKE_INPUT_INVALID: input("技术检查参数无效。"),
  GI088_COMPATIBILITY_SMOKE_INPUT_INVALID: input("兼容冒烟登记信息不完整。"),
  GI088_COMPATIBILITY_SMOKE_EVIDENCE_INVALID: conflict(
    "未找到可核验的【帮我记】零追问记录，请回到真实入口完成本项后再登记。",
    "return_to_current_task"
  ),
  GI088_COMPATIBILITY_SMOKE_REQUIRES_EXTERNAL_RESULT: conflict(
    "该任务需要先完成真实【帮我记】链路，再登记零模型兼容结果。",
    "return_to_current_task"
  ),
  GI088_COMPATIBILITY_SMOKE_UNAVAILABLE: conflict(
    "当前任务无法登记兼容冒烟结果，请读取最新状态。",
    "return_to_current_task"
  ),
  GI088_TASK_NOT_FOUND: { ...conflict("找不到该评测任务。", "return_to_current_task"), status: 404 },
  GI088_TASK_STATE_NOT_FOUND: { ...conflict("评测任务状态缺失。", "return_to_current_task"), status: 404 },
  GI088_TASK_ORDER_INVALID: conflict("请按评测任务顺序继续。", "return_to_current_task"),
  GI088_ACTIVE_TASK_INCOMPLETE: conflict("当前任务仍需收口。", "return_to_current_task"),
  GI088_TASK_NOT_ACTIVE: conflict("该任务当前未激活。", "return_to_current_task"),
  GI088_BRANCH_NOT_ACTIVE: conflict("该对话分支当前未激活。", "return_to_current_task"),
  GI088_TRAJECTORY_NOT_READY: conflict("当前轨迹仍有待收口操作，请读取最新状态。"),
  GI088_RESERVED_TURN_NOT_FOUND: conflict("待处理轮次已经变化，请读取最新状态。"),
  GI088_RESERVED_CALL_NOT_FOUND: conflict("待处理调用已经变化，请读取最新状态。"),
  GI088_CLIENT_TURN_ID_INVALID: input("提交编号无效。"),
  GI088_INITIAL_USER_MESSAGE_INVALID: input("首段内容需要为 1 至 8000 字。"),
  GI088_USER_MESSAGE_INVALID: input("内容需要为 1 至 8000 字。"),
  GI088_IDEMPOTENCY_PAYLOAD_MISMATCH: conflict("同一提交编号对应了不同内容，请重新确认。", "reconfirm_submission"),
  GI088_OFF_BRANCH_ALREADY_STARTED: conflict("关闭 Thinking 的分支已经开始。"),
  GI088_HIGH_BRANCH_ALREADY_STARTED: conflict("Thinking high 分支已经开始。"),
  GI088_HIGH_ONLY_EVALUATION: conflict("当前评测只开放 Thinking high 分支。"),
  GI088_OFF_BRANCH_REVIEW_REQUIRED: conflict("请先完成前一分支评价。", "return_to_current_task"),
  GI088_FROZEN_START_MISSING: conflict("冻结的首段内容缺失，请返回当前任务。", "return_to_current_task"),
  GI088_CONCURRENT_UPDATE: { ...conflict("另一标签页已经更新，请读取最新状态。"), retryable: true },
  GI088_BATCH_LOST: unavailable("评测运行暂时无法读取。"),
  GI088_BATCH_ALREADY_SEALED: conflict("该评测已经封存，可继续查看和导出。", "seal_and_export"),
  GI088_BATCH_ALREADY_EARLY_STOPPED: conflict("该评测已经提前结束，可继续查看和导出。", "seal_and_export"),
  GI088_BATCH_TERMINAL_STATE_MISMATCH: unavailable("评测终态记录需要对账，请暂停写入并读取最新状态。"),
  GI088_BATCH_INCOMPLETE: conflict("仍有任务需要完成或安全终止。", "return_to_current_task"),
  GI088_BATCH_MUST_BE_TERMINAL: conflict("评测封存或提前结束后才能生成不可变导出。", "return_to_current_task"),
  GI088_BATCH_EARLY_STOP_SCOPE_MISMATCH: unavailable("提前结束范围需要对账。"),
  GI088_EARLY_STOP_REASON_INVALID: input("提前结束原因需要为 1 至 2000 字。"),
  GI088_EARLY_STOP_REASON_CODE_INVALID: input("提前结束原因类型无效。"),
  GI088_EARLY_STOP_TASK_BOUNDARY_REQUIRED: conflict("请先收口当前任务，再提前结束整批评测。", "return_to_current_task"),
  GI088_QUESTION_REVIEW_CLASSIFICATION_INVALID: input("问题焦点或问题价值分类无效。"),
  GI088_QUESTION_REVIEW_NOTE_INVALID: input("问题复核说明最多 1000 字。"),
  GI088_QUESTION_REVIEW_UNAVAILABLE: conflict("当前回答无需或暂不能提交问题复核。"),
  GI088_QUESTION_REVIEWS_REQUIRED: conflict("请完成所有可见回答的问题复核。", "return_to_current_task"),
  GI088_REVIEW_REASON_INVALID: input("评价理由需要为 1 至 2000 字。"),
  GI088_TARGET_TRIGGER_INVALID: input("目标触发结论无效。"),
  GI088_TARGET_TRIGGER_TECHNICAL_EVIDENCE_REQUIRED: conflict("缺少可支持技术阻断结论的调用事实。"),
  GI088_TRAJECTORY_CANNOT_END: conflict("当前轨迹仍需完成生成或复核。", "return_to_current_task"),
  GI088_COMPARISON_REASON_INVALID: input("比较理由需要为 1 至 2000 字。"),
  GI088_COMPARISON_ALREADY_RECORDED: conflict("该分支比较已经保存。"),
  GI088_COMPARISON_NOT_REQUIRED: conflict("当前单分支评测无需比较。"),
  GI088_BOTH_TRAJECTORY_REVIEWS_REQUIRED: conflict("请先完成两个分支的轨迹评价。", "return_to_current_task"),
  GI088_TECHNICAL_RETRY_UNAVAILABLE: conflict("当前轮次暂不支持再次生成。"),
  GI088_TECHNICAL_RETRY_LIMIT_REACHED: conflict("当前提交已用完冻结的生成额度。", "seal_and_export"),
  GI088_EMPTY_CONTENT_AUTO_RECOVERY_UNAVAILABLE: conflict("空内容自动恢复已结束。", "generate_again"),
  GI088_TIMEOUT_AUTO_RECOVERY_UNAVAILABLE: conflict("超时自动恢复已结束。", "generate_again"),
  GI088_STAGE_TRANSITION_AUTO_RECOVERY_UNAVAILABLE: conflict("阶段转场自动恢复已结束。", "generate_again"),
  GI088_MANUAL_AFTER_AUTO_RECOVERY_UNAVAILABLE: conflict("当前无需或无法人工再次生成。"),
  GI088_EMPTY_CONTENT_REQUIRES_AUTO_RECOVERY: conflict("服务端正在处理空内容恢复，请读取最新状态。"),
  GI088_TIMEOUT_REQUIRES_AUTO_RECOVERY: conflict("服务端正在处理超时恢复，请读取最新状态。"),
  GI088_SINGLE_QUESTION_REQUIRES_AUTO_RECOVERY: conflict("服务端正在处理单一提问保护，请读取最新状态。"),
  GI088_STAGE_TRANSITION_REQUIRES_AUTO_RECOVERY: conflict("服务端正在处理阶段转场恢复，请读取最新状态。"),
  GI088_MODEL_CALL_AUTHORIZATION_REQUIRED: unavailable("当前环境未授权真人评测模型调用。"),
  GI088_EVALUATION_NOT_AVAILABLE: unavailable("私有评测服务当前不可用。"),
  GI088_EVALUATOR_FORBIDDEN: { ...conflict("当前账号无权访问私有评测。"), status: 403 },
  GI088_INTERNAL_ERROR: unavailable("评测服务遇到内部错误，已保留可恢复状态。")
} satisfies Record<string, Gi088ErrorCatalogEntry>;

export type Gi088ErrorCode = keyof typeof GI088_ERROR_CATALOG;

export const GI088_COMPLETE_ERROR_CATALOG =
  GI088_ERROR_CATALOG satisfies Record<
    Gi088ErrorCode,
    Gi088ErrorCatalogEntry
  >;

export type Gi088EvaluationIssue = Gi088ErrorCatalogEntry & {
  code: Gi088ErrorCode;
};

export function createGi088EvaluationIssue(
  code: Gi088ErrorCode
): Gi088EvaluationIssue {
  return { code, ...GI088_ERROR_CATALOG[code] };
}

export class Gi088EvaluationError extends Error {
  readonly issue: Gi088EvaluationIssue;

  constructor(
    readonly code: Gi088ErrorCode,
    status?: number,
    retryable?: boolean
  ) {
    const base = createGi088EvaluationIssue(code);
    const issue = {
      ...base,
      ...(status === undefined ? {} : { status }),
      ...(retryable === undefined ? {} : { retryable })
    };
    super(issue.message);
    this.name = "Gi088EvaluationError";
    this.issue = issue;
  }

  get status() {
    return this.issue.status;
  }

  get retryable() {
    return this.issue.retryable;
  }
}
