# P-001：Agent Context 核心与 macOS/Node 主体验证

- 运行编号：`initial`
- 阶段编号：`P-001`
- 计划修订：`1`
- 父路线图修订：`1`
- 需求指纹：`sha256:569d2e655ef3f346b5196c9e594ccc20c476131b9107a4c6eacfa0b3ed30524a`
- 项目基线：分支 `prototype`，提交 `bcae1aa1c66081c67ecbb9f6391b9613927f775a`
- 创建日期：`2026-07-25`
- 详细度：`compact`
- 交付与验证策略：`relaxed`
- 验证结论：`pending`

## 1. 阶段目标、边界与关联需求

交付一个不依赖登录、PostgreSQL、真实 Workspace、Web 或外部网络的确定性 Agent Context 原型：从版本化合成数据生成只含引用和元数据的上下文清单，完成稳定排序、游标分页、必需来源预算保护、整项裁剪、重新授权的渐进读取和确定性参考分析，并在当前 macOS/Node 24 环境形成可追溯主体 `pass` 结果。

本阶段覆盖 `FR-001`–`FR-034`、`FR-036` 与 `AC-001`–`AC-020`；`AC-022`、`AC-023` 是 supplemental。`FR-035`/`AC-021` 的 Windows 11 x64 core 不在本阶段执行，但“P-001 后安全等待且不最终封存”是本阶段出口硬约束。

不在本阶段实现或修改：正式 Agent Session/Context Manifest/KnowledgeEntry/Task Follow、数据库或 migration、正式 API/Web/MCP/Workspace CLI 业务入口、生产 Workspace 授权、真实数据、本地 IPC、外部 API/AI/LLM、Skill 执行、Task UI 语义或 Workspace Sync 协议。不得修改现有用户拥有的 `packages/test-fixtures/src/task-graph*`、`packages/test-fixtures/package.json`、Web、Workspace CLI 测试或 `pnpm-lock.yaml` 变化。

开始第一个任务前必须确认 requirements、路线图和本计划的 revision/指纹一致，不存在 `change-0.md`、P-001 result 或另一活动阶段；重新检查计划文件范围没有新的用户重叠；切换到 `.node-version` 的 Node `24.18.0`。任一所有权事实不唯一时暂停，不猜测或覆盖。

## 2. 任务与文件范围

| 任务 | 结果 | 文件或范围 | 实现摘要 | 验证 | 完成条件 |
| --- | --- | --- | --- | --- | --- |
| `P-001-T-001` | 版本化合成 fixture、确定性 manifest/预算/分页/读取/分析核心和自动化场景可由 Node 直接调用 | 新增 `packages/test-fixtures/src/agent-context.ts`、`packages/test-fixtures/src/agent-context.test.ts`、`prototypes/agent-context/run.ts`；修改 `packages/test-fixtures/src/index.ts`、`prototypes/agent-context/fixtures/context-sources.json`、`prototypes/agent-context/README.md`；读取但不修改 `workspace-injection.md` 和 Task UI/Workspace 授权 fixture | 用独立纯模块实现输入校验、双层发现门禁、关系展开、固定排序、必需/可选预算、不透明绑定游标、版本化重新授权读取和参考消费者；runner 组合全部主体 core 场景与规范化预期，不增加依赖或正式产品入口 | `@ngapd/test-fixtures` 目标测试覆盖正负场景；runner 在 Node 24 下无登录、数据库、Web 或网络执行；复核 diff 不触及用户拥有文件 | 所有 P-001 行为都有确定性自动断言；无效输入不产出部分清单；manifest 无正文；权限/注入/版本/预算失败稳定；共享 Task UI 接口保持原样 |
| `P-001-T-002` | 完成性能、共享兼容、安全复核与可追溯 macOS/Node 主体结果，运行进入安全等待 | `prototypes/agent-context/results/README.md`、新增唯一 `prototypes/agent-context/results/YYYY-MM-DD-macos-node24.md`，以及本阶段 execution state/result；其余仅验证 | 在最终实现状态执行 runner core 矩阵和只测 manifest 的重复 P95；运行 test-fixtures build/typecheck/test 与一次最终根门禁；记录环境、commit、fixture、预算、排序、分页、权限、裁剪、注入、摘要、性能与证据；合规汇总 `FND-I-*` | P95 `< 1s`；所有 P-001 core/安全/隐私/兼容/构建硬门禁通过；最终 `pnpm check` 通过；结果字段完整且结论规则正确 | macOS/Node 主体记录为 `pass`，或在实际 core 失败/证据不足时如实为 `fail`/`inconclusive` 并暂停；通过时创建不可变 P-001 result，state 转为 `awaiting_next_phase`，不创建 P-002 计划或最终记录 |

依赖：`P-001-T-002` 只在 `P-001-T-001` 完成并记录 checkpoint 后开始。

## 3. 验证与完成条件

- Core/硬门禁：`AC-001`–`AC-020` 中属于 P-001 的全部结果、权限与隐私、提示注入隔离、确定性、预算保护、分页/版本正确性、P95、共享包与根工程可构建性、只使用合成数据及结果可追溯性全部阻塞。
- 目标自动化：在 `@ngapd/test-fixtures` 验证无效输入、默认/排除候选、冲突优先级、角色、祖先、predecessor、一跳关注/环、跨用户拒绝与显式允许、Skill 冲突、三类摘要、manifest 正文隔离、预算不足/守恒、分页等价/失效、渐进读取、参考分析和注入对照。
- 主体入口：在 Node 24 执行固定 core 场景并逐字段比较规范化输出；同一输入重复或并行执行必须相同，运行不得产生外部请求、真实数据或持久化业务状态。
- 性能：主体规模至少包含 Task UI 深树、200 同级和密集 DAG 以及 Agent Context 来源；只统计 manifest 生成，记录样本/重复次数和 P95，结果必须 `< 1s`。
- 最终兼容：所有代码和 fixture 稳定后执行 test-fixtures build/typecheck/test 与一次根 `pnpm check`。后续若代码、fixture、导出或结果生成逻辑变化使证据失效，只重跑受影响检查。
- Supplemental：`AC-022`/`AC-023` 可在低成本时执行；未要求额外性能数值或强制 trace。观察到异常时，只有独立证明不影响任何 core/硬门禁后才可登记 `FND-I-*` 并保留，否则阻塞。
- P-001 完成要求：macOS/Node 结果为 `pass`，阶段 result 冻结，当前任务为无，项目没有半完成运行或外部服务；P-002 仍为 `planned`，`change-0.md` 与 `effective-requirements.md` 不存在。

## 4. 风险、恢复与修订记录

- 共享所有权：`task-graph.ts`、`task-graph.test.ts`、`packages/test-fixtures/package.json`、Web、Workspace CLI 测试和锁文件已有用户变化。T-001 只消费其当前接口；若实现必须编辑其中任何文件，先暂停并记录原因与可选边界，不扩大本计划权限。
- 恢复：本阶段没有数据库、生产写入或外部副作用。任务中断时保留本功能文件的实际 diff 和已观察测试，在 state 中标记当前任务 `in_progress`；不得通过 reset、checkout 或删除共享包来恢复。
- Node 版本：当前规划 shell 是 Node 22；实施和主体证据必须使用 Node `24.18.0`，否则结果为不合格环境证据而不能完成任务。
- Windows：当前没有真实 Windows 入口。P-001 通过后只安全等待；缺少 Windows 不是 finding，不能用 macOS 重跑、模拟路径语义或 supplemental 记录替代。
- relaxed findings：下一可用 ID 从 `FND-I-001` 开始。安全、隐私、授权、兼容、build/runtime、未知影响、required gate 或未独立证明的 core 异常始终阻塞。

| 修订 | 日期 | 原结论 | 原因与证据 | 影响任务 |
| --- | --- | --- | --- | --- |
| 1 | 2026-07-25 | 初始 P-001 计划 | 路线图 revision 1、需求完整审计和当前 file-level 所有权事实支持两个顺序任务；实现与 macOS 主体验收可在一个安全阶段闭合 | `P-001-T-001`、`P-001-T-002` |
