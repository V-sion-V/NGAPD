# Workspace 租约、同步与最小身份基础原型：需求

- 功能 ID：`workspace-sync-prototype`
- 需求状态：已确认，可进入独立规划
- 确认日期：2026-07-25

## 1. 背景与目标

NGAPD 已具备 API、Worker、Web、PostgreSQL migration、Workspace CLI 和共享 Workspace 核心骨架，但当前 Workspace 能力只提供离线状态与诊断。现有领域包也只包含最小租约有效性判断，尚未形成真实身份、作用域写资格、独占租约、版本清单、对象内容、本地物化或冲突恢复闭环。

本原型必须验证三个高风险结论：

1. 用户级、项目级和任务级工作区在真实服务端身份与权限基础上，同一时刻最多只有一个合法写入者。
2. 租约、写资格或基线版本失效后，客户端停止上传且不静默覆盖；仍有写资格的用户明确选择本地或服务端版本后，系统只产生一个新的服务端事实。
3. Workspace CLI 可以在没有本地 GUI 的情况下，通过 Web 登录和一次性配对获得设备授权，并经共享核心与平台适配器安全地完成物化、扫描、同步和冲突处理。

本功能只澄清并实现 Workspace Sync 原型。平铺树状 Task UI 与 Agent Context 继续作为两个后续独立原型；React Web 仍是人工项目管理、账号登录和设备配对界面，本功能取消的是本地 Workspace GUI，而不是 Web。

## 2. 范围

### 2.1 包含范围

- 本地账号、Argon2id 密码、Web 注册/登录/退出、Secure/HttpOnly/SameSite Cookie 会话。
- Web 确认的一次性 CLI 设备配对、短期访问令牌、可撤销设备凭据和 OS 凭据保护端口。
- 满足同步授权所需的最小生产基础：Project、Membership、唯一 Project Owner、Project Admin、最小任务树、显式/有效 Task Owner 和三级逻辑 Workspace。
- 用户、项目、任务创建时原子创建唯一对应 Workspace；项目和任务数据可由确定性集成夹具建立，不要求完整项目管理 UI。
- PostgreSQL 中的 Workspace 生命周期、工作周期、`sync_version`、manifest、版本、租约、设备、幂等请求和审计记录。
- 通过 `ObjectStore` 接口保存 SHA-256 内容寻址对象；首个实现使用服务端本地持久目录。
- REST/JSON、TypeBox/OpenAPI 接口：设备配对、Workspace 读取、租约获取/续期/释放/接管、manifest/对象传输、幂等提交和冲突选择。
- `@ngapd/workspace-core` 中的平台无关路径规范、保护路径、清单扫描、差异、原子替换、凭据存储和本地副本状态端口。
- Workspace CLI 中的配对、认证状态、连接、物化、状态、同步、租约和显式冲突选择入口。
- `SYNC-001`–`SYNC-009` 确定性场景、双进程设备争用、真实 macOS Apple Silicon 验证，以及三个原型主体完成后的集中 Windows 11 x64 验证。
- 与本次新增数据、公开接口、安全、恢复和平台行为相称的自动化与运行时证据。

### 2.2 不包含范围

- 不实现本地 Electron、原生、菜单栏或其他 Workspace GUI；整个 MVP 的本地 Workspace 操作采用 CLI。
- 不取消 React Web，也不取消后续 Task UI 原型；Web 继续承担人工项目管理、账号登录和设备配对。
- 不实现完整 M1/M2：加入申请、邀请审批、项目归档/恢复、完整任务编辑、依赖图、关注、评论、通知、管理员模式和任务完成冻结仍属后续功能。
- 不实现 Agent 业务工具、Agent 项目级写入或任务管理提案；现有 `workspace_status`、`workspace_doctor` 保持可用，未满足 M5 前置条件的工具不得提前注册。
- 不实现文件监听作为正确性来源、增量块传输、后台静默合并、多人共同写入、大文件优化或实时协同编辑。
- 不实现完整安装器、自动更新、密码重置、外部身份提供商、MFA 或生产级邮件流程。
- 不实现完整 Workspace 差异 GUI；冲突由 CLI 展示安全摘要并通过结构化 API/CLI 明确选择 `use_local` 或 `use_server`。
- 不实现项目备份恢复、对象垃圾回收或灾备自动化；但数据模型和对象引用不得妨碍后续一致备份。
- 不在本功能中完成 Task UI 和 Agent Context 原型结果。

## 3. 已确认的项目事实与约束

- 当前分支已包含无界面的 `@ngapd/workspace-cli`、`ngapd-workspace` bin 与 `@ngapd/workspace-core`；CLI 当前只暴露状态、诊断和两个只读 MCP 工具。
- 当前 API 只有健康检查和系统信息，数据库只有 `system_metadata` migration；不存在需要兼容迁移的 Workspace 业务数据。
- 项目采用 Node.js 24、pnpm 11、TypeScript、Fastify、TypeBox/OpenAPI、PostgreSQL 17、Kysely 和本地内容寻址对象存储方向。
- MVP 身份使用本地账号和密码，密码必须使用 Argon2id；Web 会话使用 Secure、HttpOnly、SameSite Cookie。
- Workspace 平台适配器必须使用短期访问令牌和可撤销设备凭据，长期材料只保存在 OS 凭据保护区，令牌和密码不得写入普通日志。
- Project Membership 权限级别只有 `admin / member`；Project Owner 由 `Project.owner_membership_id` 唯一表达，项目不得没有 Owner。
- 用户级 Workspace 只有对应用户可写；项目级只有 Project Owner/Admin 可写；任务级只有当前有效 Task Owner 可写。任何资格都不能绕过独占租约。
- Task 显式 Owner 可为空并继承最近一个显式 Owner 非空祖先；顶层任务必须有活动显式 Owner。
- 三种 Workspace 允许多个只读连接，但最多一个活动写租约。租约绑定用户、设备、连接会话和工作周期。
- 服务端时钟是租约有效性的唯一权威。原型初始参数为 TTL 60 秒、续租间隔 20 秒、断网宽限不超过剩余 TTL。
- 服务端以递增 `sync_version` 和完整用户内容 manifest 为权威；对象按 SHA-256 寻址，用户路径不得直接成为对象存储路径。
- `.ngapd/`、`TASK.md` 和 `SUMMARY.md` 是控制面或只读投影，不进入用户内容 manifest，普通文件接口和 Agent 不得写入。
- 服务端 manifest 路径使用 `/`、UTF-8 和 Unicode NFC；客户端在写入前拒绝大小写碰撞、Windows 保留名、非法字符、路径穿越和越界符号链接。
- 典型 Workspace 少于 500 个文件，按 2,000 个文件验收；单文件默认软限制 50 MiB，单 Workspace 默认软限制 2 GiB。
- 当前可执行环境为 macOS arm64，尚无 Docker 和 Windows 实机证据。用户明确要求三个原型主体完成后集中执行 Windows 验证。
- Windows 11 x64 和目标 macOS 是 MVP core 兼容边界；延后执行不等于降级，缺少 Windows 证据时本工作流不得最终完成。
- 项目流程文档根目录为 `docs/requirements`；新功能采用 schema 3.2 独立目录。

## 4. 交付与验证策略

- 用户明确选择 `relaxed`。
- 实现可以先于测试，不要求人为制造 red-first 基线。
- 所有 core 验收、安全、认证、授权、隐私、数据完整性、迁移、公共兼容、构建、恢复、用户工作保护和项目硬门禁仍阻塞阶段及运行完成。
- supplemental 异常只有在独立证据证明不影响交付行为时，才可作为稳定 `FND-I-*` report-only finding 保留。
- Windows 实机兼容属于 core，不得因验证时机延后或采用 relaxed 策略改为 supplemental。
- 在三个原型主体完成且 Windows 集中验证尚未执行时，本运行可以停在安全的 `awaiting_next_phase`，但不得生成 `change-0.md`、有效需求快照或宣告整体通过。

## 5. 功能需求

- `FR-001`：系统必须提供真实本地账号基础，密码只保存 Argon2id 哈希，并支持 Web 注册、登录和退出；注册成功必须原子创建唯一用户级 Workspace。
- `FR-002`：Web 登录会话必须使用 Secure、HttpOnly、SameSite Cookie；未认证请求不得读取或修改 Workspace、配对或成员数据。
- `FR-003`：CLI 必须通过一次性设备配对获得用户身份：CLI 请求短期配对码和验证地址，已登录用户在 Web 明确确认后，CLI 才能取得目标绑定的设备授权。
- `FR-004`：配对码必须高熵、短时、单次使用并限制错误尝试；过期、拒绝、重复使用或已撤销配对不得签发凭据。
- `FR-005`：CLI 只能把可撤销长期设备材料保存到 OS 凭据保护端口；访问令牌必须短期有效，密码、配对秘密、令牌和设备凭据不得进入命令参数、普通输出或日志。
- `FR-006`：登出或设备撤销必须使后续续期和写操作失效；已提交服务端版本保持不变，本地未同步内容保留为不可自动提交的冲突副本。
- `FR-007`：系统必须提供同步授权所需的最小 Project、Membership 和 Task 数据模型；Membership 只允许 `admin / member`，Project Owner 由唯一 `owner_membership_id` 表达。
- `FR-008`：最小 Task 模型必须支持父子关系、活动状态、可空显式 Owner 和最近祖先继承的有效 Owner；顶层任务必须有活动显式 Owner。
- `FR-009`：用户、项目和任务创建服务必须分别原子创建且仅创建一个对应 scope 的逻辑 Workspace；重复创建必须由唯一约束拒绝。
- `FR-010`：服务端必须基于真实认证用户、活动成员、Project Owner/Admin 或有效 Task Owner 解析读写资格；客户端传入的角色、Owner 或管理员声明不得成为授权依据。
- `FR-011`：用户级、项目级和任务级 Workspace 必须允许符合读取规则的多个只读连接，但同一 Workspace/工作周期最多只有一个未过期写租约和一个合法写入流。
- `FR-012`：租约必须绑定 Workspace、工作周期、用户、设备、连接会话、不可猜测令牌、服务端签发/过期时间和 `base_sync_version`。
- `FR-013`：服务端必须提供获取、续租、释放和经明确用户确认的强制接管；续租或提交时必须重新检查认证、设备、作用域写资格、生命周期、工作周期和租约。
- `FR-014`：用户停用、项目成员失效、Owner/Admin 资格撤销、有效 Task Owner 变化、Workspace 冻结/归档、设备撤销或租约到期必须停止续租并使旧租约不可提交。
- `FR-015`：强制接管必须保留最后服务端同步版本、使旧租约立即失效并写入审计；旧持有者后续提交必须稳定拒绝。
- `FR-016`：服务端必须为每个 Workspace 维护从初始空版本开始单调递增的 `sync_version`、不可变版本记录和完整用户内容 manifest。
- `FR-017`：manifest 项至少包含规范化相对路径、文件类型、大小和 SHA-256；路径只存在于数据库清单，不得直接拼接为服务端对象路径。
- `FR-018`：对象内容必须通过 `ObjectStore` 接口按 SHA-256 寻址；提交成功的 manifest 不得引用缺失或哈希不匹配对象，失败上传不得创建可见的半提交版本。
- `FR-019`：同步提交必须同时校验有效租约、当前写资格、工作周期和 `base_sync_version`，并以事务方式创建一个新版本；任一条件失败时服务端事实不得变化。
- `FR-020`：同步提交必须支持目标绑定的幂等键；相同请求重试不得重复增加 `sync_version`，相同幂等键配不同内容必须稳定拒绝。
- `FR-021`：租约或基线版本失效后，客户端必须停止自动上传并进入冲突状态，不得自动选择或静默合并本地与服务端内容。
- `FR-022`：仍有写资格的用户重新取得唯一租约后，必须通过 CLI 明确选择 `use_local` 或 `use_server`；系统和 Agent 不得代替用户选择。
- `FR-023`：`use_local` 必须以当前服务端版本为比较交换基础提交完整本地 manifest 并创建一个新版本；`use_server` 必须将服务端受管内容原子物化到本地，并保留不再受管的冲突副本或明确删除清单。
- `FR-024`：已失去写资格的旧持有者不得选择 `use_local`，其本地变化只能保留为未受管冲突副本或由有资格用户通过独立流程处理。
- `FR-025`：显式或有效 Task Owner 变化前，正常路径必须完成最终同步并释放租约；不可用持有者的强制撤销只能以最后服务端版本继续，旧本地变化不得提交。
- `FR-026`：`@ngapd/workspace-core` 必须提供 UI/CLI 无关的规范化路径、保护路径、manifest 扫描、差异、本地状态、临时文件和原子替换端口；不得反向依赖 CLI、Web、数据库或具体 GUI。
- `FR-027`：本地扫描必须重新读取受管目录并计算 SHA-256，文件监听事件不得成为正确性依据；同一输入必须产生稳定排序和稳定 manifest 哈希。
- `FR-028`：`.ngapd/`、`TASK.md`、`SUMMARY.md`、根目录外路径、路径穿越、越界符号链接和不符合平台规则的名称必须在扫描、提交和物化前拒绝。
- `FR-029`：服务端路径必须使用 `/`、UTF-8 和 Unicode NFC；Windows 与 macOS 平台适配器必须在写入前检测大小写碰撞、Windows 保留名、非法字符和不可安全映射的路径。
- `FR-030`：物化和 `use_server` 必须使用同目录临时文件及原子替换，失败时不得留下被误认为已同步的部分文件；本地控制状态只能在全部受管内容完成后更新。
- `FR-031`：Workspace CLI 必须在无本地 GUI 的情况下提供配对、认证状态、设备退出、Workspace 连接/状态、获取或释放租约、同步和冲突选择能力，并保持现有 status/doctor/MCP 诊断兼容。
- `FR-032`：React Web 在本功能中只需提供账号注册/登录/退出、一次性配对确认和设备撤销界面；不要求实现完整项目/任务管理 UI，也不得把本地文件内容上传到浏览器处理。
- `FR-033`：配对、租约、接管、提交、冲突选择、资格失效和设备撤销必须写入独立审计，至少包含操作者、设备、Workspace、请求 ID、前后版本、结果和稳定原因码，且不得记录密码、令牌或文件全文。
- `FR-034`：公开 API 必须使用版本化 REST/JSON、TypeBox 运行时校验和 OpenAPI；错误至少包含稳定机器码、用户可读信息、请求 ID、当前版本和可执行恢复建议。
- `FR-035`：新增 migration 必须是可重复审查的前向迁移，建立必要唯一约束、外键和并发保护；migration 或事务失败不得损坏既有 `system_metadata` 或留下半可用业务结构。
- `FR-036`：原型必须实现并可重复执行 `SYNC-001`–`SYNC-009`，覆盖正常同步、第二设备、到期、旧版本、双向冲突选择、Owner 变化、保护路径和跨平台名称碰撞。
- `FR-037`：原型主体必须先在真实 macOS Apple Silicon 完成 CLI、文件系统和双进程验证；Windows 11 x64 实机验证在三个原型主体完成后集中执行，但在通过前本功能不得最终完成。
- `FR-038`：本功能不得提前注册 Agent 同步/文件写 MCP 工具，不得实现本地 GUI，也不得改变 PostgreSQL 作为服务端权威或 Web 作为人工管理/配对界面的职责。

## 6. 用户流程或调用流程

### 6.1 Web 注册、登录与 CLI 配对

1. 用户在 Web 注册本地账号；服务端保存 Argon2id 哈希，并在同一事务创建用户级 Workspace。
2. 用户通过 Web 登录，获得安全 Cookie 会话。
3. CLI 请求一次性配对码与验证地址，并在本地保留仅限本次请求的关联秘密。
4. 用户在已登录 Web 页面输入或打开配对码，查看设备摘要并明确确认或拒绝。
5. CLI 轮询配对状态；确认后取得短期访问令牌和可撤销设备凭据，并通过 OS 凭据端口保存长期材料。
6. 配对码立即失效；拒绝、过期、重复消费或设备撤销都不能继续获取令牌。

### 6.2 连接与首次物化

1. CLI 使用当前设备身份请求目标 Workspace 元数据。
2. 服务端按 scope 校验读取资格并返回生命周期、最新 `sync_version` 和 manifest。
3. 用户选择 NGAPD 根目录内尚未冲突的登记位置；客户端完成规范化和安全检查。
4. CLI 下载缺失对象，以临时文件原子物化用户内容，最后写入本地非权威控制状态。
5. 只读用户保持只读连接；有写资格的用户可另行请求唯一租约。

### 6.3 正常写入与同步

1. CLI 获取绑定当前用户、设备、会话和基线版本的租约。
2. 用户直接编辑本地受管内容。
3. CLI 重新扫描目录、过滤保护路径并生成完整 manifest。
4. 缺失对象先按哈希上传；CLI 用租约、基线版本和幂等键提交 manifest。
5. 服务端在事务中复核资格与版本，创建唯一新 `sync_version` 和审计。
6. CLI 更新本地基线并按 20 秒测试间隔续租，完成后显式释放。

### 6.4 争用、接管与迟到提交

1. 第二设备请求同一 Workspace 写入时，只得到只读状态或接管选项。
2. 用户明确确认接管后，服务端撤销旧租约并保留最后服务端版本。
3. 新设备取得新租约；旧设备续租和提交得到稳定拒绝。
4. 旧设备本地变化保留为冲突副本，不自动上传。

### 6.5 版本冲突

1. 基线或租约失效时，CLI 停止上传并展示本地/服务端差异摘要。
2. 当前用户重新认证写资格并取得唯一租约。
3. 用户明确选择 `use_local` 或 `use_server`。
4. `use_local` 产生一个新服务端版本；`use_server` 原子替换本地受管内容。
5. 选择、版本和结果写入审计；无资格用户不能选择本地成为服务端事实。

### 6.6 Owner 或资格变化

1. 正常 Owner 变化前，旧持有者完成同步并释放租约。
2. 持有者不可用时，有权操作方明确确认强制撤销；系统以最后服务端版本继续。
3. 服务端更新 Owner/成员资格并立即使旧租约失效。
4. 新有效 Owner 才能申请任务级租约；旧本地变化不得提交。

### 6.7 延后 Windows 集中验证

1. 本功能完成平台无关实现、自动化和 macOS 实机证据后进入安全等待状态。
2. Task UI 与 Agent Context 原型主体按各自独立工作流推进。
3. 三个主体完成后，在 Windows 11 x64 集中执行各自 core 平台场景。
4. Workspace Sync 的 Windows 租约、路径、凭据和原子替换证据通过后，本运行才可最终封存。

## 7. 数据、接口与状态

### 7.1 最小持久化实体

- `users`：本地账号、规范化登录名、Argon2id 哈希、活动状态。
- `web_sessions`：Cookie 会话摘要、用户、创建/过期/撤销时间。
- `devices` 与 `device_credentials`：用户设备、平台、凭据摘要、撤销状态。
- `pairing_requests`：配对码摘要、CLI 关联、过期、尝试次数、确认用户和单次消费状态。
- `projects`：项目标识、Key、唯一 `owner_membership_id`。
- `memberships`：项目、用户、`admin / member`、活动状态。
- `tasks`：项目、父任务、状态、显式 Owner Membership；有效 Owner 由祖先链解析。
- `workspaces`：Workspace ID、scope type/id、服务端生命周期、当前工作周期和 `sync_version`。
- `workspace_leases`：Workspace/周期、用户、设备、连接、令牌摘要、基线、签发/续租/过期/撤销状态。
- `workspace_versions`、`workspace_manifest_entries`：不可变版本与完整 manifest。
- `workspace_objects`：内容哈希、大小、存储键和完整性状态；对象字节位于 `ObjectStore`。
- `idempotency_records`：调用者、目标、幂等键、请求摘要和稳定结果。
- `audit_events`：身份、设备、作用域、动作、版本、结果和原因，不含敏感材料或文件全文。

### 7.2 唯一性与权威

- 每个用户、项目、任务分别最多一个对应 scope Workspace。
- 每个项目恰有一个活动 Project Owner 指针。
- Membership 权限只允许 `admin / member`。
- 一个 Workspace/工作周期最多一个可提交的活动租约。
- `sync_version` 单调递增；版本和 manifest 一旦提交不可变。
- PostgreSQL 中的 Workspace/版本/租约/授权为服务端权威；本地状态和对象缓存均非权威。

### 7.3 状态分离

- 服务端 Workspace 生命周期、工作周期状态、本地副本状态和连接/租约状态必须分别建模。
- 本地副本至少区分：未物化、干净、持有效租约的本地变化、租约/基线失效、冲突、物化失败。
- 连接至少区分：断开、只读、写租约活动。
- 配对至少区分：pending、approved、denied、consumed、expired、revoked。
- 不得把“已物化”“只读连接”“持有租约”压缩为一个互斥 Workspace 全局状态。

### 7.4 公共接口边界

- Web：注册、登录、退出、配对确认/拒绝、设备列表和撤销。
- API：认证/配对、Workspace 元数据、manifest/对象、租约、同步提交、冲突选择和必要的 fixture/integration service 边界。
- CLI：配对、认证状态、登出/撤销当前设备、连接、状态、租约、同步和冲突选择。
- 共享核心：纯模型/算法和平台端口，不暴露数据库实现或 CLI 文本解析。
- 原型 fixture 可以通过测试构建器创建 Project/Membership/Task，但不得暴露无认证的生产 bootstrap 路由。

## 8. 异常、边界与恢复

- 注册重复登录名、错误密码、撤销会话、过期 Cookie 和被停用用户必须稳定拒绝且不泄露账号存在性以外的敏感信息。
- 配对码错误尝试、过期、拒绝、重复消费、错误 CLI 关联和设备撤销必须稳定失败；成功与失败都不得输出真实令牌。
- 所有租约有效性使用服务端时钟；客户端时钟偏差不得延长租约。
- API/Worker 重启后，已提交版本和有效数据库事务保持一致；未提交请求可以用幂等键安全重试。
- 对象上传成功但数据库提交失败时，对象不得成为可见版本引用；孤立对象可以留待后续安全 GC，但不能影响正确性。
- 数据库提交成功前必须确认全部引用对象存在且哈希正确；禁止 manifest 指向缺失内容。
- 网络中断在剩余 TTL 内可以明确显示本地未同步；租约失效后继续编辑的内容不能自动上传。
- 扫描期间文件变化必须得到稳定“重试扫描”结果，不得提交混合时刻的 manifest。
- 超过单文件或 Workspace 软限制时必须阻止新增超限同步并保留既有服务端版本。
- 原子物化失败必须保留原受管版本或明确恢复副本，不能更新本地已同步基线。
- 路径碰撞、Unicode 不可规范化、保留名、越界链接、路径穿越和保护文件必须在产生对象或写入前拒绝。
- migration 失败必须停止启动或保持旧结构可用，不得用部分新表继续业务写入。
- Windows 集中验证不可用时，运行保持 `awaiting_next_phase`；不得把缺少 core 证据写成 report-only finding。
- 任一安全、授权、数据完整性或 core 验收失败时，只能修复后继续；不能通过 relaxed 策略降级。

## 9. 非功能需求

- 新增代码必须满足 Node.js 24、pnpm 11、TypeScript、ESLint、Prettier、构建、类型检查和适用测试门禁。
- 认证密码使用 Argon2id；令牌、密码、配对秘密、OS 凭据和对象全文不得进入普通日志。
- Web 认证依赖 TLS 部署边界；Cookie 必须 Secure、HttpOnly、SameSite，跨站请求必须遵守现有同源/CSRF 安全设计。
- API 错误、日志和审计必须包含请求 ID 与稳定机器码；审计与普通诊断分离。
- 500 个文本为主文件、总计 100 MiB 的已物化 Workspace，扫描和差异计算目标为 5 秒内给出状态。
- 网络可用、租约有效且对象规模正常时，已知新增或修改的小文件目标为 10 秒内形成服务端新版本。
- 支持按 2,000 个受管文件验证正确性；单文件默认软限制 50 MiB，单 Workspace 默认软限制 2 GiB，并允许部署配置调整。
- 平台无关核心不得依赖 Electron、DOM、React、CLI 解析或特定凭据实现。
- 本地 Workspace 访问只允许用户配置的 NGAPD 根目录及服务端登记 Workspace 路径。
- Windows 11 x64、NTFS 和目标 macOS 默认文件系统的大小写、Unicode、保留名、长路径、符号链接和原子替换属于最终兼容门禁。
- 原型和服务端运行时不得调用外部 API、AI 或 LLM。
- 本功能不承诺生产 SLA、集群或高可用，但应用重启不得破坏已提交事务和 Workspace 版本。

## 10. 初步实现方向与影响范围

- 在 `packages/contracts` 增加身份、配对、Workspace、租约、manifest、同步、冲突和稳定错误 Schema。
- 在 `packages/domain` 增加真实写资格解析、有效 Task Owner、纯租约状态机、版本比较交换和冲突选择规则。
- 在 `packages/database` 增加身份、项目/成员/任务、设备、Workspace、租约、版本、manifest、对象引用、幂等和审计 migration。
- 在 API 增加 Identity/Pairing、Projects/Membership 最小服务、Tasks 最小 Owner 服务和 Workspaces 模块；继续使用 REST/TypeBox/OpenAPI。
- 在 `@ngapd/workspace-core` 增加路径、manifest、扫描、差异、原子物化、凭据和本地副本状态接口。
- 在独立平台适配层实现 macOS/Windows 文件和凭据端口；CLI 通过结构化服务调用，不把核心逻辑放入命令解析。
- 在 Web 增加最小注册/登录/配对/设备撤销页面；保留现有 Web 技术栈，不实现本地 GUI。
- 使用 PostgreSQL 和服务端本地 `ObjectStore` 验证真实事务与对象一致性，不切换 SQLite 或引入外部对象服务。
- 使用确定性项目/成员/任务 fixture 建立授权场景，不创建无认证生产 seed API。
- 预计需要比例化的多阶段路线图，因为认证/迁移、服务端同步、本地平台适配和延后 Windows 门禁具有独立安全状态；具体阶段边界由 `$plan-feature-implementation` 独立确定。

## 11. 验收标准

| 验收 | 层级 | 可观察结果 |
| --- | --- | --- |
| `AC-001` | core | 用户可在 Web 注册、登录和退出；数据库只保存 Argon2id 密码哈希，注册事务只创建一个用户级 Workspace，安全 Cookie 行为符合要求。 |
| `AC-002` | core | CLI 发起一次性配对后，只有已登录用户在 Web 明确确认的对应设备能取得授权；过期、拒绝、重复消费、错误关联和撤销均稳定失败且不泄露秘密。 |
| `AC-003` | core | CLI 不接收账号密码；设备长期材料只经过 OS 凭据端口，短期令牌和所有秘密不出现在参数、普通输出或日志。 |
| `AC-004` | core | 真实 Project/Membership/Owner/Task 数据能够分别证明用户级本人、项目级 Owner/Admin、任务级有效 Owner 的写资格，以及所有对照拒绝；客户端自报角色无效。 |
| `AC-005` | core | 用户、项目和任务创建分别产生唯一对应 Workspace；重复、事务失败和并发创建不会留下缺失或重复 Workspace。 |
| `AC-006` | core | `SYNC-001`–`SYNC-007` 全部通过：任一 Workspace 同时最多一个合法写入者，旧租约、旧基线、旧设备或失去资格者不能提交。 |
| `AC-007` | core | `use_local` 与 `use_server` 都必须由仍有资格的用户在 CLI 明确选择；选择前双方可识别版本得到保留，选择后只产生一个新权威结果且有审计。 |
| `AC-008` | core | 同一幂等提交重试不重复增加版本；不同内容复用幂等键、缺失对象、哈希错误或事务失败均不产生可见半版本。 |
| `AC-009` | core | `.ngapd/`、`TASK.md`、`SUMMARY.md`、路径穿越、越界符号链接、大小写碰撞、保留名和非法字符在扫描/提交/物化前被拒绝。 |
| `AC-010` | core | manifest 排序与哈希确定；物化和服务端版本选择使用临时文件原子替换，故障后不会把部分内容标记为已同步。 |
| `AC-011` | core | Owner、成员、设备或生命周期变化会立即阻止续租和提交；正常 Owner 变化使用最终同步，强制路径只使用最后服务端版本。 |
| `AC-012` | core | 公开接口有运行时 Schema、OpenAPI、稳定错误和请求 ID；认证、租约、提交、接管、冲突选择和撤销均产生不含秘密/全文的审计。 |
| `AC-013` | core | 新 migration、并发约束和应用重启验证通过；既有 `system_metadata`、API 健康检查、Web 和 Workspace CLI 诊断保持兼容。 |
| `AC-014` | core | 真实 macOS Apple Silicon 完成 Web 配对、CLI 凭据、双进程争用、文件扫描、同步、冲突和原子替换场景。 |
| `AC-015` | core | 三个原型主体完成后，Windows 11 x64/NTFS 实机执行相同核心 Workspace 契约并通过；在此之前本功能保持未最终完成。 |
| `AC-016` | core | 原型不提供本地 GUI、不提前注册 Agent 业务 MCP 工具、不接受任意未登记路径，也不调用外部 API/AI/LLM。 |
| `AC-017` | core | 所有新增 workspace 的构建、类型检查、代码规范和适用自动化通过；认证、授权、迁移、数据完整性或恢复测试失败会阻塞完成。 |
| `AC-018` | supplemental | 500 个文本为主文件、100 MiB 工作区的扫描/差异在参考 macOS 设备 5 秒内给出状态，小文件同步在正常条件下 10 秒内形成新版本。 |
| `AC-019` | supplemental | 2,000 文件、50 MiB 单文件和 2 GiB Workspace 软限制的边界提示清晰、确定且不会损坏已有服务端版本。 |
| `AC-020` | supplemental | CLI 对配对等待、只读争用、租约倒计时、未同步、冲突和恢复建议提供一致的人类与结构化状态，便于后续 Web 或 Agent 复用。 |

## 12. 决策记录

| 决策项 | 结论 | 来源 | 回答要求 |
| --- | --- | --- | --- |
| 交付与验证策略 | `relaxed`；core 与全部硬门禁仍阻塞 | 用户明确确认 | 必须回答 |
| 当前工作流范围 | 只澄清 Workspace Sync；Task UI 与 Agent Context 后续独立处理 | 采用默认回答 | 可默认 |
| 身份与授权深度 | 采用真实最小账号、成员、Project Owner/Admin 和 Task Owner 基础，不使用客户端授权 fixture 代替 | 用户明确确认 | 必须回答 |
| 本地与 Web GUI 边界 | 本地 Workspace 整个 MVP 使用 CLI、无本地 GUI；React Web 和 Task UI 保留 | 用户明确确认 | 必须回答 |
| CLI 认证 | 用户先在 Web 登录，再通过一次性配对码明确授权 CLI 设备 | 用户明确确认 | 必须回答 |
| 最小身份范围 | 只实现同步授权所需模型与服务，不提前实现邀请、完整项目/任务管理、评论或通知 | 采用默认回答 | 可默认 |
| 冲突选择 | 通过 API/CLI 明确选择 `use_local` 或 `use_server`，不实现本地冲突 GUI | 用户明确确认 | 必须回答 |
| Windows 验证时机 | 三个原型主体完成后集中执行 Windows 11 x64 验证 | 用户明确确认 | 必须回答 |
| 延后验证状态 | Windows core 证据前本运行保持未最终完成，不用 finding 替代 | 采用默认回答 | 可默认 |
| 服务端权威 | PostgreSQL 17 + 内容寻址本地 ObjectStore；不引入 SQLite、Redis 或外部对象服务 | 项目现有约束 | 可默认 |
| 租约初始参数 | TTL 60 秒、续租 20 秒、断网不超过剩余 TTL | 项目现有约束 | 可默认 |
| 平台范围 | macOS Apple Silicon 与 Windows 11 x64 为 MVP core | 项目现有约束 | 可默认 |
| Agent 范围 | 本原型不提前注册 Agent 同步/写入工具 | 采用默认回答 | 可默认 |

## 13. 未决问题

无。
