# Happiness-system-codex Tech Design

## 1. 技术栈选择

### 前端
- `Next.js 15`
  - 作为 Web/PWA 首发承载框架，适合页面、API、认证和部署统一管理。
- `React 19`
  - 用于实现对话流、录音、草稿编辑、状态恢复等交互。
- `TypeScript`
  - 约束访谈状态、消息结构、抽取结果和接口数据。
- `Tailwind CSS`
  - 用于快速搭建第一版界面。
- `Zustand`
  - 管理当前访谈会话、本地输入状态、未提交草稿。
- `React Hook Form + Zod`
  - 管理设置项和日志确认表单，并做输入校验。
- `MediaRecorder API`
  - 支持浏览器端录音。

说明：
- 第一版不使用重型前端 UI 框架。
- UI 的目标是稳定完成访谈，不追求复杂组件体系。

### 后端
- `Next.js Route Handlers`
  - 提供 API，减少第一版拆分多仓库和多服务的复杂度。
- `Service Layer`
  - 在 `src/server/services` 中封装 AI、访谈编排、记忆检索、日志生成。
- `Zod`
  - 校验所有接口入参与 AI 返回的结构化 JSON。
- `Prisma`
  - 管理数据库 schema、查询和迁移。
- `Pino`
  - 记录转写、AI 调用、访谈失败原因和延迟。

设计原则：
- AI provider 通过 adapter 抽象。
- prompt 和模型调用不能散落在页面组件中。
- 流程判断必须在代码层完成，不能完全依赖 prompt。

### 数据库
- `PostgreSQL`
  - 作为第一版唯一主数据库。
- `Prisma ORM`
  - 用于 schema 管理和数据库访问。
- 可选预留：`pgvector`
  - 后续若要增强语义记忆检索，可以在 PostgreSQL 内扩展。

第一版记忆检索优先级：
1. 结构化字段检索
2. 标签和关键词检索
3. 最近记录检索

说明：
- 第一版不强依赖独立向量数据库。
- 不引入 Redis、Elasticsearch、Kafka 等额外基础设施。

## 2. 项目结构

采用单仓库单应用结构，但前后端逻辑必须清晰分层。

```text
Happiness-system-codex/
  docs/
    Tech_Design.md
    Product_Spec.md
  prisma/
    schema.prisma
    migrations/
  public/
  src/
    app/
      (marketing)/
      interview/
      settings/
      api/
        interview/session/start/route.ts
        interview/session/respond/route.ts
        interview/session/finalize/route.ts
        transcribe/route.ts
    components/
      interview/
      joy/
      shared/
    features/
      joy-interview/
        client/
        server/
        schema/
        prompts/
    server/
      db/
      services/
        ai/
        interview/
        memory/
        joy/
      repositories/
      lib/
    stores/
    lib/
    types/
  package.json
  tsconfig.json
  next.config.ts
  .env.example
```

组织原则：
- `app/` 只放页面和 API 入口。
- `components/` 只放 UI 组件。
- `features/joy-interview` 放开心维度特有逻辑。
- `server/services/interview` 放通用访谈状态机。
- `server/services/memory` 放记忆检索逻辑。
- `server/services/ai` 放模型调用和 provider 适配。
- `prompts/` 只保存模板，不承担流程控制。

## 3. 数据模型

第一版需要存储完整访谈链路，而不只是最终日志。

### User
- `id`
- `createdAt`

### UserSettings
- `userId`
- `memoryEnabled`
- `transcriptAutoFallbackEnabled`
- `timezone`
- `updatedAt`

### InterviewSession
- `id`
- `userId`
- `dimension`
  - 第一版固定为 `joy`
- `status`
  - `active | completed | abandoned`
- `turnCount`
- `startedAt`
- `completedAt`
- `lastAssistantQuestion`
- `draftSummary`
- `finalEntryId`

### InterviewMessage
- `id`
- `sessionId`
- `role`
  - `user | assistant | system`
- `inputMode`
  - `voice | text`
- `content`
- `sequence`
- `createdAt`

### JoyInterviewSnapshot
每一轮抽取后的结构化快照。

- `id`
- `sessionId`
- `version`
- `event`
- `feeling`
- `whyItMattered`
- `happinessType`
- `selfPattern`
- `confidence`
- `missingSlots`
- `createdAt`

用途：
- 追踪每轮抽取结果
- 调试 AI 为什么会继续追问
- 支撑后续质量评估

### JoyEntry
最终确认后的开心日志。

- `id`
- `userId`
- `sessionId`
- `date`
- `title`
- `content`
- `event`
- `feeling`
- `whyItMattered`
- `happinessType`
- `selfPattern`
- `tags`
- `source`
  - `ai_draft_edited | ai_draft_direct`
- `createdAt`
- `updatedAt`

### MemoryFact
长期记忆摘要。

- `id`
- `userId`
- `dimension`
- `kind`
  - `pattern | preference | recurring-person | recurring-context`
- `summary`
- `evidenceEntryIds`
- `salience`
- `lastUsedAt`
- `createdAt`
- `updatedAt`

第一版记忆来源：
- 最近的 `JoyEntry`
- `MemoryFact`

### AIRequestLog
记录 AI 调用和失败信息。

- `id`
- `sessionId`
- `stage`
  - `transcribe | extract | generate`
- `provider`
- `latencyMs`
- `success`
- `errorCode`
- `createdAt`

这个表在第一版很重要，因为测试阶段需要定位失败点。

## 4. 关键技术点

### 4.1 访谈质量不能只靠 Prompt
访谈链路必须拆成 4 个阶段：
1. `Transcribe`
2. `Extract`
3. `Orchestrate`
4. `Generate`

规则：
- 模型不能自由决定访谈流程。
- 后端状态机决定下一步问什么类型的问题。
- prompt 只负责把问题表达得自然。

### 4.2 开心维度状态机
第一版固定状态：
- `collect_event`
- `probe_reason`
- `probe_pattern`
- `wrap_up`
- `finalize`

结束条件：
- 已识别具体事件
- 已识别为什么开心
- 已识别开心类型或自我模式之一
- 或达到 4 轮上限

### 4.3 语音输入链路
- 前端录音后上传音频
- 服务端调用转写模型
- 转写失败时返回明确错误
- 用户可无缝切换到文本输入继续

第一版不做：
- 实时全双工语音
- TTS 语音播报

### 4.4 历史记忆检索
第一版不把全部历史日志直接喂给模型。

检索步骤：
1. 先按 `dimension = joy` 过滤
2. 再按标签、关键词、近期性排序
3. 最多提供 3 条相关历史给生成层

约束：
- 显式引用历史最多 1 次每会话
- 只有用户开启记忆功能时才允许引用历史

### 4.5 JSON 结构化输出校验
- `extract` 和 `finalize` 都要求模型返回 JSON
- 服务端用 `Zod` 校验
- 非法 JSON 自动重试一次
- 仍失败则返回可恢复错误，不破坏当前 session

### 4.6 可恢复会话
- 页面刷新后可恢复未完成 session
- 每轮消息和 snapshot 立即持久化
- 避免用户录完音或回答后因为刷新导致内容丢失

### 4.7 可观察性
至少记录以下指标：
- 转写耗时
- 抽取耗时
- 生成耗时
- 当前缺失槽位
- 结束原因
  - 正常收束
  - 达到轮次上限
  - 用户手动结束
  - AI 调用失败

这些数据用于后续测试和质量分析。

## 5. API 设计

第一版最小接口集合如下：

### `POST /api/interview/session/start`
入参：
- `dimension`

出参：
- `sessionId`
- `openingQuestion`

### `POST /api/transcribe`
入参：
- 音频文件

出参：
- `transcript`

### `POST /api/interview/session/respond`
入参：
- `sessionId`
- `userMessage`
- `inputMode`

出参：
- `assistantMessage`
- `sessionStatus`
- `turnCount`
- `snapshot`
- `isComplete`

### `POST /api/interview/session/finalize`
入参：
- `sessionId`

出参：
- `draftEntry`

### `PUT /api/joy-entry/:id`
入参：
- 用户编辑后的日志

出参：
- 保存后的正式记录

### `GET /api/interview/session/:id`
用途：
- 页面刷新后恢复未完成会话

## 6. 第一版范围约束

第一版只实现：
- `开心` 一个维度
- Web/PWA
- 语音输入转文字
- 强引导式访谈
- 历史记忆开关
- 可编辑确认的开心日志

第一版不实现：
- 其他四个维度
- 自由聊天式多维跳转
- 实时语音通话
- 周/月分析接入新访谈系统
- 明确的教练建议或心理干预

## 7. 实现原则

- 优先保证访谈质量稳定，而不是追求“像人在自由聊天”
- 优先保证可测试、可恢复、可追踪，而不是最少代码
- 所有关键状态都应持久化
- 所有 AI 结构化输出都必须经过服务端校验
- 前端负责体验，后端负责流程控制
