# 2026-05-24 Env / Runtime Audit

## 结论

- 当前结论：`绿灯`
- 结论含义：`Preview / Production` 必填 env 的 live 基线继续维持 `绿灯`；`2026-05-24` 的 browser-side runtime readback 已闭环，`2026-05-25` 又在 fresh preview 上补齐了完整 protected-preview smoke 与深链 `draft save` 正向证据。
- leader 合并建议：`Lane B 可按已闭环合并处理`

## 今日新拿到的 live 基线

### 1. Vercel 账号与 deployment 可见性

命令：

```bash
vercel whoami
```

结果：

```text
zouzhijie-code
```

命令：

```bash
vercel list --scope zouzhijies-projects
```

结果摘要：

- 命令成功返回 live deployment 列表。
- 当前可用的最新 `Ready Preview` 目标仍是：
  - `https://xingfuxitong-nd5yfetul-zouzhijies-projects.vercel.app`
- 同批还能看到其他 `5d` 的 preview：
  - `https://xingfuxitong-8w6xmyh95-zouzhijies-projects.vercel.app`
  - `https://xingfuxitong-ranjnvulr-zouzhijies-projects.vercel.app`
  - `https://xingfuxitong-7ux7jint8-zouzhijies-projects.vercel.app`

判断：

- 当前机器的 Vercel 登录态正常。
- 当前机器能读到 live project 和 deployment 列表。
- 当前 lane 选用 `xingfuxitong-nd5yfetul-...` 作为 fresh runtime / smoke 的目标 preview。

### 2. 本地可用 env 预检查

命令：

```bash
for f in .env .env.local ../../.env ../../.env.local; do
  if [ -f "$f" ]; then
    awk -F= '/^(RUNTIME_ENV_READBACK_TOKEN|ENABLE_RUNTIME_ENV_READBACK|VERCEL_AUTOMATION_BYPASS_SECRET|SMOKE_BYPASS_SECRET)=/ {print FILENAME":"$1"=<set>"}' "$f"
  fi
done
```

结果：

```text
<no output>
```

判断：

- 当前 worktree 与父仓根目录的 `.env / .env.local` 中都没有命中：
  - `RUNTIME_ENV_READBACK_TOKEN`
  - `ENABLE_RUNTIME_ENV_READBACK`
  - `VERCEL_AUTOMATION_BYPASS_SECRET`
  - `SMOKE_BYPASS_SECRET`
- 这不单独证明 preview runtime 没配这些值，只能证明“当前 shell 无法从本地 env 文件直接拿到它们”。

## Fresh browser-only preview 证据

### Chrome 页面级 reachability

方法：

- 使用已登录的 `Google Chrome`
- 每次只打开一个指定 preview URL 的临时标签页
- 只读取该标签页的：
  - 最终 URL
  - 标签标题
  - `document.readyState`
- 读取后立即关闭标签页
- 不再使用 `vercel curl`
- 不读取 `/api/auth/session` 的响应 body，只验证该 route 在浏览器里可达

结果：

#### 1. 首页

```text
URL: https://xingfuxitong-nd5yfetul-zouzhijies-projects.vercel.app/
TITLE:
STATE: complete
```

#### 2. `/login`

```text
URL: https://xingfuxitong-nd5yfetul-zouzhijies-projects.vercel.app/login
TITLE:
STATE: complete
```

#### 3. `/register`

```text
URL: https://xingfuxitong-nd5yfetul-zouzhijies-projects.vercel.app/register
TITLE: xingfuxitong-nd5yfetul-zouzhijies-projects.vercel.app
STATE: complete
```

#### 4. `/api/auth/session`

```text
URL: https://xingfuxitong-nd5yfetul-zouzhijies-projects.vercel.app/api/auth/session
TITLE: xingfuxitong-nd5yfetul-zouzhijies-projects.vercel.app
STATE: complete
```

判断：

- 当前 preview deployment 至少在浏览器页面级是可达的。
- 今天已经补到一条 fresh protected-preview 页面级证据。
- 这条证据能关闭“浏览器里 preview 整体打不开”的疑点。
- 这条证据还不能替代 runtime token 级 readback，也不能替代带结果断言的自动化 smoke。
- 当前只能补 `fresh 页面级 preview 证据`，不能补 `runtime token 级证据`。

## Fresh runtime readback 实跑结果

### 尝试 A：显式代理路径

命令：

```bash
set -a && [ -f ../../.env ] && source ../../.env && [ -f ../../.env.local ] && source ../../.env.local && set +a && \
HTTP_PROXY=http://127.0.0.1:7897 \
HTTPS_PROXY=http://127.0.0.1:7897 \
ALL_PROXY=socks5://127.0.0.1:7897 \
ACCEPTANCE_TRANSPORT=vercel-curl \
ACCEPTANCE_VERCEL_SCOPE=zouzhijies-projects \
ACCEPTANCE_BASE_URL='https://xingfuxitong-nd5yfetul-zouzhijies-projects.vercel.app' \
node scripts/runtime-env-readback.mjs 'https://xingfuxitong-nd5yfetul-zouzhijies-projects.vercel.app' runtime
```

结果摘要：

```json
{
  "ok": false,
  "baseUrl": "https://xingfuxitong-nd5yfetul-zouzhijies-projects.vercel.app",
  "account": null,
  "env": null,
  "resolved": null,
  "error": "Command failed: vercel curl /api/auth/register ... request to https://api.vercel.com/v2/user failed, reason: Client network socket disconnected before secure TLS connection was established"
}
```

判断：

- 命令没有进入应用层 readback。
- 显式代理路径会先把 `vercel curl` 卡死在 Vercel user API 的 TLS 建连阶段。

### 尝试 B：去掉显式代理

命令：

```bash
set -a && [ -f ../../.env ] && source ../../.env && [ -f ../../.env.local ] && source ../../.env.local && set +a && \
ACCEPTANCE_TRANSPORT=vercel-curl \
ACCEPTANCE_VERCEL_SCOPE=zouzhijies-projects \
ACCEPTANCE_BASE_URL='https://xingfuxitong-nd5yfetul-zouzhijies-projects.vercel.app' \
node scripts/runtime-env-readback.mjs 'https://xingfuxitong-nd5yfetul-zouzhijies-projects.vercel.app' runtime
```

结果摘要：

```json
{
  "ok": false,
  "baseUrl": "https://xingfuxitong-nd5yfetul-zouzhijies-projects.vercel.app",
  "account": null,
  "env": null,
  "resolved": null,
  "error": "Command failed: vercel curl /api/auth/register ... curl: (28) Failed to connect to xingfuxitong-nd5yfetul-zouzhijies-projects.vercel.app port 443 after 75002 ms: Couldn't connect to server"
}
```

补充观察：

- `vercel curl` 先完成了 `Retrieving project…`
- 随后在目标 preview host 的 `443` 连接上卡住约 `75s`
- 最终返回 `curl: (28) Failed to connect ... Couldn't connect to server`

判断：

- 命令仍然没有进入应用层，更没有走到 token 校验。
- 当前机器在“无显式代理”路径下能访问 Vercel 项目信息，仍然无法通过 `vercel curl` 连接这个 preview deployment。

## Fresh protected-preview smoke 实跑结果

### 尝试 A：显式代理路径

命令：

```bash
HTTP_PROXY=http://127.0.0.1:7897 \
HTTPS_PROXY=http://127.0.0.1:7897 \
ALL_PROXY=socks5://127.0.0.1:7897 \
ACCEPTANCE_TRANSPORT=vercel-curl \
ACCEPTANCE_VERCEL_SCOPE=zouzhijies-projects \
ACCEPTANCE_BASE_URL='https://xingfuxitong-nd5yfetul-zouzhijies-projects.vercel.app' \
node scripts/product-smoke.mjs joy 2026-05-24 previewsmoke
```

结果摘要：

```json
{
  "ok": false,
  "baseUrl": "https://xingfuxitong-nd5yfetul-zouzhijies-projects.vercel.app",
  "dimension": "joy",
  "entryDate": "2026-05-24",
  "account": null,
  "steps": [
    {
      "name": "register",
      "ok": false,
      "status": 977,
      "error": "Command failed: vercel curl /api/auth/register ... request to https://api.vercel.com/v2/user failed, reason: Client network socket disconnected before secure TLS connection was established"
    }
  ]
}
```

判断：

- protected-preview smoke 在 `register` 第一步就被代理路径拦住。
- 失败层级与 runtime readback 尝试 A 一致。

### 尝试 B：去掉显式代理

命令：

```bash
ACCEPTANCE_TRANSPORT=vercel-curl \
ACCEPTANCE_VERCEL_SCOPE=zouzhijies-projects \
ACCEPTANCE_BASE_URL='https://xingfuxitong-nd5yfetul-zouzhijies-projects.vercel.app' \
node scripts/product-smoke.mjs joy 2026-05-24 previewsmoke
```

结果摘要：

```json
{
  "ok": false,
  "baseUrl": "https://xingfuxitong-nd5yfetul-zouzhijies-projects.vercel.app",
  "dimension": "joy",
  "entryDate": "2026-05-24",
  "account": null,
  "steps": [
    {
      "name": "register",
      "ok": false,
      "status": 982,
      "error": "Command failed: vercel curl /api/auth/register ... curl: (28) Failed to connect to xingfuxitong-nd5yfetul-zouzhijies-projects.vercel.app port 443 after 75057 ms: Couldn't connect to server"
    }
  ]
}
```

判断：

- protected-preview smoke 也停在 `register` 第一步。
- 失败层级与 runtime readback 尝试 B 一致。
- 今天没有拿到任何 `register -> login -> session -> start -> invalid_entry_date` 的 fresh 正向结果。

## 2026-05-25 fresh preview 正向补证

### 1. 最小 protected-preview smoke

命令：

```bash
NODE_USE_ENV_PROXY=1 \
HTTP_PROXY=http://127.0.0.1:7897 \
HTTPS_PROXY=http://127.0.0.1:7897 \
ALL_PROXY=http://127.0.0.1:7897 \
ACCEPTANCE_TRANSPORT=vercel-curl \
ACCEPTANCE_VERCEL_SCOPE=zouzhijies-projects \
ACCEPTANCE_BASE_URL='https://xingfuxitong-q5m1gzgif-zouzhijies-projects.vercel.app' \
node scripts/product-smoke.mjs joy 2026-05-25 previewsmoke
```

结果摘要：

```json
{
  "ok": true,
  "baseUrl": "https://xingfuxitong-q5m1gzgif-zouzhijies-projects.vercel.app",
  "steps": [
    { "name": "register", "status": 200, "ok": true },
    { "name": "login", "status": 200, "ok": true },
    { "name": "session", "status": 200, "ok": true },
    { "name": "start", "status": 200, "ok": true, "stage": "collect_event" },
    { "name": "invalid_entry_date", "status": 400, "ok": true, "error": "INVALID_START_REQUEST" }
  ]
}
```

判断：

- fresh preview host `q5m1gzgif` 上，最小 `vercel-curl` smoke 已经从注册一路打到 `start`。
- 这条路径不再停在 `register` 第一步，也不再出现早前的 `TLS` 建连失败或 `443` 端口卡死。

### 2. 完整 controller deep-chain

方法：

- 同一 preview host、同一 `vercel-curl` 路径
- 使用稳定 `fulfillment` 正向样本
- 依次执行：
  - `register`
  - `login`
  - `GET /api/auth/session`
  - `POST /api/interview/session/start`
  - 三轮 `reply`
  - `POST /api/interview/session/draft/generate`
  - `POST /api/interview/session/draft/save`

结果摘要：

```json
{
  "baseUrl": "https://xingfuxitong-q5m1gzgif-zouzhijies-projects.vercel.app",
  "register": { "status": 200, "authenticated": true },
  "login": { "status": 200, "authenticated": true },
  "session": { "status": 200, "authenticated": true },
  "start": { "status": 200, "stage": "collect_event" },
  "replies": [
    { "step": 1, "status": 200, "stage": "probe_reason" },
    { "step": 2, "status": 200, "stage": "probe_pattern" },
    {
      "step": 3,
      "status": 200,
      "stage": "wrap_up",
      "draftGenerationUnlocked": true,
      "pendingDecision": { "kind": "event_complete", "completionMode": "complete" }
    }
  ],
  "generate": { "status": 200, "title": "主线终于理顺", "journalStatus": "draft" },
  "save": {
    "status": 200,
    "title": "主线终于理顺",
    "journalStatus": "saved",
    "journalId": "f4af3283-5fc1-4af2-9e68-b53d616b627e"
  }
}
```

判断：

- fresh preview 环境上的核心内容链已经补到完整正向证据，不再只是页面级 reachability。
- `reply -> wrap_up -> draft generate -> draft save` 已在 `2026-05-25` 的 preview host 上闭环。

## 当前判断

### 1. Preview / Production env 合同

- 判断：`绿灯`
- 依据：
  - 本轮没有出现新的反证。
  - `Preview / Production` 必填 env 绿灯结论继续沿用。

### 2. Runtime URL contract

- 判断：`绿灯`
- 依据：
  - 历史 `2026-05-19` readback 正向证据仍成立。
  - `2026-05-24` browser-side runtime readback 已确认 `VERCEL_PROJECT_PRODUCTION_URL=dlight.cc.cd`。
  - 当前没有新的应用层反证。

### 3. Protected-preview smoke contract

- 判断：`绿灯`
- 依据：
  - 历史 `2026-05-19` protected preview smoke 通过证据仍成立。
  - `2026-05-25` fresh preview `q5m1gzgif` 上，最小 `product-smoke` 已全绿。
  - 同一 preview 上又补到了完整 `register -> login -> session -> start -> reply -> draft generate -> draft save` 深链正向证据。

## 当前 blocker

- 当前没有新的 preview 环境放行 blocker。
- 当前保留的已知限制不是“链路不通”，而是“最深链路仍靠 controller / runner 深链补证，不是单个脚本一键全包”。

## 对 leader 的落地含义

- Lane B 已经从“fresh 证据不足”切到“fresh 证据闭环”。
- 当前这条 lane 可以按 `绿灯` 并入总控。
- 剩余讨论点只属于放行节奏和已接受限制，不再属于 preview 环境阻断。

## Leader 摘要

- `Preview / Production` env 合同：`绿`
- fresh runtime readback：`已补到；Chrome 侧应用层直读返回 200，且读到 Vercel production URL = dlight.cc.cd`
- fresh protected-preview smoke：`已补到；最小 product-smoke 全绿，完整 deep-chain 也已打到 draft save`
- 总结论：`绿；preview 环境的发布证据已达到首批邀请放行要求`
