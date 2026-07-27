# M0 Follow/Blocker 授权与验收来源纠正计划

- 运行编号：`change-2`
- 运行类型：`corrective requirement change`
- schema：`3.2`
- 交付与验证策略：`strict`
- 计划模式：`compact`
- 计划修订：`1`
- 当前有效需求指纹：SHA-256 `3b16d6596a178b7d518149f8b21561a2342f4c47f0498f7f387fe22a7aef9485`
- 项目基线：分支 `codex/m0-domain-baseline`，提交 `9b7c87158ebef9a2cf240bc2eb40def2c3690805`
- 计划日期：`2026-07-28`

## 1. 变更说明审核与待生效增量

用户采纳完成复核建议，显式选择以 `strict` 纠正运行关闭以下 M0 阻塞项。原始需求、initial roadmap、change-0、change-1 及其完成证据保持不可变。

| ID | 分类 | 关联当前需求/验收 | 变更前 | 变更后的明确约束 | 验收层级 |
| --- | --- | --- | --- | --- | --- |
| RC-2-001 | modify/clarify | FR-011、FR-016、FR-017、FR-018、FR-028；AC-009、AC-014、AC-017、AC-018、AC-020、AC-024 | `TaskRepository.changeFollow` 可由任意 Membership 调用，未消费有效 Owner/admin、Agent 管理会话来源或影响确认，且 remove 不验证关系存在。 | Follow add/remove 必须稳定锁定并重新读取两端；source 必须为当前用户有效拥有的未完成、未归档 Task，或由有效管理员会话代为维护；Agent 使用管理员能力必须来自用户显式请求。操作必须绑定包含 source/target 的最新确定性影响确认；不存在的 remove 返回稳定失败，成功写审计和 Outbox。 | 全部 `core` |
| RC-2-002 | modify/clarify | FR-012、FR-014、FR-017、FR-018、FR-020、FR-028；AC-010、AC-012、AC-017、AC-018、AC-020、AC-024 | `TaskRepository.addBlocker` 只检查 Task 是否 frozen，可由任意或失活 Membership 调用，也不绑定资源版本。 | Blocker add 必须在 Task 行锁内重新解析活动 actor 与有效 Owner；普通模式只允许有效 Owner，管理员模式可代为维护，Agent 管理能力仍要求用户显式请求。命令绑定 expected Task version；成功原子递增 Task version、写 blocker、审计和 Outbox，已完成/冻结/归档或陈旧写入稳定拒绝。 | 全部 `core` |
| RC-2-003 | modify/clarify | FR-012；AC-010；`docs/07-roadmap-and-validation.md` M0/M2 | 原始 AC-010 同时写入“一次对应提示”，但 change-0 派生的有效需求没有记录范围澄清来源；路线图把 `completion_ready` 投影与 Owner 通知交付放在 M2。 | M0 的 AC-010 只验收 blocked 派生、父 Task 完成资格与不自动完成；幂等 `completion_ready` 投影、`TaskCompletionBecameReady` 事件和 Owner 通知仍按既有路线图在 M2 交付。有效需求必须记录该范围澄清的来源链，不得把未实现通知误报为 M0 已交付。 | `AC-010 core` |

没有 add/delete delta，不新增公共 Project/Task HTTP 路由，不改变 Identity/Pairing/Workspace 公共输入输出，也不把 M2 的通知投影提前实现到 M0。

## 2. 当前有效状态与项目依据

- schema `3.2` 合同、原始需求和 initial roadmap 指纹与 change-0/change-1 记录一致。
- `change-0.md` 与 `change-1.md` 编号连续，两个运行均为 `completed/passed`，没有开放 `FND-I-*` 或 `FND-C1-*`。
- 当前有效需求已应用至 change-1，且与 RC-001–RC-003 重放一致；下一连续记录和执行目录均为 `change-2`。
- 工作区基线干净，无用户未提交文件与本轮范围重叠。
- 正式权限文档规定 Follow 只能从当前用户有效拥有的未完成 Task 发出，管理员模式可代为维护；任务内容/状态修改按有效 Owner/admin 授权，确认不能替代授权。
- M0 路线只要求关注、状态和影响集合领域/服务端基线；M2 明确拥有人工 blocker 用户闭环、completion-ready 投影与 Owner 通知。

## 3. 影响分析与全局设计

### 3.1 领域与 Repository

- 扩展 Follow 领域校验，使已完成、冻结等完成态 source 不能创建关系；Repository 对 add/remove 共享两端锁、租户检查、source 有效 Owner/admin 授权和影响令牌复核。
- `previewFollowImpact` 使用既有 `follow_change` 影响算法，并把 target 作为 related Task 纳入确认；Follow 不改变 graph version、Owner、状态、Workspace 写资格或 target 写权限。
- `addBlocker` 在锁内校验 Task 生命周期、expected version、活动 actor 与有效 Owner/admin；成功时 Task version、blocker、audit、Outbox 同事务提交。
- 复用 `resolveTaskOperationAuthorization`，不复制新的权限矩阵；所有项目事实来自服务端数据库。

### 3.2 契约与应用边界

- Contracts 增加内部 Follow change 和 Blocker add runtime command，显式表达影响令牌、expected Task version 和 blocker reason。
- `TaskApplicationService` 增加 Follow preview/change 与 Blocker add 组合入口，使用 `requireTask`/`requireActor` 和统一 failure audit/error mapping；仍不注册公共 HTTP 路由。

### 3.3 文档与兼容

- `effective-requirements.md` 只在最终阶段门禁全部通过后派生至 change-2，保留原始 AC-010 并记录 RC-2-003 的范围澄清。
- `AGENTS.md` 与 `docs/12-prototype-preparation.md` 跟随活动/完成状态更新，避免继续把已完成 change-1 报为 in-progress。
- 数据库 Schema、迁移编号、公开 DTO、现有 Follow 数据和 M2 通知设计均不变。

## 4. 阶段路线图

| 阶段 | 目标 | 关联增量与验收 | 前置阶段 | 退出条件 | 当前状态 |
| --- | --- | --- | --- | --- | --- |
| P-001 | 以 red-first 证据关闭 Follow/Blocker 低层授权与并发条件缺口，纠正 AC-010 来源链和阶段状态，并完成严格回归 | RC-2-001–RC-2-003；AC-009、AC-010、AC-012、AC-014、AC-017、AC-018、AC-020、AC-024 core | change-1 `completed/passed`；用户选择 `strict` | 旧实现上的最小回归按预期失败；修正后 Domain/Contracts/Database/API 定向与扩大门禁、根 `pnpm check` 全部通过；有效需求、状态文档、阶段结果和 change-2 记录一致，无开放 finding | ready |

## 5. 跨阶段依赖与兼容约束

- 本 change run 只有一个阶段；阶段内最终门禁同时是 change-2 集成门禁。
- 不修改已冻结的原始需求、initial roadmap、change-0/change-1 或既有阶段结果。
- Follow 目标 Task 不因关系建立获得任何新写权限；影响确认也不授权 source mutation。
- 管理员模式只能扩大任务管理权限，不能绕过活动 Membership、Agent 显式请求、完成冻结、租户或版本条件。
- 所有失败必须无业务半状态；应用入口继续写失败审计，Repository 成功路径继续原子写成功审计与 Outbox。
- M0 不开放公共 CRUD/UI/Agent 写工具，也不提前实现 M2 notification projection。

## 6. 最终集成、回归与验收流程

1. 在生产代码不变时加入 Domain/Database/API/Contracts 最小回归，并在隔离 PostgreSQL 17 下保存 Follow/Blocker 授权失败的 red-first 证据。
2. 实现 RC-2-001/RC-2-002，使新增测试由红转绿；运行受影响 Domain、Contracts、Database、API 测试和类型/构建检查。
3. 更新 RC-2-003 来源链与活动阶段文档；在 Node.js 24/pnpm 11/隔离 PostgreSQL 17 下运行最终根 `pnpm check`。
4. 复核无公共路由、迁移、兼容与范围漂移；确认所有 core 验收通过且没有 `FND-C2-*` 后，生成 phase result、change-2、更新有效需求并把状态置为 completed/passed。

## 7. 需求与阶段追踪矩阵

| 增量 | 阶段 | 实现证据 | 验收证据 |
| --- | --- | --- | --- |
| RC-2-001 | P-001 | Domain Follow 校验、Repository impact preview/change、Contracts command、Task application service | source Owner/admin/Agent/失活/frozen/remove-not-found/impact-token PostgreSQL 与应用回归；AC-009/014/017/018/020/024 core |
| RC-2-002 | P-001 | Repository Task lock/version/authorization/blocker/audit/outbox、Contracts command、Task application service | Owner/admin/Agent/失活/stale/completed/archived 与原子 version PostgreSQL/应用回归；AC-010/012/017/018/020/024 core |
| RC-2-003 | P-001 | change-2 增量、effective snapshot 来源与里程碑状态文档 | 原始 AC-010、M0/M2 路线、effective requirement 和 change record 重放一致；AC-010 core |

## 8. 风险、技术决策与修订记录

| 风险 | 控制 |
| --- | --- |
| Follow 两端或 Owner 在预览与提交间漂移 | 两端稳定加锁后重新读取项目/Owner，影响令牌在锁内重算；授权只使用最新 source 有效 Owner。 |
| 错把 target Owner 当作写授权要求 | target 只进入影响预览，不进入 affected-owner 授权集合；保持 Follow 只读发现语义。 |
| Blocker 与 completion 并发形成错误后态 | 两者共享 Task 行锁；Blocker 写检查 expected version 并递增版本，completion 在锁内重查 blocker。 |
| 新命令被误解为公共功能 | 只增加共享内部 runtime command 和应用服务，不注册路由；负向边界审查阻塞。 |
| AC-010 澄清被误写成删除产品能力 | RC-2-003 只明确里程碑归属；一次提示仍是 M2 的有效产品要求，保留正式路线和领域文档。 |

| 修订 | 日期 | 结论与依据 | 影响阶段 | 追踪影响 |
| --- | --- | --- | --- | --- |
| 1 | 2026-07-28 | 用户采纳严格 change-2 纠正建议；三个缺口可在一个原子 compact 阶段实现和验证 | P-001 | RC-2-001–RC-2-003 全部映射到 P-001 |
