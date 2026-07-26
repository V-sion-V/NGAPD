# P-002：Agent Context Windows core 与最终封存计划

- 运行编号：`initial`
- 阶段编号：`P-002`
- 计划修订：`1`
- 父路线图修订：`1`
- 需求指纹：`sha256:569d2e655ef3f346b5196c9e594ccc20c476131b9107a4c6eacfa0b3ed30524a`
- 项目基线：分支 `prototype`，提交 `849bd2dd86468ee30d062e36a602c52c72c25690`
- 创建日期：`2026-07-26`
- 计划详细度：`compact`
- 交付与验证策略：`relaxed`
- 验证结论：`pending`

## 1. 阶段目标、边界与关联需求

本阶段在真实 Windows 11 x64 和 Node 24 环境中使用与 P-001 相同的 `agent-context-v1` 夹具及确定性 core，完成 `FR-035` / `AC-021`，并最终复核 P-001 已交付的 `FR-001`–`FR-036`、`AC-001`–`AC-023` 和全部硬门禁。P-001 的计划、结果和 macOS/Node 主体记录保持不可变；Task UI initial run 已以 `passed` 封存，Workspace Sync P-003 macOS 主体结果仍为 `passed`。

当前 Windows 主机为 x64、build `26200`。当前 shell 默认 Node 为 `v20.13.1`，Codex bundled runtime 为 `v24.14.0`；执行任何主体或结果命令前必须选择仓库 `.node-version` 固定的 Node `v24.18.0` 和 pnpm `11.9.0`。若该精确运行时不可用，阶段必须在产生 Windows 结论或修改产品文件前暂停，不能用 Node 20、Node 24.14、macOS 重跑或历史 Task UI 结果代替。

本阶段默认不修改实现。只有真实 Windows core 暴露 Agent Context 自有的确定性或兼容缺陷时，才允许在 Agent Context 核心、测试、runner、夹具和说明范围内做最小修正并重跑受影响证据；不得改写 P-001 结果、Task UI、Workspace Sync、生产授权、正式 API/Web/MCP、数据库、package manifest 或锁文件。`AC-022` / `AC-023` 保持 supplemental；不为已由 P-001 证明且未被漂移影响的附加诊断单独安排重跑或修复任务。合规 report-only finding 从 `FND-I-001` 连续编号。

## 2. 任务与文件范围

| 任务 | 结果 | 文件或范围 | 实现摘要 | 验证 | 完成条件 |
| --- | --- | --- | --- | --- | --- |
| `P-002-T-001` | 完成同夹具 Windows core、平台结果与 initial run 最终门禁 | `prototypes/agent-context/results/2026-07-26-windows-x64-node24.md`；仅在真实 core 缺陷时可修改 `packages/test-fixtures/src/agent-context.ts`、`packages/test-fixtures/src/agent-context.test.ts`、`packages/test-fixtures/src/index.ts`、`prototypes/agent-context/run.ts`、`prototypes/agent-context/fixtures/**` 和自有 README；工作流结果与最终记录由执行技能按契约生成 | 先锁定 Node 24.18.0、当前 Git 基线、P-001 不可变证据和三个主体状态；执行同一无头 core 和最终共享门禁，记录 Windows 环境、夹具、预算、分页、授权、注入、摘要、分析和 P95；没有真实缺陷时只追加结果与工作流证据 | `V-001`–`V-004` | Windows 结果为 `pass`；全部 core 与硬门禁通过；supplemental 复用有效证据、通过或形成合规 finding；最终追踪、范围、用户工作保护和封存前置闭合 |

## 3. 验证与完成条件

| 验证 | 层级 | 执行与可观察结果 |
| --- | --- | --- |
| `V-001` | core / hard gate | 在任何实现或结果写入前确认 Windows build `26200`、`win32/x64`、Node `v24.18.0`、pnpm `11.9.0`、分支 `prototype` 和计划基线；复核 requirements/roadmap 指纹、P-001 plan/result 不可变、Agent Context 自有文件自 `a3044bf` 后无漂移、Task UI `completed/passed`、Workspace Sync P-003 `completed/passed`，且夹具版本仍为 `agent-context-v1`。任一项不成立即暂停。 |
| `V-002` | core | 使用 Node 24.18.0 执行 `pnpm exec tsx prototypes/agent-context/run.ts`；相同夹具在 Windows 覆盖正常预算、预算不足、多页/游标漂移、祖先、predecessor、一跳关注与环、跨用户拒绝/显式只读、三类摘要、Skill 冲突、来源版本失效、重新授权、提示注入和确定性参考分析。12 个 core 场景全部通过，manifest-only deep/wide/dense P95 均 `< 1000 ms`。 |
| `V-003` | core / hard gate | 在所有实现和 Windows 结果变化稳定后一次执行根 `pnpm check`；其 `@ngapd/test-fixtures` build/typecheck/test 必须包含 Agent Context 25 项专项测试并全部通过，根 format、lint、全部适用 workspace build/typecheck/test 退出码为 0。若真实 Windows 缺陷导致源码修正，先做最小目标诊断，但只有这次最终门禁作为共享完成证据。 |
| `V-004` | core / closeout | 新增而不覆盖历史 Windows 结果，逐项核对其环境、commit、`agent-context-v1`、预算、排序、分页、授权、裁剪、注入、摘要、分析、性能和仓库相对证据；执行 `git diff --check`、范围/秘密审查及 `FR-001`–`FR-036` / `AC-001`–`AC-023` 最终追踪。全部开放 `FND-I-*` 必须按 relaxed 规则处置，且不得存在 core、兼容、安全、build/runtime、用户工作或未知影响 finding。 |

阶段只有在 P-001 不可变证据仍一致、Windows 结果为 `pass`、根工程门禁与最终追踪通过、没有未决问题或未知用户工作重叠时才能创建不可变 `phase-002-result.md`。这是路线图最终阶段；阶段结果完成后由 `$implement-planned-feature` 复核全部 initial 证据，再生成 `change-0.md`、`effective-requirements.md` 并把运行置为 `completed`。

## 4. 风险、恢复与修订记录

- 当前 shell 的 Node `v20.13.1` 和 bundled Node `v24.14.0` 都不能生成本阶段结果；必须先选择项目钉住的 `v24.18.0`。运行时不可用属于执行前阻塞，不是 `FND-I-*`，也不能降低 `AC-021`。
- P-001 提交 `a3044bf` 之后，Agent Context 自有核心、测试、runner、夹具和结果没有漂移；后续 `849bd2d` 只完成 Task UI Windows 阶段及三个 Workspace CLI 测试的跨平台修正。当前根门禁已有同提交 Windows `passed` 证据，但本阶段仍在最新结果状态执行一次契约要求的最终根门禁。
- Windows core 失败阻塞 `pass`。修正只落在本阶段声明的 Agent Context 自有范围；若需要 Task UI、Workspace Sync、生产授权、正式接口、package manifest、锁文件或需求行为变化，立即暂停，不扩大阶段权限。
- 本阶段无 migration、数据库写入、多 writer 或不可逆操作。中断时保留已完成的只读证据和当前 diff，在 state 记录精确恢复点；不得删除其他原型结果、重写 P-001 工件或用失败/不完整记录继续最终封存。
- Windows 结果不得包含个人绝对路径、凭据、令牌、真实用户/项目/Workspace 内容或外部发送数据。证据不足时阶段保持未完成，不能把结果标为 `pass`。

| 修订 | 日期 | 变更 | 原因与影响 |
| --- | --- | --- | --- |
| 1 | 2026-07-26 | 首次即时创建 P-002 compact 计划 | P-001、Task UI、Workspace Sync 主体和真实 Windows x64 前置已满足；Agent Context 自有文件无漂移，最终平台门禁可由一个无生产改动的集中验证任务闭合 |
