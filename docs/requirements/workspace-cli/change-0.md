# Workspace CLI 替代桌面客户端：首次实现记录

- 修改记录编号：`0`
- 记录类型：`首次实现`
- 原始需求：[`requirements.md`](requirements.md)
- 初始路线图：[`implementation-plan.md`](implementation-plan.md)
- 执行运行：[`execution/initial/execution-state.md`](execution/initial/execution-state.md)
- 项目基线：分支 `prototype`，提交 `7be2bf685143112571debfe924ce59ee1b40e1b9`
- 完成日期：2026-07-24

## 1. 实现概述

首次实现已用无界面的 `@ngapd/workspace-cli` 与 UI/CLI 无关的 `@ngapd/workspace-core` 替换 Electron/React 桌面空壳。`ngapd-workspace` 现在提供 help、version、status、doctor 和 MCP 兼容 stdio 服务；Agent 只能发现并调用 `workspace_status` 与 `workspace_doctor` 两个只读工具。

CLI 的人类/JSON 呈现来自同一核心结果，协议 stdout 与 stderr 隔离，状态和诊断可在无数据库、无网络、无登录、无 Workspace 配置时运行。CLI 不监听网络、不接受路径输入、不提供任务、文件、数据库或 shell 写能力。共享核心通过平台适配端口接收允许公开的运行时事实，不依赖 Electron、React、DOM、CLI 解析器、数据库或网络。

活动 Electron 源码、配置、专用依赖和根入口已删除。README 在保留用户已有 macOS、Homebrew、nvm、PostgreSQL 17 和 Docker 内容的前提下切换为 CLI；活动架构、Agent、路线、决策、ADR、非功能基线和原型文档已同步，旧 Electron ADR 保留历史并由 ADR-014 明确取代。

## 2. 文件修改

| 文件 | 修改模式 | 主要目的 |
| --- | --- | --- |
| `docs/requirements/workspace-cli/requirements.md` | add | 冻结已确认的首版产品需求、边界、策略和验收 |
| `docs/requirements/workspace-cli/workflow-contract.md` | add | 定义 schema 3.2 工作流路径、状态、阶段、finding 与记录契约 |
| `docs/requirements/workspace-cli/implementation-plan.md` | add | 建立 initial run 的单阶段全局路线图、设计与追踪 |
| `docs/requirements/workspace-cli/execution/initial/execution-state.md` | add | 持久化 completed 运行状态、检查点、证据和恢复权威 |
| `docs/requirements/workspace-cli/execution/initial/phase-001-plan.md` | add | 冻结 P-001 的即时 expanded 执行计划 |
| `docs/requirements/workspace-cli/execution/initial/phase-001-result.md` | add | 冻结 P-001 的实现、覆盖、文件和验证结果 |
| `docs/requirements/workspace-cli/effective-requirements.md` | add | 派生 change-0 后的当前有效产品需求快照 |
| `docs/requirements/workspace-cli/change-0.md` | add | 汇总首次实现的完整项目与工作流记录 |
| `packages/workspace-core/package.json` | add | 定义共享核心 workspace 包与构建、测试入口 |
| `packages/workspace-core/tsconfig.json` | add | 配置 NodeNext 核心包构建 |
| `packages/workspace-core/src/index.ts` | add | 导出共享核心公共接口 |
| `packages/workspace-core/src/types.ts` | add | 定义状态、诊断、能力和平台端口模型 |
| `packages/workspace-core/src/service.ts` | add | 实现纯状态与诊断服务 |
| `packages/workspace-core/src/service.test.ts` | add | 验证离线、只读与 Node 运行时诊断 |
| `apps/workspace-cli/package.json` | add | 定义 CLI workspace、bin 与 MCP SDK v1 依赖 |
| `apps/workspace-cli/tsconfig.json` | add | 配置 NodeNext CLI 构建 |
| `apps/workspace-cli/src/index.ts` | add | 导出可复用 CLI 适配接口 |
| `apps/workspace-cli/src/bin.ts` | add | 提供 `ngapd-workspace` bin 和安全顶层错误边界 |
| `apps/workspace-cli/src/cli.ts` | add | 实现命令解析、退出码和服务调度 |
| `apps/workspace-cli/src/node-platform.ts` | add | 提供允许列表式 Node 平台信息适配 |
| `apps/workspace-cli/src/presentation.ts` | add | 从同一结果投影人类与 JSON 输出 |
| `apps/workspace-cli/src/stdio-server.ts` | add | 注册两个只读 MCP 工具并实现协议、信号关闭边界 |
| `apps/workspace-cli/src/cli.test.ts` | add | 验证命令、输出、错误和 stdio 入口 |
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
| `package.json` | modify | 用 `dev:workspace` 替换桌面入口并链接正式 CLI bin |
| `pnpm-workspace.yaml` | modify | 删除 Electron 构建白名单 |
| `pnpm-lock.yaml` | modify | 固定 SDK v1.29.0、Zod、核心/CLI workspace 并移除 Electron 依赖链 |
| `README.md` | modify | 保留用户开发说明并把 Electron 入口切换为 CLI |
| `docs/04-system-architecture.md` | modify | 更新 CLI、共享核心和未来平台/GUI 适配架构 |
| `docs/06-agent-integration.md` | modify | 明确当前两个只读 MCP 工具和未来契约边界 |
| `docs/07-roadmap-and-validation.md` | modify | 更新工程基线与后续平台适配器路线 |
| `docs/08-decisions-and-open-issues.md` | modify | 新增 D-083 并记录 D-081 客户端部分被取代 |
| `docs/09-technical-architecture-decisions.md` | modify | 新增 ADR-014 并保留 ADR-009/010 历史取代链 |
| `docs/10-mvp-non-functional-baseline.md` | modify | 统一未来 Workspace 平台适配器术语 |
| `docs/12-prototype-preparation.md` | modify | 更新目录、命令、验证历史和原型切片 |
| `prototypes/README.md` | modify | 更新同步原型依赖方向 |
| `prototypes/task-ui/results/README.md` | modify | 将界面环境表述为浏览器或可选 GUI 宿主 |
| `prototypes/workspace-sync/README.md` | modify | 固定共享核心与独立平台适配器边界 |
| `prototypes/workspace-sync/results/README.md` | modify | 更新平台适配器环境证据字段 |

被忽略的 `dist/`、`node_modules/` 和 `*.tsbuildinfo` 为构建或依赖产物，不属于保留文件。

## 3. 需求、阶段与任务完成情况

| 对象 | 状态 | 覆盖 | 完成证据 |
| --- | --- | --- | --- |
| 原始需求 | completed | `FR-001`–`FR-015` | [`effective-requirements.md`](effective-requirements.md) 保留全部当前生效行为 |
| 验收标准 | passed | `AC-001`–`AC-013` | core `AC-001`–`AC-011` 与 supplemental `AC-012`–`AC-013` 全部通过 |
| 阶段 `P-001` | completed | `FR-001`–`FR-015` / `AC-001`–`AC-013` | [`execution/initial/phase-001-result.md`](execution/initial/phase-001-result.md) |
| 任务 `P-001-T-001` | completed | 共享核心、CLI/MCP、工程切换、文档与整体验收 | [`execution/initial/execution-state.md`](execution/initial/execution-state.md) |
| initial run | completed | 单阶段首次实现 | 验证结论 `passed`，无 `FND-I-*` |

需求覆盖结论：

- `FR-001`–`FR-005`、`FR-009`–`FR-011`、`FR-014`、`FR-015`：正式 bin、人工/JSON 命令、两个 MCP 工具、stdio 隔离、离线运行、稳定错误/信号和只读边界已完成。
- `FR-006`：共享核心可脱离 UI、CLI、数据库和网络独立导入与调用。
- `FR-007`、`FR-008`：Electron 活动工程、专用依赖与 `dev:desktop` 已删除，根 CLI 命令和统一质量门已生效。
- `FR-012`：活动文档已切换到 CLI/共享核心/未来适配器，历史 ADR 取代链可追溯。
- `FR-013`：API、Worker、Web、数据库包、migration 和运行数据无变更。

## 4. 测试与验证

- 交付与验证策略：`relaxed`。
- 最终验证结论：`passed`。
- 阻塞结论：所有 core 验收、项目硬门禁和用户已有工作保护均通过。

| 类型 | 命令或检查 | 观察结果 | 结论 |
| --- | --- | --- | --- |
| 环境 | Node 24 NVM 路径下检查 Node/pnpm 和平台 | Node `v24.18.0`、pnpm `11.9.0`、macOS arm64 | pass |
| 根质量门 | `pnpm check` | format、lint、9 个 build/typecheck workspace、21 项测试全部通过 | pass |
| 核心测试 | `@ngapd/workspace-core` Vitest | 3/3 通过 | pass |
| CLI/MCP 测试 | `@ngapd/workspace-cli` Vitest | 10/10 通过；覆盖命令、MCP 子进程、畸形输入、stdin 与信号 | pass |
| 正式 bin | `pnpm exec ngapd-workspace --version` 与 `status --json` | 根 wrapper 可执行，版本 `0.1.0`，只声明两个只读能力 | pass |
| 命令矩阵 | help、version、status/doctor 人类与 JSON、未知命令 | 无 GUI；人类/JSON 同源；未知命令稳定退出 2 | pass |
| MCP 集成 | SDK Client 初始化、发现并调用真实 stdio 子进程 | 只发现两个只读工具；调用成功；协议 stdout 纯净 | pass |
| 错误与关闭 | 畸形协议、stdin 关闭、SIGINT、SIGTERM | 畸形输入 stderr + 退出 2；信号退出 130/143 | pass |
| 离线与敏感输出 | 最小环境、无数据库/网络/Workspace、测试 sentinel | 命令可运行；不泄露 sentinel 或个人绝对路径 | pass |
| 写入与网络边界 | 写式未知命令空夹具对照；`lsof -a -p <pid> -i` | 创建文件 0，网络监听 0 | pass |
| 工程与数据范围 | Git/依赖/import/活动引用/migration 扫描；`pnpm why electron --depth infinity` | 无 Electron 活动工程或运行依赖；无数据库、API、Worker、Web 变化 | pass |
| README 与最终 diff | 基线指纹、逐行对照、secret/debug/transient 扫描、`git diff --check` | 用户 macOS/PostgreSQL/Docker 内容保留；范围与 whitespace 正常 | pass |

任务前 README 文件 SHA-256 为 `bda382882aa5f04b71994d2723cca61153eaaf680d674e671f7ae84476a587f3`，相对 HEAD 的 diff SHA-256 为 `9c388001c3bd7ecb0f1b3d41f28b98d70c74c2b21685bb1755852751908aee93`；任务后分别为 `697224cfcb49c61a221a5803c2d5cfe92f8d59039081cdff6d379f088a9cf911` 与 `f9ee3980bf12d461fab5935994cf2ea4c0a23777cbc87c29c381562f5e96eff5`。逐行审查确认既有内容未被覆盖。

## 5. 与路线图及阶段计划的偏差

无需求、设计、阶段边界、任务范围或验证策略偏差。

执行中发现 MCP SDK 默认静默丢弃畸形 JSON，已在 stdio 适配层补充稳定 stderr 与退出码 2；根 workspace 起初没有生成自身 CLI wrapper，已通过私有 workspace 开发依赖建立正式 bin 链接。两项均为实现既定验收所需的任务内修正，受影响测试与完整根门禁已复验通过。

pnpm registry 元数据曾重试，沙箱内依赖审查曾因本地 store 权限失败；获准访问后安装、lockfile 和 `pnpm why electron` 审查均通过。这些环境观察没有改变交付物、范围或验证结论。

## 6. 遗留事项

无开放 `FND-I-*`、未决问题、阻塞、数据迁移、外部副作用或后续实施阶段。

| ID | 类别 | 严重程度 | 关联需求/验收 | 观察与证据 | 最终功能影响 | 处置 | 置信度 | 建议后续 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |

