# 发布总览

最后更新：`2026-05-25`

## 1. 本轮发布目标

本轮目标不是正式公开上线，而是开启首批邀请制内测，并把范围控制在：

- 熟人用户
- `5` 人以内
- 先放 `1-2` 个种子用户
- 观察 `1-2` 天
- 无新的 `P0` 后再扩到 `5` 人

本轮对外开放范围按当前产品全量用户可见面执行：

- 注册 / 登录 / 退出 / 删号
- 五维访谈
- 单篇日志生成、编辑、保存
- 当天完整日志生成、编辑、保存
- `calendar`
- `analysis`
- `profile`
- `settings`

当前明确不纳入本轮发布能力：

- `/api/transcribe`
- 真实语音入口

## 2. 当前发布结论

当前状态：`Go`

含义：

- 核心功能、主要修复、部署主线、数据库基线、CI、人工回归和发布收口已达到首批邀请放行条件。
- `2026-05-24` 已把自定义域名主阻断修掉：`dlight.cc.cd` 已接入目标 Vercel 项目，DNSHE 权威记录和公共 DNS 都已生效，首页 / `login` / public smoke 已恢复正常。
- `2026-05-25` 又在 fresh preview `https://xingfuxitong-q5m1gzgif-zouzhijies-projects.vercel.app` 上补齐了 protected-preview 的完整流程证据：最小 `product-smoke` 全绿，完整 `fulfillment` 深链从注册一路走到日志保存，最终标题为 `主线终于理顺`，状态为 `saved`。
- 国内用户实测已确认“可正常访问”，满足本轮邀请制内测口径。访问速度问题单独跟进，不作为当前放行阻断。
- 内测运营准备按 leader 最新确认视为通过，本轮不在仓库继续展开种子用户名单与反馈群细节。

## 3. 发布门槛

只有以下条件全部满足，才允许发出首批邀请：

| 维度 | 当前状态 | 发布判断 |
|---|---|---|
| P0 开放问题 | `绿` | 当前问题池 `ISSUE-001 ~ ISSUE-011` 均为 `regression_passed` |
| 账户与数据安全 | `绿` | 注册、登录、登出、多账号隔离、删号级联已验收 |
| 核心记录主链路 | `绿` | 五维访谈、单篇日志、当天完整日志闭环已验收 |
| 状态恢复与工作区切换 | `绿` | 刷新恢复、`entryDate`、单篇日志与完整日志切换已验收 |
| Calendar 回看链路 | `绿` | 月 / 周 / 日视图和 deep link 已验收 |
| Analysis 与评分回流 | `绿` | 评分闭环、`rhythm`、`insights` drill-down 已验收 |
| Profile / Memory / Settings | `绿` | 画像门槛、fallback portrait、设置页不拖主流程已验收 |
| 部署 / 数据库 / 环境变量 | `绿` | `Preview / Production` 必填环境变量齐全；runtime readback 已确认 `VERCEL_PROJECT_PRODUCTION_URL=dlight.cc.cd`；`2026-05-25` fresh preview smoke 与深链证据已补齐 |
| CI / 工具链 | `绿` | `typecheck + test + build + lint` 已纳入 CI |
| AI 访谈质量结论完整性 | `绿` | `AI-01 ~ AI-05` 已在验收矩阵中显式写出当前判定 |
| 最终发布环境回归 | `绿` | `2026-05-24-final-regression-report.md` 已补关键主链回归，未发现新的产品级 `P0` |
| 中国大陆访问验证 | `绿` | `dlight.cc.cd` 已接入 `zouzhijies-projects/xingfuxitong`，国内用户实测可访问，满足本轮邀请制内测口径 |
| 内测运营准备 | `绿` | 报错模板、暂停规则已成文；种子用户与反馈群按 leader 最新确认视为通过 |

## 4. 已关闭的关键 gate

### 4.1 策略与发布标准

- 发布目标、分批顺序、`P0 / P1 / P2` 标准已在 `2026-05-17-launch-plan.md` 固定

### 4.2 验收与回归

- 批次 `1 ~ 7` 已有执行记录
- 当前问题池中的 `ISSUE-001 ~ ISSUE-011` 均已回归通过
- `2026-05-24-final-regression-report.md` 已补关键主链回归

### 4.3 工具链与自动化

- `package.json` 已固定 `typecheck / test / build / lint` 脚本
- GitHub Actions 已纳入 `npm ci -> typecheck -> test -> build -> lint`
- `Vitest` 和 `ESLint` 已收敛到当前仓库主基线
- `2026-05-24 10:50 CST` 已在主目录 `main` 上重新跑过 `typecheck / test / build / lint`

### 4.4 部署与数据库基线

- Vercel 作为首条 preview / production 主线已固定
- `DATABASE_URL / DIRECT_URL` 分工已明确
- `migrate deploy`、pgvector extension、关键索引、认证会话生命周期已验证
- runtime env readback 已确认 production URL contract 指向 `dlight.cc.cd`
- `2026-05-25` fresh preview `vercel-curl` smoke 已补到完整正向证据

### 4.5 工作区拓扑

- 主目录已经恢复为 `main`
- `wip/main-snapshot-2026-05-20` 已转为辅助 worktree，只保留为历史参考，不再承担发布推进

## 5. 当前已接受限制

1. `product-smoke.mjs` 自动化覆盖面仍只到最小 `auth/session/start/invalid_entry_date`；更深的 `reply -> draft generate -> draft save` 当前靠 controller / runner 深链补证。这是当前可接受的首批邀请证据形态。
2. 中国大陆访问速度问题已单独分流到独立 worktree，当前不把“速度偏慢”表述成“大陆稳定高速可达”。
3. `/api/transcribe` 与真实语音入口继续不在本轮邀请范围内。

## 6. 放行结论

- `Go`
- 允许发出首批 `1` 个种子用户邀请。
- 继续沿用原先的 `D-day` 节奏：先观察 `24-48` 小时，没有新的 `P0` 再决定是否扩到第 `2` 人或 `5` 人上限。

## 7. D-day 策略

### 7.1 发布节奏

- `D-day` 只放 `1` 个种子用户
- 观察 `24-48` 小时
- 没有新的 `P0` 后再扩到 `5` 人以内

### 7.2 立即暂停条件

出现以下任一情况，立即停止继续发放：

- 注册 / 登录 / 退出失败
- 五维访谈无法开始或无法继续
- 日志无法生成或无法保存
- 刷新 / 切页后内容丢失
- 多账号串线
- 跨日期串线
- `calendar / analysis` 出现关键状态错投影
- 中国大陆主要测试网络中出现持续打不开、长时间白屏或高频请求超时

### 7.3 可继续扩人的条件

只有在以下条件全部成立时，才允许从 `1-2` 人扩到 `5` 人：

- 观察期内没有新的 `P0`
- 新出现的问题只落在 `P1 / P2`
- 用户能稳定完成“注册 -> 访谈 -> 生成日志 -> 保存”
- 中国大陆网络未出现稳定性灾难
