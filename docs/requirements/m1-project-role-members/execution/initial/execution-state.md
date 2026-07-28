# M1：项目、角色和成员初始执行状态

- 运行编号：`initial`
- 运行类型：`首次实现`
- 目标记录：`change-0.md`
- 运行状态：`completed`
- 交付与验证策略：`relaxed`
- 验证结论：`passed`
- 当前路线图修订：`1`
- 需求指纹：`sha256:f3ab380a2826c494223aff7b3c7ae7c9e8904d8d2ddf2ad0392adb26488020d8`
- 路线图或变更计划指纹：`sha256:94c85511348f628b1c0edb0d6133f4b3ca453d91815fbd306f45f7e529a5de22`
- 当前阶段计划指纹：`sha256:e818fc35eb1fc8f6ce77cd331089e3b9f52332e0b0c491e14c511d176b02063a`
- 当前阶段：`P-003（completed）`
- 当前任务：`无（initial run completed）`
- 项目基线：分支 `requirements/m1-project-role-members`，提交 `f9efee992394f1b6761182237cf736f79561ad5b`
- 最后更新时间：`2026-07-29T02:34:30+08:00`

## 1. 运行目标或待生效变更

按已批准的 M1 schema 3.2 需求交付项目、角色和成员完整闭环，并在完成全部 core/硬门禁后生成 `change-0.md` 与 `effective-requirements.md`。

初始运行采用用户明确选择的 `relaxed` 策略：不要求 red-first；全部 core、安全、隐私、数据完整性、公共兼容、构建、恢复和项目/发布门禁继续阻塞。只有独立证明不影响交付行为的 supplemental 异常可按 `FND-I-*` 保留为 report-only。

P-001/P-002/P-003 已完成并封存，初始实现由 `change-0.md` 与 `effective-requirements.md` 冻结。后续需求或行为变化只能通过 `$apply-feature-change` 创建连续 change run；不得改写任何 initial phase result 或 `change-0.md`。

## 2. 阶段状态

| 阶段 | 计划 | 状态 | 进入条件 | 退出证据 |
| --- | --- | --- | --- | --- |
| P-001 | [`phase-001-plan.md`](phase-001-plan.md)，revision 1 | completed | 已满足 | [`phase-001-result.md`](phase-001-result.md)，passed，`sha256:eb06f279d3b09f7358a1b97c9066f4baf0278f3c98293a4d047638cc3dec255f` |
| P-002 | [`phase-002-plan.md`](phase-002-plan.md)，revision 1 | completed | P-001 completed/passed；requirements/roadmap/P-001 result 与当前项目事实已由 rolling planning 复核 | [`phase-002-result.md`](phase-002-result.md)，passed，`sha256:b2662ce5091b7f5048e9cc727f9e6a78101619a5ed0b6248594a6074f4eeae5c` |
| P-003 | [`phase-003-plan.md`](phase-003-plan.md)，revision 1 | completed | P-002 completed/passed；requirements/roadmap/P-001/P-002 result 与当前 Web/正式文档事实已由 rolling planning 复核 | [`phase-003-result.md`](phase-003-result.md)，passed，`sha256:774fc276b9501a24ec1b3d77ec1e8d211e24a6b294efe71096dd6508135bb7dd` |

P-001/P-002/P-003 均已封存为 completed/passed；initial run 没有活动阶段或任务。

## 3. 当前检查点

- 需求审核：passed；结构、FR/AC、流程、数据、接口、迁移、权限、安全、恢复、兼容、不变量、决策记录和未决问题均满足规划条件。
- 合同审核：passed；schema `3.2`，artifact 路径与 feature ID 一致，没有 `change-0.md` 或冻结历史。
- 规划模式：rolling phase；P-003 eligibility 已复核通过。
- 路线图：revision 1，`phased + expanded`，三阶段。
- 当前阶段计划：P-003 revision 1，`expanded`，三个顺序任务；指纹为 `sha256:e818fc35eb1fc8f6ce77cd331089e3b9f52332e0b0c491e14c511d176b02063a`。
- 生产实现：P-001-T-001、T-002、T-003 与 V-001–V-005 全部完成；不可变 [`phase-001-result.md`](phase-001-result.md) 已生成，指纹为 `sha256:eb06f279d3b09f7358a1b97c9066f4baf0278f3c98293a4d047638cc3dec255f`。
- 规划前用户工作：整个 M1 目录为未跟踪状态，其中 `workflow-contract.md` 与 `requirements.md` 是用户已有输入，必须保留。
- 最终结果：P-003-T-003、FR-047、V-012/V-013/V-016 和初始运行收口已完成；V-014/V-015 因当前环境不可用按合同记为 `not_run`。P-003 result、`change-0.md` 和 `effective-requirements.md` 已生成。
- P-001 完成条件：空库/正式 `0007` 前向迁移、重复 migrate、未知历史 fail closed、故障回滚、74 模板/项目快照、数据保留、Membership 新权威、现有公共兼容、根工程和安全范围门禁全部通过。
- 数据库收尾：PostgreSQL 17.10 隔离库最终为 profile 2、8 个迁移、latest 0008、74 模板、0 非法 Owner、0 活动 lease；cluster 已 fast-stop，55437 无响应，PostgreSQL 与 Node 24 可再生 `C:\tmp` 目录及 Workspace test temp 均已删除。
- P-001-T-001 完成结果：新增个人资料、Project/Membership/Join Request/Owner Transfer/Project Role/Admin Mode runtime Schema、稳定错误与资源动作；领域层新增 Membership 生命周期、共享锁范围、移除阻塞、Project Governance/Owner、Admin Mode、Ownership Transfer 与 Logical Role 规则，并把现有 Workspace/Task Owner 授权迁移到 `status/permissionLevel`。
- P-001-T-001 兼容结论：`SessionActorSchema`、既有 Project/Task/Workspace Schema 与导出保持；`MembershipRoleSchema` 仅作为 M0 源码兼容别名，新的字段权威为 `permissionLevel/status`。下游数据库适配按计划由 T-002 完成。
- Rolling planning 复核结果：requirements、roadmap、P-001/P-002 result 指纹全部一致；P-001/P-002 completed/passed 退出条件未被项目漂移推翻。`apps/web`、README 和六份活动正式设计文档没有未记录用户改动；当前 diff 为已记录的 P-001/P-002 产出、用户已有 M1 输入和本次 P-003 规划证据，无 unresolved 问题。
- P-002 设计依据：沿用 roadmap revision 1 的 `phased + expanded` 和 `relaxed`；后端必须作为一个可独立验收阶段保持完整，阶段内按 Repository → application service → public routes 三个检查点执行，不能交付半事务公共表面。
- P-002 Schema 边界：`migrations.ts`、`types.ts`、`schema-profile.ts` 与 immutable P-001 result 不在预期修改范围；若现有 `0008` 无法表达任一 core 不变量，必须暂停并由 rolling planning 追加 corrective phase，不得改写已完成证据。
- P-003 设计依据：沿用 roadmap revision 1 的 `phased + expanded` 和 `relaxed`；expanded 的具体原因是同一公共 React 表面必须兼容现有认证/设备/prototype、正确覆盖服务端治理矩阵和管理员能力，并在最终阶段同步六份活动正式文档与发布证据。
- P-003 后端边界：P-002 Contracts/OpenAPI/API/Database 与 immutable result 默认只读。若 Web 无法只凭已冻结 DTO/路由完成任一 core 流程，必须停止并由 rolling planning 追加 corrective phase，不得在本阶段静默改写已完成后端证据。
- 环境事实：当前主机未发现 Docker 命令，也没有保留的 P-002 PostgreSQL 或参考服务器；实施必须新建显式 PostgreSQL 17 隔离目标，Compose/P95 按 requirements 区分 passed、`not_run` 与 finding。
- 下一动作：initial run 已冻结；后续变化从 `$apply-feature-change` 开始，先读取当前有效需求、`change-0.md` 和本 completed state。

### 3.1 P-001-T-001 前置基线

- Git 基线：分支 `requirements/m1-project-role-members`，HEAD `f9efee992394f1b6761182237cf736f79561ad5b`。
- 完整状态：仅 `docs/requirements/m1-project-role-members/` 下 5 个工作流文件未跟踪；所有生产文件均为 tracked/clean，没有用户生产代码重叠。
- 用户所有权：`workflow-contract.md` 与 `requirements.md` 是用户输入；其余 3 个未跟踪文件是已记录的规划产出。本任务只更新本状态文件，不改写另外 4 个输入/规划文件。
- 关键 before-state SHA-256：
  - `packages/contracts/src/identity.ts`：`dc2f43f23b869a0746a0f4c984c569e3ec8dd74d98117b7b1741e327502652cc`
  - `packages/contracts/src/projects.ts`：`498bc87821c50999ce7d9cc583328e6061e92220880e84d5d72f830b8d2538f6`
  - `packages/contracts/src/errors.ts`：`5e739e1e6755c98539a78bc21321a5d07d57278884196897947a06b79536b5e0`
  - `packages/contracts/src/index.ts`：`18121af8717be82afc4f3c8c2521fb1fb73d04d410a0a8300de95b39d5c6777a`
  - `packages/domain/src/authorization.ts`：`75b387cb2b288c805bb29631a36b5cb4b8848185a542602a4b488e9d0241c091`
  - `packages/domain/src/task-owner.ts`：`63d43bc5b16e6630354489e60bd7f537595079812dbf61912462868c9f5d2949`
  - `packages/domain/src/index.ts`：`c37ef08594a31d16bc4a7e0b5dd14f0e2bde35ca2e12062068bf8fdcca100e2d`

### 3.2 P-001-T-002 前置基线

- Git/用户所有权继续沿用 3.1；T-001 生产 diff 已有完整后检查点，T-002 预期数据库/API/fixture 文件在任务开始前均为 tracked/clean，无用户重叠。
- 正式迁移前缀：`0001-system-metadata` 至 `0007-application-projections`；metadata 为 `m0-domain-baseline / version 1`。
- 关键 before-state SHA-256：
  - `packages/database/src/migrations.ts`：`fb6130d70f92756dbed64a41501ad4fa08d629702f0f78088e588c57de955f87`
  - `packages/database/src/types.ts`：`aebbc9eb767a2d9615f66380e04fe674611ee41546f12c456319053fa3847ced`
  - `packages/database/src/schema-profile.ts`：`8cbffd638ce49ad7bd7a371257a530de619943127fb4cafb3acfc26982e3a3aa`
  - `packages/database/src/foundation-repository.ts`：`03c8471b4c692ee5c646d6aea631f0bbac0edb30e48c99db88952c6571cb1fea`
  - `packages/database/src/task-repository.ts`：`afd40cef61aa0df0352d372584fecace1103c323b7024b609231e2f1cd7ccd80`
  - `packages/database/src/task-lifecycle-repository.ts`：`f1865ecd63b57a34fe05a3990debb4244714a2873b093d83d6623daa142953ea`
  - `packages/database/src/workspace-repository.ts`：`85965fe80f0abf837ff11e0cde569394146ed054cba7ecc6ae02f315220027ef`
  - `packages/database/src/outbox-repository.ts`：`22d6025d166ee2709e1dc852fe70d3c7ddc4da8f3be42cef3566ae3a1754f5a5`

### 3.3 P-001-T-002 后检查点与 P-001-T-003 前置基线

- 0008 结果：空库 `0001`—`0008` 与完整正式 `0007` 代表数据升级均得到 profile version 2 `ready`；重复 migrate 不增加记录；迁移失败完整回滚到 version 1 且没有残留列/迁移记录。
- 数据保留：既有 User/Membership/Project/Task ID、显式 Task Owner、Workspace sync version、不可变审计保持；inactive M0 Membership 回填为 `removed/member`；每个既有项目得到 74 个独立角色快照。
- 生产模板：`packages/domain/src/system-logical-role-templates.json` 随构建进入 `dist`；与 `docs/11-logical-role-templates.json` 的 74 个 `id/title/desc` 语义完全一致，测试夹具 parity 通过。
- Repository 权威：生产 Membership 查询只使用 `status/permission_level`；残留搜索中的 `active` 均为 User、Workspace lifecycle 或 lease 权威，不存在旧 `memberships.active/role` 生产读取。
- 真实数据库目标：PostgreSQL 17.10，`127.0.0.1:55437/ngapd_p001`；数据库包 8 files/41 tests 全绿，未使用 reset 掩盖失败。
- 首次门禁缺陷与修正：`pg` 拒绝带参数的多语句 prepared statement，已拆分 0008 收尾和代表性 seed；旧递归 Owner 测试曾通过移除 Project Owner 制造 inactive 状态，已改为独立普通成员 Task Owner，保留测试意图并遵守新不变量。
- 关键 after-state SHA-256：
  - `packages/database/src/migrations.ts`：`f96d47fbb86cfe5cd8d556779e53814c1fd853fa983d59faa54609f838c0d57c`
  - `packages/database/src/types.ts`：`30a5a134ae562d80825261526b0a5a6b91f2fda7808c7d5321171fad92545062`
  - `packages/database/src/schema-profile.ts`：`68097c8050550a7f3008c7709d87c04a63779585b83f3e278c678d888b8bd1ec`
  - `packages/database/src/foundation-repository.ts`：`cd062bc795d26b6aea6b5cc5968ed94561892cabbd8a31d47013f75150456b4b`
  - `packages/database/src/task-repository.ts`：`e35da78d9ffbe1532833b2cc62fd868001880888e088a61749923aa3446c85e1`
  - `packages/database/src/task-lifecycle-repository.ts`：`0caced3c5b107a568b5ba526351716dd6fa066d9032a7eb66e76981673162954`
  - `packages/database/src/workspace-repository.ts`：`1ed9de160e95b35c852d3f1cca8e712125f6423093c5d2590356dc7e99d1aa5a`
  - `packages/database/src/outbox-repository.ts`：`c3e614c4cb9dcd85cb320eff1ac11ca9b961a9feddbbda98905208f6d7b42c3a`
- T-003 前置范围：受影响 API/test-fixtures typecheck 与测试、OpenAPI/路由检查、根 `pnpm check`、Git/封存历史/外部调用核查、AGENTS/README/活动正式文档一致性，以及阶段结果/状态文件；不实现 P-002/P-003 产品功能。

### 3.4 P-002-T-001 前置基线

- Git 基线继续为分支 `requirements/m1-project-role-members`、HEAD `f9efee992394f1b6761182237cf736f79561ad5b`；当前 tracked/untracked diff 与 P-001 result 和本状态第 5 节的累计清单一致，没有 P-002 生产文件或用户新增生产改动。
- requirements、roadmap、P-001 plan/result 与 P-002 plan 指纹已重新核对，分别为 `f3ab380a...020d8`、`94c85511...5de22`、`87d211f6...17964`、`eb06f279...c255f`、`a8da8f75...29865`；状态、计划和当前文件一致。
- P-001 的 8 个关键数据库 after-state SHA-256 已逐项重新验证，与 3.3 完全一致；`migrations.ts`、`types.ts`、`schema-profile.ts` 保持 P-002 计划明确的只读边界。
- 当前任务预期新增 `project-membership-repository.ts`、`project-role-repository.ts` 及真实数据库 integration tests；预期修改 `identity-repository.ts`、`foundation-repository.ts`、`task-repository.ts`、`task-lifecycle-repository.ts`、`workspace-repository.ts`、`index.ts` 和必要的既有目标 tests/fixtures。任何额外文件必须是 V-006 的直接依赖并在后检查点解释。
- 显式验证目标预留为 PostgreSQL `17.10`、`127.0.0.1:55438/ngapd_p002`，运行目录 `C:\tmp\ngapd-m1-p002-postgres-17.10`；开始时无活动 PostgreSQL/pnpm 测试进程，不复用 P-001 已删除的 55437 环境，也不调用 reset/down。
- 任务完成条件：所有 M1 Repository 读写、稳定排序、幂等 request SHA-256 replay、乐观版本、固定锁顺序、租约/Admin Mode 失效、成员移除阻塞、Owner Transfer、项目归档、故障注入和真实并发证据通过；没有新 Schema、双重 Membership 权威或公共 M1 路由。

### 3.5 P-002-T-001 后检查点

- 实际实现：新增 `m1-repository-support.ts`、`project-membership-repository.ts`、`project-role-repository.ts` 与统一 integration test；修改 `identity-repository.ts`、`foundation-repository.ts`、`task-repository.ts`、`task-lifecycle-repository.ts`、`workspace-repository.ts`、`index.ts`。没有修改 `migrations.ts`、`types.ts`、`schema-profile.ts`，三者 SHA-256 仍分别为 `f96d47fb...d57c`、`30a5a134...062`、`68097c80...1ec`。
- Repository 结果：个人资料版本写入、Project 原子创建与 74 角色快照、Join Request 首次默认值复制/再次加入保留、Membership 资料/权限/移除、Owner Transfer、Project 生命周期、Admin Mode 与 Project Role 全部形成正式事务入口；公开列表使用确定排序，幂等键先以事务级 advisory lock 串行化并比较 request SHA-256。
- 治理锁与失效：治理写入口在事务内核对 actor user/Membership；固定为 Project → 稳定 Membership → Request/Admin/Role → Task → Workspace/Lease；Task create/owner change/reopen 补齐 Membership 锁；Workspace 写事务先锁 Project/Membership 再锁 Workspace，项目归档与新租约不能穿透。Admin Mode/Lease 先按 ID 稳定锁定再撤销。
- 原子性：成功状态、版本、幂等响应、不可变 audit 与精确 user/project audience Outbox 同事务；Outbox trigger 故障注入证明业务、audit、outbox、幂等记录全部回滚。user audience Outbox 的 `project_id` 保持为空，project 仍保留在 audit 上下文。
- 并发与安全：并发相同幂等键只创建一个 Project 且一次 replay；成员移除与 Task Owner 创建只允许完整前态或后态；项目归档与 Workspace lease 获取并发后不存在活动 lease；伪造他人 Owner Membership 开启 Admin Mode 被 Repository 拒绝；归档 Role 保留历史绑定但不能建立新绑定。
- 验证环境：Maven Central Zonky PostgreSQL 17.10 Windows x64 artifact `23,357,276` bytes，SHA-512 `8c5a905a35b41f97f4a675bc50a983abac094a49b57262d35e7e38f56ad482eb60fc4dbc3412f1906d3a810dd67782ad391be443757e60397835fc41f473bcf8`；`postgres`/`initdb`/`pg_ctl` 均报告 17.10。隔离目标为 `127.0.0.1:55438/ngapd_p002`，当前保留供 T-002/T-003 连续验证。
- V-006：Node 24.18.0、pnpm 11.9.0；`@ngapd/database` typecheck passed，真实 PostgreSQL 下 9 files/47 tests passed；连接设有 30 秒 statement timeout 与 15 秒 lock timeout。根 ESLint、Prettier、`git diff --check` 均通过。
- 首跑修正：首次真实运行为 41 passed/6 failed，暴露 advisory key 的 NUL 非法 UTF-8 与测试排序假设；修正后第二次为 45 passed/2 failed，暴露 user audience Outbox 不应带 project scope；三项均属 T-001 core，在最终完整 V-006 中关闭。EDB 大包与 shell Maven 下载均截断，未使用任何不完整字节；改用浏览器通道取得同一 Maven artifact，并仅在长度与发布 SHA-512 完全匹配后解压。
- 范围结论：没有新 Schema、双重 Membership 权威、`app.ts` diff 或 M1 公共路由；`apps/api/src/modules/module-boundaries.ts` 中的 M1 模块名为 P-001 已记录骨架，不是路由注册。无开放 finding 或阻塞。

### 3.6 P-002-T-002 前置基线

- T-001 后检查点、V-006 与 PostgreSQL 17.10 隔离目标均已复核；当前无用户新增重叠、无活动测试进程、无公共 M1 路由。
- 既有应用模式为 Fastify route → application service → Kysely Repository/Domain；`TaskApplicationService` 已提供服务端 Membership 解析、稳定 `ApplicationError` 和事务回滚后去重 failure audit 范式。T-002 复用该模式，不让 routes、客户端 actions、Role 内容或 Membership ID 成为授权权威。
- 预期修改 Contracts 的 M1 资源文件、`errors.ts`、`index.ts` 与 `m1-contracts.test.ts`，只补集合/详情/参数/组合响应和稳定错误；预期修改 Identity service 增加 Profile，用新建 `projects-membership`、`roles`、`authorization-audit` service/index 与目标 PostgreSQL tests 完成全部后端用例。
- 三个新模块目录在前检查点均不存在；`apps/api/src/app.ts` SHA-256 为 `a2ab7391...9ae2` 且本任务保持只读。既有 module-boundary 名称是 P-001 骨架。
- 关键 before-state SHA-256：Contracts `identity.ts` `2933b7f8...aa93`、`projects.ts` `1d147209...c737`、`memberships.ts` `f6f4d56e...4351`、`ownership-transfers.ts` `297d4f6a...b75`、`admin-mode.ts` `e3ef198a...5f50`、`roles.ts` `3427e47a...7d28`、`errors.ts` `ee46c266...8b9e`、`m1-contracts.test.ts` `a77568eb...486`；API `application-errors.ts` `19e6521d...020`、Identity service `36930848...4193`、Task service `a1992743...23c3`。
- T-002 完成条件：V-007 中 Contracts 与 application service typecheck/目标测试通过；覆盖 Owner 直接操作、Admin Mode 受保护操作、成员自助、跨租户/伪造 ID、Role 不授权、服务端 `actions`、失败 audit 去重和数据库异常传播；在后检查点前不开始 T-003。

### 3.7 P-002-T-002 后检查点与 P-002-T-003 前置基线

- 应用边界：Identity service 增加当前用户 Profile 读写；新增 `authorization-audit`、`projects-membership`、`roles` application service，统一从服务端 actor/Web Session、Project UUID、活动 Membership 与 Admin Mode 派生授权上下文，再调用正式 Repository 和纯领域决策。Role capability、客户端 `actions`、路由参数 Membership ID 均不构成授权材料。
- 资源与错误：Contracts 补齐 Project/Membership/Join Request/Owner Transfer/Admin Mode/Role 的 params、collection/detail/mutation runtime Schema 和必要稳定错误；服务端派生调用者 `actions` 与当前 Admin Mode，Repository 拒绝映射为稳定 `ApplicationError`，确定拒绝及未知事务异常分别写一次去重 failure audit。
- 目标验证：真实 PostgreSQL 17.10 下 3 个 application service integration tests 全绿，覆盖 Profile、项目幂等 replay、Owner 直接治理、成员自助、Admin Mode 受保护编辑/Role、Role 文本不授权、Join/权限/Owner Transfer/归档、跨项目伪造 Membership ID、失败 audit 去重及数据库异常回滚后 `INTERNAL_ERROR` audit；失败异常没有业务行或 Outbox 残留。
- V-007：Node 24.18.0、pnpm 11.9.0；Contracts typecheck 与 2 files/12 tests、Database/API typecheck、application service 1 file/3 tests、目标 Prettier/ESLint 和 `git diff --check` 全部通过。首次 API typecheck 的旧 `dist` 声明报错经重建 contracts/database 后消失；目标测试的 action/错误码/故障夹具断言按真实领域与 PostgreSQL 约束修正后最终全绿，均未隐藏生产缺陷。
- 直接依赖扩展：T-002 在 `project-membership-repository.ts` 增加按当前 Web Session 查询最新 Admin Mode 的只读方法，供服务端详情/actions 投影使用；没有新增写权威或 Schema。`migrations.ts`、`types.ts`、`schema-profile.ts` 指纹仍分别为 `f96d47fb...d57c`、`30a5a134...062`、`68097c80...1ec`。
- 路由禁令核查：`apps/api/src/app.ts` SHA-256 仍为 `a2ab7391...9ae2`，与 3.6 前检查点完全相同；尚无 M1 routes 文件或公共注册。T-003 现已满足进入条件，可开始公共 API/OpenAPI/SSE 实现。
- 关键 after-state SHA-256：Contracts `projects.ts` `4d0498ef...f80b`、`memberships.ts` `8c7ecae0...999`、`ownership-transfers.ts` `d3cc56fb...bd1`、`admin-mode.ts` `5dde5940...68fb`、`roles.ts` `1fa3a174...cca9`、`errors.ts` `ad981e82...6989`、`m1-contracts.test.ts` `9e06b849...5d7df`；API `application-errors.ts` `11d123b7...58b4`、Identity service `52023e65...ff03`、Authorization service `54aa89cf...dcfd`、Projects/Membership service `e1b17688...c7f24`、Roles service `3369216a...79f1`、service test `729d67ef...662f`。

### 3.8 P-002-T-003 后检查点与阶段完成

- 公共 API：Identity routes 增加 Profile GET/PATCH；新增 Projects/Membership、Roles、Admin Mode routes 并在 `app.ts` 一次性注册计划 2.3 节全部路径。Role detail 的应用服务只读方法是公共清单的直接依赖；没有开放 Task CRUD。
- 安全与契约：所有 M1 入口先解析当前 Web Session；状态改变要求 Same-Origin。共享 route context 使用 canonical method/path/body SHA-256；Admin Mode 由当前 session/project/membership 服务端核验。Fastify `removeAdditional=false` 使 TypeBox `additionalProperties:false` 真正拒绝未知字段；稳定错误可序列化 membership removal blocking tasks。
- OpenAPI/最小披露：OpenAPI 3.1 inventory 对 23 个 M1 path 的方法逐项验证；精确 join-target 仅返回 `acceptsJoinRequests/key/name`。跨项目 Membership IDOR 两次重试均为稳定 `MEMBERSHIP_NOT_FOUND`，只有一次 failure audit。
- 事件闭环：M1 API 成功写入生成精确受众 Outbox；测试经 Graphile Worker 使用的同一 `OutboxRepository.dispatchNext` 投影后，SSE 只向 user/活动项目成员返回失效提示。Worker 根套件独立验证该投影函数的并发、重试和一次性语义。
- V-008：API typecheck 与完整 9 files/27 tests passed；包括 M1 完整无 Web 闭环、OpenAPI、unknown field、Cookie/Origin、最小披露、IDOR、audit、Outbox/SSE，以及既有 Identity/Pairing/Workspace/Events/内部 Task。两轮真实 Windows small sync 为 1448.33ms/1453.90ms。
- V-009：首次根门禁仅在 format:check 列出两个 T-001 文件；机械格式化后从头 `pnpm check` passed。最终 format/lint、全部 packages/apps build、10 workspace typecheck 和 262 tests passed，0 failed；7 个非 Windows 平台条件测试 skipped。根 API small sync 为 1511.58ms/1428.96ms，Worker 2 files/4 tests passed。
- 范围/历史：added-line reset/down/外部 API/AI/LLM、route inventory、Git diff/check、AGENTS/README/活动正式文档真实性与封存路径核查通过。`migrations.ts`、`types.ts`、`schema-profile.ts` 和 P-001 result 指纹不变。
- 数据/环境收尾：最终 schema `ready`、profile version 2、8 migrations/latest 0008、74 templates、0 invalid owners、0 non-revoked leases、0 pending outbox。PostgreSQL fast-stop 后 55438 无响应；精确 P-002 PostgreSQL/Node probe/test log 已删除，两个已弃用 task `curl` 下载进程已停止，0 临时残留。
- 关键 after-state SHA-256：`app.ts` `7708f6dd...c7a7f`、M1 API integration `c26b7e99...af18`、Authorization routes `23141df9...89b`、Projects/Membership routes `d9d66f8b...356b`、Roles routes `dc09a5df...385c`。immutable P-002 result 指纹为 `b2662ce5...ae5c`。

### 3.9 P-003 rolling planning 与 T-001 前置基线

- eligibility：requirements/roadmap 指纹保持 `f3ab380a...020d8`/`94c85511...5de22`；P-001/P-002 result 指纹保持 `eb06f279...c255f`/`b2662ce5...ae5c`，均为 immutable completed/passed。没有 `change-0.md`、冻结初始历史、活动变更运行或其他活动阶段。
- 规划结果：新增 [`phase-003-plan.md`](phase-003-plan.md) revision 1，`expanded`、`relaxed`、三个顺序任务，指纹为 `sha256:e818fc35eb1fc8f6ce77cd331089e3b9f52332e0b0c491e14c511d176b02063a`；roadmap revision 1 和 requirements 不变。
- Web 现状：`apps/web` 使用 React 19、TanStack Query 5、Vite 7；生产入口只有 `App.tsx` Workspace Access、`main.tsx` QueryClient 和 `styles.css`，另保留 `?prototype=task-ui`。现有流程覆盖注册/登录/登出、Pairing 查询/审批和 Device 撤销；尚无 M1 通用 API/query 层、Profile/Project/Membership/Role/Admin Mode 页面或 DOM 交互测试。
- P-002 公共依赖：23 个 M1 path、共享 DTO、稳定错误、资源版本/`actions`、Admin Mode header、user/project audience SSE 已完成。P-003 默认不修改 Contracts/API/Database；缺失 core 接口时停止并追加 corrective phase。
- 文档现状：`docs/01` 的 ROL-004/MEM-006、`docs/02` 的多字段 LogicalRole/移除置空事务、`docs/03`/`04`/`07` 的移除置空结论和 `docs/08` 的旧决策状态仍待 FR-047 同步；六份活动正式文档、README 和 `apps/web` 无用户重叠。M0/其他封存证据保持只读。
- 环境：当前分支/HEAD 仍为 `requirements/m1-project-role-members`/`f9efee992394f1b6761182237cf736f79561ad5b`；未发现 Docker 命令，P-002 PostgreSQL/临时环境已删除。T-001 开始时必须创建新的显式 PostgreSQL 17 测试目标并记录实际 Web/正式文档 before-state。
- T-001 完成条件：Web same-origin API/query/model、错误恢复、幂等意图与 SSE refetch 基础完成；现有认证/Pairing/Device/Task UI prototype 兼容；Profile、模板、Project list/create/open 和精确 Key join 的中文键盘流程与 V-010 通过。T-001 前不得开始治理闭环或活动正式文档修订。

### 3.10 P-003-T-001 实施前检查点

- 恢复核对：分支 `requirements/m1-project-role-members`、HEAD `f9efee992394f1b6761182237cf736f79561ad5b`；requirements/roadmap/P-001 result/P-002 result/P-003 plan SHA-256 分别为 `f3ab380a...020d8`、`94c85511...5de22`、`eb06f279...c255f`、`b2662ce5...ae5c`、`e818fc35...063a`，与 state/plan 全部一致。
- 工作区所有权：当前 tracked/untracked diff 仅含 P-001/P-002 已记录成果、用户已有 M1 requirements/workflow contract 与 rolling-planning 证据；`apps/web`、README、`docs/01`、`02`、`03`、`04`、`07`、`08` 均无 diff，因此没有用户重叠。P-002 Contracts/API/Database 与 immutable result 继续保持只读。
- Web before-state：`App.tsx` `ee3e3b2f...cb734`、`main.tsx` `692902dc...a1672b`、`styles.css` `3d484775...37a549`、`apps/web/package.json` `39df9c50...c8bae4`。现有 `?prototype=task-ui`、注册/登录/登出、Pairing 和 Device 流程必须在抽取 API/query/model 后保持。
- 活动正式文档 before-state：README `5f8f9a39...13b22a`；`docs/01` `cf962df6...adf3e`、`02` `8dbd58ff...313ec0`、`03` `e7587990...82c28`、`04` `4c14a99e...120538`、`07` `8d0de054...c50d0`、`08` `2bd52494...1b463e6`。这些文件仅由后续 T-003 修改。
- 工具链事实：shell 当前解析到 Node `20.13.1`，不符合 `.node-version` 的 `24.18.0`；pnpm 为 `11.9.0`。实现可安全继续，但 V-010/V-011/V-013 必须使用经官方校验的 Node 24.18.0，不能把 Node 20 的结果计为有效门禁。
- 隔离数据库目标：为 P-003 预留 `127.0.0.1:55439/ngapd_p003` 和 `C:\tmp\ngapd-m1-p003-postgres-17.10`；开始时目标不存在，不复用已删除的 P-002 环境，不运行 reset/down。T-001 的纯 Web V-010 不依赖数据库；T-002/V-011 前必须显式创建并核验 PostgreSQL 17.10。
- 预期 T-001 文件：修改 `apps/web/src/App.tsx`、`main.tsx`、`styles.css`；新增 `apps/web/src/api.ts`、`apps/web/src/m1/model.ts`、query/SSE/shell/Profile/Project/Join 组件与目标测试；仅在 DOM 交互证据确有需要时修改 `apps/web/package.json`/`pnpm-lock.yaml`。
- 精确完成条件：same-origin 错误/API 层、稳定 query keys、一次意图幂等键、SSE refetch、认证后 M1 shell、Profile/模板/Project/精确 Key join 与原有设备/prototype 流程完成；V-010 的目标 test/typecheck/build 在 Node 24 下通过，实际文件和结果写入后检查点后才允许进入 T-002。

### 3.11 P-003-T-001 后检查点

- 实际实现：`App.tsx` 保留精确 `?prototype=task-ui` 分支并切换到新的 M1 shell；新增集中 same-origin `apiRequest`/`ApiRequestError`，只对显式受保护请求注入 Admin Mode header，不记录 Cookie、密码、能力 ID 或正文。
- 查询与恢复：新增按 user/project 稳定分区的 TanStack query keys、一次明确意图一个 UUID 的幂等键、`resource-invalidated` SSE 到最小 query refetch 映射，以及包含 `recovery/currentVersion/blockingTasks/requestId` 的可聚焦错误提示。网络失败保留当前幂等键和表单，成功后才生成新意图键。
- Web 闭环：新增中文认证后 shell、可访问 Unicode 首字素头像、个人资料/默认模板、Project 列表/创建/打开、精确 Key 最小目标与加入申请，以及迁移后的 Pairing/Device 页面；表单均有显式 label、错误关联和键盘可达控件。
- 兼容：注册/登录/登出继续使用原 `/api/v1/auth/*` 与同源 Cookie；Pairing/Device 路由和形状未改；Task UI prototype 入口由 `isTaskUiPrototype` 目标测试固定。`apps/web/package.json` 与 `pnpm-lock.yaml` SHA-256 保持 `39df9c50...c8bae4`、`f1516af6...d973`，没有新增依赖、状态管理、路由或权限框架。
- T-001 after-state：`App.tsx` `2595530a...663b`、`api.ts` `3b94c30a...4ca0`、`styles.css` `4d447b79...895b`、`M1App.tsx` `6fb2fe27...b85b`、`ProfilePanel.tsx` `af5a7c6c...2f96`、`ProjectsPanel.tsx` `0ba2ede3...a3b0`、`AccessPanel.tsx` `b1dfe6f8...743c`。
- V-010：Node 24.18.0（`node.exe` SHA-256 `9a4eb5f1...52de`）、pnpm 11.9.0，Web 4 files/14 tests passed，typecheck passed，Vite production build passed（90 modules，JS 278.84 kB/CSS 18.70 kB，gzip 87.39/4.98 kB）。目标 ESLint 与 Prettier 通过。
- 无效诊断：首次 shell 命令虽由 Node 24 启动 pnpm，但子进程 PATH 仍解析 Node 20.13.1，Vite 明确告警；该轮不计门禁。把 Node 24 目录前置 PATH，并以 `pnpm exec node --version` 确认 24.18.0 后原样完整重跑，得到上述有效证据。
- 环境处置：初次冗余 Node 下载因三个超时 `curl` 写入者导致 Range 文件超过官方约 37 MB 索引大小，停止全部任务 writers 并只删除精确 `C:\tmp\ngapd-merge-verify-node-24.18.0`；未执行无效字节。复用的 24.18.0 runtime 已有仓库 durable SHA-256 证据。
- 范围结论：没有修改 P-002 Contracts/API/Database、活动正式设计文档、README、Web package/lock 或封存结果；无开放 finding/阻塞。T-001 完成且 V-010 passed，允许进入 T-002。

### 3.12 P-003-T-002 实施前检查点

- Git/所有权继续沿用 3.10；当前新增 Web diff 全部属于已完成的 T-001，P-001/P-002 未提交成果与用户 requirements/workflow input 均保留。T-002 不修改 P-002 Contracts/OpenAPI/API/Database 或任何 immutable result。
- 可用接口已重新读取：Project detail 提供当前 Membership/actions/Admin Mode；成员、申请、移除 preview、Transfer、Admin Mode、系统模板与 Project Role 的 P-002 公共路由/DTO 足以完成 core 流程，无需 corrective phase。
- T-002 起点是 3.11 的 Web after-state；预期新增项目治理容器、成员/申请、Owner Transfer、Admin Mode、Role 与共享危险确认组件及目标纯函数测试，修改 `M1App.tsx`/`ProjectsPanel.tsx`/`styles.css` 进行导航与响应式集成。任何额外文件必须是 V-011 的直接依赖。
- 权限/能力边界：UI 只以服务端 `actions` 控制呈现；所有 mutation 仍由服务端会话/Project/Membership/Admin Mode/版本授权。Admin Mode ID 只保存在当前 React 内存、按当前项目传给受保护写入，登出/项目变化/归档/服务端拒绝立即清除。
- 数据/恢复边界：每个版本化写使用最新 response/query 版本；网络结果不确定时同一 intent 保留幂等键；403/409/410 后只 refetch 权威资源并展示恢复建议，不自动改为另一动作或生成新 intent。
- 验证环境：V-011 预留 PostgreSQL 17.10 `127.0.0.1:55439/ngapd_p003` 和真实 API/Web 多身份浏览器流程；当前目标尚未创建。开始浏览器验收前必须核验显式 DB、Node 24.18.0、API/Web 进程与临时路径。
- 精确完成条件：申请处理、成员自助/他人资料、Admin 任免、移除 preview/阻塞/成功、Transfer 全动作、Admin Mode 开关/过期/失效、Role create/edit/copy/archive、项目归档/解除归档和 SSE/refetch 全部通过服务端 actions/版本接入；危险动作展示目标、状态和后果，键盘/焦点/label/error/非颜色状态通过 V-011，后检查点写入后才允许 T-003。

### 3.13 P-003-T-002 后检查点

- 实际实现：新增 `ProjectGovernance`、`JoinRequestsPanel`、`MembersPanel`、`OwnershipPanel`、`AdminModePanel`、`RolesPanel` 与共享 `DangerousAction`；项目页按概览治理、成员申请和角色目录分区。UI 只消费服务端 `actions` 和当前版本，Owner 身份与 `permissionLevel` 分开显示，不从角色名称、Membership ID 或本地标志扩权。
- 治理闭环：真实公共 API 已完成申请批准/拒绝/再次申请、成员自助介绍/角色绑定、Owner/Admin 编辑他人、Admin 任免、移除成功与未完成 Task Owner 阻塞、Transfer 发起/取消/拒绝/接受、项目归档/解除归档、Admin Mode 开启/关闭/过期/资格撤销、项目角色创建/编辑/复制/归档与归档角色禁止新绑定。
- 能力与实时性：Admin Mode 仅保存在当前 React 运行内存并按项目传入受保护写入；受保护操作成功后刷新项目/成员/角色，普通读取不续期。Worker 消费 user/project audience Outbox 后，浏览器 SSE 在另一会话撤销 Admin 资格时立即把当前身份降为 Member、清除管理员模式和他人编辑入口。
- 恢复与确认：共享确认对话框完整显示目标、当前状态、后果和适用 preview；打开时焦点落在标题，取消后恢复到触发器。隔离数据库注入陈旧 Project 版本后，解除归档得到稳定版本冲突、显示服务器当前版本 6 与恢复建议并 refetch；同一表单可按最新版本成功完成。
- V-011 环境：经 SHA-512 核对的 Zonky PostgreSQL 17.10 Windows x64 隔离实例 `127.0.0.1:55439/ngapd_p003`，正式迁移 `0001`–`0008` 首次及重复运行通过；Node 24.18.0 API、Web、Worker 同时运行，API/Worker 健康且数据库 ready。浏览器身份为 Owner、Admin、Member、Applicant，所有数据仅存在于该隔离库。
- 可访问性/兼容：危险动作有语义 `alertdialog`、明确 heading/definition/list/button；状态包含中文文本而非只靠颜色；桌面视觉检查无异常，390×844 窄屏的 document/body `scrollWidth` 均等于 `clientWidth`，键盘焦点、表单 label/error 和 Unicode 首字素替代文本通过。`?prototype=task-ui` 真实浏览器入口仍展示既有原型；控制台无 error/warning。
- V-011 最终有效结果：pass。Web 4 files/16 tests、typecheck、目标 ESLint 与 97-module production build 通过；真实浏览器覆盖 V-011 全部治理矩阵、SSE、稳定错误、焦点与非颜色状态。`styles.css` after-state 为 `2c7e99dc...4723d`，治理组件 after-state 分别为 `ProjectGovernance` `4d316cbb...60bf`、`AdminModePanel` `e11ae3f8...93a8`、`JoinRequestsPanel` `5f5604a2...13e5`、`MembersPanel` `8037488b...6785`、`OwnershipPanel` `52ab8d7f...83a4`、`RolesPanel` `fd55b280...abaa`、`DangerousAction` `0920c523...a71f`。
- 补充诊断：一次真实 CLI Pairing 手工回归因后台启动器保留日志句柄而等待本地十分钟超时，第二次尝试由用户中断；精确识别并停止 01:46 启动的两个 CLI Node 进程，删除全部仓库临时启动器/日志目录，未生成设备凭据或生产 diff。该补充尝试不属于 V-011，Pairing/Device 兼容仍由 V-010 目标回归和已通过的 P-002 V-008 公共 API/真实 Windows CLI 门禁证明，不登记产品 finding。
- 范围结论：未修改 P-002 Contracts/OpenAPI/API/Database、活动正式设计文档、README、Web package/lock 或 immutable result；无开放 finding/阻塞。T-002 completed 且 V-011 passed，允许进入 T-003。

### 3.14 P-003-T-003 实施前检查点

- 恢复核对：requirements/roadmap/P-001/P-002 result/P-003 plan 指纹继续为 `f3ab380a...020d8`、`94c85511...5de22`、`eb06f279...c255f`、`b2662ce5...ae5c`、`e818fc35...063a`；T-001/T-002 后检查点和 V-010/V-011 均已写入。当前没有 `change-0.md`、`effective-requirements.md` 或 P-003 result。
- 文档所有权：T-003 开始前六份活动正式文档和 README 仍与 3.10 before-state 一致、无用户重叠；只允许按 FR-047 更新当前活动结论，不改写 P-001/P-002 result、M0 或其他封存 execution/result/change 证据。
- 精确文档目标：消除 ROL-004 的多字段角色模型和 MEM-006 的“移除清空未完成 Task Owner”旧结论；同步正式 `0008`/profile version 2、M1 `/api/v1`/Web/审计/Outbox/SSE、Owner/Admin/Member 与 Admin Mode、M1 completed 里程碑及取代决策关系。README 仅在产品边界、命令或阶段声明失真时修改。
- 最终验证环境：继续使用显式 Node 24.18.0、pnpm 11.9.0 与 PostgreSQL 17.10；为根测试创建独立于浏览器验收数据的测试数据库。当前主机没有 Docker 命令或参考服务器，因此 V-014/V-015 预期按合同记录 `not_run`，不能冒充 passed；V-016 以已有真实并发/规模测试外加一次有界诊断收口。
- 精确完成条件：V-012 文档一致性、V-013 根 `pnpm check`/安全/所有权、V-016 有界诊断全部通过；V-014/V-015 适用性如实记录；没有 blocking 或未知影响。只有随后生成 immutable `phase-003-result.md` 并复核完整运行历史后，才能创建 `effective-requirements.md`、`change-0.md` 和最终 completed/passed 状态。

### 3.15 P-003-T-003 后检查点与 initial finalization

- FR-047 文档结果：`docs/01`–`04`、`07`、`08` 已统一到 profile version 2/`0008-m1-project-role-members`、完整 M1 `/api/v1`/Web/audit/Outbox/SSE、成员移除保留 Task Owner 且未完成有效 Owner 阻塞，以及名称 + 单一能力/Agent 提示的角色模型。README 经核查无需修改，M0/其他 feature 和 P-001/P-002 immutable evidence 无 diff。
- V-012：目标 Prettier、stale-term 搜索、README/AGENTS/活动正式文档、其他封存 feature diff 和 `git diff --check` 通过；只有既有 CRLF→LF 提示，无补丁错误。
- V-013 环境：Node 24.18.0、pnpm 11.9.0、PostgreSQL 17.10；独立根门禁数据库 `ngapd_p003_check` 首次迁移 0001–0008、重复 no-op，最终 profile version 2、8 migrations、latest 0008、74 templates。
- V-013 最终根门禁：已授权 Windows `C:\tmp`/PasswordVault 上从头 `pnpm check` 完成；format/lint、全部 packages/apps build、10 workspace typecheck、273 tests passed、0 failed，7 platform-conditional skipped。API 9 files/27 tests、真实双 CLI 两轮 108.11 秒，small sync 1507.19/1514.46ms；Web 4/16、Worker 2/4。
- V-013 安全/范围：OpenAPI/M1 integration、same-origin、稳定错误、added-line 外部 API/AI/LLM、secret persistence/log、production reset/down、transient、Git/指纹/进程检查全部通过；Web 唯一外部 URL 是 same-origin 拒绝测试中的 `https://example.com`，没有生产外连。
- V-014：`not_run`；当前主机没有 Docker/Compose 或 Podman。V-015：`not_run`；当前没有参考服务器、正常内网或 VPN 目标。两项均按合同如实记录，未冒充 passed。
- V-016：额外执行 PostgreSQL `project-membership-repository.integration.test.ts`，1 file/6 tests、986ms；真实行锁、幂等并发、成员移除/Task Owner、归档/lease 和治理完整性未发现 core 之外的新异常。
- 测试夹具偏差：`m1.integration.test.ts` 的 Outbox dispatch cutoff 改为远未来，避免跨日后旧固定 `now` 早于 PostgreSQL 当前 `available_at` 而错误排除既有事件；只改测试证据，不改生产后端或产品语义。
- 无效尝试：一次 `ci:verify` 缺少 `DATABASE_TEST_URL`、sandbox 根运行的 `C:\tmp`/PasswordVault `EPERM`、一次工具输出通道超时/EPIPE、一次误触发全 API 套件的 sandbox `EPERM` 和手工 Pairing 后台句柄等待均不计通过/失败结论；对应进程与临时 harness 已精确清理。
- 环境收尾：浏览器 session、API/Web/Worker 已关闭；PostgreSQL fork 竞态子进程按精确可执行路径停止，55439 无 listener；P-003 PostgreSQL、根门禁日志和固定 Workspace test 临时目录已删除，0 P-003 进程/路径残留。
- 最终工件：[`phase-003-result.md`](phase-003-result.md) completed/passed，SHA-256 `774fc276b9501a24ec1b3d77ec1e8d211e24a6b294efe71096dd6508135bb7dd`；完整历史复核后生成 [`effective-requirements.md`](../../effective-requirements.md) `191f54a0...c7707` 与 [`change-0.md`](../../change-0.md) `e9e38882...fb0b`。无开放 finding，initial run completed/passed。

## 4. 已完成任务

| 任务 | 完成时间 | 实际结果 | 验收/验证 |
| --- | --- | --- | --- |
| P-001-T-001 | 2026-07-28T17:03:01+08:00 | 共享 M1 runtime Schema、稳定错误、纯领域状态/授权与 Membership 生命周期锁契约完成；现有领域 Membership 权威改为 `status/permissionLevel` | V-001 passed：contracts 2 files/11 tests，domain 16 files/68 tests；两包 typecheck passed |
| P-001-T-002 | 2026-07-28T17:53:51+08:00 | 0008 前向迁移、profile version 2、Kysely 类型、生产模板、既有 Foundation/Task/Workspace/Outbox 权威适配与故障/保留测试完成 | V-002/V-003 passed：PostgreSQL 17.10，database 8 files/41 tests；database/test-fixtures typecheck，test-fixtures 6 files/40 tests，domain build/JSON 打包通过 |
| P-001-T-003 | 2026-07-28T18:22:52+08:00 | 兼容、正确工具链、根工程、安全范围、文档真实性、不可变结果和环境收尾完成 | V-004/V-005 passed：API 7 files/21 tests；根 `pnpm check` format/lint/build/typecheck 与 249 tests passed，0 failed；阶段结果已封存 |
| P-002-T-001 | 2026-07-28T22:19:59+08:00 | M1 正式 Repository、跨模块治理事务、固定锁序、幂等/版本、Admin Mode/Lease 失效、成功 audit/Outbox 与故障回滚完成；未开放公共路由 | V-006 passed：Node 24.18.0、pnpm 11.9.0、PostgreSQL 17.10；database typecheck，9 files/47 tests，ESLint/Prettier/diff check |
| P-002-T-002 | 2026-07-28T22:40:59+08:00 | Profile/Project/Membership/Role/Admin Mode application service、服务端授权/租户解析、资源 actions、稳定错误与失败 audit 完成；`app.ts` 未变且公共路由仍未开放 | V-007 passed：contracts 2 files/12 tests，application service 1 file/3 tests；contracts/database/API typecheck，PostgreSQL 17.10，ESLint/Prettier/diff check |
| P-002-T-003 | 2026-07-28T23:05:00+08:00 | 完整 M1 `/api/v1`、OpenAPI 3.1、Cookie/Origin/unknown-field、最小披露、稳定错误、Outbox→投影→SSE 与既有入口兼容完成；阶段结果已封存 | V-008/V-009 passed：API 9 files/27 tests；根 format/lint/build/10 workspace typecheck，262 tests passed、0 failed，7 skipped |
| P-003-T-001 | 2026-07-29T00:14:39+08:00 | Web same-origin API/query/model/SSE 基础、认证后中文 shell、Profile/模板/Project/精确 Key join 与 Pairing/Device/prototype 兼容完成 | V-010 passed：Node 24.18.0；Web 4 files/14 tests，typecheck 与 production build passed；ESLint/Prettier passed |
| P-003-T-002 | 2026-07-29T01:57:04+08:00 | 真实公共 API 的项目生命周期、申请/成员、Admin 任免、移除预览、Owner Transfer、Admin Mode、角色目录、SSE 与危险确认中文可访问闭环完成 | V-011 passed：PostgreSQL 17.10、Node 24 API/Web/Worker、Owner/Admin/Member/Applicant 多身份浏览器；Web 4 files/16 tests、typecheck、ESLint、97-module build |
| P-003-T-003 | 2026-07-29T02:34:30+08:00 | FR-047 六份活动正式文档、最终 migration/根工程/安全/范围/附加并发、环境适用性和 initial freezing 完成 | V-012/V-013/V-016 passed；V-014/V-015 `not_run`；根 273 tests passed、0 failed、7 skipped；P-003 result/change-0/effective snapshot 已生成 |

## 5. 运行累计文件变化

| 文件 | 修改模式 | 归属与当前结果 |
| --- | --- | --- |
| `docs/requirements/m1-project-role-members/implementation-plan.md` | add | 本次规划生成的 initial roadmap revision 1 |
| `docs/requirements/m1-project-role-members/execution/initial/phase-001-plan.md` | add | 本次规划生成的 P-001 plan revision 1 |
| `docs/requirements/m1-project-role-members/execution/initial/phase-002-plan.md` | add | rolling planning 生成的 P-002 expanded plan revision 1；当前唯一 ready 阶段 |
| `docs/requirements/m1-project-role-members/execution/initial/execution-state.md` | add | 本次规划初始化的 ready 协调状态 |
| `packages/contracts/src/identity.ts`、`projects.ts`、`errors.ts`、`index.ts` | modify | 新增 M1 个人资料、Project 资源/命令、稳定错误与导出；保持既有 SessionActor/Project Schema |
| `packages/contracts/src/admin-mode.ts`、`memberships.ts`、`ownership-transfers.ts`、`roles.ts` | add | M1 资源、状态、动作与写命令 runtime Schema |
| `packages/contracts/src/m1-contracts.test.ts` | add | M1 输入边界、最小披露、单一 Membership 权威、角色形状和状态契约 |
| `packages/domain/src/authorization.ts`、`task-owner.ts`、`index.ts` 及既有目标测试 | modify | 现有授权/Owner 解析消费 `status/permissionLevel`，同步导出和回归 |
| `packages/domain/src/admin-mode.ts`、`logical-role.ts`、`membership.ts`、`ownership-transfer.ts`、`project-governance.ts` 及目标测试 | add | M1 状态机、权限矩阵、Owner、角色不授权、移除阻塞和共享生命周期锁规则 |
| `packages/domain/src/system-logical-role-templates.json`、`system-logical-role-templates.ts`、`tsconfig.json` | add/modify | 74 个生产模板、启动期结构/唯一性校验与构建打包 |
| `packages/database/src/migrations.ts`、`types.ts`、`schema-profile.ts` 及 profile/M1 migration 测试 | modify/add | 正式 0008、version 1 behind/version 2 ready、M1 表/列/约束/回填/模板快照、失败回滚和重复迁移 |
| `packages/database/src/foundation-repository.ts`、`task-repository.ts`、`task-lifecycle-repository.ts`、`workspace-repository.ts`、`outbox-repository.ts` 及受影响测试 | modify | 现有生产路径迁移到 Membership 新权威，写锁补齐，Outbox/资源失效支持精确 user/project 受众 |
| `packages/contracts/src/events.ts`、`apps/api/src/modules/events/*`、`apps/api/src/modules/tasks/service.ts` 与受影响 API integration tests | modify | 保持现有 API/内部 Task/SSE 消费者与新受众、Membership 权威兼容；未增加 M1 公共路由 |
| `packages/test-fixtures/src/workspace-authorization.ts`、`repository-fixtures.test.ts` | modify | 新 Membership 字段和生产模板/docs parity |
| `apps/worker/src/outbox-task.integration.test.ts` | modify | Worker Outbox fixture 适配 project 受众字段 |
| `AGENTS.md` | modify | M1 索引及活动状态保持为 P-001 completed/passed、P-002 ready；生产实现尚未开始 |
| `docs/requirements/m1-project-role-members/execution/initial/phase-001-result.md` | add | immutable P-001 completed/passed 结果 |
| `packages/database/src/m1-repository-support.ts`、`project-membership-repository.ts`、`project-role-repository.ts`、`project-membership-repository.integration.test.ts` | add | P-002-T-001 的幂等/审计/Outbox/失效共享事务与全部 M1 治理 Repository、真实数据库并发/故障门禁 |
| `packages/database/src/identity-repository.ts`、`foundation-repository.ts`、`task-repository.ts`、`task-lifecycle-repository.ts`、`workspace-repository.ts`、`index.ts` | modify | P-002-T-001 的 Profile 版本写入、Project/Membership/Task Owner/Workspace 全局锁序、归档失效与正式导出；不修改 Schema |
| `packages/contracts/src/projects.ts`、`memberships.ts`、`ownership-transfers.ts`、`admin-mode.ts`、`roles.ts`、`errors.ts`、`m1-contracts.test.ts` | modify | P-002-T-002 的 M1 params、collection/detail/mutation response、稳定错误和 runtime 边界验证 |
| `apps/api/src/application-errors.ts`、`modules/identity/service.ts` | modify | P-002-T-002 的稳定 M1 错误映射、Profile 应用服务和异常后失败审计 |
| `apps/api/src/modules/authorization-audit/`、`projects-membership/`、`roles/` | add | P-002-T-002 的服务端授权/租户解析、Admin Mode、Project/Membership/Role 用例、actions 映射与真实 PostgreSQL 目标测试；尚无 routes |
| `apps/api/src/modules/identity/routes.ts`、`modules/authorization-audit/routes.ts`、`modules/projects-membership/routes.ts`、`modules/roles/routes.ts`、对应 `index.ts` | modify/add | P-002-T-003 的完整 Profile/Project/Membership/Transfer/Admin Mode/Role 公共路由、Same-Origin、会话、参数与响应边界 |
| `apps/api/src/app.ts`、`apps/api/src/m1.integration.test.ts` | modify/add | 一次性 M1 路由注册、未知字段拒绝、blocking task 错误、OpenAPI/安全/审计/Outbox/SSE/兼容全闭环 |
| `docs/requirements/m1-project-role-members/execution/initial/phase-002-result.md` | add | immutable P-002 completed/passed 阶段结果 |
| `docs/requirements/m1-project-role-members/execution/initial/phase-003-plan.md` | add | rolling planning 生成的 P-003 expanded plan revision 1；当前阶段执行权威 |
| `apps/web/src/App.tsx`、`styles.css` | modify | T-001 的 M1 Web 入口、响应式中文 shell、可见焦点与非颜色状态；保留 Task UI prototype |
| `apps/web/src/api.ts`、`api.test.ts`、`App.test.ts` | add | T-001 的同源 API/稳定错误/Admin header 边界与入口兼容测试 |
| `apps/web/src/m1/` | add | T-001 的 query/model/SSE、认证、Profile、Project/Join、Pairing/Device 与可访问错误组件；T-002 在同目录继续项目治理 |
| `apps/web/src/m1/ProjectGovernance.tsx`、`AdminModePanel.tsx`、`JoinRequestsPanel.tsx`、`MembersPanel.tsx`、`OwnershipPanel.tsx`、`RolesPanel.tsx`、`DangerousAction.tsx` | add | T-002 的项目治理、申请/成员、Transfer、Admin Mode、角色目录、危险确认、稳定恢复与可访问性闭环 |
| `docs/01-product-requirements.md`、`02-domain-model.md`、`03-permission-model.md`、`04-system-architecture.md`、`07-roadmap-and-validation.md`、`08-decisions-and-open-issues.md` | modify | T-003 的 FR-047 正式产品/领域/权限/架构/路线/决策同步 |
| `apps/api/src/m1.integration.test.ts` | test-only adjust | T-003 最终门禁的跨日稳定 Outbox projection cutoff；不改变生产后端 |
| `docs/requirements/m1-project-role-members/execution/initial/phase-003-result.md` | add | immutable P-003 completed/passed 阶段结果 |
| `docs/requirements/m1-project-role-members/effective-requirements.md`、`change-0.md` | add | initial run 当前有效需求快照与首次实现冻结记录 |

`workflow-contract.md` 与 `requirements.md` 为规划前用户已有未跟踪输入，不计入上述运行产出，也未被本次规划修改。

## 6. 测试与验证证据

| 时间 | 范围 | 方法 | 结果 |
| --- | --- | --- | --- |
| 2026-07-28 | 需求/合同结构 | 完整读取 schema 3.2 合同与 requirements；核对 FR-001–FR-047、AC-001–AC-029、策略、层级、决策和未决问题 | pass；`relaxed` 为用户明确选择，27 个 core、2 个 supplemental，无未决问题 |
| 2026-07-28 | 项目与历史事实 | 核对分支/HEAD、工作区、M0 change-0/change-1/change-2、正式文档与关键代码/迁移/API/Web 入口 | pass；基线与需求一致，正式 `0001`—`0007` 和当前模块事实支持路线图 |
| 2026-07-28 | 指纹 | SHA-256 requirements、implementation plan、P-001 plan | pass；与本状态 metadata 一致 |
| 2026-07-28 | V-001 contracts | `pnpm --filter @ngapd/contracts typecheck`；`pnpm --filter @ngapd/contracts test` | pass；typecheck 无错误，2 个测试文件/11 项测试通过 |
| 2026-07-28 | V-001 domain | `pnpm --filter @ngapd/domain typecheck`；`pnpm --filter @ngapd/domain test` | pass；typecheck 无错误，16 个测试文件/68 项测试通过 |
| 2026-07-28 | V-002/V-003 PostgreSQL 首次尝试 | PostgreSQL 17.10 隔离实例；`DATABASE_TEST_URL=postgresql://postgres@127.0.0.1:55437/ngapd_p001 pnpm --filter @ngapd/database test` | fail/blocking；`pg` 错误 `42601 cannot insert multiple commands into a prepared statement`，定位到 `migrations.ts:1367` 的角色快照/约束收尾批次与 `m1-migration.integration.test.ts:53` 的代表性 v1 seed；7 files failed、1 passed，2 tests failed、4 passed、35 skipped；不得计为门禁通过 |
| 2026-07-28 | V-002/V-003 PostgreSQL 修正后完整运行 | 同一 PostgreSQL 17.10 目标；`pnpm --filter @ngapd/database typecheck`；`DATABASE_TEST_URL=... pnpm --filter @ngapd/database test` | pass；typecheck 无错误，8 个测试文件/41 项测试全部通过；覆盖空库、正式 0007 升级、重复迁移、未知历史 fail-closed、故障回滚、保留数据、Repository/并发回归 |
| 2026-07-28 | T-002 模板/fixture | `pnpm --filter @ngapd/test-fixtures typecheck`；`pnpm --filter @ngapd/test-fixtures test`；`pnpm --filter @ngapd/domain build`；dist JSON 检查 | pass；6 个测试文件/40 项测试；74 模板 parity 通过，生产 JSON 存在于构建产物 |
| 2026-07-28 | V-004 API 首次尝试 | `pnpm --filter @ngapd/api typecheck`；PostgreSQL 17.10 目标下 `pnpm --filter @ngapd/api test` | fail/blocking；typecheck 通过，但 API 消费 workspace 包 `dist` 中修正前的旧 0008，多语句 prepared-statement 错误导致 5 files failed、2 passed，6 tests failed、4 passed、11 skipped；必须重建依赖包并完整重跑，不计为 V-004 通过 |
| 2026-07-28 | V-004 API 重建后环境诊断 | 重建 contracts/domain/database/test-fixtures 后重跑；临时启用 Fastify logger 定位注册 500，随后移除诊断改动 | fail/blocking；旧 0008 已消失、14 tests 通过；注册失败根因是 shell `node v20.13.1` 不符合 `.node-version` `24.18.0`，`hash-wasm` 的 `argon2` 在错误运行时下不是函数；另有 sandbox 内固定 `C:\tmp` mkdir `EPERM`，需用正确 Node 24 并在已授权测试上下文重跑 |
| 2026-07-28 | V-004 正确工具链完整重跑 | Node 24.18.0（官方 SHA-256 校验通过）、pnpm 11.9.0；重建 contracts/domain/database/test-fixtures；PostgreSQL 17.10 与已授权 Windows `C:\tmp`/PasswordVault 上下文运行 `pnpm --filter @ngapd/api test` | pass；7 个测试文件/21 项测试全部通过；Identity/Pairing/Workspace/SSE/内部 Task 与两轮真实 Windows CLI/PasswordVault/NTFS 同步兼容，small sync 1452.64ms/1445.06ms |
| 2026-07-28 | V-005 根门禁首次尝试 | Node 24.18.0、pnpm 11.9.0；`pnpm check` | fail/blocking at `format:check`；Prettier 列出 14 个新增/修改文件，lint/build/typecheck/test 未运行；仅允许机械格式化列出的文件并从头完整重跑 |
| 2026-07-28 | V-005 根门禁第二次尝试 | 机械格式化 14 个文件后从头 `pnpm check` | fail/blocking at lint；format passed，唯一错误为 `logical-role.ts` 的未使用参数；保留“不授权”输入契约并以 `void input` 显式消费，必须从头重跑 |
| 2026-07-28 | V-005 根门禁第三次尝试 | 修正 lint 后从头 `pnpm check` | fail/blocking at Worker build；format/lint 与 packages/API/CLI build passed，`apps/worker/src/outbox-task.integration.test.ts` 两处旧 Outbox fixture 缺少 `audience_type/audience_id`；已补为 project 受众，必须从头重跑 |
| 2026-07-28 | V-005 根门禁第四次尝试 | 修正 Worker fixture 后在 sandbox 内从头 `pnpm check` | fail/blocking at Workspace CLI tests；format/lint/build/typecheck 全部通过；仅 `C:\tmp` mkdir/mkdtemp `EPERM` 与 PasswordVault 不可用，属运行上下文限制；必须在已授权上下文并设置真实 `DATABASE_TEST_URL` 从头重跑，不能将跳过或环境失败计为通过 |
| 2026-07-28 | V-005 最终有效根门禁 | Node 24.18.0、pnpm 11.9.0、PostgreSQL 17.10、已授权 Windows `C:\tmp`/PasswordVault；`DATABASE_TEST_URL=... pnpm check` | pass；format、lint、全部 packages/apps build、10 个 workspace typecheck、249 tests 通过，0 failed；7 个非 Windows 平台条件测试 skipped |
| 2026-07-28 | 路由/安全/历史 | 公共路由、added-line reset/外部调用、Git diff/status、指纹、封存路径和进程检查 | pass；无 M1 公共半路由、无新增隐式 reset/外部 API/AI/LLM、无 M0/其他封存记录改写、无活动 Node/pnpm 测试进程 |
| 2026-07-28 | 环境收尾 | 隔离库最终摘要、`pg_ctl -m fast stop`、55437 readiness、精确 temp 路径校验/删除 | pass；profile 2、8 migrations、74 templates、0 invalid owners、0 active leases；端口无响应，两个运行时目录和 Workspace test temp 无残留 |
| 2026-07-28 | P-002 rolling planning | 复核 schema 3.2 合同、映射的 FR-001–FR-046/AC-001–AC-022/AC-024–AC-027、P-001 immutable result、roadmap revision 1、当前源码/正式文档、Git diff 与关键 after-state SHA-256；生成 `phase-002-plan.md` | pass；需求/roadmap/P-001 证据无漂移，P-002 eligible；沿用 `phased + expanded`/`relaxed`，3 个顺序任务、V-006–V-009 core 门禁，无 unresolved 问题 |
| 2026-07-28 | V-006 首次真实 PostgreSQL 运行 | Node 24.18.0、pnpm 11.9.0、PostgreSQL 17.10；database typecheck/test，30 秒 statement timeout/15 秒 lock timeout | fail/blocking；41 passed/6 failed；NUL advisory key 被 PostgreSQL UTF-8 拒绝，另模板测试排序假设不成立；均在 T-001 范围修正，不计为通过 |
| 2026-07-28 | V-006 第二次运行 | 同一隔离目标完整 database test | fail/blocking；45 passed/2 failed；Admin Mode 的 user audience Outbox 携带 project scope，命中精确受众约束；修正共享成功写入，不计为通过 |
| 2026-07-28 | V-006 最终有效运行 | Node 24.18.0、pnpm 11.9.0、`127.0.0.1:55438/ngapd_p002` PostgreSQL 17.10；database typecheck/test；Prettier/ESLint/diff check | pass；9 files/47 tests；覆盖原子 Project/74 快照、首次/再次加入、角色/Admin Mode、归档/租约、Owner Transfer、移除/Task Owner 与幂等真实并发、故障完整回滚；0 failed |
| 2026-07-28 | V-007 首次跨包类型检查 | Contracts test/typecheck、database/API typecheck | fail/blocking；Contracts 2 files/12 tests passed，但 API 读取旧 contracts/database `dist` 声明，新增错误码、Repository 与 Profile 方法暂不可见；先重建两个依赖包再原样重跑，不计为通过 |
| 2026-07-28 | V-007 目标测试迭代 | PostgreSQL 17.10 application service integration test | fail/blocking 后关闭；初次发现测试对 Owner permission、归档 Role copy action 和不存在的 Role name unique constraint 假设错误；改用真实字段语义和长度约束故障路径，随后修正稳定 `FORBIDDEN`/PostgreSQL `22001` 断言，未修改生产授权或事务语义 |
| 2026-07-28 | V-007 最终有效运行 | Node 24.18.0、pnpm 11.9.0、PostgreSQL 17.10；Contracts test/typecheck、database/API typecheck、application service 目标 test、Prettier/ESLint/diff check | pass；Contracts 2 files/12 tests，application service 1 file/3 tests；Owner/Admin Mode/member/Role 不授权、actions、跨租户、失败 audit 与异常回滚全部通过；0 failed |
| 2026-07-28 | V-008 M1 API 首次目标运行 | PostgreSQL 17.10；M1 API integration 3 个端到端场景 | fail/blocking；完整闭环与 SSE 租户过滤 2/3 已通过，唯一失败是测试数据库核对误用 DTO `key` 列名；正式列为 `project_key`，仅修正证据查询后全文件重跑 |
| 2026-07-28 | V-008 最终有效 API 运行 | Node 24.18.0、pnpm 11.9.0、PostgreSQL 17.10、已授权 Windows `C:\tmp`/PasswordVault；API typecheck/test | pass；9 files/27 tests，完整 M1 routes/OpenAPI/unknown field/Cookie/Origin/最小披露/IDOR/audit/Outbox/SSE 与既有入口兼容；small sync 1448.33ms/1453.90ms |
| 2026-07-28 | V-009 根门禁首次尝试 | 同一工具链与环境；`pnpm check` | fail/blocking at format:check；只列出 `m1-repository-support.ts` 与 Repository integration test，lint/build/typecheck/test 未执行；机械格式化后必须从头重跑 |
| 2026-07-28 | V-009 最终有效根门禁 | Node 24.18.0、pnpm 11.9.0、PostgreSQL 17.10、已授权 Windows；从头 `pnpm check` | pass；format/lint、全部 packages/apps build、10 workspace typecheck；262 tests passed、0 failed、7 platform-conditional skipped；API 9/27、Worker 2/4，small sync 1511.58ms/1428.96ms |
| 2026-07-28 | P-002 路由/安全/历史/环境收尾 | OpenAPI/route inventory、added-line 风险搜索、Git/diff/指纹、数据库摘要、`pg_ctl -m fast stop`、55438 TCP、精确 temp/process 清理 | pass；无 Task CRUD/外部 API/AI/LLM/封存改写；profile 2/0008/74 templates/0 invalid owner/lease/pending outbox；端口关闭且 0 P-002 临时残留 |
| 2026-07-29 | V-010 首次工具链诊断 | Node 24 wrapper 启动 pnpm，但子进程 PATH 仍为 Node 20.13.1；Web test/typecheck/build | invalid/not counted；测试/类型/构建表面成功但 Vite 明确告警运行时不满足要求，必须前置 Node 24 PATH 后原样重跑 |
| 2026-07-29 | V-010 最终有效运行 | Node 24.18.0、pnpm 11.9.0；`@ngapd/web` test/typecheck/build；目标 ESLint/Prettier | pass；4 files/14 tests，typecheck、90-module production build、目标 lint/format 全部通过；package/lock 未变 |
| 2026-07-29 | V-011 真实多身份治理与可访问性 | PostgreSQL 17.10 `127.0.0.1:55439/ngapd_p003`；Node 24 API/Web/Worker；Owner/Admin/Member/Applicant 浏览器；SSE/版本冲突/响应式/控制台与 Web 静态门禁 | pass；申请/成员/Admin/移除/Transfer/Admin Mode/Role/归档全闭环，陈旧版本恢复与跨会话 SSE 权限撤销有效；390×844 无 document overflow，状态/确认/焦点不只靠颜色；Web 4 files/16 tests、typecheck、ESLint、97 modules build |
| 2026-07-29 | Pairing 补充手工诊断 | 隔离 CLI 后台等待尝试；精确进程/日志/临时路径核查 | invalid/not counted；后台日志句柄导致等待本地超时，后续尝试被中断；精确停止两个 CLI 进程并删除临时 harness，未生成设备凭据或生产 diff。Pairing/Device core 证据继续来自 V-010 与已通过的 P-002 V-008 |
| 2026-07-29 | V-012 文档一致性 | 六份活动正式文档 stale-term/实现对照、README/AGENTS、其他封存 feature diff、目标 Prettier、`git diff --check` | pass；MEM-006/ROL-004 旧结论已替换，M1 Schema/API/Web/audit/Outbox/SSE 与里程碑一致；封存 evidence 无 diff |
| 2026-07-29 | V-013 初始工具/迁移尝试 | Node 24/pnpm 11；`ci:verify`、独立 `ngapd_p003_check` 首次/重复迁移 | 首次 `ci:verify` 因未注入 `DATABASE_TEST_URL` invalid/not counted；显式注入后通过。迁移 0001–0008 首次及 no-op 重跑通过，profile 2、8 migrations、74 templates |
| 2026-07-29 | V-013 sandbox 根尝试 | `DATABASE_TEST_URL=<P-003 check> pnpm check` | invalid/not counted；format/lint/build/typecheck 与 Contracts/Domain/Core/Database/ObjectStore/fixtures 等已通过，仅 Workspace CLI 固定 `C:\tmp`/PasswordVault 遇到 sandbox `EPERM`，需已授权 Windows 上下文 |
| 2026-07-29 | V-013 已授权工具超时尝试 | 已授权 Windows 上下文完整 API/root 命令 | invalid/not counted；一次工具输出通道 183 秒超时并产生 EPIPE，一次 API 包命令 90 秒被调用边界截断；没有产品断言，精确子进程已退出 |
| 2026-07-29 | V-013 最终有效根门禁 | Node 24.18.0、pnpm 11.9.0、PostgreSQL 17.10、已授权 Windows `C:\tmp`/PasswordVault；从头 `pnpm check` | pass；format/lint、全部 packages/apps build、10 workspace typecheck；273 tests passed、0 failed、7 platform skips；API 9/27、Web 4/16、Worker 2/4；双 CLI 两轮 108.11 秒 |
| 2026-07-29 | V-013 安全/范围/Schema | OpenAPI/M1 integration、same-origin/稳定错误、外部 API/AI/LLM、secret/log、reset/down、transient、Git/指纹/进程、只读 profile 摘要 | pass；无生产外连/秘密持久化/破坏性入口/临时产物/封存改写；profile 2、latest 0008、74 templates |
| 2026-07-29 | V-014/V-015 环境适用性 | Docker/Podman 与参考服务器/内网/VPN 检查 | `not_run`；当前主机无容器运行时和参考目标，未冒充 Compose 或 P95 passed |
| 2026-07-29 | V-016 附加并发诊断 | PostgreSQL `project-membership-repository.integration.test.ts` | pass；1 file/6 tests、986ms；行锁、幂等、移除/Task Owner、归档/lease 和治理完整性无新异常 |
| 2026-07-29 | P-003 最终环境收尾 | 浏览器 finalize；API/Web/Worker 停止；PostgreSQL 精确进程/55439/任务临时目录核查和删除 | pass；0 listener、0 P-003 PostgreSQL 进程、0 P-003/固定 Workspace test 临时目录；清理竞态只涉及已验证的 task-owned 路径 |

P-001 的 V-001–V-005、P-002 的 V-006–V-009 和 P-003 的 V-010–V-013/V-016 均已通过；V-014/V-015 按合同因环境不可用记为 `not_run`。三阶段各有 immutable completed/passed result，initial run、`change-0.md` 和有效需求快照已完成。

## 7. 决策、待确认问题与回答

### 7.1 已确认决策

| 决策 | 结论 | 来源 |
| --- | --- | --- |
| 初始运行交付策略 | `relaxed` | requirements 决策记录，用户明确确认 |
| 权限矩阵、成员移除、完成冻结、被移除 Admin、角色模型 | 按 requirements 已批准结论执行 | requirements 决策记录，用户明确确认 |
| 路线图模式 | `phased + expanded` 三阶段 | schema 3.2 比例化规则 + 已观察到的前向迁移、公共兼容和多写入者风险 |
| 当前活动范围 | initial run 已 completed/passed；后续变化只允许 `$apply-feature-change` 创建连续 change run | workflow contract、三份 immutable result、`change-0.md` 与 effective snapshot |

### 7.2 待确认问题

无 unresolved 问题。

## 8. 发现项、偏差、风险与阻塞

- 开放 finding：无。
- 下一可用 finding ID：`FND-I-001`。
- 计划偏差：无产品/阶段/验收偏差；P-003 唯一后端文件变化是跨日稳定的测试 Outbox cutoff，不改变生产语义。无效长时/沙箱尝试均未计结论并已清理。
- 当前阻塞：无；P-001/P-002/P-003 与 initial run 均 completed/passed。
- 已关闭主要风险：正式 profile version 1 前向识别、Membership 单一权威迁移、迁移失败回滚、模板生产打包、Project 活动 Owner、现有 Identity/Workspace/Task/SSE/Worker 兼容、正确 Node/Windows 运行时和无半成品公共路由。
- P-002 风险关闭：Repository 锁序/原子性、application service 身份/租户解析、失败审计/actions、Origin/会话、unknown-field、OpenAPI、精确 Key/SSE、既有入口兼容和公共路由已由 V-006–V-009 关闭。
- P-003 风险关闭：服务端 actions/授权、Admin Mode 项目/会话边界、危险确认/键盘/焦点/非颜色状态、正式文档 MEM-006/ROL-004、最终根门禁和附加并发均已验证；Compose/P95 适用性如实 `not_run`。

任何 critical/high、安全、隐私、数据、兼容、构建/运行、未知影响、必需门禁或未独立证明的 core 异常都必须阻塞；不得作为 relaxed report-only finding。

## 9. 精确恢复步骤

1. 当前没有活动阶段或任务；从本 completed state、`change-0.md` 和 `effective-requirements.md` 恢复只读上下文。
2. P-001/P-002/P-003 result 与 initial `change-0.md` 均不可修改；后续需求/行为变化使用 `$apply-feature-change` 预留新的连续 change run。
3. 正式数据库仍只允许前向迁移/roll forward；不得以 reset/down、旧临时 55439 集群或本次浏览器数据作为后续恢复前提。
4. 若在具备 Docker/Compose 或参考服务器的环境补充运维/P95 证据，应进入适用的后续 change/发布流程，不改写本 initial result。
5. 下一 change run 必须从当前 requirements/effective snapshot、roadmap、三个 phase result、全部指纹、Git diff 和用户工作所有权重新审计。

## 10. 最终完成门禁

- [x] P-001/P-002/P-003 均有 immutable completed/passed phase result。
- [x] FR-001–FR-047 与 AC-001–AC-029 追踪完整。
- [x] 全部 core、Schema/迁移、权限、安全、隐私、数据、兼容、构建、恢复和适用发布门禁通过。
- [x] supplemental 结论已收口：AC-029 passed；AC-028 因无参考环境按合同 `not_run`；无开放 `FND-I-*`。
- [x] 活动正式文档、AGENTS.md 与 README（核查后无需修改）同最终实现一致，M0/其他封存证据未改写。
- [x] `change-0.md`、`effective-requirements.md`、最终执行状态和全部指纹一致。
- [x] 运行状态已在以上条件全部满足后更新为 `completed`，验证结论为 `passed`。
