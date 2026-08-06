# 2026-08-06 工作区收口结果

状态：`已完成`

分支：`codex/workspace-consolidation-20260806`

基线提交：`9c270e2`

## 1. 收口目标

本轮把长期堆积在工作区中的产品事实、工程实现、评测资产、历史证据和本地过程文件分层收纳，并建立新会话可以直接读取的稳定入口。

产品边界保持原样：`GI-068～080` 继续关闭，方法 `v1.0` 继续冻结，板块 6 继续进行中，板块 7 和板块 8 继续按依赖等待，Production 继续保持 `legacy + baseline`。

## 2. 起始状态

- 已跟踪修改：`109` 个文件；
- 未跟踪文件：`1394` 个文件；
- 多轮 Batch B、Board 7、Board 8 结果与过程检查点混放；
- 当前事实、正式诊断资产和历史候选缺少统一发现入口；
- 相关实现、迁移、测试、图表和文档尚未形成完整版本记录。

## 3. 文件治理结果

### 3.1 当前入口

新的 AI 或协作者依次读取：

1. [`AGENTS.md`](../../AGENTS.md)；
2. [`docs/README.md`](../README.md)；
3. [`docs/generative-interview-refactor-map.md`](../generative-interview-refactor-map.md)；
4. [`artifacts/README.md`](../../artifacts/README.md)；
5. 当前 Board 6 或 GI-081 日期目录中的 `README.md`。

稳定搜索词已经写入 `AGENTS.md` 与 `docs/README.md`：`GI-081`、`板块 6`、`board6-calibration`、`board7a-real-output-ab`、`legacy + baseline`。

### 3.2 长期版本化资产

- 当前生成式访谈 Map、板块 5 冻结输入、板块 6 校准材料和 GI-081 真实输出候选包；
- 事件中心与访谈可靠性实现、迁移、脚本、评测集和自动化测试；
- 架构、设计、运维、任务交接、图表和 Vibe Coding 知识材料；
- 带日期、候选版本和原裁决的 Batch B、Board 7、Board 8 历史证据。

### 3.3 清理与本地收纳

- 清理 `33` 份内容完全一致且无引用的历史副本，保留规范命名文件；
- 将 `47` 份无长期审计需要的 checkpoint 和 `1` 份 resume log 移入 `artifacts/local-runtime/`；
- 清理 `docs/technical/interview-event-centered/01-event-and-outcomes-domain-model.md.orig` 合并残留，原内容可从历史提交 `5d86297` 恢复；
- `artifacts/local-runtime/`、`*.orig` 和 `*.rej` 已加入 `.gitignore`；
- 版本化 `artifacts/` 中的精确重复组为 `0`。

被清理的 33 份重复文件可从本分支基线前的本地工作区或同内容规范文件恢复；48 份过程文件仍保留在当前机器的本地运行区。

## 4. 提交分组

1. `cfde54e`：新会话发现入口与资产治理；
2. `1eef509`：生成式访谈决策、Board 6 校准和 GI-081 当前证据；
3. `9a89904`：工程实现、迁移、脚本、评测数据和自动化覆盖；
4. `7f4eccb`：设计、运维、任务交接、图表和知识材料；
5. `6c816c4`：Batch B、Board 7、Board 8 历史评测证据；
6. `9744657`：环境示例中的可选候选模型契约修复；
7. 本结果文档与构建生成路径同步。

## 5. 验证结果

- 核心入口本地链接：`13` 个文件、`458` 个链接全部可达；
- 敏感信息扫描：未发现 API Key、私钥、访问令牌或生产数据库凭据；唯一形态命中来自测试任务编号；
- 差异格式检查：通过；
- Prisma schema：通过；
- TypeScript 类型检查：通过；
- 全量测试：`269` 个测试文件、`2547` 项全部通过；
- Next.js 构建：通过，`63` 个页面完成生成；
- 构建保留若干非阻断 ESLint 警告，集中在历史未使用变量和 Hook 依赖提示；
- 精确重复检查：版本化评测资产中 `0` 组；
- Git 工作区：最终提交后保持干净。

## 6. 授权边界

本轮未执行模型调用、Vercel 环境写入、数据库迁移应用、Preview 运行、部署、推送、PR 或生产切换。Production、线上 Prompt、API、数据库和运行开关保持原样。

GI-081 六题材料继续等待产品负责人完成盲评与架构裁决。该裁决完成后，按照生成式访谈总 Map 回到板块 6B，补充真实重复失败对应的判尺和案例。
