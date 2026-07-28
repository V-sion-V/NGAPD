# M1 初始实现 P-001：共享契约、领域规则与前向数据基础

- 运行编号：`initial`
- 阶段编号：`P-001`
- 阶段计划修订：`1`
- 父路线图修订：`1`
- 需求指纹：`sha256:f3ab380a2826c494223aff7b3c7ae7c9e8904d8d2ddf2ad0392adb26488020d8`
- 项目基线：分支 `requirements/m1-project-role-members`，提交 `f9efee992394f1b6761182237cf736f79561ad5b`
- 创建日期：`2026-07-28`
- 详细度：`expanded`
- 交付与验证策略：`relaxed`
- 验证结论：`pending`

## 1. 阶段目标、边界与关联需求

### 1.1 目标

在不开放 M1 公共路由的前提下，建立后续后端闭环唯一可依赖的共享基础：

- M1 runtime Schema、DTO、稳定错误、资源版本和调用者动作；
- Project/Membership/Join Request/Owner Transfer/Project Role/Admin Mode 的纯领域状态与授权决策；
- 可从空库及正式 `0001`—`0007` 前缀前向建立的 `0008` Schema；
- Membership 从 `active/role` 到 `status/permission_level` 的单一权威迁移及现有 Repository/fixtures 兼容适配；
- 74 个系统逻辑角色模板的生产可发布来源、约束和既有项目幂等快照；
- 成员移除与 Task Owner 写入必须共享的 Membership 生命周期锁接口。

关联需求为 FR-001–FR-046 的契约、领域和数据基础；直接阶段门禁覆盖 AC-001–AC-022、AC-024–AC-026 中可由基础层独立证明的部分。Web、完整 M1 Repository/应用服务、公共路由、最终性能与发布验收不在本阶段实现。

### 1.2 已验证前置

- `workflow-contract.md` 为 schema `3.2`，路径与 feature ID 一致。
- `requirements.md` 状态为已批准，交付策略由用户明确选择为 `relaxed`，全部 AC 已标注层级且无未决问题。
- M0 `change-0`、`change-1`、`change-2` 均为 `completed/passed`，没有活动纠正运行。
- 当前分支和提交与需求记录的项目基线一致。
- 当前工作区在规划前仅有用户创建的未跟踪 M1 合同与需求目录；没有需要合并的生产代码改动。
- 当前正式 Schema profile 为 `m0-domain-baseline / version 1`，迁移前缀严格为 `0001`—`0007`。

### 1.3 阶段退出不变量

- 现有 Identity、Pairing、Device、Workspace、SSE 和内部 Task 公共/应用端口保持兼容。
- 数据库不存在并行可分歧的 Membership `active/role` 与 `status/permission_level` 权威。
- Project Owner 始终由同项目活动 Membership 的 `owner_membership_id` 表达；Role 内容不参与授权。
- 非活动 Membership 不能成为新的 Task Owner 或取得项目/Task Workspace 写资格。
- `0008` 失败不改变原 `0007` 数据；迁移完成后 API/Worker ready 可识别新正式 profile。
- 不注册任何半实现的 M1 `/api/v1` 路由，不修改 M0 封存执行记录。

## 2. 任务与文件范围

### 2.1 任务

| 任务 | 结果 | 文件或范围 | 实现摘要 | 验证 | 完成条件 |
| --- | --- | --- | --- | --- | --- |
| P-001-T-001 | M1 共享契约与纯领域基础成为唯一规则入口 | `packages/contracts/src`、`packages/domain/src` 及其目标测试 | 增加资料、项目治理、Membership/申请/转移、角色和 Admin Mode Schema/状态机/授权；扩展稳定错误；把 Membership 活动状态与权限名称收敛到新权威；提供移除阻塞与共享生命周期锁所需的纯输入输出契约 | V-001 | 所有新状态转换、权限正负路径、Role 不授权和边界校验均有确定性测试；既有导出和兼容 Schema 未破坏 |
| P-001-T-002 | `0008` 可前向保留数据地建立 M1 Schema，并让现有生产路径适配新权威 | `packages/database/src`、相关现有 Repository/测试、`packages/test-fixtures/src`、生产模板 JSON | 追加迁移和 Kysely 类型；识别 version 1 正式前缀为 behind；回填资料/Membership/角色快照；增加唯一/状态/版本/受众/幂等约束；适配 Foundation/Task/Workspace/Outbox 查询；建立随包发布的模板数据与 `docs/11` parity | V-002、V-003 | 空库和 `0007` 升级均 ready、重复迁移 no-op、未知历史 fail closed；旧 ID/引用/Workspace/Task Owner/审计保留；现有 Repository 不再读取旧 Membership 字段 |
| P-001-T-003 | 阶段兼容、构建和恢复门禁形成可交接检查点 | 受影响包测试、API 兼容测试、根工程门禁、执行状态与阶段结果 | 运行最小充分的目标验证和因本阶段改动会影响的扩大回归；确认没有公共 M1 半路由、无隐式 reset、无外部调用；记录实际文件、迁移证据、偏差/findings 和精确恢复状态 | V-004、V-005 | 全部阶段 core/硬门禁通过；supplemental 异常仅在证明无交付影响后以 `FND-I-*` 记录；生成 immutable `phase-001-result.md` 并把运行置为 `awaiting_next_phase` |

依赖顺序：`P-001-T-001 → P-001-T-002 → P-001-T-003`。任一任务未完成或进入 paused/blocked 时不得开始下一任务。

### 2.2 预期文件所有权与接口

| 文件或范围 | 预期目的与接口约束 |
| --- | --- |
| `packages/contracts/src/identity.ts`、`projects.ts`、新建 Membership/Role/Admin Mode 契约文件、`errors.ts`、`index.ts` | 保留既有必填响应形状；新增独立资源 DTO、版本、actions、幂等/状态输入和稳定错误 |
| `packages/domain/src/authorization.ts`、`task-owner.ts` 及新建 Project Governance/Membership/Logical Role/Admin Mode 文件 | 纯函数规则；不依赖数据库、Fastify、Web、模板 Prompt 或测试夹具 |
| `packages/domain/src/system-logical-role-templates.json` 及加载/校验文件 | 生产可发布的 74 个 `id/title/desc` 模板；与 `docs/11-logical-role-templates.json` 精确 parity |
| `packages/database/src/migrations.ts`、`types.ts`、`schema-profile.ts` | 追加 `0008-m1-project-role-members`；version 1 正式前缀可迁移、version 2 ready；未知历史继续 fail closed |
| `packages/database/src/foundation-repository.ts` | 现有 User/Project 原子创建适配新必填列；本阶段只建立可复用基础，不开放完整 M1 业务服务 |
| `packages/database/src/task-repository.ts`、`task-lifecycle-repository.ts`、`workspace-repository.ts`、`outbox-repository.ts` | 改读 `status/permission_level`，提供/消费共享 Membership 生命周期锁与 user/project 失效受众；不改变 M0 Task 业务语义 |
| `packages/database/src/*test.ts`、`*integration.test.ts` | 空库/升级/重复迁移、回填、约束、模板快照、Repository 兼容、真实 PostgreSQL 行为 |
| `packages/test-fixtures/src` 与受影响 API 测试 seed | 只适配正式新 Schema，不把 fixture 变成业务权威 |
| `docs/11-logical-role-templates.json` | 继续作为正式可读模板清单；只有 parity 或被批准的模板事实要求时才修改内容 |

若实施发现必须新增另一生产文件，执行者先在 `execution-state.md` 记录原因、所有权和对退出条件的影响；若会改变产品行为、公共兼容或迁移策略，则暂停并请求用户确认。

### 2.3 有序实施步骤

1. 开始 P-001-T-001 前，把运行/阶段置为 `in_progress`，记录当前任务和受影响范围；先实现纯领域类型/决策与共享 runtime Schema，再调整现有导出和目标测试。
2. 在 P-001-T-001 检查点确认旧 Identity/Workspace/Task 契约仍可类型检查后，开始 P-001-T-002。
3. 先让 Schema profile 明确识别“version 1 + 完整 `0001`—`0007`”为可迁移 `behind`，再追加 `0008`；迁移在一个事务内完成列/表/约束、数据回填、模板快照与 metadata version 更新。
4. 迁移完成后一次性适配 Kysely 类型、Foundation/Task/Workspace/Outbox Repository 和 fixtures；禁止长期保留双 Membership 权威。
5. 先验证空库和带代表性 `0007` 数据的升级，再运行现有 Repository/API 兼容回归；任何数据、约束或 profile 异常都必须停在当前任务，不得用 reset 掩盖。
6. P-001-T-003 仅在前两任务有完整检查点后执行；最终门禁通过后写阶段结果并交回 rolling planning，不提前实现 P-002。

## 3. 验证与完成条件

### 3.1 验证项

| 验证 | 层级 | 内容 |
| --- | --- | --- |
| V-001 | core | `@ngapd/contracts` 与 `@ngapd/domain` 目标测试和 typecheck；覆盖输入边界、状态机、权限矩阵、Owner 唯一性、Role 不授权、移除阻塞集合及既有契约兼容 |
| V-002 | core | 真实 PostgreSQL 17 数据库测试：空库 `0001`—`0008`、正式 `0007` 代表数据升级、重复 migrate、profile fail-closed、回填/唯一/外键/check 约束、74 模板及既有项目幂等快照 |
| V-003 | core | `@ngapd/database` Repository/并发目标测试和 typecheck；证明现有 Foundation/Task/Workspace/Outbox 只消费新 Membership 权威，旧 ID、Task Owner、Workspace 版本、租约历史和审计未被迁移改写 |
| V-004 | core | `@ngapd/api` 与 `@ngapd/test-fixtures` 受影响兼容测试/typecheck；OpenAPI 不出现未完成的 M1 公共路由，Identity/Pairing/Workspace/SSE 和内部 Task 行为保持兼容 |
| V-005 | core | 根 `pnpm check`；检查工作区差异、无隐式 reset/外部 API/AI/LLM、无封存记录改写，并核查本阶段是否已使 AGENTS/README/活动正式文档失真 |

数据库 core 验证要求可用的真实 PostgreSQL 17 和显式测试数据库目标；缺失该环境时 P-001 不能完成，只能在执行状态记录未运行项和恢复步骤。P-001 不要求最终 Compose smoke 或 Web 端到端，它们在 P-003 统一执行。

### 3.2 完成门禁

- 三个任务均有前后检查点，实际文件与计划偏差已记录。
- V-001–V-005 全部通过；没有 failed、unknown-impact 或未证明的 core 项。
- 数据升级、Profile ready、API/Worker fail-closed 和迁移失败恢复均有真实证据。
- 没有未决用户问题、半应用迁移、未记录的用户改动覆盖或活动测试进程。
- 若出现 relaxed report-only finding，必须从 `FND-I-001` 连续编号、分级，并独立证明不影响 core/硬门禁。
- 仅在以上条件满足后创建 `phase-001-result.md`；随后运行状态为 `awaiting_next_phase`，等待下一次 `$plan-feature-implementation` 规划 P-002。

## 4. 风险、恢复与修订记录

### 4.1 风险控制

| 风险 | 预防与检测 | 失败后的安全状态 |
| --- | --- | --- |
| 新 profile 在 `0008` 前拒绝 version 1 正式库 | 先增加明确兼容识别测试，再执行迁移集成测试 | 保持数据库未迁移，修正 profile 识别；禁止 reset |
| `active/role` 与 `status/permission_level` 双写漂移 | 同迁移移除旧权威并一次性适配全部生产查询；`rg`/类型/数据库测试检查残留 | 事务失败回滚至 `0007`；代码未部署前修正 |
| 迁移中间失败留下半表/半回填 | 单迁移事务、约束后置验证、故障测试 | PostgreSQL 回滚整次 `0008`；记录错误和目标，不执行 down/reset |
| 模板 JSON 未进入构建产物或与 docs 漂移 | 生产包加载测试、74 个 ID/字段 parity、项目快照计数与唯一约束 | 阶段阻塞；修正打包/来源，不以空模板继续 |
| 现有 Task/Workspace Repository 漏读旧字段 | 编译错误、定向 Repository/API 回归和残留搜索 | 保持 P-001-T-002 `in_progress`，按记录范围补齐后重跑受影响验证 |
| 用户已有未跟踪需求被误覆盖 | 任务开始前记录基线，只写计划和明确实现范围 | 立即暂停，保留 diff 并请求用户处理重叠 |

### 4.2 迁移与回退

- `0008` 是前向迁移，不提供自动生产降级承诺。
- 迁移执行前由实现运行记录精确数据库目标和已应用前缀，但不得采集秘密或无关全库内容。
- 迁移事务失败时保留 `0007`；代码和 ready 检查继续拒绝未满足的 M1 Schema。
- `0008` 已提交后如应用必须回退，优先 roll forward 修复；需要恢复时只使用用户确认的数据库备份及发布说明，不调用仓库 reset/down 作为生产恢复。
- 任何改变该策略的发现都是材料风险决策，必须把运行置为 `paused` 并请求用户确认。

### 4.3 精确恢复起点

首次执行从 `P-001-T-001` 开始：读取本计划与 `execution-state.md`，核对需求/路线图/阶段计划指纹及 `git status`，把运行和 P-001 置为 `in_progress` 后，先编辑共享契约与纯领域规则。若已有任务检查点，则只从状态中记录的未完成步骤恢复，不重做已完成任务。

### 4.4 修订记录

| 修订 | 日期 | 变更 | 原因与影响 |
| --- | --- | --- | --- |
| 1 | 2026-07-28 | 首次 P-001 expanded 计划 | 前向迁移、正式 profile 兼容、多个事务写入者和用户已有未跟踪需求需要精确文件/锁/恢复边界；不改变路线图阶段或追踪 |
