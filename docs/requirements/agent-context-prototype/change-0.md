# Agent 上下文原型：修改记录 0

- 修改记录编号：`0`
- 修改类型：首次实现
- 原始需求：[`requirements.md`](requirements.md)
- 当前有效需求：[`effective-requirements.md`](effective-requirements.md)
- 初始路线图：[`implementation-plan.md`](implementation-plan.md)，revision `1`
- 执行状态：[`execution-state.md`](execution/initial/execution-state.md)
- 项目基线：分支 `prototype`；规划基线 `bcae1aa1c66081c67ecbb9f6391b9613927f775a`；P-001 实施起点 `cad7359c9a266021674c358055ac6dc2dac554c1`；P-002 最终复核提交 `849bd2dd86468ee30d062e36a602c52c72c25690`
- 完成日期：`2026-07-26`

## 1. 实现概述

首次实现已交付一个位于 `@ngapd/test-fixtures` 的独立纯 TypeScript Agent Context 原型。版本化合成输入覆盖 actor、项目/任务、角色、活动祖先、已完成 predecessor、一跳关注、Workspace、Skill、摘要、显式跨用户只读和提示注入；核心在任何输出前完成稳定校验，再生成不含正文的 manifest、必需/可选预算、绑定游标分页、逐次重新授权读取和只使用成功读取结果的结构化分析。

固定冲突顺序为系统 > 项目 > 当前任务 > 用户流程。系统规则、项目规则、当前任务和当前用户角色受预算保护；其他用户来源默认不可发现；关注只展开一跳；角色、Skill、摘要和 Workspace 文本均不授予权限。原型不登录、不连接数据库或真实 Workspace、不新增正式 API/Web/MCP、不修改生产授权、不执行 Skill，也不调用外部 API、AI 或 LLM。

Node runner 的 12 个 core 场景、25 项 Agent Context 专项测试、三种主体规模性能和共享根门禁均通过。macOS arm64 / Node 24 与 Windows 11 x64 / Node 24 使用同一 `agent-context-v1` 夹具分别形成独立 `pass` 结果；Windows core 没有暴露产品缺陷，因此 P-002 只追加平台和工作流证据。

## 2. 文件修改

| 文件 | 修改模式 | 主要目的 |
| --- | --- | --- |
| `docs/requirements/agent-context-prototype/requirements.md` | add | 已批准的 36 项 FR、23 项分级 AC、策略、决策、异常和边界 |
| `docs/requirements/agent-context-prototype/workflow-contract.md` | add | schema 3.2 工作流契约 |
| `docs/requirements/agent-context-prototype/implementation-plan.md` | add | 两阶段 compact 初始路线图 revision 1 |
| `docs/requirements/agent-context-prototype/execution/initial/execution-state.md` | add | initial run 的执行、恢复、验证、finding 和完成权威 |
| `docs/requirements/agent-context-prototype/execution/initial/phase-001-plan.md` | add | P-001 即时计划 revision 1 |
| `docs/requirements/agent-context-prototype/execution/initial/phase-001-result.md` | add | P-001 不可变 `passed` 结果 |
| `docs/requirements/agent-context-prototype/execution/initial/phase-002-plan.md` | add | P-002 即时计划 revision 1 |
| `docs/requirements/agent-context-prototype/execution/initial/phase-002-result.md` | add | P-002 不可变 `passed` 结果 |
| `docs/requirements/agent-context-prototype/effective-requirements.md` | add | 应用至 change-0 的当前有效需求快照 |
| `docs/requirements/agent-context-prototype/change-0.md` | add | 本首次实现的不可变汇总记录 |
| `packages/test-fixtures/src/agent-context.ts` | add | 类型、稳定错误、输入校验、候选发现、排序、预算、游标、渐进读取、授权快照、分析和版本化 fixture |
| `packages/test-fixtures/src/agent-context.test.ts` | add | 25 项确定性、负向输入、发现、预算、分页、授权、摘要、Skill、注入、分析和规模自动化 |
| `packages/test-fixtures/src/index.ts` | modify | 新增 Agent Context 模块导出，保留 Task UI/Workspace 既有导出 |
| `prototypes/agent-context/run.ts` | add | 12 个无头 core 场景和三种主体规模 manifest-only P95 测量 |
| `prototypes/agent-context/fixtures/context-sources.json` | modify | 增加 schema/fixture/input 版本、稳定来源和双层授权元数据，修正项目/任务优先级 |
| `prototypes/agent-context/README.md` | modify | 记录原型边界、命令、manifest/正文分离、场景和性能口径 |
| `prototypes/agent-context/results/README.md` | modify | 补全结果字段与 `pass`/`fail`/`inconclusive` 规则 |
| `prototypes/agent-context/results/2026-07-25-macos-node24.md` | add | macOS arm64 / Node 24 P-001 主体 `pass` 结果 |
| `prototypes/agent-context/results/2026-07-26-windows-x64-node24.md` | add | Windows 11 x64 / Node 24 P-002 主体 `pass` 结果 |
| `.vscode/settings.json` | format-only | 对 P-001 实施起点已有 JSON 做等价 Prettier 修正以闭合根格式门禁 |

没有修改 Task UI 语义、Workspace Sync 协议、`packages/test-fixtures/package.json`、`pnpm-lock.yaml`、`packages/domain/src/authorization.ts`、正式 API/Web/MCP/Workspace CLI 业务代码、数据库或 migration。

## 3. 需求、阶段与任务完成情况

| 阶段 / 任务 | 状态 | 完成范围 | 需求与验收 |
| --- | --- | --- | --- |
| `P-001-T-001` | completed | 版本化合成 fixture、输入校验、双层发现、稳定排序、预算、分页、渐进读取、授权快照、结构化分析、25 项专项测试和 Node runner | `FR-001`–`FR-032`; `AC-001`–`AC-016`, `AC-018`, `AC-019` |
| `P-001-T-002` | completed | 最终 core/P95、共享包 build/typecheck/test、根门禁和 macOS/Node 平台结果 | `FR-033`, `FR-034`, `FR-036`; `AC-017`, `AC-020`, `AC-022`, `AC-023` |
| P-001 安全等待 | completed | P-001 冻结后保持可构建、无活动服务且不提前最终化 | `FR-035`; `AC-021` 的等待约束 |
| `P-002-T-001` | completed | Windows 11 x64 同夹具 core/P95、平台结果、最终根门禁、范围/秘密/追踪和工作流封存 | `FR-035`; `AC-021`；最终复核 `FR-001`–`FR-036`, `AC-001`–`AC-023` |

P-001 与 P-002 编号连续、计划/结果齐全并均为 `completed/passed`。`FR-001`–`FR-036` 与 core `AC-001`–`AC-021` 全部通过；supplemental `AC-022`/`AC-023` 也由同一低成本场景证据通过。没有把失败后的 core 降级为 supplemental。

## 4. 测试与验证

- 交付与验证策略：`relaxed`
- 最终验证结论：`passed`
- 开放 finding：无；下一可用 initial finding ID 为 `FND-I-001`

| 检查 | 观察结果 | 结论 |
| --- | --- | --- |
| Agent Context 专项自动化 | `src/agent-context.test.ts` 25/25 通过；覆盖输入、发现、关系、排序、预算、分页、读取、授权、摘要、Skill、注入和分析 | pass |
| P-001 macOS/Node runner | 12/12 core；预算 6000/必需 3050/选用 5810；28 项/page size 4；授权只读 | pass |
| P-001 macOS 性能 | 80 次/规模；deep/wide/dense P95 0.420/0.852/0.343 ms | pass，全部 `< 1000 ms` |
| P-001 共享门禁 | test-fixtures build/typecheck；5 files/37 tests；真实 macOS Node 24 根 `pnpm check` | pass |
| P-002 V-001 | Windows build `26200`、`win32/x64`、Node `v24.18.0`、pnpm `11.9.0`、Git/指纹/主体/fixture 17/17 | pass |
| P-002 Windows/Node runner | 同一 `agent-context-v1`；12/12 core；预算/分页/授权与 P-001 一致 | pass |
| P-002 Windows 性能 | 80 次/规模；deep/wide/dense P95 0.575/1.319/0.580 ms，最大值均低于 2 ms | pass，全部 `< 1000 ms` |
| P-002 最终根 `pnpm check` | Node 24.18.0 / pnpm 11.9.0；format、lint、10 个适用 workspace build/typecheck 和全部适用测试退出码 0；test-fixtures 5 files/37 tests | pass |
| 平台结果 | macOS arm64 与 Windows x64 记录均包含环境、commit、fixture、预算、排序、分页、授权、裁剪、注入、摘要、分析、性能和相对证据 | pass |
| 最终范围与追踪 | P-001 plans/results 指纹不变；P-001 后无 Agent Context 自有文件漂移；无秘密或空白错误；36 FR/23 AC 全量映射 | pass |

## 5. 与路线图及阶段计划的偏差

- 路线图按真实 Windows 外部交接使用两个 compact 阶段，阶段数量、顺序和需求边界未偏离。
- P-001 实施前用户把 Task UI/Workspace CLI 改动提交并推送，实施基线从 `bcae1aa` 前移到 `cad7359`；指纹和目标文件所有权不变，因此吸收该基线而未重写路线图。
- P-001 根格式门禁发现实施起点已有 `.vscode/settings.json` 不符合 Prettier；只做等价格式修正。沙箱 IPC 与 macOS Keychain 限制均在所需本地权限环境用同一 Node 24 命令重跑关闭。
- P-002 主机未预装精确 Node 24.18.0；取得发行归档并按官方 SHA-256 校验后，以任务专用临时运行时执行。
- Codex bundled pnpm 启动器固定到 Node 24.14，外置 pnpm 首次没有注入本地 `.bin`，在加载原型前找不到 `tsx`；显式加入本地 `.bin` 并用临时包装器确保递归 pnpm 使用 Node 24.18.0 后，同一 runner 和完整根门禁通过。
- Windows core 没有暴露实现缺陷，所以没有使用 P-002 条件性源码修复范围；只新增平台结果和工作流工件。
- 上述偏差均已关闭，没有改变产品行为、需求、阶段边界或 finding 结论。

## 6. 遗留事项

| ID | 类别 | 严重程度 | 关联需求/验收 | 观察与证据 | 最终功能影响 | 处置 | 置信度 | 建议后续 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 无 | — | — | — | initial run 没有开放 report-only finding、未决问题、活动进程、半完成实现或未知外部状态 | 无 | — | 高 | — |

本记录创建后，原始 requirements、初始路线图、workflow contract、initial execution state、P-001/P-002 计划与结果、本记录和当前有效需求快照均冻结。后续产品行为或需求变化必须通过新的 `$apply-feature-change` 运行、连续的 `change-<N>.md` 和更新后的有效需求快照表达。
