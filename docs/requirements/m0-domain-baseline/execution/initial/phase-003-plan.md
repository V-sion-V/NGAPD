# P-003：模块应用服务与技术集成阶段计划

- 运行编号：`initial`
- 阶段编号：`P-003`
- 阶段计划修订：`1`
- 父路线图修订：`1`
- 父路线图指纹（SHA-256）：`eb90885df1246062d407f9284e015de0e0521d93e0e00f35ab5debc21af366ad`
- 需求指纹（SHA-256）：`844c505f9c6b15ae64f217026ba27c7c6ac22dd394f0ce80112a43960a8037d1`
- 项目基线：分支 `codex/m0-domain-baseline`，提交 `7f23d31592c72e258efa613a73ea862b9e0f0289`；P-001/P-002 位于同一未提交工作树，immutable result 指纹分别为 `cdad119ffe04d74054dbee35e1dda1712f7e90bd5eb2613931e0f1b1b6cb8f8e`、`ada169fd96445f5cbdd0130d3235995e91e3bd8c70317aec02a930438c9dba2a`
- 创建日期：`2026-07-27`
- 计划详细度：`expanded`
- 交付与验证策略：`relaxed`
- 规划验证结论：`ready`
- 实施验证结论：`pending`

## 1. 阶段目标、边界与关联需求

本阶段只组合 P-001 已冻结的领域/契约与 P-002 已验证的 Repository/事务端口，形成 M0 可供 M1/M2 复用的模块应用层，并完成 ADR 第 16 节中尚未关闭的 Outbox/Worker、对象一致检查点、Workspace 平台端口和 SSE 游标验证。阶段结束时：

- API 具有可执行的模块归属与内部 Task command/query 服务；操作者、租户和 Project 事实由服务端解析，领域/Repository 失败无歧义进入统一错误目录。
- 关键 Task/图/lifecycle 操作的 success audit/outbox 与业务事务一致；可记录的领域拒绝和事务失败留下独立幂等 failure audit，不泄露秘密或 Workspace 全文。
- 已提交 Outbox 由 Graphile Worker 幂等投影为资源失效事件；未提交或回滚事件不可见，重试/多 Worker 不产生重复投影。
- `/api/v1` 下只新增资源失效 SSE 能力；游标支持重连，过期时明确要求重新获取权威资源，事件不承载业务提交或租约。
- Object Store 能在清单哈希和对象逐项校验后原子写入不可变一致检查点；Workspace Core 固定 UI 无关的监听/安全路径/原子替换/本地非权威状态端口，不实现真实本地同步。
- Fastify/TypeBox/Kysely/OpenAPI、P-002 PostgreSQL 递归/锁、Outbox/Worker、对象检查点、Workspace 平台端口和 SSE 六类验证均形成可判定结论；若任一 Spike 否定既有选择，停止并新增替代 ADR，不静默换型。

关联范围为路线图 P-003 行：FR-001、FR-013–FR-026、FR-028；AC-011–AC-021、AC-024、AC-026。P-001/P-002 已证明且未被本阶段相关编辑失效的领域、Schema 和并发证据不重复执行；本阶段只重复会被应用、迁移、Worker 或公共 SSE 改动影响的验证。

阶段边界：

- 不注册完整 Project/Task CRUD，不新增正式 Task UI、本地 Workspace 物化/同步、Agent 写工具、Wiki/搜索或项目备份用户入口。
- 不让 Worker、SSE、对象检查点或客户端成为 Task/Workspace 权威写入者；请求事务仍是业务事实提交边界。
- 不改变 Identity/Pairing/Workspace 已发布输入输出，不修改 P-001/P-002 plan/result、requirements、contract 或路线图。
- 不执行最终根 `pnpm check`、Compose 全服务健康、精确 P95、超主体规模随机压力或 supplemental 诊断；这些只在最终代码状态由 P-004 执行。

### 1.1 实施前置与写入边界

- 重新核对上述四个指纹、Git diff 和无 P-003 用户重叠修改。当前 `apps/api/src/modules`、`apps/worker`、`packages/object-store`、`packages/workspace-core` 相对开始提交无变更；Contracts/Database 的现有 diff 全部由 completed P-001/P-002 解释。
- 使用 Node.js 24、pnpm 11。当前可用 Codex 隔离 Node `24.14.0` 满足根 `>=24 <25`；`.node-version` 的精确 `24.18.0` 仍由 P-004 最终发布门禁复核。
- 真实数据库/Worker 验证必须重新取得可信 PostgreSQL 17 Windows x64 运行时；若复用 Zonky `17.10.0` bundle，必须再次核对发布 SHA-512 `8c5a905a35b41f97f4a675bc50a983abac094a49b57262d35e7e38f56ad482eb60fc4dbc3412f1906d3a810dd67782ad391be443757e60397835fc41f473bcf8`。只监听回环空闲端口，使用 P-003 task-owned runtime/data/log 和唯一测试数据库；阶段关闭时停止并精确清理。
- P-003 只增加前向 `0007` 级别迁移，不修改 P-002 已验证迁移的历史语义。普通 migrate 继续 fail-closed；任何 reset 只允许作用于精确确认的 P-003 隔离目标。
- 请求事务可写 Task/Workspace、audit 和 outbox；Worker 只能锁定/更新 outbox 的投递状态并写可重建事件投影；SSE 只读投影；Object/Workspace 平台 Spike 不写业务权威表。

## 2. 任务与文件范围

### 2.1 任务

| 任务 | 结果 | 文件或范围 | 实现摘要 | 验证 | 完成条件 |
| --- | --- | --- | --- | --- | --- |
| `P-003-T-001` | 模块边界、统一错误与可复用 Task 应用端口 | `apps/api/src/application-errors*`、`apps/api/src/modules/module-boundaries*`、新增 `apps/api/src/modules/tasks/**`、必要的 `packages/contracts/src/tasks.ts`/`errors.ts`/新增内部 DTO、`packages/database/src/task-repository.ts`/`task-lifecycle-repository.ts`/audit 辅助与对应测试 | 建立九个模块的可执行归属/允许依赖目录；Task 应用服务从已认证用户和目标资源解析 server `project_id`/membership/admin/agent 上下文，组合现有 Repository 而不直接写表；对 create/dependency/move/follow/blocker/complete/reopen/Owner command 和 impact/query 提供内部类型安全端口；错误适配穷举稳定失败码、HTTP 语义、当前版本与恢复建议；成功 audit/outbox 进入原业务事务，领域拒绝/事务回滚后使用 request ID 独立幂等记录 failure audit | Contracts runtime；模块依赖负向；真实 PostgreSQL 应用服务定向集成覆盖成功、租户越界、确认不能替代授权、版本/冻结/幂等冲突、成功/失败审计字段和秘密扫描；OpenAPI 路由清单证明没有 Task CRUD | M1/M2 可直接消费内部应用端口；所有 in-scope failure 都不会退化为 500；业务、audit/outbox 无半状态；无跨模块直接表更新和公共越界入口 |
| `P-003-T-002` | Outbox/Graphile Worker 幂等交接与 SSE 游标投影 | 新增前向 `0007` 应用投影迁移、`packages/database/src/outbox-repository*`/types/index/profile 期望、`packages/contracts/src/events*`/errors/index、`apps/worker/src/**` 与 package 依赖/测试、`apps/api/src/modules/events/**`、`app.ts`/必要认证适配及集成测试 | 为 Outbox claim/attempt/backoff/processed 建立稳定 `FOR UPDATE SKIP LOCKED` 边界；Graphile Worker task 只消费已提交 outbox，并把每个 outbox ID 幂等投影为项目范围的资源失效事件；使用单调不透明 cursor 与 retention floor；SSE 认证后按服务端 membership/project 范围过滤，支持 `Last-Event-ID` 重放、心跳、断开与过期游标恢复，载荷只含 cursor、资源类型/ID、事件类型和重新获取提示；API/Worker readiness 在正式 Schema 未 ready 时拒绝就绪 | 真实 PostgreSQL + Graphile Worker 定向集成覆盖请求回滚不可见、提交可见、失败重试、两个 Worker、重复 job、attempt/last_error、唯一投影；SSE 覆盖未认证、跨租户不可见、游标重放、无重复、过期恢复和断线；Database/Worker/API typecheck/build/tests | 每个已提交事件至多一个投影且最终可重试；Worker 不决定业务事实；SSE 可恢复且不泄露他租户/业务正文；`0007` 空库/前向/重复迁移与 ready 通过 |
| `P-003-T-003` | 对象一致检查点、Workspace 平台端口和 P-003 技术/兼容关闭 | 新增 `packages/object-store/src/consistency-checkpoint*`、`packages/workspace-core/src` 平台端口/测试、受影响 API/Worker/Contracts/Database 测试与阶段工件 | Object Store 在规范 manifest hash、全部对象存在/大小/哈希一致后，以内容寻址和临时文件原子替换写不可变 checkpoint；缺失/损坏时不发布 checkpoint，不提供备份恢复用户入口。Workspace Core 增加 UI 无关 watcher/change 事件端口并复用现有安全路径、materialization journal/atomic replace 和本地非权威状态；不提供 Node 文件监听实现或凭据。最后合并六类技术结论，运行受影响公共兼容、依赖/路由/网络/秘密/日志负向门禁 | Object Store 缺失/损坏/重复/崩溃前后测试；Workspace Core watcher、路径逃逸/Unicode/大小写、atomic recovery 与 non-authority 测试；Contracts/Database/API/Worker/Object Store/Workspace Core 定向与受影响 full package tests；Identity/Pairing/Workspace/Web/CLI 兼容；OpenAPI/路由、客户端依赖、外部 API/AI/LLM 和秘密扫描；changed-area Prettier、`git diff --check` | ADR 六类结论均为通过或有新增替代 ADR；公共兼容和全部 P-003 core/hard gate 通过；无越界能力、秘密、活动 Worker/PostgreSQL 或 P-003 临时产物 |

依赖顺序：`P-003-T-002` 依赖 T-001 的统一错误、audit/outbox 语义和应用边界；`P-003-T-003` 依赖 T-002 的事件投影/SSE 结论，并在最新代码状态只执行一次 P-003 公共兼容与技术集成关闭门禁。每个任务必须先写 state `in_progress` 检查点，再改其范围；完成最小验证和 post-task 检查点后才能开始下一任务。

### 2.2 关键接口与所有权

| 接口/事实 | 唯一写入者 | 消费者与约束 |
| --- | --- | --- |
| `TaskApplicationService` 内部 command/query | API Tasks 模块通过 Database Repository | M1/M2 可组合；不注册临时公共 CRUD；调用上下文不得接受客户端自称 membership/project 作为授权事实 |
| Task/Workspace 业务事实 + success audit/outbox | P-002/P-003 Repository 的同一 PostgreSQL 请求事务 | API 应用层只组合并映射结果；Worker/SSE/客户端不得更新权威事实 |
| failure audit | 无业务变更事务或事务回滚后的独立幂等 audit 写入 | 使用同一 request/target/action，记录失败事实但不宣称业务成功 |
| `OutboxRepository` 投递状态 | Worker 的短事务、稳定 claim 顺序和 `SKIP LOCKED` | 多 Worker 可并发；投影唯一键为 outbox ID；失败更新 attempt/error/available，不删除业务事件 |
| 资源失效事件投影与 cursor | Worker 从已提交 outbox 可重建生成 | SSE 只读；cursor 单调/不透明，租户过滤来自服务端 membership，过期要求重新获取 |
| Object consistency checkpoint | Object Store checkpoint 端口 | 只在 manifest/对象全部验证后原子发布；不是项目备份用户功能或业务权威 |
| Workspace watcher/atomic/local state 端口 | `@ngapd/workspace-core` 只定义 UI 无关协议和纯协调 | M0 不实现真实本地监听/写入；CLI/未来平台适配不得把本地副本提升为服务端权威 |

### 2.3 有序实施与检查点

1. T-001 先集中现有 `ApplicationError`，固定模块目录和 Task 内部端口，再逐个接入 Repository 结果；每个 mutation 先确定事务内 success audit/outbox 与事务外 failure audit 的归属，最后补穷举错误映射和无公共路由断言。
2. T-002 只新增前向投影迁移；先完成 outbox claim/project/ack/retry Repository，再把 handler 与进程启动分离以便测试，随后注册 Graphile Worker task 和 SSE read model/route。不得让 Worker 启动日志在 Schema 未 ready 时报告 ready。
3. T-003 先实现独立 Object checkpoint 和 Workspace 平台端口测试，再在最新状态运行技术结论与公共兼容关闭门禁；不得为了验证 Spike 启用真实文件同步、Project/Task CRUD 或 Agent 写入口。

## 3. 验证与完成条件

### 3.1 任务级最小验证

1. T-001：Contracts unit/runtime 与 API Tasks application integration；真实 PostgreSQL 只验证本任务新增的 server-context、错误、audit/outbox 原子边界。相关 Database/API/Contracts typecheck/build 通过后写完成检查点。
2. T-002：Database outbox、Worker task 与 SSE 定向集成必须使用真实 PostgreSQL 17 和真实 Graphile Worker；用明确 barrier/唯一键观察提交、回滚、两 Worker 和重试，不用时间碰运气作为 core 证据。相关 Database/Worker/API/Contracts typecheck/build 通过后写完成检查点。
3. T-003：Object Store 与 Workspace Core 定向/full tests；随后只在最终 P-003 状态执行一次受影响公共兼容和六类技术结论关闭门禁。

### 3.2 P-003 阶段关闭门禁

| 门禁 | 证据 | 阻塞范围 |
| --- | --- | --- |
| 应用/错误/审计 | Task application integration、错误目录穷举、success/failure audit/outbox 查询与秘密扫描 | FR-001、FR-013–FR-020 / AC-011–AC-018 |
| Outbox/Worker | 真实 PostgreSQL/Graphile Worker 提交-消费、回滚不可见、重试、多 Worker、幂等投影 | FR-020、FR-025 / AC-018、AC-021 |
| SSE | 认证、租户过滤、cursor 重放/过期/断开、OpenAPI 3.1 和只失效通知 | FR-017–FR-019、FR-025 / AC-017、AC-021、AC-026 |
| Object/Workspace Spike | 清单/对象一致 checkpoint、路径安全、watcher/atomic/non-authority 端口 | FR-021–FR-025 / AC-015–AC-016、AC-021、AC-026 |
| 迁移与静态构建 | `0007` 前向/重复迁移；受影响 package typecheck/build；Database/Contracts/API/Worker/Object Store/Workspace Core tests | 数据完整性、buildability、Schema ready |
| 公共兼容与范围负向 | 真实数据库 API full test；Identity/Pairing/Workspace/Web/CLI 受影响兼容；公共契约 diff/OpenAPI 路由清单；客户端依赖、API/Worker 外部 API/AI/LLM 扫描 | FR-024、FR-026、FR-028 / AC-019–AC-020、AC-024、AC-026 |
| 工件与环境 | changed-area Prettier、`git diff --check`、秘密/连接串/调试/临时产物扫描；只读数据库/worker summary 后停止进程并精确清理 task-owned 路径 | 恢复安全与用户工作保护 |

Core 与上述硬门禁必须全部通过才能创建 `phase-003-result.md`。Relaxed 策略下不要求 red-first；仅 supplemental 且已独立证明不影响交付行为的异常才可使用下一稳定 ID `FND-I-001` 记录为 report-only。本阶段不主动运行 AC-027–AC-029，也不得把 core 或影响未知失败降级。

P-003 完成时必须：

- 为三个任务写 durable completed 检查点和实际文件/验证结果；
- 创建 immutable `phase-003-result.md`；
- 把 state 转为 `awaiting_next_phase`，P-003 标记 completed/passed 或合格的 passed_with_findings；
- 停止本次实施调用，不规划或执行 P-004。

## 4. 风险、恢复与修订记录

### 4.1 风险与控制

| 风险 | 控制与检查点 |
| --- | --- |
| 应用层再次实现一套领域规则或信任客户端租户/Owner | 只组合 P-001/P-002 端口；server-resolved user/project/membership；错误映射不改变 decision；集成测试覆盖跨租户与确认不能替代授权 |
| success audit/outbox 与业务事实分开提交 | 每个 mutation 在 Repository 同一事务写 success；failure 只在无业务变更或完整回滚后独立幂等写；故障注入查询所有计数 |
| Worker 重复、丢失或提前消费 | Outbox 只由请求事务创建；短 claim、稳定顺序、`SKIP LOCKED`、outbox ID 唯一投影、attempt/backoff；真实提交/回滚/重试/多 Worker barrier |
| SSE 泄露他租户或成为业务通道 | 认证后服务端 membership 过滤；事件只携带失效提示；cursor 过期明确重新获取；SSE 无 Task/Workspace mutation 能力 |
| 新迁移破坏 P-002 正式基线 | 只加前向 `0007`，不改历史迁移语义；profile/migration 集成和 API/Database 回归；未知/半迁移立即停止 |
| Object checkpoint 被误解为正式备份或本地权威 | 接口命名为 consistency checkpoint，只验证/发布 manifest 事实；无恢复/调度/公共入口；Workspace Core 类型继续标记 local replica non-authoritative |
| Spike 否定既有技术选型 | 立即停止受影响任务，保留可诊断证据并新增替代 ADR；不得在实现中静默换用其他框架/队列/实时协议 |
| P-003 越界实现 M1–M5 | OpenAPI/路由、Web、CLI、package dependency 与工具导出负向检查；只暴露内部 Task service、SSE invalidation 和平台端口 |

### 4.2 中断与精确恢复

- 任一任务中断时保留当前代码和测试证据，在 state 记录 active task、实际文件、最后通过门禁、数据库 profile/migration、Worker job/outbox/event 计数和第一个未完成步骤；不使用 reset/checkout/stash 覆盖恢复。
- 迁移或 Worker 测试异常时先停止新请求/job，读取 outbox、投影、attempt、Graphile job 和 Schema 状态；只有重新核对精确 P-003 隔离目标后才能显式重建，不手工伪造 migration history 或删除失败断言。
- SSE 异常先以只读方式比较授权 membership、retention floor、cursor 和投影事实；不得通过关闭租户过滤或把全文放入事件来通过测试。
- Object/Workspace 测试只清理其自身 task-owned 临时目录；删除前验证解析后的绝对路径位于已记录 P-003 临时根。

精确首次恢复步骤：调用 `$implement-planned-feature`，完整读取 contract、roadmap、state、本计划与 P-001/P-002 results，核对四个指纹和 Git diff；取得合规 Node 24 与可信 P-003 PostgreSQL 17 隔离方案；随后在任何生产编辑前把 `P-003-T-001` 写为 `in_progress`。

### 4.3 修订记录

| 修订 | 日期 | 结论与依据 | 影响 |
| --- | --- | --- | --- |
| 1 | 2026-07-27 | 初始 P-003 expanded 计划；新增前向迁移、API/Worker 多写入协调和 additive 公共 SSE 是 expanded 的合同依据，三个顺序任务分别固定应用边界、跨进程投影和剩余平台 Spike/兼容关闭 | `P-003-T-001`–`P-003-T-003` |
