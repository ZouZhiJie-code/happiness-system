import { fireEvent, render, screen } from "@testing-library/react";

import reviewPacket from "../../evals/interview-intent/reviewer/generated/review-packet-external-review-hybrid.json";
import { IntentReviewShell } from "@/components/interview-intent-review/intent-review-shell";

describe("IntentReviewShell", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("keeps the gold answer hidden and advances after a verdict", () => {
    render(<IntentReviewShell packet={reviewPacket} />);

    expect(
      screen.getByText((_content, element) =>
        element?.tagName === "STRONG" && element.textContent === "0/24"
      )
    ).toBeInTheDocument();
    expect(screen.queryByText(/expectedAssessment|productExpectation/u)).not.toBeInTheDocument();

    const nextButton = screen.getByRole("button", { name: "保存并看下一条" });
    expect(nextButton).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /^正确/u }));
    expect(nextButton).toBeEnabled();
    expect(
      screen.getByText((_content, element) =>
        element?.tagName === "STRONG" && element.textContent === "1/24"
      )
    ).toBeInTheDocument();

    fireEvent.click(nextButton);
    expect(
      screen.getByText((content) => content.includes(reviewPacket.cases[1]?.userText ?? ""))
    ).toBeInTheDocument();
  });
});
