# Agent 上下文原型：初始执行状态

- 运行编号：`initial`
- 运行类型：`首次实现`
- 目标记录：`change-0.md`
- 运行状态：`completed`
- 交付与验证策略：`relaxed`
- 验证结论：`passed`
- 当前路线图修订：`1`
- 需求指纹：`sha256:569d2e655ef3f346b5196c9e594ccc20c476131b9107a4c6eacfa0b3ed30524a`
- 路线图或变更计划指纹：`sha256:e658381e8ee6819411f872b3588a41a1f23ca05a48da0d7406acbfc7a127c339`
- 当前阶段：无（P-002 已完成）
- 当前任务：无
- 项目基线：分支 `prototype`，规划基线 `bcae1aa1c66081c67ecbb9f6391b9613927f775a`；P-001 实施起点 `cad7359c9a266021674c358055ac6dc2dac554c1`；P-002 规划基线 `849bd2dd86468ee30d062e36a602c52c72c25690`
- 最后更新时间：`2026-07-26`

## 1. 运行目标或待生效变更

实现并验证一个只使用合成内存数据的确定性 Agent Context 原型：生成来源清晰、稳定排序、受预算和权限约束的可分页引用清单；每次重新授权后渐进读取正文；由实际读取结果生成可逐字段比较的结构化任务分析；证明 Workspace、角色、Skill、评论和提示注入文本不能扩大权限。

规划审核结论：schema `3.2` 契约和声明路径一致；需求完整记录用户明确选择的 `relaxed`，包含连续的 36 个 `FR-*`、23 个已分级 `AC-*`、完整失败/恢复/安全/兼容/平台约束和零未决问题。全部需求均有路线图实现或验证映射，无需发明产品决定。

路线图因最终 Windows 11 x64 core 受三个主体完成和真实外部入口约束而采用两阶段 `phased`；P-001 自身可以在当前 macOS/Node 环境完整实现、验证并安全等待。通过独立新增 Agent Context 模块避开现有 Task UI 用户文件后，没有 migration、不可逆数据、公共兼容过渡、多 writer 或困难恢复风险，因此计划详细度为 `compact`。

P-002 滚动规划结论：requirements 与路线图指纹未变，P-001 不可变结果仍为 `completed/passed`，Agent Context 自有文件自 P-001 提交后无漂移；Task UI initial run 已在 Windows x64 完成并封存为 `passed`，Workspace Sync P-003 macOS 主体仍为 `completed/passed`，当前 Windows x64 入口可执行。P-002 继续采用路线图 revision 1 和 `compact`，只需一个集中 Windows core 与最终封存任务，无需修改需求或路线图设计。

## 2. 阶段状态

| 阶段 | 状态 | 阶段计划 | 计划修订 | 目标 | 进入条件 |
| --- | --- | --- | --- | --- | --- |
| P-001 | completed | [`phase-001-plan.md`](phase-001-plan.md) | 1 | Agent Context 核心、无头入口、自动化、性能和 macOS/Node 主体 `pass` | 已完成；不可变结果见 [`phase-001-result.md`](phase-001-result.md) |
| P-002 | completed | [`phase-002-plan.md`](phase-002-plan.md) | 1 | Windows 11 x64 core、最终漂移复核与工作流封存 | 已完成；不可变结果见 [`phase-002-result.md`](phase-002-result.md) |

P-001/P-002 均为 `completed/passed` 且计划与结果冻结。initial run 已完成 schema-v3 最终重读、有效需求快照、change-0 和完成状态封存，没有活动阶段或任务。

## 3. 当前检查点

- 当前阶段与任务均为无；P-002 已形成不可变 [`phase-002-result.md`](phase-002-result.md)，状态 `completed/passed`；initial run 已最终封存。
- P-002-T-001 执行前检查点：分支 `prototype`、HEAD `849bd2dd86468ee30d062e36a602c52c72c25690`；任务开始前 Git 变化只有本工作流的 `execution-state.md` 和未跟踪 `phase-002-plan.md`，没有用户代码或结果重叠，`git diff --check` 通过。
- P-002-T-001 影响范围：优先只新增 `prototypes/agent-context/results/2026-07-26-windows-x64-node24.md` 及 P-002/最终化工作流工件；只有真实 Windows core 暴露缺陷时才能修改 phase plan 声明的 Agent Context 自有核心、测试、runner、夹具或 README。
- P-002-T-001 预期验证：`V-001` 精确环境/指纹/主体前置，`V-002` Windows 无头 core/P95，`V-003` 最终根 `pnpm check`，`V-004` 结果字段、范围/秘密、whitespace、完整追踪与 finding 汇总。
- P-002-T-001 完成条件：Node `24.18.0` / pnpm `11.9.0` 下 Windows 结果为 `pass`；全部 core、硬门禁、最终追踪和用户工作保护闭合；没有阻塞 finding、未决问题或未知影响，随后才可创建不可变 P-002 result 并进入 finalizing。
- P-002-T-001 执行后检查点：V-001 的 17/17 前置断言通过；Windows runner 12/12 core 场景通过，deep/wide/dense P95 为 0.575/1.319/0.580 ms；平台结果为 `pass`；最终根 `pnpm check` 在 Node `24.18.0` / pnpm `11.9.0` 下退出码 0；V-004 的结果、范围、秘密、whitespace、漂移和全量追踪检查通过。
- P-002-T-001 实际变化：只新增 [`../../../../../prototypes/agent-context/results/2026-07-26-windows-x64-node24.md`](../../../../../prototypes/agent-context/results/2026-07-26-windows-x64-node24.md) 并更新本工作流证据；没有修改 Agent Context 实现、测试、runner、夹具、Task UI、Workspace Sync、生产授权、package manifest、锁文件、数据库或 migration。
- P-002-T-001 偏差与恢复：当前 Codex bundled pnpm 启动器固定到 Node 24.14，故以校验后的 Node 24.18.0 直接启动同一 pnpm 11.9.0 模块，并显式加入本地 `.bin`；runner 自报 `win32/x64` / Node `v24.18.0`。首次 `pnpm exec tsx` 因该外置启动器没有自动注入本地 `.bin` 而在加载原型前失败，修正进程搜索路径后同一命令通过；无产品偏差或 finding。
- P-002 阶段关闭：[`phase-002-result.md`](phase-002-result.md) 指纹 `sha256:7f663948a1a83784d4977d086c63cfbfd6016019ab6755f8828c65ede830ca14`；唯一任务、V-001–V-004、Windows 结果、最终根门禁和阶段退出条件全部通过。
- 最终记录：[`change-0.md`](../../change-0.md) 与 [`effective-requirements.md`](../../effective-requirements.md) 已生成并交叉复核；snapshot SHA-256 为 `93373bb58fdbc3b1472b7d26c9e7c940d94e58fdcf99c6bb1fd6bc4bb50e0789`，change-0 SHA-256 为 `b1de5ce74bb1d79ba98d76d0ef9aeb67addf1da3f530d6b3256c1c0eced1e21f`。
- 当前安全状态：`completed/passed`，没有活动阶段、任务、恢复动作、服务、临时业务状态或外部写入。initial execution evidence 现已冻结；后续需求变化必须使用 `$apply-feature-change`。
- P-001 结论：两个任务、全部 P-001 core、实际执行的 supplemental、性能、安全、隐私、共享兼容和 build/runtime 硬门禁通过；验证结论 `passed`，没有开放 `FND-I-*`。
- 主体结果：[`../../../../../prototypes/agent-context/results/2026-07-25-macos-node24.md`](../../../../../prototypes/agent-context/results/2026-07-25-macos-node24.md) 为 `pass`；fixture `agent-context-v1`，Node `24.18.0`，macOS arm64。
- P-002 历史执行入口：当时单独调用 `$implement-planned-feature docs/requirements/agent-context-prototype/` 执行 P-002，并在任何结果或产品文件写入前切换到 Node `24.18.0` / pnpm `11.9.0`、复核 Git 基线和 [`phase-002-plan.md`](phase-002-plan.md) 的 `V-001` 前置；这些动作现已完成。
- P-002 计划：[`phase-002-plan.md`](phase-002-plan.md) revision 1，指纹 `sha256:3ccc6f720cf7a8aad199934db1dddf77c2e7f6c48a578a138e22e36479fa910c`；`compact`、`relaxed`、验证结论 `pending`。
- P-001 历史实施前基线：用户当时提交并推送先前 Task UI/Workspace CLI 改动，分支和 `origin/prototype` 均为 `cad7359c9a266021674c358055ac6dc2dac554c1`，工作区干净；requirements、roadmap 和 P-001 phase plan 指纹保持不变，计划目标文件无现有 diff。
- P-001 历史规划模式：初始路线图模式；当时不存在 `implementation-plan.md`、initial execution state、phase plan、phase result 或 `change-0.md`。
- 契约事实：schema `3.2`，feature ID、requirements、roadmap 和 execution 路径均与实际目录一致；契约未冻结且没有历史记录冲突。
- 需求事实：要求指纹已记录；`FR-001`–`FR-036` 和 `AC-001`–`AC-023` 连续、可观察、已追踪；`AC-001`–`AC-021` 为 core，`AC-022`/`AC-023` 为 supplemental；唯一必须回答项由用户明确选择 `relaxed`。
- 实现事实：独立 Agent Context 模块、自动化和 runner 已交付；`context-sources.json` 的项目/任务优先级已固定；manifest/正文分离、预算、分页、渐进读取、参考消费者、跨用户边界、摘要、Skill 和注入对照均由确定性证据覆盖。
- 依赖事实：`packages/test-fixtures` 已有 Task UI 图与 Workspace 授权 fixture；生产 `resolveWorkspaceReadAccess` 对跨用户用户级来源更严格，本原型只能使用合成底层允许事实，不能修改生产授权。
- 前置主体事实：Task UI initial run 已在 Windows x64 完成并以 `passed` 封存；Workspace Sync P-003 macOS 主体结果仍为 `completed/passed`；Agent Context P-001 macOS/Node 主体为 `pass`。三个主体前置均已满足。
- P-002 漂移事实：当前 HEAD 为 `849bd2d`；`a3044bf..HEAD` 只包含 Task UI Windows 阶段、三个 Workspace CLI 跨平台测试文件及其工作流/结果证据，Agent Context 自有核心、测试、runner、夹具和结果无变化。当前工作区在本次规划写入前干净。
- P-002 环境事实：当前为 Windows x64，OS build `26200`；项目要求 Node `24.18.0` / pnpm `11.9.0`。当前 shell 默认 Node 为 `v20.13.1`，bundled runtime 为 `v24.14.0`；执行 P-002 前必须选择精确的 `v24.18.0`，否则在产生平台结论前暂停。
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
| `P-001-T-001` | completed | 新增版本化纯 TypeScript Agent Context 核心、25 项专项自动化和 Node 无头 runner；修正 Agent Context JSON 的项目/任务优先级；manifest 与正文分离，支持稳定发现/排序/预算/分页、重新授权读取和确定性分析；没有修改 Task UI、Workspace Sync、package manifest、生产授权或锁文件 | Node `24.18.0`；`@ngapd/test-fixtures` typecheck pass；`src/agent-context.test.ts` 25/25 pass；无头 runner 12/12 core 场景 pass，deep/wide/dense P95 分别为 0.348/0.840/0.345 ms |
| `P-001-T-002` | completed | 最终 core/P95、共享包门禁和根门禁通过；新增完整 macOS/Node `pass` 结果；`.vscode/settings.json` 只做等价 Prettier 格式兼容；创建不可变 P-001 result 并安全等待 | 最终 runner 12/12 core；P95 0.420/0.852/0.343 ms；test-fixtures build/typecheck/37 tests pass；真实 macOS 环境根 `pnpm check` pass |
| `P-002-T-001` | completed | 使用 P-001 的 `agent-context-v1` 在 Windows 11 x64 / Node 24.18.0 完成同一确定性 core、性能、平台结果、最终共享门禁与封存前检查；没有产品修改或开放 finding | V-001 17/17；runner 12/12；P95 0.575/1.319/0.580 ms；根 `pnpm check` 退出码 0；V-004 21/21 前关闭断言通过 |

## 5. 运行累计文件变化

| 文件 | 修改模式 | 归属与状态 |
| --- | --- | --- |
| `docs/requirements/agent-context-prototype/requirements.md` | add（既有输入） | 用户已批准需求；本次规划只读，未修改 |
| `docs/requirements/agent-context-prototype/workflow-contract.md` | add（既有输入） | schema 3.2 不可变契约；本次规划只读，未修改 |
| `docs/requirements/agent-context-prototype/implementation-plan.md` | add | 初始路线图 revision 1 |
| `docs/requirements/agent-context-prototype/execution/initial/phase-001-plan.md` | add | 唯一即时阶段计划 revision 1 |
| `docs/requirements/agent-context-prototype/execution/initial/execution-state.md` | add/modify | 当前执行协调权威；运行状态 `completed/passed`，没有活动阶段或任务 |
| `docs/requirements/agent-context-prototype/execution/initial/phase-002-plan.md` | add | P-002 唯一即时阶段计划 revision 1 |
| `packages/test-fixtures/src/agent-context.ts` | add | Agent Context 类型、校验、发现、排序、预算、分页、渐进读取、授权快照、分析与版本化合成夹具 |
| `packages/test-fixtures/src/agent-context.test.ts` | add | 25 项确定性、负向输入、发现、预算、分页、授权、读取、摘要、Skill、注入、分析和规模集成自动化 |
| `packages/test-fixtures/src/index.ts` | modify | 只新增 Agent Context 模块导出；既有 Task UI/Workspace 导出未变 |
| `prototypes/agent-context/run.ts` | add | Node 无头 core 场景和三种 Task UI 主体规模的 manifest P95 测量 |
| `prototypes/agent-context/fixtures/context-sources.json` | modify | 增加版本、稳定输入与双层授权元数据；固定系统 > 项目 > 当前任务 > 用户流程优先级；保留旧 `allowed: false` 默认发现兼容字段 |
| `prototypes/agent-context/README.md` | modify | 记录核心边界、无头命令、证据范围和性能口径 |
| `prototypes/agent-context/results/README.md` | modify | 补全结果字段和主体结论规则 |
| `prototypes/agent-context/results/2026-07-25-macos-node24.md` | add | macOS arm64 / Node 24 P-001 主体 `pass` 记录 |
| `prototypes/agent-context/results/2026-07-26-windows-x64-node24.md` | add | Windows 11 x64 / Node 24 P-002 主体 `pass` 记录；同夹具、core、性能、授权和封存前证据 |
| `.vscode/settings.json` | format-only | 实施起点新增文件的 JSON 值不变，仅修正 Prettier 缩进和末尾换行以闭合根格式门禁 |
| `docs/requirements/agent-context-prototype/execution/initial/phase-001-result.md` | add | P-001 不可变完成证据 |
| `docs/requirements/agent-context-prototype/execution/initial/phase-002-result.md` | add | P-002 不可变完成证据；Windows core、最终共享门禁、范围、finding 与最终化入口 |
| `docs/requirements/agent-context-prototype/effective-requirements.md` | add | 应用至 change-0 的自足当前有效需求快照；36 FR、23 AC、决策、finding 和来源链 |
| `docs/requirements/agent-context-prototype/change-0.md` | add | initial run 的不可变实现、inventory、任务、验证、偏差和遗留汇总 |

没有修改 Task UI/Workspace Sync 行为、package manifest、锁文件、生产授权、正式 API/Web/MCP、数据库或 migration。

## 6. 测试与验证证据

| 检查 | 范围 | 观察结果 | 结论 |
| --- | --- | --- | --- |
| 契约与路径审计 | requirements、workflow contract、feature directory | schema 3.2；声明路径一致；无 roadmap/state/result/change-0 或 frozen history | pass |
| 需求完整性与策略 | 完整 requirements | 36 个 FR、23 个 AC；policy 位于功能需求前；全部 AC 分层；必须回答项来自用户明确确认；未决问题为无 | pass |
| 项目实现基线 | Agent Context、test-fixtures、domain authorization、Task UI/Workspace Sync 证据、根工具链 | 支持两阶段 compact 方案；P-001 可独立执行；P-002 目前缺少 Windows 入口 | pass |
| 用户工作保护 | `git status` 与相关 file-level diff | 存在 Task UI/Workspace CLI 用户变化；P-001 已规划为独立新增模块并明确不触及占用文件 | pass |
| 需求追踪 | 路线图矩阵 | `FR-001`–`FR-036`、`AC-001`–`AC-023` 全部映射到 P-001/P-002 和验证 | pass |
| Node 与 pnpm | 项目 `.node-version` 对应的 macOS Node 24.18.0 运行时 | `node v24.18.0`；`pnpm 11.9.0` | pass |
| T-001 类型检查 | `pnpm --filter @ngapd/test-fixtures typecheck` | TypeScript 无错误 | pass |
| T-001 专项自动化 | `pnpm --dir packages/test-fixtures exec vitest run src/agent-context.test.ts` | 1 file、25 tests 全部通过 | pass |
| T-001 无头 core | `pnpm exec tsx prototypes/agent-context/run.ts` | 12 个 core 场景全部通过；预算 6000、必需 3050、选用 5810；分页 28 项、page size 4；授权保持只读、无管理员模式和租约 | pass |
| T-001 性能 | 同一无头命令中的 80 次/规模 manifest-only 测量 | deep-tree 24 tasks P95 0.348 ms；wide-siblings 205 tasks/300 deps P95 0.840 ms；dense-dag 36 tasks/48 deps P95 0.345 ms；均 `< 1s` | pass |
| T-001 范围复核 | `git diff --name-only`、`git diff --check` | 只有计划声明的 Agent Context/core/export/fixture/README/state 文件；没有空白错误、Task UI/Workspace/生产授权/package/lock 改动 | pass |
| T-002 根门禁首次尝试 | `pnpm check` | `format:check` 发现实施起点 `cad7359` 新增的 `.vscode/settings.json` 缩进不符合 Prettier，命令在 lint/build/typecheck/test 前退出；文件 JSON 值可由 Prettier 等价格式化 | fail（修复后重跑） |
| T-002 最终无头 core | `pnpm exec tsx prototypes/agent-context/run.ts` | 最终文件状态；12/12 core；预算 6000、必需 3050、选用 5810；28 个条目/page size 4；授权只读、无 admin/lease | pass |
| T-002 最终性能 | 同一 runner，80 次/规模 manifest-only | deep-tree P95 0.420 ms；wide-siblings P95 0.852 ms；dense-dag P95 0.343 ms；均 `< 1s` | pass |
| T-002 共享包 build/typecheck/test | `pnpm --filter @ngapd/test-fixtures build/typecheck/test` | build、typecheck 通过；5 files、37 tests 通过 | pass |
| T-002 根门禁沙箱诊断 | 修复格式后的 `pnpm check` | format/lint/build/typecheck 通过；既有 macOS Keychain 测试因沙箱无法创建隔离钥匙串失败 | 环境限制；真实环境复核 |
| T-002 最终根门禁 | 真实 macOS 权限环境的同一 `pnpm check` | format、lint、10 个 workspace build/typecheck 和全部适用测试通过；Workspace CLI Keychain 集成通过 | pass |
| T-002 结果与阶段证据 | macOS 主体记录、phase result、`git diff --check` | 结果字段完整，phase result 与本 state 一致，无 whitespace error | pass |
| P-002 滚动规划指纹 | requirements、roadmap、P-001 plan/result | requirements `569d2e65…524a`、roadmap `e658381e…c339` 与 state 一致；P-001 result 保持不可变 | pass |
| P-002 主体与项目漂移 | Task UI change-0/state、Workspace Sync P-003 result、`a3044bf..HEAD` | Task UI `completed/passed`；Workspace Sync P-003 `completed/passed`；Agent Context 自有文件无漂移 | pass |
| P-002 Windows 入口 | OS/runtime/架构只读探测与既有 Task UI Windows 证据 | Windows build 26200、x64；同机已有 Node 24 x64 且 Task UI 持久证据使用 Node 24.18.0；当前 shell 必须在执行前切回精确版本 | pass with execution preflight |
| P-002 计划格式与追踪 | phase-002 plan、路线图矩阵、`FR-035` / `AC-021` 与最终追踪 | 一个 compact 任务覆盖 Windows core、结果、根门禁和最终封存前置；全部 FR/AC 仍有阶段与验证映射 | pass |
| P-002 V-001 精确前置 | Windows build/架构、Node/pnpm、Git/指纹、P-001 不可变证据、三个主体和夹具 | build `26200`、`win32/x64`、Node `v24.18.0`、pnpm `11.9.0`；17/17 断言通过 | pass |
| P-002 V-002 Windows core | `pnpm exec tsx prototypes/agent-context/run.ts` | `agent-context-v1`；12/12 core；预算 6000/必需 3050/选用 5810；28 项/page size 4；授权只读；三档 P95 0.575/1.319/0.580 ms | pass |
| P-002 V-003 最终根门禁 | Node `24.18.0` / pnpm `11.9.0` 的 `pnpm check` | format、lint、10 个 workspace build/typecheck、全部适用 test 退出码 0；test-fixtures 5 files/37 tests，包含 Agent Context 25 项专项测试 | pass |
| P-002 V-004 封存前复核 | Windows result、P-001 指纹、最终范围/秘密/whitespace、路线图全量追踪 | 结果字段完整；P-001 plan/result 指纹未变；仅计划内 3 个文件；无秘密模式或空白错误；21/21 前关闭断言通过 | pass |
| initial 最终化 | 完整 requirements、roadmap、state、P-001/P-002 plans/results、change-0、effective snapshot 与最终 diff | 指纹、连续 ID、全量 inventory、36 FR/23 AC、`passed` 策略结论、跨阶段不变量和无 finding 状态一致；最终工件格式、秘密/个人路径和 whitespace 检查通过 | pass |

首次调用 `tsx` 时沙箱禁止其本地 IPC pipe，出现 `listen EPERM`；在允许本地 IPC 的同一 Node 24 环境重跑后命令完整通过。这是已关闭的执行容器限制，不是产品、core 或 report-only finding。

## 7. 决策、待确认问题与回答

| ID | 阶段/任务 | 问题 | 已确认事实 | 可选方案与影响 | 需要确认 | 状态 | 用户回答及来源 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Q-001 | requirements | 交付与验证策略 | schema 3.2 每个运行必须由用户选择 strict 或 relaxed | strict：全部 supplemental 阻塞；relaxed：已证明无 core 影响的 supplemental 异常可 report-only | 选择 initial run 策略 | resolved | 用户明确选择 `relaxed`，已记录于 requirements |

无未决问题。

## 8. 发现项、偏差、风险与阻塞

- 下一可用 finding ID：`FND-I-001`。
- 当前没有 `FND-I-*`，P-001 验证结论为 `passed`。
- 当前没有产品偏差、阻塞、未决问题、开放 `FND-I-*`、活动阶段或活动任务；P-002 不可变结果、change-0 和有效需求快照已创建，运行已完成。
- 项目基线从规划时的 `bcae1aa` 前移到用户已提交并推送的 `cad7359`；已复核规划指纹和计划文件范围不变，属于可直接吸收的已确认项目漂移，不改变需求、路线图、阶段或任务边界。
- T-002 根 `pnpm check` 首次尝试暴露 `.vscode/settings.json` 的既有格式失败。该文件来自实施起点 `cad7359`，与 Agent Context 无语义重叠；为满足明确的根硬门禁，采用只改变空白的 Prettier 修复并从头重跑。此偏差不改变产品行为、阶段边界或用户设置值。
- Node 22 规划环境差异已通过实施和全部最终证据统一使用 Node `24.18.0` 关闭。
- 规划时的共享 Task UI/test-fixtures 用户变化已由用户提交为 `cad7359`；P-001 没有修改其占用文件或语义。
- P-002 的真实 Windows x64 入口现已可用，外部环境阻塞已关闭。当前 shell 的默认 Node 20 和 bundled Node 24.14 不是本阶段结果运行时；执行前切换到项目固定的 Node 24.18.0 是硬前置，不是 finding。
- P-002 执行已使用校验后的 Node 24.18.0 关闭上述前置；首次启动器路径失败发生在原型加载前，修正本地 `.bin` 搜索后同一主体与根门禁通过，不构成产品、兼容或 report-only finding。

## 9. 精确恢复步骤

Initial run 已完成，没有部分任务或恢复动作：

1. 保持 requirements、workflow contract、路线图、两个阶段的 plans/results、macOS/Windows `pass` 结果、`effective-requirements.md`、`change-0.md` 和本 state 冻结。
2. 不重复执行或改写已稳定的 initial 证据，不用后续需求覆盖 `change-0.md`。
3. 后续行为或需求变化只能调用 `$apply-feature-change`，从 `change-1.md` 连续记录并更新有效需求快照。
4. 若仅需审计本工作流，使用 `$analyze-feature-workflow` 读取冻结历史，不修改功能或记录。

## 10. 最终完成门禁

- [x] schema 3.2 契约、requirements、路线图和唯一 P-001 计划一致。
- [x] 用户明确的 `relaxed` 策略、core/supplemental 分层和下一 `FND-I-*` 已记录。
- [x] 初始规划时 P-001 是唯一 `ready` 阶段；P-002 没有被提前规划。
- [x] 规划未修改生产文件，既有用户变化已记录且不被认领。

- [x] P-001 的两个任务、全部 P-001 core、macOS/Node 主体、性能和根工程硬门禁通过。
- [x] P-001 形成不可变 phase result，运行安全转为 `awaiting_next_phase`。
- [x] P-002 外部前置、项目漂移和映射已复核，并按唯一即时计划 revision 1 进入执行。
- [x] P-002 在真实 Windows 11 x64/Node 24 完成 core、最终门禁和阶段封存。
- [x] `FR-001`–`FR-036` 和 `AC-001`–`AC-023` 的阶段级及最终记录追踪一致。
- [x] 所有安全、隐私、授权、兼容、build/runtime、恢复和平台硬门禁通过。
- [x] 没有开放 `FND-I-*`；relaxed finding 汇总规则已复核。
- [x] 没有未决产品问题、用户工作重叠、活动进程、半完成实现或未知外部状态。
- [x] `change-0.md` 与 `effective-requirements.md` 在 P-002 最终门禁通过后创建并与本 state 一致。
- [x] 运行最终更新为 `completed`，验证结论为 `passed`。
