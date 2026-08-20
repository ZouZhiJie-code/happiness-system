import { cp, rm } from "node:fs/promises";
import { resolve } from "node:path";

const requireAdminRequest = vi.hoisted(() => vi.fn());

vi.mock("@/server/services/auth/admin-access", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/services/auth/admin-access")>();
  return { ...actual, requireAdminRequest };
});

import { GET, POST } from "@/app/admin/journal-evaluation/record-card-v3-daily/route";

const sourceDirectory = resolve(
  process.cwd(),
  "artifacts/journal-generation-evaluation/.private/formal/record-card-v3-daily/gi088-record-card-v3-daily-regression-ef57db76"
);
const testDirectory = resolve(
  process.cwd(),
  "artifacts/journal-generation-evaluation/.private/record-card-v3-daily-route-test"
);

function request(path: string, init?: RequestInit) {
  return new Request(`http://127.0.0.1${path}`, init);
}

async function setup() {
  await rm(testDirectory, { recursive: true, force: true });
  await cp(sourceDirectory, testDirectory, { recursive: true });
  vi.stubEnv("JOURNAL_EVALUATION_RECORD_CARD_V3_DAILY_DIRECTORY", testDirectory);
  vi.stubEnv("JOURNAL_EVALUATION_LOCAL_ENABLED", "I_UNDERSTAND");
  vi.stubEnv("VERCEL_ENV", "");
  vi.stubEnv(
    "DATABASE_URL",
    "postgresql://local:local@127.0.0.1:5432/happiness_system_codex?schema=journal_daily_eval"
  );
  vi.stubEnv(
    "DIRECT_URL",
    "postgresql://local:local@localhost:5432/happiness_system_codex?schema=journal_daily_eval"
  );
  requireAdminRequest.mockResolvedValue({ id: "daily-route-reviewer", username: "local-admin" });
}

afterEach(async () => {
  requireAdminRequest.mockReset();
  vi.unstubAllEnvs();
  await rm(testDirectory, { recursive: true, force: true });
});

describe("记录卡 v3 → 今日日记回归评审接口", () => {
  it("只展示六条日记，首评前隐藏程序检查，并能保存草稿后恢复", async () => {
    await setup();
    const listResponse = await GET(request("/admin/journal-evaluation/record-card-v3-daily"));
    expect(listResponse.status).toBe(200);
    const list = await listResponse.json() as { cases: Array<{ case_id: string; stage: string }> };
    expect(list.cases).toHaveLength(6);
    expect(list.cases.every((item) => item.stage === "daily_journal")).toBe(true);

    const caseResponse = await GET(request(
      `/admin/journal-evaluation/record-card-v3-daily?case_id=${list.cases[0].case_id}`
    ));
    const initial = await caseResponse.json() as {
      case: { presentation_id: string; daily_candidate: { paragraphs: string[]; program_check: unknown }; daily_draft: unknown };
    };
    expect(initial.case.daily_candidate.paragraphs.length).toBeGreaterThan(0);
    expect(initial.case.daily_candidate.program_check).toBeNull();
    expect(initial.case.daily_draft).toBeNull();

    const saved = await POST(request("/admin/journal-evaluation/record-card-v3-daily", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "save_daily_draft",
        case_id: list.cases[0].case_id,
        presentation_id: initial.case.presentation_id,
        overall_verdict: "ready_to_use",
        scores: {
          fidelity_completeness: 5,
          structure_coherence: 4,
          language_naturalness: 4,
          insight_integration: 4
        },
        daily_issue_tags: [],
        note: "先保存草稿"
      })
    }));
    expect(saved.status).toBe(200);
    await expect(saved.json()).resolves.toMatchObject({
      saved: true,
      case: { daily_draft: { note: "先保存草稿", revision: 1 } }
    });

    const restored = await GET(request(
      `/admin/journal-evaluation/record-card-v3-daily?case_id=${list.cases[0].case_id}`
    ));
    await expect(restored.json()).resolves.toMatchObject({
      case: { daily_draft: { note: "先保存草稿", scores: { language_naturalness: 4 } } }
    });
  });

  it("首次裁决锁定后揭示程序检查，重复裁决与过期展示版本被拒绝", async () => {
    await setup();
    const caseId = "extension-case-01";
    const response = await GET(request(`/admin/journal-evaluation/record-card-v3-daily?case_id=${caseId}`));
    const value = await response.json() as { case: { presentation_id: string } };
    const body = {
      action: "decide_daily",
      case_id: caseId,
      presentation_id: value.case.presentation_id,
      overall_verdict: "ready_to_use",
      scores: {
        fidelity_completeness: 5,
        structure_coherence: 5,
        language_naturalness: 5,
        insight_integration: 5
      },
      daily_issue_tags: [],
      note: "锁定"
    };
    const decided = await POST(request("/admin/journal-evaluation/record-card-v3-daily", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    }));
    expect(decided.status).toBe(200);
    await expect(decided.json()).resolves.toMatchObject({
      case: {
        daily_decision: { overall_verdict: "ready_to_use" },
        daily_candidate: { program_check: { admitted: true } }
      }
    });

    const duplicate = await POST(request("/admin/journal-evaluation/record-card-v3-daily", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    }));
    expect(duplicate.status).toBe(409);

    const stale = await POST(request("/admin/journal-evaluation/record-card-v3-daily", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...body, case_id: "extension-case-02" })
    }));
    expect(stale.status).toBe(409);
  });
});
