import {
  buildCalendarActionAccessibleName,
  buildCalendarDateButtonAccessibleName,
  getCalendarErrorLabel,
  getCalendarLoadingLabel
} from "@/features/calendar/accessibility";
import {
  getCalendarDimensionVisualMeta,
  getCalendarMonthDimensionPillClass,
  getCalendarStatusVisualMeta
} from "@/features/calendar/presentation";

describe("calendar presentation helpers", () => {
  it("maps each status to a distinct visual meta set", () => {
    const statuses = ["empty", "in_progress", "draft", "completed", "mixed"] as const;
    const badgeClasses = new Set(statuses.map((status) => getCalendarStatusVisualMeta(status).badgeClass));
    const surfaceClasses = new Set(statuses.map((status) => getCalendarStatusVisualMeta(status).surfaceClass));
    const markerClasses = new Set(statuses.map((status) => getCalendarStatusVisualMeta(status).markerClass));

    expect(badgeClasses.size).toBe(statuses.length);
    expect(surfaceClasses.size).toBe(statuses.length);
    expect(markerClasses.size).toBe(statuses.length);
  });

  it("returns stable short labels and accent styles for every dimension", () => {
    expect(getCalendarDimensionVisualMeta("joy").shortLabel).toBe("开心");
    expect(getCalendarDimensionVisualMeta("fulfillment").shortLabel).toBe("充实");
    expect(getCalendarDimensionVisualMeta("reflection").shortLabel).toBe("思考");
    expect(getCalendarDimensionVisualMeta("improvement").shortLabel).toBe("改进");
    expect(getCalendarDimensionVisualMeta("gratitude").shortLabel).toBe("感谢");

    expect(getCalendarDimensionVisualMeta("joy").softBadgeClass).not.toBe(getCalendarDimensionVisualMeta("gratitude").softBadgeClass);
    expect(getCalendarDimensionVisualMeta("reflection").solidBadgeClass).not.toBe(
      getCalendarDimensionVisualMeta("improvement").solidBadgeClass
    );
  });

  it("keeps mixed month-dimension pills visually distinct from other tones", () => {
    expect(getCalendarMonthDimensionPillClass("mixed")).not.toBe(getCalendarMonthDimensionPillClass("completed"));
    expect(getCalendarMonthDimensionPillClass("mixed")).not.toBe(getCalendarMonthDimensionPillClass("draft"));
    expect(getCalendarMonthDimensionPillClass("empty")).not.toBe(getCalendarMonthDimensionPillClass("active"));
  });

  it("builds complete accessible names for date buttons and actions", () => {
    expect(
      buildCalendarDateButtonAccessibleName({
        dateLabel: "5月2日",
        statusLabel: "混合状态",
        preview: "这一天需要继续分流",
        isToday: true,
        isSelected: true,
        dimensionLabels: ["开心", "充实", "思考"],
        extraDimensionCount: 1
      })
    ).toContain("已选中");

    expect(
      buildCalendarActionAccessibleName({
        dateLabel: "5月2日",
        dimensionLabel: "开心",
        statusLabel: "有草稿",
        title: "还在整理的那段",
        actionLabel: "继续编辑"
      })
    ).toBe("5月2日，开心，有草稿，还在整理的那段，继续编辑");
  });

  it("returns short loading and error labels for every calendar scope", () => {
    expect(getCalendarLoadingLabel("month")).toBe("正在读取本月记录。");
    expect(getCalendarLoadingLabel("toolbar")).toBe("正在读取摘要。");
    expect(getCalendarErrorLabel("week")).toBe("本周记录暂时没打开。");
    expect(getCalendarErrorLabel("day")).toBe("当天记录暂时没打开。");
  });
});
