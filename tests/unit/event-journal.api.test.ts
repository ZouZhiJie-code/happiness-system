import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  getEntry: vi.fn(),
  updateEntry: vi.fn(),
  saveEntry: vi.fn(),
  cancelGeneration: vi.fn()
}));

vi.mock("@/server/services/auth/current-user.service", () => ({
  requireCurrentUserFromRequest: mocks.requireUser
}));

vi.mock("@/server/services/journal-event/event-journal.service", () => ({
  getEventJournalEntryView: mocks.getEntry,
  updateEventJournalEntry: mocks.updateEntry,
  saveEventJournalEntry: mocks.saveEntry,
  cancelEventJournalGeneration: mocks.cancelGeneration
}));

import {
  GET as getEntry,
  PUT as updateEntry
} from "@/app/api/event-journal/[entryId]/route";
import { POST as saveEntry } from "@/app/api/event-journal/[entryId]/save/route";
import { POST as cancelGeneration } from "@/app/api/event-journal/generation/[generationId]/cancel/route";

const view = {
  entry: {
    id: "entry-1",
    eventId: "event-1",
    title: "那次误会",
    content: "我和同事之间的误会后来被说清楚了。",
    status: "draft" as const,
    contentRevision: 1,
    savedRevision: null,
    updatedAt: "2026-07-23T08:00:00.000Z",
    savedAt: null
  }
};

describe("event journal api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "user-1" });
    mocks.getEntry.mockResolvedValue(view);
    mocks.updateEntry.mockResolvedValue(view);
    mocks.saveEntry.mockResolvedValue({
      entry: { ...view.entry, status: "saved", savedRevision: 1 }
    });
    mocks.cancelGeneration.mockResolvedValue({
      generation: {
        id: "generation-1",
        eventId: "event-1",
        status: "canceled",
        errorCode: "REQUEST_CANCELED",
        canceledAt: "2026-07-23T08:00:00.000Z"
      }
    });
  });

  it("reads the safe editable view for the authenticated owner", async () => {
    const response = await getEntry(new Request("http://localhost/api/event-journal/entry-1"), {
      params: Promise.resolve({ entryId: "entry-1" })
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(view);
    expect(mocks.getEntry).toHaveBeenCalledWith({
      userId: "user-1",
      entryId: "entry-1"
    });
  });

  it("updates and saves with the expected content revision", async () => {
    const updateResponse = await updateEntry(
      new Request("http://localhost/api/event-journal/entry-1", {
        method: "PUT",
        body: JSON.stringify({
          expectedContentRevision: 1,
          title: "更新标题",
          content: "更新后的正文"
        })
      }),
      { params: Promise.resolve({ entryId: "entry-1" }) }
    );
    const saveResponse = await saveEntry(
      new Request("http://localhost/api/event-journal/entry-1/save", {
        method: "POST",
        body: JSON.stringify({ expectedContentRevision: 1 })
      }),
      { params: Promise.resolve({ entryId: "entry-1" }) }
    );

    expect(updateResponse.status).toBe(200);
    expect(saveResponse.status).toBe(200);
    expect(mocks.updateEntry).toHaveBeenCalledWith({
      userId: "user-1",
      entryId: "entry-1",
      expectedContentRevision: 1,
      title: "更新标题",
      content: "更新后的正文"
    });
    expect(mocks.saveEntry).toHaveBeenCalledWith({
      userId: "user-1",
      entryId: "entry-1",
      expectedContentRevision: 1
    });
  });

  it("returns a structured 409 issue for a stale edit", async () => {
    mocks.updateEntry.mockRejectedValue(
      new Error("EVENT_JOURNAL_ENTRY_VERSION_CONFLICT")
    );
    const response = await updateEntry(
      new Request("http://localhost/api/event-journal/entry-1", {
        method: "PUT",
        body: JSON.stringify({
          expectedContentRevision: 1,
          title: "更新标题",
          content: "更新后的正文"
        })
      }),
      { params: Promise.resolve({ entryId: "entry-1" }) }
    );
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload).toMatchObject({
      error: "EVENT_JOURNAL_ENTRY_VERSION_CONFLICT",
      issue: {
        code: "EVENT_JOURNAL_ENTRY_VERSION_CONFLICT",
        action: "refresh",
        retryable: true
      }
    });
    expect(payload.issue.requestId).toMatch(/^ir_/u);
  });

  it("cancels the owned generation and supports an empty request body", async () => {
    const response = await cancelGeneration(
      new Request(
        "http://localhost/api/event-journal/generation/generation-1/cancel",
        { method: "POST" }
      ),
      { params: Promise.resolve({ generationId: "generation-1" }) }
    );

    expect(response.status).toBe(200);
    expect(mocks.cancelGeneration).toHaveBeenCalledWith({
      userId: "user-1",
      generationId: "generation-1"
    });
  });
});
