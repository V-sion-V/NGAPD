# M0 change-2 执行状态

- 运行编号：`change-2`
- 运行类型：`需求变更`
- 目标记录：`change-2.md`
- schema：`3.2`
- 运行状态：`completed`
- 交付与验证策略：`strict`
- 验证结论：`passed`
- 当前路线图修订：`1`
- 变更前有效需求指纹：SHA-256 `3b16d6596a178b7d518149f8b21561a2342f4c47f0498f7f387fe22a7aef9485`
- 最终有效需求：[`../../effective-requirements.md`](../../effective-requirements.md)，SHA-256 `2675d7ae4ea148dc1e6212078f5718dd28b3dd6659fbe55369c8ff274624cc83`
- 最终变更记录：[`../../change-2.md`](../../change-2.md)，SHA-256 `65941d275fded7501cd66c87f91fc07e3fc1b001dd16644f47705b1c67d3475b`
- 变更计划指纹：[`change-plan.md`](change-plan.md) revision 1，SHA-256 `a17a5073985a4e3e9ff8e43f1c21f3fcc3fb78fb1d9e6f864e163b7e17cf5eaa`
- 当前阶段：`P-001`
- 当前阶段计划：[`phase-001-plan.md`](phase-001-plan.md) revision 3，SHA-256 `73aca5b15d15e5ca60aefd8589b7d283245e46bd7408868307bb016808d55539`
- 当前任务：无（P-001 与 change-2 均已完成）
- 下一发现项编号：`FND-C2-001`
- 项目基线：分支 `codex/m0-domain-baseline`，提交 `9b7c87158ebef9a2cf240bc2eb40def2c3690805`
- 最后更新时间：`2026-07-28T03:03:13+08:00`

## 1. 运行目标或待生效变更

- RC-2-001：Follow add/remove 必须消费 source 有效 Owner/admin、活动 actor、Agent 显式管理员请求和包含两端的确定性影响确认。
- RC-2-002：Blocker add 必须消费 Task 有效 Owner/admin、活动 actor、Agent 显式管理员请求、expected Task version 和完成冻结事实。
- RC-2-003：澄清 M0 AC-010 不包含 M2 的 completion-ready 投影/Owner 通知实现，并修复当前阶段文档。

## 2. 阶段状态

| 阶段 | 计划 | 状态 | 结果 |
| --- | --- | --- | --- |
| P-001 | [`phase-001-plan.md`](phase-001-plan.md) revision 3 | completed | [`phase-001-result.md`](phase-001-result.md)，SHA-256 `04aee30e87e3e4fb1fabbe7b8461e375cd16befe91cf3315ae8d3ab55a918074` |

## 3. 当前检查点

- 历史审计：workflow contract schema 3.2；change-0/change-1 均 `completed/passed`；编号与记录连续。
- 指纹审计：requirements、initial roadmap、change-0/change-1、change-1 plan/result 与有效需求的记录指纹全部匹配。
- 工作区审计：任务开始前基线干净；只有本次新建的 `execution/change-2/` 计划与状态文件。
- 工具链：最终验证必须使用 Node.js `24.18.0`、pnpm `11.9.0` 和隔离 PostgreSQL 17。
- P-001-T-001 completed：生产逻辑未修改时，Domain Follow 6 tests 中 5 passed / 1 expected failed；Database Task Repository 14 tests 中 10 passed / 4 expected failed。
- 五项失败精确对应：完成态 source Follow 被放行；非 source Owner Follow 被放行；Follow 未校验影响确认；非 Task Owner blocker 被放行；blocker 未校验 expected Task version。既有测试全部通过，没有环境/迁移/fixture 失败。
- P-001-T-002 completed：Follow preview/change 绑定 source/target 稳定锁、最新 source 有效 Owner/admin、Agent 显式管理员请求和两端影响令牌；Blocker add 绑定 Task 锁、最新有效 Owner/admin、expected version，并同事务递增 Task version、写 blocker/audit/outbox。
- Contracts 增加内部 Follow/Blocker runtime command；Task application service 增加 preview/change/add 组合入口，继续不注册公共路由。
- 定向最终 green 为 4 files / 34 tests passed；Domain 55、Contracts 6、Database 39 全包通过；四个受影响 workspace typecheck 与 changed-area ESLint/Prettier 通过。
- API 扩大回归在沙箱内已有 6 files / 20 tests passed，唯一 suite 因既有固定 `C:\tmp` fixture EPERM 未启动；授权复跑超过 60 秒窗口后自行退出且未留下测试进程。该环境项不作为通过证据，最终根门禁仍需在授权测试目录中完整运行。
- P-001-T-003 completed：Node 24.18.0、pnpm 11.9.0、PostgreSQL 17.10 下最终根 `pnpm check` 退出 0；format、lint、build、10 workspace typecheck 和全部适用测试通过。
- 最终测试统计为 49 files / 229 tests passed；3 files / 7 tests intentionally skipped。API 完整 7 files / 21 tests passed。
- 隔离 PostgreSQL 已正常停止；端口 55441 listener 为 0，`C:\tmp\ngapd-m0-change2-pg` 和门禁临时文件已删除。
- [`phase-001-result.md`](phase-001-result.md) 已生成并冻结；没有开放 finding。
- 最终派生：pending delta 已按 RC-2-001–RC-2-003 重放到 effective requirements；change-2、有效需求、计划与阶段结果指纹均匹配。
- 里程碑交接：change-2 为 `completed/passed`，M0 没有活动纠正运行，可建立 M1 的独立 schema-v3 需求与实施工作流。

## 4. 已完成任务

| 任务 | 状态 | 结果 |
| --- | --- | --- |
| P-001-T-001 | completed | strict red-first：Domain 5 pass / 1 expected fail；Database 10 pass / 4 expected fail |
| P-001-T-002 | completed | Domain/Contracts/Database/API 生产闭环；定向 4 files / 34 tests、扩大 Domain 55 / Contracts 6 / Database 39、四包 typecheck 和 changed-area lint/format 通过 |
| P-001-T-003 | completed | 根 `pnpm check` passed；49 files / 229 tests passed；RC-2-003 与状态文档可最终派生；环境清理完成 |

## 5. 运行累计文件变化

| 文件 | 模式 | 所属 |
| --- | --- | --- |
| `execution/change-2/change-plan.md` | add | change-2 pending delta 与单阶段路线 |
| `execution/change-2/phase-001-plan.md` | add | P-001 strict compact 执行计划 |
| `execution/change-2/execution-state.md` | add | 当前可恢复执行状态 |
| `AGENTS.md` | modify | change-2 完成状态与 M1 交接 |
| `docs/12-prototype-preparation.md` | modify | M0 change-2 完成与当前路线图交接 |
| `packages/domain/src/task-graph.test.ts` | modify | 完成态 source Follow red-first 回归 |
| `packages/database/src/task-repository.integration.test.ts` | modify | Follow/Blocker 授权、影响与版本 red-first 回归 |
| `packages/domain/src/task-graph.ts` | modify | 拒绝完成/归档 source Follow |
| `packages/database/src/task-repository.ts` | modify | Follow 两端锁/授权/影响；Blocker Task 锁/授权/version 原子写 |
| `packages/contracts/src/tasks.ts` | modify | 内部 Follow/Blocker runtime command |
| `packages/contracts/src/domain-contracts.test.ts` | modify | 新 command 正负 Schema 验证 |
| `apps/api/src/modules/tasks/service.ts` | modify | Follow preview/change 与 Blocker add 内部应用入口 |
| `apps/api/src/modules/tasks/service.integration.test.ts` | modify | 应用组合、audit/outbox 与版本回归 |
| `execution/change-2/phase-001-result.md` | add | P-001 immutable completed/passed 结果 |
| `effective-requirements.md` | modify | 应用 RC-2-001–RC-2-003 后的当前产品权威 |
| `change-2.md` | add | immutable completed/passed 变更记录 |

## 6. 测试与验证证据

| 时间 | 范围 | 证据 | 结果 |
| --- | --- | --- | --- |
| 2026-07-28T02:21:44+08:00 | 历史、编号、指纹、工作区 | Git status/HEAD、SHA-256、change-0/change-1 completed state | pass；可预留 change-2 |
| 2026-07-28T02:31:19+08:00 | strict red-first Domain | `vitest run packages/domain/src/task-graph.test.ts` | 5 passed / 1 expected failed；完成态 source Follow 现状错误返回 `ok: true` |
| 2026-07-28T02:31:20+08:00 | strict red-first Database | PostgreSQL 17.10；`vitest run packages/database/src/task-repository.integration.test.ts --fileParallelism=false` | 10 passed / 4 expected failed；越权 Follow、无影响确认 Follow、越权 Blocker、陈旧版本 Blocker 均被旧实现放行 |
| 2026-07-28T02:38:09+08:00 | 首次定向 green | Domain/Contracts 12 passed；Database/API 20 passed / 1 test assertion failed | 实现行为已返回 stale impact 与最新 impact；测试由精确相等改为保留 recovery payload 的 partial match |
| 2026-07-28T02:40:43+08:00 | 扩大 affected packages | Domain、Contracts、Database、API package tests | Domain 55、Contracts 6、Database 39 passed；API 20 passed 后仅固定 C:\tmp fixture EPERM 阻塞 |
| 2026-07-28T02:44:54+08:00 | 最终定向 green | 4 个改动测试文件，PostgreSQL 17.10 | 4 files / 34 tests passed |
| 2026-07-28T02:45:00+08:00 | 静态与契约 | changed-area Prettier/ESLint；Domain/Contracts/Database/API typecheck | 全部 exit 0 |
| 2026-07-28T02:50:00+08:00 | 最终根门禁 | Node 24.18.0 / pnpm 11.9.0 / PostgreSQL 17.10；`pnpm check` | exit 0；format、lint、build、10 workspace typecheck；49 files / 229 tests passed，3 files / 7 tests intentionally skipped |
| 2026-07-28T02:54:00+08:00 | 环境清理 | PostgreSQL stop、listener/path/temp wrapper 检查 | listener 0；task-owned 临时目录/文件不存在 |

## 7. 决策、待确认问题与回答

| ID | 阶段/任务 | 问题 | 已确认事实 | 可选方案与影响 | 需要确认 | 状态 | 用户回答及来源 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Q-001 | planning | change-2 的交付策略 | schema 3.2 要求逐 run 显式选择 | strict 要求 red-first 且全部范围内验收阻塞；relaxed 允许合格 supplemental finding | 策略选择 | resolved | 用户“按照你的建议”采纳上一轮明确提出的严格 change-2 建议 |

没有未决问题。

## 8. 发现项、偏差、风险与阻塞

| ID | 类别 | 严重程度 | 关联需求/验收 | 观察与证据 | 最终功能影响 | 处置 | 置信度 | 建议后续 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 无 | 无 | 无 | 无 | 全部 strict core 与根门禁通过 | 无 | closed | 高 | 无 |

## 9. 完成后恢复与后续运行

1. 本运行已完成，不得改写 change plan、phase plan、phase result 或 `change-2.md`。
2. 重放时依次应用 requirements、change-0、change-1 与 change-2，并核对本状态记录的计划、阶段结果、有效需求和变更记录指纹。
3. 后续 M0 纠正必须预留连续的 `change-3`；M1 必须建立独立 schema-v3 需求目录和实施工作流。

## 10. 最终完成门禁

- P-001 的每个任务均有任务后检查点，且存在 completed/passed 的不可变 phase result。
- RC-2-001–RC-2-003 与全部关联 core 验收通过，无 waiver、未决问题或开放 `FND-C2-*`。
- Node 24/pnpm 11/PostgreSQL 17 下最终根 `pnpm check` 通过。
- `change-2.md`、更新后的 `effective-requirements.md`、completed state 和指纹重放一致。
- 没有公共路由、迁移或 M2 notification 实现越界，没有遗留任务服务或临时数据库。

以上门禁全部满足；change-2 结论为 `completed/passed`。
