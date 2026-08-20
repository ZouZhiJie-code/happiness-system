// @vitest-environment node

import { getConfig } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("Testing Library shared setup", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses the shared three-second async utility timeout in Node tests", () => {
    expect(globalThis.document).toBeUndefined();
    expect(getConfig().asyncUtilTimeout).toBe(3_000);
  });

  it("keeps Vitest fake timers available", () => {
    vi.useFakeTimers();
    const callback = vi.fn();

    setTimeout(callback, 100);
    vi.advanceTimersByTime(100);

    expect(callback).toHaveBeenCalledTimes(1);
  });
});
