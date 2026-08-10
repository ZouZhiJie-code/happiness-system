import {
  GI088_EVALUATION_METRICS_VERSION,
  calculateGi088EvaluationMetrics,
  type Gi088MetricsTurnInput
} from "@/server/services/evaluation/gi088/metrics";

function successfulTurn(
  id: string,
  clientTurnId: string,
  overrides: Partial<Gi088MetricsTurnInput> = {}
): Gi088MetricsTurnInput {
  return {
    id,
    clientTurnId,
    status: "valid",
    assistantMessageId: `assistant-${id}`,
    calls: [{
      id: `call-${id}`,
      attempt: 1,
      kind: "turn",
      status: "valid"
    }],
    ...overrides
  };
}

describe("GI-088 evaluation metrics v1", () => {
  it("对历史 JSON calls 统一计算恢复、失败、重复与人工复核指标", () => {
    const turns: Gi088MetricsTurnInput[] = [
      successfulTurn("t1", "client-1", {
        questionObservation: {
          review: {
            questionPresence: "present",
            classification: "multiple_independent_tasks"
          }
        }
      }),
      successfulTurn("t2", "client-2", {
        status: "complete_after_auto_recovery",
        recovery: { automaticRetryCount: 1, status: "recovered" },
        calls: [
          {
            id: "call-t2-initial",
            attempt: 1,
            kind: "turn",
            status: "technical_failure",
            errorCode: "EMPTY_CONTENT"
          },
          {
            id: "call-t2-auto",
            attempt: 2,
            kind: "automatic_retry",
            status: "valid"
          }
        ],
        questionObservation: { review: null }
      }),
      successfulTurn("t3", "client-3", {
        status: "complete_after_auto_recovery",
        recovery: { automaticRetryCount: 1, status: "recovered" },
        calls: [
          {
            id: "call-t3-initial",
            attempt: 1,
            kind: "turn",
            status: "provider_failed"
          },
          {
            id: "call-t3-auto",
            attempt: 2,
            kind: "automatic_retry",
            status: "finalized"
          }
        ]
      }),
      {
        id: "t4",
        clientTurnId: "client-4",
        status: "valid",
        assistantMessageId: "assistant-t4",
        zeroCallControl: true,
        stateMaintenance: {
          explicitStop: "pure",
          providerCallBypassed: true
        },
        calls: []
      },
      {
        id: "t5",
        clientTurnId: "client-5",
        status: "technical_failure",
        assistantCommitted: false,
        calls: [{
          id: "call-t5",
          attempt: 1,
          kind: "turn",
          status: "provider_failed"
        }]
      },
      {
        id: "t6",
        clientTurnId: "client-6",
        status: "protected_failure",
        assistantCommitted: false,
        calls: [{
          id: "call-t6",
          attempt: 1,
          kind: "turn",
          status: "protected_failure"
        }],
        questionObservation: {
          visible: false,
          review: { classification: "same_focus_low_burden" }
        }
      },
      successfulTurn("t7", "client-7", {
        status: "complete_after_manual_recovery",
        calls: [
          {
            id: "call-t7-initial",
            attempt: 1,
            kind: "turn",
            status: "provider_failed"
          },
          {
            id: "call-t7-auto",
            attempt: 2,
            kind: "automatic_retry",
            status: "provider_failed"
          },
          {
            id: "call-t7-manual",
            attempt: 3,
            kind: "manual_retry",
            status: "finalized"
          }
        ]
      }),
      successfulTurn("t8", "duplicate-client"),
      successfulTurn("t9", "duplicate-client")
    ];

    const metrics = calculateGi088EvaluationMetrics({
      tasks: [{
        taskId: "A1",
        status: "completed",
        branches: {
          high: {
            id: "trajectory-A1-high",
            status: "completed",
            turns,
            review: {
              quality: "direct_use",
              targetTrigger: "triggered"
            }
          }
        }
      }],
      programInterventions: [
        { id: "i1", review: { classification: "correct" } },
        { id: "i2", review: { classification: "false_positive" } },
        { id: "i3", review: null }
      ]
    });

    expect(metrics).toMatchObject({
      version: GI088_EVALUATION_METRICS_VERSION,
      eligibleModelSubmissionCount: 8,
      firstVisibleSuccessCount: 3,
      firstVisibleSuccessRate: 3 / 8,
      zeroCallControlCount: 1,
      rawTechnicalEventCount: 5,
      rawProtectedEventCount: 1,
      autoRecoverySuccessCount: 2,
      finalFailureCount: 2,
      manualThirdGenerationCount: 1,
      consecutiveRecoveryCount: 1,
      duplicateMessageCount: 1,
      programInterventionCount: 3,
      programInterventionFalsePositiveCount: 1,
      programInterventionReviewCoverage: 2 / 3,
      visibleQuestionCount: 2,
      visibleQuestionReviewedCount: 1,
      visibleQuestionReviewCoverage: 1 / 2,
      multipleIndependentTasksCount: 1
    });
    expect(metrics.gateFacts).toMatchObject({
      completedTaskCount: 1,
      abortedTaskCount: 0,
      targetTriggeredTrajectoryCount: 1,
      directUseCount: 1,
      protectedFailureCount: 1,
      finalTechnicalFailureCount: 1,
      emptyContentEventCount: 1,
      automaticRecoveryAttemptCount: 3,
      automaticRecoveryWithinDeadlineSuccessCount: 0,
      automaticRecoveryLateOrUnknownCount: 3,
      unreviewedProgramInterventionCount: 1,
      unreviewedVisibleQuestionCount: 1,
      allProgramInterventionsReviewed: false,
      allVisibleQuestionsReviewed: false
    });
  });

  it("未来 ledger 覆盖历史嵌套 call，并把零分母显示为 N/A", () => {
    const metrics = calculateGi088EvaluationMetrics({
      tasks: [
        {
          taskId: "A1",
          status: "aborted",
          trajectories: [{
            id: "trajectory-1",
            turns: [{
              id: "turn-ledger",
              clientTurnId: "client-ledger",
              status: "valid",
              assistantCommitted: true,
              calls: [{
                callId: "call-ledger",
                turnId: "turn-ledger",
                attempt: 1,
                kind: "turn",
                status: "processing"
              }]
            }]
          }]
        },
        { taskId: "A2", status: "not_run", trajectories: [] }
      ],
      callLedger: [{
        callId: "call-ledger",
        turnId: "turn-ledger",
        attempt: 1,
        kind: "turn",
        status: "finalized",
        dispatchedAt: "2026-08-10T12:00:00.000Z",
        contractValid: true,
        assistantCommitted: true
      }]
    });

    expect(metrics.eligibleModelSubmissionCount).toBe(1);
    expect(metrics.firstVisibleSuccessCount).toBe(1);
    expect(metrics.firstVisibleSuccessRate).toBe(1);
    expect(metrics.programInterventionReviewCoverage).toBeNull();
    expect(metrics.visibleQuestionReviewCoverage).toBeNull();
    expect(metrics.gateFacts).toMatchObject({
      abortedTaskCount: 1,
      notRunTaskCount: 1,
      allProgramInterventionsReviewed: true,
      allVisibleQuestionsReviewed: true
    });
  });

  it("纯控制批次的首次可见成功率保持 N/A", () => {
    const metrics = calculateGi088EvaluationMetrics({
      tasks: [{
        taskId: "A1",
        trajectories: [{
          id: "trajectory-1",
          turns: [{
            id: "pure-stop",
            zeroCallControl: true,
            status: "valid",
            assistantCommitted: true,
            calls: []
          }]
        }]
      }]
    });

    expect(metrics.eligibleModelSubmissionCount).toBe(0);
    expect(metrics.firstVisibleSuccessRate).toBeNull();
    expect(metrics.zeroCallControlCount).toBe(1);
  });

  it("兼容未来 ledger 与直接 intervention review，并严格核对 90 秒恢复门", () => {
    const metrics = calculateGi088EvaluationMetrics({
      tasks: [{
        taskId: "A1",
        status: "completed",
        trajectories: [{
          id: "trajectory-future",
          status: "completed",
          messages: [
            { id: "user-1", role: "user", content: "同一条原话" },
            { id: "user-2", role: "user", content: "同一条原话" }
          ],
          turns: [
            {
              id: "turn-1",
              userMessageId: "user-1",
              status: "complete_after_auto_recovery",
              assistantMessageId: "assistant-1",
              recovery: {
                automaticRetryCount: 1,
                automaticDeadlineAt: "2026-08-10T12:01:30.000Z",
                completedAt: "2026-08-10T12:01:29.999Z"
              },
              questionObservation: {
                questionPresence: "uncertain"
              }
            },
            {
              id: "turn-2",
              userMessageId: "user-2",
              status: "technical_failure",
              assistantCommitted: false
            }
          ],
          review: {
            quality: "minor_issue",
            targetTrigger: "legacy_unknown"
          }
        }]
      }],
      callLedger: [
        {
          callId: "initial-1",
          turnId: "turn-1",
          attempt: 1,
          kind: "turn",
          status: "provider_failed",
          providerResultStatus: "provider_failed",
          dispatchedAt: "2026-08-10T12:00:00.000Z"
        },
        {
          callId: "automatic-1",
          turnId: "turn-1",
          attempt: 2,
          kind: "automatic_retry",
          status: "finalized",
          providerResultStatus: "provider_succeeded",
          finalizedAt: "2026-08-10T12:01:29.999Z"
        },
        {
          callId: "failed-2",
          turnId: "turn-2",
          attempt: 1,
          kind: "turn",
          status: "finalized",
          providerResultStatus: "provider_failed"
        }
      ],
      programInterventions: [
        { id: "intervention-1", reviewOutcome: "uncertain" }
      ]
    });

    expect(metrics).toMatchObject({
      rawTechnicalEventCount: 2,
      autoRecoverySuccessCount: 1,
      finalFailureCount: 1,
      duplicateMessageCount: 1,
      programInterventionReviewCoverage: 1,
      visibleQuestionReviewCoverage: 1
    });
    expect(metrics.gateFacts).toMatchObject({
      automaticRecoveryAttemptCount: 1,
      automaticRecoveryWithinDeadlineSuccessCount: 1,
      automaticRecoveryLateOrUnknownCount: 0,
      programInterventionUncertainCount: 1,
      visibleQuestionUncertainCount: 1,
      targetLegacyUnknownCount: 1
    });
  });
});
