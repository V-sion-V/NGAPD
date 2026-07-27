# M0：领域基线和工程骨架实施路线图

## 1. 范围与执行模式

- 功能 ID：`m0-domain-baseline`
- 工作流 schema：`3.2`
- 执行模式：`phased`
- 计划详细度：`expanded`
- 交付与验证策略：`relaxed`
- 路线图修订：`1`
- 需求指纹（SHA-256）：`844c505f9c6b15ae64f217026ba27c7c6ac22dd394f0ce80112a43960a8037d1`
- 项目基线：分支 `codex/m0-domain-baseline`，提交 `7f23d31592c72e258efa613a73ea862b9e0f0289`；规划前只有 `docs/requirements/m0-domain-baseline/` 为未跟踪用户工作，且其中已存在 `requirements.md` 与 `workflow-contract.md`
- 规划日期：2026-07-27

采用分阶段和 expanded 详细度不是因为工作量，而是因为正式 M0 Schema 需要显式破坏性重建，且共享契约与应用集成必须保护现有 `/api/v1` Identity/Workspace 公共兼容。四个阶段分别冻结生产领域契约、正式数据库与并发边界、应用与技术集成、最终发布门禁；每个阶段均保持仓库可构建，最终阶段统一负责完整集成验收。

当前 shell 为 Node.js `20.13.1`、pnpm `11.9.0`，不满足仓库要求的 Node.js 24。执行阶段必须先切换到 `.node-version` 指定运行时；规划不把当前不合规运行时当作通过证据。

## 2. 项目现状与全局实现依据

- `packages/domain` 当前只含 Workspace 授权/租约、配对和部分有效 Owner 解析；正式树、同级 DAG、状态、冻结、重新打开与影响集合尚不存在。
- `packages/contracts` 已使用 TypeBox，但 Task 仍为原型 `open / in_progress / done / archived`，Project Key 仍允许数字；Identity、Pairing、Workspace 与统一错误体已经形成公共兼容边界。
- `packages/database` 当前有三份原型迁移、Identity/Workspace Repository 与审计基础。Project/Task 表缺少正式序列、状态、图版本、依赖、冻结和生命周期字段，也没有正式 M0 并发事务端口。
- `apps/api` 已提供 Fastify、OpenAPI 3.1、`/api/v1`、Identity/Workspace 路由、请求 ID、错误适配和 live/ready；`apps/worker` 只有 Graphile Worker 健康任务；Compose 尚未包含 Web 服务。
- `packages/workspace-core` 与 `packages/object-store` 已有清单、路径、租约、同步与本地原子替换原型能力，但任务生命周期协调仍缺服务端端口。
- 三个前置原型均已封存为 `completed/passed` 且无开放 finding。它们可提供确定性夹具和平台证据，但正式规则必须落在生产模块。
- `docs/09-technical-architecture-decisions.md` 第 16 节要求 M0 固定 Fastify/TypeBox/Kysely/OpenAPI、PostgreSQL 递归和并发、Outbox/Worker、对象一致检查点、Workspace 平台端口、SSE 游标六类结论。
- 仓库没有发现适用的 `AGENTS.md`；根 `package.json` 的 `check` 顺序和 Node.js 24/pnpm 11 约束是工程门禁依据。

## 3. 全局详细设计

### 3.1 模块与依赖方向

- `packages/domain` 拥有标识、树、Owner、同级 DAG、依赖请求、关注、状态/冻结/重新打开、影响集合和授权决策。接口使用纯输入/输出和稳定失败码，不依赖数据库、Fastify、UI 或测试夹具。
- `packages/contracts` 拥有可序列化枚举、TypeBox Schema、版本字段、稳定错误目录与内部端口 DTO；客户端只能依赖该包和 UI 无关的 `packages/workspace-core`，不得导入领域服务或数据库。
- `packages/database` 拥有正式 M0 Schema、迁移、Repository、锁顺序、递归查询、幂等记录、审计和 Outbox 持久化。SQL 约束与领域校验形成双重保护。
- `apps/api` 按 Identity、Projects/Membership、Roles、Tasks、Dependency Graph、Authorization/Audit、Workspaces、Agent Operations、Knowledge/Notifications 组合应用服务。模块只能通过应用端口、只读查询或已提交领域事件协作，不直接更新他方表。
- `apps/worker` 只消费已提交 Outbox/Graphile Worker 作业；任何决定 Task/Workspace 权威事实的动作都留在请求事务。
- Web、Workspace CLI、Object Store 与 Workspace Core 只消费共享契约或明确端口；M0 不开放完整 Project/Task CRUD、正式任务 UI、本地同步或 Agent 写工具。

### 3.2 数据、事务与并发

- Project 使用内部 UUID、不可变且全局唯一的 `[A-Z]{2,6}` Key、事务性 `task_sequence`、唯一 Owner、重新打开策略、归档、`recovery_epoch` 与乐观版本。
- Task 使用内部 UUID、项目内不可复用 Sequence/Task Key、同项目邻接树、可空显式 Owner、`not_started / in_progress / done` 基础状态、独立归档、乐观版本和冻结事实。
- 虚拟项目根与普通父任务统一映射为一个图作用域记录；依赖、移动、归档和删除按稳定作用域主键顺序锁定 `graph_version`，在锁内重查树、端点、Owner、权限、版本与无环性。
- Task Key 分配与幂等请求处于同一项目事务；回滚允许产生间隙，已分配编号不复用。
- 完成、Owner 固化、最终 Workspace 版本/快照、租约撤销、冻结、审计与 Outbox 使用同一数据库事务或一个可证明无半状态的应用事务端口。重新打开以相同边界创建新工作周期并保留旧快照。
- 审计是不可变业务记录；Outbox、通知、SSE 投影和一致检查点可重建，不成为业务权威。

### 3.3 契约、错误与兼容

- 所有已公开 HTTP 操作继续位于 `/api/v1`，使用 TypeBox 运行时 Schema、OpenAPI 3.1、请求 ID 和统一错误体。
- 正式错误目录覆盖标识、树、Owner、图、陈旧请求、冻结、版本、租约、幂等和影响确认；领域失败到 HTTP 失败保持一对一可诊断映射。
- Identity、设备配对、Workspace 读取/写入、租约、同步与冲突 Schema 保持输入输出兼容。Task 原型 Schema 可收敛为正式状态，但不得借此改变已发布 Identity/Workspace 行为。
- SSE 事件只携带游标和资源失效提示；断线重连按游标恢复，游标过期要求重新获取权威资源。

### 3.4 迁移、发布与回滚

- 正式基线明确取代可丢弃的原型数据库布局。破坏性重建必须使用独立、显式命名且带目标确认的入口；普通迁移命令不得静默清空数据库。
- 空 PostgreSQL 17 数据库必须可重复建立相同 Schema；重复迁移无漂移，应用与 Worker 只有在 Schema 版本就绪后 ready。
- 迁移和并发验证只针对隔离的临时/已确认原型实例。遇到来源不明或未确认可丢弃的数据库立即停止。
- 数据回滚边界是恢复代码版本并重新建立空数据库，不承诺恢复已被确认丢弃的原型业务记录；Git 中的原型与工作流证据不删除。
- 最终 Compose 包含 PostgreSQL、迁移、API、Worker、Web 与 Gateway，并验证持久卷、进程权限和 live/ready。

### 3.5 安全、可观测性与运维

- 所有租户查询使用服务端解析的 `project_id`；确认、管理员模式与 Agent 意图均不能替代授权或唯一租约。
- 密码、令牌、租约秘密和 Workspace 全文不进入错误、普通日志或审计元数据；服务端运行时不得访问外部 API、AI 或 LLM。
- API/Worker 输出结构化 JSON，包含请求/作业关联、模块与稳定错误码；审计与诊断日志分离。
- Core 验证覆盖真实 PostgreSQL 事务、迁移、公共兼容、构建、Compose、安全与无外部服务。Supplemental 性能/额外诊断只执行一次；合格异常用稳定 `FND-I-*` 记录。

## 4. 阶段路线图

| 阶段 | 目标 | 关联需求与验收 | 前置阶段 | 退出条件 | 当前状态 |
| --- | --- | --- | --- | --- | --- |
| P-001 | 冻结生产领域语义、授权结果、共享运行时契约和正式错误目录 | FR-003、FR-005–FR-019、FR-023–FR-026、FR-028；AC-002、AC-004–AC-007、AC-009–AC-014、AC-017、AC-020、AC-024–AC-026 | 无 | 生产领域模块可独立执行并由确定性测试证明树、Owner、DAG、状态、冻结、重新打开、影响与授权；共享 Schema 表达正式状态且 Identity/Workspace 契约未变；相关包在 Node 24 下构建、类型检查和测试通过 | ready |
| P-002 | 建立正式可重建 Schema、Repository、真实 PostgreSQL 递归/锁/幂等/原子协调边界 | FR-002–FR-010、FR-012–FR-016、FR-020–FR-022；AC-001–AC-008、AC-010–AC-016、AC-018、AC-025 | P-001 | 隔离 PostgreSQL 17 可显式重建、空库迁移和重复迁移；标识、树、图版本、移动、完成/重新打开与 Workspace 协调在真实并发和失败注入下无半状态；数据库层保持 P-001 契约 | planned |
| P-003 | 组合模块化应用服务，完成错误/审计/Outbox/Worker/SSE/Workspace 适配并保护公共兼容 | FR-001、FR-013–FR-026、FR-028；AC-011–AC-021、AC-024、AC-026 | P-002 | 模块边界、内部端口和技术验证形成可判定结论；Identity/Workspace、Web、CLI 兼容检查通过；未注册越界 CRUD/UI/同步/Agent 写入口 | planned |
| P-004 | 完成最终集成、CI、迁移与 Compose 发布门禁、规模/安全验证及 findings 汇总 | FR-001–FR-028；AC-001–AC-029 | P-003 | 全部 core 与硬门禁通过；Node 24/pnpm 11 根门禁、空库/重复迁移、真实并发、Compose 健康、规模与无外部网络证据有效；supplemental 通过或形成合格 `FND-I-*`；生成最终阶段结果、有效需求与 `change-0.md` | planned |

## 5. 跨阶段依赖与不变量

- 数据库权威、服务端重新授权、租户过滤、单写 Workspace、不可变 Project/Task Key、同级无环 DAG、完成冻结、稳定错误码、秘密不入日志和仓库可构建在每个阶段都不得退化。
- P-001 的领域结果和错误码是后续 Repository 与应用服务的输入权威；P-002 不复制另一套业务规则，P-003 不绕过领域与数据库事务端口。
- 已公开 Identity/Workspace 契约在每个阶段保持兼容；修改共享索引或 Schema 时同步运行其契约测试。
- 每个阶段结束时仓库必须可构建。P-002 的数据库变化只能发生在隔离/已确认实例；不得让未完成迁移成为下一阶段前置状态。
- P-004 之前的定向证据若未被后续修改影响则不重复；完整根门禁、Compose 和最终整体验收只在 P-004 的最终代码状态运行。
- 任一 core、hard gate、高/严重或影响未知问题均阻塞。Relaxed 策略只允许已独立证明不影响交付行为的 supplemental 异常保留为 report-only finding。

## 6. 最终集成与整体验证流程

1. 在 `.node-version` 指定的 Node.js 24 和 pnpm 11.9.0 下确认所有阶段结果、需求/验收映射与未决项完整。
2. 运行根级格式、静态检查、构建、类型检查和自动化测试；只在最终代码状态运行一次完整 `pnpm check`。
3. 对隔离 PostgreSQL 17 执行显式正式重建、空库迁移、重复迁移、Schema 漂移检测、真实并发与失败注入验收。
4. 运行 Identity、设备配对、Workspace、Web、Workspace CLI 与三份原型核心兼容检查，并验证客户端包依赖方向。
5. 构建并启动 Compose 的 PostgreSQL、迁移、API、Worker、Web、Gateway，确认迁移依赖、live/ready、持久卷和无公共制品发布。
6. 用深度 20、200 同级 DAG、5,000 活动任务主体数据验证正确性和无明显卡顿；在参考环境执行一次 P95 与可选附加诊断。
7. 检查运行时网络依赖、租户过滤、秘密/日志、审计、单写租约、Outbox 幂等、SSE 游标与对象一致检查点。
8. 汇总每个 core 与 supplemental 结论；仅在符合 relaxed 报告条件时分配 `FND-I-*`，随后完成最终阶段结果、`effective-requirements.md`、`change-0.md` 和 completed 状态。

## 7. 需求追踪矩阵

| 需求或验收组 | 实现阶段 | 主要验证 |
| --- | --- | --- |
| FR-001 | P-001、P-003、P-004 | 包依赖与模块组合审查；跨模块写入边界；最终集成 |
| FR-002 | P-002、P-004 | 显式重建、空库/重复迁移、漂移与 ready 门禁 |
| FR-003–FR-004 | P-001、P-002 | Key/Sequence 领域测试、约束、并发与幂等 |
| FR-005–FR-011 | P-001、P-002 | 树/Owner/DAG/请求/锁/关注的领域与真实数据库测试 |
| FR-012–FR-016 | P-001、P-002、P-003 | 状态、完成冻结、重新打开、影响集合及 Workspace 原子协调 |
| FR-017 | P-001、P-003、P-004 | 服务端事实授权、租户过滤、影响确认和安全检查 |
| FR-018–FR-020 | P-001、P-003、P-004 | TypeBox/OpenAPI、错误映射、幂等/版本与不可变审计 |
| FR-021–FR-023 | P-001、P-002、P-003 | Workspace 唯一性、生命周期端口、事务失败注入与权限矩阵 |
| FR-024 | P-001、P-003、P-004 | Identity/Workspace/Web/CLI 公共兼容 |
| FR-025 | P-002、P-003、P-004 | 六类技术验证或替代 ADR |
| FR-026 | P-001、P-003、P-004 | 共享包导入边界和生产规则可复用性 |
| FR-027 | P-004 | 根门禁、迁移、Compose 构建与健康启动 |
| FR-028 | P-001、P-003、P-004 | 路由/导出审查与越界入口负向验证 |
| AC-001–AC-003 | P-001、P-002、P-004 | 迁移、Project Key、Task Key 并发/幂等 |
| AC-004–AC-009 | P-001、P-002、P-004 | 树、Owner、同级 DAG、图版本、请求、移动并发、关注 |
| AC-010–AC-014 | P-001、P-002、P-003、P-004 | 状态、完成/冻结、重新打开和确定性影响集合 |
| AC-015–AC-016 | P-001、P-002、P-003、P-004 | Workspace 权限/租约/版本与 Task 原子协调 |
| AC-017–AC-018 | P-001、P-003、P-004 | HTTP/内部错误适配、OpenAPI 与审计保密 |
| AC-019–AC-021 | P-003、P-004 | 公共兼容、依赖方向与六类技术结论 |
| AC-022–AC-024 | P-003、P-004 | 根工程、Compose 和功能边界 |
| AC-025–AC-026 | P-001、P-002、P-003、P-004 | 主体规模正确性、安全/网络/租户/秘密门禁 |
| AC-027–AC-029 supplemental | P-004 | 单次性能目标、额外随机压力和附加诊断；必要时 `FND-I-*` |

## 8. 风险、技术决策与修订记录

### 8.1 风险与控制

| 风险 | 控制 |
| --- | --- |
| 正式 Schema 破坏原型数据 | 只对隔离或已明确确认可丢弃实例运行显式重建；普通迁移不隐式删除；记录不可恢复边界 |
| Task 契约收敛误伤公共接口 | 先冻结 P-001 共享契约，保持 Identity/Workspace Schema 不变，并在 P-003/P-004 重复兼容门禁 |
| 领域规则在纯模块、SQL 和应用服务之间分叉 | P-001 定义稳定结果/失败码；SQL 只作完整性双重保护；应用服务消费同一领域端口 |
| 移动、依赖、完成与 Workspace 出现半提交 | 稳定图锁顺序、同一数据库事务/Unit of Work、真实 PostgreSQL 交错和失败注入 |
| M0 越界实现 M1/M2/M3/M4/M5 | 只导出内部应用/Repository/测试端口；负向检查公共路由、正式 UI、本地同步和 Agent 写工具不存在 |
| 当前 shell 为 Node 20 且缺少已确认 PostgreSQL/Docker 入口 | 实施前切换 Node 24；数据库和 Compose 阶段先解析隔离目标，不能把不合规环境结果当作通过证据 |

### 8.2 技术决策

- 使用四个 outcome 阶段；破坏性迁移与公共兼容是分期和 expanded 详细度的合同依据。
- 使用生产领域纯模块作为语义权威，数据库约束和锁作为并发/完整性保护，应用服务作为跨模块事务编排入口。
- 正式重建采用明确入口并拒绝未知目标；具体迁移文件和命令在 P-002 规划时依据届时项目事实细化。
- 最终整体验收集中在 P-004；前面阶段不重复仍然有效的全仓验证。

### 8.3 修订记录

| 修订 | 日期 | 结论与依据 | 影响阶段 | 追踪影响 |
| --- | --- | --- | --- | --- |
| 1 | 2026-07-27 | 初始路线图；依据破坏性迁移和公共兼容边界选择 `phased + expanded`，保留用户选择的 `relaxed` 策略 | P-001–P-004 | 覆盖 FR-001–FR-028、AC-001–AC-029 |
