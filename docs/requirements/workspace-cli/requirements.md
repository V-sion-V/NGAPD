# Workspace CLI 替代桌面客户端：需求

- 功能 ID：`workspace-cli`
- 需求状态：已确认，可进入独立规划
- 确认日期：2026-07-24

## 1. 背景与目标

NGAPD 当前包含一个 Electron + React 桌面客户端骨架，但本地 Workspace 预期完全由 Agent 操作，人工项目管理统一通过 Web 完成。完整桌面 GUI 在当前阶段重复了 Web 的职责，并引入 Chromium 打包、双套界面、签名、公证和更新成本。

本功能必须以无界面的 Workspace CLI 取代现有 Electron 骨架。CLI 作为 Agent 与本地文件系统之间的受控能力边界，通过标准输入输出提供结构化工具协议；可复用的 Workspace 能力必须与 CLI 适配层分离，使未来可以添加 GUI、菜单栏程序或其他宿主，而无需重写核心逻辑。

## 2. 范围

### 2.1 包含范围

- 删除当前仅有原型界面的 Electron 应用、构建配置和 Electron 专用依赖。
- 新增可构建、可执行的 Workspace CLI 应用。
- 提供 Agent 优先的 MCP 兼容标准输入输出入口。
- 提供仅用于人工诊断的 `status`、`doctor`、`--help` 和 `--version` 命令。
- 将 UI 无关的 Workspace 能力边界放入独立共享包，供 CLI 和未来 GUI 复用。
- 更新根命令、README、架构决策、Agent 接口、原型入口和其他仍把 Electron 描述为当前方案的有效文档。
- 为 CLI 命令解析、结构化输出、协议启动、错误边界和共享包适配接口提供与本次范围相称的自动验证。
- 保持 macOS Apple Silicon 和 Windows 11 x64 的目标兼容边界。

### 2.2 不包含范围

- 不在本功能中实现完整 Workspace 扫描、文件监听、manifest、租约、同步、冲突处理或原子替换；这些仍属于后续 Workspace 同步原型。
- 不实现登录、设备配对、操作系统凭证存储、管理员模式或真实业务修改工具；在存在这些能力前，CLI 不得声称已可执行对应操作。
- 不实现新的 Electron、原生 GUI、菜单栏或系统托盘程序。
- 不提供供人直接修改任务或 Workspace 内容的交互式命令。
- 不切换 PostgreSQL、Graphile Worker 或服务端数据架构，不引入 SQLite 作为本次功能的一部分。
- 不完成独立安装器、签名、公证、自动更新或单文件可执行程序分发。

## 3. 已确认的项目事实与约束

- 当前 `apps/desktop` 只创建安全隔离的 Electron 窗口并展示平台与版本，没有已实现的 Workspace 同步能力需要迁移。
- 当前 Agent 设计已经要求“本地 Agent 工具服务 + MCP 风格结构化工具契约”，并优先采用标准输入输出；常驻连接才考虑 macOS Unix Domain Socket 或 Windows Named Pipe。
- Agent 工具不得依赖提示词执行安全规则，不得访问未登记的任意路径，不得监听局域网端口，也不得获得独立越权身份。
- 项目采用 Node.js 24、pnpm workspace 和 TypeScript；所有应用通过根 workspace 命令统一构建、类型检查和测试。
- Web 是人工任务管理界面；任何任务管理修改仍必须遵守 `propose -> confirm -> execute`，移除桌面 GUI 不得降低确认、授权或审计要求。
- macOS Apple Silicon 和 Windows 11 x64 是当前首要客户端目标；规范化路径、Unicode、大小写、保留名与符号链接规则仍是后续核心约束。
- 当前权威服务端数据库是 PostgreSQL 17；本地或服务端数据结构不因本功能发生迁移。
- 工作区当前存在用户的未提交 `README.md` macOS 开发说明修改；后续实现必须保留其有效内容，并只调整与 Electron/CLI 相关的部分。

## 4. 交付与验证策略

- 用户明确选择 `relaxed`（宽松）策略。
- 实现可以先于测试；所有 `core` 验收标准和项目硬门禁仍然阻塞完成。
- 只有被证明不影响交付行为的补充验证异常，才可以使用稳定 `FND-I-*` 编号作为 report-only finding 保留。
- 安全、隐私、数据完整性、公共兼容性、构建性、恢复安全和用户已有修改不因宽松策略而降级。
- 不要求为了本功能人为制造额外测试阶段；规划应采用与风险相称的最少阶段。

## 5. 功能需求

- `FR-001`：仓库必须提供名为 `@ngapd/workspace-cli` 的独立 workspace 应用，并暴露 `ngapd-workspace` 可执行入口。
- `FR-002`：CLI 必须提供 `serve --stdio` 模式，允许 Agent 宿主通过 MCP 兼容的标准输入输出协议完成初始化、能力发现和诊断工具调用。
- `FR-003`：第一版协议至少必须暴露只读的 Workspace 服务状态和诊断能力；未实现的扫描、同步、租约或修改能力不得出现在可用能力列表中。
- `FR-004`：CLI 必须提供 `status`、`doctor`、`--help` 和 `--version` 人工诊断入口；`status` 与 `doctor` 必须支持稳定的 JSON 输出选项。
- `FR-005`：`serve --stdio` 模式下标准输出必须只包含协议消息；日志、诊断和非协议错误必须写入标准错误，避免破坏 Agent 通信。
- `FR-006`：UI 无关的 Workspace 能力、类型和端口必须位于独立共享包中；CLI 只能作为薄适配层，未来 GUI 必须能够复用该共享包而不依赖 CLI 命令解析。
- `FR-007`：现有 Electron 应用、renderer、preload、Electron 构建配置和 Electron 专用依赖必须从当前活动工程中删除；不得保留不能通过当前质量门的休眠空壳。
- `FR-008`：根 workspace 命令必须用清晰的 CLI 命令替换 `dev:desktop`，并保证统一构建、类型检查和测试仍覆盖新的 CLI 与共享包。
- `FR-009`：CLI 的首版运行不得要求 PostgreSQL、网络连接、登录凭证或已登记 Workspace；状态与诊断必须能够在离线基础环境中说明当前能力和未配置项。
- `FR-010`：CLI 不得监听 TCP 或局域网端口，不得接受任意未登记路径，不得把环境变量、凭证或本机敏感路径写入普通输出。
- `FR-011`：未知命令、无效参数、协议初始化失败和被中断退出必须产生稳定、非零且可诊断的结果；协议模式不得输出人类格式堆栈到标准输出。
- `FR-012`：活动产品与架构文档必须把当前客户端方案改为 Workspace CLI/本地工具服务，并明确未来 GUI 是可选适配器；历史 Electron ADR 必须以可追溯方式标记为被新决策取代，而不是静默抹除历史。
- `FR-013`：PostgreSQL 连接、migration、服务端 API、Worker 和 Web 的当前行为必须保持兼容；本功能不得创建数据库 migration 或修改数据库运行数据。
- `FR-014`：CLI 的平台相关信息必须通过适配边界提供，避免核心包依赖 Electron；macOS 与 Windows 的后续凭证、IPC 和文件系统差异必须能由平台适配器扩展。
- `FR-015`：第一版不得提供人类可直接写入任务、绕过 Agent 确认或绕过服务端权限的命令。

## 6. 用户流程或调用流程

### 6.1 Agent 调用

1. Agent 宿主以 `ngapd-workspace serve --stdio` 启动本地服务。
2. 宿主完成协议初始化并读取服务声明的能力。
3. 宿主调用只读状态或诊断工具。
4. CLI 返回结构化平台、版本、能力和配置状态，不返回敏感环境信息。
5. 宿主关闭标准输入或发送正常关闭信号后，CLI 干净退出。

### 6.2 人工诊断

1. 开发者执行 `ngapd-workspace status` 或 `ngapd-workspace doctor`。
2. CLI 输出适合阅读的诊断信息。
3. 自动化场景可增加 JSON 选项，得到稳定的机器可读对象。
4. 人工诊断命令不得修改任务、数据库或 Workspace 文件。

### 6.3 未来 GUI

1. 未来 GUI 创建独立应用适配层。
2. GUI 调用共享 Workspace 核心包，不调用或模拟 CLI 文本命令。
3. GUI 可以添加可视化状态和冲突处理，但必须复用相同权限、路径与同步规则。

## 7. 数据、接口与状态

- CLI 公共入口为 `ngapd-workspace`。
- 人工诊断接口包括 `status`、`doctor`、`--help`、`--version` 及诊断 JSON 输出选项。
- Agent 接口为 MCP 兼容 stdio transport；首版工具只覆盖状态与诊断。
- 状态结果至少表达服务名称、应用版本、协议能力版本、操作系统平台、CPU 架构、Node.js 版本、当前已实现能力和配置就绪状态。
- `doctor` 的单项检查必须包含稳定标识、结果状态和不泄露敏感信息的说明，便于 GUI 或 Agent 将来重新呈现。
- 本功能不创建持久化业务状态，不读写服务端业务数据库，不引入本地数据库文件，也没有数据 migration。
- 未来 Workspace 注册、凭证、manifest 和同步状态的数据模型不在本次冻结；共享包只能预留明确扩展边界，不得声称这些状态已实现。

## 8. 异常、边界与恢复

- 未知命令和无效参数必须显示简短帮助或结构化错误，并使用非零退出码。
- stdio 收到非协议输入时必须返回协议错误或安全终止，不得把输入当成 shell 命令或文件路径执行。
- 诊断检查失败必须区分“CLI 自身不可运行”和“某项可选能力未配置”；可选能力未配置不能伪装成已就绪。
- SIGINT、SIGTERM 或输入流正常关闭时，CLI 必须停止接收新请求并结束未持久化的诊断工作；本功能没有需要回滚的数据写入。
- 删除 Electron 后如新 CLI 未通过核心构建和验收，变更不得作为完成状态交付；恢复方式是保留用户已有修改并回退本功能拥有的文件变更，而不是恢复数据库。
- 未来 GUI 不得依赖未声明的 CLI 输出文本；只允许依赖共享包接口或正式结构化协议。

## 9. 非功能需求

- CLI 与共享包必须通过当前 TypeScript、ESLint、Prettier、构建和适用测试门禁。
- 首版离线状态与诊断不得因数据库或网络不可用而阻塞启动。
- 协议输出必须确定、可解析，并与普通日志隔离。
- 新增运行时依赖必须与 Node.js 24、macOS Apple Silicon 和 Windows 11 x64 兼容。
- 共享核心不得依赖 Electron、DOM、React 或具体 GUI 框架。
- CLI 不得降低既有授权、确认、路径隔离和审计边界；未实现安全前置条件的写能力必须保持不可用。
- 文档必须让新开发者能够区分 Web 人工界面、Agent、Workspace CLI、本地文件和统一后端的职责。

## 10. 初步实现方向与影响范围

- 用 `apps/workspace-cli` 替换 `apps/desktop`，使用 TypeScript 构建 Node.js CLI，并在包清单中声明可执行入口。
- 新建 UI 无关的 Workspace 共享包，首版容纳状态模型、诊断模型、能力声明和平台适配端口；后续扫描、同步和凭证能力按相同边界扩展。
- 采用成熟的 MCP TypeScript stdio transport 或与项目协议约束一致的最小适配，不自创长期公共文本协议。
- 删除 Electron、electron-vite、桌面 React renderer 和对应配置，更新 pnpm lockfile 与允许构建依赖。
- 调整根脚本、README、`docs/06-agent-integration.md`、`docs/09-technical-architecture-decisions.md`、`docs/12-prototype-preparation.md`、相关路线与原型说明中的活动 Electron 引用。
- 保留 PostgreSQL、API、Worker、Web 和共享领域包；无需数据库迁移、数据回填或部署双写。
- 预计可用一个紧凑阶段完成实现、文档和验证；具体路线图与首个即时阶段计划由独立规划流程确定。

## 11. 验收标准

| 验收 | 层级 | 可观察结果 |
| --- | --- | --- |
| `AC-001` | core | 安装并构建 workspace 后，`ngapd-workspace --help`、`--version`、`status` 和 `doctor` 均可执行，且不会启动 GUI。 |
| `AC-002` | core | Agent 宿主能够通过 `serve --stdio` 完成 MCP 初始化、列出首版只读工具并成功调用状态或诊断工具。 |
| `AC-003` | core | stdio 协议会话的标准输出不混入日志或人类说明；错误和诊断日志不会破坏协议消息解析。 |
| `AC-004` | core | 活动 workspace 中不再包含 Electron 应用、Electron 构建配置或 Electron 运行依赖，根命令不再提供 `dev:desktop`。 |
| `AC-005` | core | Workspace 核心包可以在不加载 Electron、React、DOM 或 CLI 解析器的测试/Node 环境中独立导入和调用。 |
| `AC-006` | core | CLI 在 PostgreSQL 未连接、网络不可用且没有 Workspace 配置时仍能运行状态和诊断，并如实报告未配置能力。 |
| `AC-007` | core | 未知命令、无效参数和无效协议输入得到稳定非零或协议错误结果，不执行文件、数据库或 shell 写入。 |
| `AC-008` | core | 本功能完成后，API、Worker、Web、共享包及新 CLI 的统一构建、类型检查、代码规范和现有测试门禁通过。 |
| `AC-009` | core | Git 变更中没有数据库 migration、PostgreSQL 数据结构修改或运行时数据库文件；现有 PostgreSQL API/Worker 行为保持通过。 |
| `AC-010` | core | README 与活动架构文档一致地描述 CLI 当前方案、Agent/Web/CLI 分工以及未来 GUI 复用边界，不再指导开发者运行 Electron。 |
| `AC-011` | core | 现有未提交 README macOS 开发内容得到保留，并被正确调整为 CLI 命令。 |
| `AC-012` | supplemental | 人类格式的 `status` 和 `doctor` 信息对初次接触本项目的开发者清晰，并与对应 JSON 结果表达相同结论。 |
| `AC-013` | supplemental | 在可用的真实 macOS Apple Silicon 环境完成一次 CLI 命令与 stdio 诊断冒烟验证；若验证工具本身出现且证明不影响核心行为的问题，可按宽松策略记录 finding。 |

## 12. 决策记录

| 决策项 | 结论 | 来源 | 回答要求 |
| --- | --- | --- | --- |
| 交付与验证策略 | 宽松；核心验收和硬门禁仍阻塞 | 用户明确确认 | 必须回答 |
| CLI 使用者 | Agent 优先；人工只使用状态和诊断命令 | 采用默认回答 | 可默认 |
| Electron 处置 | 删除当前空壳与依赖，通过共享核心保留未来 GUI 空间 | 采用默认回答 | 可默认 |
| 首次交付范围 | 只替换客户端基础与协议/诊断入口，不实现完整同步 | 采用默认回答 | 可默认 |
| 数据库范围 | 保持 PostgreSQL，不在本功能切换 SQLite | 采用默认回答 | 可默认 |
| Agent transport | MCP 风格结构化工具，优先 stdio，不监听局域网端口 | 项目现有约束 | 可默认 |
| 人工任务管理界面 | 统一使用 Web；CLI 不提供人工业务写命令 | 用户此前明确产品方向及采用默认回答 | 可默认 |
| 未来 GUI | 作为独立适配器复用 Workspace 核心，不依赖 CLI 文本输出 | 用户明确要求保留空间 | 可默认 |

## 13. 未决问题

无。
