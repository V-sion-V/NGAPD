# M1 initial run：P-001 阶段结果

- 运行编号：`initial`
- 阶段：`P-001`
- 阶段计划：[`phase-001-plan.md`](phase-001-plan.md)
- 阶段计划修订：`1`
- 父路线图修订：`1`
- 需求指纹：`sha256:f3ab380a2826c494223aff7b3c7ae7c9e8904d8d2ddf2ad0392adb26488020d8`
- 路线图指纹：`sha256:94c85511348f628b1c0edb0d6133f4b3ca453d91815fbd306f45f7e529a5de22`
- 阶段计划指纹：`sha256:87d211f67435295efc04b44c09eade9f9d62e74dfcfd0803656ab7b0c4717964`
- 完成时间：`2026-07-28T18:19:00+08:00`
- 状态：`completed`
- 交付与验证策略：`relaxed`
- 验证结论：`passed`
- 开始基线：分支 `requirements/m1-project-role-members`，提交 `f9efee992394f1b6761182237cf736f79561ad5b`；仅 M1 requirements/workflow 目录为用户已有或规划产生的未跟踪文件，生产工作树干净
- 结束基线：同一分支与提交上的未提交工作树；未 commit、push、reset、stash，也未改写用户 requirements/workflow contract 或 M0 封存记录

## 1. 阶段目标与实际结果

P-001 已在不开放 M1 公共路由的前提下，建立后续 P-002 可以消费的共享契约、纯领域规则和前向数据基础：

- Contracts 新增个人资料、Project、Membership、Join Request、Owner Transfer、Project Role 与 Admin Mode 的版本化 runtime Schema、动作、写入输入和稳定错误；既有 `SessionActor`、Identity、Pairing、Workspace、Task 契约保持兼容。
- Domain 新增 Project Governance、Membership 生命周期、重新加入、Owner Transfer、Admin Mode、Logical Role 和成员移除阻塞规则；逻辑角色内容永不授权，Owner 专属、管理员模式与成员自助操作保持独立。
- Membership 生产权威已从 `active/role` 收敛为 `status/permission_level`；现有 Task、Task Lifecycle、Workspace、Foundation 与授权路径均消费新权威，没有长期双写或旧字段读取。
- 正式 Schema profile 更新为 version 2，并追加唯一前向迁移 `0008-m1-project-role-members`；完整正式 version 1/`0001`—`0007` 被识别为 `behind`，未知或非前缀历史继续 fail closed。
- 0008 增加资料、Membership 状态、Join Request、项目角色/绑定、Owner Transfer、Admin Mode、M1 幂等、精确事件受众和唯一活动 Owner 数据约束；现有 inactive Membership 回填为 `removed/member`。
- 74 个 `id/title/desc` 系统角色模板已成为随 `@ngapd/domain` 发布并在启动时校验的生产资产；与 `docs/11-logical-role-templates.json` 语义一致，既有项目和新建项目均得到幂等独立快照。
- Outbox 与资源失效投影支持精确 `user`/`project` 受众；Event Repository 仅向当前用户本人或当前活动项目成员暴露失效提示。
- 当前 API 仍只注册 Identity、Events 和 Workspace 路由；没有 Project、Membership、Role、Admin Mode、Join Request 或 Owner Transfer 的半成品 `/api/v1` 路由。

P-001 只完成 FR-001–FR-046 的契约、领域和数据基础，以及 AC-001–AC-022、AC-024–AC-026 可由基础层独立证明的部分。完整 M1 Repository/应用服务/公共 API/并发事务属于 P-002；Web、活动正式设计文档修订和最终发布验收属于 P-003。本结果不把基础层证据扩大为后续阶段的最终验收。

## 2. 任务、需求与验收覆盖

| 任务 | 状态 | 阶段范围 | 完成结果 |
| --- | --- | --- | --- |
| `P-001-T-001` | completed | FR-001–FR-046 的共享契约/纯领域基础；AC-001–AC-019、AC-024–AC-026 的基础层部分 | M1 runtime Schema、稳定错误、状态机、权限矩阵、Owner 不变量、Role 不授权、Admin Mode 30 分钟服务端派生有效性、移除阻塞与生命周期锁输入完成 |
| `P-001-T-002` | completed | FR-001–FR-046 的数据/迁移/现有 Repository 兼容基础；AC-001–AC-021、AC-024–AC-026 的迁移与数据部分 | 0008、version 2 profile、Kysely 类型、74 模板、既有项目快照、Membership 新权威、Outbox 受众、现有 Repository/fixtures 与失败回滚完成 |
| `P-001-T-003` | completed | P-001 范围的 AC-021、AC-024–AC-027 兼容、构建、安全与恢复门禁 | 正确 Node/PostgreSQL/Windows 上的 API、CLI、Worker、根工程门禁通过；无公共 M1 半路由、外部 API/AI/LLM、隐式生产 reset、活动测试进程或封存记录改写 |

阶段退出不变量全部满足：

- Identity、Pairing、Device、Workspace、SSE 和内部 Task 公共/应用行为保持兼容。
- Project Owner 只能引用同项目活动 Membership；普通成员 Task Owner 可变为 inactive 而不改写历史引用，Owner 本人不能被移除。
- 非活动 Membership 不能成为新的显式 Task Owner或取得 Workspace 写资格。
- 迁移失败保留完整 version 1/`0007` 前态；成功后 API/Worker 可识别 version 2 ready。
- 没有新增 M1 公共路由，也没有修改 M0 封存执行证据。

## 3. Schema、迁移与数据证据

- PostgreSQL：官方 EDB PostgreSQL `17.10` Windows x64 便携包；ZIP `333927270` bytes，本地 SHA-256 `EF9B1E5E23D2E8A83914BA13D9DC536A72210FBA53FD1808FF1F7E06BB22B106`；隔离目标 `127.0.0.1:55437/ngapd_p001`。
- 空库路径：`0001-system-metadata` 至 `0008-m1-project-role-members` 全部成功，最终 profile version 2 `ready`。
- 正式升级路径：精确迁移到 `0007-application-projections`、metadata version 1、写入代表性 User/Project/Membership/Task/Workspace/Audit 数据后，profile 为 `behind`；0008 后为 `ready`。
- 保留证据：User/Membership/Project/Task UUID、显式 Task Owner、Workspace sync version `3/2`、Task 状态和不可变审计 ID/request/target 均保持。
- 回填证据：显示名取原登录名，默认说明/介绍为空；M0 inactive Admin Membership 变为 `removed/member`，活动 Owner 保持 `active/admin`。
- 模板证据：系统模板与既有项目角色快照均为 74；生产 JSON 进入 Domain `dist`，fixture 对 docs 与生产对象逐项 parity。
- 幂等证据：重复 migrate 不增加 `kysely_migration` 记录；角色快照受项目/模板唯一索引保护。
- 故障恢复证据：用空登录名触发新显示名 check 失败后，metadata 仍为 version 1、0008 迁移记录和 `display_name` 列均不存在，原 User 仍在。
- 数据约束：Membership 状态/版本/介绍、唯一 pending Join Request、唯一 pending Owner Transfer、项目/模板角色快照、同项目 Membership/Role 外键、Admin Mode 活动 scope、事件受众 scope 和 Project 活动 Owner 均由数据库约束、唯一索引或延迟 constraint trigger 保护。

首次真实 PostgreSQL 运行发现带参数的多语句 prepared statement 被 `pg` 以 `42601` 拒绝；0008 收尾和代表性 seed 已拆成单语句执行。旧递归 Owner 测试曾通过移除 Project Owner 制造 inactive 状态，新约束正确拒绝；测试改为独立普通成员 Task Owner 后保持原诊断意图。两项均由数据库完整套件重跑关闭。

## 4. 文件修改

### 4.1 共享契约与领域

| 文件 | 修改模式 | 主要目的 |
| --- | --- | --- |
| `packages/contracts/src/identity.ts`、`projects.ts`、`errors.ts`、`events.ts`、`index.ts` | modify | M1 资料/项目资源、稳定错误、精确事件受众与导出；保留既有公共形状 |
| `packages/contracts/src/admin-mode.ts`、`memberships.ts`、`ownership-transfers.ts`、`roles.ts` | add | M1 状态、资源、动作与写命令 runtime Schema |
| `packages/contracts/src/m1-contracts.test.ts` | add | 输入边界、未知字段、最小披露、动作、版本和兼容契约 |
| `packages/domain/src/authorization.ts`、`task-owner.ts`、`index.ts`、`tsconfig.json` 及目标测试 | modify | Membership 新权威、Owner/Workspace 授权、导出与 JSON 构建 |
| `packages/domain/src/admin-mode.ts`、`logical-role.ts`、`membership.ts`、`ownership-transfer.ts`、`project-governance.ts` 及目标测试 | add | M1 纯状态机、权限、锁范围、移除阻塞、Owner 与 Role 不授权 |
| `packages/domain/src/system-logical-role-templates.json`、`system-logical-role-templates.ts` | add | 74 个生产模板及结构、非空、唯一性启动校验 |

### 4.2 数据、现有消费者与兼容 fixture

| 文件 | 修改模式 | 主要目的 |
| --- | --- | --- |
| `packages/database/src/migrations.ts`、`types.ts`、`schema-profile.ts`、`schema-profile.integration.test.ts` | modify | 0008、version 2 profile、M1 表/列/约束/回填和空库 ready |
| `packages/database/src/m1-migration.integration.test.ts` | add | 正式 0007 升级、数据保留、模板、重复 migrate 与失败回滚 |
| `packages/database/src/foundation-repository.ts` | modify | User/Project 新必填字段、Owner Membership 新权威与项目角色快照 |
| `packages/database/src/task-repository.ts`、`task-lifecycle-repository.ts`、`workspace-repository.ts` 及集成测试 | modify | 新 Membership 权威、生命周期锁、inactive Owner/Workspace 行为与兼容回归 |
| `packages/database/src/outbox-repository.ts`、`outbox-repository.integration.test.ts` | modify | user/project 精确受众投影与活动成员过滤 |
| `packages/test-fixtures/src/workspace-authorization.ts`、`repository-fixtures.test.ts` | modify | 新 Membership 字段与生产模板/docs parity |
| `apps/api/src/modules/events/service.ts`、`events.integration.test.ts`、`modules/tasks/service.ts`、`workspace.integration.test.ts`、`workspace-cli.integration.test.ts` | modify | SSE/Task/Workspace 消费者与新受众、Membership 权威及测试 seed 兼容 |
| `apps/worker/src/outbox-task.integration.test.ts` | modify | Worker Outbox fixture 补齐 project 受众字段 |
| `AGENTS.md` | modify | 当前阶段更新为 P-001 completed/passed、initial run awaiting next phase，并新增 M1 工作流索引 |

### 4.3 工作流证据

| 文件 | 修改模式 | 主要目的 |
| --- | --- | --- |
| `docs/requirements/m1-project-role-members/implementation-plan.md` | add | initial roadmap revision 1；规划产出，未在实施中改写 |
| `docs/requirements/m1-project-role-members/execution/initial/phase-001-plan.md` | add | P-001 expanded plan revision 1；规划产出，未在实施中改写 |
| `docs/requirements/m1-project-role-members/execution/initial/execution-state.md` | add/update | expanded 前后检查点、失败尝试、修正、验证和恢复状态 |
| `docs/requirements/m1-project-role-members/execution/initial/phase-001-result.md` | add | 本不可变完成结果 |

`workflow-contract.md` 与 `requirements.md` 是规划前用户已有输入，实施未改写。M0 和其他已封存 `change-N`、execution state、phase result 均未修改。

## 5. 测试与验证

最终有效证据使用仓库锁定的 Node.js `24.18.0` 和 pnpm `11.9.0`。Node 便携包来自 Node.js 官方发布地址，并按官方 `SHASUMS256.txt` 验证 SHA-256 `0ae68406b42d7725661da979b1403ec9926da205c6770827f33aac9d8f26e821`。

| 验证 | 方法 | 最终结果 |
| --- | --- | --- |
| V-001 Contracts | `@ngapd/contracts` typecheck/test | passed；2 files/11 tests |
| V-001 Domain | `@ngapd/domain` typecheck/test | passed；16 files/68 tests |
| V-002/V-003 Database | PostgreSQL 17.10；`@ngapd/database` typecheck/test | passed；8 files/41 tests，全部真实运行 |
| 模板与 Fixtures | `@ngapd/test-fixtures` typecheck/test；Domain build/dist JSON | passed；6 files/40 tests；74 模板 parity/打包通过 |
| V-004 API/Windows | Node 24、PostgreSQL 17.10、已授权 `C:\tmp`/PasswordVault；重建消费者后 `@ngapd/api` test | passed；7 files/21 tests；两轮 Windows CLI small sync 为 1452.64ms/1445.06ms |
| V-005 根门禁 | 同一 Node/PostgreSQL/Windows 上下文；`pnpm check` | passed；format、lint、packages/apps build、10 个 workspace typecheck、全部适用测试通过 |
| 根测试总计 | 根 `pnpm test` 实际输出汇总 | 249 tests passed；7 个非 Windows 平台条件测试 skipped；0 failed |
| 路由与安全负向 | `rg` 路由、added-line reset/外部调用搜索、Git/进程检查 | passed；无 M1 公共路由、无新增 reset/外部 API/AI/LLM、无 Node/pnpm 测试进程 |
| 补丁与历史 | `git diff --check`、`git status`、requirements/roadmap/phase plan SHA-256、封存路径 diff | passed；指纹不变、无补丁错误、无 M0/其他封存记录修改 |

根门禁的失败尝试均保持 blocking 并在修正后从头重跑：

1. 14 个文件不符合 Prettier，机械格式化后关闭。
2. Logical Role 的“不授权”输入参数触发 lint，保留契约并显式消费后关闭。
3. Worker 旧 Outbox fixture 缺少新受众字段，补齐后关闭。
4. sandbox 内固定 `C:\tmp`/PasswordVault 不可用；在已授权 Windows 上下文、正确 Node 与显式数据库目标下完整重跑后关闭。

## 6. 发现项、决策与计划偏差

当前无正式 `FND-I-*`；下一可用 ID 仍为 `FND-I-001`。

| ID | 类别 | 严重程度 | 关联需求/验收 | 观察与证据 | 最终功能影响 | 处置 | 置信度 | 建议后续 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

- 无产品范围、阶段边界、验收层级、迁移策略或用户决策偏差。
- 文件级范围扩展：精确 SSE 受众要求修改既有 `contracts/events.ts` 与 API Event 消费者；根门禁要求适配 Worker Outbox integration fixture。它们均是 P-001 兼容/受众硬门禁的直接结果，没有开放新产品能力。
- 正确工具链诊断前曾在全局 Node 20 下观察 `hash-wasm argon2 is not a function`；仓库要求 Node 24，切换并验证官方 24.18.0 后全部 Identity/Pairing 测试通过，没有为错误运行时修改生产安全代码。
- README 不包含会被 P-001 状态改变的里程碑声明，无需修改。活动正式设计文档中被 M1 requirements 取代的旧结论按路线图由 P-003 统一修订；P-001 没有提前改写它们或 M0 封存证据。

## 7. 恢复、安全与清洁度

- 0008 仅前向；迁移失败依赖 PostgreSQL 事务保留 version 1/`0007`。已应用后优先 roll forward；没有自动 down/reset 承诺。
- 实施和验证只连接显式隔离数据库 `ngapd_p001`；没有接触现有生产数据库、外部业务 API、AI/LLM、消息系统或用户通信。
- 所有下载仅用于门禁运行时：官方 PostgreSQL 17.10 与 Node 24.18.0 便携包，均位于精确 `C:\tmp` 任务目录。
- 阶段收尾时停止临时 PostgreSQL，确认无活动 Node/pnpm 测试进程，再删除两个可再生下载/数据目录；清理不影响仓库或测试证据。
- 工作树保留用户未提交输入和本次实现，不执行 commit、push、reset、checkout、stash 或覆盖。

## 8. 遗留边界与下一阶段进入条件

- P-002 尚无 just-in-time 详细计划，不得由实施技能直接开始。
- 下一次必须使用 `$plan-feature-implementation` 基于本结果、当前 `execution-state.md` 和最新项目事实，复核 roadmap revision 1 并只规划 P-002。
- P-002 负责完整 Projects/Membership/Roles/Admin Mode Repository、应用服务、公共 `/api/v1`/OpenAPI、幂等、审计、Outbox/SSE、租约撤销及 PostgreSQL 原子/并发/故障闭环。
- P-003 负责中文 Web、可访问性、活动正式产品/领域/权限/架构/路线/决策文档同步和最终发布验收。
- 初始运行保持 `awaiting_next_phase`；只有 P-002 和 P-003 均各自产生 immutable completed/passed result 且最终 core/硬门禁通过后，才允许生成 `change-0.md` 与 `effective-requirements.md`。
