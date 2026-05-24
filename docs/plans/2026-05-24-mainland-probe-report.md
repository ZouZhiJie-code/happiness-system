# 2026-05-24 Mainland Probe Report

## 结论

本报告保留的是 `2026-05-24` 这轮公开探测的最短失败链，不再作为当前放行阻断。

- 样本来源：当时未拿到可引用的中国大陆节点 HTTP/HTTPS 结果样本；以下记录的是本轮最短失败链
- 目标 URL：`https://dlight.cc.cd/`；备选同轮尝试包含 `https://dlight.cc.cd/login`
- 时间：`2026-05-24 14:28:38 CST` 整理成文；失败链观测发生于此前同一轮操作的几分钟内
- 结果摘要：17CE 首页可访问并确认存在“中国大陆”区域选项与 HTTP 检测入口，但交互提交未产出目标结果页；切换到公开第二路径 ITDOG 后，目标结果直达页连续落在安全验证页，未拿到大陆节点结果
- 可信度：`高`（针对失败链本身）；不代表 `dlight.cc.cd` 在中国大陆不可达，只代表本轮没有拿到可引用的大陆节点结果页样本
- 后续状态更新：leader 已补充国内用户实测“可正常访问”的结论，因此当前总控不再依赖这份公开探测报告做放行判断

## 失败链

### 1. 17CE 首路径

- 来源：`https://www.17ce.com/`
- 观察：
  - 公开首页可抓取，页面中明确存在 `areas: Chinese mainland`、`GET`、HTTP 检测入口。
  - 首页源码也能确认提交按钮 `#su` 会走 `ajax_check(...)`，页面具备真实提交路径，不是静态占位页。
- 阻塞：
  - 通过 Firecrawl 浏览器交互提交 `https://dlight.cc.cd/` 时，首次返回 `Error: fetch failed`。
  - 同一路径的越权重试返回 `Error: You have reached the maximum number of concurrent jobs (2). Please wait for existing jobs to complete or destroy browser sessions before creating new ones.`
  - 随后尝试停止交互会话，返回 `Error: Browser session not found.`
- 判断：
  - 17CE 首路径在本轮内没有形成目标结果页链接，也没有产出任何大陆节点的 HTTP/HTTPS 可达性数据。

### 2. ITDOG 公开第二路径

- 来源：
  - `https://www.itdog.cn/http/https://dlight.cc.cd/`
  - `https://www.itdog.cn/http/https://dlight.cc.cd/login`
  - `https://www.itdog.cn/http/http://dlight.cc.cd/`
- 观察：
  - 三个直达页都能打开，但返回内容一致为 `Security Verification`，并提示 `Please click in sequence:`
- 阻塞：
  - 未进入目标结果页，未产生任何中国大陆节点响应结果。
- 判断：
  - 作为公开第二路径，ITDOG 在本轮也未给出可引用样本。

## 可引用的最小事实

本轮唯一可稳定复述、且适合给 leader 使用的事实是：

> 我们已经验证 17CE 和 ITDOG 两条公开路径都触达了各自入口，但都没有在本轮产出 `https://dlight.cc.cd/` 或 `/login` 的中国大陆节点 HTTP/HTTPS 结果页样本。

这条事实可以引用为“已尝试的失败链”，不能引用为“中国大陆可达性样本”。

## 给 Leader 的一句判断

这条证据不够继续推进“中国大陆访问验证”；它只能证明本轮公开取证链路没有拿到大陆节点样本，需要后续换一条能稳定产出结果页的大陆探测渠道再推进。
