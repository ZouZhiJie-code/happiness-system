# GI-085｜semantic-frame-first v1 候选包

本候选停止沿 v0.x 追加规则和案例，从基础 Prompt、Interview Skill、输出合同、评测输入与判尺重新建立最小职责。

## 核心判断

v0.3 剩余失败发生在首次语义选点：`openPart` 和下一步目标从关系焦点漂移到类别选择，可见回应忠实执行了错误目标。当前证据支持继续使用一次调用，并先修复 semantic frame。两阶段调用等待“语义正确、表达持续偏离”的跨场景证据。

## 候选组成

- `board7b-base-prompt-v1.md`：身份、用户结果、优先级和事实源；
- `conduct-daily-light-thinking-interview/SKILL.md`：从用户控制到自然回应的五步方法，零案例；
- `board7b-output-contract-v1.md`：精简字段和硬约束；
- `board7b-turn-input-v1.md`：模型可见语境与程序边界；
- `board7b-root-cause-design-v1.md`：根因、职责和两阶段触发条件；
- `board7b-semantic-frame-v1-regression-inputs.json`：8 个运行输入；
- `board7b-semantic-frame-v1-regression-rubric.md`：与模型隔离的人工判尺；
- `board7b-semantic-frame-v1-static-validation.md`：结构测试与独立前向验证；
- `board7b-semantic-frame-v1-regression-result.json`：授权消费、运行分账与固定准入门结果；
- `board7b-semantic-frame-v1-regression-review.md`：逐题 Codex 初评和根因；
- Manifest、运行计划和授权模板。
- 零调用可检查、授权后才执行的隔离回归运行器；运行前物化全部请求，绑定实际源码，授权单次消费，逐题先记请求再调用。

## 仓库入口

零调用检查：

```bash
npm run eval:board7b-semantic-frame:inspect
```

当前一次性授权已经消费。以下命令只用于验证重复执行会被授权消费记录拒绝：

```bash
npm run eval:board7b-semantic-frame:run
```

执行入口会先回读全部指纹和 8 个精确请求。授权已消费、执行环境变化或本地证据路径冲突时，新的生成请求保持 `0`。

## 当前状态

- 候选指纹：`fdc347aa9f952881dbf8c436cbd83302aec12358e446b01c210c57ee21f71f88`
- 数据指纹：`e6b2599f0c076ba04bb1f37486bd46b283d97dc2ac7c40a227a870a35723e1d1`
- 请求集指纹：`56589e0159911c8076960d0d0b84f4b9fb8079729efbbf2c40a81e90f35e7b71`
- 执行指纹：`23081c845deb279396bfac8e77ebcc2e16e4148074225b96193b16c91f9597f4`
- 授权状态：`已消费 1 次`
- 模型调用：`8`
- 运行指纹：`1ccb38aaedb19f60043a9f1b385f18d2dce0c5e564d4563337899ed1d646a0fb`
- 运行结构：`7/8` 有效，`1/8` 程序保护拦截，技术失败 `0`
- 固定准入门：`No-Go for real trajectory`
- Codex 产品初评：通过 `4/8`，普通质量失败 `4/8`，单例阻断 `0`
- v0.4：运行前关闭，调用 `0`
- 真实网页轨迹：关闭
- Production：`legacy + baseline`

本候选已经停在回归 No-Go。真实网页轨迹保持关闭；下一步先讨论关系焦点进入 `openPart` 时的语义不变量，任何新候选和新调用都需要新指纹与新授权。
