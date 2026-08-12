import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

const requireAdminRequest = vi.hoisted(() => vi.fn());

vi.mock("@/server/services/auth/admin-access", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/services/auth/admin-access")>();
  return { ...actual, requireAdminRequest };
});

import { GET, POST } from "@/app/admin/journal-evaluation/private/route";

const PRIVATE_TEST_ROOT = join(
  process.cwd(),
  "artifacts/journal-generation-evaluation/.private/test-runtime"
);
const temporaryRoots: string[] = [];

async function makePrivateTestRoot(prefix: string) {
  await mkdir(PRIVATE_TEST_ROOT, { recursive: true });
  const root = await mkdtemp(join(PRIVATE_TEST_ROOT, prefix));
  temporaryRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("journal evaluation private route", () => {
  it("首次响应保持完全盲测，首份裁决保存后才返回揭示字段", async () => {
    const root = await makePrivateTestRoot("journal-eval-route-");
    const sourcePayload = JSON.stringify({
      batch: {
        tasks: [{
          taskId: "T1",
          branches: { high: { messages: [{ id: "u1", role: "user", content: "真人原话" }] } }
        }]
      }
    });
    const sha256 = createHash("sha256").update(sourcePayload).digest("hex");
    const sourcePath = join(root, "source.json");
    const manifestPath = join(root, "manifest.json");
    const candidatesPath = join(root, "candidates.json");
    const identitiesPath = join(root, "identities.json");
    const reviewsPath = join(root, "reviews.ndjson");
    await writeFile(sourcePath, sourcePayload);
    await writeFile(manifestPath, JSON.stringify({
      source_files: [{ source_id: "s1", resolved_path: sourcePath, actual_sha256: sha256, import_status: "matched" }],
      trajectory_cases: [{ case_id: "private:v7r4-pro:T1:high", source_group_id: "v7r4-pro", source_id: "s1", source_file_sha256: sha256, record_type: "trajectory", synthetic: false, source_task_id: "T1", branch: "high" }]
    }));
    await writeFile(candidatesPath, JSON.stringify({
      schema_version: "2.0",
      privacy_classification: "private_local_only",
      execution_fingerprint: "e".repeat(64),
      candidate_set_id: "set-1",
      run: { mode: "real" },
      packets: [{
        case_id: "private:v7r4-pro:T1:high",
        source_group_id: "v7r4-pro",
        source_file_sha256: sha256,
        source_projection_sha256: "2".repeat(64),
        candidate_set_id: "set-1",
        baseline: {
          label: "确定性安全基线",
          title: "SECRET_BASELINE_TITLE",
          record_cards: [],
          paragraphs: [{ text: "SECRET_BASELINE_BODY", source_refs: ["u1"], record_card_refs: [] }]
        },
        candidates: [
          {
            candidate_id: "SECRET_CANDIDATE_ONE",
            daily_output: {
              title: "候选一",
              record_cards: [{ record_card_id: "rc-1", title: "记录一", text: "记录正文一", insight: "", source_refs: ["u1"] }],
              paragraphs: ["正文一"]
            },
            program_check: { admitted: true, metrics: {}, failures: [] },
            judge: { status: "diagnostic", summary: "SECRET_JUDGE" },
            reveal: { model_identity: "SECRET_MODEL", baseline_label: "挑战版", latency_ms: 1200, cost_cny: 0.012 }
          },
          {
            candidate_id: "SECRET_CANDIDATE_TWO",
            daily_output: {
              title: "候选二",
              record_cards: [{ record_card_id: "rc-2", title: "记录二", text: "记录正文二", insight: "", source_refs: ["u1"] }],
              paragraphs: ["正文二"]
            },
            candidate_kind: "baseline",
            runtime: { latency_ms: 100, cost_usd: 0.002 }
          }
        ]
      }]
    }));
    await writeFile(identitiesPath, JSON.stringify({
      schema_version: "1.0",
      privacy_classification: "private_local_only",
      execution_fingerprint: "e".repeat(64),
      candidate_set_id: "set-1",
      identities: [
        { case_id: "private:v7r4-pro:T1:high", candidate_id: "SECRET_CANDIDATE_ONE", model_identity: "SECRET_MODEL" },
        { case_id: "private:v7r4-pro:T1:high", candidate_id: "SECRET_CANDIDATE_TWO", model_identity: "SECRET_MODEL_TWO" }
      ]
    }));
    vi.stubEnv("JOURNAL_EVALUATION_MANIFEST_PATH", manifestPath);
    vi.stubEnv("JOURNAL_EVALUATION_CANDIDATES_PATH", candidatesPath);
    vi.stubEnv("JOURNAL_EVALUATION_IDENTITIES_PATH", identitiesPath);
    vi.stubEnv("JOURNAL_EVALUATION_REVIEWS_PATH", reviewsPath);
    vi.stubEnv("JOURNAL_EVALUATION_LOCAL_ENABLED", "I_UNDERSTAND");
    vi.stubEnv("DATABASE_URL", "postgresql://local:local@127.0.0.1:5432/happiness_system_codex?schema=journal_daily_eval");
    vi.stubEnv("DIRECT_URL", "postgresql://local:local@localhost:5432/happiness_system_codex?schema=journal_daily_eval");
    vi.stubEnv("VERCEL_ENV", "");
    requireAdminRequest.mockResolvedValue({ id: "admin-local", username: "admin" });

    const listResponse = await GET(new Request("http://localhost/admin/journal-evaluation/private"));
    const listPayload = await listResponse.json() as { cases: Array<{ case_id: string }> };
    const publicCaseId = listPayload.cases[0].case_id;
    expect(JSON.stringify(listPayload)).not.toContain("v7r4-pro");

    const firstResponse = await GET(new Request(`http://127.0.0.1/admin/journal-evaluation/private?case_id=${publicCaseId}`));
    const firstText = await firstResponse.text();
    const firstPayload = JSON.parse(firstText) as { case: { presentation_id: string } };
    for (const forbidden of [
      "program_check", "judge", "reveal", "model_identity", "baseline_label",
      "latency_ms", "cost_cny", "cost_usd", "SECRET_CANDIDATE", "SECRET_MODEL", "SECRET_BASELINE", "v7r4-pro"
    ]) {
      expect(firstText).not.toContain(forbidden);
    }
    expect(firstText).not.toContain('"baseline"');

    for (const action of [undefined, "unknown_action"]) {
      const invalidActionResponse = await POST(new Request("http://localhost/admin/journal-evaluation/private", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...(action ? { action } : {}),
          case_id: publicCaseId,
          presentation_id: firstPayload.case.presentation_id,
          record_card_verdicts: { A: "minor_edit", B: "quality_failure" },
          daily_verdicts: { A: "ready_to_use", B: "major_rewrite" },
          preference: "prefer_a",
          issue_attributions: ["source_fidelity"],
          note: "不得被默认解释为首次裁决"
        })
      }));
      expect(invalidActionResponse.status).toBe(400);
      await expect(invalidActionResponse.json()).resolves.toEqual({ error: "PRIVATE_REVIEW_ACTION_INVALID" });
    }
    const stillBlind = await GET(new Request(`http://127.0.0.1/admin/journal-evaluation/private?case_id=${publicCaseId}`));
    expect(await stillBlind.text()).not.toContain("SECRET_MODEL");

    const draftResponse = await POST(new Request("http://localhost/admin/journal-evaluation/private", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "save_draft",
        case_id: publicCaseId,
        presentation_id: firstPayload.case.presentation_id,
        record_card_verdicts: { A: "minor_edit", B: null },
        daily_verdicts: { A: null, B: null },
        preference: null,
        issue_attributions: [],
        note: ""
      })
    }));
    expect(draftResponse.status).toBe(200);
    const draftReadback = await GET(new Request(`http://localhost/admin/journal-evaluation/private?case_id=${publicCaseId}`));
    const draftReadbackText = await draftReadback.text();
    expect(draftReadbackText).toContain('"record_card_verdicts":{"A":"minor_edit","B":null}');
    expect(draftReadbackText).not.toContain("SECRET_MODEL");

    const saveResponse = await POST(new Request("http://localhost/admin/journal-evaluation/private", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "decide",
        case_id: publicCaseId,
        presentation_id: firstPayload.case.presentation_id,
        record_card_verdicts: { A: "minor_edit", B: "quality_failure" },
        daily_verdicts: { A: "ready_to_use", B: "major_rewrite" },
        preference: "prefer_a",
        issue_attributions: ["source_fidelity"],
        note: "首次盲评"
      })
    }));
    const savedText = await saveResponse.text();
    expect(saveResponse.status).toBe(200);
    expect(savedText).toContain("program_check");
    expect(savedText).toContain("SECRET_MODEL");
    expect(savedText).toContain("cost_cny");
    expect(savedText).toContain("SECRET_BASELINE_BODY");
    expect(savedText).toContain('"baseline"');

    const readback = await GET(new Request(`http://localhost/admin/journal-evaluation/private?case_id=${publicCaseId}`));
    const readbackText = await readback.text();
    expect(readbackText).toContain("record_card_verdicts");
    expect(readbackText).toContain("daily_verdicts");
    expect(readbackText).toContain("SECRET_CANDIDATE_ONE");

    const nonLocalHost = await GET(new Request("http://example.com/admin/journal-evaluation/private"));
    expect(nonLocalHost.status).toBe(404);
    vi.stubEnv("DIRECT_URL", "postgresql://remote:remote@example.com:5432/happiness_system_codex?schema=journal_daily_eval");
    const remoteDatabase = await GET(new Request("http://localhost/admin/journal-evaluation/private"));
    expect(remoteDatabase.status).toBe(404);
  });
});
