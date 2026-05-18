# Codex 开发 SOP V3（可执行版）

最后更新：`2026-05-17`

## 目标

这份 `V3` 不是复盘展示稿，而是“拿来就能跑一个功能开发闭环”的操作手册。
它解决 `V2` 仍然存在的几个断点：

- `main` 和 feature session 的切换规则不够硬
- `handoff` 何时写、写什么不够明确
- skill prompt 过短，难以直接复制使用
- 缺少正式的“用户验收”节点
- bug、review、上下文过载后的升级路径不够清楚

## 核心原则

- `main` 只负责总控、计划、集成、收尾，不做功能实现和 debug
- 功能实现只能发生在 feature session / feature worktree 内
- 每次切 session、进入 review、准备合并前都必须更新仓库内 handoff
- 所有“完成”都先经过可复现验证，再经过用户验收
- 标准研发闭环只到仓库内 `docs / handoff / memory` 同步完成

## 主流程图

```mermaid
flowchart TD
    A[需求] --> B{需求是否清楚?}
    B -- 模糊 --> C[brainstorming]
    B -- 清楚 --> D[writing-plans]
    C --> D

    D --> E[计划文件落库]
    E --> F[using-git-worktrees]
    F --> G[切到 feature session]
    G --> H{任务适合并行?}
    H -- 是 --> I[subagent-driven-development]
    H -- 否 --> J[executing-plans]
    I --> K[test-driven-development]
    J --> K

    K --> L{出现 bug / 偏差?}
    L -- 简单 --> M[systematic-debugging]
    L -- 复杂 --> N[dispatching-parallel-agents]
    L -- 无 --> O[verification-before-completion]
    M --> K
    N --> K

    O --> P[requesting-code-review]
    P --> Q[receiving-code-review]
    Q --> R{需要修改?}
    R -- 是 --> S[回 feature session 修复]
    S --> K
    R -- 否 --> T[更新 handoff]
    T --> U[用户验收]
    U --> V{验收通过?}
    V -- 否 --> S
    V -- 是 --> W[切回 main]
    W --> X{main 工作区干净?}
    X -- 否 --> Y[清理或提交 main 既有改动]
    X -- 是 --> Z[finishing-a-development-branch]
    Y --> Z
    Z --> AA[neat-freak]
    AA --> AB[仓库内知识同步完成]
    AB --> AC[完成]
```

## 角色泳道图

读图顺序固定为：先看最左侧 `阶段` 栏，确认当前处于哪个阶段；再横向看这一阶段内各个角色应该做什么、不应该做什么。这样可以同时表达时间切片和责任切片。

```plantuml
@startuml
|阶段|
start
:阶段 1\n需求收敛;

|你|
:提出需求;
:触发 using-superpowers\nprompt: 先按 superpowers 流程来;

|主对话 / 总控会话|
:brainstorming\nprompt: 先帮我收敛设计;
:writing-plans\nprompt: 把需求拆成可执行计划;

|计划 / 交接记录|
:阶段 2\n计划落库;
:Plan File 落库;

|阶段|
:阶段 3\n隔离执行;

|你|
:要求隔离执行\nprompt: 为这个任务创建独立 worktree;

|主对话 / 总控会话|
:using-git-worktrees;

|功能分支会话|
:读取 Plan File;
if (任务适合并行?) then (是)
  :subagent-driven-development\nprompt: 能并行的优先并行开发;
else (否)
  :executing-plans\nprompt: 按计划逐批执行;
endif

|阶段|
:阶段 4\n实现与验证闭环;

repeat
  |功能分支会话|
  :test-driven-development\nprompt: 先写失败测试再实现;

  while (出现 bug / 偏差?) is (是)
    if (问题简单?) then (是)
      :systematic-debugging\nprompt: 先系统排查根因;
    else (否)
      :dispatching-parallel-agents\nprompt: 这几个问题拆开并行调查;
    endif
    :回到实现闭环;
  endwhile (否)

  :verification-before-completion\nprompt: 先跑可复现验证;

  |计划 / 交接记录|
  :阶段交接更新;

  |功能分支会话|
  :requesting-code-review\nprompt: 实现完成后先做代码审查;

  |审查 / 子代理|
  :执行代码审查;
  :返回审查反馈;

  |功能分支会话|
  :receiving-code-review\nprompt: 先验证 review 意见再决定是否修改;
repeat while (Review 后还需修改?) is (是)

|计划 / 交接记录|
:最终交接更新;

|阶段|
:阶段 5\n用户验收;

|你|
:最终验收测试;
if (验收通过?) then (是)
  |主对话 / 总控会话|
  :接管最终交接记录;
  :切回 main;
else (否)
  |功能分支会话|
  :根据验收问题回到 TDD / 验证闭环;
  :test-driven-development\nprompt: 针对验收问题补测试再修复;
  :verification-before-completion\nprompt: 重新跑可复现验证;

  |计划 / 交接记录|
  :补充验收问题交接记录;

  |你|
  stop
endif

|阶段|
:阶段 6\n集成收尾;

|主对话 / 总控会话|
:读取最终 Handoff;
:finishing-a-development-branch\nprompt: 这条开发分支做完了;

|主仓库 main 分支|
if (main 工作区干净?) then (是)
  :merge / push;
else (否)
  :清理或提交 main 既有改动;
  :merge / push;
endif

|主对话 / 总控会话|
:neat-freak\nprompt: 这个阶段做完了，同步 docs 和记忆;

|计划 / 交接记录|
:仓库内知识同步完成;

|你|
:开发闭环完成;
stop
@enduml
```

## 阶段 × 角色矩阵

这张图只负责表达“当前阶段”和“角色责任边界”，不承载完整技能细节。
图内保持短句，完整 prompt、触发时机、验证命令和收尾规则继续由 `14 Skills 操作表` 和 `硬规则表` 承接。

| 阶段 | 你 | 主对话 / 总控会话 | 计划 / 交接记录 | 功能分支会话 | 审查 / 子代理 | 主仓库 main 分支 |
|---|---|---|---|---|---|---|
| 需求收敛 | 提出需求 | `using-superpowers` / `brainstorming` |  |  |  |  |
| 计划落库 | 确认计划 | `writing-plans` | 落 Plan File |  |  |  |
| 隔离执行 | 要求独立 worktree | `using-git-worktrees` |  | 读 Plan File |  |  |
| 实现与验证闭环 |  |  | 阶段交接更新 | `TDD` / `debug` / `verify` / `review` | 只做 review |  |
| 用户验收 | 最终验收测试 | 验收通过后接管最终交接 | 验收问题交接 | 回 `TDD` / 验证闭环 |  |  |
| 集成收尾 | 确认闭环完成 | `finishing-a-development-branch` / `neat-freak` | 仓库内知识同步完成 |  |  | 检查干净 / `merge` / `push` |

## Subagent-Driven Development 子流程图

当 `任务适合并行? -> 是` 时，主图只给出入口。这里单独展开它的内部机制：控制器分发任务，实现 subagent 负责实现与自测，spec reviewer 先查“是否符合计划”，code quality reviewer 再查“实现质量是否达标”。任何一层不过，都回 implementer 修复，直到单个 task 完成；全部 task 完成后，才返回主流程进入分支收尾。

```mermaid
flowchart TD
    A[读取 Plan File 与任务清单] --> B{还有未完成 Task?}
    B -- 否 --> K[发起最终 Code Review]
    K --> L[返回主流程
finishing-a-development-branch]
    B -- 是 --> C[分发当前 Task 给实现 Subagent]
    C --> D{实现 Subagent 先提问?}
    D -- 是 --> E[控制器补充上下文 / 回答问题]
    E --> C
    D -- 否 --> F[实现 / 测试 / 自检 / 提交]
    F --> G[发起 Spec Review]
    G --> H{Spec 符合计划?}
    H -- 否 --> I[实现 Subagent 修复 spec gap]
    I --> G
    H -- 是 --> J[发起 Code Quality Review]
    J --> M{代码质量通过?}
    M -- 否 --> N[实现 Subagent 修复质量问题]
    N --> J
    M -- 是 --> O[标记 Task 完成]
    O --> B
```

这张子图回答的是“并行开发模式内部怎么运转”，不替代主流程图和主泳道图。

## 时序图

```mermaid
sequenceDiagram
    actor User as 你
    participant Main as 主对话 / 总控会话
    participant Plan as Plan File
    participant Feature as 功能分支会话
    participant Review as 审查 / 子代理
    participant Handoff as Handoff File
    participant MainWS as 主仓库 main 分支

    你->>Main: 提出需求
    Main->>Main: brainstorming / writing-plans
    Main->>Plan: 写入实现计划
    Main->>Main: using-git-worktrees
    Main->>Feature: 移交计划并切换执行

    Feature->>Plan: 读取计划
    Feature->>Feature: executing-plans / TDD

    loop 实现 / debug / 修复
        Feature->>Feature: 编码、自测、修 bug
        Feature->>Handoff: 阶段交接更新
    end

    Feature->>Review: 请求 code review
    Review-->>Feature: 返回 review 反馈

    alt 还需修改
        Feature->>Feature: 回到 TDD / 验证闭环
    else 已通过 review
        Feature->>Handoff: 写入最终状态
        Feature-->>User: 请求最终验收
    end

    alt 验收不通过
        User-->>Feature: 返回问题，继续修复
        Feature->>Handoff: 补充验收问题交接记录
    else 验收通过
        User-->>Main: 允许进入集成收尾
    end

    Main->>Handoff: 读取最终状态
    Main->>MainWS: 检查是否干净，执行 merge / push
    Main->>Main: neat-freak 同步 docs / handoff / memory
    Main-->>User: 返回最终结果
```

## 14 Skills 操作表

| Skill | 触发时机 | 由谁触发 | 可复制 Prompt | 预期输出物 |
|---|---|---|---|---|
| `using-superpowers` | 任务刚开始 | 你 / 主对话 | `先按 superpowers 流程来` | 明确需要哪些 skills |
| `brainstorming` | 需求模糊、边界未清 | 你 / 主对话 | `这个需求还比较模糊，先帮我收敛设计` | 需求澄清、方案收敛 |
| `writing-plans` | 需求已清楚，需要计划 | 主对话 | `把需求拆成可执行计划，保存为计划文件` | `docs/plans/...md` |
| `using-git-worktrees` | 准备进入实现 | 主对话 | `为这个任务创建独立 worktree` | feature worktree / feature branch |
| `subagent-driven-development` | 任务可并行，留在当前会话执行 | 主对话 | `能并行的部分优先并行开发` | 并行任务执行与 review loop |
| `executing-plans` | 任务不适合并行，按计划逐批执行 | 功能分支会话 | `按计划逐批执行，不要跳步骤` | 批次化实现结果 |
| `test-driven-development` | 任一功能实现或修 bug 前 | 功能分支会话 | `每个功能都先写失败测试再实现` | failing test -> passing test |
| `systematic-debugging` | 简单 bug / 单点异常 | 功能分支会话 | `这个 bug 先系统排查根因` | 根因定位与修复路径 |
| `dispatching-parallel-agents` | 多个独立问题并行排查 | 功能分支会话 | `这几个问题拆开并行调查` | 并行调查结果 |
| `verification-before-completion` | 宣布完成前 | 功能分支会话 | `先跑可复现验证，再说完成` | 验证命令与输出 |
| `requesting-code-review` | 本地验证后 | 功能分支会话 | `实现完成后先做代码审查` | review findings |
| `receiving-code-review` | 收到 review 后 | 功能分支会话 | `先验证 review 意见，再决定是否修改` | 修复或有理有据的回绝 |
| `finishing-a-development-branch` | 验收通过，准备集成 | 主对话 | `这条开发分支做完了，进入收尾` | merge / PR / 保留分支决策 |
| `neat-freak` | merge / push 后 | 主对话 | `这个阶段做完了，同步 docs 和记忆` | 更新后的 `README / docs / AGENTS / handoff` |

## 硬规则表

### 1. 会话切换规则

- `writing-plans` 完成并落库后，必须离开 `main` 进入 feature session
- 进入 feature session 后，功能性反馈、bug、截图、报错都只在 feature session 里处理
- `main` 只允许处理：计划调整、阶段状态、最终集成、最终收尾
- 只有在“用户验收通过”后，才允许切回 `main`

### 2. Handoff 规则

必须写 handoff 的时机：

- 准备切新 session 前
- 请求 code review 前
- 用户验收前
- 准备 merge 前
- 上下文接近耗尽时

最少字段模板：

```md
当前目标：
当前分支 / worktree / session：
已完成：
未完成：
已知问题：
下一条验证命令：
```

### 3. 用户验收规则

- code review 通过不等于开发完成
- 只有用户执行最终验收后，才能进入 `finishing-a-development-branch`
- 验收失败时，直接回 feature session 修复，不回 `main`

### 4. 失败升级路径

- 单点 bug：`systematic-debugging`
- 多点独立问题：`dispatching-parallel-agents`
- review 提出修改：回 feature session -> 重新验证 -> 必要时二次 review
- session 上下文将耗尽：先写 handoff，再切新 session
- 如果发现计划本身有缺口：停止执行，回到 `brainstorming / writing-plans`

### 5. 推荐验证命令

主仓构建验证：

```bash
npm run build
```

主仓类型验证：

```bash
npm run build
npm run typecheck
```

主仓测试验证：

```bash
npx vitest run --dir tests
```
