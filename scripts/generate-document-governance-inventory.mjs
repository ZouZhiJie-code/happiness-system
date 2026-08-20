import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import process from "node:process";

const projectRoot = resolve(process.cwd());
const outputDirectory = resolve(projectRoot, "docs/maintenance");
const documentInventoryPath = resolve(
  outputDirectory,
  "2026-08-16-document-inventory.csv",
);
const packageInventoryPath = resolve(
  outputDirectory,
  "2026-08-16-evidence-package-inventory.csv",
);
const workspaceInventoryPath = resolve(
  outputDirectory,
  "2026-08-16-workspace-disposition-ledger.csv",
);

const skipDirectoryNames = new Set([
  ".git",
  ".next",
  ".next-dev",
  ".private",
  ".turbo",
  ".cache",
  ".venv",
  "__pycache__",
  "build",
  "dist",
  "node_modules",
  "target",
  "vendor",
  "venv",
]);

const governancePaths = new Set([
  "AGENTS.md",
  "README.md",
  "PRODUCT.md",
  "DESIGN.md",
  "Tech_Design.md",
  "package.json",
  "scripts/check-document-governance.mjs",
  "scripts/generate-document-governance-inventory.mjs",
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
  "docs/maintenance/2026-08-16-document-inventory.csv",
  "docs/maintenance/2026-08-16-evidence-package-inventory.csv",
  "docs/maintenance/2026-08-16-workspace-disposition-ledger.csv",
  "artifacts/README.md",
  "artifacts/daily-light-visual-review/README.md",
  "artifacts/generative-interview-board6/README.md",
  "artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1/README.md",
  "artifacts/generative-interview-board7/README.md",
  "artifacts/generative-interview-board8/README.md",
]);

const currentEvidencePrefixes = [
  "artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1/",
  "artifacts/journal-generation-evaluation/",
  "artifacts/daily-light-visual-review/2026-08-13-production-release/",
  "artifacts/daily-light-visual-review/2026-08-13-second-round-closeout/",
];

const historyPrefixes = [
  "artifacts/generative-interview-board7/",
  "artifacts/generative-interview-board8/",
  "docs/ai-tasks/done/",
  "docs/plans/",
  "docs/retrospectives/",
  "docs/vibe-coding-series/",
];

function runGit(args) {
  return execFileSync("git", args, {
    cwd: projectRoot,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
}

function parseNullList(value) {
  return value.split("\0").filter(Boolean);
}

function csvCell(value) {
  const text = String(value ?? "").replaceAll("\r", " ").replaceAll("\n", " ");
  return `"${text.replaceAll('"', '""')}"`;
}

function csv(headers, rows) {
  return [
    headers.map(csvCell).join(","),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")),
    "",
  ].join("\n");
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function walkFiles(directory, options = {}) {
  const result = [];
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const absolutePath = resolve(directory, entry.name);
    const relativePath = relative(projectRoot, absolutePath);
    if (entry.isDirectory()) {
      if (skipDirectoryNames.has(entry.name)) {
        if (entry.name === ".private" && options.privateCounter) {
          options.privateCounter.count += await countFiles(absolutePath);
        }
        continue;
      }
      result.push(...(await walkFiles(absolutePath, options)));
    } else if (!options.filter || options.filter(relativePath)) {
      result.push(relativePath);
    }
  }
  return result;
}

async function countFiles(directory) {
  let count = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolutePath = resolve(directory, entry.name);
    if (entry.isDirectory()) count += await countFiles(absolutePath);
    else count += 1;
  }
  return count;
}

async function countPrivateFiles(directory) {
  let count = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && skipDirectoryNames.has(entry.name) && entry.name !== ".private") {
      continue;
    }
    const absolutePath = resolve(directory, entry.name);
    if (entry.isDirectory() && entry.name === ".private") {
      count += await countFiles(absolutePath);
    } else if (entry.isDirectory()) {
      count += await countPrivateFiles(absolutePath);
    }
  }
  return count;
}

async function sha256(relativePath) {
  const content = await readFile(resolve(projectRoot, relativePath));
  return createHash("sha256").update(content).digest("hex");
}

function readMetadata(markdown) {
  const bulletRole = markdown.match(/^- 文档职责：\s*(.+)$/m)?.[1]?.trim();
  const bulletStatus = markdown.match(/^- 文档状态：\s*(.+)$/m)?.[1]?.trim();
  const bulletAuthority = markdown.match(/^- 权威入口：\s*(.+)$/m)?.[1]?.trim();
  const yamlRole = markdown.match(/^document_role:\s*["']?([^"'\n]+)["']?$/m)?.[1]?.trim();
  const yamlStatus = markdown.match(/^document_status:\s*["']?([^"'\n]+)["']?$/m)?.[1]?.trim();
  const yamlAuthority = markdown.match(/^authority:\s*["']?([^"'\n]+)["']?$/m)?.[1]?.trim();
  return {
    role: bulletRole ?? yamlRole ?? "",
    status: bulletStatus ?? yamlStatus ?? "",
    authority: bulletAuthority ?? yamlAuthority ?? "",
  };
}

function extractLocalLinks(markdown) {
  const links = [];
  const source = markdown.replace(/```[\s\S]*?```/gu, "").replace(/~~~[\s\S]*?~~~/gu, "");
  const pattern = /!?\[[^\]]*\]\(([^)]+)\)/gu;
  for (const match of source.matchAll(pattern)) {
    let target = match[1].trim();
    if (target.startsWith("<") && target.includes(">")) {
      target = target.slice(1, target.indexOf(">"));
    } else {
      target = target.split(/\s+["']/u)[0];
    }
    if (
      !target ||
      ["#", "/", "http://", "https://", "mailto:", "tel:", "data:", "javascript:"].some(
        (prefix) => target.startsWith(prefix),
      ) ||
      target.includes("${") ||
      target.includes("*")
    ) {
      continue;
    }
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

async function documentLinkHealth(path, markdown) {
  const links = extractLocalLinks(markdown);
  const missing = [];
  const sourceDirectory = dirname(resolve(projectRoot, path));
  const rootPrefix = `${projectRoot}${sep}`;
  for (const link of links) {
    const target = resolve(sourceDirectory, link);
    if (target !== projectRoot && !target.startsWith(rootPrefix)) {
      missing.push(`越界:${link}`);
    } else if (!(await exists(target))) {
      missing.push(link);
    }
  }
  return { count: links.length, missing };
}

function inferDocumentRole(path, metadata) {
  if (metadata.role) return metadata.role;
  if (path === "AGENT.md") return "兼容指针";
  if (path.startsWith(".firecrawl/")) return "本地研究缓存";
  if (path.startsWith(".worktrees/")) return "隔离成果";
  if (path.startsWith("docs/plans/") || path.startsWith("docs/ai-tasks/")) {
    return "任务记录";
  }
  if (path.startsWith("docs/maintenance/")) return "任务记录";
  if (
    path.startsWith("docs/design/") ||
    path.startsWith("docs/theory/") ||
    path.startsWith("docs/templates/")
  ) {
    return "稳定合同";
  }
  if (path.startsWith("docs/retrospectives/") || path.startsWith("docs/vibe-coding-series/")) {
    return "历史证据";
  }
  if (path.startsWith("artifacts/") && basename(path).toLowerCase() === "readme.md") {
    return "证据索引";
  }
  if (path.startsWith("artifacts/")) return "历史证据";
  if (path.startsWith("evals/")) return "评测资产";
  if (path.startsWith("docs/")) return "稳定合同";
  return "项目资料";
}

function inferDocumentStatus(path, metadata) {
  if (metadata.status) return metadata.status;
  if (path.startsWith(".worktrees/")) return "待确认";
  if (path.startsWith(".firecrawl/")) return "历史证据";
  if (path === "AGENT.md") return "历史证据";
  if (path.startsWith("docs/ai-tasks/running/")) return "待确认";
  if (historyPrefixes.some((prefix) => path.startsWith(prefix))) return "历史证据";
  if (path.startsWith("docs/maintenance/") && !path.includes("2026-08-16-document")) {
    return "历史证据";
  }
  if (path.startsWith("artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1/")) {
    if (path.endsWith("/README.md") || /stage-c3-/u.test(path)) return "现役";
    if (/stage-(?:b|c2|c)-/u.test(path) || /judge-prompt-v1/u.test(path)) return "历史证据";
    return "已完成";
  }
  if (path.startsWith("artifacts/journal-generation-evaluation/")) {
    return path.endsWith("/README.md") ? "现役" : "已完成";
  }
  if (
    path.startsWith("artifacts/daily-light-visual-review/2026-08-13-production-release/") ||
    path.startsWith("artifacts/daily-light-visual-review/2026-08-13-second-round-closeout/")
  ) {
    return "已完成";
  }
  if (
    path.startsWith("artifacts/daily-light-visual-review/") &&
    !currentEvidencePrefixes.some((prefix) => path.startsWith(prefix))
  ) {
    return "历史证据";
  }
  if (currentEvidencePrefixes.some((prefix) => path.startsWith(prefix))) return "现役";
  if (path.startsWith("artifacts/")) return "历史证据";
  return "现役";
}

function inferDocumentAuthority(path, metadata) {
  if (metadata.authority) return metadata.authority;
  if (path.startsWith(".worktrees/")) return "本地隔离成果；尚未接入主仓导航";
  if (path.startsWith(".firecrawl/")) return "无现役入口；仅供本地研究回溯";
  if (path.startsWith("artifacts/generative-interview-board7/")) {
    return "artifacts/generative-interview-board7/README.md";
  }
  if (path.startsWith("artifacts/generative-interview-board8/")) {
    return "artifacts/generative-interview-board8/README.md";
  }
  if (path.startsWith("artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1/")) {
    return "artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1/README.md";
  }
  if (path.startsWith("artifacts/journal-generation-evaluation/")) {
    return "artifacts/journal-generation-evaluation/README.md";
  }
  if (path.startsWith("artifacts/daily-light-visual-review/")) {
    return "artifacts/daily-light-visual-review/README.md";
  }
  if (path.startsWith("artifacts/")) return "artifacts/README.md";
  if (path.startsWith("evals/interview-intent/")) {
    return "docs/interview-intent-evaluation-source-of-truth.md";
  }
  if (path.startsWith("evals/")) return "docs/ai-evaluation-standard.md";
  if (path.startsWith("docs/plans/") || path.startsWith("docs/ai-tasks/")) {
    return "docs/handoff.md";
  }
  if (path.startsWith("docs/")) return "docs/README.md";
  return "README.md";
}

function inferReplacement(path) {
  if (
    path.startsWith("artifacts/generative-interview-board7/") ||
    path.startsWith("artifacts/generative-interview-board8/")
  ) {
    return "docs/generative-interview-refactor-map.md";
  }
  if (
    path.startsWith("artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1/") &&
    (/stage-(?:b|c2|c)-/u.test(path) || /judge-prompt-v1/u.test(path))
  ) {
    return "artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1/README.md";
  }
  if (
    path.startsWith("artifacts/daily-light-visual-review/") &&
    !path.startsWith("artifacts/daily-light-visual-review/2026-08-13-production-release/") &&
    !path.startsWith("artifacts/daily-light-visual-review/2026-08-13-second-round-closeout/")
  ) {
    return "artifacts/daily-light-visual-review/2026-08-13-production-release/README.md";
  }
  if (path.startsWith("docs/plans/") || path.startsWith("docs/ai-tasks/done/")) {
    return "docs/handoff.md";
  }
  if (path.startsWith("docs/maintenance/") && !path.includes("2026-08-16-document")) {
    return "docs/maintenance/2026-08-16-documentation-governance-and-workspace-audit.md";
  }
  if (path.startsWith(".firecrawl/") || path.startsWith(".worktrees/")) return "";
  return "";
}

function inferPrivacy(path, tracked, ignored) {
  if (path.startsWith(".worktrees/")) return "本地隔离成果";
  if (path.startsWith(".firecrawl/")) return "本地研究缓存";
  if (ignored) return "本地忽略";
  if (
    path.startsWith("artifacts/") &&
    /(blind|hidden|human|judge|private|review|trajectory)/iu.test(path)
  ) {
    return "公开脱敏证据";
  }
  if (path.startsWith("artifacts/") || path.startsWith("evals/")) {
    return "公开证据";
  }
  return tracked ? "公开仓库" : "公开待纳入";
}

function inferDocumentDisposition(path) {
  if (path.startsWith(".firecrawl/")) return "清理候选";
  if (path.startsWith(".worktrees/")) return "需人工判断";
  if (path.startsWith("docs/plans/") || path.startsWith("docs/ai-tasks/done/")) {
    return "转历史（原位）";
  }
  if (path.startsWith("docs/retrospectives/") || path.startsWith("docs/vibe-coding-series/")) {
    return "保留历史";
  }
  if (path.startsWith("artifacts/generative-interview-board7/")) return "保留历史证据";
  if (path.startsWith("artifacts/generative-interview-board8/")) return "保留历史证据";
  if (path.startsWith("artifacts/")) return "保留证据";
  if (path === "AGENT.md") return "保留兼容指针";
  return "保留";
}

function inferDocumentProcessing(path) {
  if (
    [
      "artifacts/README.md",
      "artifacts/generative-interview-board7/README.md",
      "artifacts/generative-interview-board8/README.md",
    ].includes(path)
  ) {
    return "包级索引已收口";
  }
  if (governancePaths.has(path)) return "本轮已复核";
  return "保持原位";
}

function parseStatusEntries() {
  const raw = runGit(["status", "--porcelain=v1", "-z", "-uall"]);
  const entries = [];
  const parts = raw.split("\0").filter(Boolean);
  for (let index = 0; index < parts.length; index += 1) {
    const item = parts[index];
    const statusCode = item.slice(0, 2);
    const path = item.slice(3);
    entries.push({ path, statusCode });
    if (statusCode.includes("R") || statusCode.includes("C")) index += 1;
  }
  return entries;
}

function parseDiffEntries(base) {
  const raw = runGit(["diff", "--name-status", "-z", base, "--"]);
  const parts = raw.split("\0").filter(Boolean);
  const entries = [];
  for (let index = 0; index < parts.length; ) {
    const statusCode = parts[index];
    index += 1;
    if (statusCode.startsWith("R") || statusCode.startsWith("C")) {
      index += 1;
      entries.push({ path: parts[index], statusCode });
      index += 1;
      continue;
    }
    entries.push({ path: parts[index], statusCode });
    index += 1;
  }
  return entries;
}

function parseWorkspaceEntries(base) {
  if (!base) return parseStatusEntries();
  const entries = new Map(parseDiffEntries(base).map((entry) => [entry.path, entry]));
  for (const entry of parseStatusEntries()) entries.set(entry.path, entry);
  return [...entries.values()];
}

function parsePriorLedgerPaths(markdown) {
  const paths = new Set();
  for (const match of markdown.matchAll(/^\|\s*\d+\s*\|[^\n]*?`([^`]+)`[^\n]*$/gm)) {
    paths.add(match[1]);
  }
  return paths;
}

function workspaceLineage(path, priorPaths) {
  if (governancePaths.has(path)) return "文档治理";
  if (priorPaths.has(path)) return "2026-08-12 当前开发血缘";
  if (path.startsWith("artifacts/generative-interview-board6/2026-08-13-")) {
    return "独立成果：GI-088 C3";
  }
  if (path.startsWith("artifacts/daily-light-visual-review/2026-08-13-")) {
    return "独立成果：网页端验收与发布证据";
  }
  if (path.startsWith("docs/ai-tasks/running/")) return "独立成果：项目复盘";
  if (path.startsWith(".codex-local/")) return "本地一次性文件";
  return "当前开发血缘：后续增量";
}

function workspaceMaterial(path) {
  if (governancePaths.has(path)) return "文档治理";
  if (path.startsWith("src/")) return "产品代码";
  if (path.startsWith("tests/")) return "测试";
  if (path.startsWith("prisma/")) return "数据结构与迁移";
  if (path.startsWith("artifacts/")) return "证据";
  if (path.startsWith("docs/")) return "文档";
  if (path.startsWith("scripts/")) return "脚本";
  if (path.startsWith(".env")) return "环境合同";
  if (path.startsWith(".codex-local/")) return "本地一次性文件";
  return "工程配置";
}

function workspacePrivacy(path) {
  if (path.startsWith(".codex-local/")) return "本地状态";
  if (/(\.env$|\.private\/|credential|secret)/iu.test(path)) return "敏感边界";
  if (path.startsWith("artifacts/")) return "公开脱敏或运行证据";
  return "公开工作区";
}

function workspaceDisposition(path, closeoutMode) {
  if (closeoutMode) return "本轮提交：本地阶段检查点";
  if (path.startsWith(".codex-local/")) return "清理候选";
  if (governancePaths.has(path)) return "保留：文档治理成果";
  if (path.startsWith("artifacts/")) return "保留：独立证据";
  return "保留：当前开发成果";
}

function workspaceRisk(path, closeoutMode) {
  if (closeoutMode) return "已纳入本地提交；恢复时按检查点版本回退或取回";
  if (path.startsWith(".codex-local/")) return "零字节本地分享状态；删除前仍需产品负责人确认";
  if (path.startsWith("artifacts/")) return "可能承载唯一裁决或版本身份；单独交付前保持原样";
  if (governancePaths.has(path)) return "随本轮治理一起复核；当前不提交";
  return "属于脏工作区开发血缘；当前不重排、不暂存、不提交";
}

async function directChildDirectories(parent) {
  const result = [];
  for (const entry of await readdir(parent, { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name !== ".private") result.push(resolve(parent, entry.name));
  }
  return result.sort();
}

async function packagePaths() {
  const result = [];
  for (const rootName of ["artifacts", "evals"]) {
    const root = resolve(projectRoot, rootName);
    for (const topLevel of await directChildDirectories(root)) {
      result.push(relative(projectRoot, topLevel));
      for (const child of await directChildDirectories(topLevel)) {
        result.push(relative(projectRoot, child));
      }
    }
  }
  return result.sort();
}

async function packageStats(path, trackedSet) {
  const absolutePath = resolve(projectRoot, path);
  const privateCounter = { count: 0 };
  const files = await walkFiles(absolutePath, { privateCounter });
  const markdownFiles = files.filter((file) => /\.mdx?$/iu.test(file));
  const indexPath = join(path, "README.md");
  const hasIndex = await exists(resolve(projectRoot, indexPath));
  const trackedFiles = files.filter((file) => trackedSet.has(file)).length;
  return {
    files,
    markdownFiles,
    privateFileCount: privateCounter.count,
    indexPath: hasIndex ? indexPath : "",
    trackedFiles,
  };
}

function packageClassification(path, stats) {
  if (path === "artifacts/generative-interview-board6") {
    return {
      role: "当前评测证据索引",
      status: "现役",
      authority: "docs/generative-interview-refactor-map.md",
      replacement: "",
      privacy: stats.privateFileCount ? "公开脱敏＋私有聚合" : "公开脱敏证据",
      disposition: "保留",
      reason: "Board 6 当前入口已统一指向 GI-088 阶段 C3",
    };
  }
  if (path === "artifacts/daily-light-visual-review") {
    return {
      role: "网页端证据索引",
      status: "现役",
      authority: "docs/vercel-preview-production-lane.md",
      replacement: "",
      privacy: "公开证据",
      disposition: "保留",
      reason: "区分当前验收与发布证据、历史视觉候选和 No-Go",
    };
  }
  if (path.startsWith("artifacts/local-runtime")) {
    return {
      role: "本地运行证据",
      status: "待确认",
      authority: "artifacts/README.md",
      replacement: "",
      privacy: stats.privateFileCount ? "本地运行证据＋私有聚合" : "本地运行证据",
      disposition: "需人工判断",
      reason: "包含被 Git 忽略的运行过程；清理前需确认不存在唯一原始证据",
    };
  }
  if (path.startsWith("artifacts/generative-interview-board7")) {
    return {
      role: "历史证据包",
      status: "历史证据",
      authority: "artifacts/generative-interview-board7/README.md",
      replacement: "docs/generative-interview-refactor-map.md",
      privacy: stats.privateFileCount ? "公开脱敏＋私有聚合" : "公开脱敏证据",
      disposition: "保留",
      reason: "保留候选血缘、原始结果、真人裁决和版本身份",
    };
  }
  if (path.startsWith("artifacts/generative-interview-board8")) {
    return {
      role: "历史证据包",
      status: "历史证据",
      authority: "artifacts/generative-interview-board8/README.md",
      replacement: "docs/generative-interview-refactor-map.md",
      privacy: stats.privateFileCount ? "公开脱敏＋私有聚合" : "公开脱敏证据",
      disposition: "保留",
      reason: "保留历史 Preview、修复与 No-Go 裁决",
    };
  }
  if (path.includes("2026-08-13-gi088-dual-track-v1")) {
    return {
      role: "当前证据包",
      status: "现役",
      authority: "docs/generative-interview-refactor-map.md",
      replacement: "",
      privacy: stats.privateFileCount ? "公开脱敏＋私有聚合" : "公开脱敏证据",
      disposition: "保留",
      reason: "GI-088 阶段 C3 当前证据入口",
    };
  }
  if (path.startsWith("artifacts/journal-generation-evaluation")) {
    return {
      role: "当前评测证据包",
      status: "现役",
      authority: "artifacts/journal-generation-evaluation/README.md",
      replacement: "",
      privacy: stats.privateFileCount ? "公开脱敏＋私有聚合" : "公开脱敏证据",
      disposition: "保留",
      reason: "日志生成评测与隔离评审当前入口",
    };
  }
  if (path.includes("2026-08-13-production-release")) {
    return {
      role: "Production 发布证据包",
      status: "已完成",
      authority: "docs/vercel-preview-production-lane.md",
      replacement: "",
      privacy: "公开证据",
      disposition: "保留",
      reason: "当前 Production 版本身份、迁移和回退证据",
    };
  }
  if (path.includes("2026-08-13-second-round-closeout")) {
    return {
      role: "产品验收证据包",
      status: "已完成",
      authority: "artifacts/daily-light-visual-review/2026-08-13-production-release/README.md",
      replacement: "",
      privacy: "公开证据",
      disposition: "保留",
      reason: "当前 Production 上游视觉与交互验收基线",
    };
  }
  if (path.startsWith("artifacts/daily-light-visual-review")) {
    return {
      role: "历史视觉证据包",
      status: "历史证据",
      authority: "artifacts/README.md",
      replacement: "artifacts/daily-light-visual-review/2026-08-13-production-release/README.md",
      privacy: "公开证据",
      disposition: "转历史（原位）",
      reason: "由第二轮验收与 Production 发布证据覆盖当前状态职责",
    };
  }
  if (path.startsWith("evals/")) {
    return {
      role: "评测资产包",
      status: "现役",
      authority: path.startsWith("evals/interview-intent")
        ? "docs/interview-intent-evaluation-source-of-truth.md"
        : "docs/ai-evaluation-standard.md",
      replacement: "",
      privacy: stats.privateFileCount ? "公开资产＋私有聚合" : "公开评测资产",
      disposition: "保留",
      reason: "承担可复现评测输入、判尺或历史回归",
    };
  }
  return {
    role: "证据包",
    status: path.startsWith("artifacts/") ? "历史证据" : "现役",
    authority: "artifacts/README.md",
    replacement: "",
    privacy: stats.privateFileCount ? "公开证据＋私有聚合" : "公开证据",
    disposition: "保留",
    reason: "保留唯一证据或包级索引；当前不移动",
  };
}

async function generateDocumentInventory(trackedSet, ignoredSet) {
  const paths = (
    await walkFiles(projectRoot, {
      filter: (path) => /\.mdx?$/iu.test(path),
    })
  ).sort();
  const rows = [];
  for (const path of paths) {
    const markdown = await readFile(resolve(projectRoot, path), "utf8");
    const metadata = readMetadata(markdown);
    const linkHealth = await documentLinkHealth(path, markdown);
    const title = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? basename(path);
    const tracked = trackedSet.has(path);
    const ignored = ignoredSet.has(path);
    rows.push({
      path,
      title,
      sha256: await sha256(path),
      repository_state: tracked ? "已跟踪" : ignored ? "本地忽略" : "未跟踪",
      role: inferDocumentRole(path, metadata),
      status: inferDocumentStatus(path, metadata),
      active_entry: inferDocumentAuthority(path, metadata),
      replacement: inferReplacement(path),
      privacy: inferPrivacy(path, tracked, ignored),
      suggested_disposition: inferDocumentDisposition(path),
      processing_state: inferDocumentProcessing(path),
      classification_basis:
        metadata.role && metadata.status && metadata.authority
          ? "显式元数据"
          : "目录与包级规则推断",
      local_link_count: linkHealth.count,
      missing_local_links: linkHealth.missing.join(" | "),
    });
  }
  return rows;
}

async function generatePackageInventory(trackedSet) {
  const rows = [];
  for (const path of await packagePaths()) {
    const stats = await packageStats(path, trackedSet);
    const classification = packageClassification(path, stats);
    rows.push({
      path,
      total_files: stats.files.length + stats.privateFileCount,
      tracked_files: stats.trackedFiles,
      markdown_files: stats.markdownFiles.length,
      private_files_aggregate: stats.privateFileCount,
      index_path: stats.indexPath,
      role: classification.role,
      status: classification.status,
      active_entry: classification.authority,
      replacement: classification.replacement,
      privacy: classification.privacy,
      suggested_disposition: classification.disposition,
      reason: classification.reason,
    });
  }
  return rows;
}

function workspaceCheckpoints(path, base, dirtyPaths) {
  if (!base) return "待提交";
  const committed = runGit(["log", "--format=%h", `${base}..HEAD`, "--", path])
    .trim()
    .split("\n")
    .filter(Boolean)
    .reverse();
  if (dirtyPaths.has(path)) committed.push("本治理记录所在提交");
  return committed.join(" + ");
}

async function generateWorkspaceInventory(priorPaths, base) {
  const rows = [];
  const dirtyPaths = new Set(parseStatusEntries().map((entry) => entry.path));
  for (const entry of parseWorkspaceEntries(base).sort((a, b) => a.path.localeCompare(b.path))) {
    rows.push({
      path: entry.path,
      status: entry.statusCode,
      sha256: await sha256(entry.path),
      local_checkpoint: workspaceCheckpoints(entry.path, base, dirtyPaths),
      lineage: workspaceLineage(entry.path, priorPaths),
      material_class: workspaceMaterial(entry.path),
      privacy: workspacePrivacy(entry.path),
      suggested_disposition: workspaceDisposition(entry.path, Boolean(base)),
      recovery_or_risk: workspaceRisk(entry.path, Boolean(base)),
    });
  }
  return rows;
}

async function main() {
  const workspaceBase = process.env.DOCUMENT_GOVERNANCE_WORKSPACE_BASE?.trim() || "";
  const trackedSet = new Set(parseNullList(runGit(["ls-files", "-z"])));
  const ignoredSet = new Set(
    parseNullList(runGit(["ls-files", "-z", "--others", "--ignored", "--exclude-standard"])),
  );
  const priorLedger = await readFile(
    resolve(projectRoot, "docs/maintenance/2026-08-12-workspace-disposition-ledger.md"),
    "utf8",
  );
  const priorPaths = parsePriorLedgerPaths(priorLedger);

  const documentRows = await generateDocumentInventory(trackedSet, ignoredSet);
  const packageRows = await generatePackageInventory(trackedSet);
  const workspaceRows = await generateWorkspaceInventory(priorPaths, workspaceBase);

  await mkdir(outputDirectory, { recursive: true });
  await writeFile(
    documentInventoryPath,
    csv(
      [
        "path",
        "title",
        "sha256",
        "repository_state",
        "role",
        "status",
        "active_entry",
        "replacement",
        "privacy",
        "suggested_disposition",
        "processing_state",
        "classification_basis",
        "local_link_count",
        "missing_local_links",
      ],
      documentRows,
    ),
    "utf8",
  );
  await writeFile(
    packageInventoryPath,
    csv(
      [
        "path",
        "total_files",
        "tracked_files",
        "markdown_files",
        "private_files_aggregate",
        "index_path",
        "role",
        "status",
        "active_entry",
        "replacement",
        "privacy",
        "suggested_disposition",
        "reason",
      ],
      packageRows,
    ),
    "utf8",
  );
  await writeFile(
    workspaceInventoryPath,
    csv(
      [
        "path",
        "status",
        "sha256",
        "local_checkpoint",
        "lineage",
        "material_class",
        "privacy",
        "suggested_disposition",
        "recovery_or_risk",
      ],
      workspaceRows,
    ),
    "utf8",
  );

  const privateFiles = await countPrivateFiles(projectRoot);
  console.log(
    `document inventory: ${documentRows.length} rows; evidence packages: ${packageRows.length} rows; workspace changes: ${workspaceRows.length} rows; private files aggregated: ${privateFiles}`,
  );
  const documentsWithMissingLinks = documentRows.filter((row) => row.missing_local_links).length;
  const localLinkCount = documentRows.reduce(
    (total, row) => total + Number(row.local_link_count),
    0,
  );
  const missingLinkCount = documentRows.reduce(
    (total, row) => total + (row.missing_local_links ? row.missing_local_links.split(" | ").length : 0),
    0,
  );
  console.log(
    `local link findings: checked=${localLinkCount}; documents_with_missing=${documentsWithMissingLinks}; missing_targets=${missingLinkCount}`,
  );
  for (const [label, field] of [
    ["document repository states", "repository_state"],
    ["document classification basis", "classification_basis"],
  ]) {
    const counts = new Map();
    for (const row of documentRows) counts.set(row[field], (counts.get(row[field]) ?? 0) + 1);
    console.log(
      `${label}: ${[...counts.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([name, count]) => `${name}=${count}`)
        .join("; ")}`,
    );
  }
  for (const [label, rows, field] of [
    ["document dispositions", documentRows, "suggested_disposition"],
    ["package dispositions", packageRows, "suggested_disposition"],
    ["workspace dispositions", workspaceRows, "suggested_disposition"],
  ]) {
    const counts = new Map();
    for (const row of rows) counts.set(row[field], (counts.get(row[field]) ?? 0) + 1);
    console.log(
      `${label}: ${[...counts.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([name, count]) => `${name}=${count}`)
        .join("; ")}`,
    );
  }
}

await main();
