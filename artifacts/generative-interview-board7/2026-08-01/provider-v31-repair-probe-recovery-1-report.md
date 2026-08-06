# 板块 7｜Provider v3.1 repair probe 一次性技术恢复报告

- 数据集 / 案例指纹：2026-08-01.board7-provider-v31-repair-probe-v1 / dace7ba2a3847246749a1d5f4e05a724654a791ecc8cc6807f40f2889fad9e47
- 原预算 reservationId：056d21bd-c880-46e2-b2d3-1447443ba6f1
- recoveryId：5a486a15-8f20-40bb-be61-27eae67f4c49
- 原 envelope 指纹：b239a2032dc7ed7ef70f20b1e76c7d8d2d6440f0b6aef7f7e585c64a70d0f4fe
- 恢复案例：V31-RP-R-VOICE-01
- 保留原运行：V31-RP-T-ENTRY-01-R1
- 原候选版本：{"prompt":"two_call:2026-08-01.event-centered-generative-v69-understanding-card+2026-08-01.event-centered-generative-v69-visible","strategy":"5.48.0","angleCard":"2.12.0","fewShot":"quality-patterns.2026-08-01.v27","semanticArtifact":"event-centered-semantic-plan.v3","repairProbe":"provider-v3.1-repair-probe-v1"}
- 恢复候选版本：{"prompt":"two_call:2026-08-01.event-centered-generative-v70-understanding-card+2026-08-01.event-centered-generative-v69-visible","strategy":"5.48.0","angleCard":"2.12.0","fewShot":"quality-patterns.2026-08-01.v27","semanticArtifact":"event-centered-semantic-plan.v3","repairProbe":"provider-v3.1-repair-probe-v1"}
- 冻结运行参数：{"model":"deepseek-v4-flash","temperature":0.2,"maxTokens":1500,"timeoutMs":12000,"maxRequestsPerTurn":4,"architecture":"two_call","thinking":"disabled","maxTechnicalRetriesPerStage":1}
- 技术完整：1/2
- 第一段语义通过：0/2（已评 0）
- 用户可见回应通过：0/2（已评 0）
- 当前门槛 / 下一步：fail / stop

## 原失败记录（完整保留）

- 原运行指纹：fc44ee05a35a4f58f2aaba65265d644fb476c5dc866aece121f330eda8da7f6f
- 原 attempts：[{"stage":"extract","attempt":1,"provider":"deepseek","success":false,"latencyMs":null,"errorCode":"TIMEOUT","errorMessage":"AI request timed out."},{"stage":"extract","attempt":1,"provider":"deepseek","success":false,"latencyMs":694,"tokenUsage":{"promptTokens":2989,"completionTokens":375,"totalTokens":3364,"promptCacheHitTokens":2944,"promptCacheMissTokens":45},"errorCode":"INVALID_SCHEMA","errorMessage":"understanding.factDeltas.2.kind:invalid_enum_value","responseText":"{\n  \"understanding\": {\n    \"eventBoundary\": \"current_event\",\n    \"coreEventIdentifiable\": true,\n    \"answerStatus\": \"answered\",\n    \"factDeltas\": [\n      {\n        \"statement\": \"医生问情况时，她先等我讲完，只在我漏掉发作时间后补了一句\",\n        \"scope\": \"current_event\",\n        \"stance\": \"affirmed\",\n        \"kind\": \"event_detail\",\n        \"quote\": \"医生问情况时，她先等我讲完，只在我漏掉发作时间后补了一句\"\n      },\n      {\n        \"statement\": \"我感觉有人接住了最慌的部分，怎么说明情况仍由我来\",\n        \"scope\": \"current_event\",\n        \"stance\": \"affirmed\",\n        \"kind\": \"event_detail\",\n        \"quote\": \"我感觉有人接住了最慌的部分，怎么说明情况仍由我来\"\n      },\n      {\n        \"statement\": \"这个角度就聊到这里吧\",\n        \"scope\": \"current_event\",\n        \"stance\": \"affirmed\",\n        \"kind\": \"boundary\",\n        \"quote\": \"这个角度就聊到这里吧\"\n      }\n    ],\n    \"correctionOrBoundary\": {\n      \"kind\": \"boundary\",\n      \"reason\": \"用户明确表示当前角度聊到这里\"\n    },\n    \"eventOptions\": []\n  },\n  \"decision\": {\n    \"state\": \"ready\"\n  },\n  \"understandingCard\": {\n    \"statement\": \"朋友在医生询问时先等用户讲完，只补充漏掉的发作时间，让用户感到慌乱被接住的同时仍保留说明情况的主导权。\",\n    \"evidenceRefs\": [\"new:1\", \"new:2\"]\n  },\n  \"questionIntent\": null,\n  \"limitReason\": null\n}"}]
- 原失败阶段 / 失败码：semantic_plan / TIMEOUT

## 恢复结果

- 当前理解：朋友先等用户讲完，只补充漏掉的发作时间，让用户感到慌乱被接住的同时保留了说明情况的主导权
- 理解证据：new:1 / new:2
- 提问目标：无
- 作答入口：无
- 提问证据：无
- 诚实收束原因：无
- 可见回应：无
- 候选版本：{"prompt":"two_call:2026-08-01.event-centered-generative-v70-understanding-card+2026-08-01.event-centered-generative-v69-visible","strategy":"5.48.0","angleCard":"2.12.0","fewShot":"quality-patterns.2026-08-01.v27","semanticArtifact":"event-centered-semantic-plan.v3","repairProbe":"provider-v3.1-repair-probe-v1"}
- 本轮实际版本：{"strategy":"5.48.0","angleCard":"2.12.0","fewShot":"quality-patterns.2026-08-01.v27","examples":["CAL-RELATIONSHIP-DEEP:user-articulated","CAL-RELATIONSHIP-DEEP:ai-synthesized","CAL-RELATIONSHIP-DEEP:ask"]}
- Prompt 血缘：[{"promptKey":"interview.event_centered.generative_semantic_plan","promptVersion":"2026-08-01.event-centered-generative-v70-understanding-card","resolvedPromptHash":"b616ba2b7459dfee2a4d71c24beb9183ea61fbc3b6a9729b5a5072d54de2d25e"},{"promptKey":"interview.event_centered.generative_visible_turn","promptVersion":"2026-08-01.event-centered-generative-v69-visible","resolvedPromptHash":"b13e0fcc9ead394769dc3ce696fa8be925a7b72199edda55038b1dfef77e6a57"}]
- 第一段耗时 / token：524ms / 3466
- 第二段耗时 / token：964ms / 1781
- 整轮耗时 / token：6535ms / 5247
- 失败阶段 / 失败码：visible_turn / INVALID_SCHEMA
- 运行指纹：456de6207a212e42c91811902af346704f2bdb0ca4ebad0959a926a393419758
- 第一段 / 可见回应裁决：待评 / 待评
