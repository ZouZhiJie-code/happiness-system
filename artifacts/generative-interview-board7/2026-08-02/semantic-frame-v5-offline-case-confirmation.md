# 板块 7｜semanticFrame v5 成果归属与统一回应确认包

- 数据集：2026-08-02.board7-semantic-frame-v5-offline-confirmation-v1
- 案例指纹：481c86765c4d7f1866887705b5af2e032975dc2818c27e9792dedefe3fee2229
- 冻结候选：{"strategy":"5.50.0","semanticPrompt":"2026-08-02.event-centered-generative-v72-semantic-origin","visiblePrompt":"2026-08-02.event-centered-generative-v72-visible-response","fewShot":"quality-patterns.2026-08-02.v29","semanticArtifact":"event-centered-semantic-plan.v5","angleCard":"2.12.0"}
- 当前门：离线契约与案例确认
- 当前模型请求预算：0 次
- 后续运行：确认本包后另行建立预算并获得明确授权
- 第一段新增必要信息：ready.origin
- 第二段最小输出：thinkingSummary / response / cannotExpressReason

## SF4-F-READY-01｜feeling_user_articulated_single_unit

- 角度 / 模式：feeling / guided_reflection
- 上一道问题：真正游完以后，你最先有什么变化？
- 用户本轮：手碰到池壁那一下，我摘下泳镜，才发现自己在笑，肩膀也松了。那一刻就是松快。
- 状态 / 动作 / 成果归属：ready / complete / user_articulated
- 这一轮价值：把用户已经说清的松快体验完整收住，及时结束这一轮，避免把自然体验扩写成长期能力。
- 语义骨架：{"units":[{"id":"u1","role":"experience","evidenceRefs":["new:1","new:2","new:3"]}],"relation":null}
- 提问意图：null
- 停止原因：null
- 用户回应必须保留：触壁摘镜；笑和肩膀放松；松快
- 用户回应必须避免：继续追问；训练建议；克服恐惧；长期能力；semanticFrame 或 unit 等内部字段

## SF4-T-ASK-01｜thought_needs_more_sensory_answer_source

- 角度 / 模式：thought / guided_reflection
- 上一道问题：这个位置更符合你心里的什么标准？
- 用户本轮：我只知道退到门口再看时就不想继续挪了，可具体是哪一处让我停手，我还说不清。
- 状态 / 动作 / 成果归属：needs_more / ask / null
- 这一轮价值：把仍模糊的视觉判断降到门口回看时的一处感官细节，为用户提供低负担、可直接回答的入口。
- 语义骨架：{"units":[{"id":"u1","role":"judgment","evidenceRefs":["new:1","new:2"]}],"relation":null}
- 提问意图：{"gap":"停止调整版画位置的具体视觉依据","answerSource":{"kind":"sensory_detail","evidenceRefs":["new:1"],"anchorQuote":"退到门口再看时"}}
- 停止原因：null
- 用户回应必须保留：已在门口回看时停手；问题落到当时看到的一处具体画面或位置
- 用户回应必须避免：重复询问什么标准或为什么；提供高度、光线、边距、留白等候选答案；替用户解释成舒服或平衡；暴露 gap、answerSource 或 evidenceRefs

## SF4-R-COEXIST-01｜relationship_ready_coexistence_two_sides

- 角度 / 模式：relationship / deep_conversation
- 上一道问题：这两种做法分别让你处在什么状态？
- 用户本轮：我跟不上时，他会在旁边数拍，我就能接回节奏；可我只要错一步，他就当着大家把音乐喊停，我会一下很紧。帮到我和让我有压力，这两边都是真的。
- 状态 / 动作 / 成果归属：ready / pause / user_articulated
- 这一轮价值：完整保留帮助与压力同时成立的两侧体验，在关系角度形成真实进展，并尊重复杂感受无需排序。
- 语义骨架：{"units":[{"id":"u1","role":"experience","evidenceRefs":["new:1","new:3"]},{"id":"u2","role":"experience","evidenceRefs":["new:2","new:3"]}],"relation":{"type":"coexistence","fromUnitId":"u1","toUnitId":"u2"}}
- 提问意图：null
- 停止原因：null
- 用户回应必须保留：数拍带来的帮助；当众停音乐带来的压力；两边同时成立
- 用户回应必须避免：强迫排序或二选一；推测舞伴动机；关系去留建议；只保留其中一侧；coexistence 或 unit 等内部字段

## SF4-A-EFFECT-01｜action_ready_change_effect_two_sides

- 角度 / 模式：action / guided_reflection
- 上一道问题：昨晚再练时，手和三页曲子的连续性分别是什么样？
- 用户本轮：三页还横排在谱架上。昨晚我的手一直留在琴键上，从第一页到第三页连着弹完了。
- 状态 / 动作 / 成果归属：ready / complete / ai_synthesized
- 这一轮价值：根据横排乐谱和连续弹奏两侧事实，形成一次安全的实际效果连接，同时保持它属于 AI 综合。
- 语义骨架：{"units":[{"id":"u1","role":"change","evidenceRefs":["SF4-A-EFFECT-01-fact-2","new:1"]},{"id":"u2","role":"result","evidenceRefs":["new:2"]}],"relation":{"type":"change_effect","fromUnitId":"u1","toUnitId":"u2"}}
- 提问意图：null
- 停止原因：null
- 用户回应必须保留：横排三页乐谱；手没有离开琴键；连续弹完三页并少掉原先翻谱中断
- 用户回应必须避免：未来练习计划；提高专注力或效率；形成习惯；把成果归属写成用户已经说出的结论；change_effect 或 unit 等内部字段

## SF4-CORRECTION-READY-01｜correction_ready_retracts_old_understanding

- 角度 / 模式：action / guided_reflection
- 上一道问题：房间暗下来以后，最先改善的是哪一处？
- 用户本轮：你理解反了。我把挂钩间距拉开了，光还是能进来。变化是桌面上那条直射的亮带移到了墙边，屏幕不再反光。我想保留的是把直射光挪开，房间没有变暗。
- 状态 / 动作 / 成果归属：ready / complete / user_articulated
- 这一轮价值：优先撤回 AI 上一轮的变暗误解，再用用户修正后的动作、效果和限定形成可追溯的当前结果。
- 语义骨架：{"units":[{"id":"u1","role":"change","evidenceRefs":["new:1"]},{"id":"u2","role":"result","evidenceRefs":["new:3"]},{"id":"u3","role":"scope","evidenceRefs":["new:2","new:4"]}],"relation":{"type":"change_effect","fromUnitId":"u1","toUnitId":"u2"}}
- 提问意图：null
- 停止原因：null
- 用户回应必须保留：挂钩间距拉开；直射亮带移到墙边且屏幕不再反光；光仍能进来且房间没有变暗
- 用户回应必须避免：保留排密挂钩或房间变暗的旧理解；继续追问旧问题；把你理解反了写进成果；扩展成长期环境偏好；correction 或 unit 等内部字段

## SF4-LIMITED-01｜insufficient_evidence_limited_enum

- 角度 / 模式：thought / guided_reflection
- 上一道问题：你能从那天留下的照片、消息或地点想起一点吗？
- 用户本轮：照片和消息我都查过了，什么也对不上。我连那天去了哪里都想不起来，只剩日历上‘终于’这两个字。
- 状态 / 动作 / 成果归属：limited / honest_limit / null
- 这一轮价值：明确当前证据只能支持日历上留下“终于”，及时诚实收口，防止系统替用户补写已经遗失的事件。
- 语义骨架：null
- 提问意图：null
- 停止原因：{"kind":"insufficient_evidence","evidenceRefs":["new:1","new:2","new:3"]}
- 用户回应必须保留：目前只能确认日历上的“终于”；缺少足以还原当天事件的证据
- 用户回应必须避免：继续追问同一批线索；把“终于”解释成任何具体事件或情绪；建议编造或补写回忆；insufficient_evidence 或 limitReason 等内部字段
