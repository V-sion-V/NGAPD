# Workspace CLI initial run：执行状态

- 运行编号：`initial`
- 运行类型：`首次实现`
- 目标记录：`change-0.md`
- 运行状态：`completed`
- 交付与验证策略：`relaxed`
- 验证结论：`passed`
- 当前路线图修订：`2`
- 需求指纹：`sha256:c85eb28b24b4fbd084e4a6a3392da81e1bf0afedea4b452ee75cf768ff53c5be`
- 路线图或变更计划指纹：`sha256:dae4e8c6f4440cf7fbcc95d3828e868bb82cecf0b5f10a8bc42b6ba455e1288c`
- 当前阶段：`P-001`
- 当前任务：`无`
- 项目基线：分支 `prototype`，提交 `7be2bf685143112571debfe924ce59ee1b40e1b9`
- 最后更新时间：`2026-07-24T23:46:26+08:00`

## 1. 运行目标或待生效变更

以无界面的 `@ngapd/workspace-cli`、MCP stdio 入口和可复用的 `@ngapd/workspace-core` 替换现有 Electron 空壳，同时完成工程依赖、根命令、活动文档和验收切换。首版只提供状态与诊断，不包含 Workspace、任务、数据库、文件或 shell 写能力。

规划审核结论：schema `3.2` 需求完整，用户已明确选择 `relaxed`，15 个 `FR-*` 与 13 个分级 `AC-*` 均可在一个阶段内实现和验证，无未决产品决策。

## 2. 阶段状态

| 阶段 | 状态 | 计划修订 | 阶段计划指纹 | 目标 | 进入/退出条件 |
| --- | --- | --- | --- | --- | --- |
| P-001 | completed | 2 | `sha256:ed4f934c7b6819f6d232f86a459e9a7cc8588d184939ff961f18f146d20cf6e3` | 用共享核心与只读 MCP stdio CLI 完整替换 Electron 空壳 | 已满足；完成证据见 [`phase-001-result.md`](phase-001-result.md) |

只允许 P-001 处于活动状态；本路线图没有未来待规划阶段。

## 3. 当前检查点

- 检查点：`P-001-T-001`、P-001 与 initial run 已完成；不可变 [`phase-001-result.md`](phase-001-result.md)、[`../../change-0.md`](../../change-0.md) 和 [`../../effective-requirements.md`](../../effective-requirements.md) 均已创建并完成一致性复核。
- 实际结果：新增 `@ngapd/workspace-core` 与 `@ngapd/workspace-cli`，正式根 bin wrapper、人工/JSON 命令和 MCP stdio 两个只读工具可用；Electron 活动工程、专用依赖和根入口已删除；活动文档与 ADR 取代链已同步。
- 已执行验证：在 Node `24.18.0` / pnpm `11.9.0` 下根 `pnpm check` 完整通过；构建后二进制矩阵、正式 pnpm bin、实际 MCP stdio 子进程、畸形协议、stdin/信号关闭、离线/负向/敏感输出、零网络监听、Electron/数据库范围、README diff 和真实 macOS arm64 冒烟全部通过。
- 完成结论：`AC-001`–`AC-011` core 与硬门禁通过，`AC-012`、`AC-013` supplemental 也通过；验证结论为 `passed`，无 `FND-I-*`。
- 最终化制品：`effective-requirements.md` SHA-256 为 `2a210b7da5fa4ebedc954c505ad245408dc25a1b43e70fc612e1f9a21b3f8c4a`；`change-0.md` SHA-256 为 `20489614610341cfce23e7342da0aa19ad3b13092f547c59182cbb1b7d6523cc`。
- 任务前基线：分支 `prototype`、HEAD `7be2bf685143112571debfe924ce59ee1b40e1b9`；除本工作流未跟踪文件外仅 `README.md` 为既有修改。`README.md` 文件 SHA-256 为 `bda382882aa5f04b71994d2723cca61153eaaf680d674e671f7ae84476a587f3`，其相对 HEAD 的 diff SHA-256 为 `9c388001c3bd7ecb0f1b3d41f28b98d70c74c2b21685bb1755852751908aee93`。
- 相关既有工作：`README.md` 在本运行规划前已有用户未提交修改；`requirements.md` 与 `workflow-contract.md` 是已审批但未跟踪的输入。本运行不声称拥有这些既有改动。
- 环境事实：执行主机为 macOS arm64；已通过 NVM 安装路径确认 Node `v24.18.0` 与 pnpm `11.9.0` 可用于本任务。所有实现与验证命令必须显式使用该 Node 24 路径。

## 4. 已完成任务

| 任务 | 状态 | 关联需求与验收 | 实际结果 | 验证 |
| --- | --- | --- | --- | --- |
| `P-001-T-001` | completed | `FR-001`–`FR-015` / `AC-001`–`AC-013` | 共享核心、无界面 CLI、正式 MCP stdio、工程/依赖切换和活动文档取代链全部完成；README 用户内容保留 | 根门禁、二进制矩阵、MCP 子进程、离线/安全/范围扫描及 macOS arm64 冒烟全部通过 |

## 5. 运行累计文件变化

| 文件 | 修改模式 | 主要目的 |
| --- | --- | --- |
| `docs/requirements/workspace-cli/implementation-plan.md` | add | 建立 initial run 的单阶段全局路线图、设计与追踪 |
| `docs/requirements/workspace-cli/execution/initial/phase-001-plan.md` | add | 建立 P-001 的即时 expanded 执行计划 |
| `docs/requirements/workspace-cli/execution/initial/execution-state.md` | add | 建立 initial run 的当前协调与恢复权威 |
| `packages/workspace-core/**` | add | 提供 UI/CLI 无关的状态、诊断模型、平台端口、纯服务与测试 |
| `apps/workspace-cli/**` | add | 提供 bin、命令解析、人类/JSON 呈现、Node 适配器、MCP stdio 与集成测试 |
| `apps/desktop/**` | delete | 移除 Electron 主进程、preload、renderer、构建配置和空壳 |
| `package.json` | modify | 用 `dev:workspace` 替换桌面入口并链接正式 `ngapd-workspace` bin |
| `pnpm-workspace.yaml` | modify | 删除 Electron 构建白名单 |
| `pnpm-lock.yaml` | modify | 锁定 MCP SDK v1、Zod、CLI/核心 workspace，并移除 Electron 专用依赖 |
| `README.md` | modify | 在保留既有 macOS/PostgreSQL/Docker 内容的前提下切换到 CLI 入口 |
| `docs/04-system-architecture.md` | modify | 更新当前 CLI、共享核心和未来适配器架构 |
| `docs/06-agent-integration.md` | modify | 明确当前 MCP stdio 两个只读工具与未来契约边界 |
| `docs/07-roadmap-and-validation.md` | modify | 把工程基线与后续客户端里程碑切换到 CLI/平台适配器 |
| `docs/08-decisions-and-open-issues.md` | modify | 新增 D-083 并标记 D-081 客户端部分被取代 |
| `docs/09-technical-architecture-decisions.md` | modify | 保留旧 ADR 并新增 ADR-014 取代链 |
| `docs/10-mvp-non-functional-baseline.md` | modify | 使用 Workspace 平台适配器术语维护客户端约束 |
| `docs/12-prototype-preparation.md` | modify | 更新目录、命令、验证历史与原型实现入口 |
| `prototypes/README.md` | modify | 更新 Workspace 同步原型依赖方向 |
| `prototypes/task-ui/results/README.md` | modify | 将可选 GUI 宿主作为界面原型环境 |
| `prototypes/workspace-sync/README.md` | modify | 明确共享核心与独立平台适配器边界 |
| `prototypes/workspace-sync/results/README.md` | modify | 更新结果环境记录字段 |
| `docs/requirements/workspace-cli/execution/initial/phase-001-result.md` | add | 冻结 P-001 实现、覆盖、文件、验证与恢复结果 |
| `docs/requirements/workspace-cli/effective-requirements.md` | add | 派生 change-0 后完整、自包含的当前有效需求 |
| `docs/requirements/workspace-cli/change-0.md` | add | 冻结 initial run 的首次实现、文件、覆盖与验证汇总 |

## 6. 测试与验证证据

| 类型 | 命令或检查 | 观察结果 | 结论 |
| --- | --- | --- | --- |
| 需求审核 | 完整读取 `requirements.md`、`workflow-contract.md`、相关源码、配置、测试与活动文档 | schema 3.2、relaxed 明确、所有 AC 已分级、无未决问题；Electron 为无业务逻辑空壳 | planning pass |
| 需求指纹 | `shasum -a 256 requirements.md` | `c85eb28b24b4fbd084e4a6a3392da81e1bf0afedea4b452ee75cf768ff53c5be` | pass |
| 路线图指纹 | `shasum -a 256 implementation-plan.md` | `dae4e8c6f4440cf7fbcc95d3828e868bb82cecf0b5f10a8bc42b6ba455e1288c` | pass |
| 阶段计划指纹 | `shasum -a 256 phase-001-plan.md` | `ed4f934c7b6819f6d232f86a459e9a7cc8588d184939ff961f18f146d20cf6e3` | pass |
| 空白检查 | `git diff --check`（新路线图与阶段计划） | 无错误 | pass |
| 任务前基线 | `git status --short --untracked-files=all`、`git diff -- README.md`、`git rev-parse HEAD` | HEAD 与规划基线一致；既有 README diff 与已记录的 macOS 安装、PostgreSQL 和 Docker 说明一致；无新增重叠 | pass |
| 执行环境 | 使用 `/Users/v_sion/.nvm/versions/node/v24.18.0/bin` 前置 PATH 后检查版本 | Node `v24.18.0`，pnpm `11.9.0` | pass |
| 根质量门 | `pnpm check` | format、lint、9 个可构建/类型检查 workspace、21 项测试全部通过；其中 core 3 项、CLI/MCP 10 项 | pass |
| 正式 bin | `pnpm exec ngapd-workspace --version`、`status --json` | 根安装生成可执行 wrapper；版本 `0.1.0`，JSON 可解析且只声明两个只读能力 | pass |
| 人工命令矩阵 | 构建后执行 `--help`、`--version`、`status [--json]`、`doctor [--json]`、未知命令 | 人类/JSON 由同一结果投影；未配置 Workspace 如实为 warning；未知命令稳定退出 2 | pass |
| MCP 集成 | SDK 客户端启动真实子进程，初始化、发现、调用两工具；另测畸形输入、stdin、SIGINT、SIGTERM | 仅发现 `workspace_status`/`workspace_doctor`；stdout 协议纯净；畸形输入 stderr + 退出 2；信号退出 130/143 | pass |
| 离线与敏感输出 | 用最小环境运行 `status --json`，设置测试 sentinel 并检查输出 | 无数据库、网络、Workspace、HOME 依赖；不包含 sentinel 或个人绝对路径 | pass |
| 写入与网络边界 | 对写式未知命令使用空临时夹具；运行中用 `lsof -a -p <pid> -i` | 退出 2、创建文件数 0、网络监听数 0 | pass |
| 工程与数据范围 | Git 范围、lockfile/依赖、源码 import 和活动引用扫描；`pnpm why electron --depth infinity` | 无 Electron/electron-vite/desktop app；仅保留带 superseded 链的历史文本和无关 `electron-to-chromium` 浏览器数据；无 migration/API/Worker/Web/数据库变化 | pass |
| README 保护 | 逐行复核最终 `git diff -- README.md` 及 Homebrew、nvm、PostgreSQL 17、Docker/macOS 关键内容 | 用户既有开发说明完整保留，仅 Electron 入口按需求替换为 CLI | pass |
| 最终范围与空白 | `git status --short --untracked-files=all`、secret/debug/transient 扫描、`git diff --check` | 变更均在阶段范围；无秘密、调试代码或已跟踪临时产物；diff whitespace 正常 | pass |

## 7. 决策、待确认问题与回答

| ID | 阶段/任务 | 问题 | 已确认事实 | 可选方案与影响 | 需要确认 | 状态 | 用户回答及来源 |
| --- | --- | --- | --- | --- | --- | --- | --- |

无未决问题。已生效决策：用户明确选择 `relaxed`；用户确认本功能预计一个阶段完成。技术细节由路线图 TD-001 至 TD-004 记录；其中 TD-002 根据官方当前资料选择生产推荐的 MCP SDK v1.x，不采用仍为 pre-alpha 的 v2。

## 8. 发现项、偏差、风险与阻塞

- 下一可用 finding ID：`FND-I-001`。
- 当前无 `FND-I-*`、计划偏差、遗留风险或阻塞。
- 已关闭的执行观察：
  - 首次根门禁发现 SDK 会静默丢弃畸形 JSON；在 stdio 适配层增加稳定 stderr 与退出码 2 后，受影响测试和完整根门禁通过。
  - 根 workspace 起初未链接自身 CLI bin；加入私有 workspace 开发依赖后 `pnpm exec ngapd-workspace` 可直接执行并通过复验。
  - pnpm 安装期间 registry 元数据重试和沙箱内 store DB 访问曾失败；最终 lockfile 安装成功，`pnpm why electron` 在获准读取本地 store 后通过，不影响交付物。

Core 阻塞集合：`AC-001`–`AC-011`，以及安全、隐私、数据完整性、公共兼容、构建、恢复、项目必需检查和用户已有工作保护。

Supplemental 集合：`AC-012`、`AC-013`。只有在独立证据证明不影响已交付行为时，relaxed 策略才允许将其异常保留为 report-only finding。

## 9. 精确恢复步骤

initial run 已完整完成，没有半应用生产操作、待恢复任务或可继续执行的后续阶段。

1. 不得以 resume 方式重写 P-001、`phase-001-result.md`、`change-0.md` 或本 completed 状态。
2. 如需复核，按 requirements → roadmap → phase plan/result → `change-0.md` → `effective-requirements.md` 的来源链只读验证指纹、覆盖和文件清单。
3. 如需改变当前有效需求，必须启动新的 schema 3.2 change run 并创建连续的 `change-1.md`，不能修改已冻结的 initial 历史。
4. 本功能没有数据库、文件系统业务数据或外部服务副作用，因此不存在补偿或回滚恢复步骤。

## 10. 最终完成门禁

- [x] P-001-T-001 完成且生成不可变 `phase-001-result.md`。
- [x] 所有 core、supplemental 验收和硬门禁通过；验证结论为 `passed`。
- [x] 无 open `FND-I-*`；finding 连续性保持在下一可用 `FND-I-001`。
- [x] 实际文件清单、测试观察、偏差与恢复记录完整，README 用户内容得到保护。
- [x] `change-0.md` 与 `effective-requirements.md` 已创建、复读并与 completed 状态一致。
