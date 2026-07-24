# Workspace CLI 替代桌面客户端：工作流回顾

- 报告类型：`最佳实践记录`
- 工作流 schema：`3.2`
- 原始需求：[`requirements.md`](requirements.md)
- 初始路线图：[`implementation-plan.md`](implementation-plan.md)
- 执行证据范围：[`execution/initial/execution-state.md`](execution/initial/execution-state.md)、[`execution/initial/phase-001-plan.md`](execution/initial/phase-001-plan.md)、[`execution/initial/phase-001-result.md`](execution/initial/phase-001-result.md)
- 修改记录范围：[`change-0.md`](change-0.md)–[`change-0.md`](change-0.md)
- 当前有效需求：[`effective-requirements.md`](effective-requirements.md)
- 生成日期：2026-07-25

## 1. 结论

本 schema 3.2 工作流通过完成门禁。唯一 initial run、唯一阶段 P-001 和唯一任务 P-001-T-001 均完成；`change-0.md` 连续匹配 completed initial run，有效需求完整重建原始 15 个 `FR-*` 与 13 个 `AC-*`，没有未匹配运行、需求变更、开放问题、正式 finding 或不完整恢复状态。

报告分支为“最佳实践记录”：不存在主分类 B 的修正项，也不存在后续 `RC-*`。路线图和阶段计划的第二版只收紧 MCP SDK v1 依赖边界，没有改变产品需求、阶段范围或验收；执行中的协议错误处理与根 bin 链接修正均在原始验收范围内闭环，不构成需求变化或纠正阶段。

| 指标 | 结果 |
| --- | --- |
| 工作流制品 | 9 个，含本报告 |
| 执行运行 | 1 个 initial run；change run 0 个 |
| 阶段 | 计划 1 个、完成 1 个、纠正阶段 0 个 |
| 任务 | 计划 1 个、完成 1 个 |
| 修改记录 | 1 个，连续范围 `change-0`–`change-0` |
| 原始需求与验收 | `FR-*` 15/15；`AC-*` 13/13，其中 core 11、supplemental 2 |
| 当前有效需求 | 15 个 `FR-*` 与 13 个 `AC-*`，和原始基线一致；退役项来源完整 |
| 需求变更 | `RC-*` 0；主分类 A 0、B 0；意图变更轮次 0、修正轮次 0 |
| 交付策略 | strict 运行 0；relaxed 运行 1 |
| 验证结论 | `passed` 1；`passed_with_findings` 0 |
| finding | open 0、closed 0；没有正式 `FND-*` |
| 保留文件变化 | 50 个唯一文件：add 24、modify 15、delete 11 |
| 中断与恢复 | paused 0、blocked 0、任务中断恢复 0 |

最高优先级结论：本流程在用户已有 README 修改与删除式客户端切换这一真实风险上使用 expanded 证据，同时仍保持一个阶段、一个任务和一次最终集成门禁，风险控制与执行粒度匹配。

## 2. 工作流时间线、阶段与结果

| 时间/步骤 | 运行、阶段或任务 | 关键证据 | 结果 |
| --- | --- | --- | --- |
| 2026-07-24 需求澄清 | 原始需求 | [`requirements.md`](requirements.md) 固定 15 个 `FR-*`、13 个分级 `AC-*`、`relaxed` 策略和无未决问题 | 需求可独立规划 |
| 2026-07-24 初始审计与路线图 | initial / P-001 | [`implementation-plan.md`](implementation-plan.md) 采用 single + expanded；修订 1 建立全量映射，修订 2 将 MCP SDK 收紧到 v1.x | 1 个阶段覆盖全部需求和验收 |
| 2026-07-24 即时阶段规划 | P-001 | [`phase-001-plan.md`](execution/initial/phase-001-plan.md) 修订 1 建立单任务计划，修订 2 同步 SDK v1.x；父路线图和需求指纹一致 | P-001-T-001 ready |
| 任务前检查点 | P-001-T-001 | 基线分支 `prototype`、HEAD `7be2bf685143112571debfe924ce59ee1b40e1b9`；记录 README 文件与 diff 指纹、Node `24.18.0` / pnpm `11.9.0` 及文件所有权 | 用户已有工作与任务范围可区分 |
| 单任务实施 | P-001-T-001 | 新增核心与 CLI，删除 Electron，更新根工程、lockfile、活动文档和 ADR 取代链 | 任务范围与路线图一致 |
| 任务内诊断修正 | P-001-T-001 | 首次门禁暴露畸形协议输入被 SDK 静默丢弃；随后正式 bin 调用暴露根 wrapper 未链接。两次均在修改后复验受影响检查和根门禁 | 原始 `AC-001`、`AC-003`、`AC-007` 得到闭环；未改变验收层级 |
| 阶段完成 | P-001 | [`phase-001-result.md`](execution/initial/phase-001-result.md) 状态 `completed`、策略 `relaxed`、结论 `passed` | core、supplemental 与硬门禁全部通过 |
| initial finalization | initial | [`change-0.md`](change-0.md)、[`effective-requirements.md`](effective-requirements.md) 与 completed [`execution-state.md`](execution/initial/execution-state.md) | 首次历史冻结，当前有效需求建立 |

路线图有 2 个保留版本，即 1 次初始版本后的修订；阶段计划同样有 2 个保留版本，即 1 次同步修订。两次修订都发生在阶段结果冻结前，没有重写 completed phase，也没有触发纠正阶段。路线图表中的 `ready` 记录规划时进入状态；完成协调权威由 execution state 和 phase result 的 `completed` 状态提供。

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

路线图/阶段计划修订 2 对 SDK 主版本作兼容性收紧，但没有改变任何 `FR-*`、`AC-*` 或用户决策。协议错误映射和根 bin wrapper 是实现既有可观察结果所需的任务内技术修正，也不是产品增量，因而不应伪造为 `RC-*`。

## 4. 执行可恢复性与阶段质量

### 4.1 比例性

- 单阶段合理：客户端替换、工程切换、文档和验收共同组成一个原子交付，没有数据迁移、公共兼容过渡、独立审批、外部交接或可独立发布的中间子系统需要额外阶段。
- 单任务合理：核心、CLI、Electron 删除和最终门禁互相依赖；拆成实现、测试、文档或收尾阶段会制造不可独立交付的边界。
- expanded 细节有事实依据：`README.md` 是用户已有修改与功能修改的同文件多所有者范围，且 Electron 删除属于删除式切换。扩展内容集中在文件所有权、指纹、执行顺序和恢复，没有用泛化风险增加阶段或任务。
- relaxed 策略执行正确：没有人为制造 red-first 基线；core、supplemental 和硬门禁的层级从需求到结果保持稳定，最终全部通过。
- 验证复验有失效原因：畸形协议处理和根 bin 链接都修改了生产文件，必须重新执行受影响测试和完整根门禁；没有证据表明存在无中间变更的重复全套诊断。

### 4.2 检查点与恢复完整性

| 项目 | 观察 |
| --- | --- |
| 项目基线 | 分支、HEAD、Node/pnpm 版本在路线图、阶段计划、状态和结果中一致 |
| 需求与计划指纹 | requirements、roadmap、phase plan 的 SHA-256 均和状态记录匹配 |
| 用户文件保护 | README 任务前文件/差异指纹与任务后文件/差异指纹在 state、phase result 和 change-0 中一致 |
| 任务检查点 | state 记录任务前基线、所有权、实际文件、最终验证与 completed 任务 |
| 暂停或阻塞 | 0；没有未记录的半应用 migration、外部写入或用户冲突 |
| 完成后恢复语义 | completed state 明确禁止 resume 重写历史；后续产品变化必须从 `change-1` 开始 |

没有实际暂停或中断任务，因此没有恢复执行可供演练计数。尽管如此，expanded 计划对 README 冲突、删除式切换、协议污染和 Node 版本分别给出精确恢复入口；最终状态又把已完成历史与未来 change run 的边界分开。恢复设计与观察到的风险一致。

## 5. 最终交付与验证证据

### 5.1 需求和验收覆盖

| 覆盖组 | 实现证据 | 验证证据 | 结论 |
| --- | --- | --- | --- |
| `FR-001`–`FR-005`, `FR-009`–`FR-011`, `FR-014`, `FR-015` | `apps/workspace-cli/**`、Node 平台适配器、MCP stdio、稳定错误/信号边界 | 正式 bin、命令矩阵、实际 MCP 子进程、离线/负向/敏感输出、信号关闭 | pass |
| `FR-006` | `packages/workspace-core/**` 的模型、端口和纯服务 | 3 项核心单元测试与无 UI/CLI 反向依赖扫描 | pass |
| `FR-007`, `FR-008` | 删除 `apps/desktop/**`，更新根命令、workspace 配置和 lockfile | Electron/依赖扫描、根 `pnpm check`、正式 pnpm bin | pass |
| `FR-012` | README、活动架构、Agent、路线、决策、ADR 和原型文档 | 活动引用检查；ADR-009/010 由 ADR-014 建立显式取代链 | pass |
| `FR-013` | API、Worker、Web、database 与 migration 无变化 | Git 范围审查与既有统一门禁 | pass |
| `AC-012`, `AC-013` supplemental | 同源的人类/JSON 呈现与平台适配 | 人类可读性对照及真实 macOS arm64 CLI/MCP 冒烟 | pass |

### 5.2 观察到的最终验证

最终记录包含 12 类验证证据，结论全部为 pass：

- Node `v24.18.0`、pnpm `11.9.0`、macOS arm64 环境确认。
- 根 `pnpm check` 通过 Prettier、ESLint、9 个 workspace build/typecheck 和 21 项测试。
- `@ngapd/workspace-core` 3/3、`@ngapd/workspace-cli` 10/10 测试通过。
- 正式 `pnpm exec ngapd-workspace` bin、help/version/status/doctor 人类与 JSON 命令通过。
- 实际 SDK Client 完成 MCP 初始化、发现和两个只读工具调用，协议 stdout 保持纯净。
- 畸形输入、stdin、SIGINT、SIGTERM 产生稳定诊断或退出结果。
- 最小环境、sentinel、空夹具和 `lsof` 检查证明离线可用、无敏感输出、文件创建数 0、网络监听数 0。
- Electron、依赖、import、活动文档、migration 和 Git 范围检查通过；README 用户内容与最终 diff 检查通过。

### 5.3 制品与文件一致性

- `change-0.md` 的 50 行文件清单与当前 Git 变更逐文件、逐模式一致：24 add、15 modify、11 delete，没有遗漏、额外项或模式冲突。
- P-001 result 包含 44 个阶段内保留文件；`change-0.md` 另合并 6 个初始工作流/finalization 制品，合计 50 个且没有重复计算。
- requirements、roadmap、phase plan、effective snapshot 和 change-0 的记录指纹与 execution state 完全匹配。
- 有效快照包含连续 `FR-001`–`FR-015` 和 `AC-001`–`AC-013`，来源均回到原始需求；退役 Electron、`dev:desktop` 和历史 ADR 状态与 change-0 一致。
- feature 目录没有断链 Markdown 引用，也没有未匹配的 active、paused、blocked、awaiting 或 abandoned run。

## 6. 开放发现项与可选后续

当前没有正式 `FND-I-*` 或 `FND-C<N>-*`，也没有 report-only finding。状态中的 `FND-I-001` 只是“下一可用编号”，不是开放发现项或继续执行 ID。

| ID | 类别 | 严重程度 | 关联需求/验收 | 观察与证据 | 最终功能影响 | 处置 | 置信度 | 建议后续 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |

本报告不建议创建无依据的后续任务。若未来工作流出现正式 `FND-*`，明确指定该稳定 ID 是请求可选后续、保持证据连续性的方式。

## 7. 最佳实践记录

本流程可复用的做法：

1. 先把产品边界写成完整 `FR-*`/分级 `AC-*`，并在 relaxed 策略下继续把安全、隐私、兼容、构建、恢复和用户工作保护作为硬门禁。
2. 用真实项目事实决定计划深度：README 多所有者风险需要 expanded 文件级证据，但不需要额外阶段；删除式切换和最终验证仍留在同一个原子任务中。
3. 用 execution state 保存工作区基线、指纹和任务检查点，把 phase result 作为冻结完成证据，把 change-0 与 effective snapshot 作为最终产品历史和当前权威。
4. 只在生产改动使既有证据失效时复验；将发现的实现缺口留在原任务内修正，不把正常实现反馈包装成需求变更或纠正阶段。
5. 保留旧 Electron ADR 并建立显式 superseded 链，同时在有效需求中记录退役项，使当前行为与历史原因都可追溯。

本工作流没有后续编号变更。唯一的后续计划修订是对既定技术方向的依赖版本澄清，执行中的两项修正也是对原始验收的直接实现，因此没有需求波动或修正轮次需要归因。
