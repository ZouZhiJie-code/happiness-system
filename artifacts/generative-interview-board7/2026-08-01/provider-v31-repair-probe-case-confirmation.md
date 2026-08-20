# 板块 7｜Provider v3.1 两条规则 repair probe 确认包

- 数据集：2026-08-01.board7-provider-v31-repair-probe-v1
- 案例指纹：dace7ba2a3847246749a1d5f4e05a724654a791ecc8cc6807f40f2889fad9e47
- 计划：两个全新案例各运行一次，共 2 个真实结果
- 通过门：第一段语义 2/2、用户可见回应 2/2、技术完整 2/2、严重错误 0
- 运行边界：本确认包只展示故事与判尺，不调用模型；正式运行必须显式追加 --confirm-model-run
- 隔离边界：不复用旧六例、旧 v3 预算账本或旧历史结果；案例不进入 Prompt / Few-shot
- 去重范围：src / tests / evals / artifacts / docs / scripts
- 去重锚点：阳台照片与照片日记封面 / 雨夜宠物医院与航空箱
- 既有故事命中：无

## V31-RP-T-ENTRY-01｜thought_needs_more_concrete_answer_entry

### 第一层｜完整对话

**用户（上文 1）**：我给同一处阳台拍了两张很像的照片，来回放大看了好几遍，最后挑了一张做这周照片日记的封面。

**AI 思路层（上文 1）**：两张照片整体很接近，你还是在放大比较后停在了其中一张。

**AI 回应（上文 1）**：最后选中的那张更符合你心里的什么标准？

**用户（本轮）**：我只知道放大以后就偏向现在这张，可真正让我停止比较的那个点，我还说不清。

<details><summary>第二层｜展开修复规则与判尺</summary>

- 修复规则：goal_abstract_answer_entry_concrete
- 角度 / 模式：thought / guided_reflection
- 预期状态 / 动作：needs_more / ask
- 当前理解必须覆盖：放大比较后选定了封面照片；停止比较的具体判断线索仍未说清
- 提问 goal：识别停止比较两张照片时采用的判断依据
- 具体 answerEntry：放大照片时目光先停在哪里或哪一处让比较结束
- 可见回应视角：second_person_or_neutral
- 必须避免：把 goal 原样改写成你最想确认什么；让 answerEntry 与 goal 停留在同一抽象层；提供光线、构图、颜色等候选答案；转向以后怎样拍照或选择封面

</details>

## V31-RP-R-VOICE-01｜relationship_pause_second_person_voice

### 第一层｜完整对话

**用户（上文 1）**：昨晚猫突然不舒服，朋友冒雨陪我去了宠物医院。她一路抱着航空箱，我才能腾出手登记。

**AI 思路层（上文 1）**：她接过了最忙乱的一部分，同时陪你进入了就诊过程。

**AI 回应（上文 1）**：医生开始问情况以后，她的陪伴让你处在什么位置？

**用户（本轮）**：医生问情况时，她先等我讲完，只在我漏掉发作时间后补了一句。我感觉有人接住了最慌的部分，怎么说明情况仍由我来。这个角度就聊到这里吧。

<details><summary>第二层｜展开修复规则与判尺</summary>

- 修复规则：visible_second_person_or_neutral
- 角度 / 模式：relationship / deep_conversation
- 预期状态 / 动作：ready / pause
- 当前理解必须覆盖：朋友接住了慌乱中的实际负担；用户仍保留就诊说明的主导权
- 提问 goal：无
- 具体 answerEntry：无
- 可见回应视角：second_person_or_neutral
- 必须避免：继续追问关系意义；用我或我的替用户写自述；猜测朋友的动机；扩大为长期关系结论

</details>
