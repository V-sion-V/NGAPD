# M1：项目、角色和成员实施路线图

## 1. 范围与执行模式

- 功能 ID：`m1-project-role-members`
- 工作流 schema：`3.2`
- 运行编号：`initial`
- 执行模式：`phased`
- 详细度：`expanded`
- 交付与验证策略：`relaxed`
- 路线图修订：`1`
- 需求指纹：`sha256:f3ab380a2826c494223aff7b3c7ae7c9e8904d8d2ddf2ad0392adb26488020d8`
- 项目基线：分支 `requirements/m1-project-role-members`，提交 `f9efee992394f1b6761182237cf736f79561ad5b`
- 规划日期：`2026-07-28`

采用三阶段和 expanded 详细度的原因不是工作时长，而是以下已记录风险同时存在：

1. 当前正式数据库停在 `0001`—`0007`，Membership 仍以 `role + active` 表达；M1 必须前向保留数据地迁移到 `permission_level + status`，并让旧正式前缀可以被识别为可迁移状态。这是不可通过简单代码回退撤销的 Schema 迁移边界。
2. 成员移除、Task Owner 创建/指派、权限变化、项目归档、所有权转移和 Workspace 租约由多个现有事务入口写入，必须先建立统一锁顺序、状态权威和恢复边界，避免把数据库与公共 API 同时置于半迁移状态。
3. 后端 `/api/v1` 与 Web 是两个可独立验证的交付表面；先完成可兼容运行的数据库/领域基础，再交付后端闭环，最后由 Web、正式文档和整体门禁完成集成验收。

规划前工作区已有用户创建但尚未跟踪的 `workflow-contract.md` 与 `requirements.md`。本路线图保留这两份输入，不把它们记为规划阶段产出的实现改动。

## 2. 项目现状与全局实现依据

- M0 `change-0`、`change-1`、`change-2` 均已封存为 `completed/passed`；当前没有活动 M0 纠正运行。其有效基线已经提供 Project/Task 标识、有效 Owner、任务冻结、Task/Workspace 原子端口、审计、Outbox/SSE、Identity/Pairing/Workspace 公共入口和模块边界。
- `packages/contracts` 已使用 TypeBox，但当前 Project 契约只覆盖 M0 领域状态；Identity 的 `SessionActor` 是既有兼容面，尚无个人资料、Membership、Join Request、Project Role、Owner Transfer 或 Admin Mode 公共 DTO。
- `packages/domain` 已有纯函数式 Workspace/Task 授权和有效 Owner 解析；Membership 仍以 `active: boolean` 与 `role: admin/member` 表达，尚无 M1 状态机、治理权限矩阵、角色归档或成员移除阻塞集合。
- `packages/database` 的正式 profile 当前为 `m0-domain-baseline / version 1`，迁移前缀为 `0001`—`0007`。`users` 缺少默认资料，`memberships` 仍为 `role + active`；Join Request、项目角色、成员角色绑定、Owner Transfer、Admin Mode 和通用 M1 幂等记录均不存在。
- `FoundationRepository` 已能在同一事务创建 User/Workspace 和 Project/Owner Membership/虚拟根/Workspace，但项目创建尚未包含说明、幂等和 74 个系统模板快照。
- Task、Task Lifecycle 和 Workspace Repository 已承载低层 Owner、冻结、租约和授权事实。M1 不得旁路这些端口；成员移除与 Task Owner 写入必须共享 Membership 生命周期锁和稳定锁顺序。
- `apps/api` 已注册 Identity、Events 和 Workspace 公共路由，内部 Task Application Service 尚未开放公共 Task CRUD；模块边界已预留 `projects-membership`、`roles` 与 `authorization-audit`。
- `apps/web` 当前只交付注册/登录、设备配对与设备撤销页面；M1 项目、成员、角色和管理员模式界面需要在同一 React/TanStack Query 应用中增量扩展。
- `apps/worker` 只消费已提交 Outbox 并维护失效投影，不拥有 Membership、Owner、Role 或 Admin Mode 权威状态；M1 继续保持该边界。
- `docs/11-logical-role-templates.json` 当前含 74 个唯一的 `id/title/desc` 模板。生产构建尚未消费该文件，P-001 必须建立随包发布且与该 JSON 一致的模板来源。
- 正式产品、领域、权限、架构、路线和决策文档仍包含被本需求明确取代的 `MEM-006`、`ROL-004` 与 M2 成员移除结论；只能修订活动设计文档，不得改写 M0 封存执行证据。

## 3. 全局详细设计

### 3.1 组件与权威边界

- `packages/contracts` 定义 M1 的共享 runtime Schema、DTO、资源版本、调用者可执行动作和稳定错误码。既有 Identity/Pairing/Workspace 输入输出保持兼容；个人资料使用独立资源契约，不依赖扩大现有 `SessionActor` 必填形状。
- `packages/domain` 拥有 Project/Membership/Join Request/Owner Transfer/Project Role/Admin Mode 的纯状态转换、资格矩阵和失败原因；逻辑角色内容永不参与授权。成员移除阻塞集合复用有效 Owner 语义，但数据库事务负责锁定与重查。
- `packages/database` 拥有前向迁移、约束、Repository、锁顺序、幂等、故障原子性、审计和 Outbox。路由和 Web 不直接写表。
- `apps/api` 在 Identity、Projects/Membership、Roles、Authorization/Audit 与 Workspaces/Tasks 模块间通过应用服务组合事务，不复制权限规则。所有公开写入位于 `/api/v1`，由 TypeBox 拒绝未知字段，并进入 OpenAPI 3.1。
- `apps/web` 只消费共享 DTO、`actions` 与管理员模式状态；不得根据角色名、客户端 Membership 状态或页面显示自行放行。
- `apps/worker` 仅把已提交 Outbox 转为授权后的 SSE 失效提示。业务提交和 Admin Mode 权威判断留在请求事务。

### 3.2 跨阶段接口

- 资源响应统一返回稳定 ID、状态、整数版本及 `actions`；写命令携带资源版本，重试型命令同时携带幂等键。错误沿用 `{code,message,requestId,currentVersion?,recovery?}`。
- Project 对外以不可变 Key 定位、内部始终以服务端解析的 UUID 做租户过滤。精确 Key 申请目标使用单独的最小披露 DTO，不复用完整 Project 详情。
- 个人资料、Project、Membership、Join Request、Project Role、Owner Transfer 和 Admin Mode 分别有独立资源 Schema；系统模板仍只含 `id/title/desc`。
- Admin Mode 绑定 Web Session、Project 与 Membership。有效性由服务端时间、最后一次成功的受保护管理操作、资格和项目状态共同派生；普通页面轮询不续期。开启、关闭、拒绝、资格撤销和首次观察到过期均通过应用服务审计，签发时同时记录确定的失效时间。
- 失效事件使用显式 `user` 或 `project` 受众，投影层只能向当前登录用户本人或当前活动项目成员发出重新获取提示；载荷不携带密码、令牌、说明正文、角色能力文本或 Workspace 正文。
- P-003 Web 只依赖 P-002 已冻结的共享契约与 OpenAPI，不直接依赖 Repository 实现。

### 3.3 数据与迁移

- 追加唯一前向迁移 `0008-m1-project-role-members`，保留 `0001`—`0007` 历史。Schema profile 检查必须把正式 version 1 + 完整 `0001`—`0007` 识别为 `behind`，允许迁移完成后原子更新到新的 ready version；未知、原型或非前缀历史继续 fail closed。
- `users` 增加 `display_name`、`default_introduction`；现有行按需求回填。默认模板绑定使用去重关联表。
- `projects` 增加说明；继续以 `owner_membership_id`、`lifecycle` 和 `version` 为权威，并为唯一活动 Owner 增加数据库可验证约束/延迟检查。
- `memberships.role` 前向迁移为 `permission_level`，`active` 前向迁移为 `status`，补充项目介绍和版本；`active=false` 必须得到 `removed/member`。最终生产代码不得保留两个可分歧的 Membership 权威字段。
- 增加 Join Request、System Template/Project Role、Membership Role Binding、Owner Transfer、Admin Mode 和 M1 幂等记录表；唯一 Membership、唯一 pending 请求/转移、模板快照和绑定去重同时由数据库约束保护。
- 版本控制模板 JSON 必须随生产包发布，并与 `docs/11-logical-role-templates.json` 做精确字段/ID 一致性校验；项目快照在项目创建和既有项目回填中均幂等。
- M1 不迁移现有 Task `logical_role` 字符串为 Project Role 外键，不引入临时公共 Task 契约。
- 迁移从空库和正式 `0007` 前缀都必须成功且重复 migrate 为 no-op；不得在实现或验收中调用隐式 reset。迁移提交后不宣称旧应用镜像可以安全降级。

### 3.4 事务、并发与锁顺序

- 治理事务按 `Project → Membership（稳定 ID）→ Request/Admin Session → Task（稳定 ID）→ Workspace/Lease（稳定 ID）` 锁定。所有会创建或改变 Task 有效 Owner 的低层入口在授权前锁定目标 Membership 生命周期事实，成员移除以同一行作为串行化边界。
- 成员移除锁定目标 Membership 后，按启用态任务树解析显式和继承有效 Owner；归档顶层子树退出阻塞集合。检查、`removed/member` 写入、Admin Mode 撤销、相关租约撤销、审计、Outbox 和幂等结果同事务提交。
- Project 创建同事务建立 Project、Owner Membership、虚拟根、项目 Workspace/版本和完整角色快照；重复幂等键返回原结果，不分配第二套资源。
- Join Request 和 Owner Transfer 在锁内重查 Project、当前 Owner、目标 Membership、请求状态及版本；陈旧操作不产生第二次成功审计。
- 归档、解除归档、Admin 任免和 Owner 转移都在同一事务重算写资格并撤销已失效租约/Admin Mode。解除归档只恢复 Project active，不恢复旧能力或租约。
- 故障注入点至少覆盖 Project 创建、审批/重新加入、成员移除、Admin 降权、Owner Transfer 接受和项目归档的权限/租约/审计/Outbox 边界。

### 3.5 安全、错误与不可信内容

- 所有项目查询使用服务端解析的 `project_id` 和活动 Membership；客户端 Key、Membership ID、`actions`、管理员标志和逻辑角色字符串都不构成授权事实。
- Owner 专属、活动 Admin Mode 和成员自助三类操作分别使用独立领域决策；人工确认、低层 Repository 或 UI 可见性不能替代授权。
- Cookie/Origin、Argon2id、会话与设备兼容规则不变。秘密、管理员能力材料和 Workspace 正文不得进入错误、普通日志、审计或 OpenAPI 示例。
- 显示名、说明、介绍、角色名称和能力文本按不可信 Markdown/Prompt 内容处理；Web 安全渲染，服务端永不执行或据此授权。
- 所有失败返回稳定机器码、可恢复说明和适用的当前版本；Project Key 冲突和精确 Key 查询不得泄露项目外数据。

### 3.6 可观测性、事件与运行

- 成功与失败尝试写不可变 AuditEvent，包含 actor、actor type、project、target、request ID、前后版本、结果和稳定原因码；安全审计与诊断日志分离。
- 成功写入在同一事务写 Outbox；SSE 只通知重新获取。用户受众和项目受众都必须经过当前会话/成员资格过滤。
- API/Worker ready 继续依赖正式 Schema profile；`0008` 未完成时不得提供 M1 写入。
- 不新增外部 API、AI/LLM、Redis、独立队列/搜索/对象服务或高可用基础设施。

### 3.7 发布、兼容与恢复

- P-001 结束时，新 Schema/领域基础必须与当前 Identity、Pairing、Workspace、内部 Task 和 SSE 行为兼容，但不开放半成品 M1 路由。
- P-002 结束时，后端公共 API、OpenAPI、审计、Outbox/SSE 与真实 PostgreSQL 并发闭环可独立验证；Web 尚未接入时现有页面仍可使用。
- P-003 完成 Web、活动正式文档与最终发布门禁。缺少 Linux Docker 或参考服务器时，相关验证必须明确记录为未运行，不能写成通过。
- 迁移失败依赖 PostgreSQL 事务保留 `0007` 事实并给出诊断。已应用 `0008` 后的应用回退只能按发布说明 roll forward，或恢复经确认的数据库备份；不得执行自动 down/reset。

## 4. 阶段路线图

| 阶段 | 目标 | 关联需求与验收 | 前置阶段 | 退出条件 | 当前状态 |
| --- | --- | --- | --- | --- | --- |
| P-001 | 建立 M1 共享契约、领域规则和可从正式 `0007` 前向迁移的数据基础，同时保持现有公共行为可构建可验证 | FR-001–FR-046 的契约/领域/数据基础；AC-001–AC-022、AC-024–AC-026 的基础与迁移部分 | 无 | `0008` 从空库和正式 `0007` 前缀迁移成功且重复执行无变化；模板、约束、状态机、授权和现有 Repository 适配通过目标测试；当前 Identity/Pairing/Workspace/Task 兼容门禁与根工程门禁通过；没有 M1 半成品公共路由 | ready |
| P-002 | 交付完整 M1 后端应用服务、Repository、`/api/v1` 路由、OpenAPI、审计、Outbox/SSE 和真实 PostgreSQL 原子/并发闭环 | FR-001–FR-046；AC-001–AC-022、AC-024–AC-027 | P-001 | 全部 M1 后端成功、拒绝、陈旧、幂等、故障和并发路径通过；公共 API/OpenAPI 可独立完成 M1 闭环；既有公共入口兼容且工程保持可构建 | planned |
| P-003 | 交付中文 Web 闭环、可访问状态、正式文档同步和最终集成/发布验收 | FR-001–FR-047；AC-001–AC-029 | P-002 | Web 完成全部 M1 流程并满足键盘/非颜色标识；活动正式文档、AGENTS/README（如受影响）与实现一致；全部 core 和硬门禁通过，supplemental 结果已通过或以合格 `FND-I-*` 汇总；生成初始完成证据的条件全部满足 | planned |

只有 P-001 有即时详细阶段计划。P-002、P-003 必须分别在前置阶段完成并复核项目事实后由后续 `$plan-feature-implementation` 调用生成详细计划。

## 5. 跨阶段依赖与不变量

- 项目在每个可提交状态恰有一个同项目活动 Owner；Membership 不物理删除，Owner 不写入 `permission_level`。
- 逻辑角色内容、名称、模板来源和绑定永不参与 Web、Workspace、Agent 或 Admin Mode 授权。
- 非活动 Membership 不能读取项目、取得项目/Task Workspace 写租约、成为新的显式 Owner 或执行成员操作。
- 成员移除不改写任何 Task Owner；持有启用态未完成 Task 有效 Owner 的 Membership 不能被移除；已完成 Task 继续冻结。
- 权限、资格、项目生命周期或 Owner 变化不能留下仍有效的 Admin Mode 或 Workspace 租约。
- Identity/Pairing/Device/Workspace/SSE 和内部 Task 现有公共/应用端口持续兼容；P-001、P-002 不得用临时路由或 Web 逻辑替代服务端规则。
- 数据迁移只前向保留 ID、引用、Workspace 版本、Task Owner、任务状态和不可变审计；任一阶段不得隐式 reset。
- 只有一个阶段可以处于 `ready/in_progress/paused/blocked`；阶段完成证据一经写入不得修改。
- `relaxed` 不降低 core、安全、隐私、数据、兼容、构建、恢复或发布硬门禁。下一可用 finding ID 从 `FND-I-001` 开始。

## 6. 最终集成与整体验证流程

1. **Schema 与数据完整性硬门禁**：在真实 PostgreSQL 17 上验证空库迁移、正式 `0007` 数据前向迁移、重复 migrate、约束、回填、74 个模板快照、保留式 Membership/Task Owner/Workspace/审计事实及迁移失败回滚。
2. **领域与事务硬门禁**：验证状态机、权限矩阵、精确 Key 最小披露、唯一 Owner/Membership/pending 请求/转移、成员移除与 Task Owner 竞态、归档/权限/租约/Admin Mode 原子性及故障注入。
3. **API 与兼容硬门禁**：验证所有 M1 `/api/v1` 路由、OpenAPI 3.1、运行时校验、稳定错误、版本、幂等、审计、Outbox/SSE 受众过滤，并重跑 Identity/Pairing/Device/Workspace/内部 Task 兼容测试。
4. **Web core 验收**：使用真实 API 完成资料、项目、申请审批、成员、Admin 任免、移除/重新加入、Owner Transfer、Admin Mode、项目角色和归档/解除归档流程；验证危险动作后果、中文恢复提示、键盘操作和颜色之外的状态表达。
5. **工程与发布硬门禁**：运行受影响包测试/类型检查、根 `pnpm check`、数据库迁移门禁及适用的 `pnpm compose:smoke`；确认 API/Worker ready、Caddy/Web、PostgreSQL 与对象存储边界未退化。
6. **非功能与 findings 收口**：在目标规模下确认无明显卡顿或超时；对 AC-028 的参考 P95 和 AC-029 的额外规模/随机并发诊断保留独立证据。只有被证明不影响交付的 supplemental 异常可按 `FND-I-*` 记录为 report-only；其余异常阻塞完成。

验证只在其结果仍有效的最晚阶段执行一次。P-001/P-002 的阶段级构建和回归在后续生产改动后会失效，因此 P-003 必须重新执行最终门禁；不会为 relaxed 策略人为增加 red-first 或无来源的重复全量诊断。

## 7. 需求追踪矩阵

| 需求/验收组 | 实现阶段 | 验证与完成证据 |
| --- | --- | --- |
| FR-001–FR-005 / AC-001–AC-002 | P-001 数据/契约；P-002 Identity 应用/API；P-003 Web/最终验收 | 注册事务兼容、资料隔离、模板集合校验、头像字素与可访问文本 |
| FR-006–FR-010 / AC-003–AC-005 | P-001 Project Schema/领域；P-002 项目事务/API；P-003 Web/最终验收 | 原子创建与幂等、Key 最小披露、归档/解除归档及租约/Admin Mode 失效 |
| FR-011–FR-017 / AC-006–AC-009 | P-001 Membership/Request/授权基础；P-002 Repository/API；P-003 Web/最终验收 | 唯一 Membership/pending、首次/再次批准资料语义、自助与 Owner/Admin 权限矩阵 |
| FR-018–FR-025 / AC-010–AC-013 | P-001 移除规则和共享锁契约；P-002 Task/Workspace 原子事务；P-003 最终竞态验收 | 显式/继承 Owner 阻塞清单、保留式移除、重新加入、异常修复与完成冻结 |
| FR-026–FR-034 / AC-014–AC-016 | P-001 Transfer/Admin Mode 状态与数据；P-002 应用/API/审计；P-003 Web/最终验收 | 唯一 pending Transfer、唯一活动 Owner、30 分钟失效、Owner 专属与 Admin Mode 矩阵 |
| FR-035–FR-039 / AC-017–AC-019 | P-001 模板/角色/绑定基础；P-002 角色应用/API；P-003 Web/最终验收 | 74 模板快照、角色编辑/复制/归档、历史绑定保留、Prompt 篡改不授权 |
| FR-040–FR-046 / AC-020–AC-027 | P-001 契约/迁移；P-002 API/事务/审计/Outbox/SSE；P-003 整体兼容与发布门禁 | PostgreSQL 并发/故障、前向迁移、OpenAPI、SSE 过滤、安全、无外部调用和目标规模 |
| FR-047 / AC-025 | P-003 | 活动正式文档、路线、决策、AGENTS/README 真实性核查；M0 封存证据未改写 |
| AC-028 supplemental | P-003 | 参考服务器读写 P95；不影响 core 的异常可登记 `FND-I-*` |
| AC-029 supplemental | P-003 | 额外主体规模、随机并发或锁/查询计划诊断；不影响 core 的异常可登记 `FND-I-*` |

## 8. 风险、技术决策与修订记录

### 8.1 风险与控制

| 风险 | 影响 | 控制与阶段 |
| --- | --- | --- |
| 正式 version 1 数据库被新版 profile 误判为 unknown | 无法前向迁移或诱导破坏性 reset | P-001 为 `0001`—`0007` + version 1 建立明确 `behind` 路径，并做真实升级测试 |
| Membership 字段迁移后旧 Repository/fixtures 继续读取 `active/role` | 构建失败或产生双重权威 | P-001 同阶段改完生产查询、类型和夹具；最终只保留 `status/permission_level` |
| 成员移除与 Task 创建/Owner 变化并发穿透 | 产生已移除有效 Owner 或遗留写租约 | P-001 定义共享 Membership 锁；P-002 更新所有低层写入口并做真实并发/故障注入 |
| Admin Mode 由客户端状态或定时 Worker 扩权 | 能力过期不确定或 Worker 成为权威 | 由请求事务按 Web Session/Project/Membership/服务端时间派生；Worker 只做已提交投影 |
| 模板仅存在于 docs，生产镜像不可读或发生漂移 | 项目快照不完整 | P-001 建立随包发布的版本控制 JSON 与 `docs/11` 一致性测试 |
| 精确 Project Key 查询或 SSE 泄露项目外信息 | 隐私/IDOR | 独立最小 DTO、服务端 UUID 租户过滤、用户/项目受众过滤和 API 负向测试 |
| P-002 后端范围较大 | 难以恢复或隐藏跨模块旁路 | 只把可独立验收的后端闭环作为一个阶段，阶段内按 Repository/应用/API 任务检查点执行；不拆出不能安全交付的半事务阶段 |
| 活动正式文档保留旧 MEM-006/ROL-004 | M2 或 Agent 读取错误规则 | P-003 同实现收口修订活动文档并明确不改写封存证据 |

### 8.2 技术决策

- `TD-001`：采用 `phased + expanded` 三阶段；依据是前向迁移/公共兼容边界、多个事务写入者及可独立验收的后端与 Web 表面。
- `TD-002`：P-001 只建立数据、领域和共享契约基础，不开放 M1 公共路由；避免客户端依赖半实现资源。
- `TD-003`：Membership 最终只有 `status` 与 `permission_level` 两个权威字段；不长期维护 `active/role` 兼容影子。
- `TD-004`：Admin Mode 的过期由服务端时间和受保护管理操作活动派生，普通轮询不续期，Worker 不拥有权威状态。
- `TD-005`：成员移除和所有 Task Owner 写入口共享 Membership 生命周期锁；这是跨模块端口，不允许只在移除路由内检查。
- `TD-006`：版本控制模板数据必须随生产包发布，并由 parity 测试固定 `docs/11` 的 74 个 `id/title/desc`；不从 Prompt 或 Web 临时数据建快照。
- `TD-007`：M1 只建立稳定 Project Role ID；当前内部 Task `logical_role` 集成留给 M2。

### 8.3 修订记录

| 修订 | 日期 | 结论与依据 | 影响阶段 | 追踪影响 |
| --- | --- | --- | --- | --- |
| 1 | 2026-07-28 | 首次路线图；基于已批准 schema 3.2 requirements、M0 completed/passed 证据、正式 `0001`—`0007` Schema 与当前模块事实，采用三阶段 expanded 规划 | P-001–P-003 | FR-001–FR-047 与 AC-001–AC-029 全部建立阶段和验证映射 |
