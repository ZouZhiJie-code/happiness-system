# GI-088｜v8r1 最终 12 项独立验收

状态：`Preview READY；0/12 空白批次已回读；等待产品负责人真人验收`

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

## 6. 停止点

当前已停在真人验收起点。真人模型调用只由产品负责人在页面提交真实内容时触发。批次完成后由 Codex独立评分、检查调用血缘并更新问题台账；Production 继续保持 `legacy + baseline`。

## 7. Preview 交付

- Deployment：`dpl_HPBafL2QmHd6UsUXQ8kWVbUvKJAQ`
- 页面：`https://xingfuxitong-5l1ns4sci-zouzhijies-projects.vercel.app/preview/gi088-evaluation`
- 部署状态：`READY`；目标为 `preview`；Vercel 登录保护生效
- 批次：`5123d795-5c19-408d-9b98-7767eaa7892c`
- 批次回读：`running 0/12`；仅启用 `high`
- 初始化模型调用：`0`

完整验证记录见 [`gi088-v8r1-final12-static-validation.md`](./gi088-v8r1-final12-static-validation.md)。
