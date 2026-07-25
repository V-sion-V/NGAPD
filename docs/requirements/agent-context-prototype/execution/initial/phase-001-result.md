# P-001 阶段结果：Agent Context 核心与 macOS/Node 主体验证

- 运行编号：`initial`
- 阶段编号：`P-001`
- 阶段计划：[`phase-001-plan.md`](phase-001-plan.md)
- 阶段计划修订：`1`
- 父路线图修订：`1`
- 完成日期：`2026-07-25`
- 状态：`completed`
- 交付与验证策略：`relaxed`
- 验证结论：`passed`
- 实施起点：分支 `prototype`，提交 `cad7359c9a266021674c358055ac6dc2dac554c1`

## 1. 阶段目标与结果

P-001 已交付一个不依赖登录、PostgreSQL、真实 Workspace、Web 或外部网络的确定性 Agent Context 原型。纯 TypeScript 核心从版本化合成值生成只含引用和元数据的 manifest，完成输入校验、双层发现门禁、固定排序、必需/可选预算、绑定游标分页、逐次重新授权的渐进读取和只使用成功读取结果的结构化参考分析。

Node 24 无头入口覆盖正常预算、预算不足、多页、游标漂移、祖先、predecessor、一跳关注与环、跨用户默认拒绝/显式只读、三类摘要、Skill 冲突、来源版本失效、重新授权、提示注入和确定性分析。最终 macOS/Node 主体结果为 `pass`，三种主体规模的 manifest-only P95 均远小于 1 秒。

本阶段没有修改 Task UI 语义、Workspace Sync 协议、生产授权、正式 API/Web/MCP、数据库、package manifest 或锁文件，没有外部服务或持久化副作用。项目处于可构建的只读安全等待状态；P-002 仍为 `planned` 且没有提前创建详细计划，initial run 未最终封存。

## 2. 任务、需求与验收覆盖

| 任务 | 状态 | 需求与验收 | 完成证据 |
| --- | --- | --- | --- |
| `P-001-T-001` | completed | `FR-001`–`FR-032`; `AC-001`–`AC-016`, `AC-018`, `AC-019` | 独立 Agent Context 核心、25 项专项自动化、Node runner；确定性、负向输入、发现、排序、预算、分页、读取、分析、跨用户、摘要、Skill 和注入边界全部通过 |
| `P-001-T-002` | completed | `FR-033`, `FR-034`, `FR-036`; `AC-017`, `AC-020`, `AC-022`, `AC-023` | 最终 runner 12/12 core 场景通过；三规模 P95 通过；test-fixtures 和根硬门禁通过；macOS/Node `pass` 记录完整 |
| P-001 安全等待约束 | completed | 持续保持 `FR-035` / `AC-021` | 未创建 P-002 plan、`change-0.md` 或 `effective-requirements.md`；Windows 11 x64/Node 24 core 仍为 final blocking gate |

P-001 范围内 `AC-001`–`AC-020` 的 core 均有独立自动化或主体证据。`AC-022` 的附加规模/小分页和 `AC-023` 的诊断面均以低成本执行且未观察到异常；没有把 core 降级为 supplemental。

## 3. 文件修改

| 文件 | 修改模式 | 结果 |
| --- | --- | --- |
| `packages/test-fixtures/src/agent-context.ts` | add | 类型、稳定错误、输入校验、发现/排序/预算/分页、游标绑定、渐进读取、授权快照、结构化分析和版本化合成夹具 |
| `packages/test-fixtures/src/agent-context.test.ts` | add | 25 项 core、负向输入、兼容和三种 Task UI 规模自动化 |
| `packages/test-fixtures/src/index.ts` | modify | 新增 Agent Context 导出；既有 Task UI/Workspace 导出保持不变 |
| `prototypes/agent-context/run.ts` | add | Node 无头 core runner 和 manifest-only P95 测量 |
| `prototypes/agent-context/fixtures/context-sources.json` | modify | 增加 schema/fixture/input 版本、必需/信任/双层权限元数据，固定系统 > 项目 > 当前任务 > 用户流程；保留旧默认拒绝兼容字段 |
| `prototypes/agent-context/README.md` | modify | 记录执行入口、manifest/正文边界、场景和性能口径 |
| `prototypes/agent-context/results/README.md` | modify | 补全主体结果字段和 `pass`/`fail`/`inconclusive` 规则 |
| `prototypes/agent-context/results/2026-07-25-macos-node24.md` | add | macOS arm64 / Node 24 主体 `pass` 证据 |
| `.vscode/settings.json` | format-only | 实施起点 `cad7359` 的 JSON 值不变，仅用 Prettier 修正缩进和末尾换行，以通过明确的根格式硬门禁 |
| `docs/requirements/agent-context-prototype/execution/initial/execution-state.md` | modify | T-001/T-002 前后检查点、实际证据、偏差、恢复步骤和阶段关闭状态 |
| `docs/requirements/agent-context-prototype/execution/initial/phase-001-result.md` | add | 本不可变阶段结果 |

没有修改 `packages/test-fixtures/src/task-graph*`、`packages/test-fixtures/package.json`、Web、Workspace CLI 业务/测试、`pnpm-lock.yaml`、`packages/domain/src/authorization.ts`、数据库或 migration。

## 4. 测试与验证

| 命令或证据 | 环境与观察结果 | 结论 |
| --- | --- | --- |
| `pnpm --dir packages/test-fixtures exec vitest run src/agent-context.test.ts` | Node `24.18.0`；1 file、25 tests | pass |
| `pnpm exec tsx prototypes/agent-context/run.ts` | 最终文件状态；12/12 core；预算 6000、必需 3050、选用 5810；28 个分页诊断条目；授权只读且无 admin/lease | pass |
| runner performance | 80 次/规模；deep-tree P95 `0.420 ms`、wide-siblings `0.852 ms`、dense-dag `0.343 ms` | pass，全部 `< 1000 ms` |
| `pnpm --filter @ngapd/test-fixtures build` | TypeScript emit 成功 | pass |
| `pnpm --filter @ngapd/test-fixtures typecheck` | TypeScript 无错误 | pass |
| `pnpm --filter @ngapd/test-fixtures test` | 5 files、37 tests | pass |
| `pnpm check` | Node 24 真实 macOS 环境；format、lint、10 个 workspace build/typecheck、全部适用测试通过 | pass |
| `git diff --check` | 无 whitespace error | pass |
| [`2026-07-25-macos-node24.md`](../../../../../prototypes/agent-context/results/2026-07-25-macos-node24.md) | 环境、commit、夹具、预算、排序、分页、权限、裁剪、注入、摘要、分析、性能和证据位置完整 | pass |

根 `pnpm check` 首次因实施起点新增的 `.vscode/settings.json` Prettier 格式失败而在后续门禁前停止；机械格式化后从头重跑。沙箱内该重跑又在既有 macOS Keychain 集成测试创建隔离钥匙串时失败；允许真实 macOS Keychain 的同一命令完整通过，证明后者是容器限制而非产品或 core 异常。

## 5. 发现项与处置

没有 `FND-I-*`。所有 P-001 core、硬门禁和实际执行的 supplemental 检查均通过，验证结论为 `passed`。

| ID | 类别 | 严重程度 | 关联需求/验收 | 观察与证据 | 最终功能影响 | 处置 | 置信度 | 建议后续 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 无 | 无 | 无 | 无 | 无开放异常 | 无 | 无 | 高 | 无 |

## 6. 决策、计划偏差与恢复记录

- 用户在实施开始前提交并推送了 Task UI/Workspace CLI 批次，HEAD 从规划基线 `bcae1aa` 前移到 `cad7359`。requirements、roadmap 和 phase plan 指纹保持一致，目标文件无重叠，因此把 `cad7359` 记录为实施起点，没有修改需求、路线图或阶段边界。
- `.vscode/settings.json` 的 format-only 修复是根硬门禁失败后的最小兼容修复；JSON 值逐字段不变，不改变 Agent Context 或用户编辑器设置语义。
- `tsx` IPC 和 macOS Keychain 的沙箱限制均通过同一 Node 24 命令在所需本地权限环境重跑而关闭；没有把环境异常保留为 report-only finding。
- 本阶段无数据库、生产写入、迁移、外部网络、共享可变状态或不可逆操作；没有暂停、半应用迁移或用户工作冲突。

## 7. 遗留风险与下一阶段进入条件

- P-001 没有开放 finding、未决问题或活动进程。
- macOS/Node 主体 `pass` 只关闭本阶段并解锁集中 Windows 验证，不能生成 initial run 最终记录。
- P-002 进入条件保持：P-001 本结果冻结；Task UI 与 Workspace Sync 主体证据保持通过；真实 Windows 11 x64/Node 24 入口可执行；规划前复核共享夹具和项目漂移。
- 满足前置后，单独调用 `$plan-feature-implementation` 为 `docs/requirements/agent-context-prototype/` 即时创建且只创建 P-002 计划。
- 在 P-002 Windows core 和最终漂移复核通过前，不得创建 `change-0.md`、`effective-requirements.md` 或把 initial run 标记为 `completed`。
