/* Hallmark · pre-emit critique: P5 H5 E4 S5 R5 V4 */
/* Hallmark · genre: editorial · macrostructure: Workbench · design-system: DESIGN.md · designed-as-app */
"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  EventCompletionHandoff,
  EventCenteredDialogueWorkspaceView,
  EventCenteredStartWorkspaceView,
  type EventCenteredDialogueWorkspaceAction
} from "@/components/interview/event-centered/event-centered-dialogue-workspace-view";
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
import type { EventCenteredWorkspaceSession } from "@/types/event-centered-dialogue";
import type {
  JournalDailyEntryRecord,
  JournalDailyJournalView,
  JournalDailySourceEntry
} from "@/types/journal-daily-entry";

export const DAILY_LIGHT_VISUAL_REVIEW_SCREENS = [
  "interview-start",
  "interview-chat",
  "interview-complete",
  "day",
  "week",
  "month"
] as const;

export type DailyLightVisualReviewScreen = (typeof DAILY_LIGHT_VISUAL_REVIEW_SCREENS)[number];

export function isDailyLightVisualReviewScreen(value: string | null): value is DailyLightVisualReviewScreen {
  return Boolean(value && DAILY_LIGHT_VISUAL_REVIEW_SCREENS.includes(value as DailyLightVisualReviewScreen));
}

const SCREEN_LABELS: Record<DailyLightVisualReviewScreen, string> = {
  "interview-start": "访谈入口",
  "interview-chat": "访谈对话",
  "interview-complete": "访谈完成",
  day: "日记",
  week: "周记",
  month: "月记"
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

function buildInterviewSession(recordMode: "capture" | "chat" = "chat"): EventCenteredWorkspaceSession {
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
    latestMessageSequence: 4,
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
        { id: "day-10", kind: "daily_report", label: "周一 · 8月10日", title: "从慌乱里慢慢稳下来", excerpt: "忘带电脑打乱了上午，也让我看见自己对稳定的要求。", rangeLabel: "8月10日" },
        { id: "day-11", kind: "daily_report", label: "周二 · 8月11日", title: "节奏被打乱，也重新找回一点", excerpt: "一次肯定让我松了一口气。", rangeLabel: "8月11日" },
        { id: "day-12", kind: "event_card", label: "周三 · 8月12日", title: "和妈妈通话后的复杂感受", excerpt: "关心和压力同时存在。", rangeLabel: "8月12日" }
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
      { id: "week-1", kind: "weekly_report", label: "第一周", title: "在变化里找到一点确定", excerpt: "几件小事让我重新看见自己的判断。", rangeLabel: "8月1日—8月2日" },
      { id: "week-2", kind: "weekly_report", label: "第二周", title: "重新找回工作的节奏", excerpt: "从几次慌乱和完成里，慢慢找回掌控感。", rangeLabel: "8月3日—8月9日" },
      { id: "week-3", kind: "weekly_report", label: "第三周", title: "让休息真正成为休息", excerpt: "开始更早察觉自己的疲惫。", rangeLabel: "8月10日—8月16日" }
    ]
  };
}

function replaceScreenInUrl(screen: DailyLightVisualReviewScreen, clean: boolean) {
  const url = new URL(window.location.href);
  url.searchParams.set("screen", screen);
  if (clean) url.searchParams.set("clean", "1");
  window.history.replaceState(null, "", url);
}

function VisualReviewHeader({
  screen,
  onScreenChange
}: {
  screen: DailyLightVisualReviewScreen;
  onScreenChange: (screen: DailyLightVisualReviewScreen) => void;
}) {
  const interview = screen.startsWith("interview");
  const journalView = screen === "day" || screen === "week" || screen === "month" ? screen : "day";

  return (
    <header className="grid min-h-[4.5rem] shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-6 border-b border-[var(--line-soft)] bg-[var(--paper-main)] px-6 font-ui">
      <div className="flex items-center gap-7">
        <button
          type="button"
          className="flex min-h-11 items-center gap-2.5 rounded-[var(--radius-control)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--paper-deep)]"
          onClick={() => onScreenChange("interview-start")}
        >
          <Image src="/brand/happiness-logo.png" alt="" width={36} height={36} className="size-9 rounded-[var(--radius-control)] object-cover" />
          <span className="font-display text-xl font-semibold text-[var(--text-main)]">Daily Light</span>
        </button>
        <nav aria-label="视觉稿主导航" className="flex items-center gap-5">
          <button
            type="button"
            aria-current={interview ? "page" : undefined}
            onClick={() => onScreenChange("interview-start")}
            className={`relative min-h-11 rounded-[var(--radius-control)] px-1 text-[15px] font-semibold after:absolute after:inset-x-1 after:bottom-0 after:h-0.5 after:rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--paper-deep)] ${interview ? "text-[var(--text-main)] after:bg-[var(--paper-deep)]" : "text-[var(--text-dim)] after:bg-transparent"}`}
          >
            访谈
          </button>
          <button
            type="button"
            aria-current={!interview ? "page" : undefined}
            onClick={() => onScreenChange("day")}
            className={`relative min-h-11 rounded-[var(--radius-control)] px-1 text-[15px] font-semibold after:absolute after:inset-x-1 after:bottom-0 after:h-0.5 after:rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--paper-deep)] ${!interview ? "text-[var(--text-main)] after:bg-[var(--paper-deep)]" : "text-[var(--text-dim)] after:bg-transparent"}`}
          >
            日记
          </button>
        </nav>
      </div>

      <div className="flex min-w-0 items-center justify-center">
        {screen === "interview-chat" ? (
          <div className="flex w-full max-w-[340px] items-center gap-3" aria-label="访谈进度，第 2 阶段，约 55%">
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <strong className="whitespace-nowrap text-[13px] text-[var(--text-main)]">第 2 / 3 阶段 · 复盘</strong>
                <span className="truncate text-[13px] text-[var(--text-faint)]">正在回看当时的感受和反应</span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2" aria-hidden="true">
                <span className="h-1 rounded-full bg-[var(--paper-deep)]" />
                <span className="h-1 overflow-hidden rounded-full bg-[var(--line-soft)]"><span className="block h-full w-1/2 rounded-full bg-[var(--paper-deep)]" /></span>
                <span className="h-1 rounded-full bg-[var(--line-soft)]" />
              </div>
            </div>
            <span className="whitespace-nowrap text-[13px] tabular-nums text-[var(--text-dim)]">约 55%</span>
          </div>
        ) : interview ? (
          <p className="text-[13px] text-[var(--text-dim)]">8月12日 · 星期三</p>
        ) : (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1" aria-label="切换日记范围">
              {(["day", "week", "month"] as const).map((view) => (
                <button
                  key={view}
                  type="button"
                  aria-current={journalView === view ? "page" : undefined}
                  onClick={() => onScreenChange(view)}
                  className={`min-h-11 rounded-[var(--radius-control)] px-3 text-[13px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--paper-deep)] ${journalView === view ? "bg-[var(--text-main)] text-[var(--paper-main)]" : "text-[var(--text-dim)]"}`}
                >
                  {view === "day" ? "日" : view === "week" ? "周" : "月"}
                </button>
              ))}
            </div>
            <span className="text-[13px] text-[var(--text-dim)]">
              {journalView === "day" ? "2026年8月12日" : journalView === "week" ? "8月10日—8月16日" : "2026年8月"}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        {screen === "interview-chat" ? (
          <button
            type="button"
            onClick={() => onScreenChange("interview-complete")}
            className="min-h-11 rounded-[var(--radius-control)] border border-[var(--line-strong)] px-4 text-[13px] font-semibold text-[var(--text-main)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--paper-deep)]"
          >
            先停在这里
          </button>
        ) : null}
        <span className="grid size-10 place-items-center rounded-full border border-[var(--line-strong)] font-display text-lg text-[var(--text-main)]" aria-label="当前用户">
          我
        </span>
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
          className={`min-h-9 whitespace-nowrap rounded-[var(--radius-control)] px-3 text-[13px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--paper-main)] ${screen === item ? "bg-[var(--paper-main)] text-[var(--text-main)]" : "text-[var(--paper-soft)] hover:bg-[var(--header-surface)]"}`}
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
  const [selectedDayArchiveId, setSelectedDayArchiveId] = useState("day-12");
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
    return {
      ...base,
      recordMode: selectedMode ?? "chat",
      latestMessageSequence: base.latestMessageSequence + extraMessages.length,
      messages
    };
  }, [extraMessages, regenerations, selectedMode]);

  const dayView = useMemo<JournalDailyJournalView>(() => {
    const includeCompletedEvent = eventSaved;
    const sources = (includeCompletedEvent
      ? [...visualDaySources, completedInterviewSource]
      : visualDaySources).map((source) => editedDaySources[source.entryId]
        ? { ...source, ...editedDaySources[source.entryId], contentRevision: source.contentRevision + 1 }
        : source);
    const entry = {
      ...visualDayEntry,
      title: savedDailyDraft.title,
      content: dayUpdated && includeCompletedEvent
        ? `${savedDailyDraft.content}\n\n和妈妈通话后，我更清楚地看到：我能理解她的担心，也需要自己的选择被尊重。`
        : savedDailyDraft.content
    };
    return {
      ...visualDayView,
      savedSources: sources,
      entry,
      sourceSignature: includeCompletedEvent ? "visual-day-signature-with-completed-event" : visualDayView.sourceSignature,
      displayStatus: includeCompletedEvent && !dayUpdated ? "stale" : "saved",
      freshness: includeCompletedEvent && !dayUpdated ? "stale" : "saved"
    };
  }, [dayUpdated, editedDaySources, eventSaved, savedDailyDraft.content, savedDailyDraft.title]);

  const dayArchives = useMemo(() => visualDayArchives.map((item) => ({
    ...item,
    selected: item.id === selectedDayArchiveId
  })), [selectedDayArchiveId]);

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
      setComposerDraft("");
      setExtraMessages([]);
      setStreamPreview(null);
      setRegenerations({});
      setActiveTabId("visual-root");
    } else if (next === "interview-chat" && !selectedMode) {
      setSelectedMode("chat");
    }
    setScreen(next);
    setPendingMode(null);
    replaceScreenInUrl(next, clean);
  }

  function startInterview(mode: "capture" | "chat") {
    setPendingMode(mode);
    setSelectedMode(mode);
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

  return (
    <div data-daily-light-visual-review className="fixed inset-0 z-[100] flex min-h-0 flex-col overflow-hidden bg-[var(--paper-main)] text-[var(--text-main)]">
      <VisualReviewHeader screen={screen} onScreenChange={changeScreen} />
      <div className="flex min-h-0 flex-1 flex-col">
        {screen === "interview-start" ? (
          <EventCenteredStartWorkspaceView
            entryDate="2026-08-12"
            tabs={[]}
            busy={Boolean(pendingMode)}
            pendingRecordMode={pendingMode}
            onStart={startInterview}
          />
        ) : null}
        {screen === "interview-chat" ? (
          <EventCenteredDialogueWorkspaceView
            session={session}
            entryDate="2026-08-12"
            tabs={[
              { rootSessionId: "visual-record-one", label: "忘带电脑，上午的节奏乱了", status: "completed" },
              { rootSessionId: "visual-record-two", label: "和小周吃饭，被肯定了一下", status: "completed" },
              { rootSessionId: "visual-root", label: "和妈妈通话后的复杂感受", status: "active" }
            ]}
            activeTabId={activeTabId}
            feedbackMode="local"
            composerDraft={composerDraft}
            streamPreview={streamPreview}
            onComposerDraftChange={setComposerDraft}
            onSelectTab={setActiveTabId}
            onOpenJournal={() => changeScreen("day")}
            onAction={handleInterviewAction}
          />
        ) : null}
        {screen === "interview-complete" ? (
          <EventCompletionHandoff
            entryDate="2026-08-12"
            busy={false}
            onCreateEvent={() => changeScreen("interview-start")}
            onOpenJournal={() => changeScreen("day")}
          />
        ) : null}
        {screen === "day" ? (
          <JournalDayWorkspaceView
            entryDate="2026-08-12"
            view={dayView}
            archives={dayArchives}
            originals={originals}
            recordEdit={recordEdit}
            recordAutosaveStatus={recordAutosaveStatus}
            dailyEdit={dailyEdit}
            onSelectArchive={(item) => setSelectedDayArchiveId(item.id)}
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
        ) : null}
        {screen === "week" || screen === "month" ? (
          <JournalPeriodReportWorkspace
            className="!min-h-0 flex-1"
            view={activePeriodView!}
            onSelectArchive={(item) => setSelectedPeriodArchiveId((current) => ({ ...current, [screen]: item.id }))}
            onOpenSource={(source) => changeScreen(source.kind === "weekly_report" ? "week" : "day")}
            onAutosave={() => undefined}
            onSave={(payload) => setSavedPeriodCopies((current) => ({
              ...current,
              [screen]: { title: payload.title, content: payload.content }
            }))}
          />
        ) : null}
      </div>
      {!clean ? <ReviewSwitcher screen={screen} onScreenChange={changeScreen} /> : null}
    </div>
  );
}
