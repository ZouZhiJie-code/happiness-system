# GI-088 v6｜单一回答焦点候选静态验证

验证日期：`2026-08-09`

状态：`本地候选与私有 Preview 验证通过；真人批次 2/4 提前结束并确认单一回答焦点通过`

## 1. 指纹检查

`npm run eval:gi088:inspect` 已通过：

- 评测版本：`2026-08-09.gi088-human-eval-v6-single-focus`；
- Effective candidate：`4cd9f6202778a0b1f6c18ed56e6869f78f3fdde8350afd689a08b9fabe3fb0ee`；
- 数据集指纹：`91b62d9124f8ff351a76d1b0e7fdc1da8d1818952d1779da93e2015f10b70aea`；
- 执行指纹：`a5042e9700f09b7d9d5a9746e87091e9ed8b4cc0cee4e7741435ce7badfc094d`；
- `branchOrder=[high]`、`taskCount=4`、单轨迹上限 `12`、整批最坏调用 `48`、`modelGenerationCalls=0`。

## 2. 当前自动验证

- Board 7B 工作协议与运行器、单一回答焦点、阶段转场、两类探针、GI-088 Service、Workbench、OpenAI Provider：`10` 个文件，`152/152` 通过；
- `npm run typecheck` 通过；
- v6 相关服务、API、客户端、页面、脚本与测试 ESLint 通过；
- Prisma schema、Next.js production build、manifest JSON 解析和差异检查通过；构建只包含仓库其他模块已有 warning。

## 3. 已覆盖的不变量

1. 同一焦点的零个、两个或三个问号可以正常提交，问号数量不会触发第二次 Provider 调用。
2. 所有 ask 保存问号数量、回答目标和复核候选；结束轨迹前必须完成人工分类。
3. 程序不把两个独立问题伪装成已完成语义判断，最终质量分类由真人复核写入 Trace。
4. 缺少 `nextInquiry`、回答机会越界、阶段、来源、非 ask 问句和状态错误继续拦截。
5. v6 不创建单问号恢复；历史 v5 错误和恢复 Trace 继续可读。
6. EMPTY_CONTENT、TIMEOUT 与阶段转场恢复继续继承，并共享每个用户提交两次调用上限。
7. 每条轨迹最多十二次 Provider 调用；到达上限后停止生成，同时允许复核和结束。
8. 页面保留 `aria-busy`、持续行内状态、可访问人工分类和完整 Trace；Toast 不承担唯一信息来源。
9. 隐藏推理正文继续不读取、不保存、不展示。
10. Production 继续保持 `legacy + baseline`。

## 4. Preview 回读

- deployment `dpl_5Rq7gTnovApDY97b4pg8k7YJf33r` 状态为 `READY`；
- 固定入口为 `https://xingfuxitong-gi088-v6-single-focus.vercel.app/preview/gi088-evaluation`；
- 专用评测库批次 `37517d91-a258-423a-bb26-a58c97357e68` 为 `high_only`、`0/4`，活动分支只有 `high`；
- 评测版本、执行指纹和任务数回读一致，创建批次模型调用为 `0`；
- Preview 未登录 session 返回 `401`，登录页完整保留评测回跳地址；
- Production 页面与 session API 均返回 `404`。

## 5. 真人结果

- A1、A2 已完成，A3、A4 为 `not_run`；批次以 `2/4 early_stopped` 收口；
- 11 条可见 ask 全部完成人工分类：`9` 条同一焦点自然可答、`2` 条同一焦点表达偏重、`0` 条独立多任务；
- 产品负责人确认原有问题解决，v6 主要因素通过；
- `17` 次调用中 `EMPTY_CONTENT=0`，一次正文停滞超时自动恢复成功；
- A1 最终一次旧状态合同失败与深聊连续性问题转入 v7，v6 保持只读。

## 6. 下一步

进入 v7 连续性底座两条 Thinking high 真人验收。模型调用继续只由产品负责人在评测页面提交真实内容触发。
