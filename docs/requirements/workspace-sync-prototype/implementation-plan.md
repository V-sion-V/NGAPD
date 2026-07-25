# Workspace 租约、同步与最小身份基础原型：实现路线图

## 1. 范围与执行模式

- 功能 ID：`workspace-sync-prototype`
- 工作流 schema：`3.2`
- 执行模式：`phased`
- 计划细节：`expanded`
- 交付与验证策略：`relaxed`
- 路线图修订：`1`
- 需求指纹：`sha256:ba747ca1506cc32b6bf27ef28bd4fa8e126bb8fa3f14ef2bd8454c19c3b65217`
- 项目基线：分支 `prototype`，提交 `a75be46a624ecb3ef309cac019e597461ddfc6e9`
- 规划日期：`2026-07-25`

需求审计通过：schema、功能身份、范围、38 个 `FR-*`、20 个分级 `AC-*`、流程、数据与接口、授权与信任边界、异常恢复、兼容门禁、性能目标、决策记录和未决问题完整一致；`relaxed` 由用户明确选择，`AC-001`–`AC-017` 为 core，`AC-018`–`AC-020` 为 supplemental。

采用四阶段而非单阶段，具体原因是：

1. 身份、配对、作用域授权和首批前向数据库 migration 必须先形成可独立验证、可停止部署的安全基础。
2. 服务端租约、版本、对象与冲突协议包含第二批并发/数据完整性 migration 和公共同步接口，必须在本地写入客户端启用前独立证明。
3. 本地扫描、凭据、物化和 macOS 实机行为依赖前两阶段，但可在 Windows 外部门禁前形成“功能主体完成、仍不最终封存”的安全状态。
4. Windows 11 x64/NTFS 是 core，且用户明确要求等待 Task UI 与 Agent Context 两个原型主体完成后集中验证；该外部交接是独立阶段边界。

采用 `expanded` 是因为本功能包含安全敏感的身份与设备凭据、两批 PostgreSQL 前向迁移、公开 REST/CLI 兼容边界、对象与数据库跨介质一致性、原子文件替换及延后的 Windows 外部门禁。expanded 只用于这些风险相关的所有权、顺序、回退和证据，不把普通实现细节重复展开。

规划前仅 `requirements.md` 与 `workflow-contract.md` 作为用户已有未跟踪输入存在；本路线图不声称拥有或改写它们。

## 2. 项目现状与全局实现依据

| 区域 | 当前事实 | 依赖方向与规划依据 |
| --- | --- | --- |
| `packages/contracts` | 只有健康与通用错误 TypeBox Schema | 新增身份、配对、作用域、Workspace、租约、manifest、提交和冲突 Schema；供 API、Web 与 CLI 单向依赖 |
| `packages/domain` | 只有最小 `isLeaseActive` / `canCommitLease` | 承载有效 Task Owner、作用域授权、租约状态机、版本 CAS 和冲突选择纯规则；不得依赖 API、数据库、Web 或 CLI |
| `packages/database` | 只有 `system_metadata` 与 `0001-system-metadata` migration | 用顺序前向 migration、Kysely 类型和 repository/transaction 边界加入业务实体；现有表与健康检查必须保持兼容 |
| `apps/api` | Fastify 只提供健康、系统信息、OpenAPI 和通用错误 | 按 Identity、Pairing、Projects/Membership、Tasks、Workspaces、Authorization/Audit 模块扩展；路由层不复制领域授权 |
| `apps/web` | React/TanStack Query 只展示服务就绪状态 | 只加入注册、登录、退出、配对确认/拒绝、设备列表与撤销，不承担本地文件处理 |
| `packages/workspace-core` | 只有离线状态、诊断和平台信息端口 | 扩展为路径、manifest、差异、本地副本、凭据、文件与原子物化端口；不得依赖 DOM、React、CLI 解析或数据库 |
| `apps/workspace-cli` | 只有 status/doctor 与两个只读 MCP 工具 | 保留既有诊断兼容，新增人工配对、连接、租约、同步和冲突选择命令；不注册 Agent 业务写工具 |
| 原型夹具 | 已有 `SYNC-001`–`SYNC-009` 与基础 manifest | 服务端阶段先证明 `SYNC-001`–`SYNC-007`，本地/macOS 阶段补齐 `SYNC-008`–`SYNC-009` 和端到端证据 |
| 工程门禁 | Node 24、pnpm 11、format/lint/build/typecheck/test 汇总为 `pnpm check` | 每个会改变工程的阶段在最后一次可能失效的位置运行目标测试与根门禁；不无依据重复完整检查 |
| 当前环境 | macOS arm64；Node `v24.18.0` 已安装但默认 shell 为 Node 22；pnpm `11.9.0`；PostgreSQL `17.10` 客户端可用且当前服务未就绪；无 Docker/Windows 实机 | 执行阶段显式启用仓库 Node 24；数据库阶段使用隔离 PostgreSQL；Docker 与 Windows 只在对应门禁需要时验证 |

## 3. 全局详细设计

### 3.1 组件与依赖

```text
Web / Workspace CLI
        ↓ TypeBox/JSON contracts
Fastify modules → application services → domain rules
        ↓                         ↓
Kysely repositories         ObjectStore port
        ↓                         ↓
PostgreSQL 17               local content-addressed directory

Workspace CLI → workspace-core orchestration → filesystem / credential / HTTP ports
```

- 共享契约只表达外部输入、输出、稳定错误和状态；数据库行型与 CLI 文本不得泄露到契约。
- 领域层负责资格、有效 Owner、租约、CAS 与冲突决策；数据库事务和 API 负责获取权威事实后调用领域规则。
- API 应用服务是 Web、CLI 和测试 fixture 的共同业务入口；fixture 只通过测试构建器调用服务，不开放无认证 bootstrap 路由。
- `workspace-core` 负责本地确定性算法与编排，平台适配器负责受限文件系统、OS 凭据和 HTTP；CLI 只负责参数、明确确认和呈现。

### 3.2 身份、授权与秘密边界

- 密码只以 Argon2id 摘要保存；Web session、设备凭据、短期访问令牌、配对码和租约令牌在数据库中只保存不可逆摘要或必要的非秘密元数据。
- Web Cookie 固定 `Secure`、`HttpOnly`、`SameSite`，状态修改接口同时执行同源/Origin 防护；TLS 由 Caddy 部署边界提供。
- 配对请求把 Web 可见的一次性码与 CLI 持有的关联秘密同时绑定，状态机为 pending/approved/denied/consumed/expired/revoked；签发与消费在事务中完成。
- Workspace 读取按既有权限基线执行：用户级要求认证，项目级与任务级要求活动项目成员；写入再叠加本人、Project Owner/Admin 或有效 Task Owner 资格以及唯一租约。
- 任一续租、提交、接管和冲突选择都重新读取用户、设备、Membership、有效 Owner、Workspace 生命周期和工作周期；不信任客户端角色声明。

### 3.3 数据、事务与并发

- P-001 以前向 migration 加入身份、session、设备、配对、Project/Membership/Task、Workspace 与审计基础；P-002 再加入租约、版本、manifest、对象引用与幂等记录。
- 作用域 Workspace 通过 scope 类型/ID 唯一约束；用户、项目和任务创建与初始空 Workspace 在同一数据库事务完成。
- Project Owner 使用唯一活动 Membership 外键表达；Task 有效 Owner 由同项目祖先链确定，顶层任务必须有活动显式 Owner。
- 活动租约使用显式状态、Workspace/工作周期锁和只允许一个 active 行的数据库约束；过期判断只使用服务端时钟。
- 提交事务锁定 Workspace 权威行，依次复核资格、设备、租约、工作周期、基线和幂等摘要，再创建一个不可变版本并单调更新 `sync_version`。
- 对象先按 SHA-256 写入 `ObjectStore` 临时位置并校验，再进入引用事务；数据库提交失败只可能留下不可见孤立对象，manifest 不得引用缺失或错误哈希。

### 3.4 公共接口与错误

- 所有新 HTTP 资源位于 `/api/v1`，通过 TypeBox 运行时校验并进入 OpenAPI；现有 `/health/*`、`/api/v1/system/info` 和 `ApiErrorSchema` 保持兼容。
- 认证/配对、最小 Project/Task fixture service、Workspace metadata/manifest/object、lease、commit 与 conflict choice 分属模块，但共享 request ID、认证上下文、稳定错误和审计设施。
- 错误返回稳定机器码、用户可读信息、request ID、适用时的当前版本和可执行恢复建议；普通日志与审计都不得包含秘密或文件全文。
- CLI 人类输出与结构化输出投影同一结果；配对等待、只读争用、租约倒计时、未同步和冲突状态保持稳定可解析。

### 3.5 本地路径、状态与原子物化

- manifest 路径统一为 `/` 分隔、UTF-8、Unicode NFC 的规范化相对路径；排序与整体哈希确定。
- 扫描使用受限根目录、重新读取和 SHA-256；拒绝 `.ngapd/`、`TASK.md`、`SUMMARY.md`、路径穿越、越界链接、碰撞、保留名和不可安全映射名称。
- 服务端 Workspace 生命周期、连接状态、本地副本状态和租约状态分别建模；物化完成前不得更新本地同步基线。
- 下载使用同目录临时文件、校验和原子替换；失败保留原受管内容或明确恢复副本。`use_server` 与首次物化复用同一端口。
- 设备长期材料只经 OS 凭据端口；控制状态只保存非权威 ID、版本、路径登记和非秘密摘要。

### 3.6 兼容、迁移、发布与回退

- 两批 migration 都先在隔离 PostgreSQL 验证，再按“备份/检查 → migration → 新应用”部署；migration 失败阻止应用切换，不能以部分结构继续写入。
- 新表和路由保持 additive；旧应用可忽略新表，现有健康、Web 基础页、CLI status/doctor 和只读 MCP 工具持续可用。
- 尚未产生业务写入时可以在隔离环境执行 down/dispose；产生身份或 Workspace 事实后不得盲目 down，恢复使用迁移前备份和匹配应用版本。
- ObjectStore 根目录不得指向用户 Workspace；数据库回退不能把未引用对象变成可见内容。跨介质恢复必须以数据库引用为权威。
- P-003 完成后功能主体可以安全停在 `awaiting_next_phase`；没有 P-004 Windows core 证据时不得创建 `change-0.md` 或 `effective-requirements.md`。

## 4. 阶段路线图

| 阶段 | 目标 | 关联需求与验收 | 前置阶段 | 退出条件 | 当前状态 |
| --- | --- | --- | --- | --- | --- |
| P-001 | 建立真实身份、Web/设备配对、三级作用域授权与唯一 Workspace 数据基础 | `FR-001`–`FR-010`、`FR-032`–`FR-035`、`FR-038` / `AC-001`–`AC-005`、`AC-012`、`AC-013`、`AC-016`、`AC-017` | 无 | 两批后续能力可依赖的身份/授权/Workspace 基础已由隔离 PostgreSQL、API/Web 与兼容门禁证明，尚未开放同步写流 | ready |
| P-002 | 完成服务端租约、版本、ObjectStore、幂等提交、接管与双向冲突协议 | `FR-011`–`FR-025`、`FR-033`–`FR-036`、`FR-038` / `AC-004`–`AC-008`、`AC-011`–`AC-013`、`AC-016`、`AC-017` | P-001 | `SYNC-001`–`SYNC-007` 在真实 PostgreSQL 与本地 ObjectStore 上可重复通过；旧租约/基线/资格不能改变服务端事实 | planned |
| P-003 | 完成 workspace-core、本地端口、CLI 流程和真实 macOS Apple Silicon 端到端主体 | `FR-003`–`FR-006`、`FR-021`–`FR-032`、`FR-036`–`FR-038` / `AC-002`、`AC-003`、`AC-006`–`AC-014`、`AC-016`–`AC-020` | P-001、P-002 | Web 配对、OS 凭据、双进程争用、扫描、同步、冲突和原子替换在 macOS 通过；项目保持可构建并安全等待 Windows | planned |
| P-004 | 在三个原型主体完成后执行 Windows 11 x64/NTFS core 门禁并完成最终集成验收 | `FR-001`–`FR-038` / `AC-001`–`AC-020` | P-003；Task UI 与 Agent Context 原型主体完成并可进入集中 Windows 验证 | Windows 核心契约、漂移敏感门禁与完整追踪一致；所有 core/硬门禁通过，supplemental 已通过或合规记录 `FND-I-*` | planned |

P-001 至 P-003 的每个出口都保持构建与既有接口可用；P-004 是最终集成与整体验收阶段。后续只在前一阶段结果完成且 state 为 `awaiting_next_phase` 时即时创建下一份阶段计划。

## 5. 跨阶段依赖与不变量

| 依赖 | 约束 |
| --- | --- |
| P-002 → P-001 | 只能使用 P-001 已冻结的身份、授权、Workspace ID、repository 和审计边界；若 P-001 结果需要修正，追加纠正阶段而不改写结果 |
| P-003 → P-001/P-002 | CLI 和 workspace-core 只调用正式契约/API，不直连数据库、不复制授权或租约规则 |
| P-004 → P-003/外部原型 | Windows 计划只在 P-003 与另外两个原型主体完成后生成；等待期间不得伪造 Windows 或最终完成证据 |

所有阶段持续满足：

1. PostgreSQL 是身份、授权、租约、版本和 manifest 权威；本地状态与对象缓存非权威。
2. 每个 Workspace/工作周期最多一个可提交租约，`sync_version` 单调，失败请求不产生可见半版本。
3. 资格、租约、工作周期和基线失效后停止上传；冲突选择必须由仍有资格的用户明确执行。
4. 密码、配对秘密、令牌、设备凭据、OS 凭据和文件全文不进入参数、普通输出、日志或审计。
5. 路径越界、保护文件、跨平台碰撞和不完整原子替换在更新本地基线或服务端版本前阻塞。
6. 现有 API 健康/系统信息、Web 构建、CLI status/doctor 与两个只读 MCP 工具保持兼容。
7. 不实现本地 GUI、不注册 Agent 同步/写入工具、不开放无认证 fixture 路由、不调用外部 API/AI/LLM。
8. 只有一个阶段处于 ready/in_progress/paused/blocked；完成结果不可修改。

## 6. 最终集成与整体验证流程

1. P-001 在最后一次身份/配对/Web 修改后执行针对性领域、migration、API 与 Web 验证，再执行根项目门禁；证明现有 `system_metadata`、健康和诊断兼容。
2. P-002 在完整服务端写流稳定后一次执行 `SYNC-001`–`SYNC-007`、并发/幂等/事务失败/重启与审计验证，再执行根门禁；不重复无关浏览器流程。
3. P-003 在本地与 CLI 修改完成后执行算法/故障注入、双进程 API 联调和真实 macOS 场景，覆盖 `SYNC-001`–`SYNC-009`、Web 配对、OS 凭据和原子替换；随后执行根门禁。
4. P-004 先复核 P-001 至 P-003 的不可变结果与项目漂移，只重跑可能被后续阶段影响的共享门禁；在 Windows 11 x64/NTFS 执行配对、凭据、租约争用、路径、同步、冲突和原子替换核心契约，最后汇总全部需求、core、supplemental 与 finding。
5. `relaxed` 不要求 red-first。`AC-001`–`AC-017`、安全/隐私/数据完整性/公开兼容/构建/恢复/必需项目检查和用户工作保护始终阻塞；`AC-018`–`AC-020` 的异常只有在独立证据证明不影响交付行为时才能以连续 `FND-I-*` 保留。`AC-019` 中涉及既有服务端版本不损坏的部分仍是数据完整性硬门禁。

## 7. 需求追踪矩阵

| 需求 | 验收 | 实现阶段 | 验证 |
| --- | --- | --- | --- |
| `FR-001`–`FR-002` | `AC-001` | P-001，P-004 最终复核 | Argon2id 数据检查、注册事务、Cookie/同源、登录/退出与匿名拒绝 |
| `FR-003`–`FR-006` | `AC-002`、`AC-003` | P-001 服务端/Web；P-003 CLI/凭据；P-004 平台复核 | 配对状态机负向矩阵、单次消费、撤销、CLI 无密码、秘密输出扫描、macOS/Windows OS 凭据 |
| `FR-007`–`FR-010` | `AC-004`、`AC-005` | P-001；P-004 最终复核 | 真实用户/成员/Owner/Task fixture、有效 Owner、资格对照、并发唯一 Workspace 与事务回滚 |
| `FR-011`–`FR-015` | `AC-006`、`AC-011` | P-002 服务端；P-003 客户端；P-004 平台复核 | 租约并发、服务端时钟、续租复核、接管、迟到提交和资格/生命周期失效 |
| `FR-016`–`FR-020` | `AC-006`、`AC-008` | P-002；P-003；P-004 | 初始空版本、确定 manifest、对象校验、CAS、幂等重试/冲突与事务故障 |
| `FR-021`–`FR-025` | `AC-007`、`AC-011` | P-002 规则/API；P-003 CLI/物化；P-004 | 冲突前双方保留、明确 `use_local`/`use_server`、无资格拒绝、Owner 正常/强制路径与审计 |
| `FR-026`–`FR-030` | `AC-009`、`AC-010`、`AC-014`、`AC-015`、`AC-018`、`AC-019` | P-003 macOS；P-004 Windows | 纯算法、扫描竞态、保护路径、跨平台名称、软限制、故障注入、真实性能与原子替换 |
| `FR-031`–`FR-032` | `AC-001`–`AC-003`、`AC-014`、`AC-015`、`AC-020` | P-001 Web；P-003 CLI；P-004 Windows | Web 人工流、CLI 人类/结构化状态、现有诊断兼容及两平台端到端操作 |
| `FR-033`–`FR-035` | `AC-012`、`AC-013`、`AC-017` | P-001 基础；P-002 同步扩展；P-004 最终复核 | OpenAPI/运行时 Schema、稳定错误/request ID、审计脱敏、migration/重启/并发与根门禁 |
| `FR-036`–`FR-037` | `AC-006`–`AC-015`、`AC-018`–`AC-020` | P-002 服务端场景；P-003 macOS；P-004 Windows | `SYNC-001`–`SYNC-009` 确定性重复执行、双进程、macOS/Windows 实机证据 |
| `FR-038` | `AC-016`、`AC-017` | P-001–P-004 持续门禁 | 能力/依赖/网络/路由范围扫描、既有工程构建与适用测试 |

覆盖结论：`FR-001`–`FR-038` 与 `AC-001`–`AC-020` 均映射到实现阶段和可观察验证；P-004 负责最终完整集成结论。

## 8. 风险、技术决策与修订记录

### 8.1 风险与门禁

| 风险 | 等级 | 控制与恢复 |
| --- | --- | --- |
| migration 或唯一约束半应用 | 高 | 隔离数据库先行、显式 migration 门禁、应用切换前备份；失败停止启动，不在已有业务写入后盲目 down |
| 密码、Cookie、配对或设备秘密泄露/重放 | 高 | Argon2id、摘要存储、短期/单次状态机、同源防护、脱敏日志与负向测试；任一异常阻塞 |
| 租约/版本/对象跨事务竞态 | 高 | 权威行锁、数据库唯一约束、服务端时钟、CAS、幂等摘要与对象存在性校验；故障注入和并发测试阻塞 |
| 路径逃逸或原子替换破坏用户内容 | 高 | 受限根、真实路径/链接检查、临时文件与故障恢复证据；任一未知影响阻塞 |
| Windows 外部门禁长期不可用或项目漂移 | 高 | P-003 后安全等待；P-004 即时重审漂移，缺少 core 实机证据绝不 finalizing |
| supplemental 性能或状态呈现偏差 | 中 | 独立证明 core/硬门禁后才可记录连续 `FND-I-*`，不为 report-only finding 安排无依据的重复诊断 |

### 8.2 技术决策

| ID | 决策 | 依据 | 影响 |
| --- | --- | --- | --- |
| TD-001 | 使用四个安全阶段与 expanded 风险细节 | 两批 migration、公共安全边界、本地原子写入和 Windows 外部交接 | P-001 只计划当前可执行基础；未来计划即时生成 |
| TD-002 | 服务端采用模块化应用服务 + 纯领域规则 + Kysely repository/transaction | 现有 Fastify/Kysely 架构与单一业务规则要求 | Web、CLI、fixture 不复制授权 |
| TD-003 | 使用 additive migration、显式活动租约唯一约束和 Workspace 行锁/CAS | 需要并发唯一性与可回退部署状态 | P-001/P-002 各自有独立 migration 门禁 |
| TD-004 | ObjectStore 写入先校验、数据库引用后提交，孤立对象不可见 | 数据库与文件系统不能共享事务 | 数据完整性以 manifest 引用为权威 |
| TD-005 | 本地能力放入 workspace-core 端口与独立平台适配器，CLI 保持薄层 | 现有 ADR-014 与未来 GUI 复用边界 | P-003 不把算法放入参数解析 |
| TD-006 | relaxed finding 从 `FND-I-001` 连续编号，Windows 缺证据不能成为 finding | schema 3.2 与用户确认策略 | core/硬门禁保持阻塞 |

### 8.3 修订记录

| 修订 | 日期 | 变更 | 原因 | 影响阶段与追踪 |
| --- | --- | --- | --- | --- |
| 1 | 2026-07-25 | 初始四阶段 expanded 路线图 | 需求完整；migration、安全公共接口、本地文件恢复和延后 Windows core 构成真实阶段/证据风险 | 建立 P-001–P-004；完整覆盖 `FR-001`–`FR-038`、`AC-001`–`AC-020` |
