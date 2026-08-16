# 2026-08-12 本地 Next.js 构建性能事故

状态：`已完成`

事实快照日期：`2026-08-12`

关联 Codex 任务：`019ff150-b803-7342-a7c3-72ff8d7f20bf`（前后端联调）

## 1. 目标、范围与停止点

本记录用于让后续 Codex 会话和工程协作者稳定读取本次本地构建异常的结论、证据边界与处理方法，避免重复等待二十分钟后再重新排查。

本轮范围仅包含文档沉淀：

- 固化已经确认的构建表现和仓库特异证据；
- 分开记录已确认事实、Codex 评估与待验证假设；
- 在运维手册和新会话入口建立可发现链接；
- 保持代码、构建配置、依赖、数据库、Preview 与 Production 原样。

验证门：本地链接可达、文档状态一致、`git diff --check` 通过，且处理规则不把 Turbopack 本地快门替代为正式发布证据。

停止点：完成文档回链和一致性检查后结束；缓存清理、运行环境统一、构建脚本修改和新一轮性能复现等待单独授权。

## 2. 事故结论

本次二十分钟以上的本地构建属于 **Next.js 15.5.20 Webpack 编译路径的严重性能退化／近似卡死**。仓库在同一台机器上的完整 Webpack 构建历史约为 `38.1s`，Turbopack 构建约为 `21s`，同一联调会话的 Vercel Build 约为 `2min`；本地异常构建约为 `1371.9s`，并始终停在 `buildStage=compile`。

本地评测页面、评测接口、私有评测素材和动态脚本依赖会显著扩大 Webpack 服务端依赖图和文件追踪工作量。当前证据进一步指向两处可能的异常停留点：

1. `node-file-trace` 处理扩大后的服务端文件图；
2. Webpack 持久缓存关闭阶段的 PackFile 序列化或失效计算。

现有 trace 尚未保留 worker 结束段，两个停留点仍需一次带 profile 的单变量复现才能最终区分。

## 3. 已确认事实

| 事实 | 当前证据 |
| --- | --- |
| 正式本地命令为 `next build`，Next.js 解析版本为 `15.5.20`；该命令默认使用 Webpack | [`package.json`](../../package.json)；本地 `node_modules/next/package.json` 与 CLI 只读回读 |
| 异常构建持续约 `1371.9s`，高 CPU、内存约 `5.5–6.2GB`，diagnostics 停在 `compile` | 本次任务保留的进程取样、`.next/trace` 与 `.next/diagnostics/build-diagnostics.json` 摘要 |
| 同机另一份完整 Webpack 构建约 `38.1s` | 本次任务本地归档 trace 摘要；服务端编译约 `22.3s`，其中 `node-file-trace-plugin` 约 `20.4s` |
| 显式使用 Turbopack 的完整构建约 `21s`，页面和路由可以完成生成 | 本次联调任务构建记录 |
| 同一联调会话的 Vercel Preview 编译约 `43s`，完整 `next build` 约 `106.5s`，Vercel Build 总计约 `2min` | deployment `dpl_6h591G4B7SGKhsgrC1UBQ6WrSX3D` 构建日志回读 |
| Vercel 与本地 Webpack 的输入集合存在差异 | [`.vercelignore`](../../.vercelignore) 排除本地评测页面、接口、组件、脚本和 `artifacts` |
| 移除本地评测入口的对照构建中，服务端编译从约 `22.3s` 降到 `3.7s`，文件追踪从约 `20.4s` 降到 `0.9s` | 本次任务的单变量本地 trace 摘要 |
| 本地 `.next/cache/webpack` 快照约为 `462MB` | `2026-08-12` 只读磁盘回读；主要为 Webpack PackFile |
| 正式日记接口静态引入 Preview service；该 service 从仓库根目录读取私有评测文件并动态引入评测脚本 | [`daily/generate/route.ts`](../../src/app/api/journal/daily/generate/route.ts)、[`day/route.ts`](../../src/app/api/journal/day/route.ts)、[`journal-preview/service.ts`](../../src/server/services/journal-preview/service.ts) |
| 本机运行时为 Node `24.13.0`，CI 使用 Node `20`；仓库同时保留 npm 与 pnpm 锁文件 | 本次任务环境回读、[CI 配置](../../.github/workflows/ci.yml)、`package-lock.json`、`pnpm-lock.yaml` |

Vercel `READY` 证明远程 Linux 发布链可以完成构建。由于 `.vercelignore` 缩小了远端输入，它不能单独证明本地完整 Webpack 输入集合具备相同耗时。

## 4. 归因分层

### 4.1 已确认原因

- 本地评测相关入口和私有素材进入 Webpack 服务端依赖图后，会显著放大文件追踪时间。
- 异常任务停留在编译阶段，类型检查、页面数据、静态生成和最终 build trace 尚未开始。
- 业务页面与路由具备可构建性；同机正常 Webpack、Turbopack 与远端 Vercel 均已有成功证据。

### 4.2 Codex 高置信度评估

- 放大的服务端文件图与 `462MB` 持久缓存共同形成了本次性能退化的主要故障面。
- 异常构建最可能停在服务端文件追踪或 Webpack 缓存落盘／失效计算阶段。

### 4.3 待验证假设

- Node 24 与 CI Node 20 的版本差异可能放大 worker、文件系统或缓存行为差异。
- npm／pnpm 与双锁文件并存可能造成依赖树和缓存行为漂移。
- macOS Spotlight、安全扫描、云同步或并行重任务可能进一步放大约六万个依赖文件的访问成本。

这些假设需要保持单变量验证，当前不写成最终根因。

## 5. 后续统一处理协议

### 5.1 判断构建是否仍在有效推进

构建运行约 `3min` 仍停在 `Creating an optimized production build` 或 `compile` 时，记录：

- `next`／`jest-worker` 子进程 CPU、内存与磁盘读写；
- `.next` 目录体积、最近修改时间和 diagnostics 阶段；
- 间隔约 `30s` 的两次 macOS“取样进程”。

连续 `5min` 同时满足以下条件时，按严重性能退化处理并停止继续等待：

- 日志和 diagnostics 阶段无变化；
- `.next` 体积与最近修改时间无变化；
- 两次进程取样长期停在相同文件追踪、缓存、GC、锁或自旋热点。

CPU 高只表示进程持续消耗资源，不能单独作为有效推进证据。

### 5.2 第一轮恢复与单变量验证

1. 停止其他测试、构建和大规模评测任务。
2. 将现有 `.next` 改名备份，保留现场后执行一次冷缓存 Webpack 构建。
3. 诊断对照优先使用与 CI 一致的 Node 20；长期 Node LTS 和包管理器版本另行确认。
4. 分别从系统终端和 Codex 任务运行同一命令，区分启动环境与仓库构建本身。

缓存备份示例：

```bash
build_cache_backup=".next-build-cache-backup-$(date +%Y%m%d-%H%M%S)"
mv .next "$build_cache_backup"
```

冷缓存仍复现时使用：

```bash
NEXT_WEBPACK_LOGGING=profile-server,infrastructure \
  pnpm exec next build --debug --experimental-debug-memory-usage
```

### 5.3 各验证通道的职责

| 通道 | 适用职责 | 当前限制 |
| --- | --- | --- |
| `next build --turbopack` | 本地联调快速反馈、确认页面和路由能够生成 | Next.js 15.5 的生产 Turbopack 属于 Beta；不能单独承担正式发布证据 |
| 本地 `next build` | Webpack 兼容性、完整本地输入和性能诊断 | 出现五分钟无进展时按本协议采样并停止 |
| Vercel 源码构建 | 远程 Linux 发布产物与 Preview `READY` 验证 | `.vercelignore` 会缩小输入；结论限定为远端发布链 |

## 6. 长期防复发建议

以下内容属于后续工程建议，尚未在本轮实施：

1. 统一本地、CI 和 Vercel 的 Node LTS、包管理器与唯一锁文件。
2. 为本地联调增加命名清晰的 Turbopack 快速构建命令，保留 Webpack／Vercel 正式发布门。
3. 把本地评测入口与正式产品路由的静态依赖进一步隔离，避免正式 route 顶层引入读取私有素材的 Preview service。
4. 为本地构建任务增加阶段心跳、五分钟异常门和证据采集模板。
5. 在任何安全软件、Spotlight 或系统目录配置变更前，先由进程取样证明文件扫描是当前热点。

## 7. 文档事实源

- 稳定处理规则：[`docs/operator-runbook.md`](../operator-runbook.md#716-本地-nextjs-构建长时间停在-compile)
- 新会话入口：[`AGENTS.md`](../../AGENTS.md#7-本地开发与排障)
- 原始联调交接：[`2026-08-12-daily-light-end-to-end-integration-handoff.md`](../plans/2026-08-12-daily-light-end-to-end-integration-handoff.md)
- 远端发布构建边界：[`docs/vercel-preview-production-lane.md`](../vercel-preview-production-lane.md#当前仓库的构建注意事项)

## 8. 封存结果

- 事故结论、归因分层、五分钟停止门、恢复协议与验证职责已经写入仓库。
- `docs/operator-runbook.md` 已承接长期排障规则，`AGENTS.md` 已提供新会话自动发现入口，原端到端联调交接已回链本记录。
- 本轮检查的 `28` 个本地 Markdown 链接全部可达，缺失链接为 `0`；目标文件差异格式检查通过。
- `docs/README.md` 已在“工程实现与运行”区域链接运维手册，并在新会话入口链接端到端联调总交接；当前发现链完整，无需重复增加事故链接。
- 生成式访谈总 Map、产品专项、问题台账和证据索引的产品状态未受本次工程排障文档影响，保持当前口径。
- 代码、构建配置、依赖、数据库、Preview 与 Production 均保持原样。

下一步：本地 Webpack 再次超过五分钟无有效进展时，按第 5 节采样并执行一次单变量诊断；涉及依赖隔离、环境统一或构建脚本的改动等待单独授权。
