import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { JournalRecordRewriteWorkbench } from "@/components/journal-evaluation/journal-record-rewrite-workbench";
import type {
  JournalRecordRewriteCaseSummary,
  JournalRecordRewriteCaseView,
  JournalRecordRewriteReviewForm
} from "@/components/journal-evaluation/types";

const summaries: JournalRecordRewriteCaseSummary[] = [
  { case_id: "record-rewrite-case-01", label: "v6 A1", status: "not_started", review_ready: true },
  { case_id: "record-rewrite-case-02", label: "v7 A1", status: "not_started", review_ready: true }
];

function evaluationCase(input: {
  caseId: string;
  draft?: JournalRecordRewriteCaseView["draft"];
  decision?: JournalRecordRewriteCaseView["decision"];
}): JournalRecordRewriteCaseView {
  return {
    case_id: input.caseId,
    label: input.caseId.endsWith("01") ? "v6 A1" : "v7 A1",
    presentation_id: `presentation-${input.caseId}`,
    status: input.decision ? "completed" : input.draft ? "in_progress" : "not_started",
    review_ready: true,
    transcript: [
      { message_id: `${input.caseId}-a1`, role: "assistant", content: "当时发生了什么？" },
      { message_id: `${input.caseId}-u1`, role: "user", content: `TRANSCRIPT_${input.caseId}` }
    ],
    baseline_record_card: {
      record_card_id: `old-${input.caseId}`,
      title: "当前标题",
      text: `OLD_${input.caseId}`,
      insight: "旧认识区",
      source_refs: ["u1"]
    },
    baseline_feedback: {
      overall_verdict: "minor_edit",
      scores: {
        fidelity_completeness: 5,
        structure_coherence: 3,
        language_naturalness: 3,
        insight_integration: 4
      },
      issue_tags: ["unnatural_language"],
      comparison_verdict: "no_change",
      note: "语言生硬"
    },
    candidate_record_card: {
      record_card_id: `new-${input.caseId}`,
      title: "新版标题",
      text: `NEW_${input.caseId}`,
      insight: "",
      source_refs: ["u1"]
    },
    objective_issue_count: 0,
    objective_admitted: true,
    mechanical_review_projection: false,
    material_reveal: input.decision ? {
      material_units: [{
        unit_id: "M1",
        core_meaning: "我对这件事的真实感受",
        evidence_spans: [{ source_ref: "u1", quote: `TRANSCRIPT_${input.caseId}` }],
        valid_insight_refs: ["s1"],
        excluded_interaction_spans: []
      }],
      failures: [],
      diagnostics: { qa_process_residue: [] }
    } : null,
    draft: input.draft ?? null,
    decision: input.decision ?? null,
    gate: { state: "pending", completed_cases: 0, total_cases: 6, ready_to_use_cases: 0, reasons: [] }
  };
}

function response(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("新版记录卡对比评审台", () => {
  it("同屏展示完整对话、当前卡片和新版卡片", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/admin/journal-evaluation/record-rewrite") return response({ cases: [summaries[0]] });
      return response({ case: evaluationCase({ caseId: "record-rewrite-case-01" }) });
    }));
    render(<JournalRecordRewriteWorkbench />);
    expect(await screen.findByText("TRANSCRIPT_record-rewrite-case-01")).toBeInTheDocument();
    expect(screen.getByText("OLD_record-rewrite-case-01")).toBeInTheDocument();
    expect(screen.getByText("NEW_record-rewrite-case-01")).toBeInTheDocument();
    expect(screen.getAllByText("语言生硬")).toHaveLength(2);
    expect(screen.queryByText("材料单元与来源核对")).not.toBeInTheDocument();
  });

  it("评价锁定后才揭示材料单元和来源片段", async () => {
    const decision: NonNullable<JournalRecordRewriteCaseView["decision"]> = {
      overall_verdict: "ready_to_use",
      scores: {
        fidelity_completeness: 5,
        structure_coherence: 5,
        language_naturalness: 5,
        insight_integration: 5
      },
      issue_tags: ["no_material_issue"],
      comparison_verdict: "material_improvement",
      note: "可直接使用",
      reviewed_at: "2026-08-11T00:00:00.000Z"
    };
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/admin/journal-evaluation/record-rewrite") {
        return response({ cases: [{ ...summaries[0], status: "completed" }] });
      }
      return response({ case: evaluationCase({
        caseId: "record-rewrite-case-01",
        decision
      }) });
    }));
    render(<JournalRecordRewriteWorkbench />);
    expect(await screen.findByText("材料单元与来源核对")).toBeInTheDocument();
    expect(screen.getByText("我对这件事的真实感受")).toBeInTheDocument();
    expect(screen.getAllByText(/TRANSCRIPT_record-rewrite-case-01/u)).toHaveLength(2);
  });

  it("选择先保存到服务端，快速切换和重新打开后恢复", async () => {
    const drafts = new Map<string, JournalRecordRewriteCaseView["draft"]>();
    let releaseSave: (() => void) | null = null;
    let signalSave: (() => void) | null = null;
    const saveGate = new Promise<void>((resolve) => { releaseSave = resolve; });
    const saveStarted = new Promise<void>((resolve) => { signalSave = resolve; });
    let firstSave = true;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/admin/journal-evaluation/record-rewrite" && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as {
          case_id: string;
          form: JournalRecordRewriteReviewForm;
        };
        if (firstSave) {
          firstSave = false;
          signalSave?.();
          await saveGate;
        }
        const draft = {
          ...body.form,
          revision: (drafts.get(body.case_id)?.revision ?? 0) + 1,
          updated_at: "2026-08-11T00:00:00.000Z"
        };
        drafts.set(body.case_id, draft);
        return response({ case: evaluationCase({ caseId: body.case_id, draft }) });
      }
      if (url === "/admin/journal-evaluation/record-rewrite") return response({ cases: summaries });
      const caseId = new URL(`http://local${url}`).searchParams.get("case_id")!;
      return response({ case: evaluationCase({ caseId, draft: drafts.get(caseId) }) });
    }));

    const mounted = render(<JournalRecordRewriteWorkbench />);
    fireEvent.click(await screen.findByRole("button", { name: "可直接使用" }));
    fireEvent.click(screen.getByRole("button", { name: /v7 A1/u }));
    await act(async () => { await saveStarted; });
    await act(async () => releaseSave?.());
    await waitFor(() => expect(screen.getByRole("button", { name: /v7 A1/u }))
      .toHaveAttribute("aria-current", "page"));
    fireEvent.click(screen.getByRole("button", { name: /v6 A1/u }));
    await waitFor(() => expect(screen.getByRole("button", { name: "可直接使用" }))
      .toHaveAttribute("aria-pressed", "true"));

    mounted.unmount();
    render(<JournalRecordRewriteWorkbench />);
    await waitFor(() => expect(screen.getByRole("button", { name: "可直接使用" }))
      .toHaveAttribute("aria-pressed", "true"));
    expect(screen.getByText("已恢复服务端草稿")).toBeInTheDocument();
  });

  it("锁定成功后自动进入下一条未完成案例", async () => {
    const drafts = new Map<string, JournalRecordRewriteCaseView["draft"]>();
    let locked = false;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/admin/journal-evaluation/record-rewrite" && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as {
          action: "save_draft" | "decide";
          case_id: string;
          form: JournalRecordRewriteReviewForm;
        };
        if (body.action === "decide") {
          locked = true;
          return response({
            case: evaluationCase({
              caseId: body.case_id,
              decision: {
                ...body.form,
                overall_verdict: body.form.overall_verdict!,
                comparison_verdict: body.form.comparison_verdict!,
                reviewed_at: "2026-08-11T00:00:00.000Z"
              }
            })
          });
        }
        const draft = {
          ...body.form,
          revision: (drafts.get(body.case_id)?.revision ?? 0) + 1,
          updated_at: "2026-08-11T00:00:00.000Z"
        };
        drafts.set(body.case_id, draft);
        return response({ case: evaluationCase({ caseId: body.case_id, draft }) });
      }
      if (url === "/admin/journal-evaluation/record-rewrite") {
        return response({
          cases: summaries.map((item, index) => index === 0 && locked
            ? { ...item, status: "completed" as const }
            : item)
        });
      }
      const caseId = new URL(`http://local${url}`).searchParams.get("case_id")!;
      return response({ case: evaluationCase({ caseId, draft: drafts.get(caseId) }) });
    }));

    render(<JournalRecordRewriteWorkbench />);
    await screen.findByText("TRANSCRIPT_record-rewrite-case-01");
    fireEvent.click(screen.getByRole("button", { name: "可直接使用" }));
    for (const button of screen.getAllByRole("button", { name: "5" })) {
      fireEvent.click(button);
    }
    fireEvent.click(screen.getByRole("button", { name: "无明显问题" }));
    fireEvent.click(screen.getByRole("button", { name: "明显改善" }));
    fireEvent.click(screen.getByRole("button", { name: "锁定本案例评价" }));

    await waitFor(() => expect(screen.getByText("TRANSCRIPT_record-rewrite-case-02"))
      .toBeInTheDocument());
    expect(screen.getByRole("button", { name: /v7 A1/u })).toHaveAttribute("aria-current", "page");
  });
});
