import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { AIQualityConsentSettings } from "@/components/ai-feedback/ai-quality-consent-settings";

describe("AIQualityConsentSettings", () => {
  afterEach(() => vi.restoreAllMocks());

  it("lets an active participant stop quality improvement and persists the revocation", async () => {
    global.fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "PATCH") {
        return Response.json({ policyVersion: "2026-07-19", decisionRequired: false, participated: false });
      }
      return Response.json({ policyVersion: "2026-07-19", decisionRequired: false, participated: true });
    }) as typeof fetch;

    render(<AIQualityConsentSettings />);
    fireEvent.click(await screen.findByRole("button", { name: "停止参与" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "参加质量改进" })).toBeInTheDocument());
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/ai-feedback/consent",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ participate: false }) })
    );
  });
});
