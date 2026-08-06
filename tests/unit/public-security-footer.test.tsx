import React from "react";
import { render, screen } from "@testing-library/react";

import { PublicSecurityFooter } from "@/components/shared/public-security-footer";

describe("PublicSecurityFooter", () => {
  test("links the public security record to its official query page", () => {
    render(<PublicSecurityFooter />);

    const link = screen.getByRole("link", { name: "查询赣公网安备36110302000181号" });

    expect(link).toHaveAttribute("href", "https://beian.mps.gov.cn/#/query/webSearch?code=36110302000181");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noreferrer");
    expect(screen.getByText("赣公网安备 36110302000181 号")).toBeInTheDocument();
    expect(link.querySelector('img[src*="public-security-beian.png"]')).toBeInTheDocument();
  });

  test("links the ICP record to the MIIT record platform", () => {
    render(<PublicSecurityFooter />);

    const link = screen.getByRole("link", { name: "查询赣ICP备2026003367号" });

    expect(link).toHaveAttribute("href", "https://beian.miit.gov.cn/");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noreferrer");
    expect(screen.getByText("赣ICP备2026003367号")).toBeInTheDocument();
  });
});
