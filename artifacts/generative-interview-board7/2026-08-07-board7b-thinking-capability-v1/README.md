# GI-086｜DeepSeek Thinking 能力校准

## 为什么进行这次校准

GI-085 已经把剩余失败定位到 `focus → openPart → visible`。继续增加 Prompt 或 Skill 规则会扩大模型负担；GI-086 先保持模型可见资产不变，通过同期配对判断 Thinking 是否值得进入稳定性验证。

本包的证据身份固定为“能力路径诊断”。它用于选择下一条优化路线，真实网页轨迹、正式候选准入和 Production 发布继续等待后续证据。

## 固定设计

- 来源候选：`2026-08-07.board7b-semantic-frame-v1`；
- Prompt、Interview Skill、输出合同和输入合同：直接读取 GI-085 原文件并绑定内容哈希；
- 模型：`deepseek-v4-flash`；
- 四个输入：秋招、项目／读研、独立话题、用户边界；
- 每题同期运行 Thinking 关闭与 `reasoning_effort=high`，共 `8` 次；
- 调用顺序按配对交错，两个问题样本与两个护栏样本各占一半；
- 评审方式：全程透明；
- 隐藏推理：不读取、不保存；
- 质量重试与自动技术重试：`0`；
- Production：`legacy + baseline`。

## 文件

- `board7b-thinking-capability-v1-inputs.json`：四个来源案例和八次交错顺序；
- `board7b-thinking-capability-v1-rubric.md`：比较口径与继续门槛；
- `board7b-thinking-capability-v1-run-plan.json`：调用预算、指纹和停止点；
- `board7b-thinking-capability-v1-authorization-template.json`：零调用授权模板；
- `board7b-thinking-capability-v1-product-review-template.md`：透明评审填写结构；
- `board7b-thinking-capability-v1-manifest.json`：运行前候选状态与血缘快照。
- `board7b-thinking-capability-v1-result.json`：八次调用、结构结果、耗时、Token 与错误记录；
- `board7b-thinking-capability-v1-transparent-review.md`：产品负责人当前透明裁决入口。
- `board7b-thinking-capability-v1-codex-review.md`：独立九维评分、固定门裁决与证据边界。

## 当前停止点

当前完整指纹：

| 对象 | SHA-256 |
|---|---|
| GI-086 候选 | `fe2b306cb8172523b0b64f72bf1d41107d798d9f25e8eda0710f9260c96deb4d` |
| GI-085 来源候选 | `fdc347aa9f952881dbf8c436cbd83302aec12358e446b01c210c57ee21f71f88` |
| 四题数据 | `29b1e9e16100047af446981d955b990535b7b1749d0705725ed4409ba98bbb99` |
| 八次请求集 | `f2d84e97b7171e7d1b742769663337fa679c24542e1fa365c44bd627d72fa81e` |
| 评测口径 | `4d1194750b89cfee1f8b297ebd0ac58a7d158dac10aa4a1b64ee60adc20aba06` |
| 执行源码 | `f958b16c629a29fee3137e5cc82a37e47aafba6f7781198f7ccbfbdbe05dafc4` |

当前计数：计划调用 `8`、授权 `8`、模型调用 `8`。一次性授权已经消费，Run 指纹为 `627da7ad0cea7b00b222d69ec5762718941fcf986bd8962af67bdb8ee9fadee0`。

运行结果：结构有效 `6/8`、程序保护 `1/8`、技术失败 `1/8`、模型合同失败 `0`、质量重试 `0`、自动技术重试 `0`。P1 Thinking 关闭组因用户可见回应包含两个回答选项而触发 `ASK_QUESTION_COUNT_INVALID:2`；P3 Thinking high 返回 `EMPTY_CONTENT`，该配对按冻结口径保持开放。

产品负责人已完成透明评审（本机历史证据，公开精简包未收录：`board7b-thinking-capability-v1-transparent-review.md`）：P1、P2、P4 判相当，P3 因 high 组技术失败判关闭组更好。Codex 独立九维初评（本机历史证据，公开精简包未收录：`board7b-thinking-capability-v1-codex-review.md`）已经完成。

当前停止点：GI-086 固定门判定 `No-Go for Thinking stability validation`。该结果只支持当前路线止损，Thinking 的通用模型能力和真实使用效果继续保持开放；下一步返回任务结构讨论。

零调用检查：

```bash
npm run eval:board7b-thinking-capability:inspect
```

运行入口：

```bash
npm run eval:board7b-thinking-capability:run
```

当前一次性授权已消费。再次运行会在模型请求前因授权消费记录或正式结果已存在而终止。真实网页轨迹继续保持关闭。
