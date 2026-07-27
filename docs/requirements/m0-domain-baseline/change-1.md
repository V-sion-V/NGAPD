# M0：授权与 Owner/Workspace 一致性纠正记录

- 修改编号：`1`
- 修改类型：`corrective requirement change`
- 前一记录：[`change-0.md`](change-0.md)
- 变更计划：[`execution/change-1/change-plan.md`](execution/change-1/change-plan.md)
- 执行状态：[`execution/change-1/execution-state.md`](execution/change-1/execution-state.md)
- 阶段结果：[`execution/change-1/phase-001-result.md`](execution/change-1/phase-001-result.md)
- 项目基线：分支 `codex/m0-domain-baseline`，提交 `b0cdca996cbaeb62c2b52a3e63e28da75edcbf61`
- 完成日期：`2026-07-28`
- 交付与验证策略：`strict`
- 验证结论：`passed`

## 1. 变更概述

change-1 修正 M0 完成复核中发现的三个 core 授权/一致性缺口：

1. Task 移至虚拟项目根不再借用 Project Owner 的虚拟根依赖作用域控制权；普通模式仍按被移动 Task 与完整影响集合授权。
2. 显式 Owner 变化精确识别显式 Owner 为空、实际继承目标 Owner 的后代，在同一事务协调这些 Task 的版本、Workspace 同步事实、ownership-change 快照和旧 lease revoke。
3. 内部 `TaskRepository.createTask` 在父 Task 下创建子任务时重新解析父有效 Owner，并要求父 Owner 或服务端管理员会话；活动 Membership 本身不再足够。

修正没有开放公共 Project/Task CRUD、Task UI、本地同步或 Agent 写工具，也没有修改数据库 Schema、迁移编号、Identity/Pairing/Workspace 公共输入输出或虚拟根同级依赖的既有授权。

## 2. 需求增量

| ID | 分类 | 生效内容 | 关联需求/验收 | 状态 |
| --- | --- | --- | --- | --- |
| RC-001 | modify/clarify | move-to-root 是 Task 结构操作，不是虚拟根依赖操作；Project Owner 普通模式不能绕过受影响 Task Owner/admin。 | FR-010、FR-017；AC-008、AC-014 | implemented/verified |
| RC-002 | modify/clarify | Owner 变化确认全部后代，并对实际继承受影响分支逐 Task/Workspace 校验版本与未提交状态，同事务递增版本、写快照和撤销 lease。 | FR-016、FR-022；AC-014、AC-016 | implemented/verified |
| RC-003 | modify/clarify | 内部子任务创建端口重新校验父有效 Owner/admin；拒绝不消耗 Task Sequence。 | FR-017、FR-028；AC-020、AC-024 | implemented/verified |

原始 FR-001–FR-028、AC-001–AC-029 均继续生效，没有 add/delete delta。

## 3. 实现结果

### 3.1 子任务创建授权

- `TaskRepository.createTask` 在已有 Membership/ownership 数据合法性检查后，解析父 Task 当前有效 Owner。
- 父有效 Owner可在普通模式创建子 Task；其他成员必须消费服务端管理员会话事实。
- 授权发生在 Project Sequence 更新前，拒绝不会消耗 Task Key。
- `TaskApplicationService` 显式传入 `adminModeActive` 和 Agent 管理员会话来源事实。

### 3.2 move-to-root 授权

- `TaskRepository.moveTask` 的 `projectRootOperation` 固定为 `false`。
- 该改动只作用于 Task move；Dependency Graph 中 Project Owner 对虚拟根顶层同级依赖的普通模式控制权未修改。
- Project Owner 移动他人 Task 到根时，普通模式返回 `forbidden`，管理员模式仍可在完整影响确认与版本条件成立时执行。

### 3.3 Owner/Workspace 原子协调

- Owner-change command 增加：
  - `confirmedTaskIds`
  - `expectedAffectedTaskVersions`
  - `expectedAffectedWorkspaceSyncVersions`
  - `uncommittedWorkspaceTaskIds`
- Repository 遍历全部后代作影响确认，但遇到非空显式 Owner 后停止把该分支计入 Owner/Workspace 写集合。
- 全部已确认后代 Task 行与实际继承受影响 Workspace/lease 按稳定 ID 加锁；Task/Workspace 版本、冻结、未提交状态与授权在写入前复核。
- 成功时目标及继承后代 Task 版本递增，各自产生 ownership-change snapshot；只有目标 Task 的显式 Owner 字段改变。旧 lease、audit、outbox 和幂等结果与上述写入同处一个事务。
- Outbox payload 包含受影响 Task IDs 与新版本映射，使后续投影可精确失效。

## 4. 文件修改

| 文件 | 修改模式 | 主要目的 |
| --- | --- | --- |
| `packages/database/src/task-repository.ts` | modify | child create 授权；move-to-root 授权修正 |
| `packages/database/src/task-repository.integration.test.ts` | modify | RC-001/RC-003 真实 PostgreSQL 回归 |
| `packages/database/src/task-lifecycle-repository.ts` | modify | Owner 继承影响与 Task/Workspace/lease 原子协调 |
| `packages/database/src/task-lifecycle-repository.integration.test.ts` | modify | RC-002 陈旧、未提交、故障注入、成功与隔离分支回归 |
| `packages/contracts/src/tasks.ts` | modify | 完整 Owner-change runtime command |
| `packages/contracts/src/domain-contracts.test.ts` | modify | 新命令 Schema 正负验证 |
| `apps/api/src/modules/tasks/service.ts` | modify | 传递服务端管理员会话事实 |
| `docs/requirements/m0-domain-baseline/effective-requirements.md` | modify | 派生应用至 change-1 的当前权威 |
| `docs/requirements/m0-domain-baseline/execution/change-1/*` | add | change plan、阶段计划、执行状态与不可变阶段结果 |
| `docs/requirements/m0-domain-baseline/change-1.md` | add | 本纠正实现记录 |

用户并行修改的 `README.md`、`docs/12-prototype-preparation.md` 与未跟踪 `AGENTS.md` 不属于本记录，未被 change-1 编辑或归属。

## 5. 测试与验证

- strict 红阶段：两个 Database 文件共 16 tests，13 passed / 3 expected failed；三项失败精确对应 RC-001–RC-003。
- 修正后定向 Database：2 files / 16 tests passed。
- Contracts + API 定向：2 files / 9 tests passed。
- Database 全包：7 files / 32 tests passed。
- 最终根 `pnpm check`：Node.js `24.18.0`、pnpm `11.9.0`、PostgreSQL `17.10`；format、lint、build、10 workspace typecheck 与全 workspace tests 全部退出 0。
- 最终测试统计：59 files passed、3 files intentionally skipped；219 tests passed、7 tests intentionally skipped。
- 原子性：Owner-change `after_lease` 故障注入完整回滚 Task 版本、显式 Owner、transition snapshots 与 lease revocations。
- 清理：PostgreSQL `127.0.0.1:55437` 已正常停止，listener 为 0；任务目录 `C:\tmp\ngapd-m0-change1-pg` 已删除。

阶段结果 SHA-256：`e6c173e55b2411a7f56f6e126a33dca49af5629a7692ad4be1ce027e57a4d657`。

## 6. Findings 与遗留事项

| ID | 严重程度 | 关联项 | 状态 | 说明 |
| --- | --- | --- | --- | --- |
| 无 | 无 | 无 | closed | 全部 change-1 core 和根门禁通过；没有 report-only finding |

没有开放 `FND-C1-*`、未决产品决策、迁移半状态、活动服务或任务临时环境。M0 当前有效需求已派生到 [`effective-requirements.md`](effective-requirements.md)，SHA-256 `3b16d6596a178b7d518149f8b21561a2342f4c47f0498f7f387fe22a7aef9485`。

后续产品变化必须创建连续的 `change-2`，不得改写本记录、change-0、原始需求、initial roadmap 或已完成阶段结果。
