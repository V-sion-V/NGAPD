# M0 授权与 Owner/Workspace 一致性修正计划

- 运行编号：`change-1`
- 运行类型：`completed feature corrective change`
- schema：`3.2`
- 交付与验证策略：`strict`
- 计划模式：`compact`
- 计划修订：`1`
- 项目基线：分支 `codex/m0-domain-baseline`，提交 `b0cdca996cbaeb62c2b52a3e63e28da75edcbf61`
- 计划日期：`2026-07-28`

## 1. 变更来源与目标

针对 M0 完成后复核发现的三个 core 缺口，在不改写 `requirements.md`、`implementation-plan.md`、`execution/initial/` 或 `change-0.md` 的前提下修正生产入口：

1. 显式 Owner 变化必须覆盖因继承而改变有效 Owner 的后代 Task Workspace，统一校验同步状态并在同一事务撤销旧租约。
2. 把 Task 移至虚拟项目根仍是 Task 结构操作；Project Owner 对虚拟根依赖作用域的普通模式控制权不能绕过被移动任务及影响集合的 Owner/admin 授权。
3. 内部 `TaskRepository.createTask` 在父任务下创建子任务时必须按父任务有效 Owner/admin 重新授权，不能只验证活动项目成员和 Owner 数据合法性。

## 2. 需求增量分类

| ID | 分类 | 关联当前需求 | 变更后的明确约束 |
| --- | --- | --- | --- |
| RC-001 | modify/clarify | FR-010、FR-017；AC-008、AC-014 | 移至虚拟根不属于 `projectRootOperation` 授权例外；只有依赖图操作可使用 Project Owner 的虚拟根作用域控制权，结构移动仍按完整 Task 影响集合授权。 |
| RC-002 | modify/clarify | FR-016、FR-022；AC-014、AC-016 | Owner 变化对所有因继承而改变有效 Owner 的任务执行 Workspace 同步版本校验、未提交状态检查、ownership-change 快照与旧租约撤销，并与显式 Owner 更新处于同一事务。 |
| RC-003 | modify/clarify | FR-017、FR-028；AC-020、AC-024 | 内部 Task 创建端口不是授权绕过入口；创建子任务要求父任务有效 Owner，或要求已经过上层签发的管理员模式能力。顶层任务创建行为保持不变。 |

这些增量不新增公共 HTTP 路由，不改变 Identity/Pairing/Workspace 已发布输入输出，也不改变 Project Owner 对虚拟根同级依赖的既有控制权。

## 3. 实现范围

### 生产代码

- `packages/database/src/task-repository.ts`
  - 对子任务创建复用生产授权决策。
  - 移除 move-to-root 对 `projectRootOperation` 的错误标记。
- `packages/database/src/task-lifecycle-repository.ts`
  - 计算实际继承 Owner 受影响集合。
  - 稳定锁定受影响 Task Workspace，校验每个同步版本及未提交状态。
  - 为受影响 Workspace 创建 ownership-change 快照并撤销旧租约。
- `packages/contracts/src/tasks.ts`
  - 将 Owner 变化命令扩展为完整受影响任务确认和逐 Workspace 同步事实。
- `apps/api/src/modules/tasks/service.ts`
  - 将已解析管理员会话事实传给底层创建端口。

### 测试

- `packages/database/src/task-repository.integration.test.ts`
  - 非父 Owner 不能从低层入口创建子任务；父 Owner 和管理员模式路径可执行。
  - Project Owner 在普通模式不能把他人任务移至虚拟根。
- `packages/database/src/task-lifecycle-repository.integration.test.ts`
  - Owner 变化覆盖继承后代，拒绝陈旧/未提交 Workspace，成功时原子创建快照并撤销目标与后代租约。
- 受契约变化影响的 Contracts/API 测试与类型检查。

## 4. 阶段路线

| 阶段 | 目标 | 前置 | 退出条件 | 状态 |
| --- | --- | --- | --- | --- |
| P-001 | 以回归测试先行修正三项授权与 Owner/Workspace 一致性缺口，并完成受影响门禁 | change-0 completed/passed；用户选择 strict；无活动 change run | 三组负向测试先稳定失败；生产修正后受影响测试、类型检查、构建和格式/静态门禁通过；无公共路由或兼容边界漂移 | ready |

## 5. 风险与控制

| 风险 | 控制 |
| --- | --- |
| Owner 变化遗漏显式 Owner 边界下不受影响的分支，或错误撤销其租约 | 只遍历显式 Owner 为空、实际继承目标 Owner 的后代；测试同时包含继承分支和显式 Owner 隔离分支。 |
| Owner 变化与 Workspace 写入并发导致半状态 | 受影响 Workspace 按稳定 ID 顺序加锁；同步版本、未提交状态、快照、Owner 更新和 lease revoke 位于一个 PostgreSQL 事务。 |
| move-to-root 修正误伤 Project Owner 的顶层依赖控制权 | 只修改 Task move 的授权上下文，不修改 dependency change 逻辑；运行现有图/移动回归。 |
| createTask 签名变化造成应用层未传递管理员事实 | 参数保持显式可选且默认关闭；应用服务传入服务端上下文，Database/API 类型检查阻塞。 |
| 用户并行修改被覆盖 | 当前 `README.md` 修改与未跟踪 `AGENTS.md` 视为用户工作，计划和实现均不编辑或归属它们。 |

## 6. 验证策略

`strict` 策略要求：

1. 先添加能够复现三项缺口的测试，并保存预期失败证据。
2. 修正后运行 Database 定向 PostgreSQL 集成测试、Contracts/API 受影响测试。
3. 运行 Domain、Contracts、Database、API 的 typecheck/build；运行 changed-area format/lint 与 `git diff --check`。
4. 可行时运行根 `pnpm check`。任何 core、类型、构建、格式、租户、授权或数据一致性失败均阻塞完成；本次不设置 report-only supplemental 门禁。
5. 使用 `.node-version` 指定的 Node.js 24 和 pnpm 11；真实 PostgreSQL 集成测试使用隔离、明确命名的临时数据库，结束后停止进程并清理任务自有临时路径。

## 7. 完成与恢复

- P-001 通过后生成不可变 `phase-001-result.md`、`change-1.md`，并把 `effective-requirements.md` 派生到 change-1。
- 任一 core 门禁未通过时保持 change-1 活动状态，不生成 `change-1.md`，并在 `execution-state.md` 记录精确恢复点。
- 不执行 commit、push、数据库 reset 到未知目标、租约 takeover 或公共发布。
