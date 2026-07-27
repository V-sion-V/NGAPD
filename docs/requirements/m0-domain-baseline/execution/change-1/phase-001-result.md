# change-1 P-001 阶段结果：授权与 Owner/Workspace 一致性修正

- 阶段：`P-001`
- 计划：[`phase-001-plan.md`](phase-001-plan.md) revision 1
- 交付与验证策略：`strict`
- 状态：`completed`
- 验证结论：`passed`
- 完成时间：`2026-07-28T01:53:00+08:00`

## 1. 完成概述

P-001 以测试先行关闭 RC-001–RC-003：

- Task 移至虚拟项目根不再标记为 `projectRootOperation`。Project Owner 对虚拟根依赖作用域的普通模式控制权不再错误放行他人 Task 结构移动；管理员模式路径保持可用。
- `TaskRepository.createTask` 在创建子任务时重新解析父 Task 有效 Owner，并复用生产授权决策；普通成员不能从低层入口在他人 Task 下创建子任务。应用服务把服务端解析的管理员会话事实传入 Repository。
- Owner 变化命令现在绑定完整后代确认、实际继承 Owner 受影响 Task 版本、逐 Workspace 同步版本和未提交状态。Repository 只穿过显式 Owner 为空的继承分支，稳定锁定受影响 Task/Workspace/lease，同事务递增版本、创建 ownership-change 快照、更新目标显式 Owner、撤销旧租约并写 audit/outbox。
- 具有独立显式 Owner 的后代分支仍进入完整影响确认，但不会被错误改写版本、创建快照或撤销租约。

没有新增公共路由、Schema migration、外部服务、Task UI、本地同步或 Agent 写入口；Identity/Pairing/Workspace 公共契约未改变。

## 2. 测试先行证据

### 红阶段

在生产修正前，Node.js `24.18.0`、pnpm `11.9.0`、PostgreSQL `17.10` 下运行两个 Database 集成测试文件：

- 16 tests：13 passed / 3 expected failed。
- 失败一：任意活动成员可从 Repository 在他人有效拥有的父 Task 下创建子任务。
- 失败二：Project Owner 普通模式可借 move-to-root 的 `projectRootOperation` 标记移动他人 Task。
- 失败三：Owner 变化忽略继承后代报告的未提交 Workspace 状态并错误提交成功。

三个失败均为目标缺口本身，没有环境、迁移或夹具失败。

### 绿阶段

- 两个定向 Database 集成文件：2 files / 16 tests passed。
- Contracts Owner-change runtime Schema 与 API Tasks application：2 files / 9 tests passed。
- Database 全包：7 files / 32 tests passed。
- Domain + Contracts + API 扩大回归：19 files / 79 tests passed。
- 最终根 `pnpm check`：退出 0；format、lint、build、10 workspace typecheck 与全 workspace tests 全部通过。
- 最终测试总计：59 files passed、3 files intentionally skipped；219 tests passed、7 tests intentionally skipped。

## 3. 原子性与边界证据

- Owner 变化测试包含目标、显式 Owner 为空的继承后代和独立显式 Owner 分支。
- 继承后代报告未提交变化时返回 `workspace_has_uncommitted_client_version`；逐 Workspace 版本漂移时返回 `workspace_version_conflict`，两者均保持前态。
- `after_lease` 故障注入在 Task 版本、目标显式 Owner、transition snapshot 和 lease revoke 已尝试后抛错；事务回滚后目标/继承后代仍为 version 1、快照为 0、两条旧 lease 仍活动。
- 成功路径中目标与继承后代均递增到 version 2、各生成一条 ownership-change snapshot、旧 lease 全部撤销；独立显式 Owner 分支保持 version 1、无新快照且 lease 仍活动。
- 子任务创建拒绝路径不消耗 Project `task_sequence`；父有效 Owner 与管理员模式路径分别得到连续 Task Key。
- move-to-root 普通模式拒绝后结构和 graph version 保持前态；同一确认在管理员模式下成功。

## 4. 文件修改

| 文件 | 修改 | 目的 |
| --- | --- | --- |
| `packages/database/src/task-repository.ts` | modify | 子任务创建父 Owner/admin 授权；move-to-root 不再使用虚拟根依赖控制例外 |
| `packages/database/src/task-repository.integration.test.ts` | modify | RC-001、RC-003 PostgreSQL 回归 |
| `packages/database/src/task-lifecycle-repository.ts` | modify | Owner 继承影响、版本/Workspace 确认、稳定锁、快照、版本递增与 lease revoke 原子协调 |
| `packages/database/src/task-lifecycle-repository.integration.test.ts` | modify | RC-002 未提交/陈旧/故障注入/成功及隔离分支回归 |
| `packages/contracts/src/tasks.ts` | modify | Owner-change 命令增加完整确认与逐资源版本事实 |
| `packages/contracts/src/domain-contracts.test.ts` | modify | 新 Owner-change runtime Schema 正负验证 |
| `apps/api/src/modules/tasks/service.ts` | modify | 把服务端管理员会话事实传入 createTask Repository |
| `docs/requirements/m0-domain-baseline/execution/change-1/*` | add/modify | change plan、状态、阶段计划与本不可变结果 |

## 5. 计划偏差与处置

- 首次红阶段中，move 测试使用显式 Owner 为空的子 Task，触发既有“顶层 Task 必须有显式 Owner”数据库约束；Owner 测试也取错了 `createUserWithWorkspace` 包装层。只修正测试夹具后重新执行红阶段，三项失败才作为正式证据。
- 首次扩大 Domain/Contracts/API 回归因沙箱拒绝固定 `C:\tmp\ngapd-workspace-sync-p004-server-objects` 目录而失败；在相同代码状态、已知测试目录和授权环境中重跑后 79/79 通过。
- 首次根命令发现 pnpm 子进程从 PATH 使用 Node `20.13.1`，虽构建成功但不作为证据。将 Node `24.18.0` 目录置于 PATH 首位后，重新运行 build、typecheck、test，并以最终单次 `pnpm check` 退出 0 封门。
- 最终差异审计将 Owner 变化的 Task 行锁从“实际继承写集合”扩大到“全部已确认后代”，避免显式 Owner 隔离分支在确认与提交间移动造成影响集合漂移；随后重新运行 Database 定向 16/16 与完整根 `pnpm check`，均退出 0。

这些偏差均已关闭，不改变 RC-001–RC-003、公共兼容或阶段边界。

## 6. Findings 与环境清理

| ID | 严重程度 | 状态 | 说明 |
| --- | --- | --- | --- |
| 无 | 无 | closed | 没有开放 core、supplemental 或 report-only finding |

- 隔离 PostgreSQL 只监听 `127.0.0.1:55437`，唯一测试数据库为 `ngapd_m0_change1`。
- 最终使用 `pg_ctl -m fast -w stop` 正常停止；端口 listener 为 0。
- 精确任务目录 `C:\tmp\ngapd-m0-change1-pg` 已删除且确认不存在。
- 用户并行修改的 `README.md`、`docs/12-prototype-preparation.md` 与未跟踪 `AGENTS.md` 未被编辑、覆盖或归属本 change run。

P-001 已完成且验证为 `passed`，允许生成 change-1 有效需求与最终记录。
