export function shanghaiEntryDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(now);
}

export function entryDateLabelPattern(entryDate: string) {
  const [, month = "", day = ""] = entryDate.split("-");
  return new RegExp(`${Number(month)}\\s*月\\s*${Number(day)}\\s*日`, "u");
}
