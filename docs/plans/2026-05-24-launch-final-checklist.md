# Final Launch Checklist

最后更新：`2026-05-25`

## 1. 文档回填

- [x] `AI-01 joy` 结论已回填
- [x] `AI-03 reflection` 结论已回填
- [x] 发布总览已同步到当前状态
- [x] 发布执行计划已纳入 `main`

## 2. 环境与域名

- [x] `dlight.cc.cd` 已接入 Vercel
- [x] DNSHE 记录已生效
- [x] preview / production 环境变量核对完成

## 3. 自动化

- [x] `npm run typecheck`
- [x] `npm test`
- [x] `npm run build`
- [x] `npm run lint`

## 4. 人工回归

- [x] 注册 / 登录 / 退出
- [x] 五维访谈
- [x] 单篇日志生成 / 保存
- [x] 完整日志生成 / 保存
- [x] `calendar / analysis / profile / settings`

## 5. 内测运营

- [x] 首批 `1-2` 个种子用户已确定
- [x] 反馈群已建立
- [x] 报错反馈模板已固定
- [x] 暂停扩人规则已写明

说明：

- 种子用户与反馈群落位按 leader 最新确认视为已通过，本轮不在仓库里继续展开名单与群信息。

## 当前结论

- 当前状态：`Go`
- 当前已完成：主目录恢复为 `main`，`wip/main-snapshot-2026-05-20` 转为辅助 worktree，`AI-01 ~ AI-05` 已全部有正式结论，自动化四件套已在主目录 `main` 上补跑，`preview / production` 必填环境变量已完成 live 复查，自定义域名与国内可访问性已收口，`2026-05-25` 已在 fresh preview `https://xingfuxitong-q5m1gzgif-zouzhijies-projects.vercel.app` 上补齐完整 protected-preview smoke 与 `register -> login -> session -> start -> reply -> draft generate -> draft save` 正向证据。
- 当前待完成：`无`

## 2026-05-25 Lane 结果

- `Lane A 域名 / 大陆访问`：`绿`
  - `dlight.cc.cd` 已接入目标 Vercel 项目
  - DNSHE 权威记录与公共 DNS 已生效
  - 首页 / `login` / public smoke 已恢复正常
  - 国内用户实测已确认“可正常访问”，满足本轮邀请制内测口径
- `Lane B 环境 / 发布环境审计`：`绿`
  - `2026-05-25` fresh preview `https://xingfuxitong-q5m1gzgif-zouzhijies-projects.vercel.app` 上，`product-smoke.mjs` 已实跑通过：
    - `register=200`
    - `login=200`
    - `session=200`
    - `start=200`
    - `invalid_entry_date=400`
  - 同一 preview 上又补到完整 controller deep-chain：
    - `fulfillment` 会话 `start=200`
    - 三轮 `reply` 均 `200`
    - 第 `3` 轮后进入 `wrap_up`
    - `draftGenerationUnlocked=true`
    - `pendingDecision.kind=event_complete`
    - `draft generate=200`，标题 `主线终于理顺`，状态 `draft`
    - `draft save=200`，同一条日志状态为 `saved`
  - runtime readback 也已确认 `VERCEL_PROJECT_PRODUCTION_URL=dlight.cc.cd`
- `Lane C 内测运营准备`：`绿`
  - 报错模板、暂停规则已成文
  - 种子用户与反馈群按 leader 最新确认视为通过
- `Lane D1 最终回归关键主链`：`绿`
  - `A-02 / A-03 / A-06 / B-01 / B-03 / B-04 / B-05 / B-06 / B-07` 已有正向证据
  - 没有发现新的产品级 `P0`
- `Lane E 中国大陆样本补证`：`绿`
  - 国内用户已给出“可正常访问”的实测结论
  - 访问速度偏慢另由独立 worktree 跟进，不作为当前放行阻断

## 自动化结果

- `2026-05-24 10:50 CST` `npm run typecheck`：通过
- `2026-05-24 10:50 CST` `npm test`：通过（`94` 个测试文件，`718` 个测试）
- `2026-05-24 10:50 CST` `npm run build`：通过（存在既有 warning，但没有新增 error）
- `2026-05-24 10:50 CST` `npm run lint`：通过（`0` error，`34` warning）

## Launch Decision

- Decision：`Go`
- Basis：`dlight.cc.cd` 已挂到 `zouzhijies-projects/xingfuxitong`，DNSHE 权威记录和公共 DNS 均已生效；国内用户实测可访问。关键主链最终回归本轮未发现新的产品级 `P0`。`2026-05-25` 又在 fresh preview `https://xingfuxitong-q5m1gzgif-zouzhijies-projects.vercel.app` 上补齐了完整 protected-preview 证据：最小 `product-smoke` 全绿，完整 `fulfillment` 深链从注册一路走到日志保存，最终标题为 `主线终于理顺`，状态为 `saved`。运营落位按 leader 最新确认视为通过，因此当前已经满足“发出首批邀请”的放行条件。
- Remaining accepted limits：当前仍接受既有 lint / build warning；访问速度问题另由独立 worktree 跟进；`/api/transcribe` 与真实语音入口继续不在本轮范围内。
