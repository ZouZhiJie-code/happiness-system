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

- [ ] 注册 / 登录 / 退出
- [ ] 五维访谈
- [ ] 单篇日志生成 / 保存
- [ ] 完整日志生成 / 保存
- [ ] `calendar / analysis / profile / settings`

## 5. 内测运营

- [ ] 首批 `1-2` 个种子用户已确定
- [ ] 反馈群已建立
- [ ] 报错反馈模板已固定
- [ ] 暂停扩人规则已写明

## 当前结论

- 当前状态：`Pending final sign-off`
- 当前已完成：主目录恢复为 `main`，`wip/main-snapshot-2026-05-20` 转为辅助 worktree，`AI-01 ~ AI-05` 已全部有正式结论，自动化四件套已在主目录 `main` 上补跑；`dlight.cc.cd` 已接入 Vercel；production 数据库缺失的管理员分析 migration 已补齐；production AI provider 已通过真实 runtime probe
- 当前待完成：中国大陆访问验证、最终人工回归、`Go / No-Go`

## 自动化结果

- `2026-05-24 10:50 CST` `npm run typecheck`：通过
- `2026-05-24 10:50 CST` `npm test`：通过（`94` 个测试文件，`718` 个测试）
- `2026-05-24 10:50 CST` `npm run build`：通过（存在既有 warning，但没有新增 error）
- `2026-05-24 10:50 CST` `npm run lint`：通过（`0` error，`34` warning）

## Launch Decision

- Decision：`Pending`
- Basis：域名与 production AI / DB 基线已经收口；仍缺中国大陆真实网络样本与一轮最终人工回归
- Remaining accepted limits：当前仅接受既有 lint / build warning，不接受新的 `P0`
