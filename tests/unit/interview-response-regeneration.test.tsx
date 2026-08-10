import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { InterviewResponseRegeneration } from "@/components/interview/interview-response-regeneration";
import type { InterviewMessage } from "@/types/interview";

function buildMessage(versionCount = 1): InterviewMessage {
  return {
    id: "assistant-1",
    traceId: "trace-1",
    role: "assistant",
    content: "",
    assistantPayload: {
      insight: "",
      thinkingSummary: "我会继续贴着这件事来理解。",
      analysis: "",
      question: "那一刻发生了什么？",
      questionSpec: {
        target: "event_anchor",
        stageIntent: "advance",
        surfaceLevel: "default",
        repairCount: 0
      },
      stateUpdate: {
        turnPhase: "digging",
        shouldEndDimension: false,
        offerChoice: false,
        choiceKind: null,
        choiceReason: ""
      },
      meta: { depthReached: ["event"] }
    },
    branchSessionId: "branch-1",
    responseVersion: {
      groupId: "group-1",
      version: 1,
      versionCount,
      canRegenerate: versionCount < 3,
      canSwitch: versionCount > 1,
      disabledReason: versionCount >= 3 ? "这个问题已经保留了三个版本" : null,
      versions: Array.from({ length: versionCount }, (_, index) => ({
        messageId: `assistant-${index + 1}`,
        branchSessionId: `branch-${index + 1}`,
        version: index + 1,
        active: index === 0
      }))
    },
    sequence: 2,
    createdAt: "2026-07-20T00:00:00.000Z"
  };
}

function renderMenu(options?: {
  busy?: boolean;
  canDeepen?: boolean;
  versionCount?: number;
  onCorrectUnderstanding?: (rawText: string) => Promise<void> | void;
  onPrefetchVersion?: (messageId: string) => Promise<unknown> | void;
}) {
  const onRegenerate = vi.fn();
  const onCorrectUnderstanding = vi.fn(options?.onCorrectUnderstanding ?? (() => undefined));
  const onSwitchVersion = vi.fn();
  const onLimitAction = vi.fn();
  render(
    <InterviewResponseRegeneration
      message={buildMessage(options?.versionCount ?? 1)}
      canDeepen={options?.canDeepen ?? true}
      busy={options?.busy ?? false}
      onRegenerate={onRegenerate}
      onCorrectUnderstanding={onCorrectUnderstanding}
      onSwitchVersion={onSwitchVersion}
      onPrefetchVersion={options?.onPrefetchVersion}
      onLimitAction={onLimitAction}
      canGenerateFromLimit
    />
  );
  return {
    onRegenerate,
    onCorrectUnderstanding,
    onSwitchVersion,
    onLimitAction
  };
}

function createRect({
  top,
  left = 24,
  width = 32,
  height
}: {
  top: number;
  left?: number;
  width?: number;
  height: number;
}): DOMRect {
  return {
    x: left,
    y: top,
    top,
    left,
    right: left + width,
    bottom: top + height,
    width,
    height,
    toJSON: () => ({})
  } as DOMRect;
}

function mockPopoverGeometry({
  triggerTop,
  popoverHeight,
  viewportHeight = 800
}: {
  triggerTop: number;
  popoverHeight: number;
  viewportHeight?: number;
}) {
  const innerHeightSpy = vi.spyOn(window, "innerHeight", "get").mockReturnValue(viewportHeight);
  const innerWidthSpy = vi.spyOn(window, "innerWidth", "get").mockReturnValue(390);
  const rectSpy = vi
    .spyOn(HTMLElement.prototype, "getBoundingClientRect")
    .mockImplementation(function getBoundingClientRect(this: HTMLElement) {
      if (this.getAttribute("aria-label") === "换个问法") {
        return createRect({ top: triggerTop, height: 32 });
      }
      if (this.getAttribute("role") === "menu" || this.getAttribute("role") === "dialog") {
        return createRect({ top: 0, height: popoverHeight, width: 352 });
      }
      return createRect({ top: 0, height: 0, width: 0 });
    });
  const scrollHeightSpy = vi
    .spyOn(HTMLElement.prototype, "scrollHeight", "get")
    .mockImplementation(function scrollHeight(this: HTMLElement) {
      return this.getAttribute("role") === "menu" || this.getAttribute("role") === "dialog"
        ? popoverHeight
        : 0;
    });

  return () => {
    innerHeightSpy.mockRestore();
    innerWidthSpy.mockRestore();
    rectSpy.mockRestore();
    scrollHeightSpy.mockRestore();
  };
}

describe("回复换问法操作", () => {
  it("生成期间保留静态入口，把加载反馈交给原回复气泡", () => {
    renderMenu({ busy: true });

    const trigger = screen.getByRole("button", { name: "换个问法" });
    expect(trigger).toBeDisabled();
    expect(trigger.querySelector("svg")).toBeInTheDocument();
    expect(trigger.querySelector(".animate-spin")).not.toBeInTheDocument();
  });

  it("开场问题靠近顶部时向下展开完整菜单", async () => {
    const restoreGeometry = mockPopoverGeometry({ triggerTop: 64, popoverHeight: 420 });
    try {
      renderMenu();
      fireEvent.click(screen.getByRole("button", { name: "换个问法" }));

      const menu = await screen.findByRole("menu", { name: "选择换问法的方式" });
      await waitFor(() => {
        expect(menu).toHaveAttribute("data-placement", "bottom");
        expect(menu).toHaveStyle({ visibility: "visible" });
      });
    } finally {
      restoreGeometry();
    }
  });

  it("对话靠近底部时向上展开，并在空间不足时约束卡片内部滚动", async () => {
    const restoreGeometry = mockPopoverGeometry({
      triggerTop: 220,
      popoverHeight: 520,
      viewportHeight: 480
    });
    try {
      renderMenu();
      fireEvent.click(screen.getByRole("button", { name: "换个问法" }));

      const menu = await screen.findByRole("menu", { name: "选择换问法的方式" });
      await waitFor(() => {
        expect(menu).toHaveAttribute("data-placement", "bottom");
        expect(menu.style.maxHeight).toBe("208px");
        expect(menu).toHaveClass("overflow-y-auto");
      });
    } finally {
      restoreGeometry();
    }

    const restoreBottomGeometry = mockPopoverGeometry({ triggerTop: 700, popoverHeight: 420 });
    try {
      renderMenu();
      const triggers = screen.getAllByRole("button", { name: "换个问法" });
      fireEvent.click(triggers[triggers.length - 1]);
      const menus = await screen.findAllByRole("menu", { name: "选择换问法的方式" });
      await waitFor(() => expect(menus[menus.length - 1]).toHaveAttribute("data-placement", "top"));
    } finally {
      restoreBottomGeometry();
    }
  });

  it("解释简单与具体的区别，并按证据展示深入选项", async () => {
    const { onRegenerate } = renderMenu({ canDeepen: true });
    fireEvent.click(screen.getByRole("button", { name: "换个问法" }));

    expect(screen.getByText("保留原来的关注点，改成直白单句")).toBeInTheDocument();
    expect(screen.getByText("加入画面、动作、念头或时间锚点")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /再深入一点/u })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("menuitem", { name: /更具体一点/u }));
    await waitFor(() => expect(onRegenerate).toHaveBeenCalledWith("concretize"));
  });

  it("证据不足时隐藏深入选项", () => {
    renderMenu({ canDeepen: false });
    fireEvent.click(screen.getByRole("button", { name: "换个问法" }));
    expect(screen.queryByRole("menuitem", { name: /再深入一点/u })).not.toBeInTheDocument();
  });

  it("通过可见输入保存纠正理解", async () => {
    const { onCorrectUnderstanding } = renderMenu();
    fireEvent.click(screen.getByRole("button", { name: "换个问法" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /纠正理解/u }));
    fireEvent.change(screen.getByLabelText("哪个地方需要我重新理解？"), {
      target: { value: "刚才是同事帮助了我。" }
    });
    fireEvent.click(screen.getByRole("button", { name: "重新理解并继续" }));

    await waitFor(() =>
      expect(onCorrectUnderstanding).toHaveBeenCalledWith("刚才是同事帮助了我。")
    );
  });

  it("提交纠正理解后立即收起卡片，再等待处理结果", async () => {
    let finishCorrection: (() => void) | undefined;
    const correctionPromise = new Promise<void>((resolve) => {
      finishCorrection = resolve;
    });
    const { onCorrectUnderstanding } = renderMenu({
      onCorrectUnderstanding: () => correctionPromise
    });
    fireEvent.click(screen.getByRole("button", { name: "换个问法" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /纠正理解/u }));
    fireEvent.change(screen.getByLabelText("哪个地方需要我重新理解？"), {
      target: { value: "刚才是同事帮助了我。" }
    });
    fireEvent.click(screen.getByRole("button", { name: "重新理解并继续" }));

    expect(onCorrectUnderstanding).toHaveBeenCalledWith("刚才是同事帮助了我。");
    expect(screen.queryByRole("dialog", { name: "纠正理解" })).not.toBeInTheDocument();

    await act(async () => {
      finishCorrection?.();
      await correctionPromise;
    });
  });

  it("在纠正理解输入框中按回车提交", async () => {
    const { onCorrectUnderstanding } = renderMenu();
    fireEvent.click(screen.getByRole("button", { name: "换个问法" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /纠正理解/u }));
    const textarea = screen.getByLabelText("哪个地方需要我重新理解？");

    fireEvent.change(textarea, { target: { value: "刚才帮助我的是同事。" } });
    fireEvent.keyDown(textarea, { key: "Enter" });

    await waitFor(() => {
      expect(onCorrectUnderstanding).toHaveBeenCalledTimes(1);
      expect(onCorrectUnderstanding).toHaveBeenCalledWith("刚才帮助我的是同事。");
    });
    expect(screen.queryByRole("dialog", { name: "纠正理解" })).not.toBeInTheDocument();
  });

  it("在纠正理解输入框中保留 Shift+Enter 换行", () => {
    const { onCorrectUnderstanding } = renderMenu();
    fireEvent.click(screen.getByRole("button", { name: "换个问法" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /纠正理解/u }));
    const textarea = screen.getByLabelText("哪个地方需要我重新理解？") as HTMLTextAreaElement;

    fireEvent.change(textarea, { target: { value: "第一行" } });
    expect(fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true })).toBe(true);
    fireEvent.change(textarea, { target: { value: "第一行\n第二行" } });

    expect(onCorrectUnderstanding).not.toHaveBeenCalled();
    expect(textarea.value).toBe("第一行\n第二行");
  });

  it("中文输入法组合阶段的回车不会提交纠正理解", () => {
    const { onCorrectUnderstanding } = renderMenu();
    fireEvent.click(screen.getByRole("button", { name: "换个问法" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /纠正理解/u }));
    const textarea = screen.getByLabelText("哪个地方需要我重新理解？");

    fireEvent.change(textarea, { target: { value: "刚才帮助我的是同事。" } });
    fireEvent.compositionStart(textarea);
    fireEvent.keyDown(textarea, { key: "Enter", isComposing: true });

    expect(onCorrectUnderstanding).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "纠正理解" })).toBeInTheDocument();
  });

  it("连续回车只提交一次纠正理解", () => {
    const { onCorrectUnderstanding } = renderMenu({
      onCorrectUnderstanding: () => new Promise<void>(() => {})
    });
    fireEvent.click(screen.getByRole("button", { name: "换个问法" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /纠正理解/u }));
    const textarea = screen.getByLabelText("哪个地方需要我重新理解？");

    fireEvent.change(textarea, { target: { value: "刚才帮助我的是同事。" } });
    fireEvent.keyDown(textarea, { key: "Enter" });
    fireEvent.keyDown(textarea, { key: "Enter" });

    expect(onCorrectUnderstanding).toHaveBeenCalledTimes(1);
  });

  it("使用更大的圆角箭头并在交互前预加载目标版本", () => {
    const onPrefetchVersion = vi.fn();
    renderMenu({ versionCount: 2, onPrefetchVersion });
    const nextButton = screen.getByRole("button", { name: "查看下一个回复版本" });

    expect(nextButton).toHaveClass("size-9");
    expect(nextButton.querySelector("svg")).toHaveClass("size-[22px]");
    fireEvent.pointerEnter(nextButton);
    expect(onPrefetchVersion).toHaveBeenCalledWith("assistant-2");
  });

  it("三个版本后进入低压选择", () => {
    const { onLimitAction } = renderMenu({ versionCount: 3 });
    fireEvent.click(screen.getByRole("button", { name: "换个问法" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "换个片段" }));
    expect(onLimitAction).toHaveBeenCalledWith("next_event");
  });
});
