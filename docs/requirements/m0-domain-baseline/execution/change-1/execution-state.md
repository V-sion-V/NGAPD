# M0 change-1 执行状态

- 运行编号：`change-1`
- 运行类型：`corrective requirement change`
- 目标记录：`change-1.md`
- schema：`3.2`
- 运行状态：`completed`
- 交付与验证策略：`strict`
- 验证结论：`passed`
- 变更计划：[`change-plan.md`](change-plan.md) revision 1，SHA-256 `4f81dc584b9cec6fed4f1d84904b16f4bd26556214ae851bbd2b322a9d67eb76`
- 当前阶段：`P-001`
- 当前阶段计划：[`phase-001-plan.md`](phase-001-plan.md) revision 1，SHA-256 `2da98384c52e1030187fd565f16dae4e5bd327377216415870bf655b6c431e58`
- 当前任务：无（change-1 已完成）
- 下一发现项编号：`FND-C1-001`
- 项目基线：分支 `codex/m0-domain-baseline`，提交 `b0cdca996cbaeb62c2b52a3e63e28da75edcbf61`
- 最后更新时间：`2026-07-28T01:53:00+08:00`

## 1. 运行目标

完成 RC-001–RC-003：

- move-to-root 不得借虚拟根依赖作用域控制权绕过 Task 结构授权；
- Owner 变化必须原子处理实际继承 Owner 受影响后代的 Workspace、同步事实、快照与 lease；
- 内部子任务创建端口必须重新校验父任务有效 Owner/admin。

## 2. 历史与基线审计

- `workflow-contract.md` 为 schema `3.2`。
- `change-0.md`、`effective-requirements.md` 与 `execution/initial/execution-state.md` 均为 `completed/passed`，编号历史连续且无活动 change run。
- 下一连续编号为 `change-1`；本目录创建即完成预留。
- 原始需求 SHA-256：`844c505f9c6b15ae64f217026ba27c7c6ac22dd394f0ce80112a43960a8037d1`。
- change-0 前有效需求 SHA-256：`69959b7bcf8303e22c49d1278c3e103d9e9598e421147e3ccd1e07ac41a9d728`。
- change-0 SHA-256：`16674766402841e287af63fc1119661ec593ea96bfdabe5efe87c18168c0d7ed`。
- 用户显式选择本 change run 使用 `strict`。

## 3. 阶段状态

| 阶段 | 计划 | 状态 | 结果 |
| --- | --- | --- | --- |
| P-001 | [`phase-001-plan.md`](phase-001-plan.md) revision 1 | completed | [`phase-001-result.md`](phase-001-result.md)，SHA-256 `e6c173e55b2411a7f56f6e126a33dca49af5629a7692ad4be1ce027e57a4d657` |

## 4. 当前检查点

- P-001-T-001：两个 Database 集成测试文件新增三项最小回归；红阶段 16 tests 中 13 passed、3 expected failed，精确对应 RC-001–RC-003。
- P-001-T-002：Repository/Contracts/API 修正完成；Owner 变化覆盖实际继承后代的 Task/Workspace 版本、未提交状态、快照与 lease revoke，并通过 `after_lease` 故障注入回滚。
- P-001-T-003：定向、扩大与最终根门禁全部通过；[`phase-001-result.md`](phase-001-result.md) 已封存。
- 最终有效需求：[`../../effective-requirements.md`](../../effective-requirements.md)，SHA-256 `3b16d6596a178b7d518149f8b21561a2342f4c47f0498f7f387fe22a7aef9485`。
- 最终变更记录：[`../../change-1.md`](../../change-1.md)，SHA-256 `b1c4e91a581f30d3a63917078083bab6d9f052d476844a9d26e6bb9a5d8797bf`。
- 当前存在不属于本 change run 的用户工作：已修改 `README.md`、`docs/12-prototype-preparation.md`，未跟踪 `AGENTS.md`。三者均完整保留且不计入 change-1。

## 5. 验证记录

| 时间 | 范围 | 命令/证据 | 结果 |
| --- | --- | --- | --- |
| 2026-07-28T01:12:34+08:00 | 历史、编号、工作区、工具链 | change-0/effective/initial 审计；`git status --short`；`node --version`；`pnpm --version` | 历史通过；用户工作已隔离；Node 20 不可作为验证证据 |
| 2026-07-28T01:20:43+08:00 | strict red-first | Vitest：`task-repository.integration.test.ts` + `task-lifecycle-repository.integration.test.ts`，PostgreSQL 17.10 | 13 passed / 3 expected failed：child create 被错误放行；move-to-root 被错误放行；继承后代未提交 Workspace 被忽略 |
| 2026-07-28T01:24:21+08:00 | strict green targeted | 同两个 Database 集成文件 | 2 files / 16 tests passed |
| 2026-07-28T01:26:47+08:00 | Contracts/API 定向 | Contracts runtime command + Tasks application integration | 2 files / 9 tests passed |
| 2026-07-28T01:26:56+08:00 | Database 全包 | PostgreSQL migrations/profile/repositories/outbox/lifecycle | 7 files / 32 tests passed |
| 2026-07-28T01:28:06+08:00 | Domain/Contracts/API 扩大回归 | 授权、契约、应用与公共兼容 | 19 files / 79 tests passed |
| 2026-07-28T01:48:36+08:00 | 最终锁集合定向复验 | 全部确认后代 Task 行锁；两个 Database 集成文件 | 2 files / 16 tests passed |
| 2026-07-28T01:49:00+08:00 | 最终根门禁 | Node 24.18.0 / pnpm 11.9.0 / PostgreSQL 17.10；`pnpm check` | exit 0；format、lint、build、10 workspace typecheck；59 files/219 tests passed，3 files/7 tests intentionally skipped |
| 2026-07-28T01:53:00+08:00 | 环境清理 | `pg_ctl -m fast -w stop`；端口/路径复核 | listener 0；`C:\tmp\ngapd-m0-change1-pg` 不存在 |

## 6. Findings

| ID | 严重程度 | 关联项 | 状态 | 说明 |
| --- | --- | --- | --- | --- |
| 无 | 无 | 无 | closed | 全部 strict core 与根门禁通过，没有 report-only finding |

## 7. 恢复说明

change-1 已完成，不再从本状态恢复执行。后续变化必须从 [`../../effective-requirements.md`](../../effective-requirements.md) 与连续 `change-2` 开始；不得改写本状态、计划、阶段结果、change-1 或更早历史。
