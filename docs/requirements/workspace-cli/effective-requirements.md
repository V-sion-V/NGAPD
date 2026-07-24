# Workspace CLI 替代桌面客户端：当前有效需求

- 派生状态：可重新生成
- 原始需求：[`requirements.md`](requirements.md)
- 已应用至修改记录：[`change-0.md`](change-0.md)
- 生成日期：2026-07-24

## 1. 当前目标与范围

NGAPD 当前使用无界面的 Workspace CLI 作为 Agent 与本地 Workspace 能力之间的受控边界。人工任务管理继续统一通过 Web 完成；CLI 首版只提供状态、诊断和 MCP stdio 接口。UI 无关能力位于独立共享核心中，未来 GUI、菜单栏程序或其他宿主必须通过适配器复用该核心，不得依赖 CLI 文本解析。

当前范围包括：

- `@ngapd/workspace-cli`、`ngapd-workspace` 可执行入口和 MCP 兼容 stdio 服务。
- `status`、`doctor`、`--help`、`--version` 及稳定 JSON 诊断输出。
- UI/CLI 无关的 `@ngapd/workspace-core` 状态、诊断、能力和平台适配边界。
- 根工程、依赖、活动文档、ADR 取代链及与本功能相称的自动验证。
- macOS Apple Silicon 与 Windows 11 x64 的目标兼容边界。

当前范围不包括 Workspace 扫描、文件监听、manifest、租约、同步、冲突处理、原子替换、登录、凭证、路径登记、管理员模式、任务或文件写工具、数据库迁移、SQLite、安装器、签名、公证、自动更新和 GUI。

## 2. 当前生效需求

| 当前编号 | 当前生效内容 | 验收要求与层级 | 来源 |
| --- | --- | --- | --- |
| `FR-001` | 仓库提供独立 workspace 应用 `@ngapd/workspace-cli`，并暴露 `ngapd-workspace` 可执行入口。 | `AC-001` core | [`requirements.md`](requirements.md) |
| `FR-002` | CLI 提供 `serve --stdio`，允许 Agent 宿主通过 MCP 兼容 stdio 完成初始化、能力发现和诊断调用。 | `AC-002`, `AC-003` core | [`requirements.md`](requirements.md) |
| `FR-003` | 首版协议只暴露只读状态和诊断；扫描、同步、租约及修改能力保持不可用且不出现在能力列表。 | `AC-002` core | [`requirements.md`](requirements.md) |
| `FR-004` | CLI 提供 `status`、`doctor`、`--help`、`--version`；状态与诊断支持稳定 JSON 输出。 | `AC-001` core；`AC-012`, `AC-013` supplemental | [`requirements.md`](requirements.md) |
| `FR-005` | 协议模式的 stdout 只承载协议消息，日志、诊断和非协议错误进入 stderr。 | `AC-003` core | [`requirements.md`](requirements.md) |
| `FR-006` | UI 无关能力、类型和端口位于独立共享包；CLI 是薄适配层，未来 GUI 不依赖命令解析。 | `AC-005` core | [`requirements.md`](requirements.md) |
| `FR-007` | Electron 应用、renderer、preload、构建配置和专用依赖从活动工程删除，不保留休眠空壳。 | `AC-004` core | [`requirements.md`](requirements.md) |
| `FR-008` | 根命令使用清晰的 CLI 入口替代 `dev:desktop`，统一 build、typecheck 和 test 覆盖 CLI 与共享核心。 | `AC-008`, `AC-011` core | [`requirements.md`](requirements.md) |
| `FR-009` | 首版运行不要求 PostgreSQL、网络、登录凭证或已登记 Workspace；离线状态和诊断如实说明未配置项。 | `AC-006` core；`AC-013` supplemental | [`requirements.md`](requirements.md) |
| `FR-010` | CLI 不监听 TCP/局域网端口，不接受任意未登记路径，不在普通输出泄露环境变量、凭证或本机敏感路径。 | `AC-007` core及安全硬门禁 | [`requirements.md`](requirements.md) |
| `FR-011` | 未知命令、无效参数、协议失败和中断产生稳定、非零且可诊断的结果；协议 stdout 不输出人类堆栈。 | `AC-007` core | [`requirements.md`](requirements.md) |
| `FR-012` | 活动文档采用 Workspace CLI/本地工具服务作为当前方案，并把未来 GUI 定义为可选适配器；历史 Electron ADR 保留可追溯取代链。 | `AC-010` core | [`requirements.md`](requirements.md) |
| `FR-013` | PostgreSQL、migration、API、Worker 和 Web 保持兼容；本功能不创建 migration 或修改数据库运行数据。 | `AC-009` core | [`requirements.md`](requirements.md) |
| `FR-014` | 平台信息通过适配边界提供，核心不依赖 Electron；后续 macOS/Windows 凭证、IPC 和文件系统差异可由平台适配器扩展。 | `AC-005`, `AC-013` core/supplemental | [`requirements.md`](requirements.md) |
| `FR-015` | 首版不提供人类直接写任务、绕过 Agent 确认或绕过服务端权限的命令。 | `AC-007` core及授权硬门禁 | [`requirements.md`](requirements.md) |

## 3. 当前流程

### 3.1 Agent 调用

1. Agent 宿主启动 `ngapd-workspace serve --stdio`。
2. 宿主通过 MCP 完成初始化并发现能力。
3. 宿主调用 `workspace_status` 或 `workspace_doctor`。
4. CLI 返回不含敏感环境信息的结构化平台、版本、能力和配置状态。
5. stdin 关闭或收到正常关闭信号后，CLI 停止接收请求并退出。

### 3.2 人工诊断

1. 开发者运行 `ngapd-workspace status` 或 `ngapd-workspace doctor`。
2. 默认输出适合阅读的诊断；自动化可使用 `--json` 获取稳定对象。
3. 两种呈现来自同一结果对象并表达相同结论。
4. 人工命令不修改任务、数据库或 Workspace 文件。

### 3.3 未来宿主

未来 GUI 或其他宿主创建独立适配层，直接调用 `@ngapd/workspace-core`，复用相同权限、路径和同步规则，不调用或模拟 CLI 文本命令。

## 4. 当前数据、接口与状态

- 公共可执行入口：`ngapd-workspace`。
- 人工接口：`status [--json]`、`doctor [--json]`、`--help`、`--version`。
- Agent 接口：MCP 兼容 stdio；当前只注册 `workspace_status` 与 `workspace_doctor` 两个只读工具。
- 状态结果表达服务名、应用版本、协议能力版本、平台、CPU 架构、Node.js 版本、当前能力和配置就绪状态。
- 诊断项包含稳定 `id`、结果状态和不泄露敏感信息的说明。
- 平台事实经 `PlatformAdapter` 提供给共享核心，核心不直接依赖 Electron、CLI、GUI、数据库或网络。
- 当前功能不创建持久化业务状态、不读写服务端数据库、不引入本地数据库文件，也没有 migration。
- Workspace 注册、凭证、manifest、扫描与同步状态仍未实现；未配置 Workspace 被如实报告为 warning，而不是伪装为就绪。

## 5. 当前异常、边界、安全与恢复

- 未知命令和无效参数输出简短稳定错误到 stderr，并使用退出码 2。
- 畸形协议输入只进入 MCP/stdio 错误边界，输出稳定非协议错误到 stderr 并安全终止；输入不会被解释为 shell 命令或文件路径。
- SIGINT、SIGTERM 和 stdin 关闭会停止服务；信号退出结果稳定且不存在待回滚的数据写入。
- CLI 不监听网络端口，不枚举环境变量，不输出凭证、个人绝对路径或 Workspace 内容。
- 状态和诊断可以区分 CLI 自身运行条件与可选配置缺失；离线和无数据库环境不阻塞启动。
- 当前不存在任务、Workspace、文件、数据库或 shell 写入口，不能绕过 Agent 确认或服务端权限。
- 如未来变更失败，只恢复该变更拥有的文件，不进行数据库补偿；用户已有 README 内容必须按记录的基线独立保护。

## 6. 当前非功能要求

- Node.js 24、pnpm workspace、TypeScript、ESLint、Prettier、构建、类型检查和测试门禁持续适用。
- MCP stdout 必须确定、可解析并与普通日志隔离。
- 首版离线状态和诊断不得依赖数据库或网络可用性。
- 运行时依赖必须兼容 macOS Apple Silicon 与 Windows 11 x64。
- `@ngapd/workspace-core` 不得依赖 Electron、React、DOM、具体 GUI 框架或 CLI 参数解析。
- 授权、确认、路径隔离、敏感信息和审计边界不得因 CLI 或宽松验证策略降低。
- 活动文档必须清楚区分 Web 人工界面、Agent、Workspace CLI、本地文件和统一后端的职责。

## 7. 当前验收要求

| 验收 | 层级 | 当前可观察要求 |
| --- | --- | --- |
| `AC-001` | core | 构建后 help、version、status 和 doctor 均可执行且不启动 GUI。 |
| `AC-002` | core | MCP 宿主可通过 stdio 初始化、发现并调用首版只读工具。 |
| `AC-003` | core | 协议 stdout 不混入日志或人类说明，错误不会破坏协议解析。 |
| `AC-004` | core | 活动工程无 Electron 应用、配置、运行依赖或 `dev:desktop`。 |
| `AC-005` | core | 共享核心可在无 Electron、React、DOM 和 CLI 解析器的 Node 环境独立导入和调用。 |
| `AC-006` | core | 无 PostgreSQL、网络和 Workspace 配置时，状态与诊断仍可运行并如实报告。 |
| `AC-007` | core | 未知命令、无效参数和无效协议输入稳定失败，不执行文件、数据库或 shell 写入。 |
| `AC-008` | core | API、Worker、Web、共享包与 CLI 的统一质量门全部通过。 |
| `AC-009` | core | 无 migration、PostgreSQL 结构、数据库运行文件或既有服务端行为变化。 |
| `AC-010` | core | README 与活动架构文档一致采用 CLI 当前方案并保留历史 ADR 取代链。 |
| `AC-011` | core | README 既有 macOS 开发内容得到保留并正确切换为 CLI 命令。 |
| `AC-012` | supplemental | status/doctor 的人类与 JSON 呈现清晰且表达相同结论。 |
| `AC-013` | supplemental | 真实 macOS Apple Silicon 环境完成 CLI 和 MCP stdio 冒烟。 |

## 8. 当前决策

| 决策项 | 当前结论 |
| --- | --- |
| 交付与验证策略 | `relaxed`；所有 core 验收和安全、隐私、数据完整性、兼容、构建、恢复及用户工作保护硬门禁仍阻塞完成。 |
| CLI 使用者 | Agent 优先；人工只使用状态和诊断入口。 |
| 当前客户端 | 删除 Electron 空壳，以 Workspace CLI 和本地工具服务作为当前方案。 |
| 首版能力 | 只交付客户端基础、共享核心、协议和诊断，不实现完整同步或写能力。 |
| 数据库 | PostgreSQL 保持不变，不引入 SQLite 或 migration。 |
| Agent transport | 使用 MCP 兼容 stdio，不监听网络端口。 |
| 人工任务管理 | 统一使用 Web；CLI 不提供人工业务写命令。 |
| 未来 GUI | 作为独立适配器直接复用 Workspace 核心，不依赖 CLI 文本输出。 |

## 9. 已替换或退役项目

| 项目 | 当前状态 | 取代方式与来源 |
| --- | --- | --- |
| `apps/desktop` Electron/React 空壳 | 已从活动工程删除 | 由 `apps/workspace-cli`、`packages/workspace-core` 和 ADR-014 取代；[`requirements.md`](requirements.md) `FR-007`, `FR-012` |
| 根命令 `dev:desktop` | 已删除 | 由 `dev:workspace` 与正式 `ngapd-workspace` bin 取代；[`requirements.md`](requirements.md) `FR-008` |
| Electron 专用构建配置与依赖 | 已删除 | CLI 使用 Node.js 构建和 MCP stdio；[`requirements.md`](requirements.md) `FR-007` |
| Electron 作为当前客户端架构的 ADR 表述 | 已被取代但历史保留 | ADR-009/010 的相关历史由 ADR-014 显式 supersede，不静默删除；[`requirements.md`](requirements.md) `FR-012` |

## 10. 来源链

1. 原始产品需求：[`requirements.md`](requirements.md)。
2. 工作流契约：[`workflow-contract.md`](workflow-contract.md)。
3. 初始路线图：[`implementation-plan.md`](implementation-plan.md)。
4. 执行权威：[`execution/initial/execution-state.md`](execution/initial/execution-state.md)。
5. 阶段计划与不可变结果：[`execution/initial/phase-001-plan.md`](execution/initial/phase-001-plan.md)、[`execution/initial/phase-001-result.md`](execution/initial/phase-001-result.md)。
6. 首次实现记录：[`change-0.md`](change-0.md)。

当前没有后续 `RC-*` 需求变更；本快照的有效行为等同于原始需求经 `change-0.md` 完成后的状态。
