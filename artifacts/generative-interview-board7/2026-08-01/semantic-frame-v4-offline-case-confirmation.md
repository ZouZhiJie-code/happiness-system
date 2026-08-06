# 板块 7｜semanticFrame v4 离线案例确认包

- 数据集：2026-08-01.board7-semantic-frame-v4-offline-confirmation-v1
- 案例指纹：ae2c1e801cd121a3372dec9bb8ae52d0897dc3b0d430c91d69b8ddf0c4203f62
- 冻结候选：{"strategy":"5.49.0","semanticPrompt":"2026-08-01.event-centered-generative-v71-semantic-skeleton","visiblePrompt":"2026-08-01.event-centered-generative-v71-visible","fewShot":"quality-patterns.2026-08-01.v28","semanticArtifact":"event-centered-semantic-plan.v4","angleCard":"2.12.0"}
- 当前门：只做离线契约与案例确认
- 当前模型请求预算：0 次
- 后续运行：本包逐条确认后，再单独生成运行预算并获得明确授权
- 第一段顶层字段：understanding / decision / semanticFrame / questionIntent / limitReason
- 隔离：故事、期望骨架与用户可见质量判尺只进入本确认包，不进入 Prompt 或 Few-shot
- 去重范围：src / tests / evals / artifacts / docs / scripts
- 去重锚点：泳池十个来回与触壁摘镜 / 版画墙面位置与门口回看 / 舞伴数拍与当众停音乐 / 三页乐谱横排与连续练习 / 窗帘挂钩拉开与直射亮带移位 / 旧日历“终于”与空白线索
- 既有故事命中：无

## SF4-F-READY-01｜feeling_user_articulated_single_unit

### 第一层｜产品逐条确认

#### 完整对话

**用户（上文 1）**：我给自己定了今天连续游十个来回的目标，前九个来回都在数呼吸。

**AI 思路层（上文 1）**：你一直靠数呼吸把自己带到最后一个来回。

**AI 回应（上文 1）**：真正游完以后，你最先有什么变化？

**用户（本轮）**：手碰到池壁那一下，我摘下泳镜，才发现自己在笑，肩膀也松了。那一刻就是松快。

- 严格状态 / 系统动作：ready / complete
- 这一轮价值：把用户已经说清的松快体验完整收住，及时结束这一轮，避免把自然体验扩写成长期能力。
- 必须保留：触壁摘镜；笑和肩膀放松；松快
- 必须避免：继续追问；训练建议；克服恐惧；长期能力；semanticFrame 或 unit 等内部字段
- 回应类型 / 主字段：completion / insight
- 思路层：forbidden
- 对话视角：second_person_or_neutral

### 第二层｜预期语义骨架

- 预期理解状态：answered
- 边界 / 修正：无
- 理解必须覆盖：触壁摘下泳镜后发现自己在笑、肩膀放松；用户把当时体验明确说成松快
- 理解必须避免：把松快解释成自信提升、克服恐惧或长期能力
- semanticFrame：{"units":[{"id":"u1","role":"experience","evidenceRefs":["new:1","new:2","new:3"]}],"relation":null}
- questionIntent：null
- limitReason：null
- 第一段禁区：semanticFrame unit 不含 statement；questionIntent 不含 goal、answerEntry 或完整问题；limitReason 不含收束文案

## SF4-T-ASK-01｜thought_needs_more_sensory_answer_source

### 第一层｜产品逐条确认

#### 完整对话

**用户（上文 1）**：我把一幅小版画挂到客厅墙上，上下挪了好几次，最后贴在现在这个位置。

**AI 思路层（上文 1）**：你已经停在一个位置，但决定停手的视觉依据还没有说清。

**AI 回应（上文 1）**：这个位置更符合你心里的什么标准？

**用户（本轮）**：我只知道退到门口再看时就不想继续挪了，可具体是哪一处让我停手，我还说不清。

- 严格状态 / 系统动作：needs_more / ask
- 这一轮价值：把仍模糊的视觉判断降到门口回看时的一处感官细节，为用户提供低负担、可直接回答的入口。
- 必须保留：已在门口回看时停手；问题落到当时看到的一处具体画面或位置
- 必须避免：重复询问什么标准或为什么；提供高度、光线、边距、留白等候选答案；替用户解释成舒服或平衡；暴露 gap、answerSource 或 evidenceRefs
- 回应类型 / 主字段：question / question
- 思路层：required
- 对话视角：second_person_or_neutral

### 第二层｜预期语义骨架

- 预期理解状态：partly_answered
- 边界 / 修正：无
- 理解必须覆盖：退到门口回看时停止继续调整；停止调整的具体视觉依据仍未说清
- 理解必须避免：把停止调整解释成平衡、舒服、留白合适或审美偏好
- semanticFrame：{"units":[{"id":"u1","role":"judgment","evidenceRefs":["new:1","new:2"]}],"relation":null}
- questionIntent：{"gap":"停止调整版画位置的具体视觉依据","answerSource":{"kind":"sensory_detail","evidenceRefs":["new:1"],"anchorQuote":"退到门口再看时"}}
- limitReason：null
- 第一段禁区：semanticFrame unit 不含 statement；questionIntent 不含 goal、answerEntry 或完整问题；limitReason 不含收束文案

## SF4-R-COEXIST-01｜relationship_ready_coexistence_two_sides

### 第一层｜产品逐条确认

#### 完整对话

**用户（上文 1）**：我最近和固定舞伴练一段新的组合，他在排练时会用两种很不一样的方式带我。

**AI 思路层（上文 1）**：同一段排练里，他的不同做法可能同时带来帮助和压力。

**AI 回应（上文 1）**：这两种做法分别让你处在什么状态？

**用户（本轮）**：我跟不上时，他会在旁边数拍，我就能接回节奏；可我只要错一步，他就当着大家把音乐喊停，我会一下很紧。帮到我和让我有压力，这两边都是真的。

- 严格状态 / 系统动作：ready / pause
- 这一轮价值：完整保留帮助与压力同时成立的两侧体验，在关系角度形成真实进展，并尊重复杂感受无需排序。
- 必须保留：数拍带来的帮助；当众停音乐带来的压力；两边同时成立
- 必须避免：强迫排序或二选一；推测舞伴动机；关系去留建议；只保留其中一侧；coexistence 或 unit 等内部字段
- 回应类型 / 主字段：pause / insight
- 思路层：forbidden
- 对话视角：second_person_or_neutral

### 第二层｜预期语义骨架

- 预期理解状态：answered
- 边界 / 修正：无
- 理解必须覆盖：数拍帮助用户接回节奏；当众停音乐让用户紧张；帮助与压力同时成立
- 理解必须避免：要求用户判断哪一边更重要；推测舞伴出于控制、耐心或好胜
- semanticFrame：{"units":[{"id":"u1","role":"experience","evidenceRefs":["new:1","new:3"]},{"id":"u2","role":"experience","evidenceRefs":["new:2","new:3"]}],"relation":{"type":"coexistence","fromUnitId":"u1","toUnitId":"u2"}}
- questionIntent：null
- limitReason：null
- 第一段禁区：semanticFrame unit 不含 statement；questionIntent 不含 goal、answerEntry 或完整问题；limitReason 不含收束文案

## SF4-A-EFFECT-01｜action_ready_change_effect_two_sides

### 第一层｜产品逐条确认

#### 完整对话

**用户（上文 1）**：练一首三页的曲子时，我总在第二页末尾停下来翻谱，后面那段每次都断。后来我把三页复印出来，横排在谱架上。

**AI 思路层（上文 1）**：你已经改变了乐谱的摆放方式，正在确认它对实际练习产生了什么作用。

**AI 回应（上文 1）**：把谱横排以后，这次练习具体少了什么中断？

**用户（本轮）**：昨晚再练时，手没有从琴键上拿开，三页是连着弹完的。真正变化就是不用在第二页末尾停下来翻谱了。

- 严格状态 / 系统动作：ready / complete
- 这一轮价值：把乐谱摆放变化与练习中断减少的实际效果连接起来，让成果停在用户已经说出的可观察变化。
- 必须保留：横排三页乐谱；手不离开琴键；连续弹完并少掉翻谱中断
- 必须避免：未来练习计划；提高专注力或效率；形成习惯；change_effect 或 unit 等内部字段
- 回应类型 / 主字段：completion / insight
- 思路层：forbidden
- 对话视角：second_person_or_neutral

### 第二层｜预期语义骨架

- 预期理解状态：answered
- 边界 / 修正：无
- 理解必须覆盖：把三页乐谱横排；练习时不用停手翻谱并连续弹完三页；位置改变与少掉中断构成用户明确说出的实际效果
- 理解必须避免：扩展成提高专注力、提升效率或形成练琴习惯
- semanticFrame：{"units":[{"id":"u1","role":"change","evidenceRefs":["SF4-A-EFFECT-01-fact-2"]},{"id":"u2","role":"result","evidenceRefs":["new:1","new:2"]}],"relation":{"type":"change_effect","fromUnitId":"u1","toUnitId":"u2"}}
- questionIntent：null
- limitReason：null
- 第一段禁区：semanticFrame unit 不含 statement；questionIntent 不含 goal、answerEntry 或完整问题；limitReason 不含收束文案

## SF4-CORRECTION-READY-01｜correction_ready_retracts_old_understanding

### 第一层｜产品逐条确认

#### 完整对话

**用户（上文 1）**：下午在书房时，窗户那边一直晃眼。我把窗帘挂钩重新排了一遍，现在舒服多了。

**AI 思路层（上文 1）**：你把挂钩排得更密，让书房的光线暗下来，所以不再晃眼。

**AI 回应（上文 1）**：房间暗下来以后，最先改善的是哪一处？

**用户（本轮）**：你理解反了。我把挂钩间距拉开了，光还是能进来。变化是桌面上那条直射的亮带移到了墙边，屏幕不再反光。我想保留的是把直射光挪开，房间没有变暗。

- 严格状态 / 系统动作：ready / complete
- 这一轮价值：优先撤回 AI 上一轮的变暗误解，再用用户修正后的动作、效果和限定形成可追溯的当前结果。
- 必须保留：挂钩间距拉开；直射亮带移到墙边且屏幕不再反光；光仍能进来且房间没有变暗
- 必须避免：保留排密挂钩或房间变暗的旧理解；继续追问旧问题；把你理解反了写进成果；扩展成长期环境偏好；correction 或 unit 等内部字段
- 回应类型 / 主字段：completion / insight
- 思路层：forbidden
- 对话视角：second_person_or_neutral

### 第二层｜预期语义骨架

- 预期理解状态：correction
- 边界 / 修正：correction
- 理解必须覆盖：撤回挂钩排密导致房间变暗的旧理解；记录挂钩间距拉开后直射亮带移到墙边、屏幕不再反光；保留光仍能进来且房间没有变暗的限定
- 理解必须避免：继续保留挂钩更密或房间变暗的旧理解；把你理解反了写成事件事实或语义单元；只写屏幕不反光而遗漏光线限定
- semanticFrame：{"units":[{"id":"u1","role":"change","evidenceRefs":["new:1"]},{"id":"u2","role":"result","evidenceRefs":["new:3"]},{"id":"u3","role":"scope","evidenceRefs":["new:2","new:4"]}],"relation":{"type":"change_effect","fromUnitId":"u1","toUnitId":"u2"}}
- questionIntent：null
- limitReason：null
- 第一段禁区：semanticFrame unit 不含 statement；questionIntent 不含 goal、answerEntry 或完整问题；limitReason 不含收束文案

## SF4-LIMITED-01｜insufficient_evidence_limited_enum

### 第一层｜产品逐条确认

#### 完整对话

**用户（上文 1）**：我翻到三个月前的纸质日历，那个周五被我圈了三遍，旁边只写了‘终于’。但我完全想不起发生过什么。

**AI 思路层（上文 1）**：现在只剩日期和‘终于’两个字，还缺少能确认当天事情的线索。

**AI 回应（上文 1）**：你能从那天留下的照片、消息或地点想起一点吗？

**用户（本轮）**：照片和消息我都查过了，什么也对不上。我连那天去了哪里都想不起来，只剩日历上‘终于’这两个字。

- 严格状态 / 系统动作：limited / honest_limit
- 这一轮价值：明确当前证据只能支持日历上留下“终于”，及时诚实收口，防止系统替用户补写已经遗失的事件。
- 必须保留：目前只能确认日历上的“终于”；缺少足以还原当天事件的证据
- 必须避免：继续追问同一批线索；把“终于”解释成任何具体事件或情绪；建议编造或补写回忆；insufficient_evidence 或 limitReason 等内部字段
- 回应类型 / 主字段：honest_limit / honestLimit
- 思路层：forbidden
- 对话视角：second_person_or_neutral

### 第二层｜预期语义骨架

- 预期理解状态：unknown
- 边界 / 修正：无
- 理解必须覆盖：照片、消息和地点都无法提供可核对线索；当前只能确认日历上留下“终于”两个字
- 理解必须避免：猜测终于对应完成、解脱、关系进展或好消息
- semanticFrame：null
- questionIntent：null
- limitReason：{"kind":"insufficient_evidence","evidenceRefs":["new:1","new:2","new:3"]}
- 第一段禁区：semanticFrame unit 不含 statement；questionIntent 不含 goal、answerEntry 或完整问题；limitReason 不含收束文案
