# change-1 P-001：授权与 Owner/Workspace 一致性修正

- 阶段：`P-001`
- 计划修订：`1`
- 详细度：`compact`
- 交付与验证策略：`strict`
- 状态：`ready`
- 前置：change-0 `completed/passed`；change-1 计划已批准；工作区仅有不重叠的用户 `README.md`/`AGENTS.md` 变化

## 1. 阶段目标

用一个测试先行的原子阶段关闭 RC-001–RC-003，使 Database 低层入口与正式授权和 Workspace 一致性规则一致，同时保持公共兼容边界与虚拟根依赖授权不变。

## 2. 顺序任务

| 任务 | 内容 | 完成条件 |
| --- | --- | --- |
| P-001-T-001 | 在 Database PostgreSQL 集成测试中加入三项最小失败用例；必要时同步 Contracts/API 编译夹具 | 未修改对应生产逻辑前，新测试因既有缺口失败，失败原因与 RC-001–RC-003 一一对应 |
| P-001-T-002 | 修正 create child、move-to-root 与 Owner-change 原子协调；同步内部命令契约和应用层传参 | 定向测试由红转绿；Owner 继承边界、逐 Workspace 版本/未提交检查、快照和 lease revoke 都有断言 |
| P-001-T-003 | 运行受影响测试、类型/构建、格式/静态和根级回归，审查差异并封存 change-1 | 全部 core 门禁通过，无越界文件、公共路由/契约回归或开放 finding |

## 3. 测试设计

### RC-001：move-to-root

- 创建 Project Owner 与另一 Task Owner。
- 由另一 Owner 拥有的子任务尝试被 Project Owner 在普通模式移至虚拟根。
- 现状应错误放行；修正后返回 `forbidden`，开启有效管理员模式后才允许。

### RC-002：Owner/Workspace

- 建立目标 Task、显式 Owner 为空的继承后代，以及具有独立显式 Owner 的隔离分支。
- 为目标、继承后代和隔离分支分别创建活动 lease。
- 陈旧后代 Workspace 版本或报告未提交变化时整个操作失败，Task Owner、快照和全部 lease 保持前态。
- 完整确认后只处理目标与继承后代：目标显式 Owner 更新；二者创建 ownership-change 快照并撤销 lease；隔离分支不创建快照且 lease 保持活动。

### RC-003：create child

- 普通成员直接调用 Repository 在他人有效拥有的父任务下创建子任务必须失败，且不消耗 Task Sequence。
- 父任务有效 Owner 可创建；管理员模式可创建。
- 顶层任务创建与既有幂等/Task Key 行为保持通过。

## 4. 文件所有权

允许修改：

- `packages/database/src/task-repository.ts`
- `packages/database/src/task-lifecycle-repository.ts`
- `packages/database/src/task-repository.integration.test.ts`
- `packages/database/src/task-lifecycle-repository.integration.test.ts`
- `packages/contracts/src/tasks.ts`
- `packages/contracts/src/domain-contracts.test.ts`
- `apps/api/src/modules/tasks/service.ts`
- `apps/api/src/modules/tasks/service.integration.test.ts`
- 本 change-1 目录、`effective-requirements.md` 和最终 `change-1.md`

除非验证直接证明必要，不修改迁移、公共路由、Workspace 公开 DTO、Domain 授权算法、Worker、Web、CLI、Compose、初始历史或 `change-0.md`。用户的 `README.md` 与 `AGENTS.md` 不属于本阶段。

## 5. 阶段门禁

- 红阶段：三个 Database 集成回归测试在旧实现上按预期失败。
- 绿阶段：
  - Database 两个定向 integration test 文件通过。
  - Contracts 与 API 受影响测试通过。
  - Domain、Contracts、Database、API typecheck/build 通过。
  - changed-area Prettier/ESLint、`git diff --check` 通过。
  - 根 `pnpm check` 在最终代码状态通过。
- 环境：Node.js 24、pnpm 11、隔离 PostgreSQL 17；任务自有服务和临时数据在结束时清理。

## 6. 暂停条件

- 无法取得隔离 PostgreSQL 17 或正确 Node 24，导致 strict core 证据不可执行。
- 新测试揭示需要修改公共 HTTP、Schema migration 或超出 RC-001–RC-003 的产品决策。
- 发现与用户并行改动重叠。
- 任一 core 门禁失败且无法在本阶段范围内安全修复。
