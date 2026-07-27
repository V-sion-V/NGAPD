# M0：Follow/Blocker 授权与验收来源纠正记录

- 修改编号：`2`
- 修改类型：`corrective requirement change`
- 前一记录：[`change-1.md`](change-1.md)
- 原始需求：[`requirements.md`](requirements.md)
- 初始路线图：[`implementation-plan.md`](implementation-plan.md)
- 变更计划：[`execution/change-2/change-plan.md`](execution/change-2/change-plan.md)
- 执行状态：[`execution/change-2/execution-state.md`](execution/change-2/execution-state.md)
- 阶段计划：[`execution/change-2/phase-001-plan.md`](execution/change-2/phase-001-plan.md) revision 3
- 阶段结果：[`execution/change-2/phase-001-result.md`](execution/change-2/phase-001-result.md)
- 项目基线：分支 `codex/m0-domain-baseline`，提交 `9b7c87158ebef9a2cf240bc2eb40def2c3690805`
- 完成日期：`2026-07-28`
- 交付与验证策略：`strict`
- 验证结论：`passed`

## 1. 原始需求变更项目

| 变更项 | 变更类型 | 关联原始需求或历史变更 | 变更前 | 变更后 | 验收影响 |
| --- | --- | --- | --- | --- | --- |
| RC-2-001 | modify/clarify | FR-011、FR-016、FR-017、FR-018、FR-028；AC-009、AC-014、AC-017、AC-018、AC-020、AC-024 | `TaskRepository.changeFollow` 可由任意 Membership 调用，不消费 source 有效 Owner/admin、Agent 管理来源或影响确认；remove 不验证关系存在。 | Follow add/remove 稳定锁定两端并重新读取 source 有效 Owner、活动 actor 和 admin session；普通模式只允许未完成、未归档 source 的有效 Owner，Agent 代管要求用户显式请求。提交绑定包含 source/target 的最新影响令牌；不存在的 remove 稳定拒绝。 | 既有验收继续为 core；新增低层越权、失活、Agent、完成冻结、影响漂移与 remove-not-found 回归 |
| RC-2-002 | modify/clarify | FR-012、FR-014、FR-017、FR-018、FR-020、FR-028；AC-010、AC-012、AC-017、AC-018、AC-020、AC-024 | `TaskRepository.addBlocker` 只检查 `frozen`，任意或失活 Membership 可调用，且不绑定资源版本。 | Blocker add 在 Task 行锁内重新解析活动 actor 与有效 Owner/admin，Agent 管理能力要求用户显式请求；命令绑定 expected Task version。成功原子递增 Task version、写 blocker、审计和 Outbox；完成/冻结/归档/陈旧写入稳定拒绝。 | 既有验收继续为 core；新增 Owner/admin/Agent/失活/version/frozen/archived 与原子记录回归 |
| RC-2-003 | modify/clarify | FR-012、AC-010；`docs/07-roadmap-and-validation.md` M0/M2 | 原始 AC-010 同时写入“一次对应提示”，但 change-0/change-1 有效需求只保留完成资格和不自动完成，未记录范围来源；正式路线把 completion-ready/Owner 通知放在 M2。 | M0 AC-010 明确只验收 blocked 派生、完成资格和不自动完成；幂等 `completion_ready` 投影、`TaskCompletionBecameReady` 事件和 Owner 通知仍由 M2 交付。 | AC-010 保持 core；修复来源链，不把未实现通知误报为 M0 已交付，也不删除 M2 产品能力 |

原始 FR-001–FR-028、AC-001–AC-029 全部继续生效；本记录没有 add/delete delta。

## 2. 实现概述

### 2.1 Follow

- 新增 `previewFollowImpact`，验证两端存在、不同且同项目，拒绝完成/冻结/归档 source，并把 target 作为 related Task 纳入既有 `follow_change` 影响算法。
- add/remove 对 source/target 按稳定 Task ID 顺序取 `FOR UPDATE` 锁；锁内重读项目任务树、Membership、用户活动状态和有效 Owner。
- 复用正式 Task operation authorization：普通模式只校验 source Owner，target 只进入影响确认；管理员会话可代管，Agent 管理路径必须来自用户显式请求。
- 提交前重算影响令牌；陈旧令牌返回 `impact_confirmation_stale` 和最新 impact。重复 add 与不存在的 remove 返回稳定失败。
- 成功只写 Follow、审计和 Outbox，不递增 graph version 或改变 Owner、依赖、状态、Workspace 写资格。

### 2.2 Blocker

- `addBlocker` 锁定 Task 后检查完成冻结、归档、活动 actor、有效 Owner/admin 与 expected Task version。
- 普通模式只允许有效 Task Owner；管理员会话可以代管，Agent 仍要求用户显式请求本次管理能力。
- 成功在同一事务插入 blocker、递增 Task version、写包含前后版本的成功审计与带新版本的 Outbox。
- 任一授权、版本或生命周期失败发生在业务写入前；completion 与 blocker 共用 Task 行锁并继续在锁内重查 active blocker。

### 2.3 契约、应用与范围

- Contracts 增加 `ChangeTaskFollowCommandSchema` 和 `AddTaskBlockerCommandSchema`，显式要求影响令牌、expected version 与非空 blocker reason。
- `TaskApplicationService` 增加 Follow preview/change 与 Blocker add，统一解析 actor、映射错误和记录失败审计。
- 没有新增 Fastify route、数据库迁移、UI、本地同步、Agent 写工具或 M2 completion-ready/notification 实现；Identity/Pairing/Workspace 公共输入输出不变。

## 3. 文件修改

| 文件 | 修改模式 | 主要目的 |
| --- | --- | --- |
| `packages/domain/src/task-graph.ts` | modify | Follow source 完成/归档校验 |
| `packages/domain/src/task-graph.test.ts` | modify | Follow 完成冻结回归 |
| `packages/database/src/task-repository.ts` | modify | Follow 两端锁/授权/影响；Blocker 锁/授权/version 原子事务 |
| `packages/database/src/task-repository.integration.test.ts` | modify | Follow/Blocker 正负授权、影响、版本、冻结与审计/Outbox 回归 |
| `packages/contracts/src/tasks.ts` | modify | 内部 Follow/Blocker runtime command |
| `packages/contracts/src/domain-contracts.test.ts` | modify | 新 command Schema 正负验证 |
| `apps/api/src/modules/tasks/service.ts` | modify | Follow/Blocker 内部应用服务组合 |
| `apps/api/src/modules/tasks/service.integration.test.ts` | modify | 应用服务、版本与 Outbox 验证 |
| `AGENTS.md` | modify | change-1/change-2 完成状态与 M1 交接 |
| `docs/12-prototype-preparation.md` | modify | M0 纠正记录与当前路线图交接 |
| `docs/requirements/m0-domain-baseline/execution/change-2/change-plan.md` | add | RC-2-001–RC-2-003 与 compact 路线 |
| `docs/requirements/m0-domain-baseline/execution/change-2/phase-001-plan.md` | add | strict P-001 执行计划 revision 3 |
| `docs/requirements/m0-domain-baseline/execution/change-2/phase-001-result.md` | add | immutable completed/passed 阶段结果 |
| `docs/requirements/m0-domain-baseline/execution/change-2/execution-state.md` | add | change-2 检查点、验证、恢复与完成状态 |
| `docs/requirements/m0-domain-baseline/effective-requirements.md` | modify | 当前产品权威派生至 change-2 |
| `docs/requirements/m0-domain-baseline/change-2.md` | add | 本纠正记录 |

没有修改 `requirements.md`、`implementation-plan.md`、`workflow-contract.md`、initial/change-1 完成证据、数据库迁移、Task route 或部署文件。

## 4. 需求、阶段与任务完成情况

| 阶段 | 任务 | 主要覆盖 | 状态与结果 |
| --- | --- | --- | --- |
| P-001 | P-001-T-001 | RC-2-001、RC-2-002 red-first；AC-009、AC-010、AC-012、AC-014、AC-024 core | completed；1 个 Domain + 4 个 PostgreSQL 目标失败被旧实现稳定复现 |
| P-001 | P-001-T-002 | Follow/Blocker Domain/Repository/Contracts/API；AC-009、AC-010、AC-012、AC-014、AC-017、AC-018、AC-020、AC-024 core | completed；定向与扩大 green、类型/静态门禁 passed |
| P-001 | P-001-T-003 | RC-2-003、有效需求、里程碑状态与全部 strict gate | completed；根 `pnpm check` passed，环境清理完成 |

阶段结果 SHA-256：`04aee30e87e3e4fb1fabbe7b8461e375cd16befe91cf3315ae8d3ab55a918074`。

## 5. 测试与验证

- 策略：`strict`。所有本轮 core 与补充检查阻塞；没有 waiver 或 report-only finding。
- red-first：
  - Domain 6 tests：5 passed / 1 expected failed，证明完成 source Follow 被旧实现放行。
  - Database Task Repository 14 tests：10 passed / 4 expected failed，证明非 source Owner Follow、无影响确认 Follow、非 Owner Blocker 和陈旧 Blocker version 被旧实现放行。
- 定向 green：Domain/Contracts/Database/API 4 files / 34 tests passed。
- 扩大回归：Domain 55、Contracts 6、Database 39 tests passed；最终 API 7 files / 21 tests passed。
- 最终根 `pnpm check`：Node.js `24.18.0`、pnpm `11.9.0`、PostgreSQL `17.10`；format、lint、build、10 workspace typecheck 与全部适用 tests 退出 0。
- 最终统计：49 files / 229 tests passed；3 files / 7 tests intentionally skipped。
- 范围审查：Task routes、数据库迁移和部署文件无 diff；没有新增公共 CRUD、M2 notification 或兼容变更。
- 清理：PostgreSQL `127.0.0.1:55441` 已正常停止，listener 为 0；`C:\tmp\ngapd-m0-change2-pg` 与门禁临时文件均不存在。

## 6. 与路线图及阶段计划的偏差

- 没有需求、验收层级、公共兼容或阶段边界偏差；change-2 使用一个 compact P-001 阶段完成。
- PostgreSQL archive 首次解压超时且 `initdb` 精确报告运行时不完整；补全同一 archive 后才初始化和取证，没有接受损坏环境结果。
- 首次定向 green 只因 stale-impact 测试没有允许既有恢复 payload 而失败；改为校验稳定 reason 并保留最新 impact 后通过。
- API 扩大回归在沙箱内因既有固定 `C:\tmp` fixture EPERM 停止；授权环境最终根门禁完整运行 API 7 files / 21 tests 并通过。
- 一个后台 wrapper 未产生 pnpm/Node 子进程，确认后精确停止；最终使用可分段等待的同一次根命令取得退出 0。
- 首次环境清理表达式在任何停止/删除前失败；修正后精确停止并删除 task-owned 临时资源。

这些偏差全部关闭，没有改变 RC-2-001–RC-2-003 或留下未知影响。

## 7. 遗留事项

| ID | 类别 | 严重程度 | 关联需求/验收 | 观察与证据 | 最终功能影响 | 处置 | 置信度 | 建议后续 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 无 | 无 | 无 | 无 | 全部 strict core、补充检查和最终根门禁通过 | 无 | closed | 高 | 无 |

没有开放 `FND-C2-*`、未决产品决策、迁移半状态、活动服务或任务临时环境。M0 当前有效需求已派生到 [`effective-requirements.md`](effective-requirements.md)；下一步可以建立 M1“项目、角色和成员”的独立 schema-v3 需求与实施工作流。
