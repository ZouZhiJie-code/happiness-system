# Board 7B｜基础 Prompt v0 与 Interview Skill v0 正式资产候选

状态：`资产已准备；等待事实卡与运行授权；模型调用 0`

决策血缘：`GI-084`

候选版本：`2026-08-07.board7b-prompt-skill-v0`

候选指纹：`84c17021fe079d9b3060092ea279dc3c41bfc0bb34addcaa51912fcfabf45541`

## 为什么建立这份候选

GI-081 与 GI-083 已经提供临时 Prompt 和透明诊断历史。正式能力资产需要把稳定产品合同、专业访谈方法、程序保护和评测案例分别版本化，才能判断后续模型效果变化来自哪一层。

本候选承接产品负责人已经确认的四层最小分工：

1. 基础 Prompt 固定【陪我聊】的身份、用户结果、优先级、来源边界、动作空间和输入输出合同。
2. Interview Skill 保存焦点、认识增量、下一问价值、回答负担、纠正、问停和自然表达方法。
3. 程序保护稳定执行来源、失效引用、单轮一问、阶段 1～2 回答机会计数、状态合并和恢复身份。
4. 评测案例保存三组代表场景、典型失败和反事实变体。

正式运行仍采用一次调用候选；本次停止点只完成本机资产与静态验证。

## 正式资产

- [基础 Prompt v0](./board7b-base-prompt-v0.md)
- [Interview Skill v0](./conduct-daily-light-thinking-interview/SKILL.md)
- [最小结构化语义结果](./board7b-semantic-result-v0.md)
- [三个合成对照案例与反事实变体](./board7b-prompt-skill-v0-contrastive-cases.json)
- [候选清单与指纹](./board7b-prompt-skill-v0-manifest.json)

逐字事实卡、授权卡和执行交接保留在本机受控目录；公开对照案例均为合成输入，不对应真人轨迹。

## 本机运行包

- 语义结构、输入边界、确定性校验与状态合并：`evals/event-centered-generative/board7b-prompt-skill-v0/board7b-prompt-skill-v0.ts`
- 只读透明工作台：`evals/event-centered-generative/board7b-prompt-skill-v0/workbench.html`
- 本机启动器：`scripts/run-board7b-prompt-skill-v0-workbench.ts`
- 无网络单元测试：`tests/unit/board7b-prompt-skill-v0.test.ts`

查看候选清单与静态结果：

```bash
npx vite-node -c vitest.config.ts scripts/run-board7b-prompt-skill-v0-workbench.ts --check
```

启动只读工作台：

```bash
npx vite-node -c vitest.config.ts scripts/run-board7b-prompt-skill-v0-workbench.ts --serve
```

工作台只提供 `GET` 读取入口，绑定 `127.0.0.1` 与随机访问令牌。运行器不加载模型 Provider、API Key、数据库或 Production 数据。

## 当前验证结果

- Interview Skill 结构校验：通过。
- Board 7B 专项单元测试：`8/8` 通过。
- 候选指纹与清单：一致。
- 事实卡状态：`pending`。
- 运行授权状态：`pending`。
- DeepSeek 请求数：`0`。
- Production：`legacy + baseline`。

## 当前停止点

本候选在完整 Prompt／Skill、语义结构、三个案例、本机运行包、只读工作台、静态验证、版本清单和候选指纹完成后停止。下一次模型运行需要：

1. 产品负责人确认事实卡；
2. 生成并核对事实卡指纹；
3. 产品负责人针对候选指纹、事实卡指纹、运行范围和调用预算单独授权。

当前资产不改变产品代码、配置、线上 Prompt、公开 API、数据库、运行开关或 Production 模式。
