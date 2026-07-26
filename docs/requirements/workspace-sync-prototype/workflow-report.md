# Workspace 租约、同步与最小身份基础原型：工作流回顾

- 报告类型：`最佳实践记录`
- 工作流 schema：`3.2`
- 原始需求：[`requirements.md`](requirements.md)
- 初始路线图：[`implementation-plan.md`](implementation-plan.md)
- 执行证据范围：[`execution/initial/execution-state.md`](execution/initial/execution-state.md)、[`execution/initial/phase-001-plan.md`](execution/initial/phase-001-plan.md)–[`execution/initial/phase-004-result.md`](execution/initial/phase-004-result.md)
- 修改记录范围：[`change-0.md`](change-0.md)–[`change-0.md`](change-0.md)
- 当前有效需求：[`effective-requirements.md`](effective-requirements.md)
- 生成日期：2026-07-26

## 1. 结论

本 schema 3.2 工作流通过完成门禁。唯一 initial run、P-001–P-004 四个阶段和 9 个任务均已完成；`change-0.md` 连续匹配 completed initial run，有效需求完整重建原始 38 个 `FR-*` 与 20 个 `AC-*`。需求、路线图、四份阶段计划、四份不可变结果、执行状态、最终记录和有效快照描述同一功能，没有未匹配运行、未决问题、开放 finding、半应用 migration、活动测试环境或未知恢复状态。

报告分支为“最佳实践记录”：不存在后续 `RC-*`，因而没有主分类 B 的修正项，也没有需求变化或修正轮次。执行期间发现的 Web 缓存、lint、接管基线、Windows 路径/锁与测试运行时问题都在原始阶段所有权和既定验收内关闭；没有改写已完成阶段，也没有追加纠正阶段。

| 指标 | 结果 |
| --- | --- |
| 工作流制品 | 15 个，含本报告 |
| 执行运行 | 1 个 initial run；change run 0 个 |
| 阶段 | 计划 4 个、完成 4 个、纠正阶段 0 个 |
| 任务 | 计划 9 个、完成 9 个 |
| 修改记录 | 1 个，连续范围 `change-0`–`change-0` |
| 原始需求与验收 | `FR-*` 38/38；`AC-*` 20/20，其中 core 17、supplemental 3 |
| 当前有效需求 | 38 个 `FR-*` 与 20 个 `AC-*`，和原始基线一致；无退役项 |
| 需求变更 | `RC-*` 0；主分类 A 0、B 0；意图变更轮次 0、修正轮次 0 |
| 交付策略 | strict 运行 0；relaxed 运行 1 |
| 验证结论 | `passed` 1；`passed_with_findings` 0 |
| finding | open 0、closed 0；没有正式 `FND-*` |
| 保留文件变化 | 108 个唯一文件 |
| 计划修订 | 路线图修订 0 次；阶段计划修订 0 次；四份计划均冻结于 revision 1 |
| 中断与恢复 | paused 0、blocked 0、任务中断恢复 0；P-003 后有 1 段合规的 `awaiting_next_phase` 外部等待 |

最高优先级结论：本流程没有用模拟平台结果代替高风险边界，而是把身份/数据基础、服务端权威协议、macOS 本地原子恢复和 Windows/NTFS 外部门禁分成四个安全阶段，并在每个阶段保留可构建、可恢复的交接状态。

## 2. 工作流时间线、阶段与结果

| 时间/步骤 | 运行、阶段或任务 | 关键证据 | 结果 |
| --- | --- | --- | --- |
| 2026-07-25 需求澄清 | 原始需求 | [`requirements.md`](requirements.md) 固定 38 个 `FR-*`、20 个分级 `AC-*`、`relaxed` 策略和零未决问题 | 需求可独立规划 |
| 2026-07-25 初始审计与路线图 | initial / P-001–P-004 | [`implementation-plan.md`](implementation-plan.md) 采用 phased + expanded revision 1；四阶段覆盖 migration、安全公共边界、本地恢复和 Windows 外部交接 | P-001 ready，后续阶段按结果即时规划 |
| 2026-07-25 身份与作用域基础 | P-001 / 2 个任务 | [`phase-001-plan.md`](execution/initial/phase-001-plan.md) 与 [`phase-001-result.md`](execution/initial/phase-001-result.md) | 身份、配对、三级授权、唯一 Workspace、Web 人工流和兼容门禁 `completed/passed` |
| 2026-07-25 服务端同步协议 | P-002 / 2 个任务 | [`phase-002-plan.md`](execution/initial/phase-002-plan.md)、[`phase-002-result.md`](execution/initial/phase-002-result.md)、[`p002-server-protocol.md`](../../../prototypes/workspace-sync/results/p002-server-protocol.md) | PostgreSQL、ObjectStore、租约、CAS、幂等和 `SYNC-001`–`SYNC-007` `completed/passed` |
| 2026-07-25 macOS 客户端主体 | P-003 / 3 个任务 | [`phase-003-plan.md`](execution/initial/phase-003-plan.md)、[`phase-003-result.md`](execution/initial/phase-003-result.md)、[`p003-macos-client.md`](../../../prototypes/workspace-sync/results/p003-macos-client.md) | 正式 CLI、APFS/Keychain、双进程 `SYNC-001`–`SYNC-009`、性能与恢复 `completed/passed` |
| 2026-07-25 至 2026-07-26 安全等待 | initial / `awaiting_next_phase` | P-003 结果和 [`execution-state.md`](execution/initial/execution-state.md) 保持冻结；Task UI、Agent Context 与 Windows 入口尚未齐备时没有创建空壳 P-004 计划 | 外部前置满足前不伪造 core 证据，不构成 pause、blocked 或 finding |
| 2026-07-26 Windows 与最终集成 | P-004 / 2 个任务 | [`phase-004-plan.md`](execution/initial/phase-004-plan.md)、[`phase-004-result.md`](execution/initial/phase-004-result.md)、[`p004-windows-client.md`](../../../prototypes/workspace-sync/results/p004-windows-client.md) | PasswordVault、NTFS、双进程主体、真实 PostgreSQL 17 和最终根门禁 `completed/passed` |
| 2026-07-26 initial finalization | initial | [`change-0.md`](change-0.md)、[`effective-requirements.md`](effective-requirements.md) 与 completed [`execution-state.md`](execution/initial/execution-state.md) | 首次历史冻结，当前有效需求建立 |

路线图只有 revision 1；四份阶段计划也都冻结于 revision 1。P-002–P-004 是按契约进行的正常滚动规划，不是计划返工。P-001–P-003 的阶段结果在进入下一阶段前保持不可变；P-004 只在另外两个原型主体与真实 Windows 入口满足后规划，因此外部等待具有明确的安全边界。

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

阶段内修正都用于实现原始可观察结果：P-001 关闭退出后的旧账号缓存，P-002 清理 lint，P-003 修正接管租约可领先本地基线，P-004 处理 Windows 非 NFC、目录 durability、sharing violation 与状态锁竞争。这些变化没有修改 `FR-*`、`AC-*`、验收层级或用户决策，因而不应伪造为 `RC-*`。

## 4. 执行可恢复性与阶段质量

### 4.1 比例性

- 四阶段有事实边界：P-001/P-002 分别拥有 additive migration 与冻结接口；P-003 拥有本地用户内容、OS 凭据和原子物化恢复；P-004 依赖真实 Windows 与其他两个原型主体，是独立外部交接和最终集成门禁。
- expanded 细节有事实依据：身份与 secret、数据库并发、ObjectStore、跨数据库/文件系统一致性、用户内容原子替换、双平台凭据和困难恢复都需要文件所有权、隔离目标、指纹与清理证据。
- 任务没有按实现、测试、文档或收尾机械拆分；9 个任务分别对应独立的身份/协议/本地端口/平台关闭结果，阶段内验证与实现保持同一责任边界。
- relaxed 策略执行正确：没有人为制造 red-first 基线；17 个 core、3 个 supplemental 和安全、数据、兼容、构建、恢复硬门禁的层级从需求到结果保持稳定，最终全部通过。
- 根门禁在各阶段重复都有失效依据：每一阶段都新增或修改生产契约、migration、客户端或平台适配代码；最终 P-004 又修改 Windows 共享实现并承担完整集成结论。没有无中间变更的重复全套验证。

### 4.2 检查点与恢复完整性

| 项目 | 观察 |
| --- | --- |
| 项目基线 | 路线图起点 `a75be46a...`、P-004 起点 `aed6cbb...`、Node/pnpm 与平台事实在计划、状态和结果中一致 |
| 需求与计划指纹 | requirements、roadmap、P-001–P-004 phase plan/result 指纹与 execution state 一致 |
| 数据与外部目标 | 每个 PostgreSQL、ObjectStore、本地根、Keychain/PasswordVault namespace、端口和下载运行时都有隔离边界与最终清理证据 |
| 任务检查点 | state 记录每个任务的开始条件、实际文件、观察结果、偏差、后续任务和完成状态 |
| 外部等待 | P-003 后保持 `awaiting_next_phase`，没有提前创建 P-004 结果或把缺少 Windows 证据降级为 finding |
| 暂停或阻塞 | 0；长时工具生命周期截断和沙箱权限限制均通过同一计划验证在合适宿主环境重跑关闭 |
| 完成后恢复语义 | completed state 禁止 resume 重写历史；后续产品变化必须从 `change-1` 开始 |

没有任务在产品或数据处于未知半完成状态时结束。Windows PasswordVault、NTFS 锁、PostgreSQL runtime 和双进程测试都记录了精确目标与清理；最终不存在活动 lease、凭据条目、journal、临时文件、进程、监听端口或半应用 migration。恢复设计与观察到的高风险边界匹配。

## 5. 最终交付与验证证据

### 5.1 需求和验收覆盖

| 覆盖组 | 实现证据 | 验证证据 | 结论 |
| --- | --- | --- | --- |
| `FR-001`–`FR-010`, `FR-032`–`FR-035`, `FR-038` | Identity/Pairing/Device、三级 scope、唯一 Workspace、Web 人工流 | Argon2id、Cookie、配对/撤销、Owner/成员资格、migration/事务与 OpenAPI | pass |
| `FR-011`–`FR-025`, `FR-033`–`FR-036`, `FR-038` | 租约、不可变版本、manifest、ObjectStore、幂等、冲突和审计 | 隔离 PostgreSQL/ObjectStore 上重复 `SYNC-001`–`SYNC-007`、故障注入、重启与数据汇总 | pass |
| `FR-003`–`FR-006`, `FR-021`–`FR-032`, `FR-036`–`FR-038` | workspace-core、正式 CLI、APFS/Keychain、状态/journal 和 Web 配对 | macOS 双进程 `SYNC-001`–`SYNC-009`、原子恢复、性能/软限制、秘密与兼容检查 | pass |
| `FR-001`–`FR-038` | Windows PasswordVault/NTFS 平台适配与最终集成 | Windows 双进程、锁定文件恢复、10 轮锁压力、真实 PostgreSQL 17、全仓根门禁 | pass |
| `AC-018`–`AC-020` supplemental | 性能、规模边界与统一人类/JSON 投影 | macOS 500 文件/100 MiB、2,000 文件、50 MiB/2 GiB；macOS/Windows 两轮小同步 | pass |

### 5.2 观察到的最终验证

- 服务端结果在隔离 PostgreSQL 17 和本地 ObjectStore 上重复执行 `SYNC-001`–`SYNC-007`，证明唯一 writer、服务端时钟、CAS、幂等、冲突选择、资格失效与审计。
- macOS Apple Silicon/APFS/Keychain 使用两个正式 CLI 进程和两个隔离根重复 `SYNC-001`–`SYNC-009`；扫描、冲突副本、物化 journal、故障恢复和凭据生命周期全部通过。
- Windows 11 x64/NTFS/PasswordVault 使用两个正式 CLI 进程重复相同场景；PasswordVault 2/2、NTFS 3/3、锁压力 30/30，锁定文件返回 `SCAN_RETRY` 后可安全恢复。
- 最终 `pnpm check` 使用 Node `24.18.0`、pnpm `11.9.0` 与隔离 PostgreSQL 17 获得退出码 0：Prettier、ESLint、10 个 workspace build/typecheck、database 9、domain 25、ObjectStore 3、workspace-core 24、CLI 25、fixtures 37、API 12、Web 5 项通过。
- 最终数据库包含 migration `0001`–`0003`，版本表 16 行、最大版本 3、Workspace 审计 44 条、重复 active lease 分组 0；测试 lease 清理后活动数 0。
- OpenAPI、health/system、Web、CLI help/status/doctor 和两个只读 MCP 工具保持兼容；没有本地 GUI、Agent 业务写工具、外部 API/AI/LLM、真实 secret 或仓库内运行产物。

### 5.3 制品与文件一致性

- 两个 feature 提交区间的并集包含 108 个唯一保留文件，与 `change-0.md` 的累计范围和 P-001–P-004 文件清单一致；没有把中间的 Task UI 或 Agent Context 提交计入本功能。
- requirements SHA-256 `ba747ca...5217`、roadmap SHA-256 `baaa0c...2af0` 与 execution state 匹配；四份 phase plan/result 的指纹和 revision 也一致。
- 有效快照包含连续 `FR-001`–`FR-038` 和 `AC-001`–`AC-020`，均标记 passed 并回溯原始需求；没有 add/modify/delete 型后续增量或退役项。
- feature 目录只有连续 `change-0.md` 和一个 completed initial run；没有未匹配的 active、paused、blocked、awaiting 或 abandoned run。

## 6. 开放发现项与可选后续

当前没有正式 `FND-I-*` 或 `FND-C<N>-*`，也没有 report-only finding。状态中的 `FND-I-001` 只是“下一可用编号”，不是开放发现项或继续执行 ID。

| ID | 类别 | 严重程度 | 关联需求/验收 | 观察与证据 | 最终功能影响 | 处置 | 置信度 | 建议后续 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |

本报告不建议创建无依据的原型后续任务。若未来工作流出现正式 `FND-*`，明确指定该稳定 ID 是请求可选后续、保持证据连续性的方式。

## 7. 最佳实践记录

本流程可复用的做法：

1. 把服务端权威、权限、secret、数据完整性、恢复、跨平台和公共兼容写成完整 `FR-*`/分级 `AC-*`，即使采用 relaxed 策略也不降低硬门禁。
2. 用真实安全边界划分阶段：migration 与服务端协议先冻结，本地物化随后消费正式 API，最终平台门禁等待真实入口，不按“实现/测试/文档”机械分期。
3. 对数据库、对象存储、用户文件、OS 凭据和测试运行时使用明确隔离目标，任务前后记录状态、指纹和清理，使跨系统失败能够确定恢复。
4. 把执行中暴露的实现缺陷留在拥有它的阶段内关闭，并只在生产改动使证据失效时复验；不把正常实现反馈包装成需求变更或纠正阶段。
5. 使用 `awaiting_next_phase` 表达真实外部交接；缺少 Windows core 证据时保持未完成，而不是创建空壳计划、模拟结论或 report-only finding。

本工作流没有后续编号变更。所有技术修正都服务于原始需求，四个阶段和九个任务的完成证据最终汇入同一个 `change-0` 与有效需求快照，因此没有需求波动或修正轮次需要归因。
