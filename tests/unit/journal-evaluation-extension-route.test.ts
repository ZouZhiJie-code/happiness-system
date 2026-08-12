const requireAdminRequest = vi.hoisted(() => vi.fn());

vi.mock("@/server/services/auth/admin-access", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/services/auth/admin-access")>();
  return { ...actual, requireAdminRequest };
});

import { GET, POST } from "@/app/admin/journal-evaluation/extension/route";
import { createJournalExtensionFixture } from "./journal-evaluation-extension-fixture";

const fixtures: Array<Awaited<ReturnType<typeof createJournalExtensionFixture>>> = [];

async function setupFixture() {
  const fixture = await createJournalExtensionFixture({ withRecordConfirmations: false });
  fixtures.push(fixture);
  vi.stubEnv("JOURNAL_EVALUATION_EXTENSION_RECORD_DIRECTORY", fixture.recordResult.outputDirectory);
  vi.stubEnv(
    "JOURNAL_EVALUATION_EXTENSION_RECORD_ADMISSION_DIRECTORY",
    fixture.recordAdmissionResult.outputDirectory
  );
  vi.stubEnv("JOURNAL_EVALUATION_EXTENSION_ALLOW_MOCK", "I_UNDERSTAND");
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
  return POST(new Request("http://127.0.0.1/admin/journal-evaluation/extension", {
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

describe("六条真人扩展本地评审接口", () => {
  it("本地管理员可以保存并回读，未知动作和过期页面会被拒绝", async () => {
    await setupFixture();
    const listResponse = await GET(new Request("http://127.0.0.1/admin/journal-evaluation/extension"));
    expect(listResponse.status).toBe(200);
    const list = await listResponse.json() as { cases: Array<{ case_id: string }> };
    expect(list.cases).toHaveLength(6);
    const caseId = list.cases[0].case_id;
    const caseResponse = await GET(new Request(
      `http://127.0.0.1/admin/journal-evaluation/extension?case_id=${caseId}`
    ));
    const body = await caseResponse.json() as {
      case: {
        presentation_id: string;
        model_record_card: { title: string; text: string; insight: string };
        program_check: unknown;
      };
    };
    expect(body.case.program_check).toBeNull();

    const unknown = await post({
      action: "unknown",
      case_id: caseId,
      presentation_id: body.case.presentation_id
    });
    expect(unknown.status).toBe(400);
    await expect(unknown.json()).resolves.toEqual({ error: "JOURNAL_EXTENSION_ACTION_INVALID" });

    const stale = await post({
      action: "save_record_draft",
      case_id: caseId,
      presentation_id: "stale-presentation",
      overall_verdict: "ready_to_use",
      issue_tags: [],
      note: "过期页面",
      edited_record_card: body.case.model_record_card
    });
    expect(stale.status).toBe(400);
    await expect(stale.json()).resolves.toEqual({ error: "JOURNAL_EXTENSION_PRESENTATION_MISMATCH" });

    const saved = await post({
      action: "save_record_draft",
      case_id: caseId,
      presentation_id: body.case.presentation_id,
      overall_verdict: "ready_to_use",
      issue_tags: ["no_material_issue"],
      note: "接口自动保存",
      edited_record_card: body.case.model_record_card
    });
    expect(saved.status).toBe(200);
    await expect(saved.json()).resolves.toMatchObject({
      saved: true,
      case: { record_draft: { note: "接口自动保存", revision: 1 } }
    });
  });

  it("共享地址与生产环境上下文无法打开私有评审入口", async () => {
    await setupFixture();
    expect((await GET(new Request(
      "https://dailylight.chat/admin/journal-evaluation/extension"
    ))).status).toBe(404);
    vi.stubEnv("VERCEL_ENV", "preview");
    expect((await GET(new Request(
      "http://127.0.0.1/admin/journal-evaluation/extension"
    ))).status).toBe(404);
  });
});
