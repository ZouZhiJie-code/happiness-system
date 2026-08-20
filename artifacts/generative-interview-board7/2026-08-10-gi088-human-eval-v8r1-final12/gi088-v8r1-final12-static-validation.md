# GI-088 v8r1｜最终 12 项静态验证

状态：`通过；Preview READY；0/12 空白批次已回读`

## 1. 版本与指纹

- 评测：`2026-08-10.gi088-human-eval-v8r1-final12`
- 服务：`2026-08-10.gi088-question-decision-service-v8r1`
- 状态策略：`2026-08-10.gi088-deterministic-state-maintenance-v2.1`
- Effective candidate：`f96097f2bde6146e24363d2f640ac51d0773f2e7e2596639a56d4c6ac82c3787`
- 数据集：`0ca2452690aa9e89b2414689bb7c96294a4fa9283359c01f3a45ca1c4b7478a7`
- 执行：`40da54f237d159dd15ae573a5c38000c1a6558b3e443f60f087461b2e3bf8f82`
- `eval:gi088:inspect`：`12` 项、仅 Thinking high、初始化模型调用 `0`

## 2. 功能与回放

- v8 真实 U10“很好，就聊到这吧”零模型回放通过，直接提交暂停状态。
- “谢谢，今天先到这”零调用暂停通过。
- “我最近其实很好，就聊到这吧”保持混合停止，先吸收新内容再强制暂停。
- 否定、转述、并发和重复提交回归通过。
- 来源补全、状态原子提交、阶段转场、单一回答焦点、90 秒共享恢复和历史读取回归通过。

## 3. 自动验证

- 相关 Vitest：`14` 个文件，`160 passed / 6 skipped / 0 failed`。
- TypeScript：`passed`。
- 目标 ESLint：`passed`。
- Prisma app schema：`valid`。
- Prisma evaluation schema：`valid`。
- Production build：`passed`。
- Vercel Preview build：`passed`。
- `git diff --check`：`passed`。

全量 Vitest 共 `295` 个文件，结果为 `2817 passed / 6 skipped / 2 failed`。两项失败均属于当前候选范围外的历史基线：

1. `tests/unit/vercel-env-audit-script.test.ts`：Preview 环境示例合同的历史预期未同步。
2. `tests/unit/board7b-thinking-capability-v1.test.ts`：GI-086 历史执行指纹预期与当前保留资产不一致。

两项失败均未触及 v8r1 运行代码、数据集、恢复链或页面。

## 4. Preview 与空白批次

- Deployment：`dpl_HPBafL2QmHd6UsUXQ8kWVbUvKJAQ`
- 目标：`preview`；状态：`READY`
- 页面：`https://xingfuxitong-5l1ns4sci-zouzhijies-projects.vercel.app/preview/gi088-evaluation`
- Vercel 登录保护：`生效`
- 批次：`5123d795-5c19-408d-9b98-7767eaa7892c`
- 回读：`running / 0 of 12 / high_only`
- 创建批次的模型调用：`0`

## 5. 发布边界

Production 未改动，继续保持 `legacy + baseline`。当前停在产品负责人真人验收前；页面提交真实内容后才会产生模型调用。
