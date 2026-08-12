# GI-088 v8r3r2｜EMPTY_CONTENT 双恢复与板块 7 封存

最后更新：`2026-08-12`

状态：`板块 7 增量准入通过；等待板块 8 全新 Preview 0/6 回读`

## 为什么可以进入板块 8

Ark Flash 同配置诊断覆盖 `96` 个 checkpoint。首次出现 `EMPTY_CONTENT` 的 `10` 份结果中，`9` 份在第一次恢复后得到可见合法回应，`1` 份在第二次恢复后得到可见合法回应，最终空内容为 `0`。产品负责人随后逐条盲评这 `10` 份最终恢复回应，结果为可直接用 `10/10`、轻微问题 `0`、质量失败 `0`、单例阻断 `0`。

这组证据证明当前双恢复策略可以挽救本轮遇到的空内容，同时保持内容质量。完整真人任务体验继续由板块 8 的 `4＋2` 私有 Preview 承担。

## 当前冻结身份

- 版本：`2026-08-12.gi088-human-eval-v8r3r2-empty-content-recovery-2`
- 模型：Ark `deepseek-v4-flash-ga-260731`
- 配置：Thinking high、`json_object`、Header／正文空闲／单次硬截止均为 `60s`、共享恢复链 `90s`
- EMPTY_CONTENT：初始调用后最多自动恢复 `2` 次；单轮最多 `3` 次 Provider 调用
- Candidate：`9643a02914923281f86fcd72c2224a313ffdca0ab67abdb5bc36ad192abb98e3`
- Dataset：`258a4b47ec4eb36393bcf37191fe5088ce699fc0abec5a6d7ccbc8e4b8f5a027`
- Runner：`17148c384524f2b141f7a8091a21185c51ae6c297d1e9a659eb302b972e03d92`
- Experience：`f755b278f721fbc08860c23743af7be8b99c0131b7f98f103d25a33166bb2505`
- Execution：`c0d5245addd37063d265fb3839fe49c518096cf387f76170ef6b5d5a8b874c96`

## 证据入口

- [增量准入清单](./gi088-v8r3r2-incremental-admission.json)
- [工程与数据门](./gi088-v8r3r2-static-validation.md)
- [板块 8 Preview 回读](./gi088-v8r3r2-preview-readback.md)
- [Golden 32＋8 独立证据](../2026-08-12-gi088-human-eval-v8r3-golden-eight-preview/gi088-v8r3-golden-eight-replacement-evidence.json)

## 证据边界

- 公开目录只保存数量、配置、哈希、门结果和发布边界。
- 10 份正文、逐项裁决与理由继续保存在 `0600` 本机私有目录。
- 两条已被产品负责人查看的隐藏案例标记为“已用于评审”，下一次隐藏准入前必须替换；本次板块 8 的 `4＋2` 不依赖它们。
- v8r3 首轮及旧 79.17% 报告继续保留为历史 No-Go，不覆盖本轮诊断和人工裁决。
- Judge 20＋20 继续作为后置门，本轮调用为 `0`。
- Production 继续保持 `legacy + baseline`；本目录不构成 Production 切换授权。

## 下一步与停止点

冻结候选提交并通过全部工程、真实隔离库和构建门后，使用 Vercel Linux 远程构建部署私有 Preview。随后以零模型初始化器创建全新 `running 0/6 / calls 0` 批次并完成认证回读。回读完成即暂停，真人内容由产品负责人提交。
