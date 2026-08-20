const loader = vi.hoisted(() => ({
  decide: vi.fn(),
  list: vi.fn(),
  load: vi.fn(),
  saveDraft: vi.fn()
}));
const requireAdminRequest = vi.hoisted(() => vi.fn());

vi.mock("@/app/admin/journal-evaluation/record-rewrite-v3-loader", () => ({
  decideJournalRecordRewriteV3: loader.decide,
  listJournalRecordRewriteV3Cases: loader.list,
  loadJournalRecordRewriteV3Case: loader.load,
  saveJournalRecordRewriteV3Draft: loader.saveDraft
}));

vi.mock("@/server/services/auth/admin-access", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/services/auth/admin-access")>();
  return { ...actual, requireAdminRequest };
});

import { GET, POST } from "@/app/api/admin/journal-evaluation/record-rewrite-v3/route";

const path = "/api/admin/journal-evaluation/record-rewrite-v3";
const form = {
  overall_verdict: "ready_to_use" as const,
  scores: {
    fidelity_completeness: 5 as const,
    structure_coherence: 5 as const,
    language_naturalness: 5 as const,
    insight_integration: 5 as const
  },
  issue_tags: ["no_material_issue" as const],
  comparison_verdict: "material_improvement" as const,
  note: "本地评审"
};

function request(url = path, init?: RequestInit) {
  return new Request(`http://127.0.0.1${url}`, init);
}

beforeEach(() => {
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
  requireAdminRequest.mockResolvedValue({ id: "local-reviewer", username: "local-admin" });
  loader.list.mockResolvedValue({ cases: [{ case_id: "case-1" }] });
  loader.load.mockResolvedValue({ public_case_id: "case-1", presentation_id: "presentation-1" });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("记录卡 v3 历史评审接口", () => {
  it("通过独立 API 路径读取列表并保存草稿", async () => {
    const listed = await GET(request());
    expect(listed.status).toBe(200);
    await expect(listed.json()).resolves.toEqual({ cases: [{ case_id: "case-1" }] });

    const saved = await POST(request(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "save_draft",
        case_id: "case-1",
        presentation_id: "presentation-1",
        form
      })
    }));
    expect(saved.status).toBe(200);
    expect(loader.saveDraft).toHaveBeenCalledWith({
      publicCaseId: "case-1",
      presentationId: "presentation-1",
      reviewerId: "local-reviewer",
      form
    });
  });

  it("共享域名与远程运行环境保持关闭", async () => {
    expect((await GET(new Request(`https://dailylight.chat${path}`))).status).toBe(404);
    vi.stubEnv("VERCEL_ENV", "preview");
    expect((await GET(request())).status).toBe(404);
  });
});
