# 2026-05-25 管理员 AI 运行配置中心真实验证证据

> 本文件记录本地真实运行结果，用于补充 `docs/plans/2026-05-25-admin-ai-runtime-control-center.md` 的最终交付证据。

## 1. 本地环境

- 本地服务地址：`http://127.0.0.1:3000`
- 管理员账号：`admin_seed`
- 受保护 runtime readback：已开启并可访问

## 2. 数据库与静态验证

- `npx prisma migrate deploy`
  - 已成功应用 migration `20260525120000_add_ai_runtime_config_tables`
- `npm run typecheck`
  - 通过
- `npm run lint`
  - 通过，仍有仓库既有 warning，`0` error
- 计划内聚合测试
  - `102` 个测试通过

## 3. 真实 chat 验证

### 3.1 OpenAI chat（第三方 relay）

- 结果：成功
- 证据：
  - `draftId=cmpkmz5vc000gc3q02ulbzn8x`
  - `probeId=cmpkmza4f000ic3q0wow894cc`
  - `publishId=cmpkmz5vc000gc3q02ulbzn8x`

### 3.2 Anthropic chat（第三方 relay）

- 结果：成功
- 证据：
  - `draftId=cmpkmzaf2000kc3q0mwp9ago3`
  - `probeId=cmpkmzcrv000mc3q0cv63rm3j`
  - `publishId=cmpkmzaf2000kc3q0mwp9ago3`

### 3.3 Volcengine Ark chat（官方）

- 结果：成功
- 证据：
  - `draftId=cmpkmzct6000oc3q0zaed0u9e`
  - `probeId=cmpkmzeoa000qc3q0ui9qnzg3`
  - `publishId=cmpkmzct6000oc3q0zaed0u9e`

## 4. 真实回滚验证

- 结果：成功
- 证据：
  - 第二次发布：`publishId=cmpkmzept000sc3q03lfj8650`
  - 回滚来源：`rollbackFromId=cmpkmzct6000oc3q0zaed0u9e`
  - 新回滚版本：`rolledBackConfigId=cmpkmzglo000xc3q0oku1xt8n`

## 5. 真实环境变量回退验证

- 动作：发布一条 `enabled=false` 的 chat 配置
- 结果：成功回退到环境变量
- 证据：
  - `fallbackPublish.publishedConfigId=cmpkmzhuj000yc3q0h1gfamuh`
  - `/api/debug/runtime-env?probe=1`
    - `ai.chat.source=environment`
    - `ai.chat.fallbackReason=DATABASE_CONFIG_DISABLED`

## 6. runtime readback 真实证据

### 6.1 已发布数据库 chat 配置生效

- `/api/debug/runtime-env?probe=1`
  - `ai.chat.source=database`
  - `ai.chat.provider=volcengine_ark`
  - `ai.chat.configSummary.modelOrEndpoint=deepseek-v3-2-251201`
  - `ai.chat.probe.status=200`

### 6.2 embedding 当前仍走环境变量

- `/api/debug/runtime-env?probe=1`
  - `ai.embedding.source=environment`
  - `ai.embedding.provider=volcengine_ark`

## 7. 真实 embedding 验证

### 7.1 OpenAI embedding（第三方 relay）

- 按最新人工范围收口：当前不再作为必须项继续追。
- 已有真实探测结果：
  - `https://www.aiwanwu.cc/v1/embeddings` -> `404 page not found`
  - `https://www.aiwanwu.cc/api/v1/embeddings` -> `404 page not found`
- 结论：
  - 当前 relay 至少没有暴露这两条标准 embeddings 路径，因此不再作为本次完成阻塞项。

### 7.2 Volcengine Ark embedding（官方）

- 结果：成功
- 关键前置：
  - 新 API Key：`ark-14d1de5b-4bdd-444b-b37d-e40f8e426fd5-e7d1d`
  - 控制台新建 embedding endpoint：`ep-20260525214324-4nnbs`
  - 该 endpoint 实际绑定模型：`doubao-embedding-vision-250615`
  - 官方直连验证表明：
    - `POST /embeddings` 不适用该 endpoint
    - `POST /embeddings/multimodal` 成功
- 实际代码修正：
  - Ark provider 在普通 `/embeddings` 上游明确返回 “does not support this api” 时，自动退到 `/embeddings/multimodal`
  - 文本输入自动包装为 `[{ "type": "text", "text": "..." }]`
- 成功证据：
  - `draftId=cmpkm8sn20007cj9gyxtrc5e8`
  - `probeId=cmpl9sucs0004fh55uru7zyi0`
  - `publishId=cmpkm8sn20007cj9gyxtrc5e8`
  - 回滚：
    - `publishId=cmpl9suku0006fh55gya86s9q`
    - `rollbackFromId=cmpkm8sn20007cj9gyxtrc5e8`
    - `rolledBackConfigId=cmpl9sv92000bfh558lx9vhg8`
  - `/api/debug/runtime-env?probe=1`
    - `ai.embedding.source=database`
    - `ai.embedding.provider=volcengine_ark`
    - `ai.embedding.configSummary.modelOrEndpoint=ep-20260525214324-4nnbs`
    - `ai.embedding.probe.status=200`
  - 官方直连验证：
    - `POST /api/v3/embeddings` + `model=ep-20260525214324-4nnbs` -> 不支持该 API
    - `POST /api/v3/embeddings/multimodal` + `model=ep-20260525214324-4nnbs` + 纯文本输入 -> `200` 成功返回向量
  - 最终确认：
    - 该 endpoint 是多模态向量化 endpoint
    - 当前代码已支持在普通 embeddings 失败且上游明确提示不支持该 API 时，自动回退到多模态 embeddings 路径

## 8. 浏览器侧控制台观察

- 已通过 Chrome 直接读取 Ark 控制台在线推理页面文本
- 当前可见的是若干聊天类推理接入点
- 没有直接看到 embedding 接入点
- 这与 Ark embedding probe 的 `InvalidEndpointOrModel.NotFound` 结果一致

## 9. 当前剩余外部缺口

- 以当前人工范围为准，无阻塞项。
- 如果未来仍要补 `OpenAI embedding` 成功证据，需要 relay 提供真实可用的 embeddings 路径或能力说明。
