# P-001 阶段计划：M2 服务端任务管理闭环

- 运行编号：`initial`
- 阶段编号：`P-001`
- 阶段状态：`ready`
- 阶段计划修订：`1`
- 父路线图：[`implementation-plan.md`](../../implementation-plan.md) revision `1`
- 父路线图指纹：`sha256:43d93afe30f6c67579ccb301203ac673e2684e3bfc6f2973d54ce77e2988bd11`
- 需求：[`requirements.md`](../../requirements.md)
- 需求指纹：`sha256:37f1e0c2a34c7578bdf2e3f55d0c47834353322ebd09cfc186fe14fc16685094`
- 项目基线：分支 `codex/m2-clarify-requirements`，提交 `39b779dd4f1347e89158a37554cdcd4ceeb773dd`
- 创建日期：`2026-07-29`
- 计划细节：`expanded`
- 交付与验证策略：`relaxed`
- 验证结论：`pending`

## 1. 阶段目标、边界与关联需求

本阶段在一个可发布边界内完成 FR-001–FR-032 和 AC-001–AC-020：从正式 Schema version 2/`0008-m1-project-role-members` 前向建立 M2 Schema version 3、完整 Task 领域和 Repository、面向已认证人类会话的 `/api/v1`/OpenAPI、评论/活动/站内通知、Outbox/Worker/SSE 投影、Task Workspace 原子边界，以及正确性、并发、安全、兼容、规模和性能证据。

阶段结束时：

- M2 core 行为和硬门禁全部通过；任何未知产品影响、数据/安全/兼容/构建/恢复问题都已修复或阻塞阶段。
- `AC-019`/`AC-020` supplemental 结果已如实记录；只有独立证明无交付影响的异常可使用 `FND-I-*` 留作 report-only。
- 公开 Task API 只接受人类 Session，内部 Agent actor 端口不公开；没有 M3 Task UI、M4 本地同步、M5 Agent 工具或 M6 Knowledge/Wiki 越界。
- 数据库只使用非破坏性 `0009` 前向迁移；实现期间不接触用户生产数据库、不运行 reset/down、冲突覆盖、租约 takeover 或不可恢复业务操作。
- 项目、正式活动文档和 AGENTS.md 在完成时与实际 Schema、模块、命令和里程碑状态一致，M0/M1/原型封存证据保持不变。

### 已验证前置条件

| 前置条件 | 已确认事实 | 执行约束 |
| --- | --- | --- |
| 工作流与需求 | Schema `3.2` 合同有效；需求结构、32 个 FR、20 个分级 AC、`relaxed` 策略和 Q-001 用户回答审计通过 | 执行前重算需求/路线图指纹；漂移则暂停并回到规划 |
| 项目状态 | 基线提交 `39b779d...`；规划前仅 M2 合同/需求目录未跟踪，无其他用户 diff | 只认领本计划列出的 M2 文件；发现新重叠 diff 先记录并判断是否暂停 |
| 现有能力 | M1 version 2、Project/Membership/Role/Admin Mode、内部 Task/Workspace、Audit/Outbox/SSE 和 Worker 基线可复用 | 不创建第二套身份、Owner、权限、Workspace 或事件权威 |
| 工具链 | 仓库要求 Node 24/pnpm 11/PostgreSQL 17；当前规划 shell 是 Node 20，且没有 `DATABASE_URL`/Docker | 任何构建/测试证据前先切换到 `.node-version` 的 Node 24 并准备隔离 PostgreSQL 17；Node 20 结果不得作为完成证据 |
| 恢复 | 实现只写工作区和隔离测试数据库；生产 `0009` 需要一致备份 | 不在本阶段直接部署；测试数据库可重建，生产只允许前滚或恢复迁移前备份 |

## 2. 任务与文件范围

### 任务顺序

| 任务 | 结果 | 文件或范围 | 实现摘要 | 验证 | 完成条件 |
| --- | --- | --- | --- | --- | --- |
| `P-001-T-001` | M2 Schema、共享契约、领域规则与事务数据基础完整且仍不暴露半成品公共入口 | `packages/contracts/src/**`、`packages/domain/src/task-*.ts`、`packages/database/src/{migrations,schema-profile,types,task-*,project-membership-*,workspace-*,outbox-*}.ts`、相关测试 | 新增 `0009`/profile 3；Task 字段和 Project Role ID；Comment/Activity/Notification/`completion_ready` 数据；字段/评论/通知领域决策；查询/命令/生命周期/投影 Repository；统一锁序、版本、幂等、Audit/Outbox 和故障注入 | Node 24 下共享包 build/typecheck；领域定向测试；隔离 PostgreSQL 的迁移、Repository、并发和故障注入定向测试 | version 2→3/空库/重复/异常回滚通过；所有源事实与事务不变量有可执行证据；现有 M1/Internal Task/Workspace 测试保持；`buildApp` 仍未注册不完整 routes |
| `P-001-T-002` | 完整公共 Task/Comment/Activity/Notification API 与 Worker/SSE 闭环可由人类 Session 安全调用 | `apps/api/src/app.ts`、`apps/api/src/application-errors.ts`、`apps/api/src/modules/{tasks,dependency-graph,authorization-audit,workspaces,knowledge-notifications,events}/**`、`apps/worker/src/**`、必要 contracts/database 适配与测试 | 以 Project Key/Task Key 注册全部 `/api/v1` routes 和 OpenAPI；服务端解析 actor/Admin Mode/actions；组合 Task/Graph/Workspace/Comment 事务；Worker 幂等投影 Activity、完成资格、通知和 due reminder；精确 audience SSE/重建 | API/Worker build/typecheck；真实 PostgreSQL 路由/权限/并发/评论完成竞态/投影重试与跨租户集成；OpenAPI 路由与输入负向清单 | 全部 M2 routes 可发现；客户端 actor/admin 注入被拒；稳定错误不退化为 500；Worker 重试不重复且投影可重建；M1/Workspace/SSE 公共行为无回归 |
| `P-001-T-003` | 规模、工程、参考性能、发布适用性和活动文档完成最终收口 | `packages/test-fixtures/src/**`、`scripts/performance/**`、根 `package.json`（仅需新增稳定 M2 性能入口时）、`docs/01`–`10` 活动文档、`AGENTS.md`、必要 README/测试 | 增加深度 20、200 同级/DAG、5,000 Task 与并发夹具；完成一次最终工程/数据库门禁；采集可用的 M2 参考 P95；核查并同步实际 Schema/模块/命令/里程碑，不改封存历史 | 规模 core；隔离 PostgreSQL 根 `pnpm ci`；仅在发布栈有 diff 时 Compose；参考服务器 supplemental；最终 diff/敏感信息/范围审查 | AC-001–AC-018 全部通过；AC-019/020 已执行或按环境如实分级；无未决问题、半迁移或越界实现；可写 phase result、`change-0.md` 与 effective snapshot |

依赖：`P-001-T-002` 依赖 `P-001-T-001`；`P-001-T-003` 依赖 `P-001-T-002`。不得并行修改共享 Task/Workspace/Outbox 事务文件。

### 风险相关文件职责

| 文件或区域 | 本阶段职责 | 风险控制 |
| --- | --- | --- |
| `packages/database/src/migrations.ts`、`schema-profile.ts`、`types.ts` | `0009`、profile 3、M2 表/列/约束/索引/Kysely 类型 | 单一 migration owner；先写前向/重复/失败回滚测试；不提供生产 reset/down |
| `packages/database/src/task-repository.ts`、`task-lifecycle-repository.ts` 及新增 query/comment/projection Repository | Task/Graph/Owner/Workspace/Comment 权威事务与 Worker 投影端口 | 沿用固定锁序；route/Worker 不直接写跨模块表；故障注入覆盖每个原子边界 |
| `packages/database/src/project-membership-repository.ts`、`workspace-repository.ts` | 共享 Membership 串行化和租约/版本事实 | 仅作 M2 所需适配；不得复制或削弱 M1/Workspace 权威 |
| `packages/contracts/src/tasks.ts`、新增 comments/notifications 契约、`errors.ts`、`events.ts`、`index.ts` | 公共资源、命令、分页、事件和错误 | 公共 request 不出现可信 actor/admin/project ID；TypeBox `additionalProperties: false` |
| `packages/domain/src/task-*.ts` 与新增评论/通知规则 | 所有框架无关行为和授权 | 生产代码与属性/矩阵测试同源；Web/API 不复制 |
| `apps/api/src/modules/tasks/**`、`dependency-graph/**`、`knowledge-notifications/**` | 应用组合、routes、Session actor、OpenAPI、actions | 通过现有 Identity/Admin Mode 服务解析；跨模块只调用允许端口 |
| `apps/api/src/modules/workspaces/**`、`events/**`、`app.ts` | Task Workspace server 状态、精确 SSE 和最终注册 | 保持现有 Workspace/Events 契约；无对象正文进入 SSE |
| `apps/worker/src/outbox-task.ts` 及新增 projection/reminder 文件 | Activity、完成资格、通知、提醒和 invalidation | Outbox/occurrence 唯一键；重试/重建测试；不执行业务 mutation |
| `packages/test-fixtures/src/**`、`scripts/performance/**` | 大规模确定性夹具与 M2 P95 采样 | 规模正确性是 core；精确延迟是 supplemental；不把原型当生产规则 |
| `docs/**`、`AGENTS.md` | 实际实现与阶段状态同步 | 只更新活动文档；不改 M0/M1/原型封存 result/change 记录 |

### 暴露接口与数据契约

- 公共 Task routes 以现有 `ProjectKey`/`TaskKey` 为外部稳定定位，内部 UUID 只在资源响应中按既有风格提供；所有资源查询附带 Project 约束。
- 列表输入固定 stable cursor、limit、parent、lifecycle 和必要过滤；详情返回 Task 字段、Owner 继承、状态、统计、Graph、Workspace server 状态和 `actions`。
- Mutation 使用 `Idempotency-Key`/规范请求摘要及适用的 `expectedTaskVersion`、`expectedGraphVersion`、`expectedWorkspaceSyncVersion`、影响指纹或完整 Task Key；成功返回新版本、actions 和事件/操作引用。
- Comment 使用自身 version 和 Task version。作者 edit/delete 只在未完成 Task；完成后只允许 create，管理员 hide 不等于作者 delete。
- Activity/Notification 使用稳定 cursor；Notification read 状态版本化，关键通知偏好不可关闭。SSE 只发资源引用。

### 有序实现步骤

1. `P-001-T-001` 开始前把执行状态置为 `in_progress`，记录 Node 24/隔离 PostgreSQL 事实与当前 diff；确认 requirements/roadmap 指纹。
2. 先完成 `0009` 和迁移测试，再更新 Kysely 类型与共享 contracts/domain；迁移测试覆盖 legacy role 唯一匹配和零/多匹配回滚。
3. 按全局锁序扩展 Task/Graph/Lifecycle/Comment/Projection Repository；对每个 mutation 建立授权、冻结、版本、影响、幂等、Audit/Outbox 矩阵和故障点。
4. `P-001-T-001` 定向证据通过并 checkpoint 后，再注册 `P-001-T-002` 的 public contracts/routes；route 只组合服务端事实，不能把内部 context 直接暴露。
5. 完成 Worker Activity/`completion_ready`/Notification/reminder 和 SSE audience；用重复消费、失败重试、重建与跨租户测试固定。
6. `P-001-T-002` checkpoint 后，`P-001-T-003` 增加规模/性能夹具和最终门禁；任何修复后只重跑可能被修复影响的证据。
7. 所有 core/hard gate 通过且 finding 已分级后才写 phase result；随后按实现技能完成 initial `change-0.md` 和 effective requirements，不在本计划阶段预写结果。

### Writer 协调与迁移恢复

- 实现期间 Task/Workspace/Outbox 共享文件由当前任务单一 writer 顺序修改；若发现用户或其他进程产生重叠 diff，立即停止该任务并在 execution state 记录。
- 所有数据库验证使用明确命名的隔离 PostgreSQL 17 数据库；执行前核对目标，不对未知/共享数据库运行迁移或 reset。
- `0009` 失败应由单事务保留 version 2 与完整 `0001`—`0008`；记录诊断和 schema inventory 后修复迁移再重试。
- `0009` 已在隔离库成功而后续任务失败时，代码可以回退到 checkpoint，测试库可删除重建；不得把成功迁移的生产库用 down/reset 回退。
- 未来生产部署前先取得一致数据库/对象备份；部署后只能 roll forward，或恢复迁移前备份并运行旧应用。

## 3. 验证与完成条件

### 验证门禁

| ID | 层级 | 验证内容与执行时点 | 通过条件 |
| --- | --- | --- | --- |
| `V-001` | core | T-001：Node 24 下 Contracts/Domain 定向 tests、build/typecheck；字段、Role ID、Owner、Graph、状态、影响、评论和通知规则 | 全部通过；公共/内部契约边界明确，无未覆盖分支 |
| `V-002` | core | T-001：PostgreSQL 17 的空库、version 2→3、重复 migrate、legacy role、异常回滚和 profile ready | 数据/ID/Key/版本/Owner/Workspace/Audit/Outbox 保留；零/多匹配 fail closed；无半迁移 |
| `V-003` | core | T-001：Repository 授权矩阵、并发、幂等和故障注入 | 每个 mutation 只有完整前态/后态；低层入口不能绕过权限、冻结、版本、影响或租约 |
| `V-004` | core | T-002：API route/OpenAPI/runtime Schema、Session actor、actions、稳定错误和跨租户负向 | 全部资源可发现；未知/伪造 actor/admin 字段拒绝；无枚举泄露或无差别 500 |
| `V-005` | core | T-002：Comment 完成竞态、Activity/`completion_ready`/Notification/due reminder、Worker 重试/重建和 SSE | 评论生命周期确定；父 Task 不自动完成；重复消费不重复；audience 精确且 cursor 可恢复 |
| `V-006` | core | T-002：M1 Project/Membership/Role/Admin Mode、Workspace、Events 和内部 Task 兼容集成 | 既有 core 全部保持；成员移除、Owner/lease 和完成冻结无回归 |
| `V-007` | core | T-003：深度 20、200 同级、200 节点 DAG、5,000 活动 Task | 递归、排序、分页、授权和数据完整性正确；无业务硬限制、栈溢出或跨租户遗漏 |
| `V-008` | core | T-003 最终：隔离 PostgreSQL 17 上运行根 `pnpm ci`；该命令内首次/重复 migrate 后执行根 `pnpm check` | Node 24/pnpm 11/PostgreSQL 17 预检、migration、format/lint/build/typecheck/test 全部通过 |
| `V-009` | conditional core | 仅当 Compose/Docker/发布脚本有实际 diff 时运行 `pnpm compose:smoke` | 六服务发布栈健康且正式 profile 3 ready；无外部运行时依赖 |
| `V-010` | supplemental | 参考服务器执行 M2 列表/详情、普通创建/更新、200 节点 DAG P95 | 达到 AC-019；若仅精确延迟偏离，必须先独立证明 core/可用性/无明显卡顿再登记 `FND-I-*` |
| `V-011` | supplemental | 有现成环境且能增加置信度时执行额外浏览器、广泛压力或诊断 | 结果如实记录；不作为 core 替代，不为无交付影响异常自动安排修复 |
| `V-012` | core | 最终 diff、敏感信息、模块边界、范围和活动文档/AGENTS 审查 | 无 secret/正文泄露、无 M3–M6 越界、无封存证据修改；当前状态与文档一致 |

### 最终完成条件

- FR-001–FR-032 均有实现和验证证据；AC-001–AC-018 全部 passed。
- `V-008` 必须通过；`V-009` 在触发时必须通过。数据库、构建、运行时、权限、安全、隐私、数据、兼容或恢复异常不能 report-only。
- AC-019/AC-020 的每个异常都已证明最终功能影响、严重度和置信度；仅符合 relaxed 合同的 supplemental 异常可保留为 `FND-I-*`。
- 没有 unresolved question、活动半迁移、部分 Task/Workspace/Comment 事务、未说明用户 diff 或未知外部状态。
- execution state、phase result、`change-0.md`、effective requirements、AGENTS/活动文档之间一致后，initial run 才可 `completed`。

## 4. 风险、恢复与修订记录

### 中断恢复规则

- 若在任务开始前中断：保持 phase `ready`、当前任务 `无`；恢复时先读 execution state 并核对三个规划指纹。
- 若任务部分完成：保持 phase/task `in_progress`，记录实际文件、当前数据库 profile/目标、最后一项验证和最小下一步；不得假定任务完成或启动后续任务。
- 若 migration 未知：停止 API/Worker 验证，只读检查 `system_metadata`、`kysely_migration` 和 M2 表 inventory；确认 version 2 完整或 version 3 完整后再继续。
- 若 core/hard gate 失败：记录为 blocker，修复后只重跑可能失效的定向证据和最终门禁；不得降级为 supplemental。
- 若 supplemental 异常：先证明与 core/硬门禁隔离，再从 `FND-I-001` 顺序登记；开放 finding 不是未决问题。

### 阶段计划修订记录

| 修订 | 日期 | 变更 | 原因与依据 | 追踪影响 |
| --- | --- | --- | --- | --- |
| 1 | 2026-07-29 | 创建 P-001 expanded 计划，含三个顺序任务、migration/多 writer 恢复、relaxed gate split 和 Q-001 评论语义 | implementation plan revision 1、schema 3.2 合同、项目基线与用户明确选择 B | 覆盖 FR-001–FR-032、AC-001–AC-020；下一 finding ID `FND-I-001` |
