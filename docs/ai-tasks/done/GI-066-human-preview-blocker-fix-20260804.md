---
task_id: "GI-066-human-preview-blocker-fix-20260804"
status: "done"
project: "Happiness-system-codex"
created_at: "2026-08-04T00:00:00.000Z"
title: "GI-066 第一轮人工实聊阻断修复与候选重验"
---

# GI-066 第一轮人工实聊阻断修复与候选重验

## 目标

修复 GI-066 第一轮人工实聊暴露的重复提问、纠正后状态重置、用户消息展示顺序、退出记录消失、日志入口缺失和“换个问法”交互问题；升级候选血缘并重新完成工程验证、DeepSeek 官方预检、10×3、自动 8+2，最终停在新一轮四条人工实聊等待裁决。

## 背景与现状

- 当前候选人工体验裁决为 `No-Go`；既有自动技术证据保留为历史证据。
- 重复问题来自精确字段去重与语义回答覆盖之间的缺口。
- 提问次数错误累计到整场会话，超过状态上限后触发快照安全重置。
- 纠正缺少“已有答案未被识别 / 问题前提错误”等细分语义。
- 用户气泡等待 AI 完成后才从服务端会话回显。
- 退出事件仍在数据库中，但事件列表过滤了 `abandoned`。
- Production 全程保持 `legacy + baseline`。

## 实施范围

1. 增加问题语义需求签名、回答覆盖状态和已关闭缺口记录。
2. 细分纠正类型，纠正后更新理解并重新选题，禁止无来源的“判断转变”。
3. 提问次数按认识方向独立计算；“换个问法”只改表达，不消耗正式问题次数。
4. 快照保持外层 v4，内部 thought protocol 升级 v2，兼容历史 v1；保存前验证状态。
5. 复盘素材达门后全程开放日志动作和自然语言日志意图。
6. 用户发送后立即显示待处理气泡，并按 `clientTurnId` 合并服务端消息。
7. 事件标签列表包含已退出事件，提供“已退出”只读回看；新事件保持独立。
8. “换个问法”复用双循环箭头图标，悬浮或键盘聚焦显示同名提示气泡。
9. 升级候选血缘并完成分层复验、文档与证据回填。

## 影响文件

- `src/features/interview/event-centered/*`
- `src/server/services/interview/event-centered-*`
- `src/server/repositories/event-centered-*`
- `src/components/interview/event-centered/*`
- `src/app/api/interview/event-centered/*`
- `tests/unit/event-centered-*`
- `scripts/run-board8-gi066-*`
- GI-066、总 Map、Preview 证据与部署事实源文档

## 验收标准

- 已回答问题不再以同义表达重复出现。
- 纠正后产生新问题、开放转场、日志动作或必要的纠正澄清。
- 纠正不会自动推断判断变化，也不会触发状态重置。
- 连续跨四个认识方向保持快照合法。
- “换个问法”保留问题目标且不增加正式问题次数。
- 用户气泡先出现，AI 回复随后出现；失败恢复保持原话与进度。
- 退出事件可只读回看，新事件不覆盖旧事件。
- 素材达门后的复盘过程全程可生成日志。
- 图标交互支持悬浮、键盘聚焦、触屏和读屏。
- DeepSeek 官方预检、10×3、自动 8+2 达门；人工工作台可用。

## 验证方式

- GI-066 定向 Vitest。
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`
- `npx prisma validate`
- 使用本机隔离数据库执行 `npx prisma migrate status`
- `git diff --check`
- DeepSeek 官方最小预检。
- GI-066 `10×3` 与自动 `8+2`。
- 本机人工工作台冒烟。

## 约束与风险

- 保留当前工作树全部用户改动，不清理、不重置、不覆盖无关文件。
- 本轮不新增 Prisma migration。
- 预检和 Preview 同时显式绑定本机 `DATABASE_URL` 与 `DIRECT_URL`。
- 不执行生产部署、生产配置切换或生产数据写入。
- 密钥、用户原话、AI 全文、日志正文和 Trace 上下文不得进入报告。

## 完成状态

- 完成时间：`2026-08-04`
- 结果：阻断修复、严格稳定性小门、自动 8+2、只读审计和人工工作台准备全部完成。
- 下一步：产品负责人重新执行四条人工实聊并作出 Go/No-Go。
- Production：保持 `legacy + baseline`。
