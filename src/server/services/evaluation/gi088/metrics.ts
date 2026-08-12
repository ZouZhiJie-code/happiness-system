export const GI088_EVALUATION_METRICS_VERSION_V1 =
  "2026-08-10.gi088-evaluation-metrics-v1" as const;
export const GI088_EVALUATION_METRICS_VERSION_V2 =
  "2026-08-12.gi088-evaluation-metrics-v2" as const;
export const GI088_EVALUATION_METRICS_VERSION =
  "2026-08-12.gi088-evaluation-metrics-v3" as const;

export type Gi088MetricsCallInput = {
  id?: string;
  callId?: string;
  turnId?: string;
  attempt?: number;
  kind?: string;
  status?: string;
  providerResultStatus?: string | null;
  parentCallId?: string | null;
  reservedAt?: string | Date | null;
  dispatchedAt?: string | null;
  startedAt?: string | null;
  providerCompletedAt?: string | Date | null;
  finalizedAt?: string | Date | null;
  completedAt?: string | Date | null;
  executionDeadlineAt?: string | Date | null;
  automaticDeadlineAt?: string | Date | null;
  responseHash?: string | null;
  errorCode?: string | null;
  contractValid?: boolean | null;
  assistantCommitted?: boolean | null;
  raceWinner?: boolean | null;
  technicalFailure?: boolean;
  protectedFailure?: boolean;
  failedOutputDiagnostic?: unknown;
  retryTrigger?: string | null;
  retryOrdinal?: number | null;
  latencyMs?: number | null;
  effectiveConfig?: {
    emptyContentAutomaticRetries?: number;
    emptyContentMaximumProviderCalls?: number;
    emptyContentPolicyOverride?: boolean;
    recoveryRole?: string;
  } | null;
};

export type Gi088MetricsQuestionReviewInput = {
  questionPresence?: "present" | "absent" | "uncertain";
  classification?: string;
};

export type Gi088MetricsQuestionObservationInput = {
  visible?: boolean;
  questionPresence?: "present" | "absent" | "uncertain";
  classification?: string;
  review?: Gi088MetricsQuestionReviewInput | null;
};

export type Gi088MetricsTurnInput = {
  id: string;
  clientTurnId?: string | null;
  userMessageId?: string | null;
  userSubmissionHash?: string | null;
  contentHash?: string | null;
  rawText?: string | null;
  userText?: string | null;
  status?: string;
  visibleText?: string | null;
  assistantMessageId?: string | null;
  assistantCommitted?: boolean | null;
  zeroCallControl?: boolean;
  stateMaintenance?: {
    explicitStop?: "none" | "pure" | "mixed";
    providerCallBypassed?: boolean;
  } | null;
  calls?: Gi088MetricsCallInput[];
  recovery?: {
    status?: string;
    trigger?: string | null;
    automaticRetryCount?: number;
    automaticDeadlineAt?: string | Date | null;
    completedAt?: string | Date | null;
  } | null;
  questionObservation?: Gi088MetricsQuestionObservationInput | null;
};

export type Gi088MetricsTrajectoryInput = {
  id?: string;
  branch?: string;
  status?: string;
  messages?: Array<{
    id?: string;
    role?: string;
    content?: string;
  }>;
  turns?: Gi088MetricsTurnInput[];
  review?: {
    quality?: string;
    targetTrigger?: string;
  } | null;
};

export type Gi088MetricsTaskInput = {
  taskId?: string;
  id?: string;
  status?: string;
  trajectories?: Gi088MetricsTrajectoryInput[];
  branches?: Record<string, Gi088MetricsTrajectoryInput>;
};

export type Gi088MetricsProgramInterventionInput = {
  id?: string;
  reviewOutcome?: "correct" | "false_positive" | "uncertain" | null;
  review?: {
    classification?: "correct" | "false_positive" | "uncertain";
  } | null;
};

export type Gi088EvaluationMetricsInput = {
  tasks: Gi088MetricsTaskInput[];
  callLedger?: Gi088MetricsCallInput[];
  programInterventions?: Gi088MetricsProgramInterventionInput[];
  metricsVersion?:
    | typeof GI088_EVALUATION_METRICS_VERSION
    | typeof GI088_EVALUATION_METRICS_VERSION_V2
    | typeof GI088_EVALUATION_METRICS_VERSION_V1;
};

export type Gi088EvaluationMetrics = {
  version:
    | typeof GI088_EVALUATION_METRICS_VERSION
    | typeof GI088_EVALUATION_METRICS_VERSION_V2
    | typeof GI088_EVALUATION_METRICS_VERSION_V1;
  eligibleModelSubmissionCount: number;
  firstVisibleSuccessCount: number;
  firstVisibleSuccessRate: number | null;
  zeroCallControlCount: number;
  rawTechnicalEventCount: number;
  rawProtectedEventCount: number;
  autoRecoverySuccessCount: number;
  finalFailureCount: number;
  manualThirdGenerationCount: number;
  consecutiveRecoveryCount: number;
  duplicateMessageCount: number;
  programInterventionCount: number;
  programInterventionFalsePositiveCount: number;
  programInterventionReviewCoverage: number | null;
  visibleQuestionCount: number;
  visibleQuestionReviewedCount: number;
  visibleQuestionReviewCoverage: number | null;
  multipleIndependentTasksCount: number;
  emptyContentInitialCount: number;
  emptyContentRecoveryTriggerCount: number;
  emptyContentRecoveryAttemptCount: number;
  emptyContentRecoverySuccessCount: number;
  successAtAttempt1: number;
  successAtAttempt2: number;
  finalEmptyContentCount: number;
  recoveryBudgetExhaustedCount: number;
  recoveredEmptyContentCount: number;
  visibleLatencyP50Ms: number | null;
  visibleLatencyP90Ms: number | null;
  visibleLatencyMaxMs: number | null;
  finalVisibleCompletionCount: number;
  finalVisibleCompletionRate: number | null;
  pendingOrProcessingCount: number;
  manualRecoveryCount: number;
  fastHedgeCallCount: number;
  totalRecoveryCalls: number;
  gateFacts: {
    completedTaskCount: number;
    abortedTaskCount: number;
    notRunTaskCount: number;
    targetTriggeredTrajectoryCount: number;
    targetNotTriggeredCount: number;
    targetBlockedByTechnicalFailureCount: number;
    directUseCount: number;
    minorIssueCount: number;
    qualityFailureCount: number;
    singleCaseBlockerCount: number;
    protectedFailureCount: number;
    finalTechnicalFailureCount: number;
    emptyContentEventCount: number;
    emptyContentInitialCount: number;
    emptyContentRecoveryAttemptCount: number;
    emptyContentRecoverySuccessCount: number;
    finalEmptyContentCount: number;
    recoveryBudgetExhaustedCount: number;
    recoveredEmptyContentCount: number;
    automaticRecoveryAttemptCount: number;
    automaticRecoveryWithinDeadlineSuccessCount: number;
    automaticRecoveryLateOrUnknownCount: number;
    finalVisibleCompletionCount: number;
    pendingOrProcessingCount: number;
    manualRecoveryCount: number;
    fastHedgeCallCount: number;
    programInterventionUncertainCount: number;
    visibleQuestionUncertainCount: number;
    targetLegacyUnknownCount: number;
    unreviewedTrajectoryCount: number;
    unreviewedProgramInterventionCount: number;
    unreviewedVisibleQuestionCount: number;
    allProgramInterventionsReviewed: boolean;
    allVisibleQuestionsReviewed: boolean;
  };
};

type NormalizedTurn = {
  task: Gi088MetricsTaskInput;
  trajectory: Gi088MetricsTrajectoryInput;
  turn: Gi088MetricsTurnInput;
  calls: Gi088MetricsCallInput[];
};

function trajectoriesForTask(task: Gi088MetricsTaskInput) {
  if (task.trajectories) return task.trajectories;
  return Object.values(task.branches ?? {});
}

function trajectoryHasEvaluationEvidence(
  trajectory: Gi088MetricsTrajectoryInput
) {
  return trajectory.review !== null && trajectory.review !== undefined ||
    (trajectory.turns?.length ?? 0) > 0 ||
    (trajectory.messages?.length ?? 0) > 0 ||
    trajectory.status !== undefined && trajectory.status !== "not_started";
}

function callIdentifier(call: Gi088MetricsCallInput) {
  return call.callId ?? call.id ?? null;
}

function mergedCallsForTurn(
  turn: Gi088MetricsTurnInput,
  ledgerByTurn: Map<string, Gi088MetricsCallInput[]>
) {
  const merged = new Map<string, Gi088MetricsCallInput>();
  for (const call of turn.calls ?? []) {
    const id = callIdentifier(call) ?? `nested:${merged.size}`;
    merged.set(id, call);
  }
  for (const ledgerCall of ledgerByTurn.get(turn.id) ?? []) {
    const id = callIdentifier(ledgerCall) ?? `ledger:${merged.size}`;
    merged.set(id, {
      ...(merged.get(id) ?? {}),
      ...ledgerCall
    });
  }
  return [...merged.values()].sort(
    (left, right) => (left.attempt ?? 0) - (right.attempt ?? 0)
  );
}

function normalizeTurns(input: Gi088EvaluationMetricsInput) {
  const ledgerByTurn = new Map<string, Gi088MetricsCallInput[]>();
  for (const call of input.callLedger ?? []) {
    if (!call.turnId) continue;
    const entries = ledgerByTurn.get(call.turnId) ?? [];
    entries.push(call);
    ledgerByTurn.set(call.turnId, entries);
  }
  return input.tasks.flatMap((task) =>
    trajectoriesForTask(task).flatMap((trajectory) =>
      (trajectory.turns ?? []).map((turn): NormalizedTurn => ({
        task,
        trajectory,
        turn,
        calls: mergedCallsForTurn(turn, ledgerByTurn)
      }))
    )
  );
}

function isZeroCallControl(turn: Gi088MetricsTurnInput) {
  return turn.zeroCallControl === true ||
    (turn.stateMaintenance?.explicitStop === "pure" &&
      turn.stateMaintenance.providerCallBypassed === true);
}

function callWasDispatched(call: Gi088MetricsCallInput) {
  if (call.dispatchedAt || call.startedAt) return true;
  return call.status !== undefined && call.status !== "reserved";
}

function callReachedVisibleSuccess(call: Gi088MetricsCallInput) {
  if (call.assistantCommitted === true || call.raceWinner === true) {
    return true;
  }
  if (call.assistantCommitted === false || call.raceWinner === false) {
    return false;
  }
  return (call.status === "valid" || call.status === "finalized") &&
    call.providerResultStatus !== "provider_failed" &&
    call.contractValid !== false;
}

function turnCommittedAssistant(turn: Gi088MetricsTurnInput) {
  if (turn.assistantCommitted !== undefined && turn.assistantCommitted !== null) {
    return turn.assistantCommitted;
  }
  if (turn.assistantMessageId) return true;
  return turn.status === "valid" ||
    turn.status === "completed" ||
    turn.status === "complete_after_auto_recovery" ||
    turn.status === "complete_after_manual_recovery";
}

function isAutomaticRecoveryCall(call: Gi088MetricsCallInput) {
  return call.kind === "automatic_retry" ||
    call.kind === "automatic_recovery" ||
    call.kind === "fast_hedge";
}

function initialDispatchedCall(calls: Gi088MetricsCallInput[]) {
  return calls.find((call) =>
    (call.attempt === 1 || call.attempt === undefined) &&
    !isAutomaticRecoveryCall(call) &&
    call.kind !== "manual_retry" &&
    call.kind !== "manual_after_auto_recovery" &&
    !call.parentCallId &&
    callWasDispatched(call)
  ) ?? null;
}

function hasAutomaticRecovery(turn: NormalizedTurn) {
  return (turn.turn.recovery?.automaticRetryCount ?? 0) > 0 ||
    turn.calls.some(isAutomaticRecoveryCall);
}

function automaticRecoverySucceeded(turn: NormalizedTurn) {
  if (turn.turn.status === "complete_after_auto_recovery") return true;
  const winner = turn.calls.find(callReachedVisibleSuccess);
  return Boolean(winner && isAutomaticRecoveryCall(winner)) &&
    turnCommittedAssistant(turn.turn);
}

function isRawTechnicalEvent(call: Gi088MetricsCallInput) {
  return call.technicalFailure === true ||
    call.providerResultStatus === "provider_failed" ||
    call.status === "technical_failure" ||
    call.status === "provider_failed" ||
    call.status === "interrupted_unknown_dispatch";
}

function isRawProtectedEvent(call: Gi088MetricsCallInput) {
  return call.protectedFailure === true ||
    call.failedOutputDiagnostic !== undefined &&
      call.failedOutputDiagnostic !== null ||
    call.status === "protected_failure";
}

function isFinalFailure(turn: NormalizedTurn) {
  if (turnCommittedAssistant(turn.turn)) return false;
  if (
    turn.turn.status === "processing" ||
    turn.turn.status === "pending" ||
    turn.turn.status === "reserved"
  ) {
    return false;
  }
  if (
    turn.turn.status === "technical_failure" ||
    turn.turn.status === "protected_failure" ||
    turn.turn.status === "finalization_failed"
  ) {
    return true;
  }
  const finalCall = turn.calls.filter(callWasDispatched).at(-1);
  return finalCall?.status === "provider_failed" ||
    finalCall?.providerResultStatus === "provider_failed" ||
    finalCall?.status === "interrupted_unknown_dispatch" ||
    finalCall?.status === "finalization_failed" ||
    finalCall?.status === "protected_failure";
}

function isFinalTechnicalFailure(turn: NormalizedTurn) {
  if (turn.turn.status === "protected_failure") return false;
  if (
    turn.turn.status === "technical_failure" ||
    turn.turn.status === "finalization_failed"
  ) {
    return true;
  }
  const finalCall = turn.calls.filter(callWasDispatched).at(-1);
  return finalCall?.status === "provider_failed" ||
    finalCall?.providerResultStatus === "provider_failed" ||
    finalCall?.status === "interrupted_unknown_dispatch" ||
    finalCall?.status === "finalization_failed";
}

function hasManualThirdGeneration(turn: NormalizedTurn) {
  return turn.calls.some((call) =>
    (call.kind === "manual_retry" ||
      call.kind === "manual_after_auto_recovery") &&
      (call.attempt ?? 0) >= 3
  );
}

function visibleQuestionObservation(turn: NormalizedTurn) {
  const observation = turn.turn.questionObservation;
  if (!observation || observation.visible === false) return null;
  return turnCommittedAssistant(turn.turn) ? observation : null;
}

function questionReviewPresence(
  observation: Gi088MetricsQuestionObservationInput
) {
  return observation.questionPresence ??
    observation.review?.questionPresence ??
    (observation.classification || observation.review?.classification
      ? "present"
      : null);
}

function questionReviewClassification(
  observation: Gi088MetricsQuestionObservationInput
) {
  return observation.classification ??
    observation.review?.classification ??
    null;
}

function interventionReviewOutcome(
  intervention: Gi088MetricsProgramInterventionInput
) {
  return intervention.reviewOutcome ?? intervention.review?.classification ?? null;
}

function duplicateMessageCount(turns: NormalizedTurn[]) {
  let duplicates = 0;
  const trajectories = new Set(turns.map(({ trajectory }) => trajectory));
  for (const trajectory of trajectories) {
    const messageContent = new Map(
      (trajectory.messages ?? [])
        .filter((message) => message.id && message.role === "user")
        .map((message) => [message.id!, message.content ?? ""])
    );
    const messageIdsBySubmission = new Map<string, Set<string>>();
    for (const { turn } of turns.filter(
      (entry) => entry.trajectory === trajectory
    )) {
      const identifier = turn.userSubmissionHash
        ? `hash:${turn.userSubmissionHash}`
        : turn.contentHash
          ? `hash:${turn.contentHash}`
          : turn.rawText !== undefined && turn.rawText !== null
            ? `text:${turn.rawText}`
            : turn.userText !== undefined && turn.userText !== null
              ? `text:${turn.userText}`
              : turn.userMessageId && messageContent.has(turn.userMessageId)
                ? `text:${messageContent.get(turn.userMessageId)}`
        : turn.clientTurnId
          ? `client:${turn.clientTurnId}`
          : null;
      if (!identifier) continue;
      const messageIds = messageIdsBySubmission.get(identifier) ?? new Set();
      messageIds.add(turn.userMessageId ?? turn.id);
      messageIdsBySubmission.set(identifier, messageIds);
    }
    duplicates += [...messageIdsBySubmission.values()].reduce(
      (total, messageIds) => total + Math.max(0, messageIds.size - 1),
      0
    );
  }
  return duplicates;
}

function timestamp(value: string | Date | null | undefined) {
  if (!value) return null;
  const parsed = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function automaticRecoveryCalls(turn: NormalizedTurn) {
  return turn.calls.filter(isAutomaticRecoveryCall);
}

function isEmptyContentCall(call: Gi088MetricsCallInput) {
  return call.errorCode === "EMPTY_CONTENT";
}

function initialEmptyContentCall(turn: NormalizedTurn) {
  return turn.calls.find((call) =>
    isEmptyContentCall(call) &&
    !isAutomaticRecoveryCall(call) &&
    call.kind !== "manual_retry" &&
    (call.attempt ?? 1) === 1
  ) ?? null;
}

function emptyContentRecoveryCalls(turn: NormalizedTurn) {
  return turn.calls
    .filter((call) =>
      isAutomaticRecoveryCall(call) &&
      (call.retryTrigger === "EMPTY_CONTENT" ||
        call.errorCode === "EMPTY_CONTENT" ||
        (initialEmptyContentCall(turn) !== null &&
          !call.retryTrigger &&
          !call.errorCode))
    )
    .sort((left, right) =>
      (left.retryOrdinal ?? left.attempt ?? 0) -
      (right.retryOrdinal ?? right.attempt ?? 0)
    );
}

function emptyContentRecoveredAt(turn: NormalizedTurn) {
  const initial = initialEmptyContentCall(turn);
  if (!initial || !turnCommittedAssistant(turn.turn)) return null;
  const successfulRecovery = emptyContentRecoveryCalls(turn).find(
    callReachedVisibleSuccess
  );
  if (!successfulRecovery) return null;
  return successfulRecovery.retryOrdinal ??
    Math.max(1, (successfulRecovery.attempt ?? 2) - 1);
}

function latencyForVisibleTurn(turn: NormalizedTurn) {
  if (!turnCommittedAssistant(turn.turn)) return null;
  const first = initialDispatchedCall(turn.calls);
  const completed = turn.calls.find(callReachedVisibleSuccess);
  const startedAt = timestamp(first?.dispatchedAt ?? first?.startedAt);
  const completedAt = timestamp(
    completed?.finalizedAt ??
    completed?.providerCompletedAt ??
    completed?.completedAt
  );
  if (startedAt !== null && completedAt !== null && completedAt >= startedAt) {
    return completedAt - startedAt;
  }
  const measured = turn.calls
    .map((call) => call.latencyMs)
    .filter((value): value is number =>
      typeof value === "number" && Number.isFinite(value) && value >= 0
    );
  return measured.length > 0
    ? measured.reduce((sum, value) => sum + value, 0)
    : null;
}

function percentile(values: number[], percentileValue: number) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(percentileValue * sorted.length) - 1)
  );
  return sorted[index] ?? null;
}

function automaticRecoverySucceededWithinDeadline(turn: NormalizedTurn) {
  if (!automaticRecoverySucceeded(turn)) return false;
  const recoveryCall = automaticRecoveryCalls(turn).at(-1);
  if (!recoveryCall) return false;
  const completedAt = timestamp(
    recoveryCall.finalizedAt ??
    recoveryCall.providerCompletedAt ??
    recoveryCall.completedAt ??
    turn.turn.recovery?.completedAt
  );
  const initialCall = initialDispatchedCall(turn.calls);
  const initialDispatchAt = timestamp(
    initialCall?.dispatchedAt ?? initialCall?.startedAt
  );
  const explicitDeadline = timestamp(
    recoveryCall.automaticDeadlineAt ??
    turn.turn.recovery?.automaticDeadlineAt
  );
  const deadline = explicitDeadline ??
    (initialDispatchAt === null ? null : initialDispatchAt + 90_000);
  return completedAt !== null && deadline !== null && completedAt <= deadline;
}

function consecutiveRecoveryCount(turns: NormalizedTurn[]) {
  let count = 0;
  for (const task of new Set(turns.map(({ task }) => task))) {
    for (const trajectory of trajectoriesForTask(task)) {
      const trajectoryTurns = turns.filter(
        (entry) => entry.task === task && entry.trajectory === trajectory
      );
      for (let index = 1; index < trajectoryTurns.length; index += 1) {
        if (
          hasAutomaticRecovery(trajectoryTurns[index - 1]!) &&
          hasAutomaticRecovery(trajectoryTurns[index]!)
        ) {
          count += 1;
        }
      }
    }
  }
  return count;
}

function ratio(numerator: number, denominator: number) {
  return denominator === 0 ? null : numerator / denominator;
}

export function calculateGi088EvaluationMetrics(
  input: Gi088EvaluationMetricsInput
): Gi088EvaluationMetrics {
  const turns = normalizeTurns(input);
  const eligibleTurns = turns.filter(({ turn }) => !isZeroCallControl(turn));
  const zeroCallControlCount = turns.length - eligibleTurns.length;
  const firstVisibleSuccessCount = eligibleTurns.filter((entry) => {
    const firstCall = initialDispatchedCall(entry.calls);
    return Boolean(
      firstCall &&
      callReachedVisibleSuccess(firstCall) &&
      turnCommittedAssistant(entry.turn)
    );
  }).length;
  const rawTechnicalEventCount = turns.reduce(
    (total, turn) => total + turn.calls.filter(isRawTechnicalEvent).length,
    0
  );
  const rawProtectedEventCount = turns.reduce(
    (total, turn) => total + turn.calls.filter(isRawProtectedEvent).length,
    0
  );
  const autoRecoverySuccessCount = turns.filter(
    automaticRecoverySucceeded
  ).length;
  const finalFailures = turns.filter(isFinalFailure);
  const manualThirdGenerationCount = turns.filter(
    hasManualThirdGeneration
  ).length;
  const questionObservations = turns
    .map(visibleQuestionObservation)
    .filter((value): value is Gi088MetricsQuestionObservationInput =>
      value !== null
    );
  const reviewedQuestions = questionObservations.filter(
    (observation) => questionReviewPresence(observation) !== null
  );
  const multipleIndependentTasksCount = reviewedQuestions.filter(
    (observation) =>
      questionReviewClassification(observation) === "multiple_independent_tasks"
  ).length;
  const visibleQuestionUncertainCount = reviewedQuestions.filter(
    (observation) =>
      questionReviewPresence(observation) === "uncertain" ||
      questionReviewClassification(observation) === "uncertain"
  ).length;

  const interventions = input.programInterventions ?? [];
  const reviewedInterventions = interventions.filter(
    (intervention) => interventionReviewOutcome(intervention) !== null
  );
  const programInterventionFalsePositiveCount = interventions.filter(
    (intervention) =>
      interventionReviewOutcome(intervention) === "false_positive"
  ).length;
  const programInterventionUncertainCount = interventions.filter(
    (intervention) => interventionReviewOutcome(intervention) === "uncertain"
  ).length;

  const trajectories = input.tasks
    .flatMap(trajectoriesForTask)
    .filter(trajectoryHasEvaluationEvidence);
  const reviews = trajectories
    .map((trajectory) => trajectory.review)
    .filter((review): review is NonNullable<Gi088MetricsTrajectoryInput["review"]> =>
      review !== null && review !== undefined
    );
  const automaticRecoveryTurns = turns.filter(hasAutomaticRecovery);
  const automaticRecoveryWithinDeadlineSuccessCount =
    automaticRecoveryTurns.filter(
      automaticRecoverySucceededWithinDeadline
    ).length;
  const taskStatusCount = (status: string) =>
    input.tasks.filter((task) => task.status === status).length;
  const finalTechnicalFailureCount = finalFailures.filter(
    isFinalTechnicalFailure
  ).length;
  const emptyContentEventCount = turns.reduce(
    (total, entry) => total + entry.calls.filter(
      (call) => call.errorCode === "EMPTY_CONTENT"
    ).length,
    0
  );
  const emptyContentTurns = turns.filter((turn) =>
    initialEmptyContentCall(turn) !== null
  );
  const emptyContentRecoveryAttemptCount = emptyContentTurns.reduce(
    (total, turn) => total + emptyContentRecoveryCalls(turn).length,
    0
  );
  const emptyContentRecoverySuccessCount = emptyContentTurns.filter(
    (turn) => emptyContentRecoveredAt(turn) !== null
  ).length;
  const successAtAttempt1 = emptyContentTurns.filter(
    (turn) => emptyContentRecoveredAt(turn) === 1
  ).length;
  const successAtAttempt2 = emptyContentTurns.filter(
    (turn) => emptyContentRecoveredAt(turn) === 2
  ).length;
  const finalEmptyContentTurns = emptyContentTurns.filter(
    (turn) => emptyContentRecoveredAt(turn) === null && isFinalFailure(turn)
  );
  const recoveryBudgetExhaustedCount = emptyContentTurns.filter((turn) =>
    turn.turn.recovery?.trigger === "EMPTY_CONTENT" &&
    (turn.turn.recovery.status === "exhausted" ||
      (finalEmptyContentTurns.includes(turn) &&
        (turn.turn.recovery.automaticRetryCount ?? 0) >=
          (turn.calls[0]?.effectiveConfig?.emptyContentAutomaticRetries ?? 2)))
  ).length;
  const visibleLatencies = eligibleTurns
    .map(latencyForVisibleTurn)
    .filter((value): value is number => value !== null);
  const recoveredEmptyContentCount = emptyContentRecoverySuccessCount;
  const finalVisibleCompletionCount = eligibleTurns.filter((entry) =>
    turnCommittedAssistant(entry.turn)
  ).length;
  const pendingOrProcessingCount = eligibleTurns.filter(({ turn }) =>
    turn.status === "processing" ||
    turn.status === "pending" ||
    turn.status === "reserved"
  ).length;
  const manualRecoveryCount = turns.filter((turn) =>
    turn.calls.some((call) =>
      call.kind === "manual_retry" ||
      call.kind === "manual_after_auto_recovery"
    )
  ).length;
  const fastHedgeCallCount = turns.reduce(
    (total, turn) => total + turn.calls.filter(
      (call) => call.kind === "fast_hedge"
    ).length,
    0
  );
  const totalRecoveryCalls = turns.reduce(
    (total, turn) => total + automaticRecoveryCalls(turn).length,
    0
  );

  const result = {
    version: input.metricsVersion ?? GI088_EVALUATION_METRICS_VERSION,
    eligibleModelSubmissionCount: eligibleTurns.length,
    firstVisibleSuccessCount,
    firstVisibleSuccessRate: ratio(
      firstVisibleSuccessCount,
      eligibleTurns.length
    ),
    zeroCallControlCount,
    rawTechnicalEventCount,
    rawProtectedEventCount,
    autoRecoverySuccessCount,
    finalFailureCount: finalFailures.length,
    manualThirdGenerationCount,
    consecutiveRecoveryCount: consecutiveRecoveryCount(turns),
    duplicateMessageCount: duplicateMessageCount(turns),
    programInterventionCount: interventions.length,
    programInterventionFalsePositiveCount,
    programInterventionReviewCoverage: ratio(
      reviewedInterventions.length,
      interventions.length
    ),
    visibleQuestionCount: questionObservations.length,
    visibleQuestionReviewedCount: reviewedQuestions.length,
    visibleQuestionReviewCoverage: ratio(
      reviewedQuestions.length,
      questionObservations.length
    ),
    multipleIndependentTasksCount,
    emptyContentInitialCount: emptyContentTurns.length,
    emptyContentRecoveryTriggerCount: emptyContentTurns.length,
    emptyContentRecoveryAttemptCount,
    emptyContentRecoverySuccessCount,
    successAtAttempt1,
    successAtAttempt2,
    finalEmptyContentCount: finalEmptyContentTurns.length,
    recoveryBudgetExhaustedCount,
    recoveredEmptyContentCount,
    visibleLatencyP50Ms: percentile(visibleLatencies, 0.5),
    visibleLatencyP90Ms: percentile(visibleLatencies, 0.9),
    visibleLatencyMaxMs:
      visibleLatencies.length > 0 ? Math.max(...visibleLatencies) : null,
    finalVisibleCompletionCount,
    finalVisibleCompletionRate: ratio(
      finalVisibleCompletionCount,
      eligibleTurns.length
    ),
    pendingOrProcessingCount,
    manualRecoveryCount,
    fastHedgeCallCount,
    totalRecoveryCalls,
    gateFacts: {
      completedTaskCount: taskStatusCount("completed"),
      abortedTaskCount: taskStatusCount("aborted"),
      notRunTaskCount: taskStatusCount("not_run"),
      targetTriggeredTrajectoryCount: reviews.filter(
        (review) => review.targetTrigger === "triggered"
      ).length,
      targetNotTriggeredCount: reviews.filter(
        (review) => review.targetTrigger === "not_triggered"
      ).length,
      targetBlockedByTechnicalFailureCount: reviews.filter(
        (review) => review.targetTrigger === "blocked_by_technical_failure"
      ).length,
      directUseCount: reviews.filter(
        (review) => review.quality === "direct_use"
      ).length,
      minorIssueCount: reviews.filter(
        (review) => review.quality === "minor_issue"
      ).length,
      qualityFailureCount: reviews.filter(
        (review) => review.quality === "quality_failure"
      ).length,
      singleCaseBlockerCount: reviews.filter(
        (review) => review.quality === "single_case_blocker"
      ).length,
      protectedFailureCount: rawProtectedEventCount,
      finalTechnicalFailureCount,
      emptyContentEventCount,
      emptyContentInitialCount: emptyContentTurns.length,
      emptyContentRecoveryAttemptCount,
      emptyContentRecoverySuccessCount,
      finalEmptyContentCount: finalEmptyContentTurns.length,
      recoveryBudgetExhaustedCount,
      recoveredEmptyContentCount,
      automaticRecoveryAttemptCount: automaticRecoveryTurns.length,
      automaticRecoveryWithinDeadlineSuccessCount,
      automaticRecoveryLateOrUnknownCount:
        automaticRecoveryTurns.length -
        automaticRecoveryWithinDeadlineSuccessCount,
      finalVisibleCompletionCount,
      pendingOrProcessingCount,
      manualRecoveryCount,
      fastHedgeCallCount,
      programInterventionUncertainCount,
      visibleQuestionUncertainCount,
      targetLegacyUnknownCount: reviews.filter(
        (review) =>
          review.targetTrigger === undefined ||
          review.targetTrigger === "legacy_unknown"
      ).length,
      unreviewedTrajectoryCount: trajectories.length - reviews.length,
      unreviewedProgramInterventionCount:
        interventions.length - reviewedInterventions.length,
      unreviewedVisibleQuestionCount:
        questionObservations.length - reviewedQuestions.length,
      allProgramInterventionsReviewed:
        reviewedInterventions.length === interventions.length,
      allVisibleQuestionsReviewed:
        reviewedQuestions.length === questionObservations.length
    }
  } as Gi088EvaluationMetrics;
  if (
    input.metricsVersion === GI088_EVALUATION_METRICS_VERSION_V1 ||
    input.metricsVersion === GI088_EVALUATION_METRICS_VERSION_V2
  ) {
    const legacy = { ...result } as Record<string, unknown>;
    const legacyGateFacts = { ...result.gateFacts } as Record<string, unknown>;
    for (const key of [
      "visibleLatencyMaxMs",
      "finalVisibleCompletionCount",
      "finalVisibleCompletionRate",
      "pendingOrProcessingCount",
      "manualRecoveryCount",
      "fastHedgeCallCount"
    ]) {
      delete legacy[key];
    }
    for (const key of [
      "finalVisibleCompletionCount",
      "pendingOrProcessingCount",
      "manualRecoveryCount",
      "fastHedgeCallCount"
    ]) {
      delete legacyGateFacts[key];
    }
    if (input.metricsVersion === GI088_EVALUATION_METRICS_VERSION_V2) {
      return {
        ...legacy,
        version: GI088_EVALUATION_METRICS_VERSION_V2,
        gateFacts: legacyGateFacts
      } as unknown as Gi088EvaluationMetrics;
    }
    for (const key of [
      "emptyContentInitialCount",
      "emptyContentRecoveryTriggerCount",
      "emptyContentRecoveryAttemptCount",
      "emptyContentRecoverySuccessCount",
      "successAtAttempt1",
      "successAtAttempt2",
      "finalEmptyContentCount",
      "recoveryBudgetExhaustedCount",
      "recoveredEmptyContentCount",
      "visibleLatencyP50Ms",
      "visibleLatencyP90Ms",
      "totalRecoveryCalls"
    ]) {
      delete legacy[key];
    }
    for (const key of [
      "emptyContentInitialCount",
      "emptyContentRecoveryAttemptCount",
      "emptyContentRecoverySuccessCount",
      "finalEmptyContentCount",
      "recoveryBudgetExhaustedCount",
      "recoveredEmptyContentCount"
    ]) {
      delete legacyGateFacts[key];
    }
    return {
      ...legacy,
      version: GI088_EVALUATION_METRICS_VERSION_V1,
      gateFacts: legacyGateFacts
    } as unknown as Gi088EvaluationMetrics;
  }
  return result;
}
