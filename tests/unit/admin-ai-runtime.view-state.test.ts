import { formatAIRuntimeTimestamp } from "@/features/admin-ai-runtime/view-state";

describe("admin ai runtime view state", () => {
  it("formats publish timestamps as Beijing time", () => {
    expect(formatAIRuntimeTimestamp("2026-05-25T03:18:20.957Z")).toBe("2026-05-25 11:18");
    expect(formatAIRuntimeTimestamp("2026-05-25T03:18:18.060Z")).toBe("2026-05-25 11:18");
  });

  it("returns null when timestamp is missing", () => {
    expect(formatAIRuntimeTimestamp(null)).toBeNull();
  });
});
