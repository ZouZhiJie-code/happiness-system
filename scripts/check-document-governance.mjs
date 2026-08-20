import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, resolve, sep } from "node:path";
import process from "node:process";

const projectRoot = resolve(process.cwd());

const coreDocuments = [
  "AGENTS.md",
  "README.md",
  "PRODUCT.md",
  "DESIGN.md",
  "Tech_Design.md",
  "docs/README.md",
  "docs/handoff.md",
  "docs/architecture.md",
  "docs/integration-guide.md",
  "docs/operator-runbook.md",
  "docs/interview-product-optimization-map.md",
  "docs/generative-interview-refactor-map.md",
  "docs/ai-evaluation-standard.md",
  "docs/vercel-preview-production-lane.md",
  "docs/design/ui-conventions.md",
  "docs/technical/interview-event-centered/04j-generative-quality-evaluation-v1.md",
  "docs/maintenance/2026-08-16-documentation-governance-and-workspace-audit.md",
  "docs/maintenance/2026-08-16-document-governance-cleanup-preview.md",
  "artifacts/README.md",
  "artifacts/daily-light-visual-review/README.md",
  "artifacts/generative-interview-board6/README.md",
  "artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1/README.md",
  "artifacts/generative-interview-board7/README.md",
  "artifacts/generative-interview-board8/README.md",
];

const allowedRoles = new Set([
  "Agent 协作规则",
  "项目入口",
  "知识导航",
  "稳定合同",
  "总 Map",
  "当前执行交接",
  "当前专项",
  "任务记录",
  "证据索引",
  "历史证据",
]);

const allowedStatuses = new Set([
  "现役",
  "待确认",
  "已确认·实施中",
  "待验证",
  "已完成",
  "暂停",
  "No-Go",
  "历史证据",
]);

const ignoredLinkPrefixes = [
  "#",
  "/",
  "http://",
  "https://",
  "mailto:",
  "tel:",
  "data:",
  "javascript:",
];

function stripCodeFences(markdown) {
  return markdown.replace(/```[\s\S]*?```/g, "").replace(/~~~[\s\S]*?~~~/g, "");
}

function readMetadata(markdown) {
  const bulletRole = markdown.match(/^- 文档职责：\s*(.+)$/m)?.[1]?.trim();
  const bulletStatus = markdown.match(/^- 文档状态：\s*(.+)$/m)?.[1]?.trim();
  const bulletDate = markdown.match(/^- 最后核验：\s*`?(\d{4}-\d{2}-\d{2})`?$/m)?.[1];
  const bulletAuthority = markdown.match(/^- 权威入口：\s*(.+)$/m)?.[1]?.trim();

  const yamlRole = markdown.match(/^document_role:\s*["']?([^"'\n]+)["']?$/m)?.[1]?.trim();
  const yamlStatus = markdown.match(/^document_status:\s*["']?([^"'\n]+)["']?$/m)?.[1]?.trim();
  const yamlDate = markdown.match(/^last_verified:\s*["']?(\d{4}-\d{2}-\d{2})["']?$/m)?.[1];
  const yamlAuthority = markdown.match(/^authority:\s*["']?([^"'\n]+)["']?$/m)?.[1]?.trim();

  return {
    role: bulletRole ?? yamlRole,
    status: bulletStatus ?? yamlStatus,
    date: bulletDate ?? yamlDate,
    authority: bulletAuthority ?? yamlAuthority,
  };
}

function metadataErrors(relativePath, markdown) {
  const metadata = readMetadata(markdown);
  const errors = [];

  if (!metadata.role) errors.push(`${relativePath}: 缺少文档职责`);
  if (!metadata.status) errors.push(`${relativePath}: 缺少文档状态`);
  if (!metadata.date) errors.push(`${relativePath}: 缺少 YYYY-MM-DD 格式的最后核验日期`);
  if (!metadata.authority) errors.push(`${relativePath}: 缺少权威入口`);

  if (metadata.role && !allowedRoles.has(metadata.role)) {
    errors.push(`${relativePath}: 未知文档职责“${metadata.role}”`);
  }
  if (metadata.status && !allowedStatuses.has(metadata.status)) {
    errors.push(`${relativePath}: 未知文档状态“${metadata.status}”`);
  }
  if (metadata.status === "历史证据" && !markdown.slice(0, 1600).includes("历史")) {
    errors.push(`${relativePath}: 历史证据缺少可见历史身份说明`);
  }

  return errors;
}

function extractLocalLinks(markdown) {
  const links = [];
  const source = stripCodeFences(markdown);
  const pattern = /!?\[[^\]]*\]\(([^)]+)\)/g;

  for (const match of source.matchAll(pattern)) {
    let target = match[1].trim();
    if (target.startsWith("<") && target.includes(">")) {
      target = target.slice(1, target.indexOf(">"));
    } else {
      target = target.split(/\s+["']/u)[0];
    }

    if (!target || ignoredLinkPrefixes.some((prefix) => target.startsWith(prefix))) continue;
    if (target.includes("${") || target.includes("*")) continue;

    const withoutFragment = target.split("#", 1)[0].split("?", 1)[0];
    if (!withoutFragment) continue;

    try {
      links.push(decodeURIComponent(withoutFragment));
    } catch {
      links.push(withoutFragment);
    }
  }

  return links;
}

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function linkErrors(root, relativePath, markdown) {
  const errors = [];
  const links = extractLocalLinks(markdown);
  const sourceDirectory = dirname(resolve(root, relativePath));

  for (const link of links) {
    const target = isAbsolute(link) ? resolve(root, `.${link}`) : resolve(sourceDirectory, link);
    const rootPrefix = `${resolve(root)}${sep}`;
    if (target !== resolve(root) && !target.startsWith(rootPrefix)) {
      errors.push(`${relativePath}: 本地链接越出项目根目录 ${link}`);
      continue;
    }
    if (!(await pathExists(target))) {
      errors.push(`${relativePath}: 本地链接不存在 ${link}`);
    }
  }

  return { errors, linkCount: links.length };
}

async function validateProject() {
  const errors = [];
  let linkCount = 0;
  let currentEntryCount = 0;

  for (const relativePath of coreDocuments) {
    const absolutePath = resolve(projectRoot, relativePath);
    if (!(await pathExists(absolutePath))) {
      errors.push(`${relativePath}: 核心文档不存在`);
      continue;
    }

    const markdown = await readFile(absolutePath, "utf8");
    errors.push(...metadataErrors(relativePath, markdown));

    const result = await linkErrors(projectRoot, relativePath, markdown);
    errors.push(...result.errors);
    linkCount += result.linkCount;

    currentEntryCount += markdown.match(/当前执行入口：/g)?.length ?? 0;
  }

  if (currentEntryCount !== 1) {
    errors.push(`核心文档中的“当前执行入口”应恰好出现 1 次，实际为 ${currentEntryCount} 次`);
  }

  return { errors, linkCount, currentEntryCount };
}

async function runSelfTest() {
  const fixtureRoot = await mkdtemp(join(tmpdir(), "daily-light-docs-check-"));
  try {
    await writeFile(join(fixtureRoot, "target.md"), "# Target\n", "utf8");
    const good = [
      "# Good",
      "",
      "- 文档职责：稳定合同",
      "- 文档状态：现役",
      "- 最后核验：`2026-08-16`",
      "- 权威入口：[Target](./target.md)",
      "",
    ].join("\n");
    const badMetadata = "# Bad metadata\n\n- 文档状态：未知\n";
    const badLink = `${good}[Missing](./missing.md)\n`;

    const goodMetadataErrors = metadataErrors("good.md", good);
    const goodLinkErrors = (await linkErrors(fixtureRoot, "good.md", good)).errors;
    const missingMetadataErrors = metadataErrors("bad-metadata.md", badMetadata);
    const missingLinkErrors = (await linkErrors(fixtureRoot, "bad-link.md", badLink)).errors;

    if (goodMetadataErrors.length || goodLinkErrors.length) {
      throw new Error("合法临时样例被错误拦截");
    }
    if (missingMetadataErrors.length < 3) {
      throw new Error("缺失字段临时样例未被完整拦截");
    }
    if (missingLinkErrors.length !== 1) {
      throw new Error("坏链接临时样例未被正确拦截");
    }
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
}

async function main() {
  if (process.argv.includes("--self-test")) {
    await runSelfTest();
    console.log("docs:check self-test passed: missing metadata and broken links were blocked.");
    return;
  }

  const result = await validateProject();
  if (result.errors.length) {
    console.error(`docs:check failed with ${result.errors.length} issue(s):`);
    for (const error of result.errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `docs:check passed: ${coreDocuments.length} core documents, ${result.linkCount} local links, ${result.currentEntryCount} current entry.`,
  );
}

await main();
