# M1 initial run：P-002 阶段结果

- 运行编号：`initial`
- 阶段：`P-002`
- 阶段计划：[`phase-002-plan.md`](phase-002-plan.md)
- 阶段计划修订：`1`
- 父路线图修订：`1`
- 需求指纹：`sha256:f3ab380a2826c494223aff7b3c7ae7c9e8904d8d2ddf2ad0392adb26488020d8`
- 路线图指纹：`sha256:94c85511348f628b1c0edb0d6133f4b3ca453d91815fbd306f45f7e529a5de22`
- 阶段计划指纹：`sha256:a8da8f7531d6fbf128ebe4f38a96001e55e3b640891280cee14b721dd2529865`
- 完成时间：`2026-07-28T23:05:00+08:00`
- 状态：`completed`
- 交付与验证策略：`relaxed`
- 验证结论：`passed`
- 开始基线：分支 `requirements/m1-project-role-members`，提交 `f9efee992394f1b6761182237cf736f79561ad5b`；P-001 为未提交但已有 immutable completed/passed result 的工作树，P-002 生产文件尚不存在
- 结束基线：同一分支与提交上的未提交工作树；未 commit、push、reset、checkout 或 stash，保留用户 requirements/workflow contract 与全部 P-001 产出

## 1. 阶段目标与结果

P-002 已在 P-001 的 schema version 2/`0008-m1-project-role-members`、共享 runtime Schema 和纯领域规则上，交付无需 Web 即可独立验收的完整 M1 后端闭环：

- 正式 Repository 覆盖当前用户资料、Project、Membership/Join Request、Owner Transfer、Admin Mode 和 Project Role；所有治理写入复用唯一数据库权威，没有第二套 Membership 状态或权限模型。
- Project 原子创建同时建立 Owner Membership、项目 Workspace、初始版本和 74 个角色快照；幂等键由事务级 advisory lock 串行化，比较 canonical request SHA-256 并返回原响应。
- 治理事务采用 Project → 稳定 Membership → Request/Admin/Role → Task → Workspace/Lease 的全局锁顺序；成员移除、Owner Transfer、项目归档、Task Owner 与 Workspace lease 写入在提交前重查同一权威。
- 成功业务状态、版本、幂等响应、不可变 audit 和精确 user/project audience Outbox 同事务；故障注入证明业务、audit、Outbox 和幂等记录完整回滚。确定拒绝和未知异常在事务外写一次去重 failure audit。
- Identity、Projects/Membership、Roles 和 Authorization/Audit application service 从服务端 Web Session、Project UUID、活动 Membership 与 Admin Mode 派生授权；客户端 `actions`、Role capability 文本和传入 Membership ID 永不构成授权材料。
- 完整 `/api/v1` 已注册 Profile、Project、Join Request、Membership、Owner Transfer、Admin Mode、系统模板和 Project Role 路由；状态改变统一要求当前 Web Session 与 Same-Origin。
- 所有请求/响应继续使用共享 TypeBox runtime Schema；未知字段不再被静默删除，而是返回稳定 `VALIDATION_ERROR`。OpenAPI 3.1 声明全部计划内路径、成功响应和稳定错误响应。
- Project 详情、列表和 Membership/Role 资源由服务端派生调用者 `actions` 与当前 Admin Mode；精确 Project Key join-target 只返回 `key/name/acceptsJoinRequests`。
- M1 成功 Outbox 经 Worker 使用的同一投影函数进入资源失效事件；SSE 只返回重新获取提示，并按 user 或当前活动 Project Membership 过滤。
- Identity、Pairing、Device、Workspace、现有 SSE、内部 Task、Worker 与当前 Web 构建保持兼容；没有开放公共 Task CRUD。

P-002 完成 FR-001–FR-041、FR-043–FR-046 的后端实现及 AC-001–AC-022、AC-024–AC-027 中可由后端独立证明的全部结果。FR-042/AC-023 的中文 Web、FR-047 的活动正式文档同步、supplemental AC-028/AC-029 和最终 Compose/参考服务器发布验收仍属于 P-003；本结果不把后端证据扩大为整个 M1 完成。

## 2. 任务、需求与验收覆盖

| 任务 | 状态 | 阶段范围 | 完成结果 |
| --- | --- | --- | --- |
| `P-002-T-001` | completed | FR-001–FR-041、FR-043–FR-046 的正式数据读写、事务、幂等、审计、Outbox、失效和兼容基础；AC-001–AC-022、AC-024–AC-026 的数据库部分 | M1 Repository、固定锁序、Project/74 快照、首次/再次加入、Role/Admin Mode、Owner Transfer、成员移除/Task Owner、项目归档/lease 竞态及故障回滚完成；V-006 passed |
| `P-002-T-002` | completed | 同一 FR/AC 的 application service、稳定错误、服务端授权与资源映射 | Profile/Project/Membership/Role/Admin Mode 服务、当前 actor/project/Membership/Admin Mode 解析、`actions`、拒绝/异常 audit 完成；Owner 直接、成员自助、Admin Mode、Role 不授权、跨项目伪造 ID 和异常恢复通过；V-007 passed |
| `P-002-T-003` | completed | FR-041、FR-043–FR-045 的公共接口、OpenAPI、SSE 和完整兼容；AC-020–AC-022、AC-024–AC-027 | 计划 2.3 节的全部 `/api/v1` 路由、unknown-field 拒绝、Cookie/Origin、最小披露、IDOR、OpenAPI 3.1、Outbox→投影→SSE、既有入口和根工程门禁完成；V-008/V-009 passed |

阶段退出不变量全部满足：

- 每个项目恰有一个同项目活动 Owner；Membership 不物理删除，Role 文本不授权。
- 所有创建或改变 Task Owner、Membership 状态/权限、项目生命周期或 Workspace 写资格的路径遵守共享锁顺序并在事务内重查。
- Admin Mode 仅绑定当前 Web Session/Project/Membership；关闭、过期、登出、降权、移除、Owner Transfer 和项目归档使相关能力失效。
- 成员移除保留资料、角色绑定和历史 Task Owner；有效未完成 Task Owner 会返回稳定 blocking task 明细并阻止移除。
- Project/成员/申请/Transfer/Role 列表稳定排序；非成员不能浏览 Project 详情或项目列表，精确 join-target 不暴露 UUID、成员或内部状态。
- 成功写入只有一次不可变 success audit/Outbox；拒绝重试只有一次 failure audit；失败没有成功 Outbox。
- P-001 的 `migrations.ts`、`types.ts`、`schema-profile.ts` 与 immutable result 未改写；没有新增 Schema 或公共 Task CRUD。

## 3. 文件修改

| 文件 | 修改模式 | 主要目的 |
| --- | --- | --- |
| `packages/database/src/m1-repository-support.ts` | add | M1 幂等锁/replay、成功 audit/Outbox、稳定 Membership/Admin/lease 锁与失效共享事务 |
| `packages/database/src/project-membership-repository.ts`、`project-role-repository.ts` | add | Project/Membership/Join/Transfer/Admin Mode/Role 的正式查询、版本化治理事务和最小投影 |
| `packages/database/src/project-membership-repository.integration.test.ts` | add | PostgreSQL 原子、幂等、并发、租约/能力失效、移除/转移/归档和故障门禁 |
| `packages/database/src/identity-repository.ts` | modify | 当前用户资料读写与版本、模板校验、audit/Outbox 原子性 |
| `packages/database/src/foundation-repository.ts`、`task-repository.ts`、`task-lifecycle-repository.ts`、`workspace-repository.ts`、`index.ts` | modify | M1 正式导出、统一治理锁序、Task Owner 与 Workspace lease 并发边界 |
| `packages/contracts/src/projects.ts`、`memberships.ts`、`ownership-transfers.ts`、`admin-mode.ts`、`roles.ts`、`errors.ts`、`m1-contracts.test.ts` | modify | params、collection/detail/mutation response、blocking tasks、稳定错误和 runtime 边界 |
| `apps/api/src/application-errors.ts` | modify | Repository/Domain 原因到稳定 M1 `ApplicationError` 的状态、错误码、恢复和版本映射 |
| `apps/api/src/modules/identity/service.ts`、`routes.ts` | modify | 当前用户 Profile application service 与 GET/PATCH 公共路由 |
| `apps/api/src/modules/authorization-audit/` | add | 服务端授权/失败审计、Admin Mode service/routes、统一 M1 route actor/context/Origin/request hash |
| `apps/api/src/modules/projects-membership/` | add | Project、Join、Membership、Removal、Owner Transfer application service/routes 和目标服务测试 |
| `apps/api/src/modules/roles/` | add | 系统模板与 Project Role list/detail/create/update/copy/archive service/routes |
| `apps/api/src/app.ts` | modify | 一次性注册全部 M1 路由、关闭 unknown-field 静默移除并序列化 blocking tasks |
| `apps/api/src/m1.integration.test.ts` | add | 完整公共闭环、OpenAPI、Cookie/Origin、未知字段、最小披露、IDOR、audit、SSE 与目标规模集成证据 |
| `AGENTS.md` | modify | P-002 阶段事实、验证结论和 P-003 rolling-planning 交接 |
| `docs/requirements/m1-project-role-members/execution/initial/execution-state.md` | update | 三个任务前后检查点、失败尝试、V-006–V-009、恢复和最终协调状态 |
| `docs/requirements/m1-project-role-members/execution/initial/phase-002-result.md` | add | 本不可变 completed/passed 结果 |

P-001 已记录的 Contracts/Domain/Schema/Outbox/Event/Worker 兼容文件仍保留在累计工作树中，但不是 P-002 重复产出。`workflow-contract.md`、`requirements.md`、roadmap、P-001/P-002 plan 和 P-001 result 均未在本阶段改写；M0 与其他封存记录未修改。

## 4. 测试与验证

最终有效证据使用 Node.js `24.18.0`、pnpm `11.9.0` 和 PostgreSQL `17.10`。PostgreSQL 来自 Maven Central Zonky Windows x64 artifact，`23,357,276` bytes，SHA-512 `8c5a905a35b41f97f4a675bc50a983abac094a49b57262d35e7e38f56ad482eb60fc4dbc3412f1906d3a810dd67782ad391be443757e60397835fc41f473bcf8`；隔离目标为 `127.0.0.1:55438/ngapd_p002`。

| 验证 | 方法 | 最终结果 |
| --- | --- | --- |
| V-006 Database | `@ngapd/database` typecheck/test；PostgreSQL 17.10，30 秒 statement timeout/15 秒 lock timeout | passed；9 files/47 tests；幂等真实并发、移除/Task Owner、归档/lease、Role/Admin Mode、Owner Transfer、故障完整回滚 |
| V-007 Contracts | `@ngapd/contracts` typecheck/test | passed；2 files/12 tests |
| V-007 Application service | database/API typecheck；PostgreSQL service target test；Prettier/ESLint/diff check | passed；1 file/3 tests；Owner/Admin Mode/member/Role 不授权、actions、跨租户、失败 audit 与异常回滚 |
| V-008 API | `@ngapd/api` typecheck/test；真实 PostgreSQL 与已授权 Windows `C:\tmp`/PasswordVault | passed；9 files/27 tests；完整 M1 路由/OpenAPI/SSE 与既有 Identity/Pairing/Workspace/Events/Task 兼容；两轮 small sync 1448.33ms/1453.90ms |
| V-009 根门禁 | 同一 Node/PostgreSQL/Windows 上下文；`pnpm check` | passed；format、lint、全部 packages/apps build、10 个 workspace typecheck、全部适用测试通过 |
| 根测试总计 | 根 `pnpm test` 实际输出汇总 | 262 tests passed；7 个非 Windows 平台条件测试 skipped；0 failed |
| 根门禁 API/Worker | 根运行中的 API 与 Worker 套件 | API 9 files/27 tests，small sync 1511.58ms/1428.96ms；Worker 2 files/4 tests |
| 路由、安全与历史 | OpenAPI inventory、unknown field、Cookie/Origin、IDOR、added-line reset/外部调用、Git/diff/指纹/进程检查 | passed；全部计划路径存在，无 Task CRUD、外部 API/AI/LLM、生产 reset、补丁错误或封存历史改写 |
| 数据库最终摘要 | `inspectDatabaseSchema` 与只读 Kysely 计数 | ready，profile version 2，8 migrations/latest 0008，74 templates，0 invalid owners，0 non-revoked leases，0 pending outbox |
| 环境收尾 | `pg_ctl -m fast stop`、55438 TCP、精确临时路径与进程检查 | passed；端口无响应，P-002 PostgreSQL/Node probe/test logs 已删除，两个遗留 task `curl` 下载进程已停止，0 残留 |

阻塞失败尝试均在同一任务范围修正并完整重跑：

1. V-006 首跑暴露 advisory key NUL 与测试排序假设，第二次暴露 user audience Outbox 携带 project scope；修正后完整 Database 套件通过。
2. V-007 首次 API typecheck 读取旧 contracts/database `dist`；重建依赖后无生产类型错误。目标测试的 Owner permission、归档 Role copy action、稳定拒绝码与故障夹具假设按真实领域/数据库语义修正，最终全绿。
3. V-008 首跑唯一失败是集成测试数据库核对误用 DTO `key` 而非正式列 `project_key`；生产路由另外两项场景已通过，修正证据查询后全文件重跑通过。
4. V-009 首次在 format:check 停止，仅列出 `m1-repository-support.ts` 和 Repository integration test；机械格式化后从头完整 `pnpm check` 通过。
5. 初始 EDB/curl 大包探测下载缓慢且不完整，未使用其字节；改用长度和发布 SHA-512 均匹配的 Maven artifact。收尾时停止两个对应 task `curl` 后删除残留。

## 5. 发现项与处置

当前无开放 `FND-I-*`；下一可用 ID 仍为 `FND-I-001`。

| ID | 类别 | 严重程度 | 关联需求/验收 | 观察与证据 | 最终功能影响 | 处置 | 置信度 | 建议后续 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |

全部 core/硬门禁已通过；未保留 supplemental 异常、未知影响或环境残留，因此验证结论为 `passed`，不是 `passed_with_findings`。

## 6. 决策、计划偏差与恢复记录

- 沿用用户明确选择的 `relaxed` 策略；没有降级任何安全、隐私、数据、公共兼容、构建、恢复或 core 门禁。
- 三个任务严格按 `P-002-T-001 → T-002 → T-003` 执行；V-006 通过前未开始 application service，V-007 通过前 `app.ts` 指纹保持不变且没有公共 M1 routes。
- 文件级直接依赖扩展只有两项：T-002 在 Project/Membership Repository 增加当前 Web Session 的最新 Admin Mode 只读查询；T-003 为计划要求的 Role detail route 增加 application service 只读方法。两者均未增加写权威、Schema 或产品范围。
- 为真正“拒绝”未知字段，Fastify AJV `removeAdditional` 从默认静默移除改为 `false`；共享 TypeBox `additionalProperties: false` 因而产生稳定 400。既有 API 完整回归通过。
- API 测试通过 `OutboxRepository.dispatchNext` 验证 M1 Outbox→projection→SSE；Worker 根套件独立证明 Graphile Worker 正是调用该同一投影函数并保持重试/并发语义。
- 没有修改 0008、Kysely正式 Schema 类型或 schema profile；三者 SHA-256 保持 `f96d47fb...d57c`、`30a5a134...062`、`68097c80...1ec`。P-001 result SHA-256 仍为 `eb06f279...c255f`。
- README 没有 P-002 状态或路由清单声明，无需修改。活动正式产品/领域/权限/架构/决策文档中的旧 MEM-006/ROL-004 结论按批准路线保留给 P-003 一次性同步；本阶段没有提前改写。
- 工作树始终保持未提交；没有覆盖用户已有 requirements/workflow contract，也没有 commit、push、reset、checkout 或 stash。

恢复边界：

- 正式数据库仍只允许前向迁移/roll forward；P-002 没有新增迁移或自动 down/reset。
- 若后续发现 P-002 行为缺陷，不得改写本结果；由 rolling planning 在 roadmap 中追加 corrective phase。
- 临时 PostgreSQL/下载只用于隔离验证，已停止和删除；恢复测试时必须重新创建显式隔离目标，不能假定 55438 或 `ngapd_p002` 仍存在。

## 7. 遗留风险与下一阶段进入条件

- P-003 尚无 just-in-time 详细计划，不得由实施技能直接开始。
- 下一次必须使用 `$plan-feature-implementation`，基于本结果、当前 `execution-state.md`、roadmap revision 1 和最新项目事实，只规划 P-003。
- P-003 负责中文 Web、键盘/焦点/非颜色可访问性、危险操作确认、当前 API 的浏览器集成、活动正式产品/领域/权限/架构/路线/决策文档同步，以及 supplemental AC-028/AC-029 与最终 Compose/参考服务器发布验收。
- P-003 必须保持本阶段的公共 `/api/v1`、稳定错误、Cookie/Origin、服务端权限、审计、Outbox/SSE 和现有 Identity/Workspace/Task/Worker 兼容。
- 初始运行设置为 `awaiting_next_phase`；只有 P-003 也产生 immutable completed/passed result 且最终 core/发布门禁通过后，才允许生成 `change-0.md` 与 `effective-requirements.md`。
