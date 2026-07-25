# Agent 上下文原型：初始执行状态

- 运行编号：`initial`
- 运行类型：`首次实现`
- 目标记录：`change-0.md`
- 运行状态：`ready`
- 交付与验证策略：`relaxed`
- 验证结论：`pending`
- 当前路线图修订：`1`
- 需求指纹：`sha256:569d2e655ef3f346b5196c9e594ccc20c476131b9107a4c6eacfa0b3ed30524a`
- 路线图或变更计划指纹：`sha256:e658381e8ee6819411f872b3588a41a1f23ca05a48da0d7406acbfc7a127c339`
- 当前阶段：`P-001`
- 当前任务：无
- 项目基线：分支 `prototype`，提交 `bcae1aa1c66081c67ecbb9f6391b9613927f775a`
- 最后更新时间：`2026-07-25`

## 1. 运行目标或待生效变更

实现并验证一个只使用合成内存数据的确定性 Agent Context 原型：生成来源清晰、稳定排序、受预算和权限约束的可分页引用清单；每次重新授权后渐进读取正文；由实际读取结果生成可逐字段比较的结构化任务分析；证明 Workspace、角色、Skill、评论和提示注入文本不能扩大权限。

规划审核结论：schema `3.2` 契约和声明路径一致；需求完整记录用户明确选择的 `relaxed`，包含连续的 36 个 `FR-*`、23 个已分级 `AC-*`、完整失败/恢复/安全/兼容/平台约束和零未决问题。全部需求均有路线图实现或验证映射，无需发明产品决定。

路线图因最终 Windows 11 x64 core 受三个主体完成和真实外部入口约束而采用两阶段 `phased`；P-001 自身可以在当前 macOS/Node 环境完整实现、验证并安全等待。通过独立新增 Agent Context 模块避开现有 Task UI 用户文件后，没有 migration、不可逆数据、公共兼容过渡、多 writer 或困难恢复风险，因此计划详细度为 `compact`。

## 2. 阶段状态

| 阶段 | 状态 | 阶段计划 | 计划修订 | 目标 | 进入条件 |
| --- | --- | --- | --- | --- | --- |
| P-001 | ready | [`phase-001-plan.md`](phase-001-plan.md) | 1 | Agent Context 核心、无头入口、自动化、性能和 macOS/Node 主体 `pass` | 已满足；实施前切换 Node 24 并复核 file-level 所有权 |
| P-002 | planned | 无；前置满足后即时创建 | 无 | Windows 11 x64 core、最终漂移复核与工作流封存 | P-001 完成；Task UI/Workspace Sync 主体保持通过；真实 Windows 11 x64/Node 24 入口可执行 |

只有 P-001 处于活动状态。P-002 当前没有详细计划，不得提前执行。

## 3. 当前检查点

- 当前阶段：`P-001`，状态 `ready`；当前任务为无。
- 首个可执行任务：`P-001-T-001`，定义见 [`phase-001-plan.md`](phase-001-plan.md)。
- 规划模式：初始路线图模式；规划前不存在 `implementation-plan.md`、initial execution state、phase plan、phase result 或 `change-0.md`。
- 契约事实：schema `3.2`，feature ID、requirements、roadmap 和 execution 路径均与实际目录一致；契约未冻结且没有历史记录冲突。
- 需求事实：要求指纹已记录；`FR-001`–`FR-036` 和 `AC-001`–`AC-023` 连续、可观察、已追踪；`AC-001`–`AC-021` 为 core，`AC-022`/`AC-023` 为 supplemental；唯一必须回答项由用户明确选择 `relaxed`。
- 实现事实：仓库只有 Agent Context 说明、简单候选 JSON、注入样例和结果模板；没有 manifest 核心、预算、分页、读取、消费者或 runner。`context-sources.json` 的 project/task 优先级存在已确认漂移。
- 依赖事实：`packages/test-fixtures` 已有 Task UI 图与 Workspace 授权 fixture；生产 `resolveWorkspaceReadAccess` 对跨用户用户级来源更严格，本原型只能使用合成底层允许事实，不能修改生产授权。
- 前置主体事实：Task UI P-001 和 Workspace Sync P-003 的 macOS 主体证据均已通过；Agent Context 是集中 Windows 验证前最后一个主体。
- 环境事实：项目要求 Node `24.18.0`/pnpm `11.9.0`；规划 shell 为 Node `v22.22.1`/pnpm `11.9.0`，实施命令前必须切换 Node。当前为 macOS arm64，未发现仓库 Windows runner或本地 Windows 执行入口。
- 用户工作基线：以下既有变化不属于本运行，必须原样保留：
  - `apps/web/package.json`
  - `apps/web/src/App.tsx`
  - `apps/web/src/task-ui/**`
  - `apps/workspace-cli/src/mcp.integration.test.ts`
  - `packages/test-fixtures/package.json`
  - `packages/test-fixtures/src/task-graph.ts`
  - `packages/test-fixtures/src/task-graph.test.ts`
  - `pnpm-lock.yaml`
  - `prototypes/task-ui/README.md`
  - `docs/requirements/task-ui-prototype/**`
  - `prototypes/task-ui/results/2026-07-25-macos-m2-chromium*`
- P-001 文件边界：优先新增 `agent-context` 源码/测试和原型 runner，只修改未占用的 `packages/test-fixtures/src/index.ts` 及 Agent Context 自有 fixture/README/results；若必须触及上述用户文件，先暂停并记录问题。

## 4. 已完成任务

| 任务 | 状态 | 实际结果 | 验证 |
| --- | --- | --- | --- |
| 无 | 无 | 尚未开始实现 | 本轮仅完成规划 |

## 5. 运行累计文件变化

| 文件 | 修改模式 | 归属与状态 |
| --- | --- | --- |
| `docs/requirements/agent-context-prototype/requirements.md` | add（既有输入） | 用户已批准需求；本次规划只读，未修改 |
| `docs/requirements/agent-context-prototype/workflow-contract.md` | add（既有输入） | schema 3.2 不可变契约；本次规划只读，未修改 |
| `docs/requirements/agent-context-prototype/implementation-plan.md` | add | 初始路线图 revision 1 |
| `docs/requirements/agent-context-prototype/execution/initial/phase-001-plan.md` | add | 唯一即时阶段计划 revision 1 |
| `docs/requirements/agent-context-prototype/execution/initial/execution-state.md` | add | 当前执行协调权威；运行状态 `ready` |

没有生产文件、fixture、测试、package manifest、锁文件或结果记录在本次规划中被修改。

## 6. 测试与验证证据

| 检查 | 范围 | 观察结果 | 结论 |
| --- | --- | --- | --- |
| 契约与路径审计 | requirements、workflow contract、feature directory | schema 3.2；声明路径一致；无 roadmap/state/result/change-0 或 frozen history | pass |
| 需求完整性与策略 | 完整 requirements | 36 个 FR、23 个 AC；policy 位于功能需求前；全部 AC 分层；必须回答项来自用户明确确认；未决问题为无 | pass |
| 项目实现基线 | Agent Context、test-fixtures、domain authorization、Task UI/Workspace Sync 证据、根工具链 | 支持两阶段 compact 方案；P-001 可独立执行；P-002 目前缺少 Windows 入口 | pass |
| 用户工作保护 | `git status` 与相关 file-level diff | 存在 Task UI/Workspace CLI 用户变化；P-001 已规划为独立新增模块并明确不触及占用文件 | pass |
| 需求追踪 | 路线图矩阵 | `FR-001`–`FR-036`、`AC-001`–`AC-023` 全部映射到 P-001/P-002 和验证 | pass |

本节只记录规划审计；没有运行实现测试、主体性能或产品代码。

## 7. 决策、待确认问题与回答

| ID | 阶段/任务 | 问题 | 已确认事实 | 可选方案与影响 | 需要确认 | 状态 | 用户回答及来源 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Q-001 | requirements | 交付与验证策略 | schema 3.2 每个运行必须由用户选择 strict 或 relaxed | strict：全部 supplemental 阻塞；relaxed：已证明无 core 影响的 supplemental 异常可 report-only | 选择 initial run 策略 | resolved | 用户明确选择 `relaxed`，已记录于 requirements |

无未决问题。

## 8. 发现项、偏差、风险与阻塞

- 下一可用 finding ID：`FND-I-001`。
- 当前没有 `FND-I-*`，验证结论为 `pending`。
- 当前没有偏差、产品阻塞或活动实现。
- Node 22 与项目 Node 24 的差异是执行前可逆环境检查，不是用户问题；未切换前不能产生有效主体或性能证据。
- 共享 test-fixtures 有用户未提交变化，但计划文件范围不直接重叠。实施前必须再次检查；若出现同文件重叠或接口漂移存在多种处理方式，运行暂停并写入 `Q-*`。
- P-002 的真实 Windows 入口尚不可用。这是需求明确的后续外部前置，不阻塞 P-001，不是 finding，也不能降低为 supplemental。

## 9. 精确恢复步骤

从当前 `ready` 状态开始实施时：

1. 先读取本 state、[`phase-001-plan.md`](phase-001-plan.md)、[`../../implementation-plan.md`](../../implementation-plan.md)、[`../../requirements.md`](../../requirements.md) 和 workflow contract；不要从聊天记录推断状态。
2. 复核 requirements 指纹为 `sha256:569d2e655ef3f346b5196c9e594ccc20c476131b9107a4c6eacfa0b3ed30524a`，roadmap 指纹为 `sha256:e658381e8ee6819411f872b3588a41a1f23ca05a48da0d7406acbfc7a127c339`，P-001 plan revision 为 1，且不存在 P-001 result、`change-0.md` 或另一活动阶段。
3. 检查当前 Git 状态和 P-001 计划文件的 file-level diff；保留第 3 节所列用户变化。若目标文件出现新的用户修改或共享接口漂移处理不唯一，先把运行设为 `paused` 并记录问题。
4. 切换到 `.node-version` 的 Node `24.18.0`，确认 pnpm `11.9.0`；不满足时停止执行，不写主体结论。
5. 调用 `$implement-planned-feature` 只执行或恢复 P-001。其第一项状态变更必须把 run/phase 设为 `in_progress`、当前任务设为 `P-001-T-001`，记录任务文件范围和完成条件后才修改实现文件。

## 10. 最终完成门禁

- [x] schema 3.2 契约、requirements、路线图和唯一 P-001 计划一致。
- [x] 用户明确的 `relaxed` 策略、core/supplemental 分层和下一 `FND-I-*` 已记录。
- [x] P-001 是唯一 `ready` 阶段；P-002 只有路线图条目，没有提前创建详细计划。
- [x] 规划未修改生产文件，既有用户变化已记录且不被认领。

- [ ] P-001 的两个任务、全部 P-001 core、macOS/Node 主体、性能和根工程硬门禁通过。
- [ ] P-001 形成不可变 phase result，运行安全转为 `awaiting_next_phase`。
- [ ] P-002 在外部前置满足后即时规划并在真实 Windows 11 x64/Node 24 完成 core。
- [ ] `FR-001`–`FR-036` 和 `AC-001`–`AC-023` 的最终追踪一致。
- [ ] 所有安全、隐私、授权、兼容、build/runtime、恢复和平台硬门禁通过。
- [ ] 所有开放 `FND-I-*` 均符合 relaxed report-only 规则并汇总到最终记录。
- [ ] 没有未决产品问题、用户工作重叠、活动进程、半完成实现或未知外部状态。
- [ ] `change-0.md` 与 `effective-requirements.md` 只在 P-002 最终门禁通过后创建并与本 state 一致。
- [ ] 运行最终更新为 `completed`，验证结论为 `passed` 或合规的 `passed_with_findings`。
