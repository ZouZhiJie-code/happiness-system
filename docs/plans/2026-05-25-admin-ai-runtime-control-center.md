# 管理员 AI 运行配置中心实施计划

> **For Codex:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** 实现一个仅管理员可见的 AI 运行配置中心。管理员可以在产品后台维护全站生效的聊天模型配置和向量嵌入配置，先保存草稿，再执行连通性测试，测试通过后发布；也可以查看历史版本并回滚。发布后，从下一次 AI 请求开始生效；如果数据库配置不可用，系统回退到现有环境变量配置。

**Architecture:** 在现有 `process.env` 读取逻辑前面增加一层“运行时配置解析器”。这层解析器先读数据库里当前已发布的配置；如果没有可用的数据库配置，再读现有环境变量。数据库里只保存加密后的密钥和非敏感配置字段，不保存明文密钥。聊天能力和向量嵌入能力分别维护草稿、测试记录、已发布版本和历史版本。

**Tech Stack:** Next.js App Router、React、Prisma/PostgreSQL、Vitest、Node `crypto`

---

## 0. 给 `goal` 的执行约束

### 0.1 推荐的 `goal` 输入

直接使用下面这段：

```text
Implement the admin AI runtime control center described in docs/plans/2026-05-25-admin-ai-runtime-control-center.md, and stop only after schema, runtime resolver, provider adapters, admin APIs, admin UI, docs, and verification are complete.
```

### 0.2 本计划解决的问题

1. 管理员不需要再登录部署平台手改环境变量。
2. 管理员可以在产品后台切换 `OpenAI / Anthropic / Volcengine Ark`。
3. 聊天能力和向量嵌入能力分开管理，互不影响。
4. 发布必须经过测试，不允许“未测即发”。
5. 发布后从下一次 AI 请求开始生效，不需要重新部署。
6. 历史版本可回滚。
7. 数据库配置失效时，系统自动回退到现有环境变量配置。

### 0.3 已经确定的产品决策

这些决策在本次实现过程中不再反复讨论：

- 配置优先级：`数据库已发布配置 > 环境变量配置`
- 发布流程：`保存草稿 -> 执行测试 -> 发布`
- 聊天能力和向量嵌入能力分开发布、分开回滚
- API Key 只允许录入，不允许在保存后再次明文展示
- 历史版本必须保留
- 回滚必须支持
- 发布后从下一次 AI 请求开始生效

### 0.4 本次能力边界

本次必须支持的 provider 和能力如下：

| provider | 聊天能力 | 向量嵌入能力 | 说明 |
| --- | --- | --- | --- |
| `openai` | 支持 | 支持 | 聊天使用 OpenAI 聊天接口；向量嵌入使用 OpenAI Embeddings |
| `anthropic` | 支持 | 不支持 | 本次只支持 Anthropic Messages；不把 Anthropic 放进向量嵌入配置 |
| `volcengine-ark` | 支持 | 支持 | 沿用现有 Ark 聊天与 embedding 路径 |

说明：

1. `Anthropic` 不进入“向量嵌入 provider 可选项”。原因不是我们偷懒，而是当前官方文档没有提供 Anthropic 自有 embedding 模型调用合同。
2. 本次不扩展环境变量回退合同到 `OpenAI` 和 `Anthropic`。环境变量回退继续沿用当前已经存在的 `Volcengine Ark` 合同。也就是说：
   - 数据库配置可以是 `OpenAI / Anthropic / Volcengine Ark`
   - 数据库配置缺失或失效时，回退到现有的 Ark 环境变量

### 0.5 不在本次范围内的内容

- 每个用户单独配置 provider
- 不同用户分流到不同 provider
- 自动灰度发布
- 自动回滚
- `AI_RUNTIME_CONFIG_SECRET` 轮换工具
- `OpenAI / Anthropic` 的环境变量回退合同

### 0.6 什么时候才允许中断 `goal`

只有下面这些情况才能中断：

1. 现有 provider 抽象层无法同时容纳 `OpenAI / Anthropic / Volcengine Ark`
2. Prisma migration 形态和当前仓库的迁移约束冲突，且无法通过本地调整解决
3. 必须做生产环境操作

除此之外，不要停在“分析完成”或“计划完成”。

---

## 1. 关键术语，全部写清楚

本计划里只使用下面这些明确术语：

- `草稿`：当前能力线可编辑但未发布的配置
- `连通性测试`：系统拿当前草稿发起一次真实上游调用，用来验证 key、model、endpoint、base URL、权限、余额和接口路径是否可用
- `测试通过`：这次连通性测试拿到了成功响应
- `测试版本一致`：当前草稿的内容没有变化，测试结果对应的就是这份草稿
- `可发布`：同时满足“测试通过”和“测试版本一致”
- `已发布配置`：当前全站会优先使用的数据库配置
- `历史版本`：曾经发布过但现在不是当前版本的配置
- `回滚`：把某个历史版本复制成一个新的已发布版本
- `环境变量回退`：数据库配置不可用时，改用当前 `process.env` 中的 Ark 配置

禁止在实现和文档里继续使用这些模糊词：

- “新鲜成功探针”
- “no-op override”
- “break-glass”
- “健康”
- “green”
- “live”

对应的明确写法：

- “草稿最后一次修改之后重新执行且成功的连通性测试”
- “已发布但不接管运行时，改用环境变量”
- “高风险恢复操作”
- “测试通过”
- “生产环境”

---

## 2. `AI_RUNTIME_CONFIG_SECRET` 的最终定义

### 2.1 这是什么

`AI_RUNTIME_CONFIG_SECRET` 是本系统自己的加密主密钥，用来加密保存到数据库里的 provider API Key。

它不是：

- OpenAI API Key
- Anthropic API Key
- Ark API Key

### 2.2 它负责什么

1. 管理员在后台输入 provider API Key。
2. 后端用 `AI_RUNTIME_CONFIG_SECRET` 把它加密。
3. 加密后的密文存进数据库。
4. 运行时读取数据库配置时，用同一把密钥解密。

### 2.3 它必须怎么生成

推荐命令：

```bash
openssl rand -base64 32
```

### 2.4 它必须怎么部署

1. 同一个环境里的所有实例，必须使用完全相同的 `AI_RUNTIME_CONFIG_SECRET`
2. 本地开发和生产环境可以不同
3. 不能提交到 git
4. 不能从任何 provider API Key 派生

### 2.5 如果缺失会怎样

如果 `AI_RUNTIME_CONFIG_SECRET` 缺失：

- 管理员保存草稿：拒绝
- 管理员执行连通性测试：拒绝
- 管理员发布：拒绝
- 运行时读取数据库配置：记录错误并回退到环境变量

### 2.6 如果以后改了会怎样

如果数据库里已经保存过加密配置，后来又修改了 `AI_RUNTIME_CONFIG_SECRET`：

- 旧密文会解不开
- 当前版本不会支持“无损轮换”
- 恢复办法只有两种：
  1. 把密钥改回原值
  2. 管理员重新录入所有 provider API Key

### 2.7 这个问题现在算不算解决

结论分两层：

- **计划层面：已解决。** 现在已经明确了它是什么、怎么生成、怎么部署、缺失时怎么处理、改动后的后果是什么。
- **代码层面：还没有实现。** 代码要在 `Task 1 / Task 2 / Task 7` 完成后，才算真正落地。

---

## 3. Provider 接口合同

### 3.1 OpenAI

本次实现：

- 聊天能力：支持
- 向量嵌入能力：支持

建议实现路径：

- 聊天：先走 `chat completions` 兼容路径，减少对现有消息结构的改动
- 向量嵌入：走 `/v1/embeddings`

后台字段：

- `apiKey`
- `model`
- `baseUrl`，默认 `https://api.openai.com/v1`

### 3.2 Anthropic

本次实现：

- 聊天能力：支持
- 向量嵌入能力：不支持

建议实现路径：

- 聊天：走 `Messages API`

后台字段：

- `apiKey`
- `model`
- `baseUrl`，默认 `https://api.anthropic.com`
- `anthropicVersion`，默认使用实现时确认的官方版本头

限制：

- 选择 `anthropic` 时，`capability=embedding` 必须在保存草稿阶段就被后端校验拦住

### 3.3 Volcengine Ark

本次实现：

- 聊天能力：支持
- 向量嵌入能力：支持

后台字段：

- `apiKey`
- 聊天：`modelId` 或 `endpointId`
- 向量嵌入：`embeddingEndpointId`
- `baseUrl`，默认 `https://ark.cn-beijing.volces.com/api/v3`

---

## 4. 数据模型设计

### 4.1 核心思路

因为现在要支持多个 provider，不适合继续把字段写死成 `VOLCENGINE_ARK_MODEL` 这种单一结构。本次改成“通用外壳 + provider 专属配置 JSON”。

### 4.2 Prisma enum

在 `prisma/schema.prisma` 中新增：

```prisma
enum AIRuntimeCapability {
  chat
  embedding
}

enum AIRuntimeProvider {
  openai
  anthropic
  volcengine_ark
}

enum AIRuntimeConfigStatus {
  draft
  published
  archived
}
```

### 4.3 Prisma model

新增两张表：

```prisma
model AIRuntimeConfig {
  id               String                @id @default(cuid())
  capability       AIRuntimeCapability
  provider         AIRuntimeProvider
  status           AIRuntimeConfigStatus
  enabled          Boolean               @default(true)
  displayName      String
  apiKeyCiphertext String?
  apiKeyMask       String?
  configJson       Json
  configChecksum   String
  version          Int
  createdBy        String
  publishedBy      String?
  publishedAt      DateTime?
  archivedAt       DateTime?
  rollbackFromId   String?
  createdAt        DateTime              @default(now())
  updatedAt        DateTime              @updatedAt
  probes           AIRuntimeProbe[]

  @@unique([capability, version])
  @@index([capability, status, updatedAt])
  @@index([status, publishedAt])
}

model AIRuntimeProbe {
  id             String               @id @default(cuid())
  configId       String
  capability     AIRuntimeCapability
  provider       AIRuntimeProvider
  configChecksum String
  success        Boolean
  httpStatus     Int?
  errorCode      String?
  latencyMs      Int?
  summary        String
  testedBy       String
  createdAt      DateTime             @default(now())
  config         AIRuntimeConfig      @relation(fields: [configId], references: [id], onDelete: Cascade)

  @@index([configId, createdAt])
  @@index([capability, createdAt])
}
```

### 4.4 `configJson` 的结构

按 provider + capability 校验：

- `openai + chat`
  - `{ "model": "...", "baseUrl": "https://api.openai.com/v1" }`
- `openai + embedding`
  - `{ "model": "...", "baseUrl": "https://api.openai.com/v1" }`
- `anthropic + chat`
  - `{ "model": "...", "baseUrl": "https://api.anthropic.com", "anthropicVersion": "..." }`
- `volcengine_ark + chat`
  - `{ "modelId": "...", "endpointId": "...", "baseUrl": "https://ark.cn-beijing.volces.com/api/v3" }`
  - `modelId` 和 `endpointId` 至少一个存在
- `volcengine_ark + embedding`
  - `{ "embeddingEndpointId": "...", "baseUrl": "https://ark.cn-beijing.volces.com/api/v3" }`

### 4.5 必须保持的数据库约束

这些约束在 service 事务里保证：

1. 每个能力线最多只有 1 条 `draft`
2. 每个能力线最多只有 1 条 `published`
3. 发布前必须有一条 `success=true` 且 `configChecksum` 与当前草稿完全一致的测试记录
4. 任何草稿修改都会改变 `configChecksum`
5. 历史版本不做“原地恢复”，回滚时必须复制出一条新的 `published` 记录

---

## 5. 运行时解析规则

### 5.1 总规则

每次 AI 请求开始时，按下面的顺序解析配置：

1. 先看这个能力线有没有 `published` 数据库配置
2. 如果有，且能成功解密、成功通过 provider 专属校验，就使用数据库配置
3. 如果没有，或者解密失败，或者 provider 校验失败，回退到现有环境变量配置

### 5.2 `enabled=false` 的含义

这里必须写清楚：

- `enabled=false` 不是“关闭全站 AI”
- 它的含义是“当前这条数据库配置不接管运行时，请继续使用环境变量回退配置”

### 5.3 环境变量回退合同

本次不修改现有环境变量回退的主合同。也就是说：

- 聊天回退：继续走当前 Ark 环境变量合同
- 向量嵌入回退：继续走当前 Ark embedding 环境变量合同

### 5.4 本次必须新增的 provider adapter

新增文件：

- `src/server/services/ai/openai.provider.ts`
- `src/server/services/ai/anthropic.provider.ts`

保留并改造：

- `src/server/services/ai/volcengine-ark.provider.ts`

新增统一工厂：

- `src/server/services/ai/runtime-provider-factory.ts`

新增统一解析器：

- `src/server/services/ai/runtime-config-resolver.ts`

---

## 6. 管理员页面和 API

### 6.1 页面入口

新增：

- `/settings/ai-runtime`

入口按钮放在：

- `src/components/auth/settings-account-panel.tsx`

### 6.2 页面结构

页面必须有四块：

1. 当前聊天能力状态
2. 当前向量嵌入能力状态
3. 当前能力线草稿编辑区
4. 历史版本列表

### 6.3 页面必须展示的信息

每个能力线都要展示：

- 当前使用来源：`数据库已发布配置` 或 `环境变量回退配置`
- 当前 provider
- 当前模型或 endpoint
- 当前 base URL
- 最近一次测试结果
- 最近一次发布时间
- 最近一次发布人

### 6.4 页面必须展示的提示文案

必须用明确中文，不允许抽象表达：

- “发布后，从下一次 AI 请求开始生效”
- “保存后不会再次明文显示 API Key”
- “如果数据库配置不可用，系统会改用环境变量配置”
- “如果修改了草稿，必须重新执行连通性测试”

### 6.5 新增 API

新增：

- `GET /api/admin/ai-runtime/status`
- `GET /api/admin/ai-runtime/[capability]/draft`
- `PUT /api/admin/ai-runtime/[capability]/draft`
- `POST /api/admin/ai-runtime/[capability]/probe`
- `POST /api/admin/ai-runtime/[capability]/publish`
- `GET /api/admin/ai-runtime/[capability]/history`
- `POST /api/admin/ai-runtime/[capability]/rollback`

### 6.6 错误码合同

至少支持：

- `AUTHENTICATION_REQUIRED`
- `ADMIN_FORBIDDEN`
- `INVALID_AI_RUNTIME_CAPABILITY`
- `INVALID_AI_RUNTIME_PROVIDER`
- `INVALID_AI_RUNTIME_CONFIG`
- `AI_RUNTIME_SECRET_NOT_CONFIGURED`
- `AI_RUNTIME_PROBE_FAILED`
- `AI_RUNTIME_PUBLISH_BLOCKED`
- `AI_RUNTIME_PROBE_OUTDATED`
- `AI_RUNTIME_HISTORY_NOT_FOUND`

---

## 7. 分批执行任务

## Task 1：补 Prisma schema、migration、环境变量示例

**Files**

- Create: `prisma/migrations/20260525120000_add_ai_runtime_config_tables/migration.sql`
- Modify: `prisma/schema.prisma`
- Modify: `.env.example`
- Modify: `.env.preview.example`
- Modify: `.env.production.example`
- Test: `tests/unit/prisma-persistence-schema.test.ts`

**执行步骤**

1. 先改测试，让测试断言新的 enum、model、index、`AI_RUNTIME_CONFIG_SECRET` 都存在
2. 跑：

```bash
npm test -- tests/unit/prisma-persistence-schema.test.ts
```

3. 实现 schema 和 migration
4. 重新跑同一条测试，必须通过

---

## Task 2：补通用 schema、类型定义、加密工具

**Files**

- Create: `src/features/admin-ai-runtime/schema.ts`
- Create: `src/features/admin-ai-runtime/types.ts`
- Create: `src/server/services/admin-ai-runtime/admin-ai-runtime-crypto.ts`
- Test: `tests/unit/admin-ai-runtime.schema.test.ts`

**测试必须覆盖**

1. `openai + chat` 合法
2. `openai + embedding` 合法
3. `anthropic + chat` 合法
4. `anthropic + embedding` 非法
5. `volcengine_ark + chat` 合法
6. `volcengine_ark + embedding` 合法
7. 缺少 `AI_RUNTIME_CONFIG_SECRET` 时加密工具报错

**执行命令**

```bash
npm test -- tests/unit/admin-ai-runtime.schema.test.ts
```

---

## Task 3：补 provider adapter 和统一工厂

**Files**

- Create: `src/server/services/ai/openai.provider.ts`
- Create: `src/server/services/ai/anthropic.provider.ts`
- Create: `src/server/services/ai/runtime-provider-factory.ts`
- Modify: `src/server/services/ai/volcengine-ark.provider.ts`
- Test: `tests/unit/openai.provider.test.ts`
- Test: `tests/unit/anthropic.provider.test.ts`
- Test: `tests/unit/volcengine-ark.provider.test.ts`

**实现要求**

1. `OpenAIProvider`
   - 聊天支持
   - embedding 支持
2. `AnthropicProvider`
   - 聊天支持
   - embedding 明确返回“不支持该能力”
3. `VolcengineArkProvider`
   - 保持聊天支持
   - 保持 embedding 支持

**执行命令**

```bash
npm test -- tests/unit/openai.provider.test.ts tests/unit/anthropic.provider.test.ts tests/unit/volcengine-ark.provider.test.ts
```

---

## Task 4：补 repository、service、解析器

**Files**

- Create: `src/server/repositories/admin-ai-runtime.repository.ts`
- Create: `src/server/services/admin-ai-runtime/admin-ai-runtime.service.ts`
- Create: `src/server/services/ai/runtime-config-resolver.ts`
- Test: `tests/unit/admin-ai-runtime.repository.test.ts`
- Test: `tests/unit/admin-ai-runtime.service.test.ts`
- Test: `tests/unit/ai-runtime-config-resolver.test.ts`

**必须实现**

1. 获取草稿
2. 保存草稿
3. 计算 `configChecksum`
4. 记录测试结果
5. 判断“测试版本一致”
6. 发布
7. 历史查询
8. 回滚
9. 数据库配置优先，环境变量回退

**关键规则**

- 发布前必须满足：
  - 最近一次测试结果成功
  - 该测试记录的 `configChecksum` 等于当前草稿的 `configChecksum`
- 只要草稿变了，旧测试立即失效

**执行命令**

```bash
npm test -- tests/unit/admin-ai-runtime.repository.test.ts tests/unit/admin-ai-runtime.service.test.ts tests/unit/ai-runtime-config-resolver.test.ts
```

---

## Task 5：把聊天和 embedding 的真实调用点接到解析器

**Files**

- Modify: `src/server/services/ai/index.ts`
- Modify: `src/server/services/ai/provider-config.ts`
- Modify: `src/server/services/ai/structured-output.ts`
- Modify: `src/server/services/interview/joy-interview-ai.service.ts`
- Modify: `src/server/services/portrait/portrait-synthesis.service.ts`
- Modify: `src/server/services/memory/memory-extraction.service.ts`
- Modify: `src/server/services/memory/memory-retrieval.service.ts`
- Modify: `src/server/services/memory/profile.service.ts`
- Test: `tests/unit/ai-provider-status.test.ts`
- Test: `tests/unit/memory-extraction.service.test.ts`
- Test: `tests/unit/memory-retrieval.service.test.ts`
- Test: `tests/unit/profile.service.test.ts`
- Test: `tests/unit/portrait-synthesis.service.test.ts`

**要求**

1. 聊天相关路径必须显式声明自己要 `chat`
2. 向量嵌入相关路径必须显式声明自己要 `embedding`
3. 不允许再有“默认 provider”这种隐式逻辑

**执行命令**

```bash
npm test -- tests/unit/ai-provider-status.test.ts tests/unit/memory-extraction.service.test.ts tests/unit/memory-retrieval.service.test.ts tests/unit/profile.service.test.ts tests/unit/portrait-synthesis.service.test.ts
```

---

## Task 6：补管理员 API

**Files**

- Create: `src/app/api/admin/ai-runtime/status/route.ts`
- Create: `src/app/api/admin/ai-runtime/[capability]/draft/route.ts`
- Create: `src/app/api/admin/ai-runtime/[capability]/probe/route.ts`
- Create: `src/app/api/admin/ai-runtime/[capability]/publish/route.ts`
- Create: `src/app/api/admin/ai-runtime/[capability]/history/route.ts`
- Create: `src/app/api/admin/ai-runtime/[capability]/rollback/route.ts`
- Test: `tests/unit/admin-ai-runtime.api.test.ts`

**测试必须覆盖**

1. admin 可以读取状态
2. admin 可以保存草稿
3. 未测试不允许发布
4. 草稿修改后，旧测试不允许发布
5. admin 可以查看历史
6. admin 可以回滚
7. 非 admin 返回 `403`
8. 未登录返回 `401`

**执行命令**

```bash
npm test -- tests/unit/admin-ai-runtime.api.test.ts
```

---

## Task 7：补管理员 UI

**Files**

- Create: `src/app/settings/ai-runtime/page.tsx`
- Create: `src/components/admin-ai-runtime/ai-runtime-page-client.tsx`
- Create: `src/components/admin-ai-runtime/ai-runtime-status-card.tsx`
- Create: `src/components/admin-ai-runtime/ai-runtime-capability-pane.tsx`
- Create: `src/components/admin-ai-runtime/ai-runtime-draft-form.tsx`
- Create: `src/components/admin-ai-runtime/ai-runtime-history-table.tsx`
- Create: `src/features/admin-ai-runtime/api.ts`
- Modify: `src/components/auth/settings-account-panel.tsx`
- Modify: `src/app/settings/page.tsx`
- Test: `tests/unit/admin-ai-runtime-page.test.tsx`
- Test: `tests/unit/settings-page.test.tsx`

**UI 必须支持**

1. 切换 `chat / embedding`
2. 选择 provider
3. 录入 key
4. 执行测试
5. 发布
6. 查看历史
7. 回滚
8. 显示“当前使用数据库配置还是环境变量配置”

**执行命令**

```bash
npm test -- tests/unit/admin-ai-runtime-page.test.tsx tests/unit/settings-page.test.tsx
```

---

## Task 8：补诊断、文档、最终验证

**Files**

- Modify: `src/app/api/debug/runtime-env/route.ts`
- Modify: `README.md`
- Modify: `docs/operator-runbook.md`
- Modify: `tests/unit/runtime-env-readback.api.test.ts`
- Modify: `tests/unit/database-docs-smoke.test.ts`

**必须新增的诊断信息**

1. chat 当前来源：数据库 / 环境变量
2. embedding 当前来源：数据库 / 环境变量
3. 当前 provider
4. 当前模型或 endpoint 摘要
5. 不返回任何明文密钥

**执行命令**

```bash
npm test -- tests/unit/runtime-env-readback.api.test.ts tests/unit/database-docs-smoke.test.ts
```

---

## 8. 最终验收标准

### 8.1 功能验收

- 管理员能进入 `/settings/ai-runtime`
- 非管理员不能进入
- `chat` 可以发布 `openai`
- `chat` 可以发布 `anthropic`
- `chat` 可以发布 `volcengine_ark`
- `embedding` 可以发布 `openai`
- `embedding` 可以发布 `volcengine_ark`
- `embedding` 选择 `anthropic` 时，保存草稿阶段就被拒绝
- 修改草稿后，旧测试结果失效
- 发布后，从下一次请求开始生效
- 可以回滚
- 数据库配置不可用时，系统回退到环境变量

### 8.2 安全验收

- 明文 API Key 不出现在接口响应里
- 明文 API Key 不出现在 React hydration 里
- 数据库只保存密文
- `AI_RUNTIME_CONFIG_SECRET` 缺失时，管理员后台保存/测试/发布都被拦住
- 解密失败不会让线上请求全部失败，而是回退到环境变量

### 8.3 文档验收

`README.md` 和 `docs/operator-runbook.md` 必须写清：

1. 这个后台配置中心做什么
2. `AI_RUNTIME_CONFIG_SECRET` 是什么
3. 它怎么生成
4. 它怎么部署
5. 改了它会发生什么
6. 如何回滚
7. 如何确认当前是在用数据库配置还是环境变量配置

---

## 9. 最终验证命令

先跑定向测试：

```bash
npm test -- \
  tests/unit/prisma-persistence-schema.test.ts \
  tests/unit/admin-ai-runtime.schema.test.ts \
  tests/unit/openai.provider.test.ts \
  tests/unit/anthropic.provider.test.ts \
  tests/unit/volcengine-ark.provider.test.ts \
  tests/unit/admin-ai-runtime.repository.test.ts \
  tests/unit/admin-ai-runtime.service.test.ts \
  tests/unit/ai-runtime-config-resolver.test.ts \
  tests/unit/admin-ai-runtime.api.test.ts \
  tests/unit/admin-ai-runtime-page.test.tsx \
  tests/unit/settings-page.test.tsx \
  tests/unit/ai-provider-status.test.ts \
  tests/unit/memory-extraction.service.test.ts \
  tests/unit/memory-retrieval.service.test.ts \
  tests/unit/profile.service.test.ts \
  tests/unit/portrait-synthesis.service.test.ts \
  tests/unit/runtime-env-readback.api.test.ts \
  tests/unit/database-docs-smoke.test.ts
```

再跑：

```bash
npm run typecheck
npm run lint
```

本地 schema 同步：

```bash
npx prisma migrate deploy
```

如果本地迁移历史挡住这条命令，再退回：

```bash
npx prisma db push
```

---

## 10. 上线前后的人工检查

### 10.1 上线前

1. 配好 `AI_RUNTIME_CONFIG_SECRET`
2. 确认同一环境所有实例用的是同一值
3. 不删除现有 Ark 环境变量

### 10.2 首次启用

建议顺序：

1. 先发布 `chat` 的 `volcengine_ark` 数据库配置，内容与现有 env 一致
2. 验证聊天主链没问题
3. 再测试并发布 `chat` 的 `openai`
4. 再测试并发布 `chat` 的 `anthropic`
5. 再发布 `embedding` 的 `volcengine_ark`
6. 再发布 `embedding` 的 `openai`

### 10.3 恢复顺序

如果新发布的数据库配置有问题：

1. 先用历史版本回滚
2. 如果后台不可用，直接让运行时回退到环境变量
3. 如果是 `AI_RUNTIME_CONFIG_SECRET` 被改坏，先恢复原值
4. 恢复后必须重新执行连通性测试，确认结果对应当前草稿

---

## 11. 最终交付证据

`goal` 完成时，最终汇报里必须附带下面这些证据：

1. migration 命令和结果
2. 定向测试命令和结果
3. `npm run typecheck` 结果
4. `npm run lint` 结果
5. 一次 `openai + chat` 成功测试
6. 一次 `anthropic + chat` 成功测试
7. 一次 `volcengine_ark + chat` 成功测试
8. 一次 `openai + embedding` 成功测试
9. 一次 `volcengine_ark + embedding` 成功测试
10. 一次历史版本回滚成功
11. 一次数据库配置失效后自动回退到环境变量的验证结果

---

## 12. 完成定义

只有同时满足下面这些条件，才能说“做完了”：

1. 代码完成
2. migration 完成
3. `OpenAI / Anthropic / Volcengine Ark` 的 provider adapter 完成
4. 管理员 API 完成
5. 管理员页面完成
6. 聊天能力和向量嵌入能力都可以独立发布
7. 历史版本回滚可用
8. 环境变量回退可用
9. `AI_RUNTIME_CONFIG_SECRET` 的用途和部署规则已经写进代码和文档
10. 所有验证命令通过
11. 最终交付证据齐全

Plan complete and saved to `docs/plans/2026-05-25-admin-ai-runtime-control-center.md`.
