import React from "react";
import { render, screen } from "@testing-library/react";

import { LegalConsentLinks } from "@/components/auth/legal-consent-links";

describe("legal consent links", () => {
  test("renders terms and privacy links for future registration forms", () => {
    render(<LegalConsentLinks />);

    const termsLink = screen.getByRole("link", { name: "《用户协议》" });
    const privacyLink = screen.getByRole("link", { name: "《隐私政策》" });

    expect(termsLink).toHaveAttribute("href", "/legal/terms");
    expect(privacyLink).toHaveAttribute("href", "/legal/privacy");
    expect(screen.getByText(/注册即表示你已阅读并同意/)).toBeInTheDocument();
  });
});
