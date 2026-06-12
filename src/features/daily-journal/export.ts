const INVALID_FILENAME_CHARS = /[\\/:*?"<>|]/g;
const MAX_FILENAME_TITLE_LENGTH = 32;

export function buildDailyJournalMarkdown(input: {
  date: string;
  title: string;
  content: string;
}): string {
  const title = input.title.trim();
  const content = input.content.trim();

  return `# ${title}\n\n${input.date} · Daily Light\n\n---\n\n${content}`;
}

export function sanitizeDailyJournalExportTitle(title: string): string {
  const normalized = title
    .trim()
    .replace(INVALID_FILENAME_CHARS, "-")
    .replace(/\s+/g, " ")
    .slice(0, MAX_FILENAME_TITLE_LENGTH)
    .trimEnd();

  return normalized || "未命名";
}

export function buildDailyJournalExportFilename(input: { date: string; title: string }): string {
  const safeTitle = sanitizeDailyJournalExportTitle(input.title);
  return `${input.date}_完整日志_${safeTitle}.md`;
}

export async function copyDailyJournalMarkdown(input: {
  date: string;
  title: string;
  content: string;
}): Promise<void> {
  const markdown = buildDailyJournalMarkdown(input);

  if (!navigator.clipboard?.writeText) {
    throw new Error("CLIPBOARD_UNAVAILABLE");
  }

  await navigator.clipboard.writeText(markdown);
}

export function downloadDailyJournalMarkdown(input: { date: string; title: string; content: string }): void {
  const markdown = buildDailyJournalMarkdown(input);
  const filename = buildDailyJournalExportFilename(input);
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
