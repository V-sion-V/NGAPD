# Agent 上下文原型：工作流回顾

- 报告类型：`最佳实践记录`
- 工作流 schema：`3.2`
- 原始需求：[`requirements.md`](requirements.md)
- 初始路线图：[`implementation-plan.md`](implementation-plan.md)
- 执行证据范围：[`execution/initial/execution-state.md`](execution/initial/execution-state.md)、[`execution/initial/phase-001-plan.md`](execution/initial/phase-001-plan.md)–[`execution/initial/phase-002-result.md`](execution/initial/phase-002-result.md)
- 修改记录范围：[`change-0.md`](change-0.md)–[`change-0.md`](change-0.md)
- 当前有效需求：[`effective-requirements.md`](effective-requirements.md)
- 生成日期：2026-07-26

## 1. 结论

本 schema 3.2 工作流通过完成门禁。唯一 initial run、P-001/P-002 两个阶段和 3 个任务均已完成；`change-0.md` 连续匹配 completed initial run，有效需求完整重建原始 36 个 `FR-*` 与 23 个 `AC-*`。需求、路线图、阶段计划、不可变结果、执行状态、最终记录和有效快照描述同一功能，没有未匹配运行、未决问题、开放 finding、活动进程、半完成实现、外部写入或未知恢复状态。

报告分支为“最佳实践记录”：不存在后续 `RC-*`，因而没有主分类 B 的修正项，也没有需求变化或修正轮次。P-001 的格式门禁和沙箱宿主限制、P-002 的精确 Node/pnpm 启动器恢复都没有改变 Agent Context 产品行为、验收层级、阶段边界或生产授权。

| 指标 | 结果 |
| --- | --- |
| 工作流制品 | 11 个，含本报告 |
| 执行运行 | 1 个 initial run；change run 0 个 |
| 阶段 | 计划 2 个、完成 2 个、纠正阶段 0 个 |
| 任务 | 计划 3 个、完成 3 个 |
| 修改记录 | 1 个，连续范围 `change-0`–`change-0` |
| 原始需求与验收 | `FR-*` 36/36；`AC-*` 23/23，其中 core 21、supplemental 2 |
| 当前有效需求 | 36 个 `FR-*` 与 23 个 `AC-*`，和原始基线一致；无退役项 |
| 需求变更 | `RC-*` 0；主分类 A 0、B 0；意图变更轮次 0、修正轮次 0 |
| 交付策略 | strict 运行 0；relaxed 运行 1 |
| 验证结论 | `passed` 1；`passed_with_findings` 0 |
| finding | open 0、closed 0；没有正式 `FND-*` |
| 保留文件变化 | 20 个唯一文件；不含实施前已存在且未修改的注入夹具 |
| 计划修订 | 路线图修订 0 次；阶段计划修订 0 次；两份计划均冻结于 revision 1 |
| 中断与恢复 | paused 0、blocked 0、任务中断恢复 0；P-001 后有 1 段合规的 `awaiting_next_phase` 外部等待 |

最高优先级结论：本流程用版本化纯输入/输出、manifest 与正文分离、逐次重新授权和逐字段授权对照证明安全边界，并把 Windows 兼容作为真实外部门禁，而没有让模型理解、提示文本或平台模拟成为权限或验收依据。

## 2. 工作流时间线、阶段与结果

| 时间/步骤 | 运行、阶段或任务 | 关键证据 | 结果 |
| --- | --- | --- | --- |
| 2026-07-25 需求澄清 | 原始需求 | [`requirements.md`](requirements.md) 固定 36 个 `FR-*`、23 个分级 `AC-*`、来源/预算/授权边界、`relaxed` 策略和零未决问题 | 需求可独立规划 |
| 2026-07-25 初始审计与路线图 | initial / P-001–P-002 | [`implementation-plan.md`](implementation-plan.md) 采用 phased + compact revision 1；macOS/Node 主体可独立交付，Windows 是唯一外部交接 | P-001 ready，P-002 禁止提前创建空壳计划 |
| 2026-07-25 核心与自动化 | P-001-T-001 | [`phase-001-plan.md`](execution/initial/phase-001-plan.md) revision 1 | 确定性发现、排序、预算、分页、渐进读取、摘要、Skill、注入和结构化分析；专项测试 25/25 |
| 2026-07-25 macOS/Node 主体 | P-001-T-002 | macOS [`主体结果`](../../../prototypes/agent-context/results/2026-07-25-macos-node24.md)、runner 和 [`phase-001-result.md`](execution/initial/phase-001-result.md) | 12/12 core、三档 P95、共享包与根门禁 `completed/passed` |
| 2026-07-25 至 2026-07-26 安全等待 | initial / `awaiting_next_phase` | P-001 结果冻结；Task UI、Workspace Sync 与真实 Windows 入口未全部满足时不创建 P-002 计划 | 外部前置满足前不生成最终记录，不构成 pause、blocked 或 finding |
| 2026-07-26 Windows 即时规划 | P-002 | [`phase-002-plan.md`](execution/initial/phase-002-plan.md) revision 1；17/17 环境、Git、指纹、主体与夹具前置可验证 | 单个 compact 任务覆盖 Windows core 与最终封存前检查 |
| 2026-07-26 Windows/Node 主体 | P-002-T-001 | Windows [`主体结果`](../../../prototypes/agent-context/results/2026-07-26-windows-x64-node24.md) 与 [`phase-002-result.md`](execution/initial/phase-002-result.md) | 同一夹具 12/12 core、三档 P95、根门禁、范围与追踪 `completed/passed` |
| 2026-07-26 initial finalization | initial | [`change-0.md`](change-0.md)、[`effective-requirements.md`](effective-requirements.md) 与 completed [`execution-state.md`](execution/initial/execution-state.md) | 首次历史冻结，当前有效需求建立 |

路线图和两份阶段计划都只有 revision 1。P-002 是在 P-001 不可变结果、另外两个原型主体和真实 Windows 入口满足后进行的正常滚动规划，不是返工。规划基线从 `bcae1aa...` 前移到用户已提交的 `cad7359...` 时，工作流重新检查了指纹和文件所有权；Agent Context 自有目标没有重叠，因此吸收基线而不修订需求或路线图。

## 3. 需求变更分类

没有 `change-1` 或后续记录，也没有任何 `RC-*` 行，因此不存在需要归入 A 或 B 的需求变化。

| 变更项 | 修改记录 | 关联原始需求 | 主分类 | 次要因素 | 严重程度 | 核心依据 | 置信度 |
| --- | --- | --- | --- | --- | --- | --- | --- |

分类统计：

- A“与原始需求文档冲突，为用户自己的修改”：0。
- B“实际上为对原始需求的补充或修正”：0。
- A 次要因素：0；B 次要因素：0。
- 严重程度低/中/高：均为 0。
- 意图变更轮次：0；修正轮次：0。

项目/任务优先级、预算不足、游标漂移、重新授权和提示注入都在原始需求中已有确定语义。实施中的 `.vscode` 纯格式调整、沙箱权限切换与 Windows 启动器路径恢复只用于执行既定门禁，不改变 `FR-*`、`AC-*` 或用户决策，因而不应记录为产品增量。

## 4. 执行可恢复性与阶段质量

### 4.1 比例性

- 两阶段有明确边界：P-001 交付完整、可构建、可独立验证的 macOS/Node 主体；P-002 必须等待三个原型主体和真实 Windows/Node 入口，是需求明确的外部交接与最终兼容门禁。
- compact 细节合理：核心使用版本化纯输入/输出和内存合成数据，没有 migration、生产写入、不可逆数据、公共 API 过渡、二进制产物或困难恢复。
- 三个任务分别拥有核心/自动化、macOS 主体/根门禁和 Windows 主体/最终封存；没有把实现、测试、性能、文档或 finalization 机械拆成额外阶段。
- relaxed 策略执行正确：21 个 core 和 2 个 supplemental 全部通过；没有人为制造 red-first 基线，也没有在失败后改变验收层级。
- 验证复验有失效或环境原因：格式文件修正使根格式证据失效，真实 macOS Keychain 与 Windows 精确 Node 入口要求在相应宿主环境重跑；没有无中间变化的重复全套验证。

### 4.2 检查点与恢复完整性

| 项目 | 观察 |
| --- | --- |
| 项目基线 | P-001 起点 `cad7359...`、P-002 起点 `849bd2d...`、Node/pnpm/平台在计划、状态和结果中一致 |
| 需求与计划指纹 | requirements、roadmap、P-001/P-002 plan/result 的 SHA-256 与 execution state 一致 |
| 用户工作保护 | Task UI 共享改动在规划和任务前检查点中被识别；Agent Context 通过独立模块和未占用导出避免重叠 |
| 沙箱/启动器恢复 | IPC、Keychain 和 Windows `.bin` 搜索问题都有明确失败位置；在产品加载前或合适宿主环境从验证起点重跑 |
| 外部等待 | P-001 后保持 `awaiting_next_phase`，没有提前创建 Windows 结果、change-0 或有效快照 |
| 暂停或阻塞 | 0；没有任务在部分 manifest、授权或产品状态未知时结束 |
| 最终清理 | 无活动进程、临时业务状态、真实 Workspace、数据库、Web、管理员模式、写租约或外部发送 |
| 完成后恢复语义 | completed state 禁止 resume 重写历史；后续行为变化必须从 `change-1` 开始 |

所有执行偏差都发生在确定性 runner 外围，并且没有留下半完成产品状态。P-001/P-002 都以可构建、无外部状态的边界退出；恢复设计与 compact、纯函数原型的实际风险匹配。

## 5. 最终交付与验证证据

### 5.1 需求和验收覆盖

| 覆盖组 | 实现证据 | 验证证据 | 结论 |
| --- | --- | --- | --- |
| `FR-001`–`FR-018` | 版本化 fixture、来源发现、关系/跨用户边界、摘要与 Skill | 确定性、冲突优先级、一跳关注、跨用户拒绝/显式只读和摘要来源场景 | pass |
| `FR-019`–`FR-024` | manifest、稳定排序、预算与绑定游标 | 分页等价/漂移、预算不足、整项裁剪、稳定原因与正文隔离 | pass |
| `FR-025`–`FR-030` | 逐次重新授权读取、信任分隔和参考消费者 | 未选/失效/拒绝读取、注入前后授权逐字段对照、完整/不可完成分析 | pass |
| `FR-031`, `FR-032` | 无正式入口/生产授权变更；共享 fixture 独立模块 | 范围、秘密、Task UI/Workspace Sync 兼容和根 workspace 门禁 | pass |
| `FR-033`, `FR-034`, `FR-036`; `AC-017`, `AC-020` | 无头 runner、P95 与 macOS 结果 | macOS 12/12 core、三规模性能、结果字段和根门禁 | pass |
| `FR-035`; `AC-021` | Windows 结果与最终封存证据 | Windows 同 fixture 12/12 core、三规模性能、漂移与完整追踪 | pass |
| `AC-022`, `AC-023` supplemental | 附加规模、分页和规范化诊断 | 三 profile、page size 3/4、稳定 sortKey/reason/cursor 输出 | pass |

### 5.2 观察到的最终验证

- macOS/Node runner：12/12 core；预算 6000、必需 3050、选用 5810、剩余 190；28 个诊断条目，授权保持只读、无 admin/lease。
- macOS manifest-only 性能重复 80 次/规模：deep-tree、wide-siblings、dense-dag P95 分别为 0.420/0.852/0.343 ms，均远低于 1000 ms。
- Windows/Node runner 使用同一 `agent-context-v1`：12/12 core；预算、分页、授权、摘要、Skill、注入和结构化分析与 macOS 逐字段语义一致。
- Windows manifest-only P95 分别为 0.575/1.319/0.580 ms，最大值均低于 2 ms。
- `@ngapd/test-fixtures` 25 项 Agent Context 专项测试和 5 files/37 tests 全部通过；两平台最终根 `pnpm check` 均通过格式、lint、10 个 workspace build/typecheck 和全部适用测试。
- 提示注入前后授权固定为 `readScope=selected_sources`、`writeScope=none`、`adminMode=false`、`lease=false`、`requiresConfirmation=true`；原型没有读取真实业务内容或调用外部 API/AI/LLM。

### 5.3 制品与文件一致性

- `change-0.md` 记录 20 个唯一保留文件：10 个工作流制品、3 个共享源码/导出文件、6 个原型/结果文件和 1 个 format-only 用户设置文件；实施前已存在且未修改的 `workspace-injection.md` 不重复计入。
- requirements SHA-256 `569d2e65...524a`、roadmap SHA-256 `e658381e...c339` 与 execution state 匹配；P-001/P-002 plan/result revision 和指纹一致。
- 有效快照包含连续 `FR-001`–`FR-036` 和 `AC-001`–`AC-023`；21 个 core、2 个 supplemental 全部 passed，来源均回到原始需求。
- feature 目录只有连续 `change-0.md` 和一个 completed initial run；没有未匹配的 active、paused、blocked、awaiting 或 abandoned run。

## 6. 开放发现项与可选后续

当前没有正式 `FND-I-*` 或 `FND-C<N>-*`，也没有 report-only finding。状态中的 `FND-I-001` 只是“下一可用编号”，不是开放发现项或继续执行 ID。

| ID | 类别 | 严重程度 | 关联需求/验收 | 观察与证据 | 最终功能影响 | 处置 | 置信度 | 建议后续 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |

本报告不建议创建无依据的原型后续任务。若未来工作流出现正式 `FND-*`，明确指定该稳定 ID 是请求可选后续、保持证据连续性的方式。

## 7. 最佳实践记录

本流程可复用的做法：

1. 把上下文清单、正文读取、授权快照和参考消费者做成版本化纯输入/输出，使确定性、分页、漂移失效和恢复都可逐字段验证。
2. 将来源内容视为非可信数据；工具授权只依赖结构化 actor、意图和底层事实，并用注入前后授权对照证明内容不能扩权。
3. 在预算不足时拒绝生成伪完整 manifest 或分析，而不是截断安全规则；可选来源按固定顺序整项选择并记录稳定排除原因。
4. 用当前平台先交付完整主体，再以不可变结果安全等待真实 Windows 外部门禁；不使用模拟结果、空壳计划或 retrospective testimony 补证。
5. 对并行用户工作使用文件级所有权和漂移检查；环境/启动器问题只在证据层恢复，不扩大到生产授权、正式 API、数据库或 Web。

本工作流没有后续编号变更。全部技术恢复都发生在原始验收和执行环境范围内，因此没有需求波动或修正轮次需要归因。
