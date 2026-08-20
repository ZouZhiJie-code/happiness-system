const {
  getJournalGoldenSetV2CaseDetail,
  getJournalGoldenSetV2CaseShortlist,
  requireAdminRequest,
  MockAdminAuthorizationError,
  MockJournalGoldenSetV2ServiceError
} = vi.hoisted(() => {
  class AdminError extends Error {}
  class ServiceError extends Error {
    constructor(readonly code: string) {
      super(code);
    }
  }
  return {
    getJournalGoldenSetV2CaseDetail: vi.fn(),
    getJournalGoldenSetV2CaseShortlist: vi.fn(),
    requireAdminRequest: vi.fn(),
    MockAdminAuthorizationError: AdminError,
    MockJournalGoldenSetV2ServiceError: ServiceError
  };
});

vi.mock("@/server/services/auth/admin-access", () => ({
  AdminAuthorizationError: MockAdminAuthorizationError,
  requireAdminRequest
}));

vi.mock("@/server/services/journal-evaluation/journal-golden-set-v2.service", () => ({
  JournalGoldenSetV2ServiceError: MockJournalGoldenSetV2ServiceError,
  getJournalGoldenSetV2CaseDetail,
  getJournalGoldenSetV2CaseShortlist
}));

import { GET as getCaseDetail } from "@/app/api/admin/analytics/journal-cases/[caseId]/route";
import { GET as getCaseShortlist } from "@/app/api/admin/analytics/journal-cases/route";

const CASE_ID = "jgv2_123e4567e89b42d3a456426614174000";

describe("journal Golden Set v2 admin API", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    requireAdminRequest.mockResolvedValue({ id: "admin-1", username: "admin_user" });
  });

  it("returns a metadata-only capture/chat shortlist for admins", async () => {
    getJournalGoldenSetV2CaseShortlist.mockResolvedValue({
      contractVersion: "2.0",
      contentIncluded: false,
      cases: [{ caseId: CASE_ID, recordMode: "capture" }],
      nextCursor: null
    });

    const response = await getCaseShortlist(
      new Request("http://localhost/api/admin/analytics/journal-cases?limit=30&recordMode=capture")
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      contentIncluded: false,
      cases: [{ caseId: CASE_ID, recordMode: "capture" }]
    });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(getJournalGoldenSetV2CaseShortlist).toHaveBeenCalledWith({
      limit: 30,
      cursor: undefined,
      recordMode: "capture"
    });
  });

  it("maps invalid queries and admin authorization failures", async () => {
    getJournalGoldenSetV2CaseShortlist.mockRejectedValueOnce(
      new MockJournalGoldenSetV2ServiceError("JOURNAL_GOLDEN_SET_V2_INVALID_QUERY")
    );
    const invalid = await getCaseShortlist(
      new Request("http://localhost/api/admin/analytics/journal-cases?recordMode=legacy")
    );
    expect(invalid.status).toBe(400);

    requireAdminRequest.mockRejectedValueOnce(new MockAdminAuthorizationError("ADMIN_FORBIDDEN"));
    const forbidden = await getCaseShortlist(
      new Request("http://localhost/api/admin/analytics/journal-cases")
    );
    expect(forbidden.status).toBe(403);
    await expect(forbidden.json()).resolves.toEqual({ error: "ADMIN_FORBIDDEN" });
    expect(forbidden.headers.get("cache-control")).toBe("private, no-store");
  });

  it("returns audited detail and maps every unknown or unauthorized case to 404", async () => {
    getJournalGoldenSetV2CaseDetail.mockResolvedValueOnce({
      contractVersion: "2.0",
      caseId: CASE_ID,
      contentIncluded: true
    });
    const success = await getCaseDetail(
      new Request(`http://localhost/api/admin/analytics/journal-cases/${CASE_ID}`),
      { params: Promise.resolve({ caseId: CASE_ID }) }
    );
    expect(success.status).toBe(200);
    expect(success.headers.get("cache-control")).toBe("private, no-store");
    expect(getJournalGoldenSetV2CaseDetail).toHaveBeenCalledWith({
      caseId: CASE_ID,
      adminUsername: "admin_user"
    });

    getJournalGoldenSetV2CaseDetail.mockRejectedValueOnce(
      new MockJournalGoldenSetV2ServiceError("JOURNAL_GOLDEN_SET_V2_CASE_NOT_FOUND")
    );
    const missing = await getCaseDetail(
      new Request("http://localhost/api/admin/analytics/journal-cases/missing"),
      { params: Promise.resolve({ caseId: "missing" }) }
    );
    expect(missing.status).toBe(404);

    getJournalGoldenSetV2CaseDetail.mockRejectedValueOnce(
      new MockJournalGoldenSetV2ServiceError("JOURNAL_GOLDEN_SET_V2_CASE_NOT_FOUND")
    );
    const unauthorized = await getCaseDetail(
      new Request(`http://localhost/api/admin/analytics/journal-cases/${CASE_ID}`),
      { params: Promise.resolve({ caseId: CASE_ID }) }
    );
    expect(unauthorized.status).toBe(404);
    await expect(unauthorized.json()).resolves.toEqual({
      error: "JOURNAL_GOLDEN_SET_V2_CASE_NOT_FOUND"
    });
    expect(unauthorized.headers.get("cache-control")).toBe("private, no-store");
  });

  it("keeps authentication and unexpected database errors body-safe and non-cacheable", async () => {
    requireAdminRequest.mockRejectedValueOnce(new Error("AUTHENTICATION_REQUIRED"));
    const unauthenticated = await getCaseShortlist(
      new Request("http://localhost/api/admin/analytics/journal-cases")
    );
    expect(unauthenticated.status).toBe(401);
    expect(unauthenticated.headers.get("cache-control")).toBe("private, no-store");

    getJournalGoldenSetV2CaseShortlist.mockRejectedValueOnce(
      new Error("postgresql://private-user:private-password@private-host/database")
    );
    const failed = await getCaseShortlist(
      new Request("http://localhost/api/admin/analytics/journal-cases")
    );
    expect(failed.status).toBe(500);
    await expect(failed.json()).resolves.toEqual({
      error: "JOURNAL_GOLDEN_SET_V2_QUERY_FAILED"
    });
    expect(failed.headers.get("cache-control")).toBe("private, no-store");
  });
});
