# M0：领域基线和工程骨架当前有效需求

- 派生状态：可重新生成
- 原始需求：[`requirements.md`](requirements.md)
- 已应用至修改记录：[`change-1.md`](change-1.md)
- 生成日期：`2026-07-28`

## 1. 当前目标与范围

M0 已将 NGAPD 的工程骨架和 Workspace Sync、Task UI、Agent Context 前置原型所证明的约束收敛为可执行、可迁移、可验证的服务端领域基线。change-1 进一步关闭子任务创建、移至虚拟根与 Owner 继承后代 Workspace 协调的三个授权/一致性缺口。当前基线为 M1“项目、角色和成员”与 M2“任务管理闭环”提供统一的领域、数据库、应用和发布入口。

当前包含：

- 模块化单体边界、共享运行时契约、正式错误目录和版本化迁移框架。
- 正式 Project/Task 标识、任务树、有效 Owner、同级 DAG、状态/冻结/重开、影响集合与授权。
- PostgreSQL 17 正式 Schema、显式破坏性重建、Repository、递归查询、稳定锁、幂等和 Task/Workspace 原子协调。
- Identity/Pairing/Workspace 兼容应用层、内部 Task command/query、不可变审计、Outbox/Graphile Worker、SSE、对象一致检查点和 Workspace 平台端口。
- Node.js 24/pnpm 11 CI，以及 PostgreSQL、migrate、API、Worker、Web、Gateway 六服务自托管 Compose 发布栈。

当前不包含：

- 完整 Project/Membership/Task 公共 HTTP CRUD 或正式任务管理 UI。
- macOS/Windows Workspace 本地物化、文件监听、真实目录同步或 GUI。
- Agent 写工具、操作提案 UI、完整 Agent Skill、Wiki、全文搜索、正式备份/恢复用户入口或摘要闭环。
- 公共 npm/容器制品发布、微服务、Redis、独立队列/搜索/对象服务、Kubernetes、高可用或跨地域容灾。
- 原型数据库业务记录的数据转换或恢复承诺。

## 2. 当前生效需求

| 当前编号 | 当前生效内容 | 验收要求与层级 | 来源 |
| --- | --- | --- | --- |
| FR-001 | 服务端维持 Identity、Projects/Membership、Roles、Tasks、Dependency Graph、Authorization/Audit、Workspaces、Agent Operations、Knowledge/Notifications 的模块归属；跨模块只通过应用服务、只读接口或已提交领域事件协作，不直接更新他方表。 | AC-020、AC-021 core；模块边界与应用组合可执行 | `requirements.md` |
| FR-002 | 正式 M0 Schema 可从空 PostgreSQL 重复建立；原型数据可通过独立、显式、可诊断且目标完全确认的入口破坏性重建，普通 migrate 不得隐式销毁。 | AC-001 core | `requirements.md` |
| FR-003 | Project Key 匹配 `[A-Z]{2,6}`、全局唯一、创建后不可变且归档不释放；内部关联使用不可猜测主键。 | AC-002 core | `requirements.md` |
| FR-004 | Task Key 由不可变 Project Key 与项目内事务性单调 Sequence 组成；允许间隙、不复用，并发与幂等重试只产生一个业务结果。 | AC-003 core | `requirements.md` |
| FR-005 | Task 使用同项目邻接树；拒绝自父、后代父和跨项目父子；顶层 Task 属于虚拟项目根且有活动显式 Owner。 | AC-004 core | `requirements.md` |
| FR-006 | 有效 Owner 来自当前 Task 或最近活动显式 Owner 祖先；循环、孤儿、跨项目、缺失或失活返回稳定诊断；完成继承 Owner 的 Task 时固化 Owner。 | AC-004、AC-011 core | `requirements.md` |
| FR-007 | 活动依赖只连接同项目、同一直接父级作用域的不同活动 Task；同向边唯一且无环；虚拟根与普通父级使用同一 DAG 语义。 | AC-005 core | `requirements.md` |
| FR-008 | 每个虚拟根或普通父级作用域恰有一个事务性 `graph_version`；改变活动图事实的操作锁定并递增全部受影响版本。 | AC-006、AC-008 core | `requirements.md` |
| FR-009 | 同时拥有两端或共同父 Task 的成员可直接修改合法依赖；只拥有一端时创建绑定端点、有效 Owner 与图版本的请求，由另一端 Owner 接受；事实变化使请求 stale。 | AC-007 core | `requirements.md` |
| FR-010 | Task 移动按稳定主键顺序锁定源/目标 graph scope，在锁内复核依赖、目标状态、树环、权限和版本；移动与依赖写共享互斥边界。移至虚拟根仍是 Task 结构操作，不得使用 Project Owner 对虚拟根依赖作用域的控制权绕过完整 Task 影响授权。 | AC-008、AC-014 core | `requirements.md`；change-1 RC-001 |
| FR-011 | Follow 只连接同项目不同 Task、同向唯一且可成环；只提供一跳发现，不改变 Owner、权限、依赖、状态、图版本或 Workspace 写资格。 | AC-009 core | `requirements.md` |
| FR-012 | 基础状态为 `not_started / in_progress / done`；`blocked` 由未解决人工 blocker 或未完成活动 predecessor 派生；直接子任务全部完成只产生父任务完成资格。 | AC-010 core | `requirements.md` |
| FR-013 | 完成前重查 Owner、子任务、predecessor、blocker、授权和版本；完成与 Owner 固化、Workspace 最终版本/快照、冻结和审计属于同一原子边界。 | AC-011、AC-016 core | `requirements.md` |
| FR-014 | 完成后冻结内容、Owner、结构、依赖、blocker 和 Task Workspace；只保留评论、显式重开和已完成顶层归档等明确例外。 | AC-012 core | `requirements.md` |
| FR-015 | 重开将 Task 恢复为 `in_progress` 并创建新 Workspace 工作周期，保留旧快照；`deny` 拒绝已完成 successor，`cascade` 精确覆盖完成 successor 闭包，跨 Owner 需要管理员能力和完整确认。 | AC-013 core | `requirements.md` |
| FR-016 | 移动、归档、删除、显式 Owner 变化、级联重开和 Follow 变化先计算稳定影响集合，覆盖适用的后代、依赖、状态、完成祖先、租约、未同步版本和 graph scope。Owner 变化的完整确认覆盖全部后代，并精确区分因显式 Owner 为空而实际继承目标 Owner 的受影响分支。 | AC-014 core | `requirements.md`；change-1 RC-002 |
| FR-017 | 授权只使用服务端解析的 user、membership、Project Owner、有效 Task Owner、admin session 与影响集合；确认不替代授权，租户查询包含服务端解析的 `project_id`。内部创建子任务端口必须重新校验父 Task 有效 Owner/admin；move-to-root 不得把虚拟根依赖控制权当作结构授权。 | AC-007、AC-014–AC-015、AC-026 core | `requirements.md`；change-1 RC-001、RC-003 |
| FR-018 | 所有 M0 公共 HTTP 位于 `/api/v1`，使用 TypeBox 运行时 Schema 并进入 OpenAPI 3.1；可重试操作幂等，资源写使用资源版本、图版本或等价条件。 | AC-017 core | `requirements.md` |
| FR-019 | HTTP 错误包含稳定机器码、可读信息、request ID 及适用的当前版本/恢复建议；领域/应用失败无歧义映射，不退化为无差别 500。 | AC-017 core | `requirements.md` |
| FR-020 | 关键成功和失败尝试写入不可变审计，包含 actor、agent type、project、target、request ID、时间、版本、结果和原因，不保存密码、token、lease secret 或不必要 Workspace 正文。 | AC-018 core | `requirements.md` |
| FR-021 | 每个 user、project、task 通过 `(scope_type, scope_id)` 恰有一个逻辑 Workspace；其生命周期、`sync_version`、work cycle、版本/快照单调且每周期最多一个有效写 lease。 | AC-015 core | `requirements.md` |
| FR-022 | Task 完成、重开、Owner 变化、冻结、快照和 lease revoke 使用 Workspace 应用端口与事务协调，不留下 Task/Workspace 半状态。显式 Owner 变化必须对所有实际继承受影响后代校验 Task/Workspace 版本与未提交状态，并在同一事务递增版本、创建 ownership-change 快照、切换 Owner 事实和撤销旧 lease；M0 不要求本地物化。 | AC-014、AC-016 core | `requirements.md`；change-1 RC-002 |
| FR-023 | Workspace 写授权保持 user self、Project Owner/Admin、有效 Task Owner 的产品矩阵；任何写仍需唯一有效 lease，读取与 Agent 额外意图限制独立表达。 | AC-015 core | `requirements.md` |
| FR-024 | 现有 `/api/v1` Identity、Pairing、Workspace 正式输入输出保持兼容；正式 Task 语义收敛不得静默改变这些接口。 | AC-019 core | `requirements.md` |
| FR-025 | Fastify/TypeBox/Kysely/OpenAPI、PostgreSQL recursive CTE/锁/并发、Graphile Worker/Outbox、对象一致检查点、Workspace 平台端口和 SSE cursor 六类技术选择均有可判定结论。 | AC-021 core | `requirements.md` |
| FR-026 | 共享包提供运行时契约、领域枚举和错误码；Web/CLI 不导入服务端领域服务或数据库实现，生产规则不只存在于 UI、fixture 或文档。 | AC-020 core | `requirements.md` |
| FR-027 | CI 覆盖格式、静态检查、构建、类型、自动测试和数据库迁移；Compose 覆盖构建、迁移、六服务健康与清理，不要求公共制品发布。 | AC-022–AC-023 core | `requirements.md` |
| FR-028 | 不提前暴露完整 Project/Task CRUD、正式 Task UI、本地 Workspace 同步或 Agent 写工具；内部端口不能成为绕过未来授权/确认的公共入口，包括 Repository 子任务创建必须消费服务端授权上下文。 | AC-020、AC-024 core | `requirements.md`；change-1 RC-003 |

## 3. 当前流程

### 3.1 建立或重建数据库

1. 操作者明确选择经确认可丢弃的目标，并提供与规范 `host:port/database` 完全相同的销毁确认。
2. `reset:m0` 警示破坏性边界并拒绝未知、未确认、prototype、unknown、ahead 或 incomplete 目标。
3. migrator 从空 PostgreSQL 17 建立正式 profile、`0001`–`0007` Schema 与约束。
4. 重复 migrate 为 no-op；API/Worker ready 只读正式 profile，不自动迁移。

### 3.2 创建 Project/Task 标识

1. 内部应用服务接收服务端授权上下文与幂等键。
2. Project Key 经过规范、唯一和不可变校验。
3. 创建子 Task 时，Repository 在分配 Sequence 前解析父 Task 有效 Owner，并要求父 Owner 或已验证管理员模式；顶层创建行为保持既有规则。
4. Task 在 Project 事务锁内分配下一个 Sequence 并组合 Task Key。
5. 并发或重试返回确定结果；授权拒绝不消耗 Sequence，回滚可留下间隙但编号不复用。

### 3.3 修改依赖或移动 Task

1. 服务端解析 Project、scope、端点、Owner、membership 和当前版本。
2. 依赖变更按两端所有权直接执行或创建另一端 Owner 接受的请求。
3. 移动和依赖写按稳定 scope ID 顺序取得相同锁，在锁内重查授权、版本、树与图事实；移至虚拟根仍按 Task Owner/完整影响集合授权。
4. 成功操作原子更新结构/边、graph version、审计与 Outbox；失败不留半状态。

### 3.4 Owner 变化、完成或重新打开 Task

1. Owner change 确认全部后代，并只把目标与显式 Owner 为空、实际继承目标 Owner 的分支列为 Owner/Workspace 写集合。
2. Owner change 稳定锁定受影响 Task/Workspace/lease，逐项校验版本和未提交状态，再同事务递增版本、创建快照、更新目标显式 Owner、撤销旧 lease、写审计与 Outbox。
3. completion 锁定并复核 Owner、子任务、predecessor、blocker、版本、授权与 Workspace；同事务固化 Owner、冻结 Task/Workspace、创建快照并撤销 lease。
4. reopen 根据 `deny / cascade` 和确定影响集合执行，创建新 work cycle 并保留旧快照。
5. 任何 Owner、Task/Workspace 版本、lease、未提交状态或影响确认漂移都稳定拒绝旧操作。

### 3.5 事件与客户端刷新

1. 请求事务提交 Outbox 后，Graphile Worker 以稳定 claim 和 outbox ID 幂等生成资源失效投影。
2. `/api/v1/events` 依据服务端 membership 过滤，使用 cursor/`Last-Event-ID` 重放。
3. 事件只通知 refetch；cursor 过期要求重新获取权威资源，不承载业务正文或 mutation。

### 3.6 工程与发布

1. CI 校验精确工具链、数据库环境和 frozen lock，然后执行双 migrate 与根 `pnpm check`。
2. Compose 构建 PostgreSQL、migrate、API、Worker、Web、Gateway，等待 Schema/runner/服务 health。
3. Gateway 是唯一宿主入口；API/Worker 无外部网络出口；持久卷承载数据库、对象、备份和 Caddy 数据。
4. smoke 验证重复 migrate、非 root、端口、卷、秘密和网络，最后精确 down/cleanup。

## 4. 当前数据、接口与状态

- `Project`：内部 UUID、不可变全局唯一 Project Key、`task_sequence`、唯一 Owner、reopen policy、状态、`recovery_epoch` 和乐观版本。
- `Task`：内部 UUID、项目内不可复用 Sequence/Task Key、父 Task、可空显式 Owner、内容/展示字段、基础状态、独立归档、版本与冻结事实。
- `SiblingTaskGraphScope`：Project 虚拟根或普通父级的唯一 scope 和单调 `graph_version`。
- `TaskDependency`、`TaskDependencyChangeRequest`、`TaskFollow`、`TaskBlocker`：分别承载同级 DAG、跨 Owner 接受、非权威一跳关注和人工阻塞。
- completion/transition snapshot、Workspace version 与 audit 为不可变记录；Outbox、资源失效投影和对象 checkpoint 可重建且不成为业务权威。
- Workspace 使用 `(scope_type, scope_id)` 唯一，分别维护 lifecycle、sync version、work cycle、不可变版本/快照和唯一有效 lease。
- 公共 HTTP 继续使用 `/api/v1`、TypeBox、OpenAPI 3.1、request ID 与统一错误体；M0 新 Task 能力默认只作为内部应用/Repository 端口。
- Worker 只消费已提交 Outbox；SSE 只读资源失效投影；Workspace Core 本地 replica 明确为 non-authoritative。
- 基础 Task 状态只保存 `not_started / in_progress / done`；`blocked` 为派生状态，archive 为独立生命周期。

## 5. 当前异常、边界、安全与恢复

- 非法 Project/Task Key、树环/孤儿/跨项目父子、跨父依赖、自环/重复边/DAG 环、缺失 Owner、冻结写、陈旧版本/请求、无效 lease 与幂等冲突均返回稳定诊断。
- 移动、依赖、completion、reopen 与 Workspace 协调失败整体回滚；failure audit 只在业务无变化或完整回滚后独立幂等记录。
- 所有项目访问使用服务端解析的 `project_id`；客户端声明、确认、admin mode 或 Agent intent 不替代授权或唯一 lease。
- 密码、device secret、access token、lease secret、Workspace 正文不进入普通日志、错误或审计元数据。
- API/Worker 运行时不调用外部 API、AI 或 LLM；Compose internal network 在运行时阻断其外部出口。
- 破坏性数据库重建只允许精确确认的可丢弃目标；未知目标立即停止。数据恢复边界为恢复代码并从空库重建，不承诺恢复原型业务记录。
- Outbox/Worker 和 SSE 可重试；cursor 过期重新获取权威资源；对象 checkpoint 只有在 manifest 与全部对象完整校验后原子发布。
- 回滚不得改写已完成阶段结果或 numbered history；`change-0.md` 后的产品变化必须进入新的 change run。

## 6. 当前非功能要求

- 正确性、授权和数据完整性优先于吞吐；并发正确性必须由真实 PostgreSQL 事务、锁和约束证明。
- 支持并验证 depth 20、200 direct siblings/DAG 与 5,000 active Tasks；这些是目标规模而非领域硬上限。
- 200-node 局部 DAG 读取参考目标 P95 `<800 ms`；未达精确目标只有在 core 正确性和无明显卡顿独立成立时才能成为 supplemental finding。
- 日志为结构化 JSON，区分诊断与审计，并包含时间、级别、request/job 关联、模块和稳定错误码。
- `/health/live` 与 `/health/ready` 分离；API/Worker ready 依赖正式 Schema，Worker ready 还依赖活动 runner。
- Node.js `24.18.0`、pnpm `11.9.0`、锁文件和 workspace 包边界保持权威。
- Compose 面向单台 Linux x86-64、自托管、内网/VPN 部署；应用非 root、只读根文件系统，Gateway 为唯一宿主入口。
- Identity、Pairing、Workspace、Web、Workspace CLI 和三个原型核心行为不得回归。

## 7. 当前验收要求

| 验收 | 层级 | 当前可观察通过条件 |
| --- | --- | --- |
| AC-001 | core | 精确确认的原型数据库可显式重建；空 PostgreSQL 建立完整正式 Schema，重复迁移无漂移，API/Worker 仅在 profile ready 后就绪。 |
| AC-002 | core | Project Key 只接受 2–6 位大写字母，全局唯一、不可变且归档不释放。 |
| AC-003 | core | 并发 Task 创建得到唯一单调且不复用的 Key；同幂等请求只返回一个 Task，回滚间隙可接受。 |
| AC-004 | core | Task 树同项目且无环；顶层 Owner 活动，子 Task 有效 Owner 精确解析，异常链稳定诊断。 |
| AC-005 | core | 虚拟根与普通父级依赖仅为同级活动 Task 的唯一无环边，非法边提交前拒绝。 |
| AC-006 | core | 每个 scope 恰有一个单调 graph version；活动图变化精确递增，旧请求因版本/Owner 变化 stale。 |
| AC-007 | core | 双端/共同父 Owner 可直接合法修改；单端必须由另一端 Owner 接受；无权、冻结或 stale 不能低层生效。 |
| AC-008 | core | 真实 PostgreSQL 下移动与依赖交错只形成一致前态或后态，无跨父边、树环、单边版本或半提交；移至虚拟根不能绕过 Task 结构授权。 |
| AC-009 | core | Follow 同项目、同向唯一并只展开一跳；Follow 环不递归且不改变任何权威写资格或图事实。 |
| AC-010 | core | blocked 仅由人工 blocker/活动 predecessor 派生；子 Task 完成不自动完成父 Task。 |
| AC-011 | core | completion 仅在全部前置成立时提交，并同事务固化 Owner、冻结 Task/Workspace、创建快照与审计。 |
| AC-012 | core | 完成后的内容、Owner、结构、依赖、blocker 和 Task Workspace 写均拒绝，明确例外保留。 |
| AC-013 | core | deny 精确拒绝完成 successor；cascade 精确重开闭包并创建新 work cycle，保留旧快照并拒绝跨 Owner/stale 确认。 |
| AC-014 | core | 结构/Owner/reopen/Follow 操作返回稳定完整影响集合；Owner 变化确认全部后代并精确处理实际继承受影响分支，授权与确认不遗漏 Workspace/lease 事实。 |
| AC-015 | core | user/project/task Workspace 唯一；读写矩阵、唯一 lease、sync version、work cycle 和不可变版本保持。 |
| AC-016 | core | Task 生命周期与 Workspace 在并发和故障注入下无半状态；Owner 变化在继承后代、逐 Workspace 版本、未提交状态、快照和 lease revoke 间原子。 |
| AC-017 | core | M0 公共 HTTP 均在 `/api/v1` 和 OpenAPI 3.1；运行时校验与稳定错误体覆盖已公开和内部适配失败。 |
| AC-018 | core | 关键成功/失败均有不可变可查审计，字段完整且不泄露秘密或 Workspace 正文。 |
| AC-019 | core | Identity、Pairing、Workspace、Web 与 Workspace CLI 核心兼容继续通过。 |
| AC-020 | core | 客户端不导入服务端实现，生产领域规则可由 M1/M2 直接复用；Repository 子任务创建不能绕过父有效 Owner/admin。 |
| AC-021 | core | 六类技术验证均明确通过或由替代 ADR 接管；Outbox/Worker 幂等，SSE cursor 可恢复。 |
| AC-022 | core | CI 完成 format、lint、build、typecheck、test 和数据库迁移，任何失败为非零。 |
| AC-023 | core | Compose 完成 migrate、PostgreSQL/API/Worker/Web/Gateway 启动与 health，无需公共发布。 |
| AC-024 | core | 不存在完整 Project/Task 公共 CRUD、正式 Task UI、本地同步或 Agent 写工具；现有内部创建端口不会成为授权绕过入口。 |
| AC-025 | core | depth 20、200-node sibling DAG、5,000 active Tasks 正确且无明显卡顿/超时。 |
| AC-026 | core | API/Worker 无外部 API/AI/LLM，租户过滤、秘密保护和 Workspace 单写者不退化。 |
| AC-027 | supplemental | 参考环境 200-node 局部 DAG read P95 `<800 ms`，或在 core 独立成立时记录合格性能 finding。 |
| AC-028 | supplemental | 超主体规模的确定性随机树/DAG seed 与并发调度未发现 core 外异常。 |
| AC-029 | supplemental | 锁/查询计划、SSE trace 或对象一致检查点等诊断进一步解释实现特征；缺少诊断不否定独立 core。 |

change-0 的 AC-001–AC-029 保持 `passed`；change-1 对 AC-008、AC-014、AC-016、AC-020、AC-024 的补充回归同样为 `passed`。没有开放 `FND-I-*` 或 `FND-C1-*`。

## 8. 当前决策

| 决策项 | 当前结论 | 来源 |
| --- | --- | --- |
| 交付与验证策略 | initial/change-0 使用 `relaxed`；change-1 使用用户显式选择的 `strict`，测试先行且全部范围内门禁阻塞 | 用户确认 / `requirements.md` / change-1 |
| 原型数据库数据 | 可丢弃；只允许对精确确认目标执行破坏性重建，不承诺保留或恢复 | 用户确认 / `requirements.md` |
| 工作流边界 | schema 3.2 `m0-domain-baseline` initial run 采用 `phased + expanded` 四阶段；change-1 采用一个 compact P-001 纠正阶段 | `workflow-contract.md` / `implementation-plan.md` / change-1 |
| 公共功能边界 | 只交付领域、应用、Repository 和契约入口，不开放完整 Project/Task CRUD 或业务 UI | `requirements.md` |
| Task 状态 | `not_started / in_progress / done` 基础状态，blocked 派生、archive 独立 | `requirements.md` |
| 公共兼容 | 保持 `/api/v1` Identity、Pairing、Workspace 正式输入输出 | `requirements.md` |
| 技术基线 | Fastify、TypeBox、Kysely、OpenAPI、PostgreSQL、Graphile Worker、SSE、内容寻址 Object Store 与 Workspace Core 端口均继续采用 | P-003/P-004 验证 |
| 发布边界 | CI、迁移、六服务 Compose 和 health 属于 M0；公共包/镜像发布与签名不属于 M0 | `requirements.md` |
| 基础设施 | 模块化单体、PostgreSQL、单机 Compose；不引入分布式基础设施或高可用 | `requirements.md` |
| 本地 Workspace | 只固定服务端契约和 UI 无关平台端口，不启用真实本地物化/同步 | `requirements.md` |

## 9. 已替换或退役项目

没有被 change-0 或 change-1 删除或替换的产品需求。原始 FR-001–FR-028 与 AC-001–AC-029 全部继续生效。

实现过程中被正式基线替代的原型实现细节（旧 Task 状态/宽 Project Key、可丢弃原型 Schema、合并 Web/Gateway 的旧 Compose 骨架）不是独立需求变更，不产生 `RC-*`；其替代依据和验证保留在 P-001、P-002、P-004 阶段结果中。

change-1 的 RC-001–RC-003 均为 `modify/clarify`：分别澄清虚拟根依赖控制权不等于 Task 结构移动权、Owner 变化必须原子覆盖实际继承后代 Workspace，以及内部子任务创建必须重新授权。它们没有删除既有能力或新增公共功能面。

## 10. 来源链

1. 原始产品权威：[`requirements.md`](requirements.md)，SHA-256 `844c505f9c6b15ae64f217026ba27c7c6ac22dd394f0ce80112a43960a8037d1`。
2. 工作流合同：[`workflow-contract.md`](workflow-contract.md)，schema `3.2`。
3. 初始路线图：[`implementation-plan.md`](implementation-plan.md)，revision 1，SHA-256 `eb90885df1246062d407f9284e015de0e0521d93e0e00f35ab5debc21af366ad`。
4. 执行权威：[`execution/initial/execution-state.md`](execution/initial/execution-state.md)。
5. 阶段计划：[`phase-001-plan.md`](execution/initial/phase-001-plan.md)、[`phase-002-plan.md`](execution/initial/phase-002-plan.md)、[`phase-003-plan.md`](execution/initial/phase-003-plan.md)、[`phase-004-plan.md`](execution/initial/phase-004-plan.md)。
6. 不可变阶段结果：[`phase-001-result.md`](execution/initial/phase-001-result.md)、[`phase-002-result.md`](execution/initial/phase-002-result.md)、[`phase-003-result.md`](execution/initial/phase-003-result.md)、[`phase-004-result.md`](execution/initial/phase-004-result.md)。
7. 初始实现记录：[`change-0.md`](change-0.md)。
8. change-1 计划与执行：[`change-plan.md`](execution/change-1/change-plan.md)、[`phase-001-plan.md`](execution/change-1/phase-001-plan.md)、[`execution-state.md`](execution/change-1/execution-state.md)。
9. change-1 不可变阶段结果：[`phase-001-result.md`](execution/change-1/phase-001-result.md)，SHA-256 `e6c173e55b2411a7f56f6e126a33dca49af5629a7692ad4be1ce027e57a4d657`。
10. 纠正实现记录：[`change-1.md`](change-1.md)。
