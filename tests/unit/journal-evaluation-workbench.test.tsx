import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { JournalEvaluationWorkbench } from "@/components/journal-evaluation/journal-evaluation-workbench";
import type {
  JournalRound2CaseSummary,
  JournalRound2CaseView,
  JournalRound2DraftView
} from "@/components/journal-evaluation/types";

function caseView(input: {
  caseId: string;
  label: string;
  presentationId: string;
  draft?: JournalRound2DraftView | null;
  decided?: boolean;
  compared?: boolean;
  blocked?: boolean;
}): JournalRound2CaseView {
  return {
    case_id: input.caseId,
    label: input.label,
    round_id: "flash-daily-context-v3",
    presentation_id: input.presentationId,
    status: input.blocked ? "blocked" : input.compared ? "completed" : input.decided ? "awaiting_comparison"
      : input.draft ? "in_progress" : "not_started",
    review_ready: !input.blocked,
    transcript: [
      { message_id: `${input.caseId}-a1`, role: "assistant", content: "你当时最在意什么？" },
      { message_id: `${input.caseId}-u1`, role: "user", content: "我想把这件事认真完成。" }
    ],
    candidate: {
      title: "2026年8月11日 周二",
      record_card: {
        record_card_id: `${input.caseId}-record`,
        title: "认真完成这件事",
        text: "我想把这件事认真完成。",
        insight: "我在意的是把事情稳稳地收住。",
        source_refs: [`${input.caseId}-u1`]
      },
      paragraphs: [`NEW_${input.caseId}_BODY`],
      paragraph_sources: [{
        source_refs: [`${input.caseId}-u1`],
        record_card_refs: [`${input.caseId}-record`]
      }],
      program_check: {
        admitted: !input.blocked,
        metrics: {},
        failures: input.blocked ? [{
          code: "SOURCE_COVERAGE_FAILED",
          message: "来源覆盖检查未通过",
          refs: [`${input.caseId}-u1`]
        }] : []
      }
    },
    baseline: input.decided ? {
      title: "首轮日记",
      paragraphs: [`OLD_${input.caseId}_BODY`],
      paragraph_sources: [{
        source_refs: [`${input.caseId}-u1`],
        record_card_refs: [`${input.caseId}-record`]
      }],
      locked_review: {
        overall_verdict: "minor_edit",
        scores: {
          fidelity_completeness: 5,
          structure_coherence: 3,
          language_naturalness: 3,
          insight_integration: 3
        },
        issue_tags: ["unnatural_language", "insight_not_integrated"],
        note: "OLD_LOCKED_NOTE",
        note_additions: [{ note: "OLD_ADDED_NOTE", added_at: "2026-08-11T00:30:00.000Z" }],
        reviewed_at: "2026-08-11T00:00:00.000Z",
        comparison_verdict: "material_improvement",
        comparison_note: "OLD_COMPARISON_NOTE"
      }
    } : null,
    decision: input.decided ? {
      case_id: input.caseId,
      round_id: "flash-daily-context-v3",
      presentation_id: input.presentationId,
      overall_verdict: "ready_to_use",
      scores: {
        fidelity_completeness: 5,
        structure_coherence: 4,
        language_naturalness: 4,
        insight_integration: 4
      },
      issue_tags: [],
      note: "新版更连贯",
      reviewed_at: "2026-08-11T01:00:00.000Z",
      note_additions: []
    } : null,
    draft: input.decided ? null : input.draft ?? null,
    comparison_decision: input.compared ? {
      case_id: input.caseId,
      round_id: "flash-daily-context-v3",
      presentation_id: input.presentationId,
      comparison_verdict: "material_improvement",
      note: "明显改善",
      reviewed_at: "2026-08-11T02:00:00.000Z"
    } : null,
    comparison_draft: null,
    gate: { state: "pending", completed_cases: input.compared ? 1 : 0, total_cases: 3, reasons: [] }
  };
}

function response(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" }
  });
}

describe("Flash 今日日记第三轮评审台", () => {
  const summaries: JournalRound2CaseSummary[] = [
    { case_id: "case-01", label: "案例 01", status: "not_started", review_ready: true },
    { case_id: "case-02", label: "案例 02", status: "not_started", review_ready: true }
  ];

  it("每次选择先保存到服务端，快速切换后回读原案例仍完整恢复", async () => {
    const drafts = new Map<string, JournalRound2DraftView>();
    const requestOrder: string[] = [];
    let releaseFirstSave: (() => void) | null = null;
    let signalFirstSave: (() => void) | null = null;
    const firstSaveGate = new Promise<void>((resolve) => { releaseFirstSave = resolve; });
    const firstSaveStarted = new Promise<void>((resolve) => { signalFirstSave = resolve; });
    let saveCount = 0;

    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/admin/journal-evaluation/round3" && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as Record<string, unknown> & {
          action: string;
          case_id: string;
          presentation_id: string;
        };
        if (body.action === "save_round_draft") {
          saveCount += 1;
          if (saveCount === 1) {
            signalFirstSave?.();
            await firstSaveGate;
          }
          requestOrder.push(`save:${body.case_id}`);
          const draft: JournalRound2DraftView = {
            case_id: body.case_id,
            round_id: "flash-daily-context-v3",
            presentation_id: body.presentation_id,
            overall_verdict: body.overall_verdict as JournalRound2DraftView["overall_verdict"],
            scores: body.scores as JournalRound2DraftView["scores"],
            issue_tags: body.issue_tags as JournalRound2DraftView["issue_tags"],
            note: String(body.note ?? ""),
            revision: (drafts.get(body.case_id)?.revision ?? 0) + 1,
            updated_at: "2026-08-11T00:00:00.000Z"
          };
          drafts.set(body.case_id, draft);
          return response({ saved: true, case: caseView({
            caseId: body.case_id,
            label: body.case_id === "case-01" ? "案例 01" : "案例 02",
            presentationId: body.presentation_id,
            draft
          }) });
        }
      }
      if (url === "/admin/journal-evaluation/round3") return response({ cases: summaries });
      const caseId = new URL(`http://local${url}`).searchParams.get("case_id") ?? "";
      requestOrder.push(`load:${caseId}`);
      return response({ case: caseView({
        caseId,
        label: caseId === "case-01" ? "案例 01" : "案例 02",
        presentationId: `presentation-${caseId}`,
        draft: drafts.get(caseId) ?? null
      }) });
    }));

    render(<JournalEvaluationWorkbench />);
    const verdict = await screen.findByRole("button", { name: "总体裁决：轻微修改" });
    fireEvent.click(verdict);
    const caseTwo = screen.getByRole("button", { name: /案例 02\s+未开始/u });
    fireEvent.click(caseTwo);
    await act(async () => { await firstSaveStarted; });
    expect(caseTwo).toBeDisabled();
    await act(async () => releaseFirstSave?.());
    await waitFor(() => expect(caseTwo).toHaveAttribute("aria-current", "page"));
    expect(requestOrder.indexOf("save:case-01")).toBeLessThan(requestOrder.indexOf("load:case-02"));

    fireEvent.click(screen.getByRole("button", { name: /案例 01\s+评价中/u }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "总体裁决：轻微修改" }))
        .toHaveAttribute("aria-pressed", "true");
    });
  });

  it("新版裁决前隐藏首轮内容，锁定后才展示旧日记与原评价", async () => {
    const postedActions: Array<Record<string, unknown>> = [];
    let current = caseView({
      caseId: "case-01",
      label: "案例 01",
      presentationId: "presentation-case-01"
    });
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/admin/journal-evaluation/round3" && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as Record<string, unknown> & { action: string };
        postedActions.push(body);
        if (body.action === "decide_round") {
          current = caseView({
            caseId: "case-01",
            label: "案例 01",
            presentationId: "presentation-case-01",
            decided: true
          });
        }
        return response({ saved: true, case: current });
      }
      if (url === "/admin/journal-evaluation/round3") {
        return response({ cases: [summaries[0]] });
      }
      return response({ case: current });
    }));

    render(<JournalEvaluationWorkbench />);
    expect(await screen.findByText("NEW_case-01_BODY")).toBeInTheDocument();
    expect(screen.queryByText("来源检查通过")).not.toBeInTheDocument();
    expect(screen.queryByText("程序检查通过")).not.toBeInTheDocument();
    expect(screen.queryByText("OLD_case-01_BODY")).not.toBeInTheDocument();
    expect(screen.queryByText("OLD_LOCKED_NOTE")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "总体裁决：可直接使用" }));
    for (const group of ["内容忠实与完整", "结构与连贯性", "语言自然度", "认识融入"]) {
      fireEvent.click(screen.getByRole("button", { name: `${group}：4 分` }));
    }
    fireEvent.click(screen.getByRole("button", { name: "锁定新版评价并进入对比" }));

    expect(await screen.findByText("OLD_case-01_BODY")).toBeInTheDocument();
    expect(screen.getByText("程序检查通过")).toBeInTheDocument();
    expect(screen.getByText("OLD_LOCKED_NOTE")).toBeInTheDocument();
    expect(screen.getByText("OLD_ADDED_NOTE")).toBeInTheDocument();
    expect(screen.getByText("OLD_COMPARISON_NOTE")).toBeInTheDocument();
    expect(screen.getByText(/Prompt v2 相比首轮：明显改善/u)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "改版效果：明显改善" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("补充新版评价备注"), {
      target: { value: "进入对比后补充的观察" }
    });
    fireEvent.click(screen.getByRole("button", { name: "保存补充备注" }));
    await waitFor(() => expect(postedActions).toContainEqual(expect.objectContaining({
      action: "add_round_note",
      note: "进入对比后补充的观察"
    })));
  });

  it("客观阻断在首裁前只显示中性状态，并隐藏检查码且禁用评价", async () => {
    const blocked = caseView({
      caseId: "case-01",
      label: "案例 01",
      presentationId: "presentation-case-01",
      blocked: true
    });
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/admin/journal-evaluation/round3") {
        return response({
          cases: [{ case_id: "case-01", label: "案例 01", status: "blocked", review_ready: false }]
        });
      }
      return response({ case: blocked });
    }));

    render(<JournalEvaluationWorkbench />);
    expect(await screen.findByText("结果暂不可评审。请等待可评审结果更新后继续。")).toBeInTheDocument();
    expect(screen.queryByText("SOURCE_COVERAGE_FAILED", { exact: false })).not.toBeInTheDocument();
    expect(screen.queryByText("程序检查阻断")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "总体裁决：可直接使用" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "锁定新版评价并进入对比" })).toBeDisabled();
  });

  it("刷新式重新挂载会从服务端草稿恢复所有评分字段", async () => {
    const draft: JournalRound2DraftView = {
      case_id: "case-01",
      round_id: "flash-daily-context-v3",
      presentation_id: "presentation-case-01",
      overall_verdict: "minor_edit",
      scores: {
        fidelity_completeness: 5,
        structure_coherence: 4,
        language_naturalness: 4,
        insight_integration: 5
      },
      issue_tags: ["unnatural_language"],
      note: "已保存草稿",
      revision: 7,
      updated_at: "2026-08-11T00:00:00.000Z"
    };
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/admin/journal-evaluation/round3") return response({ cases: [summaries[0]] });
      return response({ case: caseView({
        caseId: "case-01",
        label: "案例 01",
        presentationId: "presentation-case-01",
        draft
      }) });
    }));

    const first = render(<JournalEvaluationWorkbench />);
    expect(await screen.findByDisplayValue("已保存草稿")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "内容忠实与完整：5 分" }))
      .toHaveAttribute("aria-pressed", "true");
    first.unmount();
    render(<JournalEvaluationWorkbench />);
    expect(await screen.findByDisplayValue("已保存草稿")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "问题标签：语言不自然" }))
      .toHaveAttribute("aria-pressed", "true");
  });
});
