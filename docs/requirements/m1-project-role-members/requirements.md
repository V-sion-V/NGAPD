# M1：项目、角色和成员需求

- 文档状态：已批准
- 功能 ID：`m1-project-role-members`
- Schema：`3.2`
- 批准日期：`2026-07-28`
- 交付与验证策略：`relaxed`
- 项目基线：分支 `requirements/m1-project-role-members`，提交 `f9efee992394f1b6761182237cf736f79561ad5b`

## 1. 背景与目标

M0 已完成 NGAPD 的领域基线、正式 PostgreSQL Schema、Identity/Pairing/Workspace 公共兼容入口、内部 Task 应用端口、审计、Outbox/SSE 和工程发布骨架，但有意没有开放完整的 Project/Membership CRUD。M1 在该基线上交付小型独立游戏团队建立协作边界所需的第一个完整用户闭环：

- 用户能够注册、登录、维护个人默认资料并看到稳定头像占位符。
- 用户能够创建、打开、归档和恢复项目；项目创建者成为唯一 Project Owner。
- 用户能够按精确 Project Key 申请加入项目，Project Owner 能够审批、拒绝、任命管理员和移除合格成员。
- Project Owner 能够把所有权转移给已接受请求的活动成员，项目始终恰有一个活动 Owner。
- Project Owner 和 Project Admin 只有在规定场景显式进入管理员模式后才获得对应扩大权限。
- 系统角色模板在项目创建时复制为独立快照，项目成员可以绑定多个仅描述能力、不授予权限的逻辑角色。
- 成员移除保留 Membership、项目资料和历史 Task Owner 引用；重新加入复用同一 Membership，使旧引用重新指向该活动成员。

M1 的结果必须能够被 M2 的任务管理闭环直接复用，不得在 Web、测试夹具或临时路由中建立另一套身份、成员、Owner、角色或管理员权限规则。

## 2. 范围

### 2.1 包含范围

- 兼容并完善本地账号注册、登录、登出和 Web 会话。
- 用户显示名、默认自我介绍、默认系统角色模板绑定和头像占位符。
- Project 创建、成员可见列表与详情、精确 Key 申请目标查询、归档和解除归档。
- 用户级与项目级逻辑 Workspace 在对应作用域创建时的唯一、原子创建保证。
- 成员加入申请、审批、拒绝、重新申请、成员资料和多逻辑角色绑定。
- Project Admin 任命与撤销、按项目的短期管理员模式、持续视觉提示、过期和审计。
- 成员移除前的有效 Task Owner 阻塞检查、保留式移除、权限撤销和重新加入。
- Project Owner 转移请求、接受、拒绝、取消、并发失效和租约资格协调。
- 不可编辑系统逻辑角色模板、项目角色快照、项目角色创建、编辑、复制、归档和成员绑定。
- M1 所需的共享运行时契约、数据库迁移、领域/应用服务、公共 `/api/v1` API、OpenAPI、Web 流程、审计、Outbox/SSE 失效通知和测试。
- 与 M0 Identity、Pairing、Workspace、Task 低层不变量及发布门禁的兼容验证。
- 同步受本需求取代的正式产品、领域、权限、架构、路线和决策文档结论。

### 2.2 不包含范围

- 邮箱、邮件验证、头像文件上传、外部头像 URL、第三方身份提供商、自助密码重置和多因素认证。
- 成员邀请；M1 只交付用户主动申请与 Project Owner 审批。
- 完整公共 Task CRUD、M2 任务管理页面、依赖、评论、完成通知和其他 M2 用户流程。
- macOS/Windows Workspace 物化、文件监听、真实目录同步或 GUI。
- Agent 写工具、Agent 操作提案 UI、Agent 自动进入管理员模式或 M5 Skill。
- 项目备份恢复；M1 的“项目恢复”仅指把 `archived` 项目解除归档为 `active`。
- 项目永久删除、Membership 物理删除、Task 回收站或单 Task 恢复。
- 外部通知渠道、复杂组织/RBAC、Viewer 权限、逻辑角色驱动授权或可自定义权限策略。
- 高可用、集群、Redis、独立消息队列、独立搜索服务、对象服务或公共互联网规模优化。

## 3. 已确认的项目事实与约束

- 仓库是 Node.js 24、pnpm 11、TypeScript 单体仓库；服务端使用 Fastify 模块化单体、PostgreSQL/Kysely、TypeBox/OpenAPI、Graphile Worker/Outbox 和 SSE，Web 使用 React/Vite。
- `packages/domain`、服务端应用服务和数据库约束是业务规则权威；Web、CLI、Agent、测试夹具和 Prompt 不得单独定义授权。
- 当前公共 Identity 已提供注册、登录、登出、Secure/HttpOnly/SameSite Cookie 会话、设备配对和设备撤销；M1 必须保持既有公共输入输出兼容。
- 当前注册已在同一事务创建 User 与唯一用户级 Workspace；项目骨架已能在同一事务创建 Project、Owner Membership、虚拟根图作用域和唯一项目级 Workspace。
- Project Key 必须匹配 `[A-Z]{2,6}`、全局唯一、创建后不可修改，归档后也不释放。
- `Project.owner_membership_id` 是 Project Owner 的唯一权威来源；Membership 的权限值只允许 `admin / member`，不保存 `owner`，也不提供 Viewer。
- 当前创建项目的 Owner Membership 使用 `admin` 资格；该资格不替代 `owner_membership_id`，所有权转移也不隐式改写任一 Membership 的权限值。
- 管理员模式是按项目、按登录会话签发的短期服务端能力，不是 Membership 永久字段；30 分钟无操作后失效，MVP 默认不要求重新认证。
- 用户级 Workspace 由本人写；项目级 Workspace 由活动 Project Owner/Admin 写；Task Workspace 由活动有效 Task Owner 写。任何实际写入仍要求唯一有效租约。
- 逻辑角色只描述能力，不参与 Web、Workspace 或 Agent 授权。
- 当前 `docs/11-logical-role-templates.json` 的稳定模板形状是 `id / title / desc`；`desc` 是能力范围文本，并同时作为该角色的 Agent 提示。
- M0 已完成任务冻结、有效 Owner、Workspace 租约/快照和管理员授权基础。已完成 Task 除评论、显式重新打开和顶层归档外保持冻结，管理员模式也不能直接穿透。
- 用户本次明确取代现有 `MEM-006`：成员移除不得清空 Task Owner；Membership 和 Task Owner 引用必须保留，且持有启用态未完成 Task 的有效 Owner 不得被移除。
- 用户本次明确取代现有 `ROL-004`：角色不再拆分等级、职责、禁区、任务提示和独立 Agent Prompt；项目角色的核心可编辑内容只有名称和一份能力范围文本，该文本同时作为 Agent 提示。
- M1 必须通过前向迁移保留当前 User、Project、Membership、Task、Workspace、审计和会话数据；不得隐式调用破坏性 reset。
- 初期部署少于 10 名用户、典型项目少于 20 名成员，运行在内网/VPN 的单台 Linux Docker Compose 服务器；规模假设不得成为正确性硬限制。
- 服务端和 Worker 不得调用外部 API、AI 或 LLM，不得把密码、会话令牌、设备秘密、租约秘密或不必要的 Workspace 正文写入日志、审计或错误响应。

## 4. 交付与验证策略

本功能初始运行采用用户明确选择的 `relaxed` 策略：

- 实现可以先于测试，不要求每个改动都生成 red-first 证据。
- 所有 `core` 验收、数据迁移、权限、安全、隐私、数据完整性、公共兼容、构建、恢复和项目/发布硬门禁仍然阻塞完成。
- 只有明确标记为 `supplemental`、且独立证据证明不影响已交付行为的异常，才能作为分级 `FND-I-*` report-only finding 保留。
- `critical`/`high`、安全、隐私、数据、兼容、构建/运行、影响未知、必需门禁或未被独立证明的 core 异常始终阻塞。
- 验收项不得在失败后为完成运行而从 `core` 降级为 `supplemental`。

## 5. 功能需求

### 5.1 账号、会话与个人资料

- `FR-001` 系统必须继续允许开放式本地账号注册、登录和登出。登录名必须按现有 NFKC、大小写无关唯一规则处理，继续接受 3—80 个 Unicode 字母、数字、点、下划线或连字符；登录名在 M1 不得修改。密码必须保持现有 12—256 字符输入边界和 Argon2id 存储，认证失败不得泄露账号是否存在。
- `FR-002` 注册成功必须在同一事务创建 User、唯一用户级逻辑 Workspace 和初始 Workspace 版本；任一部分失败时不得留下半创建账号。成功后继续签发兼容的 Web 会话。
- `FR-003` 用户必须能够读取和修改自己的 `display_name`、`default_introduction` 和去重的 `default_role_template_ids`。显示名初始取规范化前的登录名，必须为 1—80 个可显示字符；默认介绍是最多 4,000 字符的 Markdown 文本；默认角色只能引用仍存在的系统模板。
- `FR-004` Web 必须为每个用户显示由当前显示名首个可显示 Unicode 字素派生的头像占位符，并提供文本替代。M1 不得存储头像文件、头像 URL 或上传状态；未来头像能力不得改变当前 User ID 或显示名语义。
- `FR-005` 用户只能修改自己的个人默认资料。个人默认资料只在首次加入某项目时用于初始化项目成员资料，之后个人资料和项目成员资料不得自动双向同步。

### 5.2 项目生命周期

- `FR-006` 任一活动已认证用户必须能够使用 Project Key、名称和可选说明创建项目。Key 必须匹配 `[A-Z]{2,6}` 并全局唯一；名称必须为 1—160 个字符；说明必须是最多 8,000 字符的 Markdown 文本。创建请求必须支持幂等，默认 `completed_successor_reopen_policy=deny`。
- `FR-007` 项目创建必须原子创建 Project、创建者的活动 Owner Membership、`owner_membership_id`、虚拟根图作用域、唯一项目级 Workspace、初始 Workspace 版本和全部系统逻辑角色模板的项目快照。失败不得消耗出一个可见的半项目，重试不得复制 Workspace、Owner Membership、根作用域或角色快照。
- `FR-008` 活动成员必须能够列出和打开自己的项目并读取项目详情、成员、角色和自身权限状态。非成员不得枚举项目；已认证用户只有在提供精确 Project Key 时才能读取用于申请确认的最小目标信息：Project Key、名称和是否接受申请，不得获得说明、成员或角色内容。
- `FR-009` 只有 Project Owner 能够直接归档或解除归档项目，不要求管理员模式，但必须使用当前 Project 版本并审计。归档项目继续对已有活动成员可读，但所有项目范围业务写入和新的项目/Task Workspace 写租约必须被拒绝；归档时必须撤销现有项目/Task Workspace 租约并使该项目管理员能力失效。
- `FR-010` 解除归档必须恢复项目为 `active`，但不得自动恢复旧租约、管理员会话、已拒绝申请或已移除成员。M1 不得把解除归档实现成项目备份恢复。

### 5.3 加入申请、成员资料与权限资格

- `FR-011` 已认证非活动成员必须能够通过精确 Project Key 对活动项目发起加入申请；系统不得提供项目浏览目录或 M1 邀请流程。同一用户和项目最多存在一个待处理申请，同一幂等请求必须返回同一结果。
- `FR-012` 首次申请必须建立或复用该用户与项目唯一的 Membership，并将其置为 `pending`、`permission_level=member`。Project Owner 能看到申请人显示名和本次申请状态；申请人在批准前不能读取项目详情、项目/Task Workspace、成员或角色目录。
- `FR-013` 只有当前 Project Owner 能够直接批准或拒绝加入申请，不要求管理员模式。批准前必须重新检查项目、申请、Owner 和 Membership 版本；首次批准把 Membership 置为 `active`，复制用户当时的默认介绍，并通过 `source_template_id` 绑定项目中对应的活动角色快照。
- `FR-014` 拒绝必须保留申请审计和唯一 Membership 记录，并将其置为 `removed`；被拒绝或已移除用户可再次申请，同一 Membership 在 `removed -> pending -> active` 间演进，不得创建第二条 Membership。
- `FR-015` 活动成员必须能够直接编辑自己的项目内介绍和逻辑角色绑定，不要求管理员模式。项目介绍最多 4,000 字符；绑定是去重集合，只能新增活动项目角色。个人默认资料后续变化不得改写项目成员资料。
- `FR-016` Project Owner 必须能够直接任命或撤销活动成员的 Project Admin 资格，不要求管理员模式。不得对 `pending/removed` Membership 授予 Admin；不得使用 `permission_level` 表达 Owner。权限变化必须与项目级 Workspace 租约资格和管理员会话失效原子协调。
- `FR-017` 编辑其他成员的项目介绍或逻辑角色绑定必须由 Project Owner 或 Project Admin 在活动管理员模式下执行。管理员模式关闭时，Admin 在这些操作上与普通成员相同。

### 5.4 成员移除、保留与重新加入

- `FR-018` 只有 Project Owner 能够直接发起成员移除，不要求管理员模式。Project Owner 不得移除自己；必须先完成接受式所有权转移。移除请求必须携带当前 Project 和 Membership 版本并返回可判定的影响预览。
- `FR-019` 成员移除前，系统必须按有效 Owner 语义检查全部启用态未完成 Task，包括显式 Owner 和最近祖先继承出的 Owner。只要目标 Membership 是任一此类 Task 的有效 Owner，移除必须整体拒绝并返回稳定排序的阻塞 Task Key/ID；已完成 Task 和已归档顶层子树不阻止移除。
- `FR-020` 合格移除必须保留同一 Membership、项目介绍、逻辑角色绑定、历史审计和全部 Task Owner 引用，只把 Membership 置为 `removed`，并把 `permission_level` 降为 `member`。不得清空、替换或删除任何 Task 的显式 Owner。
- `FR-021` Membership 状态改变、Admin 降权、管理员会话失效、项目/Task Workspace 租约撤销、审计和 Outbox 必须在同一业务事务中协调。事务失败不得留下 Membership 已移除但租约或管理员能力仍有效的状态。
- `FR-022` `pending/removed` Membership 不能读取项目数据、申请新的项目/Task Workspace 租约、成为新 Task Owner 或执行成员操作。若 Task 的有效 Owner 是非活动 Membership，其 Task Workspace 必须保持只读且不能授予写租约。
- `FR-023` 正常产品路径不得产生“已移除 Membership 仍有效拥有启用态未完成 Task”的状态。若迁移、恢复或历史异常存在该状态，只有 Project Owner/Admin 在活动管理员模式下能够修改其普通任务数据或把显式 Owner 指派给活动成员；普通成员不得操作，Workspace 在有效 Owner 恢复前不得写入。
- `FR-024` 已完成 Task 即使引用已移除 Membership 也必须继续遵守 M0 完成冻结。管理员不得直接修改字段或 Owner；若要继续工作，必须在管理员模式下执行包含活动显式 Owner 的重新打开操作，并继续遵守项目 `deny/cascade` 策略和完整影响确认。
- `FR-025` 已移除用户重新申请获批时必须重新激活同一 Membership，保持 `permission_level=member`，保留原项目介绍和逻辑角色绑定且不重新复制个人默认资料。原 Task Owner 引用因此重新指向活动成员；已完成 Task 仍保持冻结，任何 Workspace 写入仍需重新取得唯一租约。

### 5.5 Project Owner 转移

- `FR-026` 只有当前 Project Owner 能够向同项目另一名活动成员发起所有权转移；目标不得是当前 Owner。同一项目最多一个待处理转移请求。
- `FR-027` 当前 Owner 可以取消待处理请求；目标成员可以接受或拒绝；请求不自动过期。所有动作必须绑定 Project、当前 Owner、目标 Membership 和请求版本，任一事实变化后旧请求必须稳定失效。
- `FR-028` 接受转移必须在同一事务重新验证项目 active、发起者仍是当前 Owner、目标仍为活动成员，并只更新 `Project.owner_membership_id` 这一 Owner 权威字段。双方原有 `admin/member` 权限值不得因转移自动改变。
- `FR-029` 所有权转移必须与 Project 版本、Owner 专属能力、项目级 Workspace 写资格、必要租约撤销、管理员会话资格重算及必要失效、审计和 Outbox 原子协调。项目在任何可提交状态都必须恰有一个活动 Project Owner。

### 5.6 管理员模式与治理权限

- `FR-030` 只有活动 Project Owner 或 `permission_level=admin` 的活动成员能够为当前 Web 登录会话、当前项目显式开启管理员模式。能力必须服务端签发、目标绑定并显示持续明显的视觉提示；资格本身不得自动开启模式。
- `FR-031` 管理员模式在 30 分钟无操作后失效，默认不要求重新认证。用户可以显式关闭；登出、Web 会话撤销、账号停用、Membership 非活动、Admin 资格撤销、项目归档或项目不匹配必须立即使能力失效。
- `FR-032` 管理员模式开启、关闭、过期、拒绝和能力失效必须审计。每个受保护操作必须在服务端重新检查登录会话、项目、Membership、资格、管理员能力和资源版本，不能信任 Web 显示状态。
- `FR-033` Project Owner 可以不进入管理员模式直接执行项目归档/解除归档、加入审批/拒绝、Admin 任免、Owner 转移和合格成员移除。Project Owner/Admin 编辑项目角色目录或他人项目成员资料时必须进入管理员模式；普通成员只可编辑自己。
- `FR-034` 管理员模式不得授予项目外访问、不得绕过项目/Task Workspace 写入者资格或唯一租约、不得穿透已完成 Task 冻结、不得替代 Project Owner 专属操作，也不得让逻辑角色影响授权。

### 5.7 逻辑角色

- `FR-035` 系统模板必须保持不可编辑，稳定字段只有 `id`、`title` 和 `desc`。`title` 是角色名称，可包含如 L1/L2/L3 的文本；`desc` 是完整能力范围，并必须原样作为该角色的 Agent 提示。系统不得为 M1 再引入独立的 level、responsibilities、limitations、task_hints 或 agent_prompt 产品字段。
- `FR-036` 项目创建时必须为每个系统模板复制一个独立项目角色，保留稳定 `source_template_id`、名称、能力范围、状态和版本。系统模板后续变化不得自动覆盖既有项目角色。
- `FR-037` Project Owner/Admin 在活动管理员模式下必须能够创建、编辑、复制和归档项目角色。项目自定义角色必须包含 1—160 字符名称和 1—4,000 字符能力范围；编辑能力范围即同时编辑 Agent 提示。
- `FR-038` 归档角色必须保留既有成员绑定和未来 Task 历史引用，但不得新增绑定或用于新的 Task 修改。归档角色不得原地重新激活；可以复制为一个新的活动角色。
- `FR-039` 一个活动成员可以绑定零个或多个去重项目角色。绑定、名称、能力文本、模板来源和任何字符串内容都不得授予或扩大 Web、Workspace、Agent 或管理员权限。

### 5.8 公共接口、审计与集成

- `FR-040` M1 公共 HTTP 必须位于 `/api/v1`，使用共享 TypeBox 运行时 Schema并进入 OpenAPI 3.1。资源写必须携带资源版本或等价条件；创建项目、申请、审批、权限变化、移除和转移等可重试写入必须支持幂等。
- `FR-041` 公共能力至少必须覆盖：当前用户资料；项目创建、成员项目列表、详情、精确 Key 申请目标、归档/解除归档；加入申请及处理；成员资料和角色绑定；Admin 任免；Owner 转移；管理员模式；系统模板和项目角色目录。响应必须返回调用者可用操作和管理员模式状态，不要求客户端自行推断权限。
- `FR-042` Web 必须提供与公共 API 对应的中文流程，并保留现有注册、登录、设备配对和撤销能力。所有危险或高权限动作必须展示目标、当前状态和后果；头像占位符、管理员模式和归档/移除状态必须在颜色之外提供可访问标识。
- `FR-043` 注册/登录、项目生命周期、申请、成员资料、Admin 任免、成员移除/重新加入、Owner 转移、管理员模式和角色目录的成功与失败尝试必须产生不可变审计，至少包含 actor、actor type、project、target、request ID、时间、前后版本、结果和稳定原因码。
- `FR-044` 成功写入必须通过既有 Outbox 产生资源失效事件，SSE 只通知客户端重新获取权威资源，不承载业务提交或秘密。
- `FR-045` M1 必须保持现有 Identity、Pairing、设备、Workspace、SSE、Web 和内部 M0 Task 应用端口兼容。不得为了新增显示名或项目资料破坏现有 SessionActor、Cookie、设备令牌或 Workspace 输入输出。
- `FR-046` M1 必须通过前向迁移保留现有数据：现有 User 的显示名回填为登录名，默认介绍和默认角色为空；现有 `active=true` Membership 映射为 `active`，`active=false` 映射为 `removed/member`，介绍和绑定为空；现有 Project 补齐说明和完整角色模板快照。迁移不得改写 Task Owner、Task 状态、Workspace 版本、租约历史或不可变审计。
- `FR-047` M1 形成的新规则必须同步到受影响的正式产品、领域、权限、架构、路线和决策文档：删除“移除成员时清空未完成 Task Owner”的旧结论，并把 `ROL-004` 收敛为名称加单一能力/Agent 提示文本。封存的 M0 execution、phase result 和 numbered change 记录不得改写。

## 6. 用户流程或调用流程

### 6.1 注册、登录与维护默认资料

1. 用户使用符合现有约束的登录名和密码注册。
2. 服务端原子创建 User、用户级 Workspace 和初始版本，并签发兼容 Web 会话。
3. Web 使用显示名首字素呈现头像占位符。
4. 用户修改显示名、默认介绍和默认系统角色模板集合。
5. 后续项目首次批准只读取批准时的默认快照，不与个人资料持续同步。

### 6.2 创建和打开项目

1. 活动已认证用户输入不可变 Project Key、名称和可选说明。
2. 服务端校验 Key/幂等请求并原子创建 Project、Owner Membership、根图作用域、项目 Workspace、初始 Workspace 版本和角色模板快照。
3. 创建者通过 `owner_membership_id` 成为唯一 Owner，并保留当前 `admin` 资格。
4. 活动成员从自己的项目列表打开项目；非成员不能浏览项目目录。

### 6.3 申请、审批和重新加入

1. 用户输入精确 Project Key，读取最小申请目标信息并提交申请。
2. 系统创建或复用唯一 Membership，将其置为 `pending`。
3. Project Owner 查看并批准或拒绝；Admin 不能代替 Owner。
4. 首次批准复制用户默认介绍并绑定对应项目模板角色。
5. 拒绝或移除后再次申请复用同一 Membership；重新批准保留原项目资料，权限为 Member。

### 6.4 维护成员和角色

1. 活动成员直接维护自己的项目介绍和活动角色绑定。
2. Project Owner 直接任命或撤销 Admin。
3. Project Owner/Admin 要修改角色目录或他人资料时，必须为当前项目显式开启管理员模式。
4. Web 持续显示模式范围和剩余有效状态；关闭、过期或资格变化后服务端立即拒绝旧能力。

### 6.5 移除成员

1. Project Owner 请求影响预览。
2. 服务端按有效 Owner 解析启用态未完成 Task；存在任何阻塞 Task 时返回稳定清单并拒绝。
3. 无阻塞时，服务端在同一事务把 Membership 置为 `removed/member`，保留 Task Owner、介绍和角色绑定，并撤销租约与管理员能力。
4. 被移除用户立即失去项目读写访问；其他活动成员仍能读取保留的历史任务和 Workspace。
5. 用户重新申请获批后，同一 Membership 恢复 active，旧 Owner 引用重新有效，但已完成任务继续冻结。

### 6.6 转移项目所有权

1. 当前 Owner 选择另一活动成员并创建唯一待处理请求。
2. 发起者可以取消；目标可以拒绝或接受。
3. 接受时服务端锁定并重查 Project、Owner、目标 Membership 和版本。
4. 成功事务只切换 `owner_membership_id`，保留双方 Admin/Member 值，并同步处理 Workspace 资格、租约、管理员能力、审计和 Outbox。

### 6.7 归档和解除归档

1. Project Owner 使用当前版本归档项目。
2. 服务端使项目只读，撤销项目范围写租约和管理员能力；成员仍可读取历史。
3. Owner 使用新的当前版本解除归档。
4. 项目恢复 active，但客户端必须重新申请管理员模式和 Workspace 租约。

## 7. 数据、接口与状态

### 7.1 权威数据

- `User`：现有身份字段，加 `display_name` 和 `default_introduction`；头像占位符由显示名派生，不持久化头像内容。
- `UserDefaultRoleTemplate`：User 与系统模板 ID 的去重关联。
- `Project`：现有字段，加说明；`owner_membership_id`、`lifecycle` 和 `version` 继续作为 Owner、生命周期和并发权威。
- `ProjectMembership`：同一 `(project_id, user_id)` 唯一；包含 `permission_level=admin/member`、`status=pending/active/removed`、项目介绍和版本。Owner 只由 Project 派生。
- `MembershipJoinRequest`：保存申请轮次、状态、请求人、处理人、版本和时间；允许同一 Membership 有连续历史，但最多一个 pending。
- `SystemLogicalRoleTemplate`：不可编辑的 `id/title/desc`，可以由版本控制 JSON 作为发布来源。
- `ProjectLogicalRole`：项目内稳定 ID、可选 `source_template_id`、名称、能力/Agent 提示文本、`active/archived` 和版本。
- `MembershipLogicalRole`：Membership 与 ProjectLogicalRole 的去重关联；角色归档不删除已有关系。
- `ProjectOwnershipTransferRequest`：项目唯一 pending 请求、发起 Owner、目标 Membership、`pending/accepted/rejected/cancelled/stale`、版本和时间。
- `AdminModeSession`：Web 会话、项目、Membership、签发来源、最后活动时间、过期/撤销事实；不得保存为 Membership 布尔字段。
- `AuditEvent`、Outbox 和 SSE 投影继续使用 M0 权威边界。

### 7.2 状态与不变量

- Project：`active -> archived -> active`；不提供 deleted。
- Membership：首次申请 `pending -> active|removed`；重新申请 `removed -> pending -> active|removed`。任一时刻同一用户/项目只有一个 Membership。
- 移除会把权限降为 Member；重新加入不恢复 Admin。
- Owner Membership 必须与 Project 同项目且为 active；Owner 不能被移除。
- Join Request 和 Ownership Transfer Request 各自最多一个 pending；资源版本或参与者事实变化使旧操作 stale。
- Project Role：`active -> archived`，不原地恢复。
- Admin Mode：`active -> closed|expired|revoked`；资格、会话或项目失效立即撤销。
- Task Owner 引用在成员移除时保持不变；只有 active Membership 能成为新的显式 Owner或取得 Task Workspace 写资格。

### 7.3 公共输入输出

- 所有写入使用共享运行时 Schema，拒绝未知字段。
- Project、Membership、Join Request、Role、Transfer Request 和 Admin Mode 响应必须包含稳定 ID、状态、版本和调用者可执行动作。
- 列表结果必须使用稳定排序；成员、角色和申请即使在当前小规模下也不得依赖数据库自然顺序。
- 精确 Key 申请目标只能返回最小信息，不得成为成员、说明或角色枚举接口。
- 错误响应继续使用稳定机器码、可读信息、request ID、适用的当前版本和恢复建议。

### 7.4 迁移与兼容

- 新迁移必须能从空库和当前正式 `0001`—`0007` 前缀前向建立。
- 既有 User、Project、Membership 和 Workspace 必须保留 ID 与引用；不可通过 drop/recreate 偷换。
- 既有 Membership 的 `active=true` 必须映射为 `status=active`；`active=false` 必须映射为 `status=removed` 并按移除后安全基线降为 `permission_level=member`。
- 为既有项目补角色快照必须幂等，并保证每个 `source_template_id` 每项目最多一份初始快照。
- M1 不负责把当前内部 Task 逻辑角色字符串迁移为正式 Project Role 外键；M2 必须使用 M1 稳定 Project Role ID 完成该集成，M1 不得创建不兼容的临时公共 Task 契约。

## 8. 异常、边界与恢复

- 登录名、密码、显示名、介绍、Project Key、项目名称/说明、角色名称/能力或 UUID 格式错误必须在业务写入前稳定拒绝。
- 重复 Project Key 返回冲突且不泄露其他项目内容；幂等重试返回原业务结果。
- 归档项目拒绝申请、成员/角色变更、管理员模式开启和项目范围写入，并提示 Owner 先解除归档。
- 重复申请、重复审批、重复移除、重复 Admin 变更和重复转移接受必须通过幂等或版本冲突返回确定结果，不得产生重复关系或审计成功。
- 非 Owner 审批、Admin 任免、成员移除、Owner 转移或项目归档必须拒绝；管理员模式和人工确认不能替代 Owner 专属授权。
- 成员移除与 Task Owner 指派/创建并发时必须串行化并在提交前重查，不能在检查后产生新的未完成有效 Owner 任务并仍完成移除。
- 移除阻塞响应必须稳定列出当前启用态未完成 Task；事实变化后旧影响预览或版本不得继续提交。
- 移除、重新加入、Admin 降权和所有权转移任一中途失败必须整体回滚，不得留下活动租约、悬空唯一 Owner 或部分权限。
- 被移除 Admin 重新加入必须是 Member；旧管理员能力、Cookie 或页面状态不得恢复其 Admin 权限。
- 管理员模式过期后客户端可以重新开启，但旧能力不得续用；服务端时钟和最后活动时间是权威。
- 已归档角色的历史绑定保持可读；新增绑定或编辑归档角色必须拒绝并建议复制为新角色。
- 已完成 Task 的 Owner 被移除后仍冻结；修复或继续工作必须走带活动 Owner 的正式重新打开流程。
- 前向迁移异常必须停止应用 ready，保留原数据库事实并给出迁移诊断；不得自动 reset。
- 回滚代码时不得声称可安全降级已应用 Schema。发布/回滚说明必须记录兼容边界，必要时先恢复经确认的数据库备份。

## 9. 非功能需求

### 9.1 安全与隐私

- Cookie 必须继续使用 Secure、HttpOnly、SameSite；状态改变请求继续执行现有可信 Origin 防护。
- 密码使用 Argon2id；秘密不进入普通日志、审计、错误、OpenAPI 示例或前端状态持久化。
- 所有 Project 查询使用服务端解析的 `project_id` 和 Membership，不得只信任客户端 Project Key、Membership ID、管理员标志或角色名。
- 非成员精确 Key 查询必须最小披露；禁止项目目录、成员枚举和跨项目 IDOR。
- 逻辑角色名称、能力文本、成员介绍和项目说明按不可信 Markdown/Prompt 内容处理，不得改变授权。

### 9.2 一致性与并发

- 唯一 Owner、唯一 Membership、唯一 Workspace、唯一 pending 申请/转移和模板快照唯一性必须同时由数据库约束与应用事务保护。
- 项目、Membership、角色、申请和转移写入使用乐观版本；移除、转移、归档和权限变化使用必要的行锁与稳定锁顺序。
- 权限/资格变化与相关管理员能力、租约、审计和 Outbox 必须处于可证明的原子边界。

### 9.3 性能与规模

- 少于 10 名注册用户、单项目少于 20 名成员时，项目、成员、角色和申请页面不得出现明显卡顿或超时。
- 在参考服务器和正常内网/VPN 下，常规 M1 读 API 目标 P95 小于 500 ms，普通写 API 目标 P95 小于 800 ms；不得为该目标引入缓存集群。
- 规模目标不是业务硬限制；列表必须稳定排序并允许后续增加分页。

### 9.4 可用性、可访问性与国际化

- Web 以中文为主，状态和错误必须提供可执行恢复提示。
- 头像占位符、管理员模式、Owner/Admin/Member、pending/removed、active/archived 和角色归档必须在颜色之外提供文本或图形标识。
- 表单必须支持键盘操作、明确标签、焦点和错误关联。

### 9.5 可观测性与运维

- 应用日志保持结构化并包含请求 ID、模块和稳定错误码；安全审计与普通诊断日志分离。
- API/Worker ready 必须继续依赖正式 Schema；迁移未完成时不得服务 M1 写请求。
- 不增加外部 API、LLM、Redis、独立队列/搜索/对象服务或高可用基础设施。

### 9.6 构建、兼容与发布

- Node.js 24、pnpm 11、锁文件、workspace 包边界和模块边界保持权威。
- 受影响包测试、真实 PostgreSQL 迁移/并发验证、根工程格式/静态检查/构建/类型/测试门禁必须通过。
- 适用的 Compose 发布栈必须继续完成迁移和 API/Worker/Web/Gateway/PostgreSQL 健康验证；缺少外部环境时必须明确记录未运行项，不得把未验证写成通过。

## 10. 初步实现方向与影响范围

- 在现有 Identity 模块上增量扩展个人资料，不替换当前密码、会话、Pairing 或设备契约。
- 新增 Projects/Membership 与 Roles 应用服务，所有公开路由只组合应用服务，不直接写表。
- 在 `packages/contracts` 增加 M1 runtime Schema、DTO、状态枚举和稳定错误；在 `packages/domain` 增加成员状态、管理员模式资格、Owner 转移和逻辑角色不授权规则。
- 在 `packages/database` 增加前向迁移、Repository、约束、幂等、审计/Outbox 与真实 PostgreSQL 并发测试；复用 M0 Workspace/Task 协调端口处理租约和 Owner 引用。
- 在 `apps/api` 注册版本化 Project/Membership/Role/Admin Mode 路由并复用统一错误适配；在 `apps/web` 将现有 Workspace Access 页面扩展为账号、项目和成员闭环。
- `apps/worker` 只消费已提交 Outbox 并维护失效投影，不拥有 Membership、Owner 或 Role 权威状态。
- 主要风险是：成员移除与 Task Owner 并发、保留式重新加入、Owner 转移唯一性、管理员能力失效、归档与租约原子性、当前 Schema 前向迁移以及现有 Identity/Workspace 兼容。
- 所有后续阶段必须保持以下不变量：项目恰有一个活动 Owner；Membership 不物理删除；逻辑角色不授权；非活动 Owner 无 Workspace 写资格；已完成 Task 冻结；权限变化不留活动管理员能力或租约；旧公共 Identity/Workspace 契约持续可用。
- 本节只给出实现方向，不构成详细设计或阶段划分；后续 `$plan-feature-implementation` 负责比例化路线图和首个即时阶段计划。

## 11. 验收标准

| 验收 | 层级 | 可观察结果 |
| --- | --- | --- |
| `AC-001` | core | 注册、登录和登出保持兼容；并发或故障下每个成功 User 恰有一个用户级 Workspace 和初始版本，失败不留半账号。 |
| `AC-002` | core | 用户可维护显示名、默认介绍和默认模板集合；Web 显示可访问的首字素头像占位符，不上传或持久化头像内容。 |
| `AC-003` | core | 创建项目原子产生唯一 Project、Owner Membership、活动 Owner、虚拟根、项目 Workspace/初始版本和完整模板快照；幂等重试不重复。 |
| `AC-004` | core | Project Key 格式、全局唯一和不可变规则持续成立；成员只能列出自己的项目，非成员精确 Key 查询只获得申请所需最小信息。 |
| `AC-005` | core | 只有 Owner 可归档/解除归档；归档后项目只读、写租约和管理员能力失效，解除归档不恢复旧能力或租约。 |
| `AC-006` | core | 用户可按精确 Key 申请；同一用户/项目只有一个 Membership 和一个 pending 申请，归档项目或重复/陈旧申请稳定拒绝。 |
| `AC-007` | core | 只有 Owner 可批准/拒绝；首次批准复制当时个人默认资料，重新批准复用 Membership 并保留原项目资料。 |
| `AC-008` | core | 成员可维护自己的介绍和多角色绑定；修改个人默认资料不会改写项目资料，角色绑定不会改变任何权限决定。 |
| `AC-009` | core | 只有 Owner 可直接任免 Admin；Admin 资格不自动启用管理员模式，资格撤销立即终止相关能力和项目 Workspace 写资格。 |
| `AC-010` | core | 移除检查包含显式和继承有效 Owner；任一启用态未完成 Task 阻止移除并返回稳定清单，竞态不能绕过该门禁。 |
| `AC-011` | core | 合格移除保留 Membership、介绍、角色和 Task Owner，只置为 `removed/member` 并撤销租约/能力；被移除用户立即失去项目访问。 |
| `AC-012` | core | 重新加入复用同一 Membership、保持 Member 和原项目资料；旧 Task 引用重新有效，但已完成 Task 仍冻结且 Workspace 写入必须重新取得租约。 |
| `AC-013` | core | 非活动有效 Owner 的 Task Workspace 不可写；异常未完成 Task 只有活动管理员模式可修复，完成 Task 只能通过带活动 Owner 的正式重开流程改变。 |
| `AC-014` | core | Owner 转移只有一个 pending 请求，目标接受前不生效；接受后只切换唯一 Owner 字段、保留权限值，且项目始终恰有一个活动 Owner。 |
| `AC-015` | core | 管理员模式只由合格用户显式开启，项目/会话绑定，30 分钟无操作过期，并在关闭、登出、资格/状态变化时立即失效且全程审计。 |
| `AC-016` | core | Owner 专属操作、管理员模式操作和成员自助操作严格符合批准矩阵；低层 Repository、内部端口、确认或 UI 状态不能绕过。 |
| `AC-017` | core | 系统模板保持 `id/title/desc`；项目角色只有名称和单一能力/Agent 提示文本，模板快照独立且系统更新不覆盖项目。 |
| `AC-018` | core | 合格管理员可创建、编辑、复制、归档项目角色；归档保留历史绑定但拒绝新增绑定，复制得到独立活动角色。 |
| `AC-019` | core | Project/Membership/Role/Admin Mode 的授权决定完全忽略逻辑角色内容、名称和绑定；篡改 Prompt 文本不能扩大权限。 |
| `AC-020` | core | 成员移除、Admin 变化、Owner 转移、项目归档和重新加入在真实 PostgreSQL 并发与故障注入下只形成完整前态或后态，无半权限、半 Owner、遗留租约或重复记录。 |
| `AC-021` | core | 从空库和当前正式 Schema 都可前向迁移；现有 ID、引用、Task Owner、Workspace 版本和不可变审计保留，既有项目得到幂等角色快照。 |
| `AC-022` | core | 全部 M1 公共 API 位于 `/api/v1` 并进入 OpenAPI 3.1；runtime 校验、稳定错误、版本和幂等覆盖成功、拒绝、陈旧和恢复路径。 |
| `AC-023` | core | Web 可端到端完成资料、项目、申请审批、成员、Owner 转移、管理员模式和角色流程，并保留现有设备配对；关键状态可键盘访问且不只靠颜色。 |
| `AC-024` | core | 关键成功/失败有完整不可变审计和 Outbox/SSE 失效通知，不泄露秘密、项目外数据或 Workspace 正文。 |
| `AC-025` | core | 现有 Identity、Pairing、Device、Workspace、SSE、Web、内部 Task 不变量和模块边界兼容；格式、静态检查、构建、类型、测试、迁移及适用发布门禁通过。 |
| `AC-026` | core | API/Worker 不调用外部 API、AI 或 LLM；租户过滤、Cookie/Origin、秘密保护、项目最小披露和非活动 Membership 拒绝均通过验证。 |
| `AC-027` | core | 初期目标规模下 M1 页面/API 无明显卡顿或超时，未引入高可用或分布式基础设施。 |
| `AC-028` | supplemental | 参考服务器常规读 P95 `<500 ms`、普通写 P95 `<800 ms`；若精确数值未达但 core 证明无明显交付影响，可记录性能 finding。 |
| `AC-029` | supplemental | 超主体规模的附加成员/申请/角色数据、更多随机并发调度或额外锁/查询计划诊断未发现 core 证据之外的新异常。 |

## 12. 决策记录

| 决策项 | 结论 | 来源 | 回答要求 |
| --- | --- | --- | --- |
| 交付与验证策略 | `relaxed`；core 与硬门禁继续阻塞，合格 supplemental 异常可记录为 `FND-I-*` | 用户明确确认 | 必须回答 |
| 功能工作流边界 | 一个 `m1-project-role-members` schema 3.2 工作流覆盖完整 M1；规划阶段按风险比例决定阶段数量 | 采用默认回答 | 可默认 |
| 交付表面 | 同时交付 Web 与 `/api/v1`；保留设备配对，不进入 M2 Task UI、CLI 同步或 Agent 写入 | 采用默认回答 | 可默认 |
| 个人资料 | 显示名、默认介绍、默认系统角色模板集合；登录名不可修改，不增加邮箱、邮件验证或自助密码重置 | 用户明确确认、采用默认回答 | 可默认 |
| 头像 | M1 不上传头像，但必须提供显示名首字素头像占位符和可访问文本 | 用户明确确认 | 可默认 |
| 自助注册 | 保持现有开放本地账号注册和 Cookie 会话 | 项目现有约束 | 可默认 |
| 成员入口 | 用户通过精确 Project Key 申请；Owner 审批；不实现邀请；拒绝/移除后可重新申请 | 采用默认回答 | 可默认 |
| 管理权限矩阵 | Owner 直接执行治理专属操作；Owner/Admin 编辑角色或他人资料需管理员模式；成员直接编辑自己；未开启模式的 Admin 等同 Member | 用户明确确认 | 必须回答 |
| 成员移除 | Membership 与 Task Owner 引用保留；移除标记为 removed；仍有效拥有启用态未完成 Task 时禁止移除 | 用户明确确认 | 必须回答 |
| 移除阻塞范围 | 按显式和继承有效 Owner 判断；已完成 Task 与已归档子树不阻塞 | 用户明确确认、采用默认回答 | 可默认 |
| 完成冻结 | 已移除 Owner 的完成 Task 继续冻结；只能以活动 Owner 执行正式重新打开 | 用户明确确认 | 必须回答 |
| 被移除 Admin | 移除时降为 Member，重新加入不自动恢复 Admin | 用户明确确认 | 必须回答 |
| 重新加入资料 | 复用同一 Membership 并保留项目介绍/逻辑角色，不重新复制个人默认资料 | 采用默认回答 | 可默认 |
| 角色模型 | 取代旧 ROL-004；模板只用 `id/title/desc`，项目角色为名称加单一能力文本，能力文本同时是 Agent 提示 | 用户明确确认 | 必须回答 |
| 项目归档 | 归档继续可读但项目范围只读；Owner 可解除归档；不等同项目备份恢复 | 采用默认回答 | 可默认 |
| Owner 转移 | 单一 pending、Owner 可取消、目标可接受/拒绝、不自动过期；只更新 Owner 字段且权限值不变 | 采用默认回答 | 可默认 |
| 角色归档 | 保留历史绑定，不可新增绑定；通过复制创建新的活动角色 | 采用默认回答 | 可默认 |
| 数据迁移 | 前向保留当前数据并补默认资料/角色快照，不执行隐式 reset | 采用默认回答、项目现有约束 | 可默认 |
| 基础设施 | 保持模块化单体、PostgreSQL 和单机 Docker Compose，不增加分布式基础设施 | 项目现有约束 | 可默认 |

## 13. 未决问题

无。
