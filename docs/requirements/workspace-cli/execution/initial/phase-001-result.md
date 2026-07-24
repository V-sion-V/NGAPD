# P-001：Workspace CLI 单阶段实施结果

- 运行编号：`initial`
- 阶段编号：`P-001`
- 阶段计划：[`phase-001-plan.md`](phase-001-plan.md)
- 阶段计划修订：`2`
- 父路线图修订：`2`
- 完成日期：`2026-07-24`
- 状态：`completed`
- 交付与验证策略：`relaxed`
- 验证结论：`passed`
- 起始基线：分支 `prototype`，提交 `7be2bf685143112571debfe924ce59ee1b40e1b9`；任务前 `README.md` SHA-256 `bda382882aa5f04b71994d2723cca61153eaaf680d674e671f7ae84476a587f3`，README diff SHA-256 `9c388001c3bd7ecb0f1b3d41f28b98d70c74c2b21685bb1755852751908aee93`
- 结束基线：HEAD 未变化；最终 `README.md` SHA-256 `697224cfcb49c61a221a5803c2d5cfe92f8d59039081cdff6d379f088a9cf911`，README diff SHA-256 `f9ee3980bf12d461fab5935994cf2ea4c0a23777cbc87c29c381562f5e96eff5`

## 1. 阶段目标与结果

P-001 已用可复用的 `@ngapd/workspace-core` 和无界面的 `@ngapd/workspace-cli` 完整替换 Electron 空壳。仓库现在通过 `ngapd-workspace` 提供 `--help`、`--version`、`status [--json]`、`doctor [--json]` 和 `serve --stdio`，并通过官方 `@modelcontextprotocol/sdk` v1.29.0 只注册 `workspace_status` 与 `workspace_doctor` 两个 MCP 只读工具。

共享核心不依赖 Electron、React、DOM 或 CLI 解析器；CLI 不访问数据库、网络或 Workspace 路径，不提供任务、文件、数据库或 shell 写能力。Electron 源码、构建配置、专用依赖、根入口和本地产物已退出活动工程；README、架构、Agent、路线、决策、ADR、非功能基线和原型说明已同步，旧 Electron ADR 作为历史保留并由 ADR-014 明确取代。

所有 core、supplemental 和项目硬门禁通过，验证结论为 `passed`，没有 report-only finding。

## 2. 任务、需求与验收覆盖

| 任务 | 关联需求 | 关联验收 | 完成结果 |
| --- | --- | --- | --- |
| `P-001-T-001` | `FR-001`–`FR-015` | `AC-001`–`AC-013` | completed；共享核心、CLI/MCP、工程依赖切换、文档取代链和全部验证均完成 |

覆盖要点：

- `FR-001`–`FR-005`、`FR-009`–`FR-011`、`FR-014`、`FR-015` / `AC-001`–`AC-003`、`AC-006`、`AC-007`：正式 bin、人工/JSON 命令、MCP 初始化/发现/调用、stdio 隔离、离线、错误与信号边界全部通过。
- `FR-006` / `AC-005`：核心包通过假平台适配器单元测试和依赖扫描，能够独立导入与调用。
- `FR-007`、`FR-008` / `AC-004`、`AC-008`、`AC-011`：Electron 活动工程与依赖移除，根 `dev:workspace` 和正式 bin wrapper 可用，根门禁通过且 README 用户内容保留。
- `FR-012` / `AC-010`：所有活动入口切换为 CLI/共享核心/未来适配器，ADR-009/010 历史由 ADR-014 建立可追溯取代链。
- `FR-013` / `AC-009`：API、Worker、Web、数据库包、migration 和运行数据均无变更，既有统一门禁通过。
- `FR-004`、`FR-009` / `AC-012`、`AC-013`：人类与 JSON 结果同源且结论一致；真实 macOS arm64 CLI 与 MCP stdio 冒烟通过。

## 3. 文件修改

| 文件 | 修改模式 | 主要目的 |
| --- | --- | --- |
| `packages/workspace-core/package.json` | add | 定义共享核心 workspace 包与构建/测试入口 |
| `packages/workspace-core/tsconfig.json` | add | 配置 NodeNext 核心包构建 |
| `packages/workspace-core/src/index.ts` | add | 导出共享核心公共接口 |
| `packages/workspace-core/src/types.ts` | add | 定义状态、诊断、能力和平台端口模型 |
| `packages/workspace-core/src/service.ts` | add | 实现纯状态与诊断服务 |
| `packages/workspace-core/src/service.test.ts` | add | 验证离线、只读与 Node 运行时诊断 |
| `apps/workspace-cli/package.json` | add | 定义 CLI workspace、bin 与 MCP SDK v1 依赖 |
| `apps/workspace-cli/tsconfig.json` | add | 配置 NodeNext CLI 构建 |
| `apps/workspace-cli/src/index.ts` | add | 导出可复用 CLI 适配接口 |
| `apps/workspace-cli/src/bin.ts` | add | 提供 `ngapd-workspace` 可执行入口和安全顶层错误边界 |
| `apps/workspace-cli/src/cli.ts` | add | 实现命令解析、退出码和服务调度 |
| `apps/workspace-cli/src/node-platform.ts` | add | 提供允许列表式 Node 平台信息适配 |
| `apps/workspace-cli/src/presentation.ts` | add | 从同一结果对象投影人类与 JSON 输出 |
| `apps/workspace-cli/src/stdio-server.ts` | add | 注册两个只读 MCP 工具并实现协议/信号关闭边界 |
| `apps/workspace-cli/src/cli.test.ts` | add | 验证命令、输出、错误和显式 stdio 入口 |
| `apps/workspace-cli/src/mcp.integration.test.ts` | add | 以真实子进程验证 MCP、畸形输入和信号关闭 |
| `apps/desktop/electron.vite.config.ts` | delete | 删除 Electron 构建配置 |
| `apps/desktop/package.json` | delete | 删除桌面 workspace 与 Electron/React 专用依赖 |
| `apps/desktop/src/main/index.ts` | delete | 删除 Electron 主进程空壳 |
| `apps/desktop/src/preload/index.ts` | delete | 删除 preload 空壳 |
| `apps/desktop/src/renderer/index.html` | delete | 删除 renderer 入口 |
| `apps/desktop/src/renderer/src/App.tsx` | delete | 删除桌面 React 空壳 |
| `apps/desktop/src/renderer/src/env.d.ts` | delete | 删除 Vite renderer 类型 |
| `apps/desktop/src/renderer/src/main.tsx` | delete | 删除 renderer 启动代码 |
| `apps/desktop/src/renderer/src/styles.css` | delete | 删除桌面空壳样式 |
| `apps/desktop/tsconfig.node.json` | delete | 删除 Electron Node 配置 |
| `apps/desktop/tsconfig.web.json` | delete | 删除 renderer TypeScript 配置 |
| `package.json` | modify | 用 `dev:workspace` 替换桌面入口并把 CLI 链接为根开发依赖/bin |
| `pnpm-workspace.yaml` | modify | 删除 Electron 构建白名单 |
| `pnpm-lock.yaml` | modify | 固定 SDK v1.29.0、Zod、核心/CLI workspace 并移除 Electron 依赖链 |
| `README.md` | modify | 保留用户 macOS/PostgreSQL/Docker 说明并改用 CLI 入口 |
| `docs/04-system-architecture.md` | modify | 更新 CLI、共享核心和未来平台/GUI 适配架构 |
| `docs/06-agent-integration.md` | modify | 明确当前两个只读工具和未来 Agent 契约边界 |
| `docs/07-roadmap-and-validation.md` | modify | 更新工程基线与后续同步平台适配器路线 |
| `docs/08-decisions-and-open-issues.md` | modify | 新增 D-083 并记录被取代决策 |
| `docs/09-technical-architecture-decisions.md` | modify | 新增 ADR-014 并保留 ADR-009/010 历史取代链 |
| `docs/10-mvp-non-functional-baseline.md` | modify | 统一未来 Workspace 平台适配器术语 |
| `docs/12-prototype-preparation.md` | modify | 更新工程目录、命令、验证历史和原型切片 |
| `prototypes/README.md` | modify | 更新同步原型依赖方向 |
| `prototypes/task-ui/results/README.md` | modify | 将界面环境表述为浏览器/可选 GUI 宿主 |
| `prototypes/workspace-sync/README.md` | modify | 固定核心端口与独立平台适配器边界 |
| `prototypes/workspace-sync/results/README.md` | modify | 更新平台适配器环境证据字段 |
| `docs/requirements/workspace-cli/execution/initial/execution-state.md` | modify | 持久化任务前后检查点、文件、验证与恢复证据 |
| `docs/requirements/workspace-cli/execution/initial/phase-001-result.md` | add | 冻结 P-001 完成证据 |

`dist/`、`node_modules/` 和 `*.tsbuildinfo` 是被忽略的构建/依赖产物，不属于保留文件清单。

## 4. 测试与验证

| 类型 | 命令或检查 | 观察结果 | 结论 |
| --- | --- | --- | --- |
| 环境 | Node 24 NVM 路径下 `node --version`、`pnpm --version` | `v24.18.0` / `11.9.0`，macOS arm64 | pass |
| 根质量门 | `pnpm check` | Prettier、ESLint、9 个 build/typecheck workspace、21 项测试全部通过 | pass |
| 核心测试 | 根门禁内 `@ngapd/workspace-core` Vitest | 3/3 通过 | pass |
| CLI/MCP 测试 | 根门禁内 `@ngapd/workspace-cli` Vitest | 10/10 通过；含实际 MCP 子进程、畸形输入、stdin、SIGINT/SIGTERM | pass |
| 正式 bin | `pnpm exec ngapd-workspace --version`、`status --json` | 根 bin wrapper 可执行；版本与只读状态正确 | pass |
| 人工命令矩阵 | 构建后执行 help/version/status/doctor 的人类与 JSON 形式及未知命令 | 全部可执行且不启动 GUI；JSON 可解析；未知命令退出 2 | pass |
| MCP 冒烟 | SDK Client 启动 `serve --stdio`，初始化、发现并调用两个工具 | 仅发现两个只读工具，调用成功，协议 stdout 无人类输出 | pass |
| macOS 实机 | 当前 Darwin arm64 环境执行 CLI 与 MCP 冒烟 | 平台 `darwin`、架构 `arm64`，全部通过 | pass |
| 离线与敏感输出 | 最小环境 + sentinel 执行状态命令 | 无数据库/网络/Workspace 前置；不输出 sentinel 或个人绝对路径 | pass |
| 写入与监听 | 写式未知命令空夹具对照；`lsof -a -p <pid> -i` | 退出 2、创建文件 0、网络监听 0 | pass |
| 工程/数据范围 | Git、依赖、import、活动引用、migration 扫描；`pnpm why electron --depth infinity` | 无 Electron 活动包/入口，无数据库或服务端行为变化 | pass |
| README 与 diff | 最终 README 逐行对照、secret/debug/transient 扫描、`git diff --check` | 用户内容保留；无秘密、调试代码、已跟踪临时产物或 whitespace 错误 | pass |

首次根门禁曾发现畸形协议输入被 SDK 静默丢弃；增加稳定 stderr 与退出码 2 后，CLI 受影响测试及完整根门禁均重新通过。正式 bin 首次直接调用也暴露根 workspace 未建立 wrapper；加入私有 workspace 链接后 `pnpm exec ngapd-workspace` 与完整根门禁均重新通过。失败证据已诊断并关闭，不构成开放 finding。

## 5. 发现项与处置

无 `FND-I-*`。所有 core、supplemental 和硬门禁均有独立通过证据，验证结论为 `passed`。

## 6. 决策、计划偏差与恢复记录

- 实现遵循路线图 TD-001 至 TD-004；MCP 由 lockfile 固定为官方生产 v1 线的 `@modelcontextprotocol/sdk` 1.29.0。
- 没有需求、全局设计、阶段边界或任务范围偏差。stdio 协议错误映射和根 bin 链接是完成既定验收所需的任务内技术修正。
- pnpm registry 元数据曾超时重试，沙箱内 `pnpm why` 曾因本地 store DB 权限失败；获准访问后最终安装与依赖审查通过，没有改变交付物或验收结论。
- README 以任务前文件/diff 指纹保护，最终逐行确认 Homebrew、nvm、PostgreSQL 17、Docker 和 macOS 开发说明仍存在，仅 Electron 命令及相关说明被 CLI 内容取代。
- 无 migration、数据写入、半应用删除、用户重叠冲突或需要回滚的外部副作用。

## 7. 遗留风险与下一阶段进入条件

无开放 finding、未决问题或遗留阶段风险。本路线图只有 P-001；不存在下一实施阶段。initial run 可以进入 finalization，前提是完整重读 requirements、roadmap、state、本阶段计划/结果和最终 diff，生成 `effective-requirements.md` 与 `change-0.md`，并确认两者与 completed state 一致。
