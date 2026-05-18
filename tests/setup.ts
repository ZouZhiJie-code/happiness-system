import "@testing-library/jest-dom";

import React from "react";

vi.mock("lottie-react", () => ({
  default: ({ "data-testid": dataTestId }: { "data-testid"?: string }) =>
    React.createElement("div", { "data-testid": dataTestId ?? "lottie-animation" })
}));
