# P-001：Workspace CLI 单阶段实施计划

- 运行编号：`initial`
- 阶段编号：`P-001`
- 计划修订：`2`
- 父路线图修订：`2`
- 需求指纹：`sha256:c85eb28b24b4fbd084e4a6a3392da81e1bf0afedea4b452ee75cf768ff53c5be`
- 项目基线：分支 `prototype`，提交 `7be2bf685143112571debfe924ce59ee1b40e1b9`
- 创建日期：`2026-07-24`
- 详细度：`expanded`
- 交付与验证策略：`relaxed`
- 验证结论：`pending`

## 1. 阶段目标、边界与关联需求

在一个可恢复任务中，以独立 Workspace 核心包和 `@ngapd/workspace-cli` 替换 Electron 空壳，交付人工诊断命令与 MCP stdio 只读工具，完成根工程、lockfile、活动文档和全部验收。

本阶段覆盖路线图追踪矩阵中的全部 `FR-001`–`FR-015` 与 `AC-001`–`AC-013`。不实现扫描、监听、manifest、租约、同步、登录、凭证、路径登记、业务写工具、本地数据库、服务端数据变化或 GUI；不得创建数据库 migration。

进入任务前必须验证：

- 工作区仍基于提交 `7be2bf685143112571debfe924ce59ee1b40e1b9`，且没有新的用户修改与本阶段文件范围发生重叠。
- 保存并重新阅读 `git diff -- README.md`；该 diff 是必须保留的用户内容基线。
- 将活动 Node.js 切换为 `.node-version` 的 `24.18.0`，确认 pnpm 为 `11.9.0`。
- `requirements.md`、路线图和本计划指纹一致，且不存在 `change-0.md` 或既有 phase result。

## 2. 任务与文件范围

| 任务 | 结果 | 文件或范围 | 实现摘要 | 验证 | 完成条件 |
| --- | --- | --- | --- | --- | --- |
| P-001-T-001 | 当前客户端由可复用核心与只读 MCP stdio CLI 完整承担，Electron 空壳退出活动工程，文档与工程门禁一致 | 新增 `packages/workspace-core/**`、`apps/workspace-cli/**`；删除 `apps/desktop/**`；修改 `package.json`、`pnpm-workspace.yaml`、`pnpm-lock.yaml`、`README.md`、相关 `docs/**` 与 `prototypes/workspace-sync/**` 活动说明 | 定义状态/诊断模型、平台端口和纯核心服务；使用 `@modelcontextprotocol/sdk` v1.x 实现 `ngapd-workspace` 人工命令、JSON 呈现、MCP stdio server、只读工具、错误/信号边界及测试；移除 Electron 依赖与入口；保留 README 用户内容并建立 ADR 取代链 | 完成全部改动后一次执行根 `pnpm check`、构建后二进制命令矩阵、实际 MCP stdio 子进程会话、离线/负向/敏感输出检查、Electron/数据库范围扫描、README diff 对照和真实 macOS arm64 冒烟 | 所有 core 验收与硬门禁通过；supplemental 通过或产生合规 `FND-I-*`；状态记录实际文件和证据，项目可构建且无未决材料问题 |

本阶段只有一个任务，无任务间依赖。

### 2.1 文件所有权与协调

| 范围 | 执行所有权 | 协调要求 |
| --- | --- | --- |
| `README.md` | 用户已有 macOS 开发说明优先；任务只拥有 Electron 到 CLI 的必要替换 | 禁止整文件重写；修改前后逐行对照执行前 diff，保留现有安装、PostgreSQL、Docker 与 macOS 说明。发现新重叠时将任务置为 paused |
| `requirements.md`、`workflow-contract.md`、`implementation-plan.md`、本计划 | 已批准的工作流输入与规划证据 | 实现任务不得修改；如项目事实使计划不可行，暂停并请求独立修订 |
| `apps/desktop/**` | 本功能拥有删除范围 | 删除活动源码、配置、Electron 专用依赖和遗留本地产物；不得迁移不存在的业务逻辑 |
| 新核心、CLI、根配置、lockfile 与活动文档 | 本功能实现范围 | 单任务顺序修改；不得顺带改动 API、Worker、Web、数据库或无关产品内容 |

### 2.2 暴露接口

- 包：`@ngapd/workspace-core`，导出状态/诊断模型、能力声明、平台适配端口和纯服务。
- 可执行入口：`ngapd-workspace`。
- 人工接口：`--help`、`--version`、`status [--json]`、`doctor [--json]`。
- Agent 接口：`serve --stdio`，MCP 初始化、工具发现、`workspace_status`、`workspace_doctor`。
- 输出边界：协议 stdout；日志和非协议诊断 stderr；人类命令 stdout 只输出其请求结果。

### 2.3 执行顺序

1. 按 execution state 的任务前检查点记录 README 基线、目标范围、Node/pnpm 版本和准确完成条件，再将任务标为 `in_progress`。
2. 建立 `@ngapd/workspace-core` 的模型、端口、服务和单元测试，使用假平台适配器证明独立导入及离线行为。
3. 建立 `@ngapd/workspace-cli` 的 bin、Node 平台适配器、人工命令、MCP stdio server、错误/信号处理和集成测试；能力发现只包含两个只读工具。
4. 更新根脚本、workspace 构建白名单和 lockfile，删除 `apps/desktop` 的源码、配置、依赖及残留本地产物。
5. 以执行前 README diff 为保护基线更新开发入口；同步更新活动架构、Agent、路线、决策、ADR 与原型说明，保留并标记旧 Electron ADR 为 superseded。
6. 全部实现完成后执行第 3 节的一次性最终验证。失败时停留在本任务，不开始工作流收尾；成功后记录任务后检查点并完成阶段。

## 3. 验证与完成条件

### 3.1 Core 阻塞门禁

1. 环境确认：`node --version` 为 `v24.18.0`，`pnpm --version` 为 `11.9.0`。
2. 根质量门：执行 `pnpm check`，必须完整通过 format、lint、build、typecheck 与所有 workspace tests。
3. 构建后人工命令：执行 `ngapd-workspace --help`、`--version`、`status`、`status --json`、`doctor`、`doctor --json`；断言无 GUI、JSON 稳定可解析、人类/JSON 结论一致。
4. MCP 集成：由 MCP 客户端启动 `ngapd-workspace serve --stdio`，完成初始化、发现并调用两个只读工具；覆盖无效协议输入、stdin 关闭、SIGINT/SIGTERM，并分别断言 stdout 与 stderr。
5. 离线与安全：在不提供数据库、网络和 Workspace 配置时重复状态/诊断；未知命令和无效参数必须非零且可诊断，不得产生文件、数据库或 shell 写入，不得输出敏感变量或个人绝对路径。
6. 工程范围：确认根脚本不再有 `dev:desktop`，活动工程、lockfile 和活动文档没有把 Electron 当作当前依赖或方案；旧 ADR 仅作为有 superseded 链的历史保留。
7. 兼容与用户内容：根门禁继续覆盖 API、Worker、Web 和共享包；Git 范围中没有 migration、数据库结构或运行数据变化；README 执行前后的用户 macOS 内容完整保留。

任一 core 验收、安全/隐私/数据完整性、公共兼容、构建、恢复、必需项目门禁或用户内容保护失败，都阻塞任务和阶段完成。

### 3.2 Supplemental 检查与 finding 规则

- 对照 `status` / `doctor` 的人类文本和 JSON 结果，确认新开发者可理解且结论一致。
- 在当前真实 macOS arm64 环境执行一次人工 CLI 与 MCP stdio 冒烟。
- 只有独立证据已证明所有相关 core 行为通过，且异常不影响交付功能时，supplemental 异常才可记录为 report-only finding；从 `FND-I-001` 起连续编号。任何未知影响、高/严重、安全、兼容、构建或必需门禁问题仍阻塞完成。

### 3.3 阶段完成条件

- P-001-T-001 已在 execution state 中记录实际文件变化、验证命令与观察结果。
- 所有 core 验收和硬门禁通过，验证结论为 `passed` 或仅含合规 finding 的 `passed_with_findings`。
- 每个 open `FND-I-*` 已按契约字段记录，且证明不影响交付功能。
- 工作区可构建，无未决问题、半应用删除或未知数据变化；随后才可创建不可变的 `phase-001-result.md` 并进入 initial run 收尾。

## 4. 风险、恢复与修订记录

### 4.1 风险与恢复

- README 重叠：若内容冲突或出现执行后新增用户修改，立即停止，保留当前 diff，在 execution state 记录冲突行和恢复入口；不得用 checkout、reset 或整文件替换。恢复后第一步是重新对照执行前 README diff，再只重放 CLI 相关行。
- 删除式切换：若 CLI 或根门禁失败，任务保持 `in_progress` 或 `paused`，不得宣告 Electron 删除完成。恢复时先读取 execution state 与当前 diff，完成或撤销本功能拥有的切换；不触碰数据库或 README 用户内容。
- 协议污染：若 stdout 包含非协议输出，先定位唯一写入点并修复通道隔离，再重新执行受影响的 MCP 子进程验证；不重复无关全套诊断。
- 环境版本：若 Node 24 无法启用，记录实际版本与阻塞原因并暂停，不得使用 Node 22 的结果替代必需门禁。

精确恢复入口：读取 `execution/initial/execution-state.md` 的当前检查点，复核 `git diff -- README.md` 与任务范围的当前 diff，确认活动 Node 版本，然后从 P-001-T-001 第一个未完成执行步骤继续。完成或暂停前必须把实际状态写回 execution state。

### 4.2 修订记录

| 修订 | 日期 | 变更 | 原因 | 影响 |
| --- | --- | --- | --- | --- |
| 1 | 2026-07-24 | 初始即时阶段计划 | P-001 前置条件已满足；README 存在用户重叠修改，因此增加最小必要的 expanded 所有权与恢复细节 | 建立 P-001-T-001 的完整执行与验证边界 |
| 2 | 2026-07-24 | 明确 MCP SDK 使用生产推荐的 v1.x | 官方资料确认 v2 尚为 pre-alpha，避免执行时误选不稳定主版本 | 不改变任务、文件范围或验证，只收紧依赖版本边界并同步父路线图修订 2 |
