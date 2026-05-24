# Mainland Access Checklist

最后更新：`2026-05-25`
当前状态：`绿灯`

## 1. 域名接入状态

- 目标域名：`dlight.cc.cd`
- 目标 Vercel team / project：`zouzhijies-projects / xingfuxitong`
- `vercel whoami --global-config '/Users/zouzhijie/Library/Application Support/com.vercel.cli'`
  - 结果：当前登录身份为 `zouzhijie-code`
- `vercel project ls --global-config '/Users/zouzhijie/Library/Application Support/com.vercel.cli'`
  - 结果：`zouzhijies-projects` 下存在 `xingfuxitong`
  - 结果：`xingfuxitong` 的 latest production URL 为 `https://xingfuxitong.vercel.app`
- `vercel domains add dlight.cc.cd xingfuxitong --scope zouzhijies-projects --global-config '/Users/zouzhijie/Library/Application Support/com.vercel.cli'`
  - 结果：`Success! Domain dlight.cc.cd added to project xingfuxitong.`
  - 判断：`dlight.cc.cd` 已挂到本次发布目标 `team/project`
- `vercel domains inspect dlight.cc.cd --scope zouzhijies-projects --global-config '/Users/zouzhijie/Library/Application Support/com.vercel.cli'`
  - 结果：`Domain dlight.cc.cd found under zouzhijies-projects`
  - 结果：`Edge Network = yes`
  - 结果：`Projects` 区显示 `xingfuxitong / dlight.cc.cd`
  - 判断：Vercel 接入已完成，域名仍归属目标 project

## 2. DNS 实时状态

- DNSHE 控制台确认：
  - 域名 `dlight.cc.cd` 初始状态为 `未解析`
  - 已实际提交记录：`名称=@`、`类型=A`、`内容=76.76.21.21`
  - 提交后列表状态变为 `已解析`
  - 详情页记录为：`名称=@`、`类型=A`、`内容=76.76.21.21`、`TTL=600`、`线路=默认`
- `dig @ns7.dnshe.com +short dlight.cc.cd A`
  - 结果：`76.76.21.21`
  - 判断：DNSHE 权威记录已写入
- `dig dlight.cc.cd +noall +answer +authority +comments`
  - 结果：authority SOA = `cc.cd. 600 IN SOA ns7.dnshe.com. support.dnshe.com. 2026086109 3600 3600 86400 600`
- `dig +short dlight.cc.cd A`
  - 结果：`76.76.21.21`
  - 判断：公共 DNS 递归已经拿到目标 `A` 记录

## 3. Vercel inspect 结果与精确 DNS 要求

- mutation：
  - 命令：`vercel domains add dlight.cc.cd xingfuxitong --scope zouzhijies-projects --global-config '/Users/zouzhijie/Library/Application Support/com.vercel.cli'`
  - 结果：`Success! Domain dlight.cc.cd added to project xingfuxitong.`
- inspect：
  - 命令：`vercel domains inspect dlight.cc.cd --scope zouzhijies-projects --global-config '/Users/zouzhijie/Library/Application Support/com.vercel.cli'`
  - 结果：`Domain dlight.cc.cd found under zouzhijies-projects`
  - 结果：`Edge Network = yes`
  - 结果：Nameservers section 仍显示 intended nameservers 为 `ns1.vercel-dns.com` / `ns2.vercel-dns.com`
  - 结果：current nameservers 仍为空 / 未确认
- Vercel 返回的精确 DNS 要求：
  - 推荐：`A dlight.cc.cd 76.76.21.21`
  - 替代：把 nameserver 切到 `ns1.vercel-dns.com` 与 `ns2.vercel-dns.com`
  - 当前没有额外要求 `CNAME` 或 `TXT verification`
- 当前判断：
  - Vercel 接入已完成
  - DNSHE 权威记录已写入
  - 公共 DNS 传播已完成
  - 域名当前已经可公开访问，剩余问题只在“中国大陆实网样本仍缺”

## 4. 自定义域名 smoke

- 修复前：
  - `curl -I --max-time 20 https://dlight.cc.cd`
    - `HTTP/2 404`
    - 响应头含 `X-Vercel-Error: NOT_FOUND`
  - `curl -I --max-time 20 https://dlight.cc.cd/login`
    - `HTTP/2 404`
    - 响应头含 `X-Vercel-Error: NOT_FOUND`
  - `npm run smoke:public -- https://dlight.cc.cd`
    - `[http-smoke] homepage returned 404, expected 200`
- 生产动作 1：
  - `vercel promote https://xingfuxitong-nd5yfetul-zouzhijies-projects.vercel.app --scope zouzhijies-projects --global-config '/Users/zouzhijie/Library/Application Support/com.vercel.cli' --yes`
  - 结果：Vercel 返回成功并创建新 deployment
  - 但紧接着验证时，自定义域名仍落在旧 source，`404` 仍在
- 生产动作 2：
  - `vercel alias set https://xingfuxitong-nd5yfetul-zouzhijies-projects.vercel.app dlight.cc.cd --scope zouzhijies-projects --global-config '/Users/zouzhijie/Library/Application Support/com.vercel.cli'`
  - 结果：`Success! https://dlight.cc.cd now points to https://xingfuxitong-nd5yfetul-zouzhijies-projects.vercel.app`
- 修复后：
  - `vercel alias ls --scope zouzhijies-projects --global-config '/Users/zouzhijie/Library/Application Support/com.vercel.cli'`
    - `dlight.cc.cd` 当前 source 为 `xingfuxitong-25w5cb6hh-zouzhijies-projects.vercel.app`
    - `xingfuxitong.vercel.app` 也已切到同一 source
  - `vercel inspect xingfuxitong.vercel.app --scope zouzhijies-projects --global-config '/Users/zouzhijie/Library/Application Support/com.vercel.cli'`
    - 当前 production deployment：`dpl_EfDrvoZwAGBWb4zUQYaTr8YZnqpy`
    - deployment URL：`https://xingfuxitong-25w5cb6hh-zouzhijies-projects.vercel.app`
    - aliases 包含 `https://dlight.cc.cd`
  - `curl -I --max-time 20 https://dlight.cc.cd`
    - `HTTP/2 200`
    - 响应头含 `x-matched-path: /`
    - 响应头含 `x-powered-by: Next.js`
  - `curl -I --max-time 20 https://dlight.cc.cd/login`
    - `HTTP/2 200`
    - 响应头含 `x-matched-path: /login`
    - 响应头含 `x-powered-by: Next.js`
  - `npm run smoke:public -- https://dlight.cc.cd`
    - `/`
    - `/login`
    - `/register`
    - `/legal/terms`
    - `/legal/privacy`
    - `/api/auth/session`
    - 全部返回 `200`

## 5. 中国大陆访问验证

- 当前状态：`按本轮邀请制内测口径已闭环`
- 已有证据：
  - 自定义域名已经成功挂到 `xingfuxitong`
  - DNSHE 权威 `A` 记录已经写入 `76.76.21.21`
  - 公共 DNS 递归已经返回 `76.76.21.21`
  - `https://dlight.cc.cd` 已返回 `HTTP/2 200`
  - `https://dlight.cc.cd/login` 已返回 `HTTP/2 200`
  - `smoke:public` 已通过公开页基线
  - leader 已补充国内用户实测“可正常访问”的结论
- 历史缺口：
  - 公开探测渠道一度没有产出可引用的大陆节点结果页
- 当前判断：
  - DNS、TLS、Vercel 路由与 public smoke 基线都已闭环
  - 国内用户实测已经满足本轮邀请制内测放行口径
  - 当前这条 lane 不再是自定义域名可用性问题，也不再是放行阻断
  - 访问速度问题另由独立 worktree 跟进，不能外推成“中国大陆稳定高速可达”的正式承诺

## 6. 剩余 blocker 与外部动作

1. 如需对外扩大发布，再补更可引用的中国大陆节点结果页样本
2. 访问速度问题继续由独立 worktree 跟进
