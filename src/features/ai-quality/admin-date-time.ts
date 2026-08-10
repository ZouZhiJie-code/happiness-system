const ADMIN_TIME_ZONE = "Asia/Shanghai";

const adminDateTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: ADMIN_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23"
});

export function formatAdminDateTime(value: string | Date) {
  const parts = Object.fromEntries(
    adminDateTimeFormatter
      .formatToParts(typeof value === "string" ? new Date(value) : value)
      .map((part) => [part.type, part.value])
  );

  return `${parts.year}/${parts.month}/${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}
