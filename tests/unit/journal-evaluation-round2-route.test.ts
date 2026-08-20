const requireAdminRequest = vi.hoisted(() => vi.fn());

vi.mock("@/server/services/auth/admin-access", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/services/auth/admin-access")>();
  return { ...actual, requireAdminRequest };
});

import { GET, POST } from "@/app/admin/journal-evaluation/round3/route";
import { createJournalRound3Fixture } from "./journal-evaluation-round3-fixture";

const fixtures: Array<Awaited<ReturnType<typeof createJournalRound3Fixture>>> = [];

async function setupFixture() {
  const fixture = await createJournalRound3Fixture();
  fixtures.push(fixture);
  vi.stubEnv("JOURNAL_EVALUATION_ROUND3_DIRECTORY", fixture.roundDirectory);
  vi.stubEnv("JOURNAL_EVALUATION_ROUND3_PARENT_DIRECTORY", fixture.parentDirectory);
  vi.stubEnv("JOURNAL_EVALUATION_MANIFEST_PATH", fixture.manifestPath);
  vi.stubEnv("JOURNAL_EVALUATION_ROUND3_ALLOW_MOCK", "I_UNDERSTAND");
  vi.stubEnv("JOURNAL_EVALUATION_LOCAL_ENABLED", "I_UNDERSTAND");
  vi.stubEnv(
    "DATABASE_URL",
    "postgresql://local:local@127.0.0.1:5432/happiness_system_codex?schema=journal_daily_eval"
  );
  vi.stubEnv(
    "DIRECT_URL",
    "postgresql://local:local@localhost:5432/happiness_system_codex?schema=journal_daily_eval"
  );
  vi.stubEnv("VERCEL_ENV", "");
  requireAdminRequest.mockResolvedValue({ id: fixture.reviewerId, username: "local-admin" });
  return fixture;
}

function post(body: Record<string, unknown>) {
  return POST(new Request("http://127.0.0.1/admin/journal-evaluation/round3", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  }));
}

afterEach(async () => {
  requireAdminRequest.mockReset();
  vi.unstubAllEnvs();
  await Promise.all(fixtures.splice(0).map((fixture) => fixture.cleanup()));
});

describe("journal evaluation round3 route", () => {
  it("通过本地隔离接口保存两阶段评价，并在新版锁定前隐藏 Prompt v2", async () => {
    await setupFixture();

    const listResponse = await GET(new Request("http://127.0.0.1/admin/journal-evaluation/round3"));
    expect(listResponse.status).toBe(200);
    const list = await listResponse.json() as { cases: Array<{ case_id: string }> };
    expect(list.cases).toHaveLength(3);
    const caseId = list.cases[0].case_id;

    const firstResponse = await GET(new Request(
      `http://127.0.0.1/admin/journal-evaluation/round3?case_id=${caseId}`
    ));
    const first = await firstResponse.json() as {
      case: {
        presentation_id: string;
        baseline: unknown;
        candidate: { paragraphs: string[]; program_check: unknown };
      };
    };
    expect(first.case.baseline).toBeNull();
    expect(first.case.candidate.paragraphs).toEqual(["第三轮日记正文 1"]);
    expect(first.case.candidate.program_check).toBeNull();

    const unknown = await post({
      action: "unknown_action",
      case_id: caseId,
      presentation_id: first.case.presentation_id
    });
    expect(unknown.status).toBe(400);
    await expect(unknown.json()).resolves.toEqual({ error: "JOURNAL_ROUND2_ACTION_INVALID" });

    const scores = {
      fidelity_completeness: 5,
      structure_coherence: 4,
      language_naturalness: 4,
      insight_integration: 5
    };
    const draft = await post({
      action: "save_round_draft",
      case_id: caseId,
      presentation_id: first.case.presentation_id,
      overall_verdict: "minor_edit",
      scores,
      issue_tags: ["fragmented_structure"],
      note: "接口草稿"
    });
    expect(draft.status).toBe(200);
    await expect(draft.json()).resolves.toMatchObject({
      saved: true,
      case: { baseline: null, draft: { note: "接口草稿" } }
    });

    const decision = await post({
      action: "decide_round",
      case_id: caseId,
      presentation_id: first.case.presentation_id,
      overall_verdict: "minor_edit",
      scores,
      issue_tags: ["fragmented_structure"],
      note: "接口首次裁决"
    });
    expect(decision.status).toBe(200);
    await expect(decision.json()).resolves.toMatchObject({
      saved: true,
      case: {
        status: "awaiting_comparison",
        decision: { note: "接口首次裁决" },
        candidate: { program_check: { admitted: true, failures: [] } },
        baseline: {
          paragraphs: ["Prompt v2 日记正文 1"],
          locked_review: {
            scores: { language_naturalness: 3 },
            note: "Prompt v2 首次评价 1",
            note_additions: [{ note: "Prompt v2 补充评价 1" }],
            comparison_verdict: "material_improvement"
          }
        }
      }
    });

    const comparisonDraft = await post({
      action: "save_comparison_draft",
      case_id: caseId,
      presentation_id: first.case.presentation_id,
      comparison_verdict: "slight_improvement",
      note: "接口对比草稿"
    });
    expect(comparisonDraft.status).toBe(200);
    await expect(comparisonDraft.json()).resolves.toMatchObject({
      case: { comparison_draft: { note: "接口对比草稿" } }
    });

    const comparisonDecision = await post({
      action: "decide_comparison",
      case_id: caseId,
      presentation_id: first.case.presentation_id,
      comparison_verdict: "slight_improvement",
      note: "接口对比裁决"
    });
    expect(comparisonDecision.status).toBe(200);
    await expect(comparisonDecision.json()).resolves.toMatchObject({
      case: { status: "completed", comparison_decision: { note: "接口对比裁决" } }
    });
  });

  it("共享地址、生产地址与错误评审人均无法打开本地第三轮入口", async () => {
    await setupFixture();
    const nonLocal = await GET(new Request("https://dailylight.chat/admin/journal-evaluation/round3"));
    expect(nonLocal.status).toBe(404);

    requireAdminRequest.mockRejectedValueOnce(new Error("ADMIN_FORBIDDEN"));
    const forbidden = await GET(new Request("http://127.0.0.1/admin/journal-evaluation/round3"));
    expect(forbidden.status).toBe(400);
  });
});
