"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type {
  JournalQualityVerdict,
  JournalRound2CaseSummary,
  JournalRound2CaseView,
  JournalRound2ComparisonVerdict,
  JournalRound2IssueTag,
  JournalRound2Score,
  JournalRound2ScoreKey,
  JournalRound2Scores
} from "@/components/journal-evaluation/types";
import { ActionButton } from "@/components/ui/action-button";
import { Card } from "@/components/ui/card";
import { Divider } from "@/components/ui/divider";
import { SectionHeading } from "@/components/ui/section-heading";
import { Surface } from "@/components/ui/surface";
import { cn } from "@/lib/utils";

const QUALITY_OPTIONS: Array<{ value: JournalQualityVerdict; label: string }> = [
  { value: "ready_to_use", label: "可直接使用" },
  { value: "minor_edit", label: "轻微修改" },
  { value: "major_rewrite", label: "需要大改" },
  { value: "quality_failure", label: "质量失败" }
];

const SCORE_GROUPS: Array<{ key: JournalRound2ScoreKey; label: string; hint: string }> = [
  { key: "fidelity_completeness", label: "内容忠实与完整", hint: "事实、感受和认识都准确保留" },
  { key: "structure_coherence", label: "结构与连贯性", hint: "段落、顺序和衔接自然" },
  { key: "language_naturalness", label: "语言自然度", hint: "像书面日记，读起来顺畅" },
  { key: "insight_integration", label: "认识融入", hint: "认识与事件自然结合" }
];

const ISSUE_OPTIONS: Array<{ value: JournalRound2IssueTag; label: string }> = [
  { value: "fact_or_source_error", label: "事实或来源错误" },
  { value: "content_omission", label: "内容遗漏" },
  { value: "fragmented_structure", label: "结构割裂" },
  { value: "question_answer_trace", label: "问答痕迹" },
  { value: "unnatural_language", label: "语言不自然" },
  { value: "insight_not_integrated", label: "认识融合不足" },
  { value: "over_inference", label: "过度推断" },
  { value: "no_material_issue", label: "无明显问题" },
  { value: "other", label: "其他" }
];

const COMPARISON_OPTIONS: Array<{
  value: JournalRound2ComparisonVerdict;
  label: string;
}> = [
  { value: "material_improvement", label: "明显改善" },
  { value: "slight_improvement", label: "轻微改善" },
  { value: "unchanged", label: "基本不变" },
  { value: "worse", label: "变差" }
];

const STATUS_LABEL: Record<JournalRound2CaseSummary["status"], string> = {
  awaiting_candidate: "待生成",
  not_started: "未开始",
  in_progress: "评价中",
  awaiting_comparison: "待对比",
  completed: "已完成",
  blocked: "已阻断"
};

const EMPTY_SCORES: JournalRound2Scores = {
  fidelity_completeness: null,
  structure_coherence: null,
  language_naturalness: null,
  insight_integration: null
};

const REVIEW_API_PATH = "/admin/journal-evaluation/round3";

interface RoundForm {
  overall_verdict: JournalQualityVerdict | null;
  scores: JournalRound2Scores;
  issue_tags: JournalRound2IssueTag[];
  note: string;
}

interface ComparisonForm {
  comparison_verdict: JournalRound2ComparisonVerdict | null;
  note: string;
}

function jsonRequest(input: RequestInfo | URL, init?: RequestInit) {
  return fetch(input, init).then(async (response) => {
    const payload = await response.json() as Record<string, unknown>;
    if (!response.ok) throw new Error(String(payload.error ?? "评审服务暂时不可用"));
    return payload;
  });
}

function qualityLabel(value: JournalQualityVerdict) {
  return QUALITY_OPTIONS.find((item) => item.value === value)?.label ?? value;
}

function issueLabel(value: JournalRound2IssueTag) {
  return ISSUE_OPTIONS.find((item) => item.value === value)?.label ?? value;
}

function comparisonLabel(value: JournalRound2ComparisonVerdict) {
  return COMPARISON_OPTIONS.find((item) => item.value === value)?.label ?? value;
}

function reviewTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function gateLabel(evaluationCase: JournalRound2CaseView | null) {
  if (!evaluationCase) return "正在读取评审状态";
  if (evaluationCase.gate.state === "pass") return "三条案例达到本轮门槛";
  if (evaluationCase.gate.state === "fail") return "本轮已触发暂停条件";
  return `${evaluationCase.gate.completed_cases} / ${evaluationCase.gate.total_cases} 条已完成`;
}

function SelectionButton({
  selected,
  disabled,
  onClick,
  children,
  ariaLabel
}: {
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-[var(--radius-control)] border px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--amber)]",
        selected
          ? "border-[var(--line-strong)] bg-[var(--header-surface)] font-semibold text-[var(--text-main)]"
          : "border-[var(--line-soft)] bg-transparent text-[var(--text-dim)] hover:border-[var(--line-strong)]",
        disabled && "cursor-not-allowed opacity-65"
      )}
    >
      {children}
    </button>
  );
}

function TranscriptPanel({ evaluationCase }: { evaluationCase: JournalRound2CaseView }) {
  return (
    <Card className="min-h-0 p-5 xl:max-h-[calc(100dvh-var(--site-header-viewport-offset)-12rem)] xl:overflow-y-auto">
      <SectionHeading title="完整对话" hint="真人原话" description="AI 提问保留在上下文中，帮助判断日记是否形成了连贯叙述。" />
      <Divider className="my-4" />
      <ol className="space-y-4">
        {evaluationCase.transcript.map((message) => (
          <li
            key={message.message_id}
            className={cn(
              "border-l-2 pl-4 text-sm leading-7",
              message.role === "user"
                ? "border-[var(--amber)] text-[var(--text-main)]"
                : "border-[var(--line-soft)] text-[var(--text-dim)]"
            )}
          >
            <p className="mb-1 text-xs font-semibold text-[var(--text-faint)]">
              {message.role === "user" ? "我" : "Daily Light"}
            </p>
            <p className="whitespace-pre-wrap">{message.content}</p>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function JournalParagraphs({ paragraphs }: { paragraphs: string[] }) {
  return (
    <div className="space-y-4 font-display text-[1.02rem] leading-8 text-[var(--text-main)]">
      {paragraphs.map((paragraph, index) => (
        <p key={`${index}:${paragraph.slice(0, 24)}`} className="whitespace-pre-wrap">
          {paragraph}
        </p>
      ))}
    </div>
  );
}

function CandidatePanel({ evaluationCase }: { evaluationCase: JournalRound2CaseView }) {
  const candidate = evaluationCase.candidate;
  if (!candidate) {
    return (
      <Card className="p-6">
        <SectionHeading title="等待新版日记" hint="第三轮候选" />
        <p className="mt-4 text-sm leading-7 text-[var(--text-dim)]">
          三条 Flash 今日日记完成封存后，这里会展示记录卡和新版正文。页面只承载真实运行结果。
        </p>
      </Card>
    );
  }
  const programCheck = evaluationCase.decision ? candidate.program_check : null;
  const blockedBeforeReview = !evaluationCase.review_ready && !evaluationCase.decision;
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionHeading title="已通过的记录卡" hint="可信底稿" description="本轮继续复用已经通过真人评价的 Flash 记录卡。" />
        {programCheck ? (
          <span className={cn(
            "rounded-full px-3 py-1 text-xs font-semibold",
            programCheck.admitted
              ? "bg-[var(--header-surface)] text-[var(--text-main)]"
              : "bg-[var(--paper-muted)] text-[var(--text-dim)]"
          )}>
            {programCheck.admitted ? "程序检查通过" : "程序检查阻断"}
          </span>
        ) : null}
      </div>
      {blockedBeforeReview ? (
        <p
          className="mt-5 border-y border-[var(--line-soft)] py-4 text-sm leading-7 text-[var(--text-dim)]"
          role="status"
        >
          结果暂不可评审。请等待可评审结果更新后继续。
        </p>
      ) : null}
      <div className="mt-5 border-l-2 border-[var(--amber)] pl-4">
        <h3 className="font-display text-xl text-[var(--text-main)]">{candidate.record_card.title}</h3>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[var(--text-main)]">
          {candidate.record_card.text}
        </p>
        {candidate.record_card.insight ? (
          <p className="mt-3 text-sm leading-7 text-[var(--text-dim)]">
            {candidate.record_card.insight}
          </p>
        ) : null}
      </div>
      <Divider className="my-6" />
      <SectionHeading title="新版 Flash 今日日记" hint="Prompt v3" description="重点观察叙述主线、自然书面语和认识融合。" />
      <h3 className="mt-5 font-display text-2xl text-[var(--text-main)]">{candidate.title}</h3>
      <div className="mt-5">
        {candidate.paragraphs.length > 0 ? (
          <JournalParagraphs paragraphs={candidate.paragraphs} />
        ) : (
          <p className="text-sm leading-7 text-[var(--text-dim)]">新版正文未形成完整可评审结果。</p>
        )}
      </div>
      {programCheck && programCheck.failures.length > 0 ? (
        <div className="mt-6 border-t border-[var(--line-soft)] pt-4 text-sm leading-6 text-[var(--text-dim)]">
          {programCheck.failures.map((failure) => (
            <p key={`${failure.code}:${failure.refs.join(":")}`}>{failure.code}：{failure.message}</p>
          ))}
        </div>
      ) : null}
    </Card>
  );
}

function ComparisonPanel({ evaluationCase }: { evaluationCase: JournalRound2CaseView }) {
  if (!evaluationCase.decision || !evaluationCase.baseline || !evaluationCase.candidate) return null;
  return (
    <Card className="p-5 sm:p-6">
      <SectionHeading
        title="Prompt v3 与 Prompt v2 对比"
        hint="第二阶段"
        description="Prompt v2 内容和锁定评价在新版裁决完成后才会展示。"
      />
      <Divider className="my-5" />
      <div className="grid gap-7 lg:grid-cols-2 lg:divide-x lg:divide-[var(--line-soft)]">
        <article>
          <p className="text-xs font-semibold tracking-[0.12em] text-[var(--amber)]">新版 Prompt v3</p>
          <h3 className="mt-2 font-display text-xl text-[var(--text-main)]">{evaluationCase.candidate.title}</h3>
          <div className="mt-4">
            <JournalParagraphs paragraphs={evaluationCase.candidate.paragraphs} />
          </div>
          <p className="mt-5 text-sm font-semibold text-[var(--text-main)]">
            新版裁决：{qualityLabel(evaluationCase.decision.overall_verdict)}
          </p>
        </article>
        <article className="lg:pl-7">
          <p className="text-xs font-semibold tracking-[0.12em] text-[var(--text-faint)]">Prompt v2</p>
          <h3 className="mt-2 font-display text-xl text-[var(--text-main)]">{evaluationCase.baseline.title}</h3>
          <div className="mt-4">
            <JournalParagraphs paragraphs={evaluationCase.baseline.paragraphs} />
          </div>
          <div className="mt-5 border-l-2 border-[var(--line-strong)] pl-4 text-sm leading-7 text-[var(--text-dim)]">
            <p className="font-semibold text-[var(--text-main)]">
              Prompt v2 裁决：{qualityLabel(evaluationCase.baseline.locked_review.overall_verdict)}
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
              {SCORE_GROUPS.map((group) => (
                <div key={group.key}>
                  <dt className="text-xs text-[var(--text-faint)]">{group.label}</dt>
                  <dd className="font-semibold text-[var(--text-main)]">
                    {evaluationCase.baseline!.locked_review.scores[group.key]} / 5
                  </dd>
                </div>
              ))}
            </dl>
            {evaluationCase.baseline.locked_review.issue_tags.length > 0 ? (
              <p className="mt-3">
                问题标签：{evaluationCase.baseline.locked_review.issue_tags.map(issueLabel).join("、")}
              </p>
            ) : null}
            <p className="mt-3 text-xs text-[var(--text-faint)]">
              首次评价 · {reviewTime(evaluationCase.baseline.locked_review.reviewed_at)}
            </p>
            <p className="mt-1 whitespace-pre-wrap">
              {evaluationCase.baseline.locked_review.note || "首次评价未填写文字备注"}
            </p>
            {evaluationCase.baseline.locked_review.note_additions.map((addition) => (
              <div key={`${addition.added_at}:${addition.note}`} className="mt-3">
                <p className="text-xs text-[var(--text-faint)]">补充 · {reviewTime(addition.added_at)}</p>
                <p className="mt-1 whitespace-pre-wrap">{addition.note}</p>
              </div>
            ))}
            <Divider className="my-4" />
            <p className="font-semibold text-[var(--text-main)]">
              Prompt v2 相比首轮：{comparisonLabel(evaluationCase.baseline.locked_review.comparison_verdict)}
            </p>
            <p className="mt-1 whitespace-pre-wrap">
              {evaluationCase.baseline.locked_review.comparison_note || "Prompt v2 对比未填写文字备注"}
            </p>
          </div>
        </article>
      </div>
    </Card>
  );
}

function RoundRatingPanel({
  form,
  locked,
  disabled,
  saveState,
  onVerdict,
  onScore,
  onIssue,
  onNote,
  onSubmit,
  onAddNote
}: {
  form: RoundForm;
  locked: boolean;
  disabled: boolean;
  saveState: string;
  onVerdict: (value: JournalQualityVerdict) => void;
  onScore: (key: JournalRound2ScoreKey, value: JournalRound2Score) => void;
  onIssue: (value: JournalRound2IssueTag) => void;
  onNote: (value: string) => void;
  onSubmit: () => void;
  onAddNote: (value: string) => void;
}) {
  const [addition, setAddition] = useState("");
  const complete = Boolean(form.overall_verdict && SCORE_GROUPS.every((item) => form.scores[item.key]));
  return (
    <Card className="p-5 xl:sticky xl:top-[calc(var(--site-header-viewport-offset)+1rem)] xl:max-h-[calc(100dvh-var(--site-header-viewport-offset)-2rem)] xl:overflow-y-auto">
      <SectionHeading title={locked ? "新版评价已锁定" : "评价新版日记"} hint="第一阶段" />
      <p role="status" className="mt-2 text-xs text-[var(--text-faint)]">{saveState}</p>
      <Divider className="my-4" />
      <fieldset disabled={disabled || locked}>
        <legend className="text-sm font-semibold text-[var(--text-main)]">总体裁决</legend>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {QUALITY_OPTIONS.map((option) => (
            <SelectionButton
              key={option.value}
              selected={form.overall_verdict === option.value}
              disabled={disabled || locked}
              onClick={() => onVerdict(option.value)}
              ariaLabel={`总体裁决：${option.label}`}
            >
              {option.label}
            </SelectionButton>
          ))}
        </div>
        <div className="mt-6 space-y-5">
          {SCORE_GROUPS.map((group) => (
            <div key={group.key}>
              <p className="text-sm font-semibold text-[var(--text-main)]">{group.label}</p>
              <p className="mt-1 text-xs leading-5 text-[var(--text-faint)]">{group.hint}</p>
              <div className="mt-2 grid grid-cols-5 gap-1">
                {([1, 2, 3, 4, 5] as const).map((score) => (
                  <SelectionButton
                    key={score}
                    selected={form.scores[group.key] === score}
                    disabled={disabled || locked}
                    onClick={() => onScore(group.key, score)}
                    ariaLabel={`${group.label}：${score} 分`}
                  >
                    <span className="block text-center">{score}</span>
                  </SelectionButton>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6">
          <p className="text-sm font-semibold text-[var(--text-main)]">问题标签</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {ISSUE_OPTIONS.map((option) => (
              <SelectionButton
                key={option.value}
                selected={form.issue_tags.includes(option.value)}
                disabled={disabled || locked}
                onClick={() => onIssue(option.value)}
                ariaLabel={`问题标签：${option.label}`}
              >
                {option.label}
              </SelectionButton>
            ))}
          </div>
        </div>
        <label className="mt-6 block text-sm font-semibold text-[var(--text-main)]" htmlFor="round3-note">
          文字备注
        </label>
        <textarea
          id="round3-note"
          value={form.note}
          onChange={(event) => onNote(event.target.value)}
          rows={5}
          maxLength={1200}
          className="mt-2 w-full resize-y rounded-[var(--radius-control)] border border-[var(--line-soft)] bg-transparent px-3 py-2 text-sm leading-6 text-[var(--text-main)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--amber)]"
          placeholder="写下具体问题、保留点和修改方向"
        />
      </fieldset>
      {locked ? (
        <div className="mt-5 border-t border-[var(--line-soft)] pt-4">
          <label className="text-sm font-semibold text-[var(--text-main)]" htmlFor="round3-note-addition">补充新版备注</label>
          <textarea
            id="round3-note-addition"
            value={addition}
            onChange={(event) => setAddition(event.target.value)}
            rows={3}
            maxLength={1200}
            className="mt-2 w-full resize-y rounded-[var(--radius-control)] border border-[var(--line-soft)] bg-transparent px-3 py-2 text-sm leading-6 text-[var(--text-main)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--amber)]"
          />
          <ActionButton
            className="mt-3 w-full justify-center"
            disabled={disabled || !addition.trim()}
            onClick={() => {
              onAddNote(addition);
              setAddition("");
            }}
          >
            追加备注
          </ActionButton>
        </div>
      ) : (
        <ActionButton
          variant="primary"
          className="mt-6 w-full justify-center"
          disabled={disabled || !complete}
          onClick={onSubmit}
        >
          锁定新版评价并进入对比
        </ActionButton>
      )}
    </Card>
  );
}

function ComparisonRatingPanel({
  form,
  locked,
  disabled,
  saveState,
  onVerdict,
  onNote,
  onSubmit,
  onAddRoundNote
}: {
  form: ComparisonForm;
  locked: boolean;
  disabled: boolean;
  saveState: string;
  onVerdict: (value: JournalRound2ComparisonVerdict) => void;
  onNote: (value: string) => void;
  onSubmit: () => void;
  onAddRoundNote: (value: string) => void;
}) {
  const [roundNoteAddition, setRoundNoteAddition] = useState("");
  return (
    <Card className="p-5 xl:sticky xl:top-[calc(var(--site-header-viewport-offset)+1rem)] xl:max-h-[calc(100dvh-var(--site-header-viewport-offset)-2rem)] xl:overflow-y-auto">
      <SectionHeading title={locked ? "前后对比已锁定" : "判断改版效果"} hint="第二阶段" />
      <p role="status" className="mt-2 text-xs text-[var(--text-faint)]">{saveState}</p>
      <Divider className="my-4" />
      <fieldset disabled={disabled || locked}>
        <legend className="text-sm font-semibold text-[var(--text-main)]">相比 Prompt v2</legend>
        <div className="mt-3 grid gap-2">
          {COMPARISON_OPTIONS.map((option) => (
            <SelectionButton
              key={option.value}
              selected={form.comparison_verdict === option.value}
              disabled={disabled || locked}
              onClick={() => onVerdict(option.value)}
              ariaLabel={`改版效果：${option.label}`}
            >
              {option.label}
            </SelectionButton>
          ))}
        </div>
        <label className="mt-5 block text-sm font-semibold text-[var(--text-main)]" htmlFor="comparison-note">
          对比备注
        </label>
        <textarea
          id="comparison-note"
          value={form.note}
          onChange={(event) => onNote(event.target.value)}
          rows={5}
          maxLength={1200}
          className="mt-2 w-full resize-y rounded-[var(--radius-control)] border border-[var(--line-soft)] bg-transparent px-3 py-2 text-sm leading-6 text-[var(--text-main)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--amber)]"
          placeholder="说明改善、持平或退化发生在哪里"
        />
      </fieldset>
      <div className="mt-5 border-t border-[var(--line-soft)] pt-4">
        <label className="text-sm font-semibold text-[var(--text-main)]" htmlFor="comparison-round-note-addition">
          补充新版评价备注
        </label>
        <p className="mt-1 text-xs leading-5 text-[var(--text-faint)]">
          首次评价保持锁定，后续想到的内容会作为独立备注追加。
        </p>
        <textarea
          id="comparison-round-note-addition"
          value={roundNoteAddition}
          onChange={(event) => setRoundNoteAddition(event.target.value)}
          rows={3}
          maxLength={1200}
          className="mt-2 w-full resize-y rounded-[var(--radius-control)] border border-[var(--line-soft)] bg-transparent px-3 py-2 text-sm leading-6 text-[var(--text-main)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--amber)]"
          placeholder="补充对新版日记的观察"
        />
        <ActionButton
          className="mt-3 w-full justify-center"
          disabled={disabled || !roundNoteAddition.trim()}
          onClick={() => {
            onAddRoundNote(roundNoteAddition);
            setRoundNoteAddition("");
          }}
        >
          保存补充备注
        </ActionButton>
      </div>
      {locked ? (
        <p className="mt-5 text-sm font-semibold text-[var(--text-main)]">本案例已完成并锁定</p>
      ) : (
        <ActionButton
          variant="primary"
          className="mt-6 w-full justify-center"
          disabled={disabled || !form.comparison_verdict}
          onClick={onSubmit}
        >
          锁定前后对比
        </ActionButton>
      )}
    </Card>
  );
}

export function JournalEvaluationWorkbench() {
  const [cases, setCases] = useState<JournalRound2CaseSummary[]>([]);
  const [activeCase, setActiveCase] = useState<JournalRound2CaseView | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState("等待评价");
  const [roundForm, setRoundForm] = useState<RoundForm>({
    overall_verdict: null,
    scores: { ...EMPTY_SCORES },
    issue_tags: [],
    note: ""
  });
  const [comparisonForm, setComparisonForm] = useState<ComparisonForm>({
    comparison_verdict: null,
    note: ""
  });
  const activeCaseRef = useRef<JournalRound2CaseView | null>(null);
  const loadSequenceRef = useRef(0);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const noteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const comparisonNoteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roundFormRef = useRef(roundForm);
  const comparisonFormRef = useRef(comparisonForm);
  const roundDraftSequenceRef = useRef(0);
  const comparisonDraftSequenceRef = useRef(0);

  roundFormRef.current = roundForm;
  comparisonFormRef.current = comparisonForm;

  const applyCase = useCallback((evaluationCase: JournalRound2CaseView) => {
    setActiveCase(evaluationCase);
    activeCaseRef.current = evaluationCase;
    const source = evaluationCase.decision ?? evaluationCase.draft;
    setRoundForm(source ? {
      overall_verdict: source.overall_verdict,
      scores: source.scores,
      issue_tags: source.issue_tags,
      note: source.note
    } : {
      overall_verdict: null,
      scores: { ...EMPTY_SCORES },
      issue_tags: [],
      note: ""
    });
    const comparison = evaluationCase.comparison_decision ?? evaluationCase.comparison_draft;
    setComparisonForm(comparison ? {
      comparison_verdict: comparison.comparison_verdict,
      note: comparison.note
    } : { comparison_verdict: null, note: "" });
    setCases((current) => current.map((item) => item.case_id === evaluationCase.case_id
      ? { ...item, status: evaluationCase.status, review_ready: evaluationCase.review_ready }
      : item));
  }, []);

  const postAction = useCallback(async (body: Record<string, unknown>) => {
    const requestCase = activeCaseRef.current;
    if (!requestCase?.presentation_id) throw new Error("当前案例缺少可保存的展示版本");
    const payload = await jsonRequest(REVIEW_API_PATH, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...body,
        case_id: requestCase.case_id,
        presentation_id: requestCase.presentation_id
      })
    }) as { case?: JournalRound2CaseView };
    if (!payload.case || payload.case.case_id !== requestCase.case_id
      || payload.case.presentation_id !== requestCase.presentation_id) {
      throw new Error("保存结果与当前案例不一致，请重新读取");
    }
    return payload.case;
  }, []);

  const queueRoundDraft = useCallback((snapshot: RoundForm) => {
    const requestCase = activeCaseRef.current;
    if (!requestCase?.presentation_id || requestCase.decision || !requestCase.review_ready) return;
    const caseId = requestCase.case_id;
    const presentationId = requestCase.presentation_id;
    const draftSequence = ++roundDraftSequenceRef.current;
    setSaveState("正在自动保存");
    saveQueueRef.current = saveQueueRef.current.catch(() => undefined).then(async () => {
      const updated = await postAction({ action: "save_round_draft", ...snapshot });
      if (activeCaseRef.current?.case_id === caseId
        && activeCaseRef.current.presentation_id === presentationId
        && roundDraftSequenceRef.current === draftSequence) {
        applyCase(updated);
        setSaveState("评价草稿已自动保存");
      }
    }).catch((saveError) => {
      if (activeCaseRef.current?.case_id === caseId
        && roundDraftSequenceRef.current === draftSequence) {
        setError(saveError instanceof Error ? saveError.message : "评价草稿保存失败");
        setSaveState("自动保存失败");
      }
    });
  }, [applyCase, postAction]);

  const queueComparisonDraft = useCallback((snapshot: ComparisonForm) => {
    const requestCase = activeCaseRef.current;
    if (!requestCase?.presentation_id || !requestCase.decision
      || requestCase.comparison_decision || !requestCase.review_ready) return;
    const caseId = requestCase.case_id;
    const presentationId = requestCase.presentation_id;
    const draftSequence = ++comparisonDraftSequenceRef.current;
    setSaveState("正在自动保存对比");
    saveQueueRef.current = saveQueueRef.current.catch(() => undefined).then(async () => {
      const updated = await postAction({ action: "save_comparison_draft", ...snapshot });
      if (activeCaseRef.current?.case_id === caseId
        && activeCaseRef.current.presentation_id === presentationId
        && comparisonDraftSequenceRef.current === draftSequence) {
        applyCase(updated);
        setSaveState("对比草稿已自动保存");
      }
    }).catch((saveError) => {
      if (activeCaseRef.current?.case_id === caseId
        && comparisonDraftSequenceRef.current === draftSequence) {
        setError(saveError instanceof Error ? saveError.message : "对比草稿保存失败");
        setSaveState("自动保存失败");
      }
    });
  }, [applyCase, postAction]);

  const flushAutosave = useCallback(async () => {
    if (noteTimerRef.current) {
      clearTimeout(noteTimerRef.current);
      noteTimerRef.current = null;
      queueRoundDraft(roundFormRef.current);
    }
    if (comparisonNoteTimerRef.current) {
      clearTimeout(comparisonNoteTimerRef.current);
      comparisonNoteTimerRef.current = null;
      queueComparisonDraft(comparisonFormRef.current);
    }
    await saveQueueRef.current;
  }, [queueComparisonDraft, queueRoundDraft]);

  const loadCase = useCallback(async (caseId: string) => {
    const sequence = ++loadSequenceRef.current;
    setLoading(true);
    setError(null);
    try {
      await flushAutosave();
      const payload = await jsonRequest(
        `${REVIEW_API_PATH}?case_id=${encodeURIComponent(caseId)}`,
        { cache: "no-store" }
      ) as { case?: JournalRound2CaseView };
      if (!payload.case) throw new Error("案例读取失败");
      if (loadSequenceRef.current !== sequence) return;
      applyCase(payload.case);
      setSaveState(payload.case.comparison_decision
        ? "本案例已完成并锁定"
        : payload.case.decision ? "新版评价已锁定" : payload.case.draft ? "已恢复自动保存草稿" : "等待评价");
    } catch (loadError) {
      if (loadSequenceRef.current === sequence) {
        setError(loadError instanceof Error ? loadError.message : "案例读取失败");
      }
    } finally {
      if (loadSequenceRef.current === sequence) setLoading(false);
    }
  }, [applyCase, flushAutosave]);

  useEffect(() => {
    let active = true;
    void jsonRequest(REVIEW_API_PATH, { cache: "no-store" })
      .then((payload) => {
        if (!active) return;
        const loadedCases = (payload.cases ?? []) as JournalRound2CaseSummary[];
        setCases(loadedCases);
        const first = loadedCases[0];
        if (first) void loadCase(first.case_id);
        else setLoading(false);
      })
      .catch((loadError) => {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "评审目录读取失败");
        setLoading(false);
      });
    return () => {
      active = false;
      if (noteTimerRef.current) clearTimeout(noteTimerRef.current);
      if (comparisonNoteTimerRef.current) clearTimeout(comparisonNoteTimerRef.current);
    };
  }, [loadCase]);

  function updateRound(next: RoundForm, immediate = true) {
    setRoundForm(next);
    roundFormRef.current = next;
    if (immediate) queueRoundDraft(next);
  }

  function updateComparison(next: ComparisonForm, immediate = true) {
    setComparisonForm(next);
    comparisonFormRef.current = next;
    if (immediate) queueComparisonDraft(next);
  }

  async function submitRound() {
    if (!activeCase?.review_ready || activeCase.decision) return;
    setSaving(true);
    setError(null);
    try {
      await flushAutosave();
      const updated = await postAction({ action: "decide_round", ...roundFormRef.current });
      applyCase(updated);
      setSaveState("新版评价已锁定，Prompt v2 内容已揭示");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "新版评价保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function submitComparison() {
    if (!activeCase?.decision || activeCase.comparison_decision) return;
    setSaving(true);
    setError(null);
    try {
      await flushAutosave();
      const updated = await postAction({ action: "decide_comparison", ...comparisonFormRef.current });
      applyCase(updated);
      setSaveState("本案例已完成并锁定");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "前后对比保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function addNote(note: string) {
    setSaving(true);
    setError(null);
    try {
      const updated = await postAction({ action: "add_round_note", note });
      applyCase(updated);
      setSaveState("补充备注已保存，首次裁决保持锁定");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "补充备注保存失败");
    } finally {
      setSaving(false);
    }
  }

  const controlsDisabled = loading || saving;
  const comparisonStage = Boolean(activeCase?.decision);

  return (
    <Surface className="min-h-[calc(100dvh-var(--site-header-viewport-offset))] rounded-none border-x-0 border-b-0 px-4 py-5 sm:px-6">
      <div className="mx-auto flex w-full max-w-[110rem] flex-col gap-4">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.16em] text-[var(--amber)]">本地隔离真人评测</p>
            <h1 className="mt-1 font-display text-3xl leading-tight text-[var(--text-main)]">Flash 今日日记第三轮校准</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-dim)]">
              先独立评价 Prompt v3，再查看 Prompt v2 和锁定评价。所有字段保存在本地隔离服务，切换和刷新后会恢复。
            </p>
          </div>
          <div className="text-right text-sm text-[var(--text-dim)]">
            <p className="font-semibold text-[var(--text-main)]">{gateLabel(activeCase)}</p>
            <p className="mt-1">合成规则样本已退出真人评审</p>
          </div>
        </header>
        <Divider />

        <nav aria-label="第三轮案例目录" className="flex flex-wrap gap-2">
          {cases.map((item) => (
            <button
              key={item.case_id}
              type="button"
              disabled={controlsDisabled}
              aria-current={activeCase?.case_id === item.case_id ? "page" : undefined}
              onClick={() => void loadCase(item.case_id)}
              className={cn(
                "rounded-[var(--radius-control)] border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--amber)]",
                activeCase?.case_id === item.case_id
                  ? "border-[var(--line-strong)] bg-[var(--header-surface)]"
                  : "border-[var(--line-soft)] hover:border-[var(--line-strong)]",
                controlsDisabled && "cursor-not-allowed opacity-65"
              )}
            >
              <span className="block text-sm font-semibold text-[var(--text-main)]">{item.label}</span>
              <span className="mt-1 block text-xs text-[var(--text-faint)]">{STATUS_LABEL[item.status]}</span>
            </button>
          ))}
        </nav>

        {error ? (
          <div role="alert" className="border-l-2 border-[var(--amber)] py-2 pl-4 text-sm leading-6 text-[var(--text-main)]">
            {error}
          </div>
        ) : null}

        {loading && !activeCase ? (
          <p className="py-16 text-center text-sm text-[var(--text-dim)]">正在读取本地评审材料</p>
        ) : activeCase ? (
          <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(18rem,0.8fr)_minmax(26rem,1.2fr)_20rem]">
            <TranscriptPanel evaluationCase={activeCase} />
            <div className="min-w-0 space-y-4">
              <CandidatePanel evaluationCase={activeCase} />
              <ComparisonPanel evaluationCase={activeCase} />
            </div>
            <div className="min-w-0">
              {comparisonStage ? (
                <ComparisonRatingPanel
                  form={comparisonForm}
                  locked={Boolean(activeCase.comparison_decision)}
                  disabled={controlsDisabled || !activeCase.review_ready}
                  saveState={saveState}
                  onVerdict={(value) => updateComparison({ ...comparisonFormRef.current, comparison_verdict: value })}
                  onNote={(value) => {
                    const next = { ...comparisonFormRef.current, note: value };
                    updateComparison(next, false);
                    if (comparisonNoteTimerRef.current) clearTimeout(comparisonNoteTimerRef.current);
                    comparisonNoteTimerRef.current = setTimeout(() => queueComparisonDraft(comparisonFormRef.current), 350);
                  }}
                  onSubmit={() => void submitComparison()}
                  onAddRoundNote={(value) => void addNote(value)}
                />
              ) : (
                <RoundRatingPanel
                  form={roundForm}
                  locked={Boolean(activeCase.decision)}
                  disabled={controlsDisabled || !activeCase.review_ready}
                  saveState={saveState}
                  onVerdict={(value) => updateRound({ ...roundFormRef.current, overall_verdict: value })}
                  onScore={(key, value) => updateRound({
                    ...roundFormRef.current,
                    scores: { ...roundFormRef.current.scores, [key]: value }
                  })}
                  onIssue={(value) => {
                    const current = roundFormRef.current.issue_tags;
                    const nextTags = value === "no_material_issue"
                      ? current.includes(value) ? [] : [value]
                      : (() => {
                          const withoutNone = current.filter((item) => item !== "no_material_issue");
                          return withoutNone.includes(value)
                            ? withoutNone.filter((item) => item !== value)
                            : [...withoutNone, value];
                        })();
                    updateRound({ ...roundFormRef.current, issue_tags: nextTags });
                  }}
                  onNote={(value) => {
                    const next = { ...roundFormRef.current, note: value };
                    updateRound(next, false);
                    if (noteTimerRef.current) clearTimeout(noteTimerRef.current);
                    noteTimerRef.current = setTimeout(() => queueRoundDraft(roundFormRef.current), 350);
                  }}
                  onSubmit={() => void submitRound()}
                  onAddNote={(value) => void addNote(value)}
                />
              )}
            </div>
          </div>
        ) : (
          <p className="py-16 text-center text-sm text-[var(--text-dim)]">当前没有可读取的真人案例</p>
        )}
      </div>
    </Surface>
  );
}
