# GI-088｜v8r1 最终 12 项独立验收

状态：`创建时 Preview READY、0/12；A1 真人轨迹确认控制误停单例阻断；v8r1 退出最终通过候选`

评测版本：`2026-08-10.gi088-human-eval-v8r1-final12`

服务版本：`2026-08-10.gi088-question-decision-service-v8r1`

合同版本：`2026-08-10.gi088-semantic-delta-contract-v2.3`

状态策略：`2026-08-10.gi088-deterministic-state-maintenance-v2.1`

问前决策：`2026-08-10.gi088-question-decision-skill-v1`

恢复策略：`2026-08-10.gi088-shared-recovery-deadline-v2`

Effective candidate：`f96097f2bde6146e24363d2f640ac51d0773f2e7e2596639a56d4c6ac82c3787`

数据集指纹：`0ca2452690aa9e89b2414689bb7c96294a4fa9283359c01f3a45ca1c4b7478a7`

执行指纹：`40da54f237d159dd15ae573a5c38000c1a6558b3e443f60f087461b2e3bf8f82`

Production：`legacy + baseline`

## 1. 为什么进入 v8r1

v8 A1 完成 `10` 次用户提交后由产品负责人确认通过，并以 `1/4 early_stopped` 收口。零问题后继续提供实质内容时，AI 已重新找到有价值的下一问；阶段 3 深化、来源补全、单一回答焦点和最终暂停均形成真人正向证据。

末轮“很好，就聊到这吧”产生一次多余的 V4 Pro 调用。v8r1 将简短礼貌回应与明确停止的组合纳入纯停止识别，随后直接进入最终 12 项，不增加中间真人批次。

## 1.1 真人事故与收口

- **产品负责人判断**：A1 体验变差，属于单例阻断，任务目标未触发；停止继续运行 v8r1 最终批次。
- **Codex 初评**：模型已经返回有效承接，程序随后把事件内容中的沟通负担升级为停止当前访谈，并覆盖了继续提问路径；v8r1 无法承担最终通过证据。
- **已确认根因**：旧意图规则使用宽泛疲惫词面，缺少说话人、作用对象、否定、转述和撤回判断；GI-088 又把 `fatigue_feedback` 直接升级为停止资格。旧 Interview Skill 同时允许模型在用户未明确停止时自行暂停，与产品负责人最新规则冲突。
- **待验证假设**：v8r2 的高精度控制决策、程序介入复核和共享评测底座能够消除同类误停，并在最终 12 项中保持连续追问。

`2026-08-10` 专用评测库只读回读：run `5123d795-5c19-408d-9b98-7767eaa7892c` 状态为 `running`，活动任务 A2，已完成轨迹 `1`，Provider 调用 `2` 且均为 `valid`。完整对话和数据库快照只保存在 `artifacts/local-runtime/`。当前真人验收与正式证据入口为 [GI-088 v8r2 评测底座加固资产](../2026-08-10-gi088-human-eval-v8r2-foundation-hardening/README.md)，已完成实施合同见[执行任务](../../../docs/ai-tasks/done/GI-088-v8r2-evaluation-foundation-hardening-20260810.md)。

## 2. 当前行为

- “很好，就聊到这吧”“谢谢，今天先到这”等礼貌停聊由程序零调用暂停。
- 包含真实新事实的“内容＋停止”最多调用一次吸收内容，随后由程序强制暂停。
- 否定表达、转述他人停止和仍想继续的表达继续维持现有边界。
- 官方 DeepSeek V4 Pro、Thinking high、`json_object`、语义变化合同、统一问前决策和 `90s` 共享自动恢复保持稳定。
- 整条轨迹不设轮次上限；每段用户原话最多三次 Provider 调用。

## 3. 最终 12 项

1. A1｜继续推进与礼貌停聊
2. A2｜已有答案后的下一步
3. A3｜阶段 3 具体深化
4. A4｜现实选择与决策支持
5. A5｜纠正后修订并继续
6. A6｜说不清或拒答的边界
7. A7｜独立事件保持分离
8. A8｜复杂输入保持单一焦点
9. A9｜内容充分后自然收住
10. A10｜补充内容后立即停止
11. A11｜切换后返回原任务
12. A12｜自然长聊连续性

每项只运行 Thinking high，并要求所有可见提问在 Trace 完成人工分类。最终批次需要完整跑完 `12/12`；若中途出现阻断，可以提前封存失败证据，整批按 No-Go 处理。

## 4. 调用预算

若整批共有 `N` 次用户提交：

- 硬上限：`3N`；每段原话最多首次、一次自动恢复和一次用户主动生成。
- 达到通过门时：最多 `N+1`；整批最多一次自动恢复，人工第三次生成为 `0`。
- 页面初始化、读取任务和创建空白批次的模型调用为 `0`。

## 5. 通过门

- `12/12` 目标触发；至少 `9/12 direct_use`，最多 `3/12 minor_issue`。
- 质量失败、单例阻断、程序保护、最终技术失败、重复消息和人工第三次生成均为 `0`。
- 首次可见回答率至少 `90%`；整批自动恢复最多一次，并在 `90s` 内成功。
- `EMPTY_CONTENT=0`；连续两轮需要恢复直接判阻断。
- 所有可见提问完成人工单一回答焦点分类，`multiple_independent_tasks=0`。

## 6. 历史停止点

v8r1 已停在 A1 单例阻断。该 run 保持只读，后续任务不再承担当前准入证据。v8r2 已完成 P0／P1、最终初始化幂等、不可变版本、全绿静态门和 Preview 部署；最终 commit 为 `e01c9ed5fa0334d8d717dbed2643791f1045e04d`，Execution fingerprint 为 `55c0c9b0ef31f46bf638c3a90fd6323c1ef7ad83a14d367d4e2e2fe3cc34b34e`，Preview 已 `READY`。全新 High-only run `e1dccbfd-d808-4706-8ddf-be5e254f4d2d` 已零调用初始化为 `running 0/12 / gate=pending / high`。当前暂停等待 12 项真人验收；候选质量与发布尚未裁决，约 `200` 轮以上容量优化继续排除，Production 继续保持 `legacy + baseline`。

## 7. Preview 交付

- Deployment：`dpl_HPBafL2QmHd6UsUXQ8kWVbUvKJAQ`
- 页面：`https://xingfuxitong-5l1ns4sci-zouzhijies-projects.vercel.app/preview/gi088-evaluation`
- 部署状态：`READY`；目标为 `preview`；Vercel 登录保护生效
- 批次：`5123d795-5c19-408d-9b98-7767eaa7892c`
- 创建时批次回读：`running 0/12`；仅启用 `high`
- A1 后只读回读：`running`；活动任务 A2；已完成轨迹 `1`；Provider 调用 `2`，均为 `valid`
- 初始化模型调用：`0`

完整验证记录见 [`gi088-v8r1-final12-static-validation.md`](./gi088-v8r1-final12-static-validation.md)。
