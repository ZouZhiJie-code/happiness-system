# 用户画像（长期记忆）系统 — 完整实施计划

## Context

幸福日志产品需要"用户画像"功能：AI 自动从访谈中提取用户的长期模式，存储为带向量嵌入的记忆条目，通过语义检索在后续访谈/日报/分析中注入个性化上下文，用户可在独立页面查看和编辑画像。

技术选型：pgvector 向量语义检索 + 火山引擎 Ark embedding API。

分支：`feature/memory-vector-extension`

---

## 架构总览

```
提取流程（访谈结束后，异步 fire-and-forget）:
  访谈数据 → AI 提取模式 → 创建 MemoryFact → 生成 embedding → 存入 pgvector

检索流程（访谈问题生成时）:
  当前上下文 → 生成 query embedding → pgvector 余弦相似度搜索 → Top-K 记忆 → 注入 prompt

画像页面:
  Prisma ORM 查询（不涉及 embedding） → 前端展示/编辑
```

---

## 批次总览

| 批次 | 内容 | 状态 | Commit |
|------|------|------|--------|
| 1 | 基础设施 + 数据层 | ✅ 完成 | `00e30b4` |
| 2 | 记忆提取 | ✅ 完成 | `f57bf0e` |
| 3 | 记忆检索 + Prompt 注入 | ✅ 完成 | `fa7f498` |
| 4 | 画像页面 + API | ✅ 完成 | `e7fd26c` |

---

## 批次 1：基础设施 + 数据层 ✅

### 目标

为记忆系统建立底层支撑：数据库向量扩展、schema 迁移、AI embedding 接口、向量工具函数、数据访问层。

### 完成的任务

**1.1 安装 pgvector**
- macOS: `brew install pgvector` → v0.8.2
- 数据库: `CREATE EXTENSION IF NOT EXISTS vector;`
- 验收: ✅ `SELECT * FROM pg_extension WHERE extname = 'vector'` 返回结果

**1.2 Schema 迁移**
- 修改 `prisma/schema.prisma`：扩展 MemoryFact + 新增 MemorySourceType 枚举
- 新增迁移 `prisma/migrations/20260506120000_extend_memory_fact/`
- 手动 DDL：`ALTER TABLE "MemoryFact" ADD COLUMN embedding vector(2048);`
- 注：HNSW 索引因 2000 维限制暂未建，数据量小（<200 条）时顺序扫描足够
- 验收: ✅ MemoryFact 有 15 列（含新增 topicTags, sourceType, confidence, evidenceSessionIds, deletedAt, embedding）

**1.3 AI Provider 扩展**
- `src/server/services/ai/ai-provider.ts`：接口新增 `embed()` 方法 + `AIEmbeddingParams` / `AIEmbeddingResult` 类型
- `src/server/services/ai/volcengine-ark.provider.ts`：实现 `embed()`，调用 `${baseUrl}/embeddings`
- `.env.example`：新增 `VOLCENGINE_ARK_EMBEDDING_ENDPOINT_ID`
- 验收: ✅ Prisma client 已更新，类型完整

**1.4 Vector 工具层**
- 新建 `src/lib/vector.ts`：`formatVectorForPg()` + `findSimilarMemoryFacts()` + `setMemoryFactEmbedding()`
- 使用 Prisma raw SQL（`$queryRaw` / `$executeRaw`）执行余弦相似度查询
- 验收: ✅ 函数可正确格式化向量和执行查询

**1.5 Memory Repository**
- 新建 `src/server/repositories/memory.repository.ts`
- Prisma ORM 操作：`createMemoryFact`、`createManyMemoryFacts`、`findAllMemoryFacts`、`findMemoryFactsByDimension`、`findMemoryFactById`、`updateMemoryFact`、`softDeleteMemoryFact`、`deleteMemoryFact`、`touchMemoryFacts`
- 文本去重：`findSimilarBySummary`（关键词重叠率 > 0.6 视为重复）
- 向量操作：`setMemoryFactEmbedding`（re-export from vector.ts）
- 验收: ✅ 所有 CRUD 操作和去重逻辑就绪

### 涉及文件

| 操作 | 文件 |
|------|------|
| 修改 | `prisma/schema.prisma` |
| 新建 | `prisma/migrations/20260506120000_extend_memory_fact/migration.sql` |
| 修改 | `.env.example` |
| 修改 | `src/server/services/ai/ai-provider.ts` |
| 修改 | `src/server/services/ai/volcengine-ark.provider.ts` |
| 新建 | `src/lib/vector.ts` |
| 新建 | `src/server/repositories/memory.repository.ts` |

### 测试方式

手动验收（无自动化测试）：
- pgvector 扩展安装验证
- Prisma schema 迁移验证
- embedding API 连通性验证
- Repository CRUD 验证

---

## 批次 2：记忆提取 ✅

### 目标

访谈结束后自动从会话数据中提取用户模式，去重后存入 MemoryFact，生成向量嵌入。

### 完成的任务

**2.1 提取 Prompt + Zod Schema**
- 新建 `src/features/memory/prompts/memory-extraction.prompts.ts`
- `memoryExtractionResultSchema`：Zod schema，验证 AI 输出格式
- `buildMemoryExtractionMessages()`：构建系统消息 + 用户消息
  - 系统消息：角色定义、核心规则（只提取模式不提取事件）、JSON 输出格式
  - 用户消息：维度、访谈快照、事件数量、日报草稿内容
- 验收: ✅ 14 个单元测试全部通过

**2.2 提取 Service + 触发集成**
- 新建 `src/server/services/memory/memory-extraction.service.ts`
- `extractMemoriesFromSession()`：主提取函数
  1. 检查 `memoryEnabled` → false 则跳过
  2. 构建 prompt → `completeStructuredOutput()` 调用 AI（temperature: 0.2, maxTokens: 800, maxAttempts: 1）
  3. AI 失败 → 静默跳过，记录日志
  4. 遍历提取结果，每条调用 `findSimilarBySummary` 去重
     - 相似 → 合并（不创建新记录）
     - 不相似 → `createMemoryFact`
  5. 批量生成 embedding（`provider.embed()`，input 为数组）
  6. 逐条写入 embedding（`setMemoryFactEmbedding`）
  7. embedding 失败时记录日志，不影响已创建的记忆
- `computeConfidence()`：基于事件数量和轮次计算置信度（0.3-1.0）
- 触发点：在 `generateJoyInterviewDraft()` 中，`saveJoyInterviewDraft` 之后 fire-and-forget
- 验收: ✅ 9 个单元测试全部通过

### 涉及文件

| 操作 | 文件 |
|------|------|
| 新建 | `src/features/memory/prompts/memory-extraction.prompts.ts` |
| 新建 | `src/server/services/memory/memory-extraction.service.ts` |
| 修改 | `src/server/services/interview/joy-interview.service.ts`（+import 和触发调用） |
| 新建 | `tests/unit/memory-extraction-prompts.test.ts`（14 tests） |
| 新建 | `tests/unit/memory-extraction.service.test.ts`（9 tests） |

### 测试方式

自动化单元测试（TDD）：
- Schema 验证：正确输入通过、无效 kind 拒绝、过短/过长 summary 拒绝、空 topicTags 拒绝
- Prompt 结构：返回 system + user 消息、包含维度标签、包含草稿内容、包含输出格式指令
- Service 逻辑：AI 返回有效数据时创建记录、生成 embedding、memoryEnabled=false 跳过、AI 返回 null 跳过、去重合并、embedding 失败不抛出

---

## 批次 3：记忆检索 + Prompt 注入 ✅

### 目标

在访谈问题生成时，从用户的历史记忆中检索相关条目，注入 AI prompt，让访谈问题体现对用户的了解。

### 完成的任务

**3.1 记忆检索 Service**
- 新建 `src/server/services/memory/memory-retrieval.service.ts`
- `retrieveRelevantMemories()`：
  1. 从当前会话快照 + 事件文本构建 query text
  2. 调用 `provider.embed()` 生成 query embedding
  3. 调用 `findSimilarMemoryFacts()` 进行余弦相似度搜索
  4. 按 `1 - cosine_distance` 排序，取 Top-K（默认 15 条）
  5. 过滤 `confidence < 0.3` 和 `deletedAt IS NOT NULL`
  6. 格式化为注入文本：`"- [独处/偏好] 独处时幸福感显著提升"`
  7. 更新命中的记忆的 `lastUsedAt`
  8. 总量控制在 500 token 以内
  9. Embedding 失败时降级为按 dimension + confidence 排序的 Prisma 查询
- 验收: ✅ 测试覆盖

**3.2 Prompt 注入**
- 修改 `src/features/joy-interview/prompts/joy-prompts.ts`
  - `buildJoyQuestionMessages()` 新增可选参数 `memoryContext?: string`
  - 在 user message 的现有 context sections 之后追加画像内容
- 修改 `src/server/services/interview/joy-interview.service.ts`
  - 在 `resolvePreparedInterviewTurn()` 中获取记忆并传递给 prompt builder
  - 失败时降级为无记忆 context
- 验收: ✅ 测试覆盖

### 涉及文件

| 操作 | 文件 |
|------|------|
| 新建 | `src/server/services/memory/memory-retrieval.service.ts` |
| 修改 | `src/features/joy-interview/prompts/joy-prompts.ts`（+memoryContext 参数） |
| 修改 | `src/server/services/interview/joy-interview.service.ts`（+检索调用） |
| 修改 | `src/server/services/interview/joy-interview-ai.service.ts`（传递 memoryContext） |
| 新建 | `tests/unit/memory-retrieval.service.test.ts` |
| 修改 | `tests/unit/joy-prompts.test.ts`（+memoryContext 测试） |

### 测试方式

自动化单元测试：
- 检索逻辑：向量搜索返回结果、按相似度排序、过滤低置信度、token 上限控制
- 降级：embedding 失败时降级为关键词检索
- Prompt 注入：memoryContext 存在时追加到 user message、不存在时不追加
- 集成：完整流程从检索到注入

---

## 批次 4：画像页面 + API ✅

### 目标

用户可在独立 `/profile` 页面查看、编辑、添加、删除自己的画像条目。画像按五维度分组，支持主题标签筛选。

### 完成的任务

**4.1 Profile API**
- 新建 `src/app/api/profile/route.ts`
- `GET /api/profile` — 获取全部画像（分维度分组）
- `POST /api/profile` — 手动添加画像条目（sourceType: user_added, confidence: 1.0）
- `PATCH /api/profile` — 更新画像条目（编辑摘要、标签）
- `DELETE /api/profile?id=xxx` — 删除画像条目（软删除）
- Zod schema 验证请求体
- 手动添加的条目也需要生成 embedding（用于后续检索）
- 验收: ✅ API 路由就绪，Zod 校验生效

**4.2 Profile Service + Page**
- 新建 `src/server/services/memory/profile.service.ts` — `getAllProfiles`、`addProfileFact`、`updateProfileFact`、`deleteProfileFact`
- 新建 `src/app/profile/page.tsx` — 遵循 Settings 页面 Pattern B（`page-shell` class 两栏布局）
- 新建 `src/components/profile/profile-content.tsx` — 客户端组件
  1. 顶部概览（一句话总结，可后续接入 AI 生成）
  2. 主题标签云（从全部画像的 topicTags 聚合，点击筛选）
  3. 按维度分组的卡片列表（悦/实/思/改/谢 各一个区域）
  4. 每张卡片：摘要、标签、来源标记（AI 生成 / 用户添加）、置信度指示
  5. 卡片交互：展开详情（关联条目）、编辑摘要和标签、删除
  6. 每个维度底部"+ 添加"按钮
- 新建 `src/components/profile/memory-card.tsx` — 单条记忆卡片组件
- 新建 `src/components/profile/add-memory-dialog.tsx` — 添加记忆弹窗
- 验收: ✅ 页面渲染正常，11 个 service 单元测试通过

**4.3 导航入口**
- 修改 `src/components/shared/site-header.tsx` (line 32-37)
- 在 `navItems` 中添加：`{ href: "/profile", matchPath: "/profile", label: "画像" }`
- 位置：放在"分析"和"设置"之间
- 验收: ✅ 导航项已添加

### 涉及文件

| 操作 | 文件 |
|------|------|
| 新建 | `src/app/api/profile/route.ts` |
| 新建 | `src/server/services/memory/profile.service.ts` |
| 新建 | `src/app/profile/page.tsx` |
| 新建 | `src/components/profile/profile-content.tsx` |
| 新建 | `src/components/profile/memory-card.tsx` |
| 新建 | `src/components/profile/add-memory-dialog.tsx` |
| 修改 | `src/components/shared/site-header.tsx` |
| 新建 | `tests/unit/profile.service.test.ts`（11 tests） |

### 测试方式

API 测试：
- `GET /api/profile` 返回分维度分组的画像数据
- `POST /api/profile` 创建条目并返回
- `PATCH /api/profile` 更新条目
- `DELETE /api/profile` 软删除条目

页面测试（可选）：
- 页面渲染测试
- 卡片交互测试
- 标签筛选测试

---

## 关键设计决策

1. **向量维度 2048**：doubao-embedding 模型输出约 2048 维，超过 HNSW 索引的 2000 维限制，暂用顺序扫描
2. **Fire-and-forget**：记忆提取不阻塞日报生成主流程，失败静默记录日志
3. **去重策略**：文本关键词重叠率 > 0.6 视为重复，合并而非新建
4. **置信度**：基于访谈深度计算（事件数 + 轮次），范围 0.3-1.0
5. **降级兜底**：embedding API 不可用时，检索降级为按维度 + confidence 排序
6. **软删除**：用户删除画像条目时用 `deletedAt` 标记，数据不丢失

## 环境变量

```
# 已有
VOLCENGINE_ARK_API_KEY=""
VOLCENGINE_ARK_ENDPOINT_ID=""       # chat 模型
VOLCENGINE_ARK_BASE_URL="https://ark.cn-beijing.volces.com/api/v3"

# 新增
VOLCENGINE_ARK_EMBEDDING_ENDPOINT_ID=""  # embedding 模型（doubao-embedding）
```
