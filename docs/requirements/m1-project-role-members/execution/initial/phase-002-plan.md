# M1 初始实现 P-002：后端应用、公共 API 与事务闭环

- 运行编号：`initial`
- 阶段编号：`P-002`
- 阶段计划修订：`1`
- 父路线图修订：`1`
- 需求指纹：`sha256:f3ab380a2826c494223aff7b3c7ae7c9e8904d8d2ddf2ad0392adb26488020d8`
- 项目基线：分支 `requirements/m1-project-role-members`，提交 `f9efee992394f1b6761182237cf736f79561ad5b`；P-001 未提交完成态工作树
- 创建日期：`2026-07-28`
- 详细度：`expanded`
- 交付与验证策略：`relaxed`
- 验证结论：`pending`

## 1. 阶段目标、边界与关联需求

### 1.1 目标

在 P-001 已封存的 schema version 2/`0008-m1-project-role-members`、共享契约和纯领域规则上，交付不依赖 Web 也能独立验收的完整 M1 后端闭环：

- 当前用户资料、项目、Membership/Join Request、Owner Transfer、Admin Mode 和 Project Role 的 Repository 与应用服务；
- 所有权限、资格、项目生命周期、Task Owner 和 Workspace 租约相关写入的统一锁顺序、幂等、版本、审计、Outbox 与故障原子性；
- 完整 `/api/v1` 公共路由、共享 TypeBox runtime Schema、OpenAPI 3.1、稳定错误、最小披露、调用者 `actions` 与管理员模式状态；
- 真实 PostgreSQL 17 下成功、拒绝、陈旧、重复、并发和故障路径，以及现有 Identity/Pairing/Device/Workspace/SSE/内部 Task 的兼容证据。

关联需求为 FR-001–FR-046；阶段直接门禁覆盖 AC-001–AC-022、AC-024–AC-027 中可由后端独立证明的全部结果。AC-023 的 Web 端到端、FR-047 的活动正式文档同步、AC-028/AC-029 supplemental 诊断和最终 Compose/参考服务器发布验收保留给 P-003。

### 1.2 已验证前置

- `workflow-contract.md` 为 schema `3.2`；requirements、roadmap 与 P-001 plan/result 的 SHA-256 分别为 `f3ab380a...020d8`、`94c85511...5de22`、`87d211f6...17964`、`eb06f279...c255f`，均与执行状态一致。
- P-001 已有 immutable `completed/passed` 结果；运行状态为 `awaiting_next_phase`，没有其他 `ready/in_progress/paused/blocked` 阶段，也没有 `change-0.md` 或冻结的初始历史。
- P-001 记录的 `migrations.ts`、`types.ts`、`schema-profile.ts`、Foundation/Task/Task Lifecycle/Workspace/Outbox Repository after-state 指纹与当前文件逐一匹配；当前 diff 只包含已记录的 P-001 产出和用户已有 M1 输入。
- 正式 Schema 已为 version 2/`0008`；M1 表、约束、74 个生产模板、精确 Outbox 受众与 `m1_idempotency_records` 已存在。当前 API 仍只注册 Identity、Events 和 Workspace 公共路由，没有 M1 半成品路由。
- 当前仓库惯例为 Fastify route → application service → Kysely Repository/领域决策；成功业务写入在事务内写审计/Outbox，拒绝由应用层记录稳定原因；OpenAPI 由路由 runtime Schema 生成。
- 活动正式设计文档仍含需求已明确取代的 MEM-006/ROL-004 旧结论。它们不是 P-002 的实现权威，按路线图由 P-003 一次性同步；本阶段不得据此恢复“移除时清空 Task Owner”或多字段角色模型。
- P-001 的 PostgreSQL/Node 临时环境已清理；P-002 验证必须新建显式隔离目标，不得假定 `ngapd_p001` 或 55437 仍存在。

### 1.3 阶段退出不变量

- 每个可提交状态恰有一个同项目活动 Owner；Membership 不物理删除，Owner 不写入 `permission_level`，角色内容永不参与授权。
- 所有会创建或改变有效 Task Owner、成员状态、管理资格、项目生命周期或项目/Task Workspace 写资格的入口按 `Project → Membership（稳定 ID）→ Request/Admin Session → Task（稳定 ID）→ Workspace/Lease（稳定 ID）` 锁定并在提交前重查。
- 成员移除保留 Membership、介绍、角色绑定和全部 Task Owner；启用态未完成 Task 的显式或继承有效 Owner 会阻塞移除，且并发 Task Owner 写入不能穿透。
- 成功写入的业务状态、幂等结果、审计和 Outbox，以及需要的 Admin Mode/租约撤销处于同一事务；中途失败只能留下完整前态。失败尝试在事务回滚或确定拒绝后记录一次稳定审计，不产生成功 Outbox。
- Admin Mode 只绑定当前 Web Session/Project/Membership；只有成功的受保护管理操作续期，关闭、过期、登出、资格/状态变化和项目归档使旧能力失效。
- 所有公共 Project 查询以服务端解析 UUID 和活动 Membership 做租户过滤；精确 Project Key 申请目标只返回最小 DTO，SSE 只发重新获取提示。
- Identity、Pairing、Device、Workspace、SSE、Worker 和内部 Task 端口持续兼容；Web 未接入时现有页面仍可使用。
- P-002 不修改 P-001 immutable result、不开放公共 Task CRUD、不实现 Web、不修改活动正式设计文档或 M0 封存证据，也不调用隐式 reset/down。

## 2. 任务与文件范围

### 2.1 任务

| 任务 | 结果 | 文件或范围 | 实现摘要 | 验证 | 完成条件 |
| --- | --- | --- | --- | --- | --- |
| P-002-T-001 | M1 Repository 与所有跨模块治理事务形成唯一数据库写入边界 | `packages/database/src`、相关 Repository integration tests、必要的 `packages/test-fixtures/src` | 增加 Profile、Project/Membership/Join Request/Transfer/Admin Mode 与 Project Role Repository；复用 P-001 领域决策和 `m1_idempotency_records`；按固定锁顺序组合项目、Membership、Task、Workspace Lease、审计和 Outbox；补齐现有 Task Owner 写入口的共享 Membership 生命周期锁；实现稳定排序、最小查询和故障注入 | V-006 | 真实 PostgreSQL 上全部资源读写、幂等/版本/约束、租约与能力失效、移除/转移/归档竞态和故障前后态通过；没有新 Schema 或双重权威 |
| P-002-T-002 | M1 应用服务统一完成身份解析、授权、资源映射和失败审计 | `packages/contracts/src`、`apps/api/src/modules/identity`、新建 `projects-membership`、`roles`、`authorization-audit` 服务及目标测试 | 只为缺失的列表/详情/参数/组合响应增补共享 Schema；建立 Profile、Project、Membership、Role 与 Admin Mode 应用服务；服务端派生 `actions`/当前 Admin Mode，调用纯领域权限；把 Repository 失败映射到稳定 `ApplicationError`，并对拒绝/异常尝试写去重审计 | V-007 | 所有 FR-001–FR-041/FR-043–FR-046 后端用例可经应用服务完成；Owner 专属、Admin Mode 与成员自助矩阵及失败恢复均有目标测试，低层调用不能绕过授权 |
| P-002-T-003 | 完整 M1 `/api/v1`、OpenAPI、SSE 与兼容门禁可独立验收 | 新建 M1 routes/integration tests、`apps/api/src/app.ts`、受影响现有 API/Worker tests 与工作流证据 | 注册完整 profile/project/member/request/transfer/admin-mode/role 路由；所有状态改变请求执行现有 Origin/会话保护；用共享 runtime Schema 拒绝未知字段；验证 OpenAPI 3.1 路径/响应、精确受众 Outbox→Worker→SSE、现有入口兼容、目标规模无明显卡顿和阶段根门禁 | V-008、V-009 | API 可在无 Web 情况下完成全部 M1 后端闭环；OpenAPI/稳定错误/安全负向与 SSE 过滤通过；根工程可构建，生成 immutable P-002 result 并把运行置为 `awaiting_next_phase` |

依赖顺序：`P-002-T-001 → P-002-T-002 → P-002-T-003`。任一任务未完成或进入 paused/blocked 时不得开始下一任务。

### 2.2 预期文件所有权与接口

| 文件或范围 | 预期目的与接口约束 |
| --- | --- |
| `packages/database/src/project-membership-repository.ts`、对应 integration test | Project/Membership/Join Request/Owner Transfer/Admin Mode 的读写、幂等、锁、版本、审计、Outbox、租约撤销和故障边界；任何 actor/project/target 都在事务内重查 |
| `packages/database/src/project-role-repository.ts`、对应 integration test | 系统模板和 Project Role 稳定排序读取；角色创建/编辑/复制/归档与 Membership 绑定；归档保留历史绑定，Role 字符串不参与授权 |
| `packages/database/src/identity-repository.ts`、`foundation-repository.ts` 及现有 integration tests | 个人资料/default template 的版本化读写；注册与项目原子创建由新的业务事务安全复用，不保留绕过幂等/审计/Outbox 的公共 M1 写路径 |
| `packages/database/src/task-repository.ts`、`task-lifecycle-repository.ts`、`workspace-repository.ts` 及目标 tests | 所有 Task Owner 创建/指派/重开入口继续先锁目标 Membership；提供治理事务需要的稳定任务阻塞读取与 project/task lease 撤销，不改变 M0 Task 语义 |
| `packages/database/src/index.ts` | 只导出正式 Repository/结果类型；测试 helper 不进入生产导出 |
| `packages/contracts/src/identity.ts`、`projects.ts`、`memberships.ts`、`ownership-transfers.ts`、`admin-mode.ts`、`roles.ts`、`errors.ts`、`index.ts` 与 `m1-contracts.test.ts` | 保留 P-001 已有资源/请求兼容；增补稳定 params、collection/detail response 和必要动作/错误，不把数据库行、秘密或管理能力材料暴露为 DTO |
| `apps/api/src/modules/identity/service.ts`、`routes.ts` | 增加当前用户 profile GET/PATCH；继续复用现有 Web Session、Cookie、Origin、Argon2id 和登录输入输出 |
| `apps/api/src/modules/projects-membership/{index,service,routes}.ts` | 项目、申请、成员、权限、移除、Owner Transfer 与生命周期公共应用边界；只调用正式 Repository/领域决策 |
| `apps/api/src/modules/roles/{index,service,routes}.ts` | 系统模板和项目角色目录、创建/编辑/复制/归档；他人资料/角色治理必须消费已验证 Admin Mode |
| `apps/api/src/modules/authorization-audit/{index,service,routes}.ts` | 当前 Web Session 的 Admin Mode 开启/读取/关闭、受保护操作能力解析和拒绝审计；不得把客户端状态当权威 |
| `apps/api/src/app.ts`、`application-errors.ts`、M1 integration tests | 构造并注册新服务/路由，统一稳定错误；用真实 PostgreSQL 验证公共闭环、OpenAPI、Origin、最小披露、SSE 和兼容 |
| `apps/worker/src/outbox-task.integration.test.ts`、Events integration tests | 仅在新 M1 事件暴露通用投影缺口时调整；Worker 仍只消费已提交 Outbox，不拥有业务事务 |

`packages/database/src/migrations.ts`、`types.ts`、`schema-profile.ts` 和 P-001 phase result 不在预期修改范围。若 T-001 发现 `0008` 无法表达任一 core 不变量，执行者必须停在当前任务、记录证据并由 rolling planning 修订路线图或追加 corrective phase；不得静默改写 P-001 已完成迁移或完成证据。

### 2.3 公共路由与响应边界

P-002 以现有 REST/TypeBox 约定固定以下公共能力；实施可抽取共享参数 Schema，但不得删除任何能力或改为临时内部路由：

- Profile：`GET/PATCH /api/v1/users/me/profile`。
- Project：`GET/POST /api/v1/projects`、`GET /api/v1/projects/:projectKey`、`GET /api/v1/projects/:projectKey/join-target`、`POST /api/v1/projects/:projectKey/lifecycle`。
- Join/Membership：`POST /api/v1/membership-join-requests`；`GET /api/v1/projects/:projectKey/join-requests`；`POST /api/v1/projects/:projectKey/join-requests/:requestId/decision`；`GET /api/v1/projects/:projectKey/members`；成员 profile、permission、removal preview/remove 使用 `.../members/:membershipId/...` 子资源。
- Ownership：`GET/POST /api/v1/projects/:projectKey/ownership-transfers` 与 `POST .../ownership-transfers/:transferId/resolve`。
- Admin Mode：`POST /api/v1/admin-mode/sessions`、`GET /api/v1/admin-mode/sessions/:adminModeId`、`POST /api/v1/admin-mode/sessions/:adminModeId/close`。
- Roles：`GET /api/v1/system/logical-role-templates`；`GET/POST /api/v1/projects/:projectKey/roles`；`GET/PATCH /api/v1/projects/:projectKey/roles/:roleId`；复制和归档使用该角色下的显式动作子资源。

Project 详情组合响应必须包含 Project、当前 Membership（如有）、当前 Web Session 对该项目的 Admin Mode 状态及服务端派生 `actions`。列表均显式稳定排序；非成员精确 Key 查询只使用 join-target DTO。任何路径命名的机械修正必须在任务检查点和 OpenAPI inventory 中记录；若改变上述资源语义或公共兼容边界，必须暂停并请求用户确认。

### 2.4 有序实施步骤

1. 开始 P-002-T-001 前，把运行/阶段置为 `in_progress`，记录当前任务、P-001 完成态基线与预期文件；使用新的显式 PostgreSQL 17 隔离目标。
2. 先实现只读投影和稳定排序，再实现写事务。所有治理事务按全局锁顺序执行；幂等 replay 必须比较 request SHA-256，并返回原业务响应而不产生第二次成功审计/Outbox。
3. Project 创建原子复用 User、Owner Membership、根作用域、项目 Workspace/初始版本和 74 快照；申请首次批准复制当时用户默认资料，重新批准保留原 Membership 资料。移除、归档、Admin 降权和 Owner Transfer 必须在同一事务撤销失效 Admin Mode/租约。
4. 成功路径在同一事务写状态、幂等结果、不可变审计和精确受众 Outbox。确定拒绝或故障回滚后由应用边界写一次失败审计；若数据库整体不可用则传播运行错误，不伪造已审计结论。
5. P-002-T-002 在 T-001 检查点后实现服务和资源映射；每个入口先解析 Web Session，再解析服务端 project UUID、活动 Membership 与 Admin Mode，最后调用 Repository。Role、`actions`、Membership ID 和客户端确认都不能替代授权。
6. P-002-T-003 只在服务目标测试通过后注册路由；状态改变请求复用 Same-Origin 防护，schema 拒绝未知字段，OpenAPI 声明所有成功与稳定错误响应。
7. 最终 M1 API integration 使用真实数据库覆盖首轮/重试/陈旧/拒绝/故障/并发与 Outbox 投影；兼容测试和根门禁只在所有生产改动完成后运行一次。通过后写阶段结果并交回 P-003 rolling planning，不提前实现 Web 或正式文档修订。

## 3. 验证与完成条件

### 3.1 验证项

| 验证 | 层级 | 内容 |
| --- | --- | --- |
| V-006 | core | `@ngapd/database` typecheck/test，使用真实 PostgreSQL 17；覆盖 Profile、项目原子创建、唯一 Membership/pending、首次/再次批准、角色归档/绑定、Admin Mode 30 分钟派生、Owner Transfer、成员移除阻塞、稳定锁顺序、幂等/版本、故障注入和真实并发 |
| V-007 | core | `@ngapd/contracts` 与 M1 application service 目标测试/typecheck；覆盖资源/集合 runtime 边界、稳定错误、`actions`、Owner 直接操作、Admin Mode 操作、成员自助、Role 不授权、失败审计和不可信内容 |
| V-008 | core | `@ngapd/api` 完整 test/typecheck，使用真实 PostgreSQL 17；覆盖全部 M1 路由与 OpenAPI 3.1、未知字段、Cookie/Origin、精确 Key 最小披露、跨项目 IDOR、成功/失败审计、Outbox→投影→SSE 受众、目标规模无明显超时及既有 Identity/Pairing/Workspace/Events/内部 Task 兼容 |
| V-009 | core | 所有生产改动完成后运行一次根 `pnpm check`；核查公共路由 inventory、added-line reset/down/外部 API/AI/LLM、日志/审计秘密、工作区差异、AGENTS/README/活动文档真实性和封存历史未改写 |

V-006/V-008/V-009 要求仓库锁定的 Node.js 24、pnpm 11、真实 PostgreSQL 17 和相关 Windows `C:\tmp`/PasswordVault 能力。若环境缺失，当前任务/阶段必须保持 `in_progress` 或 `blocked` 并记录未运行项，不能把 P-001 证据或跳过项当作 P-002 通过。P-002 不运行最终 Compose smoke 或参考服务器 P95；这些会被 P-003 后续生产改动使阶段证据失效，按路线图在最终集成时执行一次。

### 3.2 完成门禁

- 三个任务均有前后检查点，实际文件、路由 inventory 和任何计划偏差均已记录。
- V-006–V-009 全部通过；没有 failed、unknown-impact、未证明 core、安全、隐私、数据、兼容、构建或恢复异常。
- 全部 M1 后端资源能够只通过公共 `/api/v1` 完成成功、拒绝、陈旧、幂等、故障和恢复路径；OpenAPI 与共享 runtime Schema 一致。
- 成员移除/Task Owner、Owner Transfer、Admin 降权、项目归档、首次/再次批准在真实并发和故障下只有完整前态或后态；无遗留租约、有效旧 Admin Mode、重复关系或悬空 Owner。
- 审计/Outbox/SSE 有精确 user/project 受众且不泄露秘密、项目外数据、说明/能力正文或 Workspace 正文；API/Worker 无外部 API、AI 或 LLM。
- 没有未决用户问题、半应用事务、未记录的用户改动覆盖或活动测试进程。
- 若出现 relaxed report-only finding，必须从 `FND-I-001` 连续编号并独立证明不影响 core/硬门禁；任何 critical/high 或未知影响均阻塞。
- 仅在以上条件满足后创建 `phase-002-result.md`；随后运行状态为 `awaiting_next_phase`，等待下一次 `$plan-feature-implementation` 规划 P-003。

## 4. 风险、恢复与修订记录

### 4.1 风险控制

| 风险 | 预防与检测 | 失败后的安全状态 |
| --- | --- | --- |
| 多个治理写入者各自锁表导致死锁或移除竞态穿透 | 固定全局锁顺序；Task Owner 写入口先锁稳定 Membership；并发调度与 statement timeout 诊断 | 保持事务完整回滚，T-001 `in_progress`；按死锁图修正顺序，不降低隔离或绕过检查 |
| 成功状态与审计/Outbox/幂等结果分离 | 同事务写入并对 replay 做 request hash 比较；故障点覆盖每个边界 | 只允许完整前态；回滚后记录稳定失败审计，不手工补写业务状态 |
| Admin Mode 由客户端、轮询或 Worker 续期/扩权 | 每个受保护操作按服务端时间、Web Session、Project、Membership 与资格重查；只有成功操作续期 | 撤销或标记 expired/revoked，拒绝操作；不得延长旧能力 |
| 精确 Key、Membership ID 或 SSE 造成跨项目披露 | 单独最小 DTO、服务端 UUID 租户过滤、负向 IDOR 和受众投影测试 | 阶段阻塞；保持路由未交付，修正查询/DTO 后重跑安全门禁 |
| P-002 路由一次开放过多但事务尚未闭环 | 先完成 Repository/服务检查点，最后统一注册 routes；`app.ts` 只在 T-003 修改 | T-001/T-002 中项目仍没有 M1 公共路由，现有页面和入口保持可用 |
| 实施发现 `0008` 缺少 core 数据约束 | P-002 开始前已核对 P-001 指纹；真实 Repository/并发测试验证现有约束 | 不改写 P-001 result 或既有 `0008`；暂停并由 rolling planning 追加 corrective phase/修订路线图 |
| 用户已有 P-001 未提交工作被误覆盖 | 每个任务记录当前 diff 与已完成清单，只改计划授权范围 | 立即暂停，保留 diff 和当前事务/测试状态，请用户处理真正重叠 |

### 4.2 事务恢复与回退

- P-002 不包含新迁移；`0008` 已应用后继续采用 roll-forward 或经用户确认的数据库备份恢复，不提供自动 down/reset。
- 每个写命令以数据库事务为恢复边界；失败注入必须确认业务表、Membership/Owner、Admin Mode、租约、幂等记录、审计和 Outbox 均未形成半结果。
- 已提交公共路由的代码回退不能假定数据库降级；由于本阶段不改变 Schema，回退重点是保持 version 2 ready 的旧兼容入口可启动，并在发布说明中禁止使用旧 Membership 权威代码。
- 若任务中断，保留显式测试数据库和运行状态中记录的当前任务/最后成功检查点；只有在确认无运行测试进程后才清理可再生临时环境。

### 4.3 精确恢复起点

首次执行从 `P-002-T-001` 开始：读取本计划、`execution-state.md` 和 immutable `phase-001-result.md`，核对 requirements/roadmap/P-001 result/P-002 plan 指纹与 `git status`，确认当前生产 diff 仍等于 P-001 完成清单；把运行和 P-002 置为 `in_progress`，记录新的显式 PostgreSQL 17 隔离目标，然后先创建 Project/Membership 与 Project Role Repository 及真实数据库目标测试。若已有任务检查点，只从状态记录的未完成步骤恢复。

### 4.4 修订记录

| 修订 | 日期 | 变更 | 原因与影响 |
| --- | --- | --- | --- |
| 1 | 2026-07-28 | 首次 P-002 expanded rolling plan | P-001 已完成且指纹无漂移；沿用路线图中公共兼容、多事务写入者和可独立验收后端闭环的阶段理由，不改变路线图修订或 FR/AC 追踪 |
