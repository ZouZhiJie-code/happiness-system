/* Hallmark · pre-emit critique: P5 H5 E4 S5 R5 V4 */
/* Hallmark · genre: editorial · macrostructure: Workbench · design-system: DESIGN.md · designed-as-app */
"use client";

import Image from "next/image";
import { Menu } from "@base-ui/react/menu";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode
} from "react";

import { HomePageView } from "@/components/home/home-page-view";
import {
  INSIGHTS_DEMO_DATA,
  InsightsWorkspaceView
} from "@/components/insights";
import {
  EventCenteredDialogueWorkspaceView,
  EventCenteredStartWorkspaceView,
  type EventCenteredDialogueWorkspaceAction
} from "@/components/interview/event-centered/event-centered-dialogue-workspace-view";
import { EventCenteredSessionSidebar } from "@/components/interview/event-centered/event-centered-session-sidebar";
import { JournalWorkspaceFrame } from "@/components/journal/journal-workspace-frame";
import {
  JournalPeriodReportWorkspace,
  type JournalPeriodReportWorkspaceView
} from "@/components/journal/journal-period-report-workspace";
import {
  JournalDayWorkspaceView,
  type JournalDayArchiveItem,
  type JournalDayOriginalState,
  type JournalDayRecordEditDraft
} from "@/components/journal/journal-day-workspace";
import { SettingsPageView } from "@/components/settings/settings-page-view";
import {
  ActionButton,
  Field,
  FloatingComposer,
  InlineStatus,
  ReadingDocument,
  StatusAction,
  StatusBadge,
  Surface
} from "@/components/ui";
import { LegalPageView } from "@/app/legal/legal-page-view";
import type { EventCenteredWorkspaceSession } from "@/types/event-centered-dialogue";
import type { EventCenteredSessionListItem } from "@/types/event-centered-interview";
import type { JournalArchiveIndexView } from "@/types/journal-archive";
import type {
  JournalDailyEntryRecord,
  JournalDailyJournalView,
  JournalDailySourceEntry
} from "@/types/journal-daily-entry";

export const DAILY_LIGHT_VISUAL_REVIEW_SCREENS = [
  "foundation",
  "home",
  "auth",
  "interview-start",
  "interview-chat",
  "interview-complete",
  "day",
  "week",
  "month",
  "insights-trends",
  "insights-portrait",
  "insights-memories",
  "settings",
  "legal"
] as const;

export type DailyLightVisualReviewScreen = (typeof DAILY_LIGHT_VISUAL_REVIEW_SCREENS)[number];

export function isDailyLightVisualReviewScreen(value: string | null): value is DailyLightVisualReviewScreen {
  return Boolean(value && DAILY_LIGHT_VISUAL_REVIEW_SCREENS.includes(value as DailyLightVisualReviewScreen));
}

const SCREEN_LABELS: Record<DailyLightVisualReviewScreen, string> = {
  foundation: "设计基础",
  home: "首页",
  auth: "登录注册",
  "interview-start": "新记录",
  "interview-chat": "记录对话",
  "interview-complete": "记录完成",
  day: "日记",
  week: "周记",
  month: "月记",
  "insights-trends": "趋势",
  "insights-portrait": "画像",
  "insights-memories": "记忆",
  settings: "设置",
  legal: "法律页面"
};

const archiveRecords = [
  { time: "08:20", title: "忘带电脑，上午的节奏乱了", meta: "帮我记 · 已记下" },
  { time: "13:10", title: "和小周吃饭，被肯定了一下", meta: "陪我聊 · 已记下" },
  { time: "18:40", title: "下班前把拖了几天的事情做完了", meta: "帮我记 · 已记下" }
];

const visualDaySources: JournalDailySourceEntry[] = archiveRecords.map((record, index) => ({
  eventId: `visual-event-${index + 1}`,
  entryId: `visual-entry-${index + 1}`,
  entryDate: "2026-08-12",
  daySequence: index + 1,
  title: record.title,
  content: index === 0
    ? "出门后才发现电脑没带，只能折回去拿。上午的节奏因此被打乱。"
    : index === 1
      ? "午饭时听到一句肯定，我明显松了一口气。"
      : "下班前把拖了几天的事情做完，重新找回一点掌控感。",
  contentRevision: 1,
  savedRevision: 1,
  savedAt: `2026-08-12T${index === 0 ? "00:20" : index === 1 ? "05:10" : "10:40"}:00.000Z`,
  updatedAt: `2026-08-12T${index === 0 ? "00:20" : index === 1 ? "05:10" : "10:40"}:00.000Z`,
  recordedAt: `2026-08-12T${index === 0 ? "00:20" : index === 1 ? "05:10" : "10:40"}:00.000Z`,
  occurredAt: null,
  sourceMode: index === 1 ? "chat" : "capture",
  recordCount: 1,
  sourceMessageIds: [`visual-message-${index + 1}`]
}));

const completedInterviewSource: JournalDailySourceEntry = {
  eventId: "visual-event-completed",
  entryId: "visual-entry-completed",
  entryDate: "2026-08-12",
  daySequence: 4,
  title: "和妈妈通话后的复杂感受",
  content: "我知道她是在担心我，但反复被问工作稳不稳定时，还是感到自己的选择被检查，也不太想继续解释。",
  contentRevision: 1,
  savedRevision: 1,
  savedAt: "2026-08-12T13:28:00.000Z",
  updatedAt: "2026-08-12T13:28:00.000Z",
  recordedAt: "2026-08-12T13:28:00.000Z",
  occurredAt: null,
  sourceMode: "chat",
  recordCount: 2,
  sourceMessageIds: ["visual-user-one", "visual-user-two"]
};

const visualDayEntry: JournalDailyEntryRecord = {
  id: "visual-day-entry",
  entryDate: "2026-08-12",
  title: "今天的节奏被打乱，也重新找回了一点",
  content: "今天出门后才发现电脑没带，只能又折回去拿。到公司时已经有些慌，整个上午都很急，做事情也跟着乱了起来。\n\n中午和小周吃饭时，他说我昨天的方案结构挺清楚。听完这句话，我明显松了一口气，也意识到最近对自己的判断有些不稳定。\n\n下班前，我把拖了几天的事情做完了。今天的节奏虽然被打乱过，但我也重新找回了一点掌控感。",
  paragraphs: {
    schemaVersion: 1,
    paragraphs: visualDaySources.map((source) => ({ text: source.content, sourceRecordIds: [source.entryId] }))
  },
  status: "saved",
  sourceEntryIds: visualDaySources.map((source) => source.entryId),
  sourceEventIds: visualDaySources.map((source) => source.eventId),
  sourceSignature: "visual-day-signature",
  sourceSnapshot: { schemaVersion: 2, entryDate: "2026-08-12", sources: visualDaySources },
  sourceUpdatedAt: "2026-08-12T10:40:00.000Z",
  contentRevision: 1,
  savedRevision: 1,
  currentGenerationTraceId: null,
  lastGenerationErrorCode: null,
  editedAt: null,
  savedAt: "2026-08-12T11:00:00.000Z",
  createdAt: "2026-08-12T11:00:00.000Z",
  updatedAt: "2026-08-12T11:00:00.000Z"
};

const visualDayView: JournalDailyJournalView = {
  entryDate: "2026-08-12",
  savedSources: visualDaySources,
  legacyHistory: [],
  pendingSaveEntryIds: [],
  sourceSignature: "visual-day-signature",
  collection: { kind: "multiple_entries" },
  entry: visualDayEntry,
  freshness: "saved",
  displayStatus: "saved",
  latestGeneration: null,
  updateBlockedByPendingSource: false
};

const visualDayArchives: JournalDayArchiveItem[] = [
  { id: "day-12", entryDate: "2026-08-12", title: "今天的节奏被打乱，也重新找回了一点", displayStatus: "saved", selected: true },
  { id: "day-11", entryDate: "2026-08-11", title: "节奏被打乱，也重新找回一点", displayStatus: "saved" },
  { id: "day-10", entryDate: "2026-08-10", title: "把复杂的事情重新拆开", displayStatus: "saved" },
  { id: "day-09", entryDate: "2026-08-09", title: "今天想安静一点", displayStatus: "saved" }
];

function buildVisualArchive(view: "day" | "week" | "month"): JournalArchiveIndexView {
  if (view === "day") {
    return {
      kind: "day",
      selectedKey: "2026-08-12",
      monthDates: ["2026-08-09", "2026-08-10", "2026-08-11", "2026-08-12"],
      items: visualDayArchives.map((item) => ({
        key: item.entryDate,
        kind: "day",
        startDate: item.entryDate,
        endDate: item.entryDate,
        title: item.title,
        recordCount: item.entryDate === "2026-08-12" ? 4 : 2,
        displayStatus: item.displayStatus
      }))
    };
  }
  if (view === "week") {
    return {
      kind: "week",
      selectedKey: "2026-08-10",
      monthDates: [],
      items: [
        { key: "2026-08-10", kind: "week", startDate: "2026-08-10", endDate: "2026-08-16", title: "重新找回工作的节奏", recordCount: 5, displayStatus: "saved" },
        { key: "2026-08-03", kind: "week", startDate: "2026-08-03", endDate: "2026-08-09", title: "在变化里找到一点确定", recordCount: 4, displayStatus: "saved" },
        { key: "2026-07-27", kind: "week", startDate: "2026-07-27", endDate: "2026-08-02", title: null, recordCount: 3, displayStatus: "ungenerated" }
      ]
    };
  }
  return {
    kind: "month",
    selectedKey: "2026-08-01",
    monthDates: [],
    items: [
      { key: "2026-08-01", kind: "month", startDate: "2026-08-01", endDate: "2026-08-31", title: "逐渐找回自己的节奏", recordCount: 4, displayStatus: "saved" },
      { key: "2026-07-01", kind: "month", startDate: "2026-07-01", endDate: "2026-07-31", title: "慢慢把注意力放回自己", recordCount: 4, displayStatus: "saved" },
      { key: "2026-06-01", kind: "month", startDate: "2026-06-01", endDate: "2026-06-30", title: null, recordCount: 3, displayStatus: "ungenerated" }
    ]
  };
}

function buildInterviewSession(recordMode: "capture" | "chat" = "chat"): EventCenteredWorkspaceSession {
  if (recordMode === "capture") {
    return {
      mode: "event_centered",
      recordMode,
      rootSessionId: "visual-root",
      activeBranchSessionId: "visual-branch",
      eventId: "visual-event",
      branchStateId: "visual-state",
      entryDate: "2026-08-12",
      conversationSchemaVersion: 4,
      sessionStatus: "active",
      eventStatus: "active",
      latestMessageSequence: 2,
      journalEvent: {
        id: "visual-event",
        entryDate: "2026-08-12",
        daySequence: 4,
        status: "active",
        startedAt: "2026-08-12T13:15:00.000Z",
        generationStartedAt: null,
        completedAt: null,
        abandonedAt: null
      },
      messages: [
        {
          id: "visual-capture-opening",
          role: "assistant",
          content: "把想记下来的事说给我听。",
          rawText: "",
          sequence: 0,
          userTurnId: null,
          assistantPayload: {
            naturalUnderstanding: "",
            naturalResponse: "把想记下来的事说给我听。",
            responseKind: "opening",
            questionSpec: null,
            checkpoint: null,
            angleOutcome: null
          },
          responseVersion: null,
          createdAt: "2026-08-12T13:15:00.000Z"
        },
        {
          id: "visual-capture-user",
          role: "user",
          content: "今天和供应商确认了延期风险，也把新的交付日期同步给团队。",
          rawText: "今天和供应商确认了延期风险，也把新的交付日期同步给团队。",
          sequence: 1,
          userTurnId: "visual-capture-turn",
          assistantPayload: null,
          responseVersion: null,
          createdAt: "2026-08-12T13:17:00.000Z"
        },
        {
          id: "visual-capture-acknowledgement",
          role: "assistant",
          content: "好，这段已经记下了。",
          rawText: "",
          sequence: 2,
          userTurnId: null,
          assistantPayload: {
            naturalUnderstanding: "",
            naturalResponse: "好，这段已经记下了。",
            responseKind: "acknowledgement",
            questionSpec: null,
            checkpoint: null,
            angleOutcome: null
          },
          responseVersion: null,
          createdAt: "2026-08-12T13:18:00.000Z"
        }
      ],
      dialogue: {
        productScope: "thought_only",
        phase: "event_recording",
        activeAngle: null,
        questionOpportunityCount: 0,
        focusOptions: [],
        completedAngles: [],
        availableAngles: ["thought"],
        reopenedAngles: [],
        outcomes: [],
        checkpoint: null,
        allowedActions: ["reply", "exit_event"],
        progress: [
          { id: "record", label: "轻量记录", status: "current", percent: 100, detail: "原话已经保存" },
          { id: "reflect", label: "引导复盘", status: "upcoming", percent: 0, detail: "按需要继续" },
          { id: "deepen", label: "深入探索", status: "upcoming", percent: 0, detail: "按需要继续" }
        ]
      },
      recovery: { pendingTurn: null },
      journal: { status: "not_generated", entryId: null, eventStatus: "active" }
    };
  }
  return {
    mode: "event_centered",
    recordMode,
    rootSessionId: "visual-root",
    activeBranchSessionId: "visual-branch",
    eventId: "visual-event",
    branchStateId: "visual-state",
    entryDate: "2026-08-12",
    conversationSchemaVersion: 4,
    sessionStatus: "active",
    eventStatus: "active",
    latestMessageSequence: 5,
    journalEvent: {
      id: "visual-event",
      entryDate: "2026-08-12",
      daySequence: 4,
      status: "active",
      startedAt: "2026-08-12T13:15:00.000Z",
      generationStartedAt: null,
      completedAt: null,
      abandonedAt: null
    },
    messages: [
      {
        id: "visual-opening",
        role: "assistant",
        content: "晚上发生了什么？你可以从刚才最想记下的那个片段说起。",
        rawText: "",
        sequence: 1,
        userTurnId: null,
        assistantPayload: {
          naturalUnderstanding: "我在听。",
          naturalResponse: "晚上发生了什么？你可以从刚才最想记下的那个片段说起。",
          responseKind: "opening",
          questionSpec: {
            phase: "event_recording",
            angle: null,
            target: "事件锚点",
            opportunityNumber: 1,
            surfaceLevel: "open_anchor",
            anchorText: null,
            repairCount: 0
          },
          checkpoint: null,
          angleOutcome: null
        },
        responseVersion: null,
        createdAt: "2026-08-12T13:15:00.000Z"
      },
      {
        id: "visual-user-one",
        role: "user",
        content: "刚才和妈妈打电话，她一直问我工作稳定不稳定。我知道她是担心我，但听着还是有点烦。",
        rawText: "刚才和妈妈打电话，她一直问我工作稳定不稳定。我知道她是担心我，但听着还是有点烦。",
        sequence: 2,
        userTurnId: "visual-turn-one",
        assistantPayload: null,
        responseVersion: null,
        createdAt: "2026-08-12T13:17:00.000Z"
      },
      {
        id: "visual-assistant-two",
        role: "assistant",
        content: "你知道她是在关心你，但自己的选择反复被检查，让这份关心也带上了压力。她问到哪一句时，你最明显地感觉自己开始不耐烦了？",
        rawText: "",
        sequence: 3,
        userTurnId: null,
        generationTraceId: "visual-trace",
        assistantPayload: {
          naturalUnderstanding: "你知道她是在关心你，但自己的选择反复被检查，让这份关心也带上了压力。",
          naturalResponse: "她问到哪一句时，你最明显地感觉自己开始不耐烦了？",
          responseKind: "question",
          questionSpec: {
            phase: "guided_reflection",
            angle: "thought",
            target: "压力出现的时刻",
            opportunityNumber: 2,
            surfaceLevel: "concrete_anchor",
            anchorText: "工作稳定不稳定",
            repairCount: 0
          },
          checkpoint: null,
          angleOutcome: null
        },
        responseVersion: {
          groupId: "visual-response-group",
          version: 1,
          versionCount: 1,
          canRegenerate: true,
          canSwitch: false,
          versions: [
            {
              messageId: "visual-assistant-two",
              branchSessionId: "visual-branch",
              version: 1,
              active: true
            }
          ]
        },
        createdAt: "2026-08-12T13:18:00.000Z"
      },
      {
        id: "visual-user-two",
        role: "user",
        content: "她说“你这样一直换方向，以后怎么办”。我当时就不太想继续解释了。",
        rawText: "她说“你这样一直换方向，以后怎么办”。我当时就不太想继续解释了。",
        sequence: 4,
        userTurnId: "visual-turn-two",
        assistantPayload: null,
        responseVersion: null,
        createdAt: "2026-08-12T13:20:00.000Z"
      },
      {
        id: "visual-assistant-three",
        role: "assistant",
        content: "你能理解她的担心，也希望自己的选择得到尊重。那一刻你最想守住的是什么？",
        rawText: "",
        sequence: 5,
        userTurnId: null,
        generationTraceId: "visual-trace-latest",
        assistantPayload: {
          naturalUnderstanding: "你能理解她的担心，也希望自己的选择得到尊重。",
          naturalResponse: "那一刻你最想守住的是什么？",
          responseKind: "question",
          questionSpec: {
            phase: "guided_reflection",
            angle: "thought",
            target: "想守住的部分",
            opportunityNumber: 3,
            surfaceLevel: "open_anchor",
            anchorText: null,
            repairCount: 0
          },
          checkpoint: null,
          angleOutcome: null
        },
        responseVersion: {
          groupId: "visual-response-group-latest",
          version: 1,
          versionCount: 1,
          canRegenerate: true,
          canSwitch: false,
          versions: [{
            messageId: "visual-assistant-three",
            branchSessionId: "visual-branch",
            version: 1,
            active: true
          }]
        },
        createdAt: "2026-08-12T13:21:00.000Z"
      }
    ],
    dialogue: {
      productScope: "thought_only",
      phase: "guided_reflection",
      activeAngle: "thought",
      questionOpportunityCount: 2,
      focusOptions: [],
      completedAngles: [],
      availableAngles: ["thought"],
      reopenedAngles: [],
      outcomes: [],
      checkpoint: null,
      allowedActions: [
        "reply",
        "correct_understanding",
        "regenerate_response",
        "switch_response_version",
        "exit_event"
      ],
      progress: [
        { id: "record", label: "轻量记录", status: "complete", percent: 100, detail: "事情已经记下" },
        { id: "reflect", label: "引导复盘", status: "current", percent: 55, detail: "正在看见当时的感受和反应" },
        { id: "deepen", label: "深入探索", status: "upcoming", percent: 0, detail: "按需要继续" }
      ]
    },
    recovery: { pendingTurn: null },
    journal: { status: "not_generated", entryId: null, eventStatus: "active" }
  };
}

function buildPeriodView(kind: "week" | "month"): JournalPeriodReportWorkspaceView {
  if (kind === "week") {
    return {
      kind,
      periodLabel: "8月10日—8月16日",
      rangeLabel: "2026 年第 33 周",
      displayStatus: "saved",
      archives: [
        { id: "week-33", label: "8月10日—8月16日", rangeLabel: "本周", status: "saved", selected: true },
        { id: "week-32", label: "8月3日—8月9日", rangeLabel: "上一周", status: "saved" },
        { id: "week-31", label: "7月27日—8月2日", rangeLabel: "再上一周", status: "saved" }
      ],
      report: {
        id: "visual-week-report",
        title: "重新找回工作的节奏",
        content: "这周的状态有过几次明显起伏。周一因为忘带电脑而慌乱，后来我逐渐发现，真正消耗我的还有对“必须一直稳定”的要求。几次被肯定和把拖延任务完成，让我重新看到自己仍然有能力把节奏找回来。",
        contentRevision: 1,
        status: "saved",
        updatedLabel: "8月16日保存"
      },
      summary: null,
      metrics: [
        { label: "有记录的日子", value: "5 天" },
        { label: "本周记录", value: "11 条" },
        { label: "已保存日记", value: "4 篇" }
      ],
      sources: [
        { id: "day-10", kind: "daily_report", label: "周一 · 8月10日", title: "从慌乱里慢慢稳下来", excerpt: "忘带电脑打乱了上午，也让我看见自己对稳定的要求。", rangeLabel: "8月10日", startDate: "2026-08-10", endDate: "2026-08-10" },
        { id: "day-11", kind: "daily_report", label: "周二 · 8月11日", title: "节奏被打乱，也重新找回一点", excerpt: "一次肯定让我松了一口气。", rangeLabel: "8月11日", startDate: "2026-08-11", endDate: "2026-08-11" },
        { id: "day-12", kind: "event_card", label: "周三 · 8月12日", title: "和妈妈通话后的复杂感受", excerpt: "关心和压力同时存在。", rangeLabel: "8月12日", startDate: "2026-08-12", endDate: "2026-08-12" }
      ]
    };
  }

  return {
    kind,
    periodLabel: "2026年8月",
    rangeLabel: "8月1日—8月31日",
    displayStatus: "saved",
    archives: [
      { id: "month-8", label: "2026年8月", rangeLabel: "本月", status: "saved", selected: true },
      { id: "month-7", label: "2026年7月", rangeLabel: "上月", status: "saved" },
      { id: "month-6", label: "2026年6月", rangeLabel: "6月", status: "saved" }
    ],
    report: {
      id: "visual-month-report",
      title: "逐渐找回自己的节奏",
      content: "这个月里，我在工作推进、关系互动和休息之间反复调整。状态并不始终稳定，但我开始更快发现自己什么时候被打乱、什么时候需要停一下，也积累了几次把事情重新掌握住的经验。那些微小的肯定和完成感，正在慢慢改变我看待自己的方式。",
      contentRevision: 1,
      status: "saved",
      updatedLabel: "8月31日保存"
    },
    summary: null,
    metrics: [
      { label: "有记录的日子", value: "18 天" },
      { label: "本月记录", value: "28 条" },
      { label: "已保存周记", value: "3 篇" }
    ],
    sources: [
      { id: "week-1", kind: "weekly_report", label: "第一周", title: "在变化里找到一点确定", excerpt: "几件小事让我重新看见自己的判断。", rangeLabel: "8月1日—8月2日", startDate: "2026-08-01", endDate: "2026-08-02" },
      { id: "week-2", kind: "weekly_report", label: "第二周", title: "重新找回工作的节奏", excerpt: "从几次慌乱和完成里，慢慢找回掌控感。", rangeLabel: "8月3日—8月9日", startDate: "2026-08-03", endDate: "2026-08-09" },
      { id: "week-3", kind: "weekly_report", label: "第三周", title: "让休息真正成为休息", excerpt: "开始更早察觉自己的疲惫。", rangeLabel: "8月10日—8月16日", startDate: "2026-08-10", endDate: "2026-08-16" }
    ]
  };
}

function FoundationVisualReview() {
  const [statusBusy, setStatusBusy] = useState(false);

  return (
    <Surface
      as="main"
      className="min-h-0 flex-1 overflow-y-auto rounded-none border-x-0 border-t-0 bg-[var(--color-canvas)] px-6 py-8 md:px-10"
    >
      <div className="mx-auto w-full max-w-[72rem]">
        <header className="max-w-[46rem]">
          <p className="text-[13px] font-semibold text-[var(--color-action)]">确认一 · 设计基础</p>
          <h1 className="mt-3 text-balance text-[32px] font-semibold leading-tight text-[var(--color-ink)]">
            一套稳定、清楚的记录语言
          </h1>
          <p className="mt-3 text-pretty text-[15px] leading-7 text-[var(--color-muted)]">
            这一页集中核对色彩、字体、动作、状态、输入、消息和阅读面。
          </p>
        </header>

        <section className="mt-10 border-y border-[var(--line-soft)] py-7" aria-labelledby="foundation-colors">
          <h2 id="foundation-colors" className="text-[20px] font-semibold text-[var(--color-ink)]">基础色与文字层级</h2>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ["画布", "var(--color-canvas)"],
              ["工作区", "var(--color-workspace)"],
              ["内容面", "var(--color-content)"],
              ["侧栏", "var(--color-sidebar)"],
              ["主动作", "var(--color-action)"]
            ].map(([label, color]) => (
              <li key={label} className="flex min-h-16 items-center gap-3 rounded-[var(--radius-control)] px-2">
                <span className="size-11 rounded-[var(--radius-control)] border border-[var(--line-soft)]" style={{ backgroundColor: color }} aria-hidden="true" />
                <span className="text-[13px] font-medium text-[var(--color-ink)]">{label}</span>
              </li>
            ))}
          </ul>
        </section>

        <div className="grid gap-10 py-9 lg:grid-cols-2">
          <section aria-labelledby="foundation-actions">
            <h2 id="foundation-actions" className="text-[20px] font-semibold text-[var(--color-ink)]">动作与状态</h2>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <ActionButton variant="primary">主要动作</ActionButton>
              <ActionButton variant="secondary">次要动作</ActionButton>
              <ActionButton variant="ghost">轻量动作</ActionButton>
              <StatusBadge tone="success">已保存</StatusBadge>
              <StatusBadge tone="warning">草稿</StatusBadge>
              <StatusAction
                statusLabel="需更新"
                actionLabel="更新日记"
                busyLabel="正在更新"
                busy={statusBusy}
                onClick={() => {
                  setStatusBusy(true);
                  window.setTimeout(() => setStatusBusy(false), 900);
                }}
              />
            </div>
            <div className="mt-5">
              <InlineStatus
                tone="error"
                title="这次保存还没完成"
                action={<ActionButton variant="ghost">重新尝试</ActionButton>}
              >
                输入内容仍然保留，可以直接继续。
              </InlineStatus>
            </div>
          </section>

          <section aria-labelledby="foundation-field">
            <h2 id="foundation-field" className="text-[20px] font-semibold text-[var(--color-ink)]">字段与错误</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="记录标题" defaultValue="和妈妈通话后的感受" description="可以继续修改" />
              <Field label="日期" type="date" defaultValue="2026-08-13" error="请选择今天或过去的日期" />
            </div>
          </section>
        </div>

        <section className="border-t border-[var(--line-soft)] py-9" aria-labelledby="foundation-conversation">
          <h2 id="foundation-conversation" className="text-[20px] font-semibold text-[var(--color-ink)]">消息与悬浮输入</h2>
          <div className="mt-5 max-w-[70rem] bg-[var(--color-workspace)] p-5">
            <div className="flex justify-start">
              <p className="max-w-[48rem] rounded-[var(--radius-card)] bg-[var(--color-content)] px-4 py-3 text-[15px] leading-[26px]">
                听起来，你知道她是在担心你，同时也感到自己的选择被反复检查。
              </p>
            </div>
            <div className="mt-2 flex justify-start">
              <p className="max-w-[48rem] rounded-[var(--radius-card)] bg-[var(--color-content)] px-4 py-3 text-[15px] leading-[26px]">
                她说到哪一句时，你开始不想再解释了？
              </p>
            </div>
            <div className="mt-3 flex justify-end">
              <p className="max-w-[44rem] rounded-[var(--radius-card)] bg-[var(--workspace-sidebar-selected)] px-4 py-3 text-[15px] leading-[26px]">
                她问我以后到底怎么办的时候。
              </p>
            </div>
            <FloatingComposer className="mt-8" actions={<ActionButton variant="primary">发送</ActionButton>}>
              <textarea aria-label="视觉稿输入示例" rows={1} placeholder="继续说说…" className="min-h-11 w-full resize-none bg-transparent px-1 py-2 text-[15px] outline-none" />
            </FloatingComposer>
          </div>
        </section>

        <section className="border-t border-[var(--line-soft)] py-9" aria-labelledby="foundation-reading">
          <h2 id="foundation-reading" className="sr-only">统一阅读面</h2>
          <ReadingDocument
            title="8月13日 星期四"
            headingAs="h2"
            meta="今日日记"
            status={<StatusBadge tone="stale">需更新</StatusBadge>}
            actions={<ActionButton variant="secondary">编辑日记</ActionButton>}
            sources={<details><summary className="cursor-pointer text-[13px] font-medium">查看来源</summary></details>}
          >
            <p>今天把一条断开的链路重新接了起来。真正让我松一口气的，是刷新之后仍然能看到刚刚保存的内容。</p>
          </ReadingDocument>
        </section>
      </div>
    </Surface>
  );
}

function AuthVisualReview({ onComplete }: { onComplete: () => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");

  return (
    <main className="grid min-h-0 flex-1 place-items-center overflow-y-auto bg-[var(--color-canvas)] px-5 py-10">
      <section className="w-full max-w-[30rem] rounded-[var(--radius-shell)] border border-[var(--line-soft)] bg-[var(--color-workspace)] p-6 md:p-8">
        <p className="text-[13px] font-semibold text-[var(--color-action)]">Daily Light</p>
        <h1 className="mt-3 text-balance text-[32px] font-semibold leading-tight">
          {mode === "login" ? "欢迎回来" : "创建账户"}
        </h1>
        <p className="mt-2 text-pretty text-[15px] leading-7 text-[var(--color-muted)]">
          完成后会进入记录工作台；从具体页面到来时会返回原页面。
        </p>
        <div className="mt-6 grid grid-cols-2 rounded-[var(--radius-control)] bg-[var(--color-sidebar)] p-1" aria-label="登录或注册">
          {(["login", "register"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setMode(item)}
              aria-pressed={mode === item}
              className={`min-h-11 rounded-[var(--radius-control)] px-4 text-[14px] ${mode === item ? "bg-[var(--color-content)] font-semibold" : "text-[var(--color-muted)]"}`}
            >
              {item === "login" ? "登录" : "注册"}
            </button>
          ))}
        </div>
        <form
          className="mt-6 grid gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            onComplete();
          }}
        >
          <Field label="用户名" name="username" autoComplete="username" defaultValue="daily_light" required />
          <Field label="密码" name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} defaultValue="daily-light-demo" required />
          <ActionButton type="submit" variant="primary" className="w-full">
            {mode === "login" ? "登录并开始记录" : "创建账户并开始记录"}
          </ActionButton>
        </form>
      </section>
    </main>
  );
}

function SettingsVisualReview({ onLegal }: { onLegal: () => void }) {
  const [notice, setNotice] = useState<string | null>(null);
  return (
    <div
      className="min-h-0 flex-1 overflow-y-auto"
      onClickCapture={(event: ReactMouseEvent<HTMLDivElement>) => {
        const target = event.target as HTMLElement;
        if (target.closest('a[href^="/legal/"]')) {
          event.preventDefault();
          onLegal();
        }
      }}
    >
      <SettingsPageView
        username="daily_light"
        accountActions={(
          <div className="flex flex-wrap gap-3">
            <ActionButton variant="ghost" onClick={() => setNotice("视觉稿：已打开删除确认")}>删除账号</ActionButton>
          </div>
        )}
      />
      {notice ? (
        <div role="status" className="fixed inset-x-0 top-[calc(var(--site-header-viewport-offset)+1rem)] z-50 mx-auto w-fit rounded-[var(--radius-control)] bg-[var(--toast-surface)] px-4 py-3 text-[13px] text-[var(--toast-text)]">
          {notice}
        </div>
      ) : null}
    </div>
  );
}

function LegalVisualReview({ onSettings }: { onSettings: () => void }) {
  return (
    <div
      className="min-h-0 flex-1 overflow-y-auto"
      onClickCapture={(event) => {
        const target = event.target as HTMLElement;
        if (target.closest('a[href="/settings"]')) {
          event.preventDefault();
          onSettings();
        }
      }}
    >
      <LegalPageView
        title="隐私政策"
        updatedAt="2026年8月13日"
        lead="这份说明介绍 Daily Light 会保存哪些信息、怎样使用这些信息，以及你如何删除账号和个人数据。"
        sections={[
          { title: "保存哪些内容", body: "我们会保存你主动提交的账户信息、记录、日记，以及维持登录、保存和恢复功能所需的信息。" },
          { title: "怎样使用这些内容", body: "你的内容用于继续记录、整理日记、恢复未完成内容和提供回看。" },
          { title: "删除账号和数据", body: "你可以在设置中删除账号。确认后，与账号关联的个人内容会一起删除。" }
        ]}
      />
    </div>
  );
}

function replaceScreenInUrl(screen: DailyLightVisualReviewScreen, clean: boolean) {
  const url = new URL(window.location.href);
  url.searchParams.set("screen", screen);
  if (clean) url.searchParams.set("clean", "1");
  window.history.replaceState(null, "", url);
}

function VisualReviewHeader({
  screen,
  recordMode,
  onScreenChange
}: {
  screen: DailyLightVisualReviewScreen;
  recordMode: "capture" | "chat" | null;
  onScreenChange: (screen: DailyLightVisualReviewScreen) => void;
}) {
  const activeArea = screen.startsWith("interview")
    ? "record"
    : screen === "day" || screen === "week" || screen === "month"
      ? "journal"
      : screen.startsWith("insights")
        ? "insights"
        : null;
  const navigation = [
    { key: "record", label: "记录", screen: "interview-start" as const },
    { key: "journal", label: "日记", screen: "day" as const },
    { key: "insights", label: "认识自己", screen: "insights-trends" as const }
  ];

  return (
    <header className="grid min-h-16 shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 border-b border-[var(--line-soft)] bg-[var(--color-workspace)] px-4 font-ui md:px-6">
      <div className="flex items-center gap-4 md:gap-7">
        <button
          type="button"
          className="flex min-h-11 items-center gap-2.5 rounded-[var(--radius-control)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--paper-deep)]"
          onClick={() => onScreenChange("home")}
        >
          <Image src="/brand/happiness-logo.png" alt="" width={36} height={36} className="size-9 rounded-[var(--radius-control)] object-cover" />
          <span className="hidden font-display text-xl font-semibold text-[var(--text-main)] sm:inline">Daily Light</span>
        </button>
        <nav aria-label="视觉稿主导航" className="flex items-center gap-0.5 sm:gap-1">
          {navigation.map((item) => (
            <button
              key={item.key}
              type="button"
              aria-current={activeArea === item.key ? "page" : undefined}
              onClick={() => onScreenChange(item.screen)}
              className={`relative min-h-11 rounded-[var(--radius-control)] px-2 text-[13px] font-medium after:absolute after:inset-x-2 after:bottom-1 after:h-0.5 after:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-action)] sm:px-3 sm:text-[15px] ${activeArea === item.key ? "font-semibold text-[var(--text-main)] after:bg-[var(--color-action)]" : "text-[var(--text-dim)] after:bg-transparent"}`}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex min-w-0 items-center justify-center">
        {screen === "interview-chat" && recordMode === "capture" ? (
          <div className="flex min-w-0 items-baseline justify-center gap-2" aria-label="原话已保存">
            <strong className="whitespace-nowrap text-[13px] text-[var(--text-main)]">原话已保存</strong>
            <span className="hidden truncate text-[13px] text-[var(--text-dim)] lg:inline">可以继续补充，也可以完成记录</span>
          </div>
        ) : screen === "interview-chat" ? (
          <div className="flex w-full max-w-[340px] items-center gap-3" aria-label="访谈进度，第 2 阶段，约 55%">
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <strong className="whitespace-nowrap text-[13px] text-[var(--text-main)]">第 2 / 3 阶段 · 复盘</strong>
                <span className="hidden truncate text-[13px] text-[var(--text-dim)] xl:inline">正在回看当时的感受和反应</span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2" aria-hidden="true">
                <span className="h-1 rounded-full bg-[var(--paper-deep)]" />
                <span className="h-1 overflow-hidden rounded-full bg-[var(--line-soft)]"><span className="block h-full w-1/2 rounded-full bg-[var(--paper-deep)]" /></span>
                <span className="h-1 rounded-full bg-[var(--line-soft)]" />
              </div>
            </div>
            <span className="whitespace-nowrap text-[13px] tabular-nums text-[var(--text-dim)]">约 55%</span>
          </div>
        ) : activeArea === "record" ? (
          <p className="text-[13px] text-[var(--text-dim)]">8月12日 · 星期三</p>
        ) : <span aria-hidden="true" />}
      </div>

      <div className="flex items-center gap-3">
        {screen === "interview-chat" ? (
          <button
            type="button"
            onClick={() => onScreenChange("interview-complete")}
            className="min-h-11 rounded-[var(--radius-control)] border border-[var(--line-strong)] px-4 text-[13px] font-semibold text-[var(--text-main)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--paper-deep)]"
          >
            完成记录
          </button>
        ) : null}
        <Menu.Root>
          <Menu.Trigger
            className="grid size-11 place-items-center rounded-[var(--radius-control)] border border-[var(--line-soft)] bg-[var(--color-content)] text-[15px] font-semibold text-[var(--text-main)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-action)]"
            aria-label="打开账户菜单"
          >
            我
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner className="ui-account-menu__positioner" sideOffset={8} align="end" collisionPadding={12}>
              <Menu.Popup className="ui-account-menu__popup" aria-label="账户菜单">
                <Menu.Item className="ui-account-menu__item" onClick={() => onScreenChange("settings")}>设置</Menu.Item>
                <Menu.Item className="ui-account-menu__item" onClick={() => onScreenChange("legal")}>隐私政策</Menu.Item>
                <Menu.Item className="ui-account-menu__item" onClick={() => onScreenChange("legal")}>用户协议</Menu.Item>
                <Menu.Separator className="ui-account-menu__separator" />
                <Menu.Item className="ui-account-menu__item ui-account-menu__item--danger" onClick={() => onScreenChange("home")}>退出登录</Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </div>
    </header>
  );
}

function ReviewSwitcher({
  screen,
  onScreenChange
}: {
  screen: DailyLightVisualReviewScreen;
  onScreenChange: (screen: DailyLightVisualReviewScreen) => void;
}) {
  return (
    <nav aria-label="视觉验收页面" className="flex shrink-0 items-center justify-center gap-1 overflow-x-auto bg-[var(--text-main)] p-1.5 font-ui">
      {DAILY_LIGHT_VISUAL_REVIEW_SCREENS.map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => onScreenChange(item)}
          aria-current={screen === item ? "page" : undefined}
          className={`min-h-11 whitespace-nowrap rounded-[var(--radius-control)] px-3 text-[13px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--paper-main)] ${screen === item ? "bg-[var(--paper-main)] text-[var(--text-main)]" : "text-[var(--paper-soft)] hover:bg-[var(--header-surface)]"}`}
        >
          {SCREEN_LABELS[item]}
        </button>
      ))}
    </nav>
  );
}

export function DailyLightVisualReview({
  initialScreen = "interview-start",
  clean = false
}: {
  initialScreen?: DailyLightVisualReviewScreen;
  clean?: boolean;
}) {
  const [screen, setScreen] = useState<DailyLightVisualReviewScreen>(initialScreen);
  const [pendingMode, setPendingMode] = useState<"capture" | "chat" | null>(null);
  const [selectedMode, setSelectedMode] = useState<"capture" | "chat" | null>(
    initialScreen === "interview-start" ? null : "chat"
  );
  const [rootRecordMode, setRootRecordMode] = useState<"capture" | "chat" | null>(
    initialScreen === "interview-start" ? null : "chat"
  );
  const [activeTabId, setActiveTabId] = useState("visual-root");
  const [composerDraft, setComposerDraft] = useState("");
  const [extraMessages, setExtraMessages] = useState<EventCenteredWorkspaceSession["messages"]>([]);
  const [streamPreview, setStreamPreview] = useState<{ phase: string | null; summary: string; response: string } | null>(null);
  const [regenerations, setRegenerations] = useState<Record<string, "simplify" | "concretize" | "change_angle">>({});
  const [eventSaved, setEventSaved] = useState(false);
  const [dayUpdated, setDayUpdated] = useState(false);
  const [dailyEdit, setDailyEdit] = useState<{ title: string; content: string } | null>(null);
  const [savedDailyDraft, setSavedDailyDraft] = useState({ title: visualDayEntry.title, content: visualDayEntry.content });
  const [editedDaySources, setEditedDaySources] = useState<Record<string, { title: string; content: string }>>({});
  const [originals, setOriginals] = useState<Record<string, JournalDayOriginalState>>({});
  const [recordEdit, setRecordEdit] = useState<JournalDayRecordEditDraft | null>(null);
  const [recordAutosaveStatus, setRecordAutosaveStatus] = useState<"idle" | "pending" | "saved">("idle");
  const [previewToast, setPreviewToast] = useState<string | null>(null);
  const [selectedPeriodArchiveId, setSelectedPeriodArchiveId] = useState<Record<"week" | "month", string>>({
    week: "week-33",
    month: "month-8"
  });
  const [savedPeriodCopies, setSavedPeriodCopies] = useState<Partial<Record<"week" | "month", { title: string; content: string }>>>({});
  const timersRef = useRef<number[]>([]);
  const messageNumberRef = useRef(0);

  const clearPreviewTimers = () => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
  };

  useEffect(() => clearPreviewTimers, []);

  const session = useMemo(() => {
    const base = buildInterviewSession(selectedMode ?? "chat");
    const applyRegeneration = (message: EventCenteredWorkspaceSession["messages"][number]) => {
      const intent = regenerations[message.id];
      if (!intent || !message.assistantPayload) return message;
      const regeneratedCopy = intent === "simplify"
        ? {
            understanding: "你知道妈妈是在担心你，但这些追问也让你感到有压力。",
            question: "她说到哪一句时，你开始不想再解释了？"
          }
        : intent === "concretize"
          ? {
              understanding: "她反复问工作稳不稳定时，你感觉自己的选择像是在被检查。",
              question: "听到“以后怎么办”那一刻，你身体或脑子里最先出现了什么反应？"
            }
          : {
              understanding: "这通电话里同时有她的担心，也有你想守住自己选择的需要。",
              question: "如果先不谈工作，你更希望她在这通电话里怎样回应你？"
            };
      return {
        ...message,
        content: `${regeneratedCopy.understanding}${regeneratedCopy.question}`,
        assistantPayload: {
          ...message.assistantPayload,
          naturalUnderstanding: regeneratedCopy.understanding,
          naturalResponse: regeneratedCopy.question
        }
      };
    };
    const messages = [...base.messages, ...extraMessages].map(applyRegeneration);
    const completed = screen === "interview-complete";
    return {
      ...base,
      rootSessionId: activeTabId,
      recordMode: selectedMode ?? "chat",
      sessionStatus: completed ? "completed" as const : "active" as const,
      eventStatus: completed ? "completed" as const : "active" as const,
      journalEvent: base.journalEvent ? {
        ...base.journalEvent,
        status: completed ? "completed" as const : "active" as const,
        completedAt: completed ? "2026-08-12T13:28:00.000Z" : null
      } : null,
      latestMessageSequence: base.latestMessageSequence + extraMessages.length,
      messages,
      dialogue: completed ? { ...base.dialogue, allowedActions: [] } : base.dialogue,
      journal: completed
        ? { status: "saved" as const, entryId: "visual-entry-completed", eventStatus: "completed" as const }
        : base.journal
    };
  }, [activeTabId, extraMessages, regenerations, screen, selectedMode]);

  const interviewSidebarItems = useMemo<EventCenteredSessionListItem[]>(() => {
    const completedCurrent = screen === "interview-complete";
    const items: EventCenteredSessionListItem[] = [
      {
        rootSessionId: "visual-existing",
        entryDate: "2026-08-12",
        recordMode: "capture",
        title: "下班前把拖了几天的事情做完了",
        startedAt: "2026-08-12T10:40:00.000Z",
        lastActivityAt: "2026-08-12T10:42:00.000Z",
        lifecycle: "unfinished",
        hasUserMessage: true,
        readOnly: false
      },
      {
        rootSessionId: "visual-record-two",
        entryDate: "2026-08-12",
        recordMode: "chat",
        title: "和小周吃饭，被肯定了一下",
        startedAt: "2026-08-12T05:10:00.000Z",
        lastActivityAt: "2026-08-12T05:18:00.000Z",
        lifecycle: "completed",
        hasUserMessage: true,
        readOnly: true
      },
      {
        rootSessionId: "visual-record-yesterday",
        entryDate: "2026-08-11",
        recordMode: "capture",
        title: "把复杂的事情重新拆开",
        startedAt: "2026-08-11T11:10:00.000Z",
        lastActivityAt: "2026-08-11T11:16:00.000Z",
        lifecycle: "completed",
        hasUserMessage: true,
        readOnly: true
      }
    ];
    if (screen !== "interview-start") {
      items.unshift({
        rootSessionId: "visual-root",
        entryDate: "2026-08-12",
        recordMode: rootRecordMode ?? "chat",
        title: rootRecordMode === "capture"
          ? "确认延期后的交付安排"
          : "和妈妈通话后的复杂感受",
        startedAt: "2026-08-12T13:15:00.000Z",
        lastActivityAt: "2026-08-12T13:28:00.000Z",
        lifecycle: completedCurrent ? "completed" : "unfinished",
        hasUserMessage: true,
        readOnly: completedCurrent
      });
    }
    return items;
  }, [rootRecordMode, screen]);
  const unfinishedInterviewCount = interviewSidebarItems.filter((item) =>
    item.lifecycle === "blank" || item.lifecycle === "unfinished"
  ).length;

  const dayView = useMemo<JournalDailyJournalView>(() => {
    const includeCompletedEvent = eventSaved;
    const completedSource = selectedMode === "capture"
      ? {
          ...completedInterviewSource,
          title: "确认延期后的交付安排",
          content: "今天和供应商确认了延期风险，也把新的交付日期同步给团队。",
          sourceMode: "capture" as const,
          recordCount: 1,
          sourceMessageIds: ["visual-capture-user"]
        }
      : completedInterviewSource;
    const sources = (includeCompletedEvent
      ? [...visualDaySources, completedSource]
      : visualDaySources).map((source) => editedDaySources[source.entryId]
        ? { ...source, ...editedDaySources[source.entryId], contentRevision: source.contentRevision + 1 }
        : source);
    const entry = {
      ...visualDayEntry,
      title: savedDailyDraft.title,
      content: dayUpdated && includeCompletedEvent
        ? selectedMode === "capture"
          ? `${savedDailyDraft.content}\n\n今天和供应商确认了延期风险，也把新的交付日期同步给团队。`
          : `${savedDailyDraft.content}\n\n和妈妈通话后，我更清楚地看到：我能理解她的担心，也需要自己的选择被尊重。`
        : savedDailyDraft.content
    };
    return {
      ...visualDayView,
      savedSources: sources,
      legacyHistory: [],
      entry,
      sourceSignature: includeCompletedEvent ? "visual-day-signature-with-completed-event" : visualDayView.sourceSignature,
      displayStatus: includeCompletedEvent && !dayUpdated ? "stale" : "saved",
      freshness: includeCompletedEvent && !dayUpdated ? "stale" : "saved"
    };
  }, [dayUpdated, editedDaySources, eventSaved, savedDailyDraft.content, savedDailyDraft.title, selectedMode]);


  const activePeriodView = useMemo(() => {
    if (screen !== "week" && screen !== "month") return null;
    const base = buildPeriodView(screen);
    const savedCopy = savedPeriodCopies[screen];
    return {
      ...base,
      report: base.report && savedCopy ? { ...base.report, ...savedCopy } : base.report,
      archives: base.archives.map((item) => ({
        ...item,
        selected: item.id === selectedPeriodArchiveId[screen]
      }))
    };
  }, [savedPeriodCopies, screen, selectedPeriodArchiveId]);

  function schedule(callback: () => void, delay: number) {
    const timer = window.setTimeout(callback, delay);
    timersRef.current.push(timer);
  }

  function changeScreen(next: DailyLightVisualReviewScreen) {
    clearPreviewTimers();
    if (next === "interview-complete") {
      setEventSaved(true);
      setStreamPreview(null);
    }
    if (next === "interview-start") {
      setSelectedMode(null);
      setRootRecordMode(null);
      setComposerDraft("");
      setExtraMessages([]);
      setStreamPreview(null);
      setRegenerations({});
      setActiveTabId("visual-root");
    } else if (next === "interview-chat" && !selectedMode) {
      const nextMode = rootRecordMode ?? "chat";
      setSelectedMode(nextMode);
      setRootRecordMode(nextMode);
    }
    setScreen(next);
    setPendingMode(null);
    setPreviewToast(null);
    replaceScreenInUrl(next, clean);
  }

  function startInterview(mode: "capture" | "chat") {
    setPendingMode(mode);
    setSelectedMode(mode);
    setRootRecordMode(mode);
    setActiveTabId("visual-root");
    schedule(() => {
      setScreen("interview-chat");
      setPendingMode(null);
      replaceScreenInUrl("interview-chat", clean);
    }, 450);
  }

  function appendGeneratedReply(rawText: string) {
    messageNumberRef.current += 1;
    const suffix = messageNumberRef.current;
    const sequence = session.latestMessageSequence + 1;
    setExtraMessages((current) => [
      ...current,
      {
        id: `visual-local-user-${suffix}`,
        role: "user",
        content: rawText,
        rawText,
        sequence,
        userTurnId: `visual-local-turn-${suffix}`,
        clientTurnId: `visual-local-client-${suffix}`,
        assistantPayload: null,
        responseVersion: null,
        createdAt: new Date().toISOString()
      }
    ]);
    setStreamPreview({ phase: "sending", summary: "", response: "" });
    if (selectedMode === "capture") {
      schedule(() => setStreamPreview({
        phase: "responding",
        summary: "",
        response: "好，这段已经记下了。"
      }), 260);
      schedule(() => {
        setExtraMessages((current) => [
          ...current,
          {
            id: `visual-local-assistant-${suffix}`,
            role: "assistant",
            content: "好，这段已经记下了。",
            rawText: "",
            sequence: sequence + 1,
            userTurnId: null,
            assistantPayload: {
              naturalUnderstanding: "",
              naturalResponse: "好，这段已经记下了。",
              responseKind: "acknowledgement",
              questionSpec: null,
              checkpoint: null,
              angleOutcome: null
            },
            responseVersion: null,
            createdAt: new Date().toISOString()
          }
        ]);
        setStreamPreview(null);
      }, 620);
      return;
    }
    schedule(() => setStreamPreview({
      phase: "understanding",
      summary: "你一边理解她是在担心你，一边也感到自己的选择又被拿出来检查。",
      response: ""
    }), 260);
    schedule(() => setStreamPreview({
      phase: "responding",
      summary: "你一边理解她是在担心你，一边也感到自己的选择又被拿出来检查。",
      response: "当你不想再解释时，你更想保护的是自己的哪一部分？"
    }), 720);
    schedule(() => {
      setExtraMessages((current) => [
        ...current,
        {
          id: `visual-local-assistant-${suffix}`,
          role: "assistant",
          content: "你一边理解她是在担心你，一边也感到自己的选择又被拿出来检查。当你不想再解释时，你更想保护的是自己的哪一部分？",
          rawText: "",
          sequence: sequence + 1,
          userTurnId: null,
          generationTraceId: `visual-local-trace-${suffix}`,
          assistantPayload: {
            naturalUnderstanding: "你一边理解她是在担心你，一边也感到自己的选择又被拿出来检查。",
            naturalResponse: "当你不想再解释时，你更想保护的是自己的哪一部分？",
            responseKind: "question",
            questionSpec: {
              phase: "guided_reflection",
              angle: "thought",
              target: "想保护的部分",
              opportunityNumber: 3 + suffix,
              surfaceLevel: "open_anchor",
              anchorText: null,
              repairCount: 0
            },
            checkpoint: null,
            angleOutcome: null
          },
          responseVersion: {
            groupId: `visual-local-group-${suffix}`,
            version: 1,
            versionCount: 1,
            canRegenerate: true,
            canSwitch: false,
            versions: [{
              messageId: `visual-local-assistant-${suffix}`,
              branchSessionId: "visual-branch",
              version: 1,
              active: true
            }]
          },
          createdAt: new Date().toISOString()
        }
      ]);
      setStreamPreview(null);
    }, 1180);
  }

  function handleInterviewAction(action: EventCenteredDialogueWorkspaceAction) {
    if (action.action === "reply") {
      appendGeneratedReply(action.rawText);
      return;
    }
    if (action.action === "regenerate_response") {
      const intent = action.regenerationIntent;
      if (intent === "simplify" || intent === "concretize" || intent === "change_angle") {
        setRegenerations((current) => ({ ...current, [action.targetMessageId]: intent }));
      }
      return;
    }
    if (action.action === "exit_event") changeScreen("interview-complete");
  }

  function selectPreviewInterviewSession(rootSessionId: string) {
    const selected = interviewSidebarItems.find((item) => item.rootSessionId === rootSessionId);
    if (!selected) return;
    setActiveTabId(rootSessionId);
    setSelectedMode(selected.recordMode);
    if (selected.lifecycle === "completed" || selected.lifecycle === "abandoned") {
      setEventSaved(true);
      setScreen("interview-complete");
      return;
    }
    setScreen("interview-chat");
  }

  const renderInterviewWorkspace = (content: ReactNode) => (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <EventCenteredSessionSidebar
        items={interviewSidebarItems}
        activeSessionId={screen === "interview-start" ? null : activeTabId}
        unfinishedCount={unfinishedInterviewCount}
        unfinishedLimit={2}
        busy={Boolean(pendingMode)}
        onNew={() => {
          if (unfinishedInterviewCount < 2) changeScreen("interview-start");
        }}
        onLimitReached={() => {
          setPreviewToast("你还有 2 条记录没有完成，先完成其中一条，再新建记录。");
          schedule(() => setPreviewToast(null), 3_000);
        }}
        onSelect={selectPreviewInterviewSession}
      />
      <div className="flex min-w-0 min-h-0 flex-1 flex-col">{content}</div>
    </div>
  );

  return (
    <div data-daily-light-visual-review className="fixed inset-0 z-50 flex min-h-0 flex-col overflow-hidden bg-[var(--paper-main)] text-[var(--text-main)]">
      <VisualReviewHeader screen={screen} recordMode={selectedMode} onScreenChange={changeScreen} />
      <div className="flex min-h-0 flex-1 flex-col">
        {screen === "foundation" ? <FoundationVisualReview /> : null}
        {screen === "home" ? (
          <div
            className="min-h-0 flex-1 overflow-y-auto"
            onClickCapture={(event) => {
              const target = event.target as HTMLElement;
              if (target.closest('a[href^="/interview"]')) {
                event.preventDefault();
                changeScreen("interview-start");
              }
            }}
          >
            <HomePageView startHref="/interview" />
          </div>
        ) : null}
        {screen === "auth" ? <AuthVisualReview onComplete={() => changeScreen("interview-start")} /> : null}
        {screen === "interview-start" ? (
          renderInterviewWorkspace(
            <EventCenteredStartWorkspaceView
              entryDate="2026-08-12"
              tabs={[]}
              busy={Boolean(pendingMode)}
              pendingRecordMode={pendingMode}
              readOnly={unfinishedInterviewCount >= 2}
              onStart={startInterview}
            />
          )
        ) : null}
        {screen === "interview-chat" ? (
          renderInterviewWorkspace(
            <EventCenteredDialogueWorkspaceView
              session={session}
              entryDate="2026-08-12"
              showRecordRail={false}
              tabs={interviewSidebarItems.map((item) => ({
                rootSessionId: item.rootSessionId,
                label: item.title,
                status: item.lifecycle === "completed"
                  ? "completed"
                  : item.lifecycle === "abandoned"
                    ? "abandoned"
                    : item.lifecycle === "blank"
                      ? "blank"
                      : "active"
              }))}
              activeTabId={activeTabId}
              feedbackMode="local"
              composerDraft={composerDraft}
              streamPreview={streamPreview}
              onComposerDraftChange={setComposerDraft}
              onOpenJournal={() => changeScreen("day")}
              onAction={handleInterviewAction}
            />
          )
        ) : null}
        {screen === "interview-complete" ? (
          renderInterviewWorkspace(
            <EventCenteredDialogueWorkspaceView
              session={session}
              entryDate="2026-08-12"
              showRecordRail={false}
              tabs={interviewSidebarItems.map((item) => ({
                rootSessionId: item.rootSessionId,
                label: item.title,
                status: item.lifecycle === "completed"
                  ? "completed"
                  : item.lifecycle === "abandoned"
                    ? "abandoned"
                    : item.lifecycle === "blank"
                      ? "blank"
                      : "active"
              }))}
              readOnly
              canCreateEvent
              showCompletionHandoff
              feedbackMode="local"
              onAction={handleInterviewAction}
              onCreateEvent={() => changeScreen("interview-start")}
              onOpenJournal={() => changeScreen("day")}
            />
          )
        ) : null}
        {screen === "day" ? (
          <JournalWorkspaceFrame
            activeView="day"
            date="2026-08-12"
            layout="embedded"
            archiveOverride={buildVisualArchive("day")}
            onNavigateOverride={(view) => changeScreen(view)}
          >
            <JournalDayWorkspaceView
              entryDate="2026-08-12"
              view={dayView}
              archives={[]}
              originals={originals}
              recordEdit={recordEdit}
              recordAutosaveStatus={recordAutosaveStatus}
              dailyEdit={dailyEdit}
              onToggleOriginal={(source) => setOriginals((current) => {
              if (current[source.entryId]) {
                const next = { ...current };
                delete next[source.entryId];
                return next;
              }
              return {
                ...current,
                [source.entryId]: {
                  status: "ready",
                  text: source.sourceMode === "capture"
                    ? source.content
                    : `我想记下：${source.content}`
                }
              };
              })}
              onBeginRecordEdit={(source) => {
              setRecordEdit({ entryId: source.entryId, title: source.title, content: source.content });
              setRecordAutosaveStatus("idle");
              }}
              onChangeRecordEdit={(draft) => {
              setRecordEdit(draft);
              setRecordAutosaveStatus("pending");
              }}
              onSaveRecordEdit={() => {
              if (recordEdit) {
                setEditedDaySources((current) => ({
                  ...current,
                  [recordEdit.entryId]: { title: recordEdit.title, content: recordEdit.content }
                }));
              }
              setRecordAutosaveStatus("saved");
              setRecordEdit(null);
              }}
              onGenerate={() => setDayUpdated(true)}
              onBeginDailyEdit={() => setDailyEdit({ title: dayView.entry?.title ?? "", content: dayView.entry?.content ?? "" })}
              onChangeDailyEdit={setDailyEdit}
              onExitDailyEdit={() => setDailyEdit(null)}
              onSaveDailyEdit={() => {
              if (dailyEdit) setSavedDailyDraft(dailyEdit);
              setDailyEdit(null);
              }}
            />
          </JournalWorkspaceFrame>
        ) : null}
        {screen === "week" || screen === "month" ? (
          <JournalWorkspaceFrame
            activeView={screen}
            date="2026-08-12"
            layout="embedded"
            archiveOverride={buildVisualArchive(screen)}
            onNavigateOverride={(view) => changeScreen(view)}
          >
            <JournalPeriodReportWorkspace
              className="!min-h-0 flex-1"
              view={{ ...activePeriodView!, archives: [] }}
              onSelectArchive={(item) => setSelectedPeriodArchiveId((current) => ({ ...current, [screen]: item.id }))}
              onOpenSource={(source) => changeScreen(source.kind === "weekly_report" ? "week" : "day")}
              onAutosave={() => undefined}
              onSave={(payload) => setSavedPeriodCopies((current) => ({
                ...current,
                [screen]: { title: payload.title, content: payload.content }
              }))}
            />
          </JournalWorkspaceFrame>
        ) : null}
        {screen === "insights-trends" || screen === "insights-portrait" || screen === "insights-memories" ? (
          <div
            className="min-h-0 flex-1 overflow-y-auto"
            onClickCapture={(event) => {
              const target = event.target as HTMLElement;
              const link = target.closest("a");
              if (!link) return;
              const href = link.getAttribute("href") ?? "";
              if (href.startsWith("/insights")) {
                event.preventDefault();
                if (href.includes("portrait")) changeScreen("insights-portrait");
                else if (href.includes("memories")) changeScreen("insights-memories");
                else changeScreen("insights-trends");
              } else if (href.startsWith("/calendar")) {
                event.preventDefault();
                changeScreen(href.includes("view=month") ? "month" : href.includes("view=week") ? "week" : "day");
              } else if (href.startsWith("/interview")) {
                event.preventDefault();
                changeScreen("interview-start");
              }
            }}
          >
            <InsightsWorkspaceView
              section={screen === "insights-portrait" ? "portrait" : screen === "insights-memories" ? "memories" : "trends"}
              trends={INSIGHTS_DEMO_DATA.trends}
              self={INSIGHTS_DEMO_DATA.self}
            />
          </div>
        ) : null}
        {screen === "settings" ? <SettingsVisualReview onLegal={() => changeScreen("legal")} /> : null}
        {screen === "legal" ? <LegalVisualReview onSettings={() => changeScreen("settings")} /> : null}
      </div>
      {previewToast ? (
        <div role="status" className="pointer-events-none fixed inset-x-0 top-[calc(var(--site-header-viewport-offset)+0.75rem)] z-[var(--z-toast)] mx-auto w-fit max-w-[calc(100%-2rem)] rounded-[var(--radius-control)] bg-[var(--toast-surface)] px-4 py-3 text-center text-[13px] text-[var(--toast-text)] shadow-[var(--toast-shadow)]">
          {previewToast}
        </div>
      ) : null}
      {!clean ? <ReviewSwitcher screen={screen} onScreenChange={changeScreen} /> : null}
    </div>
  );
}
