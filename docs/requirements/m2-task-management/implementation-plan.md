# M2 任务管理闭环实施路线图

## 1. 范围与执行模式

- 功能：`m2-task-management`
- 工作流 Schema：`3.2`
- 运行：`initial`
- 路线图修订：`1`
- 执行模式：`single`
- 计划细节：`expanded`
- 交付与验证策略：`relaxed`
- 需求指纹：`sha256:37f1e0c2a34c7578bdf2e3f55d0c47834353322ebd09cfc186fe14fc16685094`
- 项目基线：分支 `codex/m2-clarify-requirements`，提交 `39b779dd4f1347e89158a37554cdcd4ceeb773dd`
- 规划日期：`2026-07-29`

M2 采用一个完整阶段：当前没有公开 Task API 需要双轨兼容，也没有外部审批或独立交接；新增 Schema 可以作为非破坏性前向迁移，与领域、Repository、API、Worker 和最终验收在同一原子发布边界内完成。把实现层、验证或文档单独拆为阶段不会形成独立可交付结果。

计划使用 `expanded` 细节，因为本轮包含正式 PostgreSQL 前向迁移、Project/Membership/Task/Graph/Workspace/Worker 多个写入者、完成与 Owner 变化的跨模块事务，以及迁移应用后只能前滚或从已验证备份恢复的高恢复成本。扩展细节不改变单阶段结论。

规划开始时 `docs/requirements/m2-task-management/` 是用户已有的未跟踪目录，仅包含 `workflow-contract.md` 和 `requirements.md`，工作区没有其他差异。需求审计发现评论生命周期冲突后曾暂停；用户在 2026-07-29 明确选择“未完成 Task 中作者可编辑/删除本人评论，Task 完成后追加式不可变”，该决定已在冻结前写回需求。当前不存在 initial 路线图、执行状态、阶段结果或 `change-0.md`。

## 2. 项目现状与全局实现依据

- 正式数据库 profile 为 `m0-domain-baseline` version `2`，迁移前缀为 `0001`—`0008-m1-project-role-members`。Schema 检查会把非前缀、未知 profile 和未完成迁移 fail closed。
- `packages/domain` 已有 Task Key、树、同级 DAG、有效 Owner、影响集合、完成/重开、Workspace 生命周期和授权纯函数及测试；M2 需补齐字段规则、评论生命周期、`completion_ready`、通知和完整权限矩阵，不能在 route 中复制规则。
- `packages/contracts/src/tasks.ts` 已有内部 Task 摘要、图、影响集合和若干 command Schema，但仍携带内部 `actorType`/管理员上下文，尚不是面向已认证人类会话的完整公共资源契约。
- `packages/database` 已有 Task/Graph/Follow/Blocker、Task Workspace、完成/重开/Owner 变化、审计、Outbox 和故障注入事务；Task 的 `logical_role` 仍是历史字符串，M1 已把稳定 Project Role ID 的集成明确留给 M2。
- `apps/api` 已有内部 `TaskApplicationService`，但 `buildApp` 没有注册 Task routes；公开 Identity、Project/Membership、Roles、Admin Mode、Workspace 和 Events 已提供 Session、OpenAPI、稳定错误、审计和精确 audience 模式。
- `apps/worker` 当前把 Outbox 幂等投影为 `resource_invalidation_events`；尚无任务活动、`completion_ready`、评论或通知投影，也没有截止时间提醒来源。
- `packages/object-store` 与 Workspace Repository 已提供逻辑 Workspace、版本、清单、对象和租约基础。M2 只消费服务端端口，不加入本地路径、监听器或平台适配器。
- `packages/test-fixtures` 已有深树、同级 DAG、Owner/Workspace 和原型夹具，可以扩展为 5,000 Task、200 同级、深度 20、并发和生命周期验收数据。
- M1 的 Identity、Project/Membership、Role、Admin Mode、Web 治理、Workspace、审计、Outbox/SSE 和 Schema version 2 均为已冻结兼容基线；M2 不改写其 result、`change-0.md` 或 effective snapshot。
- 仓库要求 Node.js 24、pnpm 11、PostgreSQL 17。根 `pnpm ci` 已组合工具链预检、首次/重复迁移和 `pnpm check`，适合作为最终 core 工程门禁；数据库定向测试需要隔离的 PostgreSQL 17。

## 3. 全局详细设计

### 3.1 组件与依赖方向

1. `packages/contracts` 定义完整 Task、Graph、Impact、Workspace 状态、Comment、Activity、Notification、分页、写入命令、事件和稳定错误契约；公共输入不得包含可信 actor、Membership、Project ID 或管理员事实。
2. `packages/domain` 持有字段校验、有效 Owner、树/DAG、状态、完成/重开、影响集合、评论生命周期、通知触发和授权决策；它不依赖 Fastify、Kysely、Worker 或 Web。
3. `packages/database` 通过正式迁移、查询 Repository、命令 Repository、生命周期 Repository 和投影 Repository执行领域决定。跨聚合操作只能通过共享事务端口，禁止 route、Worker 或其他模块直接更新 Task/Workspace/成员表。
4. `apps/api` 的 Tasks、Dependency Graph、Workspaces、Authorization/Audit 和 Knowledge/Notifications 模块组合应用服务。公开 route 从现有 Session 解析人类 actor、活动 Membership、Project Owner 和当前 Admin Mode，再调用同一领域/Repository。
5. `apps/worker` 消费已提交 Outbox，幂等维护 Activity、`completion_ready` 和 Notification，并继续产生精确 audience SSE 失效。Worker 只维护可重建投影，不成为 Task、Comment、权限或 Workspace 的第二写入权威。
6. `packages/test-fixtures`、真实 PostgreSQL 集成测试和 API/Worker 测试共享确定性数据；`apps/web`、Workspace CLI 和本地 Workspace 平台能力只做兼容验证，不承载 M2 规则。

### 3.2 数据与迁移

- 新增唯一前向迁移 `0009-m2-task-management`，把正式 profile 从 version `2` 推进到 version `3`，保留 `0001`—`0008` 和全部现有 ID、Task Key、版本、Owner、Workspace、审计与 Outbox 事实。
- Task 正式化 `content`、`logical_role_id`、UTC `due_at`、标签、`normal/sprint/milestone`、归档/删除墓碑、版本和冻结约束；公共读写统一使用 Project Role ID。历史 `logical_role` 字符串只作为迁移来源/兼容证据，不再是公开权威。
- 历史非空 `logical_role` 只在同项目存在唯一精确名称匹配时确定性回填 `logical_role_id`；零匹配或多匹配让迁移以稳定诊断整体回滚，不静默清空、猜测或创建角色。新写入只接受同项目活动 Project Role ID；归档角色只保留历史绑定。
- 正式化 Comment 源事实。未完成 Task 中作者更新使用 comment/task version 并保留 `edited_at`；作者删除留下不含正文/附件的稳定 tombstone 和动作审计。Task 完成事务与评论更新/删除共享 Task 行锁，完成提交后所有既有及新增评论均只可追加；管理员隐藏单独保存原文、操作者、原因和审计。
- 新增可重建的 Activity、Notification、Notification Preference、已读状态和 `completion_ready` occurrence/去重数据。关键通知没有可关闭偏好；非关键偏好不得影响权限、破坏性结果或 `completion_ready`。
- 所有外键包含 Project 作用域或由事务显式验证租户一致性；常用列表、parent scope、Task Key、Graph scope、Activity cursor、Notification recipient/status 和 due reminder 建立稳定排序索引。
- 空库、正式 version 2 数据、重复 migrate 和异常数据回滚都必须在 PostgreSQL 17 证明。迁移不得调用 reset；Kysely down 只保留开发契约，不作为生产恢复路径。

### 3.3 公共接口与应用边界

- Task 路由族使用 `/api/v1/projects/:projectKey/tasks`，提供活动/归档列表、指定 parent 的直接子任务、详情、创建和字段更新；分页使用稳定 cursor，返回显式/有效 Owner、继承来源、状态、统计、Graph、Workspace 服务器状态和当前调用方 `actions`。
- Task 子资源/动作覆盖 Owner 预览与提交、Dependency/Request 处理、Follow、Blocker、状态、完成、重开、移动、归档、删除和影响预览。所有写入携带适用 Task/Graph/Workspace 版本、幂等键、影响指纹或完整 Task Key。
- Comment 路由提供列表、创建、作者更新/删除和管理员隐藏；Activity 路由只读分页；Notification 路由提供列表、已读状态和非关键偏好。资源与 action 命名保持 OpenAPI 3.1 可发现，不暴露内部 actor 或 Repository 形状。
- 公开输入只接受 Project Key/Task Key 或被 route 解析的资源标识。服务端从 Cookie Session 解析 user，从资源解析 Project/Membership，并从有效 Admin Mode session 解析管理能力；客户端传入的 `user_id`、`project_id`、Membership、Owner 权威、`actorType` 或管理员布尔值必须被 Schema 拒绝。
- 现有内部 Agent actor 端口保持非公开，继续使用相同应用/领域服务；M2 不注册 MCP、Agent 写 route 或 `propose -> confirm -> execute`。
- 错误继续使用稳定机器码、中文消息、request ID、当前版本和恢复建议；无权/不存在/跨租户响应不得枚举其他项目资源。

### 3.4 授权、安全与信任边界

- 所有读取要求活动用户和活动 Membership；Activity、Comment、Notification、Workspace 引用和 SSE 都按服务端资源关系重新授权。
- 普通模式只允许有效 Owner 管理自身内容，但有效 Owner 对任意后代保留显式 Owner 分配权；父 Owner 不因此获得他人任务内容、状态、层级或 Workspace 写权。
- Dependency 直接修改、请求接受、虚拟根控制、Follow、移动、归档、删除和级联重开都消费完整当前事实与影响集合。有效管理员模式扩大 Task 管理能力，但不能写他人 Task Workspace、绕过冻结、精确 Key、唯一租约或未来 Agent 确认。
- Comment/Workspace/角色文本都是不可信输入。普通日志、审计 metadata、Outbox/SSE 引用不得包含密码、token、lease secret、完整评论正文或 Workspace 正文。
- Comment 作者删除清除公开正文和附件引用，仅保留 tombstone 元数据；管理员隐藏保留受限原文是明确的治理审计路径，不能通过普通 Activity/SSE 泄露。

### 3.5 事务、锁序、并发与幂等

- 跨模块写入沿用并扩展稳定锁序：`Project → Membership（稳定 ID）→ Task/Graph Scope（稳定 ID）→ Workspace/Lease → Comment/投影源事实 → Audit/Outbox/Idempotency`。同一事务内不得以不同顺序锁定相同集合。
- 创建 Task 同事务分配 Key、写 Task/子图作用域、创建唯一逻辑 Workspace、审计、幂等记录和 Outbox。
- Dependency、移动、归档、删除共享适用 Graph scope 锁和 `graph_version`；Owner 变化、完成、重开共享 Membership/Task/Workspace/Lease 锁及版本。提交前重新计算权限、冻结、影响和 Workspace 状态。
- Task 完成与 Comment 更新/删除锁同一 Task，保证结果只能是“评论修改先提交后随 Task 冻结”或“Task 先完成后评论修改稳定拒绝”。
- 成员移除继续复用 M1 的 Membership 串行化边界；Task 创建/Owner 变化/重开不能与移除并发产生非活动有效 Owner 或遗留租约。
- 每个 mutation 的幂等记录绑定 actor、operation、key 和规范请求摘要；相同 key/相同请求返回同一结果，不同请求稳定冲突。失败审计只在业务事务无变化或完整回滚后独立幂等写入。

### 3.6 Activity、`completion_ready`、通知、Worker 与 SSE

- 业务事务只写权威 Task/Comment/Workspace 事实、Audit 和 Outbox。Worker 按 Outbox ID 幂等 upsert Activity、重算受影响 Task/父 Task 的 `completion_ready`、创建去重 Notification，并生成/复用 Resource Invalidation cursor。
- `completion_ready` 使用直接启用子 Task、活动 predecessor、未解决 blocker 和相关版本形成条件指纹。`false → true` 为当前有效 Owner 创建一次 occurrence/通知；条件失效后再次满足形成新的指纹和通知；它从不写 `done`。
- Owner 指派/有效 Owner 变化、blocker、Dependency 请求/处理、Comment/mention、截止时间、完成资格和破坏性/权限结果按稳定 event type 映射通知。截止时间提醒由 Worker 使用稳定 occurrence key 生成源事件/Outbox，重启或重试不重复。
- Activity 使用时间、事件 ID 的稳定顺序和 cursor 分页；投影可以从权威数据库与保留的 Outbox 重建。重建不会重放业务 mutation，也不会制造重复通知。
- SSE 继续只发送资源失效或增量引用。Project audience 在读取时重新验证活动 Membership，user audience 只匹配本人；cursor 过期返回现有稳定恢复语义。

### 3.7 可观测性、兼容、发布与恢复

- API/Worker 继续输出结构化 JSON 日志和稳定错误码，保留 request/job 关联；`/health/ready` 只有 profile version `3` 和 Worker runner 就绪时返回 ready。
- Identity、Pairing、Device、Project/Membership、Roles、Admin Mode、Workspace、Events、Web 治理和 Workspace CLI 的既有公开契约保持。M2 不增加正式 Task Web UI，不修改本地 Workspace 路径/同步语义，不引入外部 API、AI/LLM、Redis、搜索服务或新部署组件。
- 一阶段内可以按任务逐步提交代码，但在 `0009`、全部公共 routes、Worker 投影和 core 门禁完成前不得部署或声称 M2 可用；不存在半成品公共兼容期。
- 应用 `0009` 前要求部署者具备已验证数据库/对象备份。应用后生产回退只允许修复前滚，或恢复迁移前的一致备份并运行旧应用；禁止自动 down/reset。迁移中异常依赖 PostgreSQL 事务完整回到 version `2`。
- 代码层部分实现可通过版本控制恢复；任何任务中断都先记录当前执行状态、实际文件和已运行验证，再继续或回退，不猜测迁移是否完成。

## 4. 阶段路线图

| 阶段 | 目标 | 关联需求与验收 | 前置阶段 | 退出条件 | 当前状态 |
| --- | --- | --- | --- | --- | --- |
| P-001 | 从 M1 version 2 建成完整 M2 服务端 Task 闭环：正式 Schema/领域/Repository、公共 API、评论/活动/通知、Worker/SSE、Workspace 原子边界及最终验收 | FR-001–FR-032；AC-001–AC-020 | 无 | `0009` 前向/重复/失败回滚、全部 core 行为与并发/安全/兼容门禁、公共 OpenAPI、Worker 幂等、根工程和适用发布检查通过；supplemental 结果完成分级与 finding 汇总；项目保持可发布且无半迁移 | ready |

## 5. 跨阶段依赖与不变量

当前只有 P-001；以下是不允许在任务间暂时削弱的全局不变量：

- 正式 Schema 始终是完整已识别前缀；迁移前 version `2` 可运行，迁移后 version `3` 可运行，未知或中间状态 fail closed。
- 每个 Task 的 Project、Key、父级、有效 Owner、Graph scope 和唯一逻辑 Workspace 保持一致；Task Key 不复用，Project/Task 跨租户引用无效。
- 普通模式、有效管理员模式、完成冻结、Graph/Task/Workspace 版本、完整影响确认、评论生命周期和唯一租约在每个生产写入口都执行。
- Task/Workspace/Comment 源事实、成功审计、Outbox 和幂等记录同事务提交；失败只留下独立且无敏感正文的失败审计。
- Worker 投影可重建、可重试且不成为第二写入权威；SSE audience 不跨 user/project 泄露。
- M0/M1 冻结证据、既有公共接口、Web 治理和 Workspace CLI 持续兼容；M3/M4/M5/M6 范围不得提前混入。
- 未经 core 与硬门禁通过不得完成阶段；任何产品影响未知的 supplemental 异常按 core 阻塞处理，不能在失败后降级。

## 6. 最终集成与整体验证流程

验证只在最后仍有效的位置执行，失败时才做有界诊断重跑：

1. 领域/契约定向验证：Task 字段、Owner/权限、树/DAG/状态/影响、Comment 生命周期、Notification 触发和运行时 Schema；禁止客户端 actor/admin 注入。
2. PostgreSQL 17 数据与事务验证：空库、正式 version 2 前向迁移、重复 migrate、旧角色字符串唯一回填、异常/歧义回滚、约束/索引、并发和故障注入；核对 ID/Key/版本/Owner/Workspace/Audit/Outbox 保留。
3. API/Worker 集成验证：全部 `/api/v1` Task/Comment/Activity/Notification 路由、OpenAPI、分页/actions、跨租户与非活动 actor、评论完成竞态、投影重试/重建、`completion_ready`、提醒、精确 SSE 和稳定错误。
4. 规模与正确性验证：深度 20、200 直接子 Task、200 节点 DAG、5,000 活动 Task 的递归、排序、分页、授权和无硬限制；这是 core 正确性，不以 P95 替代。
5. 最终工程门禁：在隔离 PostgreSQL 17 上运行根 `pnpm ci`，一次覆盖工具链预检、首次/重复 migrate 和根 `pnpm check`，避免重复执行等价全套。仅当本轮实际修改 Compose/Docker/发布脚本时再运行 `pnpm compose:smoke`。
6. Supplemental：在参考服务器测量列表/详情、普通创建/更新和 200 节点 DAG P95；额外浏览器或广泛压力只在已有环境和明确价值下执行。仅可独立证明不影响任何 core、可用性或硬门禁的异常登记为稳定 `FND-I-*` report-only finding。
7. 完成前核查 AGENTS.md、README 和活动正式设计文档是否因 Schema、模块职责、命令或里程碑状态而失真；需要时只更新活动文档，不改写 M0/M1 或原型封存证据。

## 7. 需求追踪矩阵

| 需求/验收组 | 阶段 | 实现与验证 |
| --- | --- | --- |
| FR-001；AC-001 | P-001 | `0009`、profile version 3、历史角色确定性回填、空库/前向/重复/异常回滚和数据保留 |
| FR-002–FR-005；AC-002 | P-001 | 公共 TypeBox/OpenAPI、Session actor、分页读取、Task 创建/字段与逻辑 Workspace 原子创建 |
| FR-006–FR-008；AC-003–AC-004 | P-001 | 有效 Owner/后代指派、Workspace/Lease 原子变化及 M1 成员移除串行化兼容 |
| FR-009–FR-010；AC-005 | P-001 | 同级 DAG、虚拟根、变更请求、Graph version、权限/冻结/环检测和并发 |
| FR-011；AC-006 | P-001 | Follow mutation 与一跳、原权限范围内的上下文发现契约 |
| FR-012–FR-018；AC-007–AC-009 | P-001 | 状态/blocker、`completion_ready`、显式完成、快照/冻结、deny/cascade 重开和工作周期 |
| FR-019–FR-023；AC-010–AC-011 | P-001 | 移动/归档/删除、稳定影响与完整 Key、Task Workspace 清单/版本/租约/快照原子边界 |
| FR-024–FR-026；AC-012 | P-001 | 作者可变/完成后不可变评论、管理员隐藏、Activity 和关键站内 Notification |
| FR-027–FR-028；AC-014 | P-001 | 成功/失败 Audit、事务 Outbox、Worker 幂等/重建和精确 audience SSE |
| FR-029–FR-031；AC-013、AC-015–AC-016 | P-001 | 版本/幂等/稳定错误、完整权限矩阵、人类公共 actor、内部 Agent 端口非公开和既有接口兼容 |
| FR-032；AC-016、AC-018 | P-001 | 模块依赖、M0/M1/Web/CLI 兼容、无外部运行时依赖和最终工程/发布门禁 |
| 非功能规模要求；AC-017 | P-001 | 深度 20、200 同级/DAG、5,000 活动 Task 的确定性正确性、分页和索引证据 |
| 性能目标；AC-019 supplemental | P-001 | 参考服务器三类 P95；仅无交付影响的偏差可 report-only |
| 附加置信度；AC-020 supplemental | P-001 | 有价值时的额外浏览器/压力/诊断；不得替代或弱化 core 证据 |

## 8. 风险、技术决策与修订记录

### 风险与门禁

| 风险 | 影响 | 控制与恢复 |
| --- | --- | --- |
| `0009` 破坏 version 2 数据或旧 `logical_role` 含义 | 无法升级或历史角色被静默改写 | 唯一名称匹配回填；零/多匹配整体回滚；前向/重复/异常迁移和数据清单为 core |
| 低层 Repository 绕过 Owner/Admin/冻结/影响 | 跨成员越权或不可恢复删除 | 领域决策 + Repository 负向测试；每个 mutation 建立授权/版本矩阵，route 不直接写表 |
| 多写入者锁序不一致 | 死锁、移除/Owner/Graph/Workspace 半状态 | 固定全局锁序、真实并发和故障注入；任何半状态阻塞阶段 |
| Comment 编辑与 Task 完成竞态 | 完成后内容仍被改写 | 共用 Task 行锁和 version；只允许完整先后态 |
| Worker 重试重复 Activity/通知 | 噪声、错误完成资格或跨受众泄露 | Outbox/occurrence 唯一键、幂等 upsert、重建和 audience 负向测试 |
| 公开 route 接受 actor/admin 声明 | 人类客户端伪造 Agent 或管理员 | 公共 Schema 不含可信字段，Session/资源服务端推导，未知字段拒绝 |
| 归档/删除穿透完成冻结 | 不可恢复数据损失 | 影响预览、Graph/Task/Workspace 版本、完整 Key、完成端点负向测试和备份前置 |
| 单阶段工作量大导致中断 | 部分代码或迁移状态难恢复 | expanded 阶段计划、逐任务 checkpoint、未完成不部署、执行状态记录实际 diff/验证 |

### 技术决策

- `TD-001`：采用 `single + expanded`。单阶段由无旧 Task 公共 API、无外部交接和可原子发布支持；迁移、多写入者和恢复成本要求扩展细节。
- `TD-002`：正式迁移命名 `0009-m2-task-management`，profile version 推进到 `3`；生产不提供自动 down/reset。
- `TD-003`：公共 Task 角色只使用稳定 `logical_role_id`。历史字符串只在同项目唯一精确名称匹配时回填，歧义/缺失 fail closed。
- `TD-004`：公共 route 只接受人类 Session；内部 Agent actor 端口保留但不注册公共入口。
- `TD-005`：Activity、`completion_ready` 和 Notification 是 Outbox 驱动的可重建投影；Task/Comment/Workspace/Audit/Outbox 是权威事实。
- `TD-006`：作者删除未完成 Task 评论留下无正文 tombstone；管理员隐藏保留受限原文。两者都保留不含正文的动作审计。
- `TD-007`：Task 完成与 Comment 更新/删除共享 Task 锁，完成后评论只追加；该并发结果属于 core。
- `TD-008`：最终全工程验证以一次 `pnpm ci` 覆盖迁移与 `pnpm check`；Compose 仅在实际发布栈 diff 时追加。

### 修订记录

| 修订 | 日期 | 原结论与变更 | 原因与依据 | 影响阶段 | 追踪影响 |
| --- | --- | --- | --- | --- | --- |
| 1 | 2026-07-29 | 创建单阶段、expanded、relaxed initial 路线图；纳入用户选择 B 的评论生命周期 | schema 3.2 需求审计、M1 version 2 项目事实、用户对 Q-001 的明确回答 | P-001 | FR-001–FR-032、AC-001–AC-020 全部映射；AC-012 固定作者编辑/删除与完成后不可变语义 |
