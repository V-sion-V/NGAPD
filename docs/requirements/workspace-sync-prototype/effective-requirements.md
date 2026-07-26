# Workspace 租约、同步与最小身份基础原型：当前有效需求

- 派生状态：可重新生成
- 原始需求：[`requirements.md`](requirements.md)
- 已应用至修改记录：[`change-0.md`](change-0.md)
- 生成日期：2026-07-26
- 当前交付与验证策略：`relaxed`
- 当前验证结论：`passed`

## 1. 当前目标与范围

当前有效目标是保留一个真实的 Workspace Sync 原型：在本地账号、服务端授权、唯一写租约、不可变版本和内容寻址对象基础上，由无本地 GUI 的 Workspace CLI 通过 Web 一次性配对取得设备身份，经平台无关核心及 macOS/Windows 适配器完成安全物化、扫描、同步、接管和显式冲突恢复。

当前范围包括本地账号和安全 Web session、最小 Project/Membership/Task/Owner 数据、用户/项目/任务三级 Workspace、设备认证与撤销、租约和工作周期、完整 manifest/对象/幂等版本协议、审计、受限本地路径与原子恢复、正式 REST/CLI、确定性 `SYNC-001`–`SYNC-009`，以及 macOS Apple Silicon/APFS/Keychain 与 Windows 11 x64/NTFS/PasswordVault 的真实双进程证据。

当前范围不包括本地 GUI、完整 Project/Task 管理、邀请/通知/评论、Agent 业务写 MCP 工具、多人共同写入、静默合并、文件监听正确性、块级传输、对象 GC、备份/灾备、安装器、生产 HA、外部身份提供商、外部 API、AI 或 LLM。

## 2. 当前生效功能需求

| 当前编号 | 当前生效内容 | 当前状态 | 来源 |
| --- | --- | --- | --- |
| `FR-001` | 提供真实本地账号；密码只保存 Argon2id 哈希；支持 Web 注册、登录、退出，并在注册事务中原子创建唯一用户级 Workspace。 | passed | `requirements.md` |
| `FR-002` | Web session 使用 Secure、HttpOnly、SameSite Cookie；未认证请求不能读取或修改 Workspace、配对或成员数据。 | passed | `requirements.md` |
| `FR-003` | CLI 通过短期一次性配对码和 Web 明确确认获得目标绑定的设备授权。 | passed | `requirements.md` |
| `FR-004` | 配对码高熵、短时、单次使用且限制错误尝试；过期、拒绝、重复使用或撤销后不签发凭据。 | passed | `requirements.md` |
| `FR-005` | CLI 只把可撤销长期设备材料保存到 OS 凭据端口；短期访问令牌和所有秘密不进入参数、普通输出或日志。 | passed | `requirements.md` |
| `FR-006` | 登出或设备撤销使后续续期和写操作失效；已提交版本不变，本地未同步内容只能保留为不可自动提交的冲突副本。 | passed | `requirements.md` |
| `FR-007` | 同步授权使用真实最小 Project、Membership 和 Task；Membership 仅 `admin/member`，Project Owner 由唯一 `owner_membership_id` 表达。 | passed | `requirements.md` |
| `FR-008` | Task 支持父子关系、活动状态、可空显式 Owner 和最近祖先继承的有效 Owner；顶层任务有活动显式 Owner。 | passed | `requirements.md` |
| `FR-009` | 用户、项目和任务创建分别原子创建且仅创建一个对应 scope Workspace；唯一约束拒绝重复。 | passed | `requirements.md` |
| `FR-010` | 服务端依据真实用户、活动成员、Project Owner/Admin 或有效 Task Owner 解析读写资格，不信任客户端角色或 Owner 声明。 | passed | `requirements.md` |
| `FR-011` | 三级 Workspace 允许多个合格只读连接，但同一 Workspace/工作周期最多一个未过期写租约和一个合法写入流。 | passed | `requirements.md` |
| `FR-012` | 租约绑定 Workspace、工作周期、用户、设备、连接、不可猜测令牌、服务端时间和 `base_sync_version`。 | passed | `requirements.md` |
| `FR-013` | 服务端提供租约获取、续租、释放和明确确认的强制接管；续租/提交时重新检查认证、设备、资格、生命周期、周期和租约。 | passed | `requirements.md` |
| `FR-014` | 用户/成员/Owner/设备/Workspace/周期/租约任一资格失效都停止续租并使旧租约不可提交。 | passed | `requirements.md` |
| `FR-015` | 强制接管保留最后服务端版本、立即使旧租约失效并审计；旧持有者后续提交稳定拒绝。 | passed | `requirements.md` |
| `FR-016` | 每个 Workspace 从空版本 0 开始维护单调递增 `sync_version`、不可变版本和完整用户内容 manifest。 | passed | `requirements.md` |
| `FR-017` | manifest 条目包含规范相对路径、类型、大小和 SHA-256；用户路径只在数据库清单中，不直接成为对象物理路径。 | passed | `requirements.md` |
| `FR-018` | ObjectStore 按 SHA-256 寻址；可见 manifest 不引用缺失或错误哈希对象，失败上传不产生半提交版本。 | passed | `requirements.md` |
| `FR-019` | 提交同时校验有效租约、当前资格、工作周期和基线，并在事务内只创建一个新版本；失败不改变服务端事实。 | passed | `requirements.md` |
| `FR-020` | 提交使用目标绑定幂等键；相同请求重试不重复增版，不同内容复用同键稳定拒绝。 | passed | `requirements.md` |
| `FR-021` | 租约或基线失效后客户端停止自动上传并进入冲突状态，不静默选择或合并。 | passed | `requirements.md` |
| `FR-022` | 仍有资格的用户重新取得唯一租约后，必须在 CLI 明确选择 `use_local` 或 `use_server`；系统和 Agent 不代选。 | passed | `requirements.md` |
| `FR-023` | `use_local` 以当前服务端版本 CAS 提交完整本地 manifest；`use_server` 原子物化服务端内容并保留冲突副本或明确删除清单。 | passed | `requirements.md` |
| `FR-024` | 失去写资格的旧持有者不能选择 `use_local`；其变化只能作为未受管冲突副本或交由合格用户处理。 | passed | `requirements.md` |
| `FR-025` | Owner 正常变化前完成最终同步和释放；强制撤销只从最后服务端版本继续，旧本地变化不能提交。 | passed | `requirements.md` |
| `FR-026` | `@ngapd/workspace-core` 提供 UI/CLI 无关的路径、保护路径、manifest、差异、本地状态和原子物化端口，不反向依赖 CLI/Web/数据库/GUI。 | passed | `requirements.md` |
| `FR-027` | 本地扫描重新读取受管目录并计算 SHA-256；监听不作为正确性依据；同一输入产生稳定排序和 manifest 哈希。 | passed | `requirements.md` |
| `FR-028` | `.ngapd/`、`TASK.md`、`SUMMARY.md`、越界/穿越路径、符号链接和不合平台规则的名称在对象产生或写入前拒绝。 | passed | `requirements.md` |
| `FR-029` | 服务端路径统一 `/`、UTF-8、NFC；macOS/Windows 写入前检测大小写碰撞、Windows 保留名、非法字符和不可安全映射路径。 | passed | `requirements.md` |
| `FR-030` | 物化和 `use_server` 使用同目录临时文件及原子替换；失败不留下伪同步内容，控制状态只在全部内容完成后更新。 | passed | `requirements.md` |
| `FR-031` | 无本地 GUI 的 CLI 提供配对、认证状态、设备退出、连接/状态、租约、同步和冲突选择，同时保持 status/doctor/MCP 诊断兼容。 | passed | `requirements.md` |
| `FR-032` | React Web 只承担注册/登录/退出、配对确认和设备撤销；不实现完整项目/任务 UI，也不在浏览器处理本地文件内容。 | passed | `requirements.md` |
| `FR-033` | 配对、租约、接管、提交、冲突、资格失效和撤销写独立脱敏审计，包含操作者、设备、Workspace、request ID、版本、结果和原因。 | passed | `requirements.md` |
| `FR-034` | 公共 API 使用版本化 REST/JSON、TypeBox 运行时校验和 OpenAPI；错误包含稳定 code、信息、request ID、当前版本和恢复建议。 | passed | `requirements.md` |
| `FR-035` | migration 为前向、可审查且具唯一/外键/并发保护；失败不损坏 `system_metadata` 或留下半可用结构。 | passed | `requirements.md` |
| `FR-036` | 可重复执行 `SYNC-001`–`SYNC-009`，覆盖正常同步、第二设备、到期、旧版本、双向冲突、Owner 变化、保护路径和跨平台名称。 | passed | `requirements.md` |
| `FR-037` | 真实 macOS Apple Silicon 先完成主体；三个原型主体完成后，Windows 11 x64 实机通过相同核心契约，之后才最终封存。 | passed | `requirements.md` |
| `FR-038` | 不提前注册 Agent 同步/写入工具，不实现本地 GUI，不改变 PostgreSQL 权威和 Web 人工管理/配对职责。 | passed | `requirements.md` |

## 3. 当前流程

1. 用户在 Web 注册/登录；注册事务创建用户级 Workspace。CLI 发起一次性配对，用户查看设备摘要并明确批准或拒绝；长期设备材料进入 Keychain 或 PasswordVault，短期访问令牌只在内存。
2. CLI 读取 Workspace 元数据和完整 manifest，在用户配置根内登记安全相对路径，校验路径/链接/名称后下载、验哈希并原子物化，最后写非权威本地控制状态。
3. 合格用户取得绑定用户、设备、连接、周期和基线的唯一写租约；CLI 重扫、计算稳定 manifest、上传缺失对象并以租约、基线和幂等键提交。
4. 第二设备只能只读或由用户明确接管；接管撤销旧租约并保留最后服务端版本，旧设备的续租和提交拒绝，本地变化保留为冲突副本。
5. 租约/基线冲突后停止上传。当前合格用户重新取得租约并明确选择：`use_local` 只增加一个权威版本；`use_server` 原子恢复本地受管内容。
6. Owner 或资格正常变化前完成同步和释放；强制路径仅以最后服务端版本继续，旧资格和旧本地内容不能成为新事实。
7. 同一确定性服务端/客户端场景先在 macOS/APFS/Keychain、后在 Windows/NTFS/PasswordVault 以两个正式 CLI 进程重复执行。

## 4. 当前数据、接口与状态

- PostgreSQL 权威实体包括 `users`、`web_sessions`、`devices`/`device_credentials`、`pairing_requests`、`projects`、`memberships`、`tasks`、`workspaces`、`workspace_leases`、`workspace_versions`、`workspace_manifest_entries`、`workspace_objects`、`idempotency_records` 和 `audit_events`。
- 每个用户/项目/任务最多一个同 scope Workspace；项目有唯一活动 Owner；每个 Workspace/周期最多一个可提交租约；版本/manifest 提交后不可变且单调递增。
- Workspace 生命周期、工作周期、本地副本和连接/租约分别建模；本地至少区分未物化、干净、持租约变化、租约/基线失效、冲突和物化失败。
- Web 暴露账号、配对和设备人工管理；REST API 暴露认证、Workspace、对象、租约、提交与冲突；CLI 暴露人工操作；共享核心只暴露纯模型、算法和平台端口。
- ObjectStore 只按 SHA-256 派生存储键；数据库版本是对象引用的可见性边界；本地状态、对象缓存和 CLI 时钟均非服务端权威。
- macOS 长期秘密使用 Keychain，Windows 使用当前用户 PasswordVault；凭据 reference/schema 与公共同步协议不因平台而变化。

## 5. 当前异常、边界、安全与恢复

- 身份、session、配对、设备、租约、资格、周期、基线、幂等和对象完整性错误均稳定拒绝；普通日志、错误、审计和结果不含密码、token、credential、lease secret 或文件正文。
- 扫描期间变化返回重试，不生成混合 manifest；超限同步、路径碰撞、非 NFC、保留名、非法字符、穿越、越界链接和保护文件在产生对象或本地写入前拒绝。
- 对象可以先安全落位，但数据库失败不能使其可见；可见版本必须引用完整且哈希正确的对象。
- 物化使用 journal、恢复副本、同目录临时文件和原子替换；任何占用、rename、fsync 或 state CAS 失败都不能推进基线，重启优先恢复 journal。
- Windows sharing violation 是可重试争用；目录 durability 采用显式能力处理；registry/state 仍用锁和 CAS，服务端租约仍是唯一写权威。
- migration 失败停止新业务写入；应用重启不破坏已提交事务和版本。恢复与清理只针对精确、task-owned 的数据库、对象根、Workspace 根、凭据 locator、journal 和进程。
- 任一 core、安全、授权、隐私、数据完整性、公共兼容、build/runtime、恢复或用户工作保护失败都阻塞，不能在 `relaxed` 策略下降级。

## 6. 当前非功能要求

- 使用 Node.js 24、pnpm 11、TypeScript、ESLint、Prettier，并通过所有受影响 workspace 的 build、typecheck 和适用自动化。
- 500 个文本为主文件、100 MiB Workspace 的扫描/差异目标低于 5 秒；正常小文件同步目标低于 10 秒。
- 正确性覆盖 2,000 个文件、50 MiB 单文件和 2 GiB Workspace 软限制，提示确定且不损坏既有服务端版本。
- 平台无关核心不依赖 Electron、DOM、React、CLI parser、数据库或具体凭据实现；本地只访问配置根内登记的 Workspace。
- Windows 11 x64/NTFS 和 macOS Apple Silicon/APFS 的 Unicode、大小写、保留名、长路径、链接、占用和原子恢复均属于 core。
- 原型不调用外部 API、AI 或 LLM，不承诺生产 SLA/HA，但应用重启必须保持已提交事实。

## 7. 当前验收要求

| 验收 | 层级 | 当前可观察要求 | 当前状态 |
| --- | --- | --- | --- |
| `AC-001` | core | Web 注册、登录、退出与 Argon2id；注册只创建一个用户级 Workspace；Cookie 安全。 | passed |
| `AC-002` | core | 一次性 CLI 配对只有已登录用户明确确认的对应设备可消费；全部负向路径稳定且脱敏。 | passed |
| `AC-003` | core | CLI 无账号密码；长期材料只经 OS 凭据端口，短期令牌和秘密不进入参数、普通输出或日志。 | passed |
| `AC-004` | core | 真实用户/Project/Task 授权数据证明三类写资格及全部对照拒绝；客户端自报角色无效。 | passed |
| `AC-005` | core | 用户/项目/任务分别只有一个 Workspace；重复、失败、并发不留缺失或重复。 | passed |
| `AC-006` | core | `SYNC-001`–`SYNC-007` 证明每个 Workspace 最多一个合法 writer，旧租约/基线/设备/资格不能提交。 | passed |
| `AC-007` | core | 合格用户在 CLI 明确选择 `use_local/use_server`；选择前保留可识别版本，选择后只有一个审计后的权威结果。 | passed |
| `AC-008` | core | 幂等重试不重复增版；错误幂等复用、缺失/错误对象或事务失败不产生半版本。 | passed |
| `AC-009` | core | 保护路径、穿越、越界链接、碰撞、保留名和非法字符在扫描/提交/物化前拒绝。 | passed |
| `AC-010` | core | manifest 排序/hash 确定；原子替换故障不把部分内容标为同步。 | passed |
| `AC-011` | core | Owner/成员/设备/生命周期变化立即阻止续租/提交；强制路径只使用最后服务端版本。 | passed |
| `AC-012` | core | 公共接口有 Schema/OpenAPI/稳定错误/request ID，关键动作有不含秘密/全文的审计。 | passed |
| `AC-013` | core | migration、并发和重启通过；`system_metadata`、health、Web、CLI 诊断兼容。 | passed |
| `AC-014` | core | 真实 macOS Apple Silicon 完成 Web 配对、Keychain、双进程、扫描、同步、冲突和原子物化。 | passed |
| `AC-015` | core | 三个主体完成后，Windows 11 x64/NTFS/PasswordVault 执行相同核心 Workspace 契约。 | passed |
| `AC-016` | core | 无本地 GUI、无 Agent 业务工具、无任意未登记路径、无外部 API/AI/LLM。 | passed |
| `AC-017` | core | 新增 workspace 的工程门禁通过；认证、授权、迁移、完整性或恢复失败阻塞。 | passed |
| `AC-018` | supplemental | 参考 macOS 的 500 文件/100 MiB 扫描差异低于 5 秒，小文件同步低于 10 秒。 | passed |
| `AC-019` | supplemental | 2,000 文件与 50 MiB/2 GiB 边界提示确定且不损坏既有版本。 | passed |
| `AC-020` | supplemental | 人类/JSON 一致表达配对等待、只读争用、租约、未同步、冲突和恢复建议。 | passed |

## 8. 当前决策

| 决策项 | 当前结论 | 来源 |
| --- | --- | --- |
| 交付策略 | `relaxed`；core 和硬门禁阻塞，仅独立证明不影响交付行为的 supplemental 异常可登记 `FND-I-*`。 | 用户明确确认 |
| 身份与授权 | 使用真实最小账号、Project/Membership/Owner/Task 数据，不用客户端授权 fixture 代替。 | 用户明确确认 |
| 客户端界面 | 本地 Workspace 全部使用 CLI，无本地 GUI；React Web 保留人工登录、配对和设备管理。 | 用户明确确认 |
| CLI 认证 | 用户先登录 Web，再通过一次性配对明确授权设备；长期材料进入 OS 凭据保护区。 | 用户明确确认 |
| 冲突 | 用户在 CLI 明确选择 `use_local` 或 `use_server`，系统/Agent 不代选。 | 用户明确确认 |
| 服务端权威 | PostgreSQL 17 + 内容寻址本地 ObjectStore；不引入 SQLite、Redis 或外部对象服务。 | 项目约束 |
| 租约参数 | TTL 60 秒、续租 20 秒，断网宽限不超过剩余 TTL；服务端时钟唯一权威。 | 项目约束 |
| 平台 | macOS Apple Silicon 与 Windows 11 x64 均为 MVP core；两者真实主体已通过。 | 用户明确确认 / 项目约束 |
| Agent | 不提前注册 Agent 同步/文件写 MCP 工具；保留两个既有只读诊断工具。 | 原始需求 |
| 路径与恢复 | 只访问配置根内登记路径；保护面、平台映射、journal、原子替换和 state-last 为硬门禁。 | 原始需求 / 路线图 |

## 9. 已替换或退役项目

无。`change-0.md` 是原始需求的首次实现记录，没有后续 `RC-*`、删除项或替换项；全部 38 项 FR 和 20 项 AC 当前仍有效且已通过。

## 10. 来源链

- 原始需求：[`requirements.md`](requirements.md)，SHA-256 `ba747ca1506cc32b6bf27ef28bd4fa8e126bb8fa3f14ef2bd8454c19c3b65217`
- 工作流契约：[`workflow-contract.md`](workflow-contract.md)，schema `3.2`，SHA-256 `11b69c771d41b8daa9876873d3843632576df1f1b1e5b26f12aa5e3d19ef6c59`
- 初始路线图：[`implementation-plan.md`](implementation-plan.md)，revision 1，SHA-256 `baaa0c76bb21392edee0826d2c11c33815804e1b5f3339ed9c16b8e73a452af0`
- P-001：[`phase-001-plan.md`](execution/initial/phase-001-plan.md) → [`phase-001-result.md`](execution/initial/phase-001-result.md) `passed`
- P-002：[`phase-002-plan.md`](execution/initial/phase-002-plan.md) → [`phase-002-result.md`](execution/initial/phase-002-result.md) `passed`
- P-003：[`phase-003-plan.md`](execution/initial/phase-003-plan.md) → [`phase-003-result.md`](execution/initial/phase-003-result.md) `passed`
- P-004：[`phase-004-plan.md`](execution/initial/phase-004-plan.md) → [`phase-004-result.md`](execution/initial/phase-004-result.md) `passed`
- 主体证据：[服务端协议](../../../prototypes/workspace-sync/results/p002-server-protocol.md)、[macOS 客户端](../../../prototypes/workspace-sync/results/p003-macos-client.md)、[Windows 客户端](../../../prototypes/workspace-sync/results/p004-windows-client.md)
- 初始记录：[`change-0.md`](change-0.md)
- 当前没有开放 `FND-I-*`；下一可用 initial finding ID 为 `FND-I-001`。
