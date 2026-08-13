#!/usr/bin/env node

import { PrismaClient } from "@prisma/client";

import {
  BASE_URL,
  createAcceptanceClient
} from "./launch-acceptance-runner.mjs";

const ENTRY_DATE = process.env.INTENT_OBSERVATION_ENTRY_DATE ?? "2026-07-21";

const auxiliaryCases = [
  {
    id: "joy_content_generate",
    dimension: "joy",
    userText:
      "今天把卡了很久的文案突然写顺了，我一下松快很多，喜欢的是那种思路终于流动起来的感觉，直接生成吧"
  },
  {
    id: "fulfillment_content_stop",
    dimension: "fulfillment",
    userText:
      "今天终于把拖了三天的发布说明彻底收口，看到它真的上线，我觉得这一天没白过，先别问了"
  },
  {
    id: "reflection_question_repair",
    dimension: "reflection",
    userText: "这个问题能问得落地一点吗"
  },
  {
    id: "improvement_correction",
    dimension: "improvement",
    userText:
      "刚才说准备不足不准确，其实是我总怕让别人失望，下次我会先听完再回应"
  },
  {
    id: "gratitude_quoted_stop",
    dimension: "gratitude",
    userText:
      "同事说‘项目先收住吧，别再追了’，然后主动帮我把遗漏项补完，我那一刻很感动"
  }
];

const ordinaryCases = [
  ["joy", "午休时晒了十分钟太阳，风吹过来很舒服，我整个人都松了下来"],
  ["joy", "晚饭时猫突然跳到我腿上打呼噜，我忍不住笑了很久"],
  ["joy", "下午终于把卡住的文案写顺了，那种流畅感让我很开心"],
  ["joy", "朋友发来一张我们以前旅行的照片，我看到时心里一下亮了"],
  ["fulfillment", "今天把拖了两天的报告交出去，也收到确认可以进入下一步"],
  ["fulfillment", "我整理完了堆了很久的衣柜，房间清爽后觉得这件事终于落地了"],
  ["fulfillment", "晚上按计划跑完三公里，比昨天多坚持了十分钟"],
  ["fulfillment", "我帮同事理清了提案结构，最后我们按时完成了评审材料"],
  ["reflection", "开会时我发现自己一被追问就急着解释，后来才意识到我很怕被否定"],
  ["reflection", "今天拒绝一个临时请求后，我发现提前说清边界反而让合作更顺"],
  ["reflection", "下午焦虑的时候我停下来想了想，发现真正担心的是结果失控"],
  ["reflection", "和朋友聊完以后，我意识到我一直把休息误解成浪费时间"],
  ["improvement", "今天开会时我又抢着回应，结果漏听了同事后半句，下次我想先停两秒"],
  ["improvement", "早上出门晚了十分钟，主要是临时找东西，下次要提前把包收好"],
  ["improvement", "我回复消息时语气太急，让对方误会了，我想先确认事实再表达判断"],
  ["improvement", "学习时一直切换窗口导致效率很低，明天准备先专注二十五分钟"],
  ["gratitude", "同事早上顺手给我带了早餐，还记得我不吃辣，我觉得很被照顾"],
  ["gratitude", "妈妈今晚耐心听我把烦恼说完，没有急着评价，我心里安稳了很多"],
  ["gratitude", "朋友知道我加班后特意来接我，让我觉得有人愿意替我分担"],
  ["gratitude", "老师认真看了我的方案并写下具体建议，我感到自己的投入被重视了"]
].map(([dimension, userText], index) => ({
  id: `ordinary_${String(index + 1).padStart(2, "0")}`,
  dimension,
  userText
}));

function percentile(values, percentileValue) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(
    0,
    Math.min(sorted.length - 1, Math.ceil(sorted.length * percentileValue) - 1)
  );
  return sorted[index];
}

function includesAny(value, candidates) {
  const serialized = JSON.stringify(value ?? {});
  return candidates.some((candidate) => serialized.includes(candidate));
}

function getBaseMessageSequence(session) {
  const sequences = (session?.messages ?? [])
    .map((message) => message.sequence)
    .filter((sequence) => Number.isInteger(sequence));
  return sequences.length ? Math.max(...sequences) : -1;
}

async function runCase(client, evalCase, index, group, account, start) {
  const sessionId = start.json.sessionId;
  const clientTurnId = `intent-observation-${Date.now()}-${group}-${index}`;
  const startedAt = performance.now();
  const response = await client.http("/api/interview/session/respond", {
    method: "POST",
    cookie: account.cookie,
    body: {
      action: "reply",
      sessionId,
      rawText: evalCase.userText,
      inputMode: "text",
      clientTurnId,
      baseMessageSequence: getBaseMessageSequence(start.json.session)
    }
  });
  const clientLatencyMs = Math.round(performance.now() - startedAt);

  if (response.status === 200 && response.json?.session) {
    start.json.session = response.json.session;
  }

  const result = {
    id: evalCase.id,
    group,
    dimension: evalCase.dimension,
    sessionId,
    clientTurnId,
    status: response.status,
    clientLatencyMs,
    publicResult: {
      turnCount: response.json?.turnCount ?? null,
      stage: response.json?.session?.stage ?? null,
      sessionStatus: response.json?.sessionStatus ?? null,
      isReadyForDraft: response.json?.isReadyForDraft ?? null,
      pendingDecisionKind:
        response.json?.session?.pendingDecision?.kind ?? null,
      assistantMessage: response.json?.assistantMessage ?? null,
      snapshotData: response.json?.snapshotData ?? null
    }
  };

  process.stdout.write(
    `PROGRESS ${JSON.stringify({
      completed: index + 1,
      group,
      id: evalCase.id,
      dimension: evalCase.dimension,
      status: response.status,
      clientLatencyMs
    })}\n`
  );

  return result;
}

async function startDimensionSessions(client, account, label) {
  const sessions = new Map();

  for (const dimension of [
    "joy",
    "fulfillment",
    "reflection",
    "improvement",
    "gratitude"
  ]) {
    const start = await client.startSession({
      cookie: account.cookie,
      dimension,
      entryDate: ENTRY_DATE
    });

    if (start.status !== 200 || !start.json?.sessionId) {
      throw new Error(
        `start failed for ${label}/${dimension}: ${start.status} ${start.text}`
      );
    }

    sessions.set(dimension, start);
  }

  return sessions;
}

function evaluateAuxiliaryCase(run, turn) {
  const assessment = turn?.intentAssessment ?? {};
  const decision = turn?.intentDecision ?? {};
  const dialogueActs = Array.isArray(assessment.dialogueActs)
    ? assessment.dialogueActs
    : [];
  const snapshot = run.publicResult.snapshotData;

  if (run.id === "joy_content_generate") {
    return (
      run.status === 200 &&
      assessment.primaryControl === "generate_draft" &&
      assessment.content?.presence === "clear" &&
      decision.stopFollowUp === true &&
      includesAny(snapshot, ["文案", "写顺", "松快", "流动"])
    );
  }

  if (run.id === "fulfillment_content_stop") {
    return (
      run.status === 200 &&
      assessment.primaryControl === "stop_follow_up" &&
      assessment.content?.presence === "clear" &&
      decision.stopFollowUp === true &&
      includesAny(snapshot, ["发布说明", "上线", "没白过"])
    );
  }

  if (run.id === "reflection_question_repair") {
    return (
      run.status === 200 &&
      assessment.primaryControl === "repair_question" &&
      assessment.content?.presence === "none" &&
      decision.runExtraction === false &&
      run.publicResult.turnCount === 0
    );
  }

  if (run.id === "improvement_correction") {
    return (
      run.status === 200 &&
      assessment.primaryControl === "none" &&
      dialogueActs.includes("correct_previous") &&
      decision.runExtraction === true &&
      includesAny(snapshot, ["失望", "听完", "回应"])
    );
  }

  if (run.id === "gratitude_quoted_stop") {
    return (
      run.status === 200 &&
      assessment.primaryControl === "none" &&
      assessment.referenceTarget === "quoted_event" &&
      decision.stopFollowUp === false &&
      includesAny(snapshot, ["遗漏项", "主动帮", "补完", "感动"])
    );
  }

  return false;
}

async function inspectDatabase(sessionIds) {
  const prisma = new PrismaClient();

  try {
    const [turns, traces, requests] = await Promise.all([
      prisma.interviewUserTurn.findMany({
        where: { sessionId: { in: sessionIds } },
        select: {
          sessionId: true,
          clientTurnId: true,
          status: true,
          attemptCount: true,
          intentAssessment: true,
          intentClassifierVersion: true,
          intentDecision: true,
          intentAssessedAt: true,
          messages: {
            where: { role: "assistant" },
            select: { generationTraceId: true }
          }
        }
      }),
      prisma.aIGenerationTrace.findMany({
        where: {
          sessionId: { in: sessionIds },
          artifactType: "interview_turn"
        },
        select: {
          id: true,
          sessionId: true,
          status: true,
          outputOrigin: true,
          pipelineDecisions: true,
          createdAt: true,
          completedAt: true
        }
      }),
      prisma.aIRequestLog.findMany({
        where: {
          sessionId: { in: sessionIds },
          stage: "extract"
        },
        select: {
          traceId: true,
          sessionId: true,
          success: true,
          latencyMs: true,
          errorCode: true
        }
      })
    ]);

    return { turns, traces, requests };
  } finally {
    await prisma.$disconnect();
  }
}

function getTraceIdForTurn(turn) {
  return (
    turn?.messages?.find((message) => message.generationTraceId)
      ?.generationTraceId ?? null
  );
}

async function inspectLatestRun() {
  const prisma = new PrismaClient();
  let latestTurns;

  try {
    latestTurns = await prisma.interviewUserTurn.findMany({
      where: {
        clientTurnId: { startsWith: "intent-observation-" }
      },
      orderBy: { createdAt: "desc" },
      take: 25,
      select: {
        clientTurnId: true,
        sessionId: true,
        createdAt: true
      }
    });
  } finally {
    await prisma.$disconnect();
  }

  if (latestTurns.length !== 25) {
    throw new Error(
      `expected 25 latest observation turns, received ${latestTurns.length}`
    );
  }

  const orderedTurns = [...latestTurns].sort(
    (left, right) => left.createdAt.getTime() - right.createdAt.getTime()
  );
  const sessionIds = Array.from(
    new Set(orderedTurns.map((turn) => turn.sessionId))
  );
  const database = await inspectDatabase(sessionIds);
  const turnsByClientTurnId = new Map(
    database.turns.map((turn) => [turn.clientTurnId, turn])
  );
  const tracesById = new Map(
    database.traces.map((trace) => [trace.id, trace])
  );
  const requestsByTraceId = new Map();

  for (const request of database.requests) {
    const current = requestsByTraceId.get(request.traceId) ?? [];
    current.push(request);
    requestsByTraceId.set(request.traceId, current);
  }

  const reconstructed = orderedTurns.map((latestTurn) => {
    const suffixMatch = /-(auxiliary|ordinary)-(\d+)$/u.exec(
      latestTurn.clientTurnId
    );
    if (!suffixMatch) {
      throw new Error(`unrecognized observation turn ${latestTurn.clientTurnId}`);
    }

    const group = suffixMatch[1];
    const index = Number(suffixMatch[2]);
    const evalCase =
      group === "auxiliary" ? auxiliaryCases[index] : ordinaryCases[index];
    const turn = turnsByClientTurnId.get(latestTurn.clientTurnId);
    const traceId = getTraceIdForTurn(turn);
    const trace = traceId ? tracesById.get(traceId) : null;
    const requests = traceId ? requestsByTraceId.get(traceId) ?? [] : [];
    const serverLatencyMs =
      trace?.completedAt && trace.createdAt
        ? trace.completedAt.getTime() - trace.createdAt.getTime()
        : null;

    return {
      id: evalCase.id,
      group,
      dimension: evalCase.dimension,
      clientTurnId: latestTurn.clientTurnId,
      sessionId: latestTurn.sessionId,
      turn,
      trace,
      requests,
      serverLatencyMs
    };
  });

  const sessionPrisma = new PrismaClient();
  let sessions;
  try {
    sessions = await sessionPrisma.interviewSession.findMany({
      where: { id: { in: sessionIds } },
      select: {
        id: true,
        stage: true,
        status: true,
        turnCount: true,
        activeEvent: {
          select: { snapshotData: true }
        }
      }
    });
  } finally {
    await sessionPrisma.$disconnect();
  }
  const sessionsById = new Map(sessions.map((session) => [session.id, session]));

  const auxiliary = reconstructed
    .filter((item) => item.group === "auxiliary")
    .map((item) => {
      const session = sessionsById.get(item.sessionId);
      const run = {
        id: item.id,
        status: item.turn?.status === "completed" ? 200 : null,
        publicResult: {
          turnCount: session?.turnCount ?? null,
          stage: session?.stage ?? null,
          snapshotData: session?.activeEvent?.snapshotData ?? null
        }
      };
      return {
        id: item.id,
        dimension: item.dimension,
        passed: evaluateAuxiliaryCase(run, item.turn),
        primaryControl: item.turn?.intentAssessment?.primaryControl ?? null,
        dialogueActs: item.turn?.intentAssessment?.dialogueActs ?? [],
        contentPresence:
          item.turn?.intentAssessment?.content?.presence ?? null,
        referenceTarget:
          item.turn?.intentAssessment?.referenceTarget ?? null,
        origin: item.turn?.intentAssessment?.origin ?? null,
        decision: item.turn?.intentDecision ?? null,
        serverLatencyMs: item.serverLatencyMs,
        modelCalls: item.requests.length,
        modelCallSucceeded: item.requests[0]?.success ?? null
      };
    });

  const ordinary = reconstructed
    .filter((item) => item.group === "ordinary")
    .map((item) => {
      const assessment = item.turn?.intentAssessment ?? {};
      const decision = item.turn?.intentDecision ?? {};
      return {
        id: item.id,
        dimension: item.dimension,
        passed:
          item.turn?.status === "completed" &&
          assessment.primaryControl === "none" &&
          assessment.content?.presence === "clear" &&
          decision.runExtraction === true &&
          item.requests.length === 1,
        origin: assessment.origin ?? null,
        modelCalls: item.requests.length,
        modelCallSucceeded: item.requests[0]?.success ?? null,
        modelLatencyMs: item.requests[0]?.latencyMs ?? null,
        modelErrorCode: item.requests[0]?.errorCode ?? null,
        serverLatencyMs: item.serverLatencyMs
      };
    });

  const result = {
    reportVersion: "interview-intent-preview-observation-v1",
    inspectedAt: new Date().toISOString(),
    auxiliary: {
      passed: auxiliary.filter((item) => item.passed).length,
      total: auxiliary.length,
      cases: auxiliary
    },
    ordinary: {
      passed: ordinary.filter((item) => item.passed).length,
      total: ordinary.length,
      totalModelCalls: ordinary.reduce(
        (total, item) => total + item.modelCalls,
        0
      ),
      modelCallsPerTurn:
        ordinary.reduce((total, item) => total + item.modelCalls, 0) /
        ordinary.length,
      modelCallSuccesses: ordinary.filter(
        (item) => item.modelCallSucceeded === true
      ).length,
      fallbackTurns: ordinary.filter((item) => item.origin === "fallback")
        .length,
      serverLatencyMs: {
        p50: percentile(
          ordinary
            .map((item) => item.serverLatencyMs)
            .filter((value) => Number.isFinite(value)),
          0.5
        ),
        p95: percentile(
          ordinary
            .map((item) => item.serverLatencyMs)
            .filter((value) => Number.isFinite(value)),
          0.95
        ),
        max: Math.max(
          ...ordinary
            .map((item) => item.serverLatencyMs)
            .filter((value) => Number.isFinite(value))
        )
      },
      modelLatencyMs: {
        p50: percentile(
          ordinary
            .map((item) => item.modelLatencyMs)
            .filter((value) => Number.isFinite(value)),
          0.5
        ),
        p95: percentile(
          ordinary
            .map((item) => item.modelLatencyMs)
            .filter((value) => Number.isFinite(value)),
          0.95
        )
      },
      byDimension: Object.fromEntries(
        ["joy", "fulfillment", "reflection", "improvement", "gratitude"].map(
          (dimension) => {
            const items = ordinary.filter(
              (item) => item.dimension === dimension
            );
            return [
              dimension,
              {
                passed: items.filter((item) => item.passed).length,
                total: items.length,
                fallbackTurns: items.filter(
                  (item) => item.origin === "fallback"
                ).length,
                serverP50Ms: percentile(
                  items
                    .map((item) => item.serverLatencyMs)
                    .filter((value) => Number.isFinite(value)),
                  0.5
                )
              }
            ];
          }
        )
      ),
      turns: ordinary
    }
  };

  process.stdout.write(`INSPECTION ${JSON.stringify(result)}\n`);

  if (
    result.auxiliary.passed !== result.auxiliary.total ||
    result.ordinary.passed !== result.ordinary.total
  ) {
    process.exitCode = 1;
  }
}

async function main() {
  if (process.argv.includes("--inspect-latest")) {
    await inspectLatestRun();
    return;
  }

  if (ordinaryCases.length !== 20) {
    throw new Error("ordinary observation set must contain exactly 20 turns");
  }

  const client = createAcceptanceClient({ baseUrl: BASE_URL });
  const runStartedAt = new Date().toISOString();
  const auxiliaryRuns = [];
  const ordinaryRuns = [];
  const auxiliaryAccount = await client.registerAndLogin("intent_auxiliary");
  const auxiliarySessions = await startDimensionSessions(
    client,
    auxiliaryAccount,
    "auxiliary"
  );

  for (let index = 0; index < auxiliaryCases.length; index += 1) {
    const evalCase = auxiliaryCases[index];
    auxiliaryRuns.push(
      await runCase(
        client,
        evalCase,
        index,
        "auxiliary",
        auxiliaryAccount,
        auxiliarySessions.get(evalCase.dimension)
      )
    );
  }

  const ordinaryAccounts = [
    await client.registerAndLogin("intent_ordinary_a"),
    await client.registerAndLogin("intent_ordinary_b")
  ];
  const ordinarySessions = [
    await startDimensionSessions(client, ordinaryAccounts[0], "ordinary-a"),
    await startDimensionSessions(client, ordinaryAccounts[1], "ordinary-b")
  ];
  const dimensionOccurrence = new Map();

  for (let index = 0; index < ordinaryCases.length; index += 1) {
    const evalCase = ordinaryCases[index];
    const occurrence = dimensionOccurrence.get(evalCase.dimension) ?? 0;
    const accountIndex = occurrence < 2 ? 0 : 1;
    dimensionOccurrence.set(evalCase.dimension, occurrence + 1);
    ordinaryRuns.push(
      await runCase(
        client,
        evalCase,
        index,
        "ordinary",
        ordinaryAccounts[accountIndex],
        ordinarySessions[accountIndex].get(evalCase.dimension)
      )
    );
  }

  const allRuns = [...auxiliaryRuns, ...ordinaryRuns];
  const database = await inspectDatabase(allRuns.map((run) => run.sessionId));
  const turnsByClientTurnId = new Map(
    database.turns.map((turn) => [turn.clientTurnId, turn])
  );
  const tracesById = new Map(
    database.traces.map((trace) => [trace.id, trace])
  );
  const requestsByTraceId = new Map();

  for (const request of database.requests) {
    const current = requestsByTraceId.get(request.traceId) ?? [];
    current.push(request);
    requestsByTraceId.set(request.traceId, current);
  }

  const auxiliary = auxiliaryRuns.map((run) => {
    const turn = turnsByClientTurnId.get(run.clientTurnId);
    return {
      id: run.id,
      dimension: run.dimension,
      status: run.status,
      passed: evaluateAuxiliaryCase(run, turn),
      primaryControl: turn?.intentAssessment?.primaryControl ?? null,
      contentPresence: turn?.intentAssessment?.content?.presence ?? null,
      referenceTarget: turn?.intentAssessment?.referenceTarget ?? null,
      origin: turn?.intentAssessment?.origin ?? null,
      decision: turn?.intentDecision ?? null,
      clientLatencyMs: run.clientLatencyMs
    };
  });

  const ordinary = ordinaryRuns.map((run) => {
    const turn = turnsByClientTurnId.get(run.clientTurnId);
    const traceId = getTraceIdForTurn(turn);
    const trace = traceId ? tracesById.get(traceId) : null;
    const requests = traceId ? requestsByTraceId.get(traceId) ?? [] : [];
    const assessment = turn?.intentAssessment ?? {};
    const decision = turn?.intentDecision ?? {};
    const serverLatencyMs =
      trace?.completedAt && trace.createdAt
        ? trace.completedAt.getTime() - trace.createdAt.getTime()
        : null;
    const passed =
      run.status === 200 &&
      turn?.status === "completed" &&
      assessment.primaryControl === "none" &&
      assessment.content?.presence === "clear" &&
      decision.runExtraction === true &&
      requests.length === 1;

    return {
      id: run.id,
      dimension: run.dimension,
      passed,
      status: run.status,
      origin: assessment.origin ?? null,
      modelCalls: requests.length,
      modelCallSucceeded: requests[0]?.success ?? null,
      modelLatencyMs: requests[0]?.latencyMs ?? null,
      modelErrorCode: requests[0]?.errorCode ?? null,
      serverLatencyMs,
      clientLatencyMs: run.clientLatencyMs
    };
  });

  const summary = {
    reportVersion: "interview-intent-preview-observation-v1",
    runStartedAt,
    runCompletedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    entryDate: ENTRY_DATE,
    auxiliary: {
      passed: auxiliary.filter((item) => item.passed).length,
      total: auxiliary.length,
      cases: auxiliary
    },
    ordinary: {
      passed: ordinary.filter((item) => item.passed).length,
      total: ordinary.length,
      totalModelCalls: ordinary.reduce(
        (total, item) => total + item.modelCalls,
        0
      ),
      modelCallsPerTurn: ordinary.length
        ? ordinary.reduce((total, item) => total + item.modelCalls, 0) /
          ordinary.length
        : null,
      modelCallSuccesses: ordinary.filter(
        (item) => item.modelCallSucceeded === true
      ).length,
      fallbackTurns: ordinary.filter((item) => item.origin === "fallback")
        .length,
      clientLatencyMs: {
        p50: percentile(
          ordinary.map((item) => item.clientLatencyMs),
          0.5
        ),
        p95: percentile(
          ordinary.map((item) => item.clientLatencyMs),
          0.95
        ),
        max: Math.max(...ordinary.map((item) => item.clientLatencyMs))
      },
      serverLatencyMs: {
        p50: percentile(
          ordinary
            .map((item) => item.serverLatencyMs)
            .filter((value) => Number.isFinite(value)),
          0.5
        ),
        p95: percentile(
          ordinary
            .map((item) => item.serverLatencyMs)
            .filter((value) => Number.isFinite(value)),
          0.95
        )
      },
      modelLatencyMs: {
        p50: percentile(
          ordinary
            .map((item) => item.modelLatencyMs)
            .filter((value) => Number.isFinite(value)),
          0.5
        ),
        p95: percentile(
          ordinary
            .map((item) => item.modelLatencyMs)
            .filter((value) => Number.isFinite(value)),
          0.95
        )
      },
      byDimension: Object.fromEntries(
        ["joy", "fulfillment", "reflection", "improvement", "gratitude"].map(
          (dimension) => {
            const items = ordinary.filter(
              (item) => item.dimension === dimension
            );
            return [
              dimension,
              {
                passed: items.filter((item) => item.passed).length,
                total: items.length,
                fallbackTurns: items.filter(
                  (item) => item.origin === "fallback"
                ).length,
                serverP50Ms: percentile(
                  items
                    .map((item) => item.serverLatencyMs)
                    .filter((value) => Number.isFinite(value)),
                  0.5
                )
              }
            ];
          }
        )
      ),
      turns: ordinary
    }
  };

  process.stdout.write(`RESULT ${JSON.stringify(summary)}\n`);

  if (
    summary.auxiliary.passed !== summary.auxiliary.total ||
    summary.ordinary.passed !== summary.ordinary.total
  ) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : error}\n`);
  process.exit(1);
});
