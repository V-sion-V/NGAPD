# Workspace CLI 替代桌面客户端：初始实施路线图

## 1. 范围与执行模式

- 执行模式：`single`
- 计划详细度：`expanded`
- 交付与验证策略：`relaxed`
- 路线图修订：`2`
- 需求指纹：`sha256:c85eb28b24b4fbd084e4a6a3392da81e1bf0afedea4b452ee75cf768ff53c5be`
- 项目基线：分支 `prototype`，提交 `7be2bf685143112571debfe924ce59ee1b40e1b9`
- 选择理由：CLI、共享核心、Electron 切换、文档与验收可以在一个可恢复且最终可构建的阶段内完成，不存在数据迁移、公共兼容过渡、独立审批或外部交接。`README.md` 同时包含用户未提交的 macOS 开发说明，属于明确的同文件多所有者风险，因此只为该重叠和删除式切换采用 `expanded` 细节，不拆分阶段。
- 规划时相关工作区状态：`README.md` 已修改；`requirements.md` 与 `workflow-contract.md` 是未跟踪但已审批的本工作流输入。当前规划环境为 macOS arm64，但活动 `node` 为 `v22.22.1`，执行前必须切换到 `.node-version` 的 `24.18.0`。

本路线图只覆盖 `requirements.md` 中已批准的首版只读 CLI 能力，不提前实现 Workspace 扫描、同步、租约、登录、凭证、路径登记、业务写工具、数据库变化或 GUI。

## 2. 项目现状与全局实现依据

- `apps/desktop` 当前只有 Electron 主进程、preload 和 React renderer 空壳，没有需要迁移的 Workspace 业务实现；其依赖、构建配置及本地产物可以随切换一起移除。
- 根工程使用 Node.js 24、pnpm workspace、TypeScript `NodeNext`、ESLint、Prettier 和 Vitest；根 `pnpm check` 顺序覆盖格式、lint、build、typecheck 和 test。
- 现有共享包采用 `packages/<name>`、`@ngapd/<name>`、`dist` 导出和独立 TypeScript 配置的惯例。新增核心包按此惯例命名为 `packages/workspace-core` / `@ngapd/workspace-core`。
- 新应用使用 `apps/workspace-cli` / `@ngapd/workspace-cli`，并通过包清单的 `bin` 暴露 `ngapd-workspace`。根 `dev:desktop` 由语义清晰、可透传 CLI 参数的 Workspace CLI 开发入口替代。
- 当前依赖中没有 MCP SDK。官方仓库的 v2 在规划日仍是 pre-alpha，官方仍推荐 v1.x 用于生产；实现采用 `@modelcontextprotocol/sdk` v1.x 的 stdio server transport，并由 lockfile 固定实际版本，不自定义长期公共协议。命令解析优先使用 Node.js 内建能力，避免无必要的解析器依赖。
- PostgreSQL、API、Worker、Web、现有领域包和数据库包不需要改变；本功能没有 migration、回填、双写、持久化业务状态或部署切换。
- 活动文档中的 Electron 方案分布在 README、系统架构、Agent 接口、路线图、决策、技术 ADR、原型入口和 Workspace 同步原型说明。历史 ADR 内容必须保留并显式标为被新的 CLI 决策取代。

## 3. 全局详细设计

### 3.1 组件与依赖方向

1. `@ngapd/workspace-core`
   - 定义 Workspace 服务状态、诊断结果、只读能力声明和平台适配端口。
   - 提供不依赖 Electron、React、DOM、CLI 解析器、数据库或网络的状态与诊断服务。
   - 只接收适配器提供的运行时信息；核心包不得直接扩展到路径扫描、凭证、同步或任务写入。
2. `@ngapd/workspace-cli`
   - 负责参数解析、人类输出、JSON 输出、退出码、信号处理和 MCP stdio 适配。
   - Node 平台适配器读取允许公开的平台、架构、Node 版本和应用版本后调用核心服务。
   - `serve --stdio` 只注册 `workspace_status` 与 `workspace_doctor` 两个只读工具；初始化和工具发现由正式 MCP transport 处理。
3. 工程与文档切换
   - 删除 `apps/desktop` 的活动源码、配置、依赖与残留本地产物，更新根脚本、workspace 构建白名单和 lockfile。
   - 更新所有活动入口对当前客户端的描述；保留旧 Electron ADR 的历史文本，并新增明确的取代关系与当前决策。

依赖方向固定为：

```text
Agent 宿主 ──MCP stdio──> workspace-cli ──> workspace-core
人工诊断 ───CLI args────> workspace-cli ──> workspace-core
未来 GUI ────────────────────────────────> workspace-core
```

`workspace-core` 不得反向依赖 CLI、未来 GUI、服务端应用或数据库。

### 3.2 接口、数据与错误边界

- 状态模型至少包含服务名、应用版本、协议能力版本、操作系统平台、CPU 架构、Node.js 版本、已实现能力和配置就绪状态。
- 诊断模型的每项检查包含稳定 `id`、结果状态和安全说明；人类输出与 `--json` 输出必须由同一结果对象投影，避免两套结论漂移。
- 首版能力声明只列出状态与诊断。不存在 Workspace 路径输入、文件写入、数据库调用、登录、同步、租约或任务修改入口。
- CLI 用稳定的使用错误、运行错误和中断结果区分未知命令、无效参数、内部启动失败与信号退出；非零退出码及 stderr 文本不得包含凭证、环境变量或个人绝对路径。
- MCP 输入只交给 SDK 协议解析器；无效协议输入返回协议错误或安全终止，绝不作为 shell、文件路径或命令再次解释。
- stdio server 生命周期在 stdin 关闭、SIGINT 或 SIGTERM 后停止接收新请求并干净结束；本功能没有需要提交或回滚的数据。

### 3.3 安全、可观察性与兼容

- `serve --stdio` 将 stdout 专用于协议帧；日志、诊断和非协议错误统一写 stderr。测试必须从实际子进程分别捕获两个流。
- CLI 不监听 TCP、局域网端口、Unix socket 或 Named Pipe，也不接受未登记路径；未来 transport 和路径能力只能在独立需求及安全设计后添加。
- 状态和诊断采用允许列表输出，不枚举环境变量、数据库连接串、用户目录或真实 Workspace 路径。
- 构建目标遵循 Node.js 24 和当前 TypeScript `NodeNext` 约束；核心包只使用 Node 可用类型。平台差异通过适配端口注入，保证 macOS arm64 和 Windows x64 后续实现不需要引入 Electron。
- README 的现有 macOS 安装和 PostgreSQL 开发说明属于用户已有内容；实现只能把其中 Electron 命令与说明改为 CLI，不能覆盖或重写其余新增内容。

### 3.4 迁移、发布与恢复

- 无数据 migration、数据库写入、兼容双写或运行时状态转换。
- 代码切换在同一阶段完成：只有新核心包、CLI、根入口、lockfile 和活动文档共同通过最终门禁后，阶段才可完成。
- 如切换失败，不恢复数据库或生成补偿数据；恢复时只撤销本功能拥有的文件变化，并以执行前保存的 README diff 为准保留用户内容。
- Electron ADR 通过“保留原文并标记 superseded、追加新决策”的方式迁移文档语义；不抹除历史。

## 4. 阶段路线图

| 阶段 | 目标 | 关联需求与验收 | 前置阶段 | 退出条件 | 当前状态 |
| --- | --- | --- | --- | --- | --- |
| P-001 | 用共享核心与 MCP stdio CLI 完整替换 Electron 空壳，完成工程、文档和整体验收 | `FR-001`–`FR-015` / `AC-001`–`AC-013` | 无 | 所有 core 验收与硬门禁通过；supplemental 验收通过或形成符合 relaxed 规则的稳定 `FND-I-*`；项目保持可构建且用户 README 内容保留 | ready |

## 5. 跨阶段依赖与不变量

本路线图只有一个阶段，没有跨阶段接口或中间交付状态。P-001 全程必须保持以下不变量：

- 不修改数据库 migration、PostgreSQL 数据结构或运行数据，不改变 API、Worker、Web 的公开行为。
- 不提供任何任务、Workspace、文件、数据库或 shell 写能力，不监听网络端口。
- stdout 在协议模式中只承载 MCP 消息，所有非协议信息进入 stderr。
- `@ngapd/workspace-core` 始终可脱离 Electron、React、DOM 和 CLI 解析器独立导入。
- README 用户已有 macOS 开发说明不得丢失；若工作区出现新的重叠修改，先暂停并更新执行状态。
- 阶段未通过完整退出门禁前，不得写入 `phase-001-result.md`、`change-0.md` 或 `effective-requirements.md`。

## 6. 最终集成与整体验证流程

验证在全部实现、依赖切换和文档更新之后执行一次，避免后续 lockfile、根脚本或删除操作使证据失效。

1. 在 Node.js `24.18.0` / pnpm `11.9.0` 下执行根 `pnpm check`，覆盖格式、lint、全 workspace build、typecheck 和 test；CLI 测试包括命令解析、核心包适配、JSON/人类输出一致性、错误边界和实际 stdio MCP 子进程会话。
2. 对构建后的 `ngapd-workspace` 执行 `--help`、`--version`、`status`、`status --json`、`doctor`、`doctor --json` 及未知参数冒烟；在无数据库、无网络和无 Workspace 配置下确认结果、退出码与敏感信息边界。
3. 使用 MCP 客户端对子进程执行初始化、工具发现、`workspace_status`、`workspace_doctor`、无效输入和关闭流程，分别断言 stdout 协议纯净性及 stderr 隔离。
4. 检查活动源码、依赖、根脚本和文档不再把 Electron 当作当前方案，且数据库 migration 与服务端数据结构没有变化；复核 README 执行前后 diff，确认用户已有 macOS 内容被保留。
5. 在当前真实 macOS arm64 环境完成 CLI 与 stdio 冒烟。`AC-001`–`AC-011` 及所有硬门禁为阻塞项；`AC-012`、`AC-013` 只有在独立证据证明不影响交付功能时，才可作为 report-only finding，以 `FND-I-001` 起连续编号并最终汇总。

## 7. 需求追踪矩阵

| 需求与验收 | 阶段 | 实现落点 | 验证 |
| --- | --- | --- | --- |
| `FR-001`–`FR-005`, `FR-009`–`FR-011`, `FR-014`, `FR-015`; `AC-001`–`AC-003`, `AC-006`, `AC-007` | P-001 | `apps/workspace-cli`、Node 平台适配器、MCP stdio server、人工命令与错误边界 | 根门禁、构建后二进制命令矩阵、MCP 子进程集成、离线与负向输入检查 |
| `FR-006`; `AC-005` | P-001 | `packages/workspace-core` 的模型、服务与平台端口 | 核心包独立导入和假适配器单元测试；依赖扫描确认无 UI/CLI 反向依赖 |
| `FR-007`, `FR-008`; `AC-004`, `AC-008`, `AC-011` | P-001 | 删除 `apps/desktop`，更新根脚本、workspace 配置、lockfile 与 README CLI 入口 | 根 `pnpm check`、Electron 活动引用/依赖扫描、README 基线 diff 对照 |
| `FR-012`; `AC-010` | P-001 | README、活动架构/Agent/路线/决策/原型文档，旧 ADR 的 superseded 链 | 活动文档引用审查与取代关系检查 |
| `FR-013`; `AC-009` | P-001 | 数据库、API、Worker、Web 保持不变 | Git 范围审查、根门禁中既有构建与测试 |
| `FR-004`, `FR-009`; `AC-012`, `AC-013` | P-001 | 同源的人类/JSON 呈现与真实 macOS 运行 | 人工可读性对照、macOS arm64 CLI/MCP 冒烟；仅允许符合策略的 `FND-I-*` |

覆盖结论：15 个 `FR-*` 和 13 个 `AC-*` 均映射到 P-001 的实现落点与最终验证。

## 8. 风险、技术决策与修订记录

### 8.1 风险与处置

| 风险 | 级别 | 处置 |
| --- | --- | --- |
| README 同一文件包含用户未提交修改 | 高 | 执行前保存并复核基线 diff，只修改 Electron/CLI 相关行；发生新重叠时暂停，不使用整文件覆盖或破坏性恢复 |
| stdout 日志污染导致 MCP 会话不可解析 | 高 | 协议模式集中管理输出通道，并用实际子进程分别断言 stdout/stderr |
| 删除 Electron 后新 CLI 尚不可构建 | 中 | 在同一任务中先建立核心与 CLI，再完成工程切换；最终门禁失败时保持阶段未完成并按精确恢复步骤处理 |
| 新 MCP 依赖或 Node 版本与平台不兼容 | 中 | 使用官方生产推荐的 SDK v1.x 和 Node 24，在 lockfile、根构建及真实 macOS arm64 冒烟中验证；不采用仍为 pre-alpha 的 v2，Windows 边界由平台适配器和 Node 类型约束保护 |
| 活动文档与历史 ADR 混淆 | 中 | 旧 ADR 原文保留并显式 superseded，新增当前决策并统一活动入口 |

### 8.2 技术决策

| ID | 决策 | 依据与影响 |
| --- | --- | --- |
| TD-001 | 共享包使用 `packages/workspace-core` / `@ngapd/workspace-core` | 延续现有私有 workspace 包惯例，并清晰表达无 UI 的复用边界 |
| TD-002 | CLI 使用 `@modelcontextprotocol/sdk` v1.x 的 stdio transport，并由 lockfile 固定实际版本 | 官方在规划日仍推荐 v1.x 用于生产，v2 尚为 pre-alpha；该选择满足成熟 MCP 兼容和标准生命周期，不创造长期私有文本协议 |
| TD-003 | 首版 MCP 工具名为 `workspace_status` 与 `workspace_doctor` | 与首版只读能力一一对应；未实现能力不会出现在发现结果中 |
| TD-004 | 单阶段、单任务交付 | 所有改动属于同一原子客户端替换，没有安全中间态、迁移或外部交接需要拆分 |

### 8.3 修订记录

| 修订 | 日期 | 原结论 | 原因与证据 | 影响阶段 | 追踪影响 |
| --- | --- | --- | --- | --- | --- |
| 1 | 2026-07-24 | 初始路线图 | schema 3.2 需求审计通过；用户明确选择 relaxed 并确认可单阶段；项目检查确认 Electron 为空壳且 README 存在用户重叠修改 | P-001 | 首次建立 `FR-001`–`FR-015`、`AC-001`–`AC-013` 完整映射 |
| 2 | 2026-07-24 | 使用官方 MCP TypeScript SDK，未指定稳定主版本 | 官方 SDK 仓库声明 v2 仍为 pre-alpha、v1.x 仍是生产推荐线；为避免执行时误装不稳定主版本，明确使用 `@modelcontextprotocol/sdk` v1.x 并由 lockfile 固定 | P-001 | 不改变需求、阶段或验收映射，只收紧 TD-002 的依赖兼容边界 |
