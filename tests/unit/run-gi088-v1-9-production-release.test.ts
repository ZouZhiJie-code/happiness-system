import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  GI088_V19_BASELINE_DEPLOYMENT,
  GI088_V19_BASELINE_MODEL,
  GI088_V19_BASELINE_STRATEGY,
  GI088_V19_CANDIDATE_MODEL,
  GI088_V19_CANDIDATE_VERSION,
  GI088_V19_PRODUCTION_DOMAIN,
  GI088_V19_RELEASE_IDENTITY,
  GI088_V19_STRATEGY,
  assertParentCandidateApplicationUnchanged,
  assertGi088V19CommandAllowed,
  buildGi088V19PreviewEvidence,
  buildGi088V19ProductReviewTemplate,
  buildGi088V19PsqlInvocation,
  buildGi088V19ReadinessEvidence,
  buildGi088V19SmokeReviewTemplate,
  buildGi088V19VercelArgs,
  calculateGi088V19PlanFingerprint,
  createGi088V19ReleasePaths,
  deleteTemporaryUser,
  normalizeGi088V19PsqlUrl,
  parseGi088V19DeploymentIdentity,
  parseGi088V19Sse,
  recordGi088V19ProductVerdict,
  sanitizeGi088V19PublicState,
  sha256Text,
  validateGi088V19BackgroundTrace,
  validateGi088V19ParentReleaseFailure,
  validateGi088V19ParentV11Failure,
  validateGi088V19ParentV12Failure,
  validateGi088V19ParentV13Failure,
  validateGi088V19ProductReview,
  validateGi088V19RuntimeReadback,
  validateGi088V19SmokeReview
// @ts-expect-error The executable is intentionally plain Node ESM; Vitest exercises its public exports directly.
} from "../../scripts/run-gi088-v1-9-production-release.mjs";

const repoRoot = resolve(import.meta.dirname, "../..");

type MutableState = {
  identity: string;
  status: string;
  planFingerprint: string;
  productOwnerPreviewVerdict: string;
  baseline: { deploymentId: string; strategy: string; domain: string };
  candidate: null | {
    deploymentId: string;
    deploymentUrl: string;
    ready: boolean;
    sourceCommit?: string;
  };
  smoke: null | {
    sessionId?: string;
    visibleTraceId?: string;
    userInput?: string;
    aiOutput?: string;
    userInputSha256?: string;
    aiOutputSha256?: string;
    visibleElapsedMs?: number;
    technicalPassed: boolean;
    background: { passed: boolean; traceId?: string };
    temporaryUserDeleted: boolean;
    productOwnerVerdict: string;
  };
  promotion: null | { completed: boolean };
  onlineRegression: null;
  rollback: null;
  error: null;
  temporaryUser?: { userId: string; usernameHash: string };
  updatedAt: string;
};

type PreviewTurn = {
  codexVerdict: string;
  userInputSha256: string;
  aiOutputSha256: string;
};

function baseState(): MutableState {
  return {
    identity: GI088_V19_RELEASE_IDENTITY,
    status: "prepared_waiting_product_owner_preview_review",
    planFingerprint: "a".repeat(64),
    productOwnerPreviewVerdict: "pending",
    baseline: {
      deploymentId: GI088_V19_BASELINE_DEPLOYMENT,
      strategy: GI088_V19_BASELINE_STRATEGY,
      domain: GI088_V19_PRODUCTION_DOMAIN
    },
    candidate: null,
    smoke: null,
    promotion: null,
    onlineRegression: null,
    rollback: null,
    error: null,
    updatedAt: "2026-08-20T00:00:00.000Z"
  };
}

describe("GI-088 v1.9 production release gate", () => {
  it("binds the frozen Preview evidence without exposing its body", () => {
    const paths = createGi088V19ReleasePaths(repoRoot);
    const preview = buildGi088V19PreviewEvidence(paths);
    const readiness = buildGi088V19ReadinessEvidence(paths);
    const parentV1 = validateGi088V19ParentReleaseFailure(paths);
    const parentV11 = validateGi088V19ParentV11Failure(paths);
    const parentV12 = validateGi088V19ParentV12Failure(paths);
    const parentV13 = validateGi088V19ParentV13Failure(paths);

    expect(preview.identity).toBe(
      "2026-08-20.gi088-complete-response-first-v1-9-isolated-preview-v1"
    );
    expect(preview.candidateVersion).toBe(GI088_V19_CANDIDATE_VERSION);
    expect(preview.turns).toHaveLength(4);
    expect(preview.turns.every((turn: PreviewTurn) => turn.codexVerdict === "pass")).toBe(true);
    expect(preview.turns.every((turn: PreviewTurn) => /^[a-f0-9]{64}$/u.test(turn.userInputSha256))).toBe(true);
    expect(preview.turns.every((turn: PreviewTurn) => /^[a-f0-9]{64}$/u.test(turn.aiOutputSha256))).toBe(true);
    expect(readiness).toMatchObject({
      baselineDeploymentId: GI088_V19_BASELINE_DEPLOYMENT,
      baselineStrategy: GI088_V19_BASELINE_STRATEGY
    });
    expect(parentV1).toMatchObject({
      identity: "2026-08-20.gi088-complete-response-first-v1-9-production-release-v1",
      observedDeploymentId: "dpl_8tTNtvoemDhstcPqaLu1g3q3gvWU",
      failureCode: "GI088_V19_RELEASE_DEPLOY_IDENTITY_MISSING"
    });
    expect(parentV11).toMatchObject({
      identity:
        "2026-08-20.gi088-complete-response-first-v1-9-production-release-v1-1-cli-json-shape",
      candidateDeploymentId: "dpl_EeobYfcEeteHyhHz4HrVFVGa5HmH",
      candidateSourceCommit: "c0cb06e9f7dc3d1746a77865091b00c6aa2ffb4e"
    });
    expect(parentV12).toMatchObject({
      identity:
        "2026-08-20.gi088-complete-response-first-v1-9-production-release-v1-2-psql-contract",
      failureCode: "EVENT_CENTERED_CANDIDATE_MODEL_MISMATCH"
    });
    expect(parentV13).toMatchObject({
      identity:
        "2026-08-20.gi088-complete-response-first-v1-9-production-release-v1-3-model-environment-contract",
      candidateDeploymentId: "dpl_B9P64xCMMGtSR6CKAjNzRFdav39p"
    });
  });

  it("parses both Vercel non-interactive nested JSON and legacy top-level JSON", () => {
    expect(
      parseGi088V19DeploymentIdentity({
        status: "ok",
        deployment: {
          id: "dpl_nested",
          url: "https://nested.example"
        }
      })
    ).toEqual({
      deploymentId: "dpl_nested",
      deploymentUrl: "https://nested.example"
    });
    expect(
      parseGi088V19DeploymentIdentity({
        deploymentId: "dpl_top_level",
        deploymentUrl: "top-level.example"
      })
    ).toEqual({
      deploymentId: "dpl_top_level",
      deploymentUrl: "https://top-level.example"
    });
    expect(() => parseGi088V19DeploymentIdentity({ status: "ok" })).toThrow(
      "GI088_V19_RELEASE_DEPLOY_IDENTITY_MISSING"
    );
  });

  it("normalizes the direct database URL and runs psql through stdin variables", () => {
    const normalized = normalizeGi088V19PsqlUrl(
      "postgresql://user:pass@example.test/db?channel_binding=require&sslmode=require&schema=public"
    );
    const url = new URL(normalized);
    expect([...url.searchParams.keys()]).toEqual(["sslmode"]);
    const invocation = buildGi088V19PsqlInvocation(
      normalized,
      "SELECT :'user_id';",
      { user_id: "user-1" }
    );
    expect(invocation.args).toEqual([
      normalized,
      "-X",
      "-v",
      "ON_ERROR_STOP=1",
      "-tA",
      "-v",
      "user_id=user-1",
      "-f",
      "-"
    ]);
    expect(invocation.input).toBe("SELECT :'user_id';");
  });

  it("verifies temporary user deletion in an independent database read", () => {
    const calls: Array<{ program: string; args: string[]; input?: string }> = [];
    const exec = (program: string, args: string[], options: { input?: string }) => {
      calls.push({ program, args, input: options.input });
      return {
        stdout: calls.length === 1
          ? '{"deletedCount":1}\n'
          : '{"remainingCount":0}\n',
        stderr: ""
      };
    };
    expect(deleteTemporaryUser(exec, "postgresql://example.test/db", "user-1")).toBe(true);
    expect(calls).toHaveLength(2);
    expect(calls.every((call) => call.args.includes("-f") && call.args.includes("-"))).toBe(true);
    expect(calls[0].input).toContain("DELETE FROM \"User\"");
    expect(calls[1].input).toContain("remainingCount");
  });

  it("reuses the parent candidate only when production application files are unchanged", () => {
    const paths = { root: repoRoot };
    const cleanExec = (_program: string, args: string[]) => ({
      stdout: args[0] === "diff" ? "" : "",
      stderr: ""
    });
    expect(
      assertParentCandidateApplicationUnchanged(paths, cleanExec, "parent-commit")
    ).toBe(true);
    const driftExec = (_program: string, args: string[]) => ({
      stdout: args[0] === "diff" ? "src/server/example.ts\n" : "",
      stderr: ""
    });
    expect(() =>
      assertParentCandidateApplicationUnchanged(paths, driftExec, "parent-commit")
    ).toThrow("GI088_V19_RELEASE_PARENT_CANDIDATE_APPLICATION_DRIFT");
  });

  it("requires a hash-bound product-owner pass before candidate deployment", () => {
    const preview = buildGi088V19PreviewEvidence(createGi088V19ReleasePaths(repoRoot));
    const template = buildGi088V19ProductReviewTemplate(
      preview,
      new Date("2026-08-20T01:00:00.000Z")
    );
    const review = recordGi088V19ProductVerdict(
      template,
      "pass",
      new Date("2026-08-20T02:00:00.000Z")
    );
    expect(validateGi088V19ProductReview(review, preview)).toBe(true);

    const tampered = structuredClone(review);
    tampered.evidence.turns[0].aiOutputSha256 = "0".repeat(64);
    expect(() => validateGi088V19ProductReview(tampered, preview)).toThrow(
      "GI088_V19_RELEASE_PRODUCT_REVIEW_REQUIRED"
    );

    const state = baseState();
    expect(() => assertGi088V19CommandAllowed(state, "deploy-candidate")).toThrow(
      "GI088_V19_RELEASE_PRODUCT_REVIEW_REQUIRED"
    );
    state.productOwnerPreviewVerdict = "pass";
    expect(assertGi088V19CommandAllowed(state, "deploy-candidate")).toBe(true);
    expect(assertGi088V19CommandAllowed(state, "adopt-parent-candidate")).toBe(true);
  });

  it("uses a candidate deployment that cannot take the domain during build", () => {
    expect(buildGi088V19VercelArgs("set-candidate-strategy")).toEqual([
      "env",
      "update",
      "INTERVIEW_EVENT_CENTERED_STRATEGY",
      "production",
      "--value",
      GI088_V19_STRATEGY,
      "--yes"
    ]);
    expect(buildGi088V19VercelArgs("deploy-candidate")).toEqual([
      "deploy",
      "--prod",
      "--skip-domain",
      "--yes",
      "--format=json"
    ]);
    expect(buildGi088V19VercelArgs("set-candidate-model")).toContain(
      GI088_V19_CANDIDATE_MODEL
    );
  });

  it("binds runtime identity to the candidate host while requiring the v1.9 Pro contract", () => {
    const runtime = {
      status: 200,
      json: {
        requestHost: "candidate.example",
        env: { VERCEL_DEPLOYMENT_ID: null },
        eventCentered: {
          mode: "event_centered",
          strategy: GI088_V19_STRATEGY,
          model: GI088_V19_CANDIDATE_MODEL
        }
      }
    };
    expect(
      validateGi088V19RuntimeReadback(runtime, "https://candidate.example")
    ).toBe(true);
    expect(() =>
      validateGi088V19RuntimeReadback(
        { ...runtime, json: { ...runtime.json, requestHost: "other.example" } },
        "https://candidate.example"
      )
    ).toThrow("GI088_V19_RELEASE_CANDIDATE_RUNTIME_MODEL_MISMATCH");
  });

  it("freezes baseline recovery commands", () => {
    expect(buildGi088V19VercelArgs("set-baseline-strategy")).toContain(
      GI088_V19_BASELINE_STRATEGY
    );
    expect(buildGi088V19VercelArgs("rollback", GI088_V19_BASELINE_DEPLOYMENT)).toEqual([
      "rollback",
      GI088_V19_BASELINE_DEPLOYMENT,
      "--yes"
    ]);
    expect(buildGi088V19VercelArgs("set-baseline-model")).toContain(
      GI088_V19_BASELINE_MODEL
    );
  });

  it("requires one completed and applied background task with zero retry", () => {
    const valid = {
      id: "trace-background-1",
      status: "completed",
      errorCode: null,
      artifactVersion: 2,
      contextSnapshot: { kind: "event_centered_background_facts_v1" },
      finalOutput: { applied: { writtenFactIds: ["fact-1"] } },
      pipelineDecisions: [{ kind: "event_centered_background_facts_applied" }],
      invocations: [{ stage: "extract", attempt: 1, success: true, errorCode: null }]
    };
    expect(validateGi088V19BackgroundTrace(valid)).toEqual({
      passed: true,
      traceId: "trace-background-1",
      invocationCount: 1,
      retryCount: 0,
      sourceValidation: "completed_after_apply_contract"
    });
    expect(() =>
      validateGi088V19BackgroundTrace({
        ...valid,
        invocations: [
          valid.invocations[0],
          { stage: "extract", attempt: 2, success: true }
        ]
      })
    ).toThrow("GI088_V19_RELEASE_BACKGROUND_TRACE_INVALID");
  });

  it("keeps the smoke product review bound to the exact direct output", () => {
    const smoke = {
      deploymentId: "dpl_candidate",
      sessionId: "session-1",
      visibleTraceId: "visible-trace-1",
      userInputSha256: sha256Text("input"),
      aiOutputSha256: sha256Text("output"),
      background: { traceId: "background-trace-1" }
    };
    const template = buildGi088V19SmokeReviewTemplate(
      smoke,
      new Date("2026-08-20T01:00:00.000Z")
    );
    const review = recordGi088V19ProductVerdict(
      template,
      "pass",
      new Date("2026-08-20T02:00:00.000Z")
    );
    expect(validateGi088V19SmokeReview(review, smoke)).toBe(true);
    expect(() =>
      validateGi088V19SmokeReview(review, {
        ...smoke,
        aiOutputSha256: sha256Text("different output")
      })
    ).toThrow("GI088_V19_RELEASE_SMOKE_PRODUCT_REVIEW_REQUIRED");
  });

  it("blocks domain promotion until every product, background, and cleanup gate passes", () => {
    const state = baseState();
    state.productOwnerPreviewVerdict = "pass";
    state.candidate = {
      deploymentId: "dpl_candidate",
      deploymentUrl: "https://candidate.example",
      ready: true
    };
    state.smoke = {
      technicalPassed: true,
      background: { passed: true },
      temporaryUserDeleted: false,
      productOwnerVerdict: "pass"
    };
    expect(() => assertGi088V19CommandAllowed(state, "promote")).toThrow(
      "GI088_V19_RELEASE_PROMOTION_GATE_FAILED"
    );
    state.smoke.temporaryUserDeleted = true;
    expect(assertGi088V19CommandAllowed(state, "promote")).toBe(true);
  });

  it("allows online regression only after the exact candidate is promoted", () => {
    const state = baseState();
    expect(() => assertGi088V19CommandAllowed(state, "online-regression")).toThrow(
      "GI088_V19_RELEASE_PROMOTION_REQUIRED"
    );
    state.promotion = { completed: true };
    expect(assertGi088V19CommandAllowed(state, "online-regression")).toBe(true);
  });

  it("parses the final event-centered session from SSE", () => {
    const events = parseGi088V19Sse(
      'event: turn\ndata: {"turn":{"id":"turn-1"}}\n\nevent: session\ndata: {"session":{"phase":"event_recording"}}\n\n'
    );
    expect(events).toEqual([
      { event: "turn", data: { turn: { id: "turn-1" } } },
      { event: "session", data: { session: { phase: "event_recording" } } }
    ]);
  });

  it("keeps all private body and account fields out of the public receipt", () => {
    const state = baseState();
    state.productOwnerPreviewVerdict = "pass";
    state.candidate = {
      deploymentId: "dpl_candidate",
      deploymentUrl: "https://candidate.example",
      ready: true,
      sourceCommit: "commit-1"
    };
    state.smoke = {
      sessionId: "private-session-id",
      visibleTraceId: "private-visible-trace",
      userInput: "PRIVATE_USER_BODY",
      aiOutput: "PRIVATE_AI_BODY",
      userInputSha256: sha256Text("PRIVATE_USER_BODY"),
      aiOutputSha256: sha256Text("PRIVATE_AI_BODY"),
      visibleElapsedMs: 4200,
      technicalPassed: true,
      background: { passed: true, traceId: "private-background-trace" },
      temporaryUserDeleted: true,
      productOwnerVerdict: "pass"
    };
    state.temporaryUser = {
      userId: "private-user-id",
      usernameHash: sha256Text("private-user")
    };
    const serialized = JSON.stringify(sanitizeGi088V19PublicState(state));
    expect(serialized).not.toContain("PRIVATE_USER_BODY");
    expect(serialized).not.toContain("PRIVATE_AI_BODY");
    expect(serialized).not.toContain("private-user-id");
    expect(serialized).not.toContain("private-session-id");
    expect(serialized).not.toContain("private-visible-trace");
    expect(serialized).not.toContain("private-background-trace");
  });

  it("produces a stable plan fingerprint independent of object insertion order", () => {
    expect(calculateGi088V19PlanFingerprint({ b: "2", a: "1" })).toBe(
      calculateGi088V19PlanFingerprint({ a: "1", b: "2" })
    );
  });
});
