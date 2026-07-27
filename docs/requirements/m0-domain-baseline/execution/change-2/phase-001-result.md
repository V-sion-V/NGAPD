# change-2 P-001 阶段结果：Follow/Blocker 授权与验收来源纠正

- 运行编号：`change-2`
- 阶段：`P-001`
- 阶段计划：[`phase-001-plan.md`](phase-001-plan.md) revision 3，SHA-256 `73aca5b15d15e5ca60aefd8589b7d283245e46bd7408868307bb016808d55539`
- 父变更计划：[`change-plan.md`](change-plan.md) revision 1
- 完成日期：`2026-07-28`
- 状态：`completed`
- 交付与验证策略：`strict`
- 验证结论：`passed`

## 1. 阶段目标与结果

P-001 完成 RC-2-001–RC-2-003 的实现与验证：

- Follow preview/change 现在稳定锁定 source/target，在锁内重读租户、活动 Membership、有效 source Owner 和管理员会话事实；Agent 代管要求用户显式请求管理员模式。
- Follow add/remove 绑定包含 source/target 的确定性 `follow_change` 影响令牌；普通模式只要求 source Owner，不把 target Owner 错当成写权限；不存在的 remove 稳定拒绝。
- 完成或冻结、归档的 source 不能修改 Follow；Follow 仍不改变 Owner、依赖、状态、graph version 或 Workspace 写资格。
- Blocker add 在 Task 行锁内重新授权并校验 expected Task version；成功时 Task version、blocker、成功审计和 Outbox 在一个 PostgreSQL 事务中提交。
- Blocker 对非 Owner、失活 actor、未显式请求管理员模式的 Agent、陈旧版本、归档或完成/冻结 Task 均稳定拒绝。
- Contracts 与 Task application service 提供同一内部 Follow/Blocker command 边界；没有新增公共 Task 路由。
- AC-010 的来源澄清已确认为本轮待应用 delta：M0 验收 blocked 派生、完成资格和不自动完成；幂等 completion-ready 投影与 Owner 通知仍由 M2 交付。

## 2. 任务、需求与验收覆盖

| 任务 | 状态 | 覆盖增量 | 结果 |
| --- | --- | --- | --- |
| P-001-T-001 | completed | RC-2-001、RC-2-002；AC-009、AC-010、AC-012、AC-014、AC-024 core | 旧实现下 1 个 Domain 与 4 个 PostgreSQL 用例按预期失败，既有相关测试全部通过 |
| P-001-T-002 | completed | RC-2-001、RC-2-002；AC-009、AC-010、AC-012、AC-014、AC-017、AC-018、AC-020、AC-024 core | Domain/Repository/Contracts/API 实现闭环，定向与扩大回归、静态/类型门禁通过 |
| P-001-T-003 | completed | RC-2-003；全部本轮 core 与工程硬门禁 | 里程碑状态已校准；完整 `pnpm check` 通过；允许最终派生 effective requirements 与 change-2 |

所有本轮验收均为 `core`，没有 waiver、降级或 report-only 处置。

## 3. 文件修改

| 文件 | 修改模式 | 主要目的 |
| --- | --- | --- |
| `packages/domain/src/task-graph.ts` | modify | 拒绝完成/归档 source Follow |
| `packages/domain/src/task-graph.test.ts` | modify | 完成态 source Follow 回归 |
| `packages/database/src/task-repository.ts` | modify | Follow 两端锁、授权与影响确认；Blocker Task 锁、授权、版本与原子记录 |
| `packages/database/src/task-repository.integration.test.ts` | modify | Follow/Blocker Owner/admin/Agent/失活/影响/version/frozen/audit/outbox 回归 |
| `packages/contracts/src/tasks.ts` | modify | 内部 Follow change 与 Blocker add runtime command |
| `packages/contracts/src/domain-contracts.test.ts` | modify | 新 command 必填影响/版本与边界验证 |
| `apps/api/src/modules/tasks/service.ts` | modify | Follow preview/change 与 Blocker add 内部应用服务 |
| `apps/api/src/modules/tasks/service.integration.test.ts` | modify | 应用组合、Task version 与 Outbox 回归 |
| `AGENTS.md` | modify | 活动 change-2 阶段事实 |
| `docs/12-prototype-preparation.md` | modify | change-1 完成和 change-2 交接事实 |
| `docs/requirements/m0-domain-baseline/execution/change-2/change-plan.md` | add | 待生效增量与单阶段路线 |
| `docs/requirements/m0-domain-baseline/execution/change-2/phase-001-plan.md` | add | strict compact 执行计划 |
| `docs/requirements/m0-domain-baseline/execution/change-2/execution-state.md` | add/modify | 任务检查点、验证与恢复权威 |

## 4. 测试与验证

| 时间 | 范围 | 命令/环境 | 可观察结果 |
| --- | --- | --- | --- |
| 02:31 | strict red-first Domain | Node 24.18.0；`vitest run packages/domain/src/task-graph.test.ts` | 5 passed / 1 expected failed；完成态 source Follow 被旧实现错误放行 |
| 02:31 | strict red-first Database | PostgreSQL 17.10；Task Repository integration | 10 passed / 4 expected failed；越权 Follow、无影响确认 Follow、越权 Blocker、陈旧 Blocker version 被旧实现放行 |
| 02:38–02:45 | 定向 green | Domain/Contracts/Database/API 四个改动测试文件 | 最终 4 files / 34 tests passed |
| 02:40 | 扩大 package 回归 | Domain、Contracts、Database package suites | Domain 55、Contracts 6、Database 39 tests passed |
| 02:45 | 静态与类型 | changed-area Prettier/ESLint；Domain/Contracts/Database/API typecheck | 全部 exit 0 |
| 02:50–02:53 | 最终根门禁 | Node 24.18.0、pnpm 11.9.0、PostgreSQL 17.10；`pnpm check` | exit 0；format、lint、build、10 workspace typecheck；49 files / 229 tests passed，3 files / 7 tests intentionally skipped |
| 02:54 | 环境清理 | `pg_ctl -m fast -w stop`；listener/path/temp wrapper 复核 | 端口 55441 listener 0；`C:\tmp\ngapd-m0-change2-pg` 和门禁临时文件不存在 |

## 5. 发现项与处置

| ID | 类别 | 严重程度 | 关联需求/验收 | 观察与证据 | 最终功能影响 | 处置 | 置信度 | 建议后续 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 无 | 无 | 无 | 无 | 全部 strict core 与最终根门禁通过 | 无 | closed | 高 | 无 |

没有开放 `FND-C2-*`；下一编号仍为 `FND-C2-001`。

## 6. 决策、计划偏差与恢复记录

- 首次 PostgreSQL archive 解压超过 60 秒并留下不完整运行时，`initdb` 精确报告缺少 `postgres.bki`；使用同一已校验 archive 补全后才初始化，未把失败环境当作测试证据。
- 首次定向 green 的 stale-impact 测试使用完全相等断言，但实现按既有恢复模式同时返回最新 impact；将断言收窄为稳定 reason 的 partial match 后，目标行为与恢复 payload 均被保留。
- API 扩大回归在沙箱内通过 20 项后因既有 Windows fixture 无权创建固定 `C:\tmp` 目录失败；授权环境中的最终根门禁完整通过 API 7 files / 21 tests，耗时 124.41 秒。
- 一次后台门禁包装没有启动 pnpm/Node 子进程；确认无子进程后只停止该 task-owned wrapper，随后通过可分段等待的同一次 `pnpm check` 取得退出 0。
- 首次清理命令因 PowerShell 条件表达式语法错误在停止或删除前终止；修正后精确停止 listener 并删除仅属于本任务的 PostgreSQL/临时文件。

这些偏差都已关闭，没有改变 RC-2-001–RC-2-003、公共兼容、数据 Schema 或阶段边界。

## 7. 遗留风险与下一阶段进入条件

- 没有开放产品、实现、验证、恢复或环境风险。
- P-001 是 change-2 唯一阶段，已满足 finalization 条件。
- 下一步只允许生成 `change-2.md`、把 `effective-requirements.md` 派生至 change-2，并把 execution state 与里程碑文档置为 `completed/passed`；不得再修改本阶段计划或结果。
