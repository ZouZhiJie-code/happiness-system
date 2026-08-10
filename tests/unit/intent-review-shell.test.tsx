import { fireEvent, render, screen } from "@testing-library/react";

import {
  IntentReviewShell,
  type IntentReviewPacket
} from "@/components/interview-intent-review/intent-review-shell";

const syntheticReviewPacket: IntentReviewPacket = {
  packetVersion: "synthetic-review-v1",
  generatedAt: "2026-08-10T00:00:00.000Z",
  datasetVersion: "synthetic-dataset-v1",
  cases: [
    {
      id: "SYN-001",
      severity: "P1",
      category: "contextual_short_answer",
      dimension: "joy",
      context: {
        lastAssistantQuestion: "今天哪一刻让你觉得轻松？",
        questionTarget: "event_anchor",
        questionSubTarget: null
      },
      userText: "午休时在楼下散了十分钟步。",
      systemAssessment: {
        primaryControl: "none",
        controlSignals: [],
        dialogueActs: ["provide_content"],
        content: {
          presence: "present",
          evidenceText: "午休散步",
          explicitAbsence: false,
          answeredTarget: "event_anchor"
        },
        referenceTarget: "current_question",
        frustration: "none"
      }
    },
    {
      id: "SYN-002",
      severity: "P0",
      category: "explicit_control",
      dimension: "common",
      context: {
        lastAssistantQuestion: "还想补充什么吗？",
        questionTarget: "current_question",
        questionSubTarget: null
      },
      userText: "先整理成日志吧。",
      systemAssessment: {
        primaryControl: "generate_draft",
        controlSignals: ["generate_draft"],
        dialogueActs: [],
        content: {
          presence: "absent",
          evidenceText: null,
          explicitAbsence: false,
          answeredTarget: null
        },
        referenceTarget: "journal",
        frustration: "none"
      }
    }
  ]
};

describe("IntentReviewShell", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("keeps the gold answer hidden and advances after a verdict", () => {
    render(<IntentReviewShell packet={syntheticReviewPacket} />);

    expect(
      screen.getByText((_content, element) =>
        element?.tagName === "STRONG" && element.textContent === "0/2"
      )
    ).toBeInTheDocument();
    expect(screen.queryByText(/expectedAssessment|productExpectation/u)).not.toBeInTheDocument();

    const nextButton = screen.getByRole("button", { name: "保存并看下一条" });
    expect(nextButton).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /^正确/u }));
    expect(nextButton).toBeEnabled();
    expect(
      screen.getByText((_content, element) =>
        element?.tagName === "STRONG" && element.textContent === "1/2"
      )
    ).toBeInTheDocument();

    fireEvent.click(nextButton);
    expect(
      screen.getByText((content) => content.includes(syntheticReviewPacket.cases[1]?.userText ?? ""))
    ).toBeInTheDocument();
  });
});
