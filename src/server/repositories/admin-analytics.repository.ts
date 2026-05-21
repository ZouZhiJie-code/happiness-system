import { Prisma } from "@prisma/client";

import { prisma } from "@/server/db/prisma";
import { formatEntryDate, getEntryDateRangeBounds } from "@/features/interview/entry-date";
import type { InterviewDimension } from "@/types/interview";
import { findJoyInterviewSessionById } from "@/server/repositories/joy-interview.repository";

export async function recordAnalyticsEvent(input: {
  eventName: string;
  userId?: string | null;
  sessionId?: string | null;
  entryId?: string | null;
  requestId?: string | null;
  dedupeKey?: string | null;
  properties?: Record<string, unknown>;
}) {
  const data = {
    eventName: input.eventName,
    userId: input.userId ?? null,
    sessionId: input.sessionId ?? null,
    entryId: input.entryId ?? null,
    requestId: input.requestId ?? null,
    dedupeKey: input.dedupeKey ?? null,
    properties: (input.properties ?? {}) as Prisma.InputJsonValue
  };

  if (input.dedupeKey) {
    return prisma.analyticsEvent.upsert({
      where: {
        dedupeKey: input.dedupeKey
      },
      create: data,
      update: {}
    });
  }

  return prisma.analyticsEvent.create({
    data
  });
}

export async function recordAdminAuditLog(input: {
  adminUsername: string;
  targetUserId?: string | null;
  resourceType: string;
  resourceId: string;
  action: string;
}) {
  return prisma.adminAuditLog.create({
    data: {
      adminUsername: input.adminUsername,
      targetUserId: input.targetUserId ?? null,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      action: input.action
    }
  });
}

export async function countActiveUsersInRange(input: { startDate: string; endDate: string }) {
  const { startAt, endExclusive } = getEntryDateRangeBounds(input.startDate, input.endDate);

  const result = await prisma.user.count({
    where: {
      OR: [
        {
          joyEntries: {
            some: {
              status: "saved",
              date: {
                gte: startAt,
                lt: endExclusive
              }
            }
          }
        },
        {
          dailyJournalEntries: {
            some: {
              status: "saved",
              date: {
                gte: startAt,
                lt: endExclusive
              }
            }
          }
        }
      ]
    }
  });

  return result;
}

export async function getSavedJoyEntryStats(input: { startDate: string; endDate: string }) {
  const { startAt, endExclusive } = getEntryDateRangeBounds(input.startDate, input.endDate);
  const [saveCount, groupedUsers] = await Promise.all([
    prisma.joyEntry.count({
      where: {
        status: "saved",
        date: {
          gte: startAt,
          lt: endExclusive
        }
      }
    }),
    prisma.joyEntry.groupBy({
      by: ["userId"],
      where: {
        status: "saved",
        date: {
          gte: startAt,
          lt: endExclusive
        }
      }
    })
  ]);

  return {
    userCount: groupedUsers.length,
    saveCount
  };
}

export async function getDailyJournalSaveStats(input: { startDate: string; endDate: string }) {
  const { startAt, endExclusive } = getEntryDateRangeBounds(input.startDate, input.endDate);
  const [saveCount, groupedUsers] = await Promise.all([
    prisma.dailyJournalEntry.count({
      where: {
        status: "saved",
        date: {
          gte: startAt,
          lt: endExclusive
        }
      }
    }),
    prisma.dailyJournalEntry.groupBy({
      by: ["userId"],
      where: {
        status: "saved",
        date: {
          gte: startAt,
          lt: endExclusive
        }
      }
    })
  ]);

  return {
    userCount: groupedUsers.length,
    saveCount
  };
}

export async function getHappinessScoreStats(input: { startDate: string; endDate: string }) {
  const { startAt, endExclusive } = getEntryDateRangeBounds(input.startDate, input.endDate);
  const [saveCount, groupedUsers] = await Promise.all([
    prisma.dailyHappinessScore.count({
      where: {
        date: {
          gte: startAt,
          lt: endExclusive
        }
      }
    }),
    prisma.dailyHappinessScore.groupBy({
      by: ["userId"],
      where: {
        date: {
          gte: startAt,
          lt: endExclusive
        }
      }
    })
  ]);

  return {
    userCount: groupedUsers.length,
    saveCount
  };
}

export async function getLatestAIRequestStats(input: { startDate: string; endDate: string }) {
  const { startAt, endExclusive } = getEntryDateRangeBounds(input.startDate, input.endDate);
  const logs = await prisma.aIRequestLog.findMany({
    where: {
      createdAt: {
        gte: startAt,
        lt: endExclusive
      }
    },
    select: {
      latencyMs: true,
      success: true,
      errorCode: true
    }
  });

  if (!logs.length) {
    return {
      successRate: 0,
      p50LatencyMs: null,
      p95LatencyMs: null,
      errorCodeBreakdown: [] as Array<{ errorCode: string; count: number }>
    };
  }

  const successCount = logs.filter((log) => log.success).length;
  const latencies = logs
    .map((log) => log.latencyMs)
    .filter((latency): latency is number => typeof latency === "number")
    .sort((left, right) => left - right);

  const percentile = (value: number) =>
    latencies.length ? latencies[Math.min(latencies.length - 1, Math.floor((latencies.length - 1) * value))] : null;

  const errorCodeMap = new Map<string, number>();
  for (const log of logs) {
    if (!log.errorCode) {
      continue;
    }

    errorCodeMap.set(log.errorCode, (errorCodeMap.get(log.errorCode) ?? 0) + 1);
  }

  return {
    successRate: successCount / logs.length,
    p50LatencyMs: percentile(0.5),
    p95LatencyMs: percentile(0.95),
    errorCodeBreakdown: [...errorCodeMap.entries()].map(([errorCode, count]) => ({
      errorCode,
      count
    }))
  };
}

export async function getAnalyticsEventCounts(input: { startDate: string; endDate: string; eventNames: string[] }) {
  const { startAt, endExclusive } = getEntryDateRangeBounds(input.startDate, input.endDate);
  const grouped = await prisma.analyticsEvent.groupBy({
    by: ["eventName"],
    where: {
      eventName: {
        in: input.eventNames
      },
      occurredAt: {
        gte: startAt,
        lt: endExclusive
      }
    },
    _count: {
      _all: true
    }
  });

  return input.eventNames.reduce<Record<string, number>>((accumulator, eventName) => {
    const matched = grouped.find((item) => item.eventName === eventName);
    accumulator[eventName] = matched?._count._all ?? 0;
    return accumulator;
  }, {});
}

export async function countAnalyticsEvents(input: { startDate: string; endDate: string; eventName: string }) {
  const { startAt, endExclusive } = getEntryDateRangeBounds(input.startDate, input.endDate);

  return prisma.analyticsEvent.count({
    where: {
      eventName: input.eventName,
      occurredAt: {
        gte: startAt,
        lt: endExclusive
      }
    }
  });
}

export async function getInterviewDraftSourceStats(input: { startDate: string; endDate: string }) {
  const { startAt, endExclusive } = getEntryDateRangeBounds(input.startDate, input.endDate);
  const [editedDraftCount, totalDraftCount] = await Promise.all([
    prisma.joyEntry.count({
      where: {
        source: "ai_draft_edited",
        updatedAt: {
          gte: startAt,
          lt: endExclusive
        }
      }
    }),
    prisma.joyEntry.count({
      where: {
        updatedAt: {
          gte: startAt,
          lt: endExclusive
        }
      }
    })
  ]);

  return {
    editedDraftCount,
    totalDraftCount
  };
}

export async function getDimensionSaveStats(input: { startDate: string; endDate: string }) {
  const { startAt, endExclusive } = getEntryDateRangeBounds(input.startDate, input.endDate);
  const grouped = await prisma.joyEntry.groupBy({
    by: ["sessionId"],
    where: {
      status: "saved",
      date: {
        gte: startAt,
        lt: endExclusive
      }
    },
    _count: {
      _all: true
    }
  });

  const entries = await prisma.joyEntry.findMany({
    where: {
      status: "saved",
      date: {
        gte: startAt,
        lt: endExclusive
      }
    },
    select: {
      session: {
        select: {
          dimension: true
        }
      }
    }
  });

  const counter = new Map<InterviewDimension, number>();
  for (const entry of entries) {
    const dimension = entry.session?.dimension;
    if (!dimension) {
      continue;
    }

    counter.set(dimension, (counter.get(dimension) ?? 0) + 1);
  }

  void grouped;

  return [...counter.entries()].map(([dimension, savedEntryCount]) => ({
    dimension,
    savedEntryCount
  }));
}

export async function getRetentionStats(_input: { startDate: string; endDate: string }) {
  const { startAt, endExclusive } = getEntryDateRangeBounds(_input.startDate, _input.endDate);
  const users = await prisma.user.findMany({
    where: {
      createdAt: {
        gte: startAt,
        lt: endExclusive
      }
    },
    select: {
      id: true,
      createdAt: true
    }
  });
  const events = await prisma.analyticsEvent.findMany({
    where: {
      userId: {
        in: users.map((user) => user.id)
      }
    },
    select: {
      userId: true,
      eventName: true,
      occurredAt: true
    },
    orderBy: {
      occurredAt: "asc"
    }
  });

  const eventMap = new Map<string, Array<{ eventName: string; occurredAt: Date }>>();
  for (const event of events) {
    if (!event.userId) {
      continue;
    }

    const list = eventMap.get(event.userId) ?? [];
    list.push({
      eventName: event.eventName,
      occurredAt: event.occurredAt
    });
    eventMap.set(event.userId, list);
  }

  const withinDays = (from: Date, to: Date, days: number) => to.getTime() - from.getTime() <= days * 24 * 60 * 60 * 1000;

  const metrics = {
    d1ReturnToRecordRate: 0,
    d7ReturnToRecordRate: 0,
    d30ReturnToRecordRate: 0,
    d7RepeatSaveRate: 0,
    d30RepeatSaveRate: 0
  };

  if (!users.length) {
    return metrics;
  }

  let d1Count = 0;
  let d7Count = 0;
  let d30Count = 0;
  let d7RepeatSaveCount = 0;
  let d30RepeatSaveCount = 0;

  for (const user of users) {
    const userEvents = eventMap.get(user.id) ?? [];
    const createdAt = user.createdAt;
    const started = userEvents.find((event) => event.eventName === "interview_session_started");
    const saved = userEvents.find((event) => event.eventName === "interview_draft_saved");

    if (started && withinDays(createdAt, started.occurredAt, 1)) {
      d1Count += 1;
    }

    if (started && withinDays(createdAt, started.occurredAt, 7)) {
      d7Count += 1;
    }

    if (started && withinDays(createdAt, started.occurredAt, 30)) {
      d30Count += 1;
    }

    if (saved && withinDays(createdAt, saved.occurredAt, 7)) {
      d7RepeatSaveCount += 1;
    }

    if (saved && withinDays(createdAt, saved.occurredAt, 30)) {
      d30RepeatSaveCount += 1;
    }
  }

  return {
    d1ReturnToRecordRate: d1Count / users.length,
    d7ReturnToRecordRate: d7Count / users.length,
    d30ReturnToRecordRate: d30Count / users.length,
    d7RepeatSaveRate: d7RepeatSaveCount / users.length,
    d30RepeatSaveRate: d30RepeatSaveCount / users.length
  };
}

function deriveAdminAnalyticsFunnelStep(input: {
  analyticsEvents: Array<{ eventName: string }>;
  savedEntryCount: number;
  savedDailyJournalCount: number;
  hasDraftEntry: boolean;
  hasCompletedSession: boolean;
  hasAnySession: boolean;
}) {
  return input.savedDailyJournalCount > 0 || input.analyticsEvents.some((event) => event.eventName === "daily_journal_saved")
    ? "daily_journal_saved"
    : input.savedEntryCount > 0 || input.analyticsEvents.some((event) => event.eventName === "interview_draft_saved")
      ? "journal_saved"
      : input.hasDraftEntry || input.analyticsEvents.some((event) => event.eventName === "interview_draft_generated")
        ? "draft_generated"
        : input.analyticsEvents.some((event) => event.eventName === "interview_first_user_reply") || input.hasCompletedSession
          ? "first_reply"
          : input.analyticsEvents.some((event) => event.eventName === "interview_session_started") || input.hasAnySession
            ? "session_started"
            : input.analyticsEvents.some((event) => event.eventName === "auth_login_succeeded")
              ? "login"
              : input.analyticsEvents.some((event) => event.eventName === "auth_register_succeeded")
                ? "register"
                : null;
}

function getLatestAdminAnalyticsActivityAt(input: {
  analyticsEvents: Array<{ occurredAt: Date }>;
  joyEntries?: Array<{ updatedAt: Date }>;
  dailyJournals?: Array<{ updatedAt: Date }>;
  sessions?: Array<{ startedAt: Date }>;
  extraDates?: Date[];
}) {
  let latest: Date | null = null;

  const candidates = [
    ...input.analyticsEvents.map((event) => event.occurredAt),
    ...(input.joyEntries ?? []).map((entry) => entry.updatedAt),
    ...(input.dailyJournals ?? []).map((entry) => entry.updatedAt),
    ...(input.sessions ?? []).map((session) => session.startedAt),
    ...(input.extraDates ?? [])
  ];

  for (const candidate of candidates) {
    if (!latest || candidate.getTime() > latest.getTime()) {
      latest = candidate;
    }
  }

  return latest;
}

export async function listAdminAnalyticsUsers(input: {
  startDate: string;
  endDate: string;
  username?: string;
  hasSavedJournal?: boolean;
  hasBoundaryInsufficient?: boolean;
  hasReopenedSession?: boolean;
}) {
  const { startAt, endExclusive } = getEntryDateRangeBounds(input.startDate, input.endDate);
  const matchedUserIds = new Set<string>();

  if (input.hasBoundaryInsufficient) {
    const boundaryUsers = await prisma.analyticsEvent.groupBy({
      by: ["userId"],
      where: {
        eventName: "interview_boundary_insufficient_shown",
        occurredAt: {
          gte: startAt,
          lt: endExclusive
        }
      }
    });
    boundaryUsers.forEach((row) => {
      if (row.userId) {
        matchedUserIds.add(row.userId);
      }
    });
  }

  if (input.hasReopenedSession) {
    const revisitedUsers = await prisma.analyticsEvent.groupBy({
      by: ["userId"],
      where: {
        eventName: "interview_session_reopened",
        occurredAt: {
          gte: startAt,
          lt: endExclusive
        }
      }
    });
    revisitedUsers.forEach((row) => {
      if (row.userId) {
        matchedUserIds.add(row.userId);
      }
    });
  }

  const users = await prisma.user.findMany({
    where: {
      ...((input.hasBoundaryInsufficient || input.hasReopenedSession)
        ? {
            id: {
              in: [...matchedUserIds]
            }
          }
        : {}),
      ...(input.username
        ? {
            username: {
              contains: input.username
            }
          }
        : {}),
      ...(input.hasSavedJournal
        ? {
            OR: [
              {
                joyEntries: {
                  some: {
                    status: "saved",
                    date: {
                      gte: startAt,
                      lt: endExclusive
                    }
                  }
                }
              },
              {
                dailyJournalEntries: {
                  some: {
                    status: "saved",
                    date: {
                      gte: startAt,
                      lt: endExclusive
                    }
                  }
                }
              }
            ]
          }
        : {})
    },
    select: {
      id: true,
      username: true,
      createdAt: true
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  if (!users.length) {
    return [];
  }

  const userIds = users.map((user) => user.id);
  const [joyEntries, dailyJournals, sessions, analyticsEvents] = await Promise.all([
    prisma.joyEntry.findMany({
      where: {
        userId: {
          in: userIds
        },
        date: {
          gte: startAt,
          lt: endExclusive
        }
      },
      select: {
        userId: true,
        status: true,
        updatedAt: true
      }
    }),
    prisma.dailyJournalEntry.findMany({
      where: {
        userId: {
          in: userIds
        },
        date: {
          gte: startAt,
          lt: endExclusive
        }
      },
      select: {
        userId: true,
        status: true,
        updatedAt: true
      }
    }),
    prisma.interviewSession.findMany({
      where: {
        userId: {
          in: userIds
        },
        entryDate: {
          gte: startAt,
          lt: endExclusive
        }
      },
      select: {
        userId: true,
        status: true,
        dimension: true,
        startedAt: true
      },
      orderBy: {
        startedAt: "desc"
      }
    }),
    prisma.analyticsEvent.findMany({
      where: {
        userId: {
          in: userIds
        },
        occurredAt: {
          gte: startAt,
          lt: endExclusive
        }
      },
      select: {
        userId: true,
        eventName: true,
        occurredAt: true
      },
      orderBy: {
        occurredAt: "desc"
      }
    })
  ]);

  const joyByUser = new Map<string, Array<(typeof joyEntries)[number]>>();
  const dailyByUser = new Map<string, Array<(typeof dailyJournals)[number]>>();
  const sessionsByUser = new Map<string, Array<(typeof sessions)[number]>>();
  const eventsByUser = new Map<string, Array<(typeof analyticsEvents)[number]>>();

  for (const entry of joyEntries) {
    const list = joyByUser.get(entry.userId) ?? [];
    list.push(entry);
    joyByUser.set(entry.userId, list);
  }

  for (const entry of dailyJournals) {
    const list = dailyByUser.get(entry.userId) ?? [];
    list.push(entry);
    dailyByUser.set(entry.userId, list);
  }

  for (const session of sessions) {
    const list = sessionsByUser.get(session.userId) ?? [];
    list.push(session);
    sessionsByUser.set(session.userId, list);
  }

  for (const event of analyticsEvents) {
    if (!event.userId) {
      continue;
    }

    const list = eventsByUser.get(event.userId) ?? [];
    list.push(event);
    eventsByUser.set(event.userId, list);
  }

  return users.map((user) => {
    const userEvents = eventsByUser.get(user.id) ?? [];
    const userJoyEntries = joyByUser.get(user.id) ?? [];
    const userDailyJournals = dailyByUser.get(user.id) ?? [];
    const userSessions = sessionsByUser.get(user.id) ?? [];
    const savedEntryCount = userJoyEntries.filter((entry) => entry.status === "saved").length;
    const savedDailyJournalCount = userDailyJournals.filter((entry) => entry.status === "saved").length;
    const latestActiveAt = getLatestAdminAnalyticsActivityAt({
      analyticsEvents: userEvents,
      joyEntries: userJoyEntries,
      dailyJournals: userDailyJournals,
      sessions: userSessions
    });

    const riskTags = new Set<string>();
    for (const event of userEvents) {
      if (event.eventName === "interview_boundary_insufficient_shown") {
        riskTags.add("boundary_insufficient");
      }

      if (event.eventName === "interview_session_reopened") {
        riskTags.add("return_visit");
      }
    }

    return {
      id: user.id,
      username: user.username,
      createdAt: user.createdAt,
      latestActiveAt,
      funnelStep: deriveAdminAnalyticsFunnelStep({
        analyticsEvents: userEvents,
        savedEntryCount,
        savedDailyJournalCount,
        hasDraftEntry: userJoyEntries.some((entry) => entry.status === "draft"),
        hasCompletedSession: userSessions.some((session) => session.status === "completed"),
        hasAnySession: userSessions.length > 0
      }),
      savedEntryCount,
      savedDailyJournalCount,
      riskTags: [...riskTags]
    };
  }).filter((user) => user.latestActiveAt !== null || !input.username);
}

export async function getAdminAnalyticsUserDetail(userId: string) {
  const [user, sessions, joyEntries, dailyJournals, scores, analyticsEvents] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        createdAt: true
      }
    }),
    prisma.interviewSession.findMany({
      where: { userId },
      select: {
        id: true,
        dimension: true,
        status: true,
        turnCount: true,
        entryDate: true,
        startedAt: true,
        completedAt: true,
        pausedAt: true
      },
      orderBy: {
        startedAt: "desc"
      }
    }),
    prisma.joyEntry.findMany({
      where: { userId },
      select: {
        id: true,
        sessionId: true,
        title: true,
        status: true,
        updatedAt: true,
        savedAt: true
      },
      orderBy: {
        updatedAt: "desc"
      }
    }),
    prisma.dailyJournalEntry.findMany({
      where: { userId },
      select: {
        id: true,
        date: true,
        title: true,
        status: true,
        updatedAt: true,
        savedAt: true
      },
      orderBy: {
        updatedAt: "desc"
      }
    }),
    prisma.dailyHappinessScore.findMany({
      where: { userId },
      select: {
        id: true,
        date: true,
        meaningScore: true,
        healthScore: true,
        virtueScore: true,
        autonomyScore: true,
        interestScore: true,
        skillScore: true,
        relationshipScore: true,
        livingConditionScore: true,
        updatedAt: true
      },
      orderBy: {
        date: "desc"
      }
    }),
    prisma.analyticsEvent.findMany({
      where: {
        userId
      },
      select: {
        eventName: true,
        occurredAt: true
      },
      orderBy: {
        occurredAt: "desc"
      }
    })
  ]);

  const recentActiveAt = getLatestAdminAnalyticsActivityAt({
    analyticsEvents,
    joyEntries,
    dailyJournals,
    sessions,
    extraDates: scores.map((score) => score.updatedAt)
  });
  const funnelStep = deriveAdminAnalyticsFunnelStep({
    analyticsEvents,
    savedEntryCount: joyEntries.filter((entry) => entry.status === "saved").length,
    savedDailyJournalCount: dailyJournals.filter((entry) => entry.status === "saved").length,
    hasDraftEntry: joyEntries.some((entry) => entry.status === "draft"),
    hasCompletedSession: sessions.some((session) => session.status === "completed"),
    hasAnySession: sessions.length > 0
  });

  return {
    user,
    recentActiveAt,
    funnelStep,
    scoreOverview: {
      scoreCount: scores.length,
      latestScoreDate: scores[0] ? formatEntryDate(scores[0].date) : null
    },
    sessions,
    joyEntries,
    dailyJournals,
    scores
  };
}

export async function getAdminAnalyticsSessionDetail(sessionId: string) {
  return findJoyInterviewSessionById(sessionId);
}

export async function getAdminAnalyticsEntryDetail(entryId: string) {
  return prisma.joyEntry.findUnique({
    where: { id: entryId },
    include: {
      session: {
        select: {
          dimension: true
        }
      }
    }
  });
}

export async function getAdminAnalyticsDailyJournalDetail(id: string) {
  return prisma.dailyJournalEntry.findUnique({
    where: { id }
  });
}
