import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { AIQualityConsentBanner } from "@/components/ai-feedback/ai-quality-consent-banner";

describe("AIQualityConsentBanner", () => {
  afterEach(() => vi.restoreAllMocks());

  it("asks legacy users for a new decision and records participation", async () => {
    global.fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "PATCH") {
        return Response.json({ policyVersion: "2026-07-19", decisionRequired: false, participated: true });
      }
      return Response.json({ policyVersion: "2026-07-19", decisionRequired: true, participated: false });
    }) as typeof fetch;

    render(<AIQualityConsentBanner />);
    fireEvent.click(await screen.findByRole("button", { name: "同意并参与优化" }));

    await waitFor(() => expect(screen.queryByRole("region", { name: "AI 质量优化授权" })).not.toBeInTheDocument());
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/ai-feedback/consent",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ participate: true }) })
    );
  });
});
