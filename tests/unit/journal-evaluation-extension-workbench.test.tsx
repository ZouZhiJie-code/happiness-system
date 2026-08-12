import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { JournalExtensionWorkbench } from "@/components/journal-evaluation/journal-extension-workbench";
import type {
  JournalExtensionCaseSummary,
  JournalExtensionCaseView,
  JournalExtensionRecordDraftView
} from "@/components/journal-evaluation/types";

function extensionCase(input: {
  caseId: string;
  label: string;
  presentationId: string;
  draft?: JournalExtensionRecordDraftView | null;
}): JournalExtensionCaseView {
  const modelCard = {
    record_card_id: `${input.caseId}-record`,
    title: `记录 ${input.caseId}`,
    text: `MODEL_${input.caseId}_BODY`,
    insight: `MODEL_${input.caseId}_INSIGHT`,
    source_refs: [`${input.caseId}-u1`]
  };
  return {
    case_id: input.caseId,
    label: input.label,
    stage: "record_card",
    status: input.draft?.overall_verdict === "minor_edit" ? "editing_required" : "awaiting_review",
    presentation_id: input.presentationId,
    review_ready: true,
    transcript: [
      { message_id: `${input.caseId}-a1`, role: "assistant", content: "这件事当时是怎样发生的？" },
      { message_id: `${input.caseId}-u1`, role: "user", content: `TRANSCRIPT_${input.caseId}` }
    ],
    model_record_card: modelCard,
    occurred_at_text: null,
    program_check: null,
    record_draft: input.draft ?? null,
    record_decision: null,
    record_confirmation: null,
    daily_candidate: null,
    daily_draft: null,
    daily_decision: null,
    gate: {
      stage: "record_card",
      state: "pending",
      confirmed_records: 0,
      reviewed_diaries: 0,
      total_cases: 6,
      reasons: ["已确认 0/6 张记录卡"]
    }
  };
}

function response(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" }
  });
}

describe("六条真人轨迹扩展评审台", () => {
  const summaries: JournalExtensionCaseSummary[] = [
    {
      case_id: "extension-case-01",
      label: "案例 01",
      status: "awaiting_review",
      stage: "record_card",
      review_ready: true
    },
    {
      case_id: "extension-case-02",
      label: "案例 02",
      status: "awaiting_review",
      stage: "record_card",
      review_ready: true
    }
  ];

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("选择先写入服务端，快速切换与重新打开都恢复完整草稿", async () => {
    const drafts = new Map<string, JournalExtensionRecordDraftView>();
    const requestOrder: string[] = [];
    let releaseFirstSave: (() => void) | null = null;
    let signalFirstSave: (() => void) | null = null;
    const firstSaveGate = new Promise<void>((resolve) => { releaseFirstSave = resolve; });
    const firstSaveStarted = new Promise<void>((resolve) => { signalFirstSave = resolve; });
    let saveCount = 0;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/admin/journal-evaluation/extension" && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as Record<string, unknown> & {
          action: string;
          case_id: string;
          presentation_id: string;
        };
        if (body.action === "save_record_draft") {
          saveCount += 1;
          if (saveCount === 1) {
            signalFirstSave?.();
            await firstSaveGate;
          }
          requestOrder.push(`save:${body.case_id}`);
          const card = body.edited_record_card as JournalExtensionRecordDraftView["edited_record_card"];
          const draft: JournalExtensionRecordDraftView = {
            case_id: body.case_id,
            presentation_id: body.presentation_id,
            overall_verdict: body.overall_verdict as JournalExtensionRecordDraftView["overall_verdict"],
            issue_tags: body.issue_tags as JournalExtensionRecordDraftView["issue_tags"],
            note: String(body.note ?? ""),
            edited_record_card: card,
            revision: (drafts.get(body.case_id)?.revision ?? 0) + 1,
            updated_at: "2026-08-11T00:00:00.000Z"
          };
          drafts.set(body.case_id, draft);
          return response({ saved: true, case: extensionCase({
            caseId: body.case_id,
            label: body.case_id.endsWith("01") ? "案例 01" : "案例 02",
            presentationId: body.presentation_id,
            draft
          }) });
        }
      }
      if (url === "/admin/journal-evaluation/extension") return response({ cases: summaries });
      const caseId = new URL(`http://local${url}`).searchParams.get("case_id") ?? "";
      requestOrder.push(`load:${caseId}`);
      return response({ case: extensionCase({
        caseId,
        label: caseId.endsWith("01") ? "案例 01" : "案例 02",
        presentationId: `presentation-${caseId}`,
        draft: drafts.get(caseId) ?? null
      }) });
    }));

    const mounted = render(<JournalExtensionWorkbench />);
    fireEvent.click(await screen.findByRole("button", { name: "轻微修改" }));
    fireEvent.click(screen.getByRole("button", { name: /案例 02\s+待评价/u }));
    await act(async () => { await firstSaveStarted; });
    await act(async () => releaseFirstSave?.());
    await waitFor(() => expect(
      screen.getByRole("button", { name: /案例 02\s+待评价/u })
    ).toHaveAttribute("aria-current", "page"));
    expect(requestOrder.indexOf("save:extension-case-01"))
      .toBeLessThan(requestOrder.indexOf("load:extension-case-02"));

    fireEvent.click(screen.getByRole("button", { name: /案例 01\s+待编辑确认/u }));
    await waitFor(() => expect(screen.getByRole("button", { name: "轻微修改" }))
      .toHaveAttribute("aria-pressed", "true"));
    expect(screen.getByLabelText("事件正文")).toHaveValue("MODEL_extension-case-01_BODY");

    mounted.unmount();
    render(<JournalExtensionWorkbench />);
    await waitFor(() => expect(screen.getByRole("button", { name: "轻微修改" }))
      .toHaveAttribute("aria-pressed", "true"));
    expect(screen.getByText("已恢复服务端草稿")).toBeInTheDocument();
  });

  it("轻微修改需要真实改动，评价区与完整对话在同一页面持续可见", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/admin/journal-evaluation/extension" && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as Record<string, unknown>;
        return response({ saved: true, case: extensionCase({
          caseId: String(body.case_id),
          label: "案例 01",
          presentationId: String(body.presentation_id),
          draft: {
            case_id: String(body.case_id),
            presentation_id: String(body.presentation_id),
            overall_verdict: body.overall_verdict as JournalExtensionRecordDraftView["overall_verdict"],
            issue_tags: body.issue_tags as JournalExtensionRecordDraftView["issue_tags"],
            note: String(body.note ?? ""),
            edited_record_card: body.edited_record_card as JournalExtensionRecordDraftView["edited_record_card"],
            revision: 1,
            updated_at: "2026-08-11T00:00:00.000Z"
          }
        }) });
      }
      if (url === "/admin/journal-evaluation/extension") {
        return response({ cases: [summaries[0]] });
      }
      return response({ case: extensionCase({
        caseId: "extension-case-01",
        label: "案例 01",
        presentationId: "presentation-extension-case-01"
      }) });
    }));

    render(<JournalExtensionWorkbench />);
    expect(await screen.findByText("TRANSCRIPT_extension-case-01")).toBeInTheDocument();
    expect(screen.getByText("MODEL_extension-case-01_BODY")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "轻微修改" }));
    const submit = screen.getByRole("button", { name: "确认编辑稿并锁定评价" });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByLabelText("事件正文"), {
      target: { value: "MODEL_extension-case-01_BODY\n已完成轻微修改" }
    });
    await waitFor(() => expect(submit).toBeEnabled());
  });
});
