# 平铺树状 Task UI 原型：工作流回顾

- 报告类型：`最佳实践记录`
- 工作流 schema：`3.2`
- 原始需求：[`requirements.md`](requirements.md)
- 初始路线图：[`implementation-plan.md`](implementation-plan.md)
- 执行证据范围：[`execution/initial/execution-state.md`](execution/initial/execution-state.md)、[`execution/initial/phase-001-plan.md`](execution/initial/phase-001-plan.md)–[`execution/initial/phase-002-result.md`](execution/initial/phase-002-result.md)
- 修改记录范围：[`change-0.md`](change-0.md)–[`change-0.md`](change-0.md)
- 当前有效需求：[`effective-requirements.md`](effective-requirements.md)
- 生成日期：2026-07-26

## 1. 结论

本 schema 3.2 工作流通过完成门禁。唯一 initial run、P-001/P-002 两个阶段和 5 个任务均已完成；`change-0.md` 连续匹配 completed initial run，有效需求完整重建原始 28 个 `FR-*` 与 22 个 `AC-*`。需求、路线图、阶段计划、不可变结果、执行状态、最终记录和有效快照描述同一功能，没有未匹配运行、未决产品问题、开放 finding、活动服务、半完成实现或未知恢复状态。

报告分支为“最佳实践记录”：不存在后续 `RC-*`，因而没有主分类 B 的修正项，也没有需求变化或修正轮次。P-001 的布局、搜索和测试同步修正以及 P-002 的跨平台测试前置、Chrome 性能测量修正均在原始阶段所有权和既定验收内闭环，没有改变产品需求、验收层级或阶段边界。

| 指标 | 结果 |
| --- | --- |
| 工作流制品 | 11 个，含本报告 |
| 执行运行 | 1 个 initial run；change run 0 个 |
| 阶段 | 计划 2 个、完成 2 个、纠正阶段 0 个 |
| 任务 | 计划 5 个、完成 5 个 |
| 修改记录 | 1 个，连续范围 `change-0`–`change-0` |
| 原始需求与验收 | `FR-*` 28/28；`AC-*` 22/22，其中 core 19、supplemental 3 |
| 当前有效需求 | 28 个 `FR-*` 与 22 个 `AC-*`，和原始基线一致；无退役项 |
| 需求变更 | `RC-*` 0；主分类 A 0、B 0；意图变更轮次 0、修正轮次 0 |
| 交付策略 | strict 运行 0；relaxed 运行 1 |
| 验证结论 | `passed` 1；`passed_with_findings` 0 |
| finding | open 0、closed 0；没有正式 `FND-*` |
| 保留文件变化 | 47 个唯一文件；不含并行 Agent Context 工件和未跟踪 Vite 日志 |
| 计划修订 | 路线图修订 0 次；阶段计划修订 1 次，P-001 冻结于 revision 2 |
| 中断与恢复 | paused 0、blocked 1、任务中断恢复 1；纠正阶段 0 |

最高优先级结论：流程在保持 compact 计划的同时，把 macOS 主体与必须等待真实 Windows/Agent Context 入口的最终门禁分开；Chrome 控制阻塞发生时没有生成半成品结果，恢复后从同一任务继续，证明外部交接和恢复边界有效。

## 2. 工作流时间线、阶段与结果

| 时间/步骤 | 运行、阶段或任务 | 关键证据 | 结果 |
| --- | --- | --- | --- |
| 2026-07-25 需求澄清 | 原始需求 | [`requirements.md`](requirements.md) 固定 28 个 `FR-*`、22 个分级 `AC-*`、单 DAG/抽屉交互、`relaxed` 策略和平台顺序 | 需求可独立规划 |
| 2026-07-25 初始审计与路线图 | initial / P-001–P-002 | [`implementation-plan.md`](implementation-plan.md) 采用 phased + compact revision 1；macOS 主体可独立交付，Windows 是唯一外部交接 | P-001 ready，P-002 禁止提前创建空壳计划 |
| 2026-07-25 fixture 与 Web 实现 | P-001-T-001/T-002 | [`phase-001-plan.md`](execution/initial/phase-001-plan.md) revision 1 | 三 profile、局部 DAG、抽屉、下降、搜索/筛选、键盘和隔离入口完成 |
| 2026-07-25 macOS 主体与门禁 | P-001-T-003 | macOS [`主体结果`](../../../prototypes/task-ui/results/2026-07-25-macos-m2-chromium.md) 与根门禁暴露布局、搜索和 MCP 测试就绪问题 | 既定范围内修正；阶段计划升至 revision 2，随后 [`phase-001-result.md`](execution/initial/phase-001-result.md) `completed/passed` |
| 2026-07-26 Windows 即时规划 | P-002 | [`phase-002-plan.md`](execution/initial/phase-002-plan.md) revision 1；Agent Context 主体、Windows x64/NTFS/Node/Chrome 前置可验证 | 两个 compact 任务覆盖共享工程前置和真实浏览器主体 |
| 2026-07-26 Windows 测试前置 | P-002-T-001 | 将三个 Workspace CLI 测试文件改为平台安全临时目录、Windows signal 观察和明确 macOS/APFS 守卫 | 16/16 适用 CLI 测试、Task graph 7/7、Web 5/5 通过；产品行为未变 |
| 2026-07-26 外部阻塞与恢复 | P-002-T-002 | Chrome extension 前两次不可选择；state 与 [`phase-002-result.md`](execution/initial/phase-002-result.md) 记录停止 Vite/Chrome、无半成品证据，用户侧恢复后继续原任务 | blocked 1 次；恢复 1 次；没有重跑已有效的 T-001 |
| 2026-07-26 Windows Chrome 主体 | P-002-T-002 | Windows [`主体结果`](../../../prototypes/task-ui/results/2026-07-26-windows-x64-chromium.md)、11 张截图、指标与双入口日志 | 三 profile、200 节点、性能、键盘、刷新、网络和兼容 `pass` |
| 2026-07-26 initial finalization | initial | [`change-0.md`](change-0.md)、[`effective-requirements.md`](effective-requirements.md) 与 completed [`execution-state.md`](execution/initial/execution-state.md) | 首次历史冻结，当前有效需求建立 |

路线图只有 revision 1。P-001 阶段计划从 revision 1 升至 revision 2，只为最终根门禁暴露的 MCP 服务就绪测试竞态增加确定同步；修订发生在结果冻结前，未改变 Task UI、Workspace CLI 产品行为或需求追踪。P-002 计划 revision 1 是正常滚动规划，不是返工。

执行状态最终门禁保留一条“P-002 result 已生成而 change-0/effective snapshot 尚未创建”的勾选行；它记录 finalization 前的顺序检查点。其后的 finalization checkpoint、实际 `change-0.md`/`effective-requirements.md`、对应指纹和最终 completed/passed 字段明确给出终态，因此该历史表述不代表当前缺口，也不应通过改写冻结 state 消除。

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

P-001/P-002 中的搜索旧值、布局、测试同步、Windows 测试假设和性能测量问题都属于实现原始 `FR-*`/`AC-*` 时的技术反馈。它们没有改变单 DAG、抽屉、专用下降、性能门槛、平台主体或可选 supplemental 的含义，因而不应记录为产品增量。

## 4. 执行可恢复性与阶段质量

### 4.1 比例性

- 两阶段有明确边界：P-001 在 macOS 交付完整、可构建、可独立验收的原型；P-002 必须等待 Agent Context 主体和真实 Windows Chrome，是需求明确的外部交接与最终兼容门禁。
- compact 细节合理：原型没有 migration、不可逆数据、公共 API 过渡、多 writer 或用户内容恢复风险；任务表、目标文件、验证和完成条件足以安全执行。
- 任务按确定性 fixture、Web 交互、平台主体和共享前置划分，没有把实现、自动化、截图、文档或 finalization 机械拆成阶段。
- relaxed 策略执行正确：19 个 core 全部通过；`AC-020`/`AC-021` 从需求起就是 optional supplemental，未运行且未观察异常，不需要伪造 finding；`AC-022` 已通过。
- 验证复验有失效原因：布局/搜索/测量实现修改会使相关浏览器证据失效，MCP 测试同步和 Windows 测试前置会使共享根门禁失效；每次复验都发生在相应修改后。

### 4.2 检查点与恢复完整性

| 项目 | 观察 |
| --- | --- |
| 项目基线 | P-001 起点 `bcae1aa...`、P-002 起点 `a3044bf...`、Node/pnpm/浏览器/平台在计划、状态和结果中一致 |
| 需求与计划指纹 | requirements、roadmap、P-001 revision 2、P-002 revision 1 和两份 result 指纹与 state 一致 |
| 并行工作保护 | Agent Context 工件在 P-001/P-002 漂移审查中被识别为非重叠工作，没有计入 Task UI 文件或结果 |
| 阻塞检查点 | Chrome 入口不可用时停止服务和浏览器，不创建 Windows 结果、指标或截图；阻塞原因和恢复入口明确 |
| 恢复执行 | extension 恢复后从 P-002-T-002 继续，未重复 T-001，也未改写 P-001 结果 |
| 最终清理 | Vite 停止、5173 无监听、视口恢复、标签页关闭；没有数据库/API/Workspace/身份写入或秘密 |
| 完成后恢复语义 | completed state 禁止 resume 重写历史；后续行为变化必须从 `change-1` 开始 |

唯一实际 blocked 事件得到可验证恢复，没有未知浏览器状态、活动服务或半成品证据。P-001/P-002 都以可构建状态退出，恢复粒度与 compact 计划及外部入口风险匹配。

## 5. 最终交付与验证证据

### 5.1 需求和验收覆盖

| 覆盖组 | 实现证据 | 验证证据 | 结论 |
| --- | --- | --- | --- |
| `FR-003`–`FR-005`, `FR-024`, `FR-025` | `@ngapd/test-fixtures` 三 profile、索引、局部 DAG 与负向校验 | 确定性、计数、字段、孤立节点、重复/跨层/自环/环拒绝测试 | pass |
| `FR-001`, `FR-002`, `FR-006`–`FR-023`, `FR-026` | 隔离 Web 入口、有限 DAG、抽屉、直接子任务、搜索/筛选、层级快照和键盘 | Web 5/5、双入口、网络隔离、真实浏览器交互与截图 | pass |
| `FR-027`; `AC-014`, `AC-018` | macOS Chromium 主体 | deep/wide/dense、8 层往返、200 节点、P95、焦点与非颜色状态 | pass |
| `FR-028`; `AC-019` | Windows Chrome 主体和共享跨平台测试前置 | Windows 三 profile、连续滚动、刷新、性能、普通入口及最终根门禁 | pass |
| `AC-020`–`AC-022` supplemental | 扩展规模、附加浏览器和诊断证据 | `AC-020/021` optional/not run；`AC-022` 由 18 张跨平台截图、指标和日志通过 | pass under relaxed policy |

### 5.2 观察到的最终验证

- macOS Chromium 主体：`deep-tree` 8 层往返，`wide-siblings` 200 节点/300 边，`dense-dag` 36 节点/48 边；搜索、筛选、抽屉、键盘、焦点、非颜色和双入口通过。
- macOS 暖缓存：TTI 70.0 ms；选择/搜索/筛选/下降/返回 P95 为 59.9/61.4/63.9/65.2/13.8 ms，全部低于要求。
- Windows Chrome 主体：相同三 profile、200 节点连续滚动、五类 AND、关系/孤立节点、刷新、键盘和普通 Workspace access 兼容通过。
- Windows 暖缓存：TTI 151.4 ms；选择/搜索/筛选/下降/返回 P95 为 88.5/100.7/106.7/93.5/11.1 ms，全部低于 200 ms。
- 最终 `pnpm check` 在 Node `24.18.0` / pnpm `11.9.0` 下通过 Prettier、ESLint、10 个适用 workspace build/typecheck 和全部适用测试。
- `git diff --check`、范围、秘密与外部副作用审查通过；Task UI 不读取真实数据，不调用 Task API/外部服务，不修改服务端 Task、身份或 Workspace。

### 5.3 制品与文件一致性

- Task UI 自有两个提交区间包含 47 个唯一保留文件；已排除明确归属 Agent Context 的并行工件、`.vscode/settings.json` 和 Git 未跟踪的 Vite 运行日志。
- requirements SHA-256 `222a3f69...a0`、roadmap SHA-256 `32e027d7...75` 与 execution state 匹配；P-001/P-002 plan/result revision 和指纹一致。
- 有效快照包含连续 `FR-001`–`FR-028` 和 `AC-001`–`AC-022`；19 个 core 全部 passed，`AC-020/021` 保持有效但可选，`AC-022` passed。
- feature 目录只有连续 `change-0.md` 和一个 completed initial run；没有未匹配的 active、paused、blocked、awaiting 或 abandoned run。

## 6. 开放发现项与可选后续

当前没有正式 `FND-I-*` 或 `FND-C<N>-*`，也没有 report-only finding。`AC-020`/`AC-021` 的 optional/not run 不是异常；Chrome extension 自身的内容脚本错误也有独立证据证明不来自应用且不影响 core，因此均不应创建 finding。状态中的 `FND-I-001` 只是“下一可用编号”。

| ID | 类别 | 严重程度 | 关联需求/验收 | 观察与证据 | 最终功能影响 | 处置 | 置信度 | 建议后续 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |

本报告不建议为了可选广泛回归继续延长原型。若未来工作流出现正式 `FND-*`，明确指定该稳定 ID 是请求可选后续、保持证据连续性的方式。

## 7. 最佳实践记录

本流程可复用的做法：

1. 在需求阶段固定单 DAG、非模态抽屉、专用下降和恢复语义，并把 core、可选 supplemental 与平台主体明确分级，避免验收时临时降级。
2. 只为真实外部交接拆分阶段：macOS 主体形成独立可交付结果，Windows 主体等待真实入口；其余实现、测试、截图和文档留在阶段任务内。
3. 用确定性 fixture 和纯状态/布局模型承担大部分正确性，再用真实浏览器证明滚动、焦点、性能、非颜色表达和双入口边界。
4. 外部工具不可用时保存 blocked 检查点并清理进程/端口，不生成半成品证据；恢复后只继续被中断任务。
5. 将测量工具问题与产品问题分离：用独立 DOM、截图、指标和服务日志确认影响后，在拥有该诊断的任务内最小修正并复验。

本工作流没有后续编号变更。全部实现反馈都在原始需求与阶段所有权内关闭，因此没有需求波动或修正轮次需要归因。
