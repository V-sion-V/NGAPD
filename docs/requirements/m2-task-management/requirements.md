# M2 任务管理闭环需求

## 背景与目标

NGAPD 已完成 M0 领域基线和 M1“项目、角色和成员”闭环。M0 已提供正式 Task 树、有效 Owner、同级 DAG、生命周期、影响集合、Task Workspace 原子协调、内部应用服务与 Repository 基线，但刻意没有公开完整 Task HTTP 能力、正式任务管理界面、Agent 写工具、评论/通知闭环或 `completion_ready` Owner 通知。M1 已交付活动项目成员、唯一 Project Owner、管理员模式、逻辑角色与成员移除前的未完成有效 Task Owner 阻塞规则。

M2 的目标是把现有内部 Task 基线提升为可由已认证项目成员通过正式 `/api/v1` 调用、可审计、可并发保护、可由 Outbox/SSE 驱动客户端刷新的服务端任务管理闭环，并完成任务级逻辑 Workspace 的服务端原子边界、评论、活动流和关键站内通知。M2 必须为 M3 正式 Task UI、M4 本地 Workspace 同步平台适配器、M5 Agent/Skill 和 M6 完成摘要/Wiki 提供稳定契约，但不得提前把这些后续里程碑的界面或工具混入本轮。

目标用户是活动项目成员、Project Owner，以及明确进入有效管理员模式的 Project Owner/Project Admin。可观察结果是这些调用方能够在服务端完整读取和管理递归任务、同级依赖、责任归属、状态、阻塞、关注、评论与任务生命周期，且任何跨 Owner、高影响或并发写入都不能绕过同一套领域、权限、审计和 Workspace 一致性规则。

## 范围

### 包含范围

- 正式 Task Schema 增量迁移、共享运行时契约、领域规则、Repository、应用服务和 `/api/v1`/OpenAPI。
- 多层任务树、当前层级读取、任务详情，以及标题、统一 Markdown 正文、可选逻辑角色、UTC 截止时间、标签和展示类型。
- 显式 Owner、最近祖先继承得到的单一有效 Owner、后代 Owner 指派/清空，以及 M1 成员移除阻塞规则的跨模块集成。
- 同级依赖、每父级 `graph_version`、跨 Owner 依赖变更请求、接受/拒绝/过期/失效和环检测。
- 任务关注及只展开一跳的 Agent 上下文发现服务端契约。
- 基础状态、派生有效状态、人工 blocker、`completion_ready` 投影与去重 Owner 通知、显式完成、完成冻结和 `deny / cascade` 重新打开。
- 任务级逻辑 Workspace 的服务端清单、版本、唯一写租约、工作周期、完成/Owner 变化快照，以及 Task/Workspace 原子协调；不包含真实本地目录同步。
- 任务移动、顶层归档、要求完整 Task Key 的非顶层不可恢复删除和稳定影响预览。
- Markdown 评论、不可变评论、管理员隐藏、任务活动流和关键站内通知。
- 成功与失败审计、事务 Outbox、Worker 投影、精确 audience SSE 失效事件、幂等和乐观并发。
- 与 M0/M1、Identity、Project/Membership、Roles、Workspace 和现有 Web 治理入口的兼容性。

### 不包含范围

- M3 的正式平铺树状 Task Web UI、生产级 DAG 布局、面包屑、筛选、搜索定位和 200 节点浏览器交互；现有夹具驱动 Task UI 原型继续封存为证据，不直接转为生产权威。
- M4 的 macOS/Windows 本地物化、文件监听、真实目录差异扫描、冲突选择和平台适配器。
- M5 的标准 Agent 工具服务、`propose -> confirm -> execute` 公开工具协议、NGAPD Skill 或 Agent 宿主集成。M2 只保留后续工具必须复用的应用服务、授权和上下文发现契约。
- M6 的 Agent/人工完成摘要、KnowledgeEntry、`SUMMARY.md` 投影、Wiki、全文搜索、项目备份和恢复用户闭环。M2 的完成快照必须保留 M6 所需来源边界，但不得调用外部模型或伪造摘要交付。
- 语义缩放、无限画布、跨父级依赖、自定义字段、自定义状态机、预计工时、任务回收站、单任务恢复、项目永久删除、外部通知渠道、Git 平台深度集成和移动端原生客户端。
- Redis、独立搜索/对象服务、微服务、Kubernetes、高可用或为大规模容量预建的基础设施。

## 已确认的项目事实与约束

- [总体实施路线](../../07-roadmap-and-validation.md)将 M2 定义为服务端任务管理闭环，将正式平铺树状界面、Workspace 平台适配器、Agent/Skill 和摘要/Wiki 分别留给 M3、M4、M5、M6。
- [产品需求](../../01-product-requirements.md)、[领域模型](../../02-domain-model.md)、[权限模型](../../03-permission-model.md)、[系统架构](../../04-system-architecture.md)、[Workspace 设计](../../05-workspace-context-wiki.md)和[Agent 集成](../../06-agent-integration.md)已经确定 Task 字段、树/DAG、Owner、权限、状态、完成、冻结、归档/删除、工作区和 Agent 确认边界。
- M0 当前有效需求明确：正式 Task 领域、数据库、内部应用服务和 Task/Workspace 原子协调已经存在；公开完整 Task HTTP、评论/通知闭环与 `completion_ready` Owner 通知仍属于 M2，不得把 M0 内部端口直接暴露为绕过授权的公共入口。
- M1 已交付正式 Schema version 2/`0008-m1-project-role-members`、`/api/v1`/OpenAPI、不可变审计、精确 audience Outbox/SSE 和中文治理 Web；M2 必须采用非破坏性向前迁移并保持现有 M1 行为兼容。
- Project Owner 由 `Project.owner_membership_id` 唯一表达；Membership 权限只有 `admin / member`。管理员资格不等于管理员模式，Project Admin 只有在有效管理员模式下才获得跨任务管理能力。
- Task 最多保存一个可空显式 Owner；顶层 Task 必须有活动显式 Owner。非顶层 Task 显式 Owner 为空时继承最近一个显式 Owner 非空祖先的 Owner。任一 Task 的有效 Owner 可为任意后代即时设置显式 Owner，无需接收者接受。
- 成员移除前必须阻塞于目标 Membership 当前有效拥有的任一未完成 Task；成功移除只更新 Membership 并撤销能力/租约，不清空或改写 Task Owner。
- Task Key 在项目内事务性单调分配、允许间隙、永不复用；Project Key 和 Task Key 均不可修改。
- 依赖只能连接同一直接父级下的活动未完成 Task；顶层 Task 使用虚拟项目根作用域。每个作用域维护独立 `graph_version`，依赖、移动、归档和删除共享适用的锁与版本边界。
- 基础状态只保存 `not_started / in_progress / done`；`blocked` 由未完成 predecessor 或未解决人工 blocker 派生。直接子任务全部完成只让父任务变为可完成，绝不自动完成。
- 完成会固化继承得到的 Owner，冻结任务字段、Owner、结构、依赖、阻塞和任务级 Workspace，并创建不可变快照；重新打开创建新工作周期并保留历史快照。
- Workspace 的服务端生命周期、本地副本状态和连接/租约状态分别建模。每个 Task 恰有一个逻辑 Workspace，每周期最多一个有效写租约；只有有效 Task Owner 可写，其他活动项目成员只读。
- 任务关注只展开一跳，不授予写权限，不递归展开被关注任务的关注关系，也不参与依赖、状态、完成、图版本或排期。
- 评论正文使用 Markdown；附件只引用当前用户有权读取的 Workspace 文件。未完成 Task 中，作者可以编辑或删除自己的评论；Task 完成后评论采用追加式记录，发布后不可编辑或删除。有效管理员模式只能隐藏评论并保留审计副本。
- MVP 通知只提供站内渠道；权限和破坏性操作通知不可关闭。服务端运行时不得调用外部 API、AI 或 LLM。
- 初期按少于 10 名用户、单项目 5,000 活动任务、单父级 200 直接子任务和深度 20 验证；这些是验收规模，不是领域硬限制。
- Node.js 24、pnpm 11、Fastify 模块化单体、PostgreSQL 17、Kysely、TypeBox、REST/OpenAPI、Graphile Worker、SSE 和单机 Docker Compose 是当前技术与发布基线。

## 交付与验证策略

- 本次 initial run 的交付与验证策略为 `relaxed`，来源是用户在 2026-07-29 的明确选择。
- relaxed 允许实现先于测试，但所有 `core` 验收、受影响范围正确性、安全、隐私、数据完整性、公共兼容性、构建能力、恢复安全和项目/发布硬门禁仍是阻塞项。
- 只有被独立证明确实不影响已交付行为的 `supplemental` 异常，才可以按严重程度登记为 `FND-I-*` report-only finding；`critical`/`high`、安全/隐私/数据/兼容性、构建或运行时、未知影响、硬门禁或未被独立证明的 core 问题始终阻塞。
- 不得在失败后把验收项从 `core` 降为 `supplemental`。对产品影响不确定时按 `core` 处理。
- 验证应与风险相称：至少覆盖受影响包的测试/类型检查、真实 PostgreSQL 迁移与事务集成、公共契约/OpenAPI、审计/Outbox/SSE 和根工程门禁；修改发布栈时还必须验证适用的 Compose 门禁。

## 功能需求

- `FR-001` 系统必须从当前 M1 Schema version 2 通过非破坏性、可重复、可诊断的正式迁移建立 M2 Task 数据结构、约束和索引；不得要求 reset，不得丢失或重写现有 Project、Membership、Role、Task、Workspace、审计或 Outbox 事实。
- `FR-002` 所有正式 Task HTTP 能力必须位于 `/api/v1`，使用 TypeBox 运行时 Schema并进入 OpenAPI 3.1；客户端不得声明可信 `user_id`、`project_id`、Owner、管理员状态或 actor type，服务端必须从认证会话和资源关系解析。
- `FR-003` 活动项目成员必须能够读取项目的活动/归档任务树、指定父级的直接子任务与同级依赖、单个任务详情、显式/有效 Owner 及继承来源、基础/有效状态、直接子任务统计、阻塞、关注、评论、活动和当前调用方可用 `actions`。
- `FR-004` 新建 Task 必须事务性分配不可复用 Task Key 并同时建立任务级逻辑 Workspace。顶层 Task 必须指定活动显式 Owner；子 Task 可指定任意活动成员或留空继承有效 Owner。幂等重试只能产生一个业务结果。
- `FR-005` 未完成、未归档 Task 的有效 Owner或有效管理员模式必须能够按权限修改标题、统一 Markdown 正文、可选项目逻辑角色、可选 UTC RFC 3339 截止时间、标签和 `normal / sprint / milestone` 展示类型；归档角色不得用于新绑定，展示类型不得改变业务语义。
- `FR-006` 任一 Task 的有效 Owner 必须能够为任意未完成后代设置或替换活动显式 Owner；非顶层显式 Owner 必须能够清空自己的显式 Owner并回落给最近祖先，顶层显式 Owner不得清空。变化必须展示并确认全部受影响后代、Workspace、租约和未同步状态。
- `FR-007` 显式 Owner 变化必须原子更新 Task/受继承影响后代的有效责任事实、Task/Workspace 版本、ownership-change 快照和旧租约撤销；旧有效 Owner 立即失去写资格，新有效 Owner 只能在变化提交后申请租约。失败不得留下半状态。
- `FR-008` M2 必须继续消费 M1 的成员移除预览与阻塞事务：存在目标成员有效拥有的任一未完成 Task 时返回稳定 Task 清单并拒绝；成功移除不得清空、重写或删除任何 Task Owner 或历史引用。
- `FR-009` 系统必须允许在同父级作用域内添加或移除唯一、有向、无环依赖。当前用户拥有两端或共同直接父 Task 时可直接修改；顶层依赖由 Project Owner 作为虚拟根控制者直接修改；只拥有一个端点时必须建立绑定两端 Owner 和当前 `graph_version` 的变更请求，由另一端有效 Owner 接受后才生效。
- `FR-010` 依赖变更请求必须支持接受、拒绝、过期和因 Owner/端点/图版本变化而失效；任何完成、归档、跨父、重复、自环、成环、无权或陈旧变更都必须在提交前稳定拒绝，且不能通过 Repository 或低层 API 绕过。
- `FR-011` 未完成、未归档 source Task 的有效 Owner或有效管理员模式必须能够添加/移除同项目不同 Task 的单向关注。关注只允许服务端上下文发现契约返回一跳目标引用和当前用户原本有权读取的数据范围，不得递归、扩权或改变任何 Task/图/Workspace 权威事实。
- `FR-012` Task 基础状态必须支持 `not_started -> in_progress -> done` 的合法转换；有效状态必须在存在未完成活动 predecessor 或未解决人工 blocker 时派生为 `blocked`。有效 Owner或有效管理员模式必须能够添加和解决带原因的 blocker，成功写入必须递增 Task 版本。
- `FR-013` 系统必须维护可重建、幂等的 `completion_ready` 投影。只有直接启用子 Task 全部完成、全部活动 predecessor 完成且不存在未解决 blocker 时才为 true；从不满足首次变为满足时必须向当前有效 Owner 产生一次站内通知，同一完成条件版本不得重复，条件失效后再次满足可产生新通知。
- `FR-014` `completion_ready` 不得自动完成 Task。只有有效 Owner或有效管理员模式显式完成且所有条件、Task 版本、图版本和 Workspace 版本仍匹配时才可提交完成。
- `FR-015` 完成事务必须在适用时使用最终已提交 Workspace 服务端版本，固化继承得到的显式 Owner，创建不可变完成快照，更新 Task/Workspace 为冻结状态，释放或撤销写租约，并写入审计和 Outbox；任一步失败必须整体回滚。
- `FR-016` 已完成 Task 的标题、正文、截止时间、角色、标签、展示类型、Owner、父子关系、依赖、blocker 和任务级 Workspace 必须冻结。仍允许活动成员发表评论、显式重新打开，以及对已完成顶层 Task 执行归档。
- `FR-017` 重新打开必须把目标恢复为 `in_progress`、创建新的 Workspace 工作周期并保留旧快照。已完成祖先必须先显式重开。项目策略 `deny` 必须拒绝存在已完成 successor 的目标；`cascade` 必须原子重开完整已完成 successor 闭包，跨 Owner 时要求有效管理员模式和完整影响确认。
- `FR-018` 历史 Owner 已不再活动时，重新打开提案必须同时指定活动显式 Owner；Task、Owner、Workspace、工作周期、图版本或影响集合发生变化时，旧操作必须返回稳定 stale/conflict 结果。
- `FR-019` 未完成 Task 的移动必须先返回稳定影响预览，并要求源/目标结构权限、无活动依赖、目标父 Task 未完成、目标不在自身子树和源/目标图版本匹配。成功必须按稳定顺序锁定两个作用域并原子移动、递增版本、审计和发出事件。
- `FR-020` 只有顶层 Task 可归档且不提供恢复；归档保留任务、子树、Workspace、评论、摘要来源引用、审计和依赖历史，但整个子树退出活动计算，相关依赖失效并递增适用图版本。
- `FR-021` 只有未完成非顶层 Task 可执行不可恢复删除；删除包含全部后代及其活动依赖和 Workspace 业务内容，保留 Task Key 墓碑和不可变审计。子树含已完成 Task或连接外部已完成端点时必须拒绝；提交必须完全匹配操作者输入的子树根完整 Task Key。
- `FR-022` 移动、归档、删除、Owner 变化、级联重开和关注变化必须从服务端当前事实计算稳定影响集合，覆盖适用的后代、Owner、依赖、有效状态、已完成祖先、Workspace 租约/未同步状态和图作用域；确认绑定的版本或影响指纹漂移后不得执行。
- `FR-023` 每个 Task 必须恰有一个服务端逻辑 Workspace，并提供 M2 所需的只读清单、`sync_version`、生命周期、工作周期、快照和唯一有效写租约契约。M2 不物化本地目录，但必须证明完成、重开、Owner 变化、租约撤销和冻结的原子边界可供 M4 直接复用。
- `FR-024` 活动项目成员必须能够对 Task 发布 Markdown 评论；未完成 Task 中只有评论作者可以编辑或删除自己的评论，Task 完成后评论采用追加式记录且新旧评论均不可编辑或删除。附件只能保存为调用者有权读取的 Workspace 文件引用。有效管理员模式可以隐藏评论，但必须保留原文、操作者、原因和审计副本。
- `FR-025` 系统必须提供按时间稳定排序、可分页和可续读的任务活动流，覆盖 Task 创建/字段/状态/Owner/结构/依赖/关注/blocker/完成/重开/归档/删除、评论与管理员隐藏；活动流不得成为可绕过审计或源聚合的第二写入事实。
- `FR-026` 系统必须提供站内关键通知，至少覆盖 Owner 指派/有效 Owner 变化、blocker、依赖变更请求及处理、评论或提及、截止时间提醒、`completion_ready` 和破坏性/权限相关结果。关键通知不可关闭；非关键偏好可配置。重复 Outbox 处理不得产生重复通知。
- `FR-027` 所有 Task 成功和失败尝试必须写入不可变审计，包含 actor、project、target、request ID、动作、结果、稳定原因码和适用版本；密码、token、lease secret、评论/Workspace 完整正文等不必要敏感内容不得进入普通日志或审计元数据。
- `FR-028` 所有已提交 Task/评论/通知相关事件必须通过事务 Outbox 交给 Worker；SSE 必须只发布精确 user/project audience 的资源失效或增量引用，支持 cursor 续读和重复消费幂等，不得跨项目泄露。
- `FR-029` 所有资源写必须使用 Task/图/Workspace 版本、幂等键或等价条件；错误必须返回稳定机器码、可读消息、request ID、适用当前版本和恢复建议。并发结果只能是完整前态或完整后态。
- `FR-030` 普通模式只能修改当前用户有效拥有且完整影响集合均获授权的 Task；跨 Owner 内容、状态、层级、存续或批量影响必须要求有效管理员模式。管理员模式仍不得写入他人的任务级 Workspace，也不得绕过完成冻结、精确 Key 删除确认、唯一租约或 Agent 人工确认边界。
- `FR-031` M2 的公开 Task 写接口必须面向当前已认证的人类会话并由服务端推导 actor。不得提供允许客户端把自己声明为 Agent 或管理员的旁路。现有内部 Agent actor 端口必须保持非公开，并为 M5 的 `propose -> confirm -> execute` 适配保留同一领域/授权服务。
- `FR-032` M2 必须保持 M0/M1 Identity、Project/Membership、Roles、Admin Mode、Workspace、审计、Outbox/SSE、Web 治理入口和 Workspace CLI 的可观察兼容性；跨模块协作必须通过应用服务、只读端口或已提交事件，不能直接更新他方表。

## 用户流程或调用流程

1. 活动项目成员通过现有认证会话打开项目，读取当前层级 Task、同级依赖和可用 `actions`；服务端从会话解析用户、活动 Membership、Project Owner 和管理员模式。
2. 成员创建顶层或有权管理的子 Task。服务端校验父级、Owner/继承和角色，使用幂等键分配 Task Key，同时创建任务级逻辑 Workspace，并返回 Task、版本和事件引用。
3. 有效 Owner 更新字段、指派/清空后代 Owner、维护 blocker/follow，或先预览再移动、归档、删除；每次提交都携带服务端返回的版本/影响确认，漂移时重新预览。
4. 依赖修改由两端/共同父 Owner直接完成，或由单端 Owner创建变更请求并由另一端有效 Owner接受/拒绝；图版本变化使旧请求 stale。
5. Worker 消费已提交 Outbox，更新活动流、`completion_ready` 和站内通知；SSE 向精确 audience 发出资源失效引用，客户端按版本重新读取。
6. 有效 Owner 显式完成 Task。服务端在事务内重查子 Task、依赖、blocker、权限及 Task/图/Workspace 版本，固化 Owner、创建完成快照、冻结 Task/Workspace 并释放租约。
7. 需要继续工作时，调用方按项目 `deny / cascade` 策略预览并显式重新打开；服务端保留旧完成快照、创建新工作周期并恢复新周期写资格。
8. 评论在完成前后均可发布；未完成 Task 中作者可以编辑或删除自己的评论，Task 完成后评论转为追加式不可变。管理员隐藏只改变可见投影，不删除历史或审计。

## 数据、接口与状态

- `Task` 至少包含内部 ID、Project、不可复用 sequence/Task Key、父 Task、可空显式 Owner、标题、统一正文、可选逻辑角色、可选 UTC `due_at`、标签、展示类型、基础状态、归档时间、版本、冻结事实、创建者和时间戳。
- 有效 Owner、有效状态、`completion_ready`、直接子任务统计和调用方 `actions` 是从权威事实计算或可重建的投影，不得形成相互冲突的第二权威来源。
- `SiblingTaskGraphScope` 对虚拟项目根或普通父 Task 唯一，并保存单调 `graph_version`。依赖和依赖变更请求必须引用同一 scope 与两端 Task。
- `TaskFollow`、`TaskBlocker`、`TaskCompletionSnapshot`、`TaskWorkspaceTransitionSnapshot`、Task 操作幂等记录和 Task Key 墓碑延续 M0 约束，并按 M2 接口补齐查询和状态。
- M2 需要新增或正式化评论、活动投影、通知、通知偏好/已读状态和 `completion_ready` 去重事实；这些投影可由数据库与 Outbox 重建，审计和业务源记录不可变。
- 公共接口按资源与 action 分组，至少覆盖 Task 列表/详情/创建/字段更新、Owner、依赖及请求处理、follow、blocker、状态/完成/重开、影响预览、移动、归档、删除、评论、活动、通知和 Task Workspace 服务端状态。精确 URL 结构属于后续技术设计，但全部必须在 `/api/v1` 和 OpenAPI 中可发现。
- 写入输入必须包含适用的 `expected_task_version`、`expected_graph_version`、`expected_workspace_sync_version`、幂等键、影响确认令牌/指纹或完整 Task Key。输出必须返回新版本、可用 `actions`、稳定事件/操作引用和适用的当前事实。
- 状态枚举必须保持稳定：基础状态 `not_started / in_progress / done`，有效状态额外包含 `blocked`；展示类型 `normal / sprint / milestone`；依赖请求至少包含 `pending / accepted / rejected / expired / stale`；归档与删除不混入基础状态。
- 所有时间由服务端保存为 UTC；API 使用带 `Z` 的 RFC 3339。客户端本地化属于 M3，不改变服务端事实。
- Migration 必须从当前正式 profile 向前应用；任何回填必须确定、可重试且保留现有 ID/Key/版本/历史引用。无法满足不变量的数据必须让迁移以可诊断方式停止，不得静默修复为另一业务事实。

## 异常、边界与恢复

- 非活动用户、非活动 Membership、跨项目 ID、缺失资源和无权读取必须使用稳定的不可枚举/禁止语义，不能泄露其他项目数据。
- 非法 Key、无效 UTC、归档角色、无效 Owner、树环/孤儿、跨项目父子、跨父依赖、自环/重复边/DAG 环、冻结写、陈旧版本/图/影响确认、无效租约和幂等冲突必须返回稳定错误，不得退化为无差别 500。
- 任何跨模块事务失败必须回滚 Task、Workspace、审计成功记录、Outbox、评论、活动和通知源事实；失败审计只在业务无变化或完整回滚后独立幂等记录。
- Worker 可以重试，但同一 Outbox 事件不得重复创建活动项、`completion_ready` 提示或通知。投影丢失时必须可从权威数据库/Outbox 重建。
- 服务进程或 Worker 重启不得破坏已提交 Task/Workspace 事务；未提交操作由客户端重新读取版本和 `actions` 后重试，不得凭旧确认继续。
- 归档不提供恢复，非顶层删除不提供回收站或单 Task 恢复。误操作恢复只能依赖未来 M6 的项目级一致备份；因此影响预览、权限和完整 Key 确认是 core。
- M2 不负责本地 Workspace 冲突取舍；若存在活动租约、未提交客户端版本或服务端版本漂移，Owner 变化、完成、重开、归档/删除必须按已定服务端契约拒绝、撤销或要求先处理，绝不静默覆盖。
- 任一后续阶段都不得削弱 M2 的 Owner、冻结、图版本、影响集合、Workspace 原子性、审计、幂等和租户隔离不变量。

## 非功能需求

- 正确性、权限和数据完整性优先于吞吐。核心递归、图和事务规则必须由领域测试与真实 PostgreSQL 集成/并发证据证明。
- 在参考服务器和初期负载下，当前层任务列表和任务详情服务端 P95 目标小于 500 ms，普通创建/更新小于 800 ms，200 节点局部 DAG 读取小于 800 ms。
- 必须支持单项目 5,000 活动 Task、单父级 200 直接子 Task 和深度 20 的正确读取/递归操作；这些数字不得写成领域硬限制。
- 查询必须使用分页、稳定排序和适用索引；不得为 M2 引入 Redis、独立搜索或缓存集群。
- API/Worker 日志必须为结构化 JSON，包含时间、级别、request/job 关联、模块和稳定错误码，并与不可变审计分离。
- `/health/live` 与 `/health/ready` 必须继续反映正式 Schema 和 Worker runner 状态。迁移未完成时 API/Worker 不得把错误 profile 报为 ready。
- API/Worker 运行时必须没有外部 API、AI 或 LLM 依赖，不得向外部服务发送任务、评论、Workspace 或成员内容。
- 任务、评论、角色提示和 Workspace 引用均按不可信输入处理；输出必须遵守现有 Web 安全、Cookie、TLS、秘密与日志基线。
- M2 改动后的仓库必须满足 Node 24/pnpm 11 工具链、format、lint、build、typecheck、测试和适用数据库门禁；涉及发布栈时六服务 Compose 必须保持可发布。

## 初步实现方向与影响范围

- 以现有 `packages/domain` 的 Task tree/graph/owner/lifecycle/impact/authorization 为权威，补齐仍属 M2 的字段规则、评论、`completion_ready` 和通知投影规则，不在 Web 或 API route 中复制业务判断。
- 扩展 `packages/contracts` 的 Task DTO、命令、错误和事件；扩展 `packages/database` 正式迁移、类型、Task/评论/通知 Repository，并保留 M0/M1 迁移的向前兼容。
- 在 `apps/api` 的 Tasks、Workspaces、Authorization/Audit、Events 以及新的评论/通知应用边界中组合事务和权限，建立正式 `/api/v1` routes、OpenAPI 和稳定 `actions`；所有公开调用从认证人类会话解析 actor。
- 由 `apps/worker` 消费事务 Outbox，幂等维护活动、`completion_ready` 和站内通知；复用现有精确 audience SSE 让未来 M3 客户端失效重取。
- 复用现有对象存储/Workspace 服务端契约完成 Task Workspace 清单、版本、快照和租约协调；M2 不加入本地路径、监听器或平台适配器。
- 使用 `packages/test-fixtures` 增加确定性深树、200 同级、DAG、Owner 继承、并发和生命周期夹具；原型只作为交互/规模证据，不作为生产领域实现。
- 主要风险是低层 Repository 绕过跨 Owner 授权、Task/Workspace 半提交、投影重复、迁移破坏现有 M1 数据、公开接口误暴露 Agent 旁路，以及归档/删除穿透完成冻结。后续规划必须把这些风险映射到 core 验收和恢复门禁。
- 默认可按一个 coherent M2 phase 规划；只有规划技能发现不可逆迁移、公共兼容过渡、必须保持的安全中间态或独立外部交接时才拆分。此处不预先冻结阶段数量或详细设计。

## 验收标准

| 验收 | 层级 | 可观察结果 |
| --- | --- | --- |
| `AC-001` | core | 从当前 M1 正式 Schema version 2 向前迁移后，现有 Project/Membership/Role/Task/Workspace/审计/Outbox 数据和 ID/Key/历史引用保持；空库建立与重复 migrate 均无漂移，异常数据让迁移明确停止而非静默改写。 |
| `AC-002` | core | 活动成员可通过 `/api/v1`/OpenAPI 读取多层 Task、当前层级、同级 DAG 和完整详情，并创建/更新全部 M2 展示字段；Task Key、UTC、角色、标签和展示类型规则稳定，M1 既有接口不回归。 |
| `AC-003` | core | 顶层显式 Owner、子 Task 最近祖先继承、后代即时指派/清空及受影响分支计算正确；Owner 变化与 Workspace 版本/快照/租约原子提交，权限变化立即生效且无半状态。 |
| `AC-004` | core | M1 成员移除对未完成有效 Owner 的稳定阻塞清单继续成立；失败不产生半成品，成功不清空或改写任何 Task Owner/历史引用，并撤销适用能力与租约。 |
| `AC-005` | core | 虚拟根与普通父级依赖只形成同级活动唯一 DAG；双端/共同父 Owner 可直接修改、单端必须由另一端处理请求，接受/拒绝/过期/stale 与图版本正确，任何低层入口都不能绕过授权、冻结或环检测。 |
| `AC-006` | core | Follow 只在同项目展开一跳并仅返回当前用户原本可读的数据；循环不递归，添加/移除不改变 Owner、权限、依赖、状态、图版本或 Workspace 写资格。 |
| `AC-007` | core | `blocked` 只由活动 predecessor 或未解决 blocker 派生；合法状态转换与 blocker 并发受版本保护。父 Task 条件首次满足时 `completion_ready` 与 Owner 通知幂等产生，但父 Task 不会自动完成。 |
| `AC-008` | core | 完成仅在子 Task、predecessor、blocker、授权和 Task/图/Workspace 版本全部满足时提交，并同事务固化 Owner、创建完成快照、冻结 Task/Workspace、撤销租约、审计和写 Outbox；故障注入只观察到完整前态或后态。 |
| `AC-009` | core | 完成后除评论、显式重开和已完成顶层归档外的所有修改均拒绝；`deny` 精确拒绝完成 successor，`cascade` 精确重开闭包并创建新工作周期、保留旧快照、拒绝跨 Owner 或 stale 旁路。 |
| `AC-010` | core | 移动、顶层归档、非顶层不可恢复删除都先返回完整稳定影响；移动与图写并发一致，归档只退出活动计算且保留历史，删除必须完全匹配完整 Task Key 并拒绝任何穿透完成冻结的子树/外部端点。 |
| `AC-011` | core | 每个 Task 恰有一个服务端逻辑 Workspace；清单、版本、生命周期、工作周期、快照和唯一租约正确，完成/重开/Owner 变化/冻结与 Workspace 原子边界可由服务端集成测试证明且无需等待 M4 客户端补语义。 |
| `AC-012` | core | 活动成员可发布 Markdown 评论和授权 Workspace 引用；未完成 Task 仅作者可编辑/删除本人评论，完成后所有评论追加式不可变，管理员隐藏保留原文与审计。活动流稳定分页且覆盖要求动作；关键站内通知准确、不可关闭并在 Worker 重试下不重复。 |
| `AC-013` | core | 普通模式、Project Owner、有效管理员模式和有效 Task Owner 权限矩阵与完整影响集合一致；管理员不能写他人 Task Workspace。公开接口不能伪造 actor/admin/Agent，内部 Agent 端口不公开且不能绕过未来人工确认。 |
| `AC-014` | core | 成功/失败审计、事务 Outbox、Worker 投影和精确 audience SSE 对 Task/评论/通知事件完整；重试幂等、cursor 可续读、跨项目无泄露，投影可重建且不成为第二写入权威。 |
| `AC-015` | core | 并发创建、字段更新、依赖、移动、Owner、完成、重开、归档/删除和幂等重试只产生一个完整合法结果；陈旧 Task/图/Workspace/影响确认返回稳定错误和当前版本/恢复建议。 |
| `AC-016` | core | 全部正式 Task 输入输出由运行时 Schema 校验并进入 OpenAPI；错误映射不退化为 500，`actions` 由服务端当前权限/状态派生，Identity/Project/Membership/Roles/Admin Mode/Workspace、Web 治理和 Workspace CLI 现有 core 保持。 |
| `AC-017` | core | 深度 20、单父级 200 Task、200 节点局部 DAG 和单项目 5,000 活动 Task 下递归、排序、分页、授权与数据完整性正确；没有业务硬深度/规模限制、栈溢出、遗漏或跨租户数据。 |
| `AC-018` | core | 受影响包的 format/lint/build/typecheck/test、真实 PostgreSQL 迁移与事务集成、根工程 `pnpm check` 以及适用发布门禁通过；API/Worker 无外部 API/AI/LLM 运行时依赖，日志/审计不泄露秘密或不必要正文。 |
| `AC-019` | supplemental | 在参考服务器和初期负载下，当前层列表/详情 P95 `<500 ms`、普通创建/更新 `<800 ms`、200 节点 DAG `<800 ms`；若只偏离精确延迟而 core 正确性、可用性和无明显卡顿有独立证据，可按 relaxed 规则登记分级 finding。 |
| `AC-020` | supplemental | 超出 core 所需的附加浏览器、额外大规模压力、诊断夹具精度或项目范围广泛回归提供更多置信度；其异常只有在独立证明不影响任何交付行为或硬门禁时才可 report-only。 |

## 决策记录

| 决策项 | 结论 | 来源 | 回答要求 |
| --- | --- | --- | --- |
| 本次交付与验证策略 | `relaxed`；core 与硬门禁全部阻塞，仅独立证明无交付影响的 supplemental 异常可作为分级 finding 留存。 | 用户明确确认 | 必须回答 |
| 功能标识与目录 | 使用 `m2-task-management` 和 `docs/requirements/m2-task-management/`。 | 项目现有约束 | 可默认 |
| M2 权威范围 | 按 `07-roadmap-and-validation.md` 的“M2：任务管理闭环”完整交付，不重新讨论已冻结的 Task 产品决策。 | 项目现有约束 | 可默认 |
| Web 范围 | M2 不交付正式平铺树状 Task UI；正式 UI 属于 M3，现有 Task UI 原型仅作证据。 | 项目现有约束 | 可默认 |
| Agent 范围 | M2 只交付可供后续复用的领域/应用/上下文发现契约，不公开 Agent 写入口；Agent 工具与人工提案协议属于 M5。 | 项目现有约束 | 可默认 |
| 摘要与 Wiki | M2 保存完成快照和后续来源边界，但不交付 KnowledgeEntry/摘要/Wiki；这些属于 M6，服务端不得调用模型。 | 项目现有约束 | 可默认 |
| 迁移策略 | 从当前 M1 Schema version 2 非破坏性向前迁移；不得 reset 或重写封存历史。 | 项目现有约束 | 可默认 |
| 任务责任 | 显式 Owner + 最近祖先继承的单一有效 Owner；后代指派即时生效，顶层不能清空，成员移除不改写 Owner。 | 项目现有约束 | 可默认 |
| 删除与恢复 | 顶层只归档且不恢复；非顶层按完整 Task Key 不可恢复删除；M2 不提供回收站或单 Task 恢复。 | 项目现有约束 | 可默认 |
| 通知渠道 | M2 只交付站内通知和精确 SSE 失效；邮件/聊天软件等外部渠道不在 MVP 本阶段。 | 项目现有约束 | 可默认 |
| 评论生命周期 | 未完成 Task 中仅作者可编辑或删除本人评论；Task 完成后评论采用追加式记录且新旧评论均不可编辑或删除；有效管理员模式只能隐藏并保留原文与审计。 | 用户明确确认 | 必须回答 |
| 验收分级 | 可观察行为、正确性、兼容、安全、恢复和项目硬门禁均为 core；仅精确性能目标和额外诊断/广泛回归为 supplemental。 | 项目现有约束 | 可默认 |

## 未决问题

无。用户已明确选择 `relaxed`，并明确选择未完成 Task 中仅作者可编辑或删除本人评论、Task 完成后评论追加式不可变；其余会改变 M2 行为、范围、接口、数据、安全、兼容性、失败恢复或验收方向的事项均已由当前正式项目文档和已冻结决策确定。
