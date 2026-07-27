# M0 initial run：P-001 阶段结果

- 运行编号：`initial`
- 阶段：`P-001`
- 阶段计划：[`phase-001-plan.md`](phase-001-plan.md)
- 阶段计划修订：`1`
- 父路线图修订：`1`
- 完成日期：`2026-07-27`
- 状态：`completed`
- 交付与验证策略：`relaxed`
- 验证结论：`passed`
- 开始基线：分支 `codex/m0-domain-baseline`，提交 `7f23d31592c72e258efa613a73ea862b9e0f0289`；requirements/contract 为用户已有未跟踪输入，其他项目文件干净
- 结束基线：同一未提交工作树；P-001 文件清单如下，未提交、推送、重置、stash 或改写用户 requirements/contract

## 1. 阶段目标与结果

P-001 已建立 M1/M2 和后续 M0 阶段可以消费的生产领域与共享契约基线：

- Project Key 只接受 2–6 位大写字母；Task Key 由规范 Project Key 与正整数 Sequence 组成，非规范别名和 Project Key 变更返回稳定拒绝。
- 同项目邻接树、祖先/后代、移动预检、顶层活动显式 Owner、最近活动显式 Owner 解析和完成前 Owner 固化意图均由纯生产接口表达。
- 虚拟项目根与普通父任务使用同一 DAG 校验；依赖直接修改、单端 Owner 请求、另一端接受、Owner/版本变化 stale、完成端点冻结和一跳关注均有稳定结果。
- `not_started / in_progress / done` 基础状态与派生 `blocked`、完成资格、完成原子计划、冻结、`deny / cascade` 重开闭包和跨 Owner 确认均已形成生产领域契约。
- 移动、归档、删除、Owner 变化、级联重开和关注变化可以产生稳定排序的影响集合，覆盖后代、依赖、状态候选、已完成祖先、租约、未同步版本和图作用域。
- Workspace 读取/写入、Agent 额外意图、Task 操作租户/Owner/admin 授权和 Task/Workspace 完成、重开、Owner 变化同事务端口已独立表达；确认不能替代授权。
- Contracts 已固定正式 Project/Task TypeBox Schema、独立归档、图/依赖请求/影响 DTO 与稳定错误目录；Identity、Pairing、Workspace 已发布 Schema 文件未改变。
- Test Fixtures 新增深度 20、200 同级 DAG 和 5,000 活动任务的确定性输入，并直接使用生产 Domain 验证；原型 fixture 语义未改变。
- 没有新增 Project/Task 公共 CRUD、正式 Task UI、本地 Workspace 同步或 Agent 写工具，也没有客户端导入服务端 Domain/Database。

P-001 只证明纯领域、运行时契约、固定规模输入和受影响公共兼容。数据库唯一性/不可复用、真实 PostgreSQL 锁与事务、应用服务原子协调、完整 HTTP/Worker/SSE、Compose 和最终平台门禁仍由 P-002–P-004 所有。

## 2. 任务、需求与验收覆盖

| 任务 | 状态 | 需求与验收 | 完成结果 |
| --- | --- | --- | --- |
| `P-001-T-001` | completed | FR-003、FR-005–FR-006 / P-001 范围的 AC-002、AC-004 | 正式标识、同项目邻接树、移动预检、顶层/继承 Owner、异常链和完成 Owner 固化意图完成 |
| `P-001-T-002` | completed | FR-007、FR-009、FR-011–FR-017、FR-023 / P-001 范围的 AC-005–AC-007、AC-009–AC-016、AC-020、AC-025–AC-026 | DAG、依赖接受/stale、关注、状态/冻结/重开、影响、服务端事实授权和 Workspace 生命周期端口完成 |
| `P-001-T-003` | completed | FR-018–FR-019、FR-024–FR-026、FR-028 / P-001 范围的 AC-017、AC-020、AC-024–AC-026 | TypeBox/TS 契约、稳定错误目录、固定规模 fixture、公共兼容和范围负向证据完成 |

阶段验收结论：

- P-001 关联的纯领域和共享契约 core 结果全部通过生产接口直接验证。
- AC-002 的数据库全局唯一/归档不释放、AC-006 的事务性图版本、AC-007/AC-011–AC-016 的持久化和跨模块原子性、AC-017 的完整 HTTP 映射、AC-025/AC-026 的最终运行环境仍按路线图在后续阶段完成；本结果不把纯领域证据扩大为这些最终门禁。
- 公共兼容硬门禁由未变契约哈希、无应用 diff、API 定向 3/3 和 CLI 定向 16/16 独立证明。

## 3. 文件修改

| 文件 | 修改模式 | 主要目的 |
| --- | --- | --- |
| `packages/domain/src/identifiers.ts` | add | Project/Task Key、Sequence 与 Project Key 不可变规则 |
| `packages/domain/src/identifiers.test.ts` | add | 标识规范与拒绝测试 |
| `packages/domain/src/task-tree.ts` | add | 同项目邻接树、遍历和移动预检 |
| `packages/domain/src/task-tree.test.ts` | add | 树异常、移动和稳定遍历测试 |
| `packages/domain/src/task-owner.ts` | modify | 顶层 Owner 不变量和完成 Owner 固化意图 |
| `packages/domain/src/task-owner.test.ts` | modify | Owner 不变量与固化测试 |
| `packages/domain/src/task-graph.ts` | add | 同级 DAG、依赖请求/接受和关注 |
| `packages/domain/src/task-graph.test.ts` | add | 根/普通作用域、权限、stale、冻结和 200 节点测试 |
| `packages/domain/src/task-lifecycle.ts` | add | 状态、完成、冻结和重新打开 |
| `packages/domain/src/task-lifecycle.test.ts` | add | 完成/冻结与跨 Owner 重开测试 |
| `packages/domain/src/task-impact.ts` | add | 确定性操作影响集合与确认令牌 |
| `packages/domain/src/task-impact.test.ts` | add | 影响覆盖、深度 20 和乱序稳定测试 |
| `packages/domain/src/workspace-lifecycle.ts` | add | Task/Workspace 同事务生命周期端口 |
| `packages/domain/src/workspace-lifecycle.test.ts` | add | 完成、重开和 Owner 变化端口测试 |
| `packages/domain/src/authorization.ts` | modify | 用户 Workspace 只读、Agent 意图和 Task 操作授权 |
| `packages/domain/src/authorization.test.ts` | modify | 租户、确认、admin 与 Agent 权限负向测试 |
| `packages/domain/src/index.ts` | modify | 导出正式领域能力 |
| `packages/contracts/src/projects.ts` | modify | 正式 Project Key、生命周期、策略与版本 Schema |
| `packages/contracts/src/tasks.ts` | modify | 正式 Task 状态/归档、图、依赖请求和影响 Schema |
| `packages/contracts/src/errors.ts` | modify | 稳定 M0 领域/应用错误目录 |
| `packages/contracts/src/domain-contracts.test.ts` | add | TypeBox 运行时和错误目录测试 |
| `packages/contracts/package.json` | modify | 增加限定 `src` 的测试脚本 |
| `packages/contracts/tsconfig.json` | modify | 构建排除测试源文件 |
| `packages/test-fixtures/src/m0-domain.ts` | add | M0 固定规模确定性输入 |
| `packages/test-fixtures/src/m0-domain.test.ts` | add | 生产 Domain 对固定规模 fixture 的直接验证 |
| `packages/test-fixtures/src/index.ts` | modify | 导出 M0 fixture |

## 4. 测试与验证

全部通过证据使用 Node.js `24.14.0`、pnpm `11.9.0`；该运行时满足根 `engines` 的 Node 24/pnpm 11 范围。

| 命令或检查 | 观察结果 | 结论 |
| --- | --- | --- |
| `pnpm --filter @ngapd/domain test` | 11 个测试文件、54 项测试通过 | Domain core passed |
| `pnpm --filter @ngapd/contracts test` | 1 个测试文件、3 项测试通过 | Contracts runtime passed |
| `pnpm --filter @ngapd/test-fixtures test` | 6 个测试文件、40 项测试通过 | 固定规模 fixture passed |
| 三包 `typecheck` | Domain、Contracts、Test Fixtures 全部通过 | 类型/导出 passed |
| 三包 `build` | Domain、Contracts、Test Fixtures 全部通过 | 可消费构建 passed |
| API `src/app.test.ts` | 1 个文件、3 项测试通过 | `/api/v1`/health/request ID 定向兼容 passed |
| CLI `cli/http/mcp` 定向测试 | 3 个文件、16 项测试通过 | 受影响 CLI 契约兼容 passed |
| Identity/Pairing/Workspace 文件 SHA-256 | 与任务前完全一致 | 已发布共享 Schema 未改变 |
| 客户端导入与应用 diff | Web/CLI/Workspace Core 无 Domain/Database 导入；API/Web/CLI/Workspace Core/Object Store 无代码变化；无新路由 | 依赖方向与范围负向 passed |
| Changed-area Prettier / `git diff --check` | 通过 | 格式与补丁结构 passed |
| 调试/临时产物检查 | 无 console debug、debugger、TODO/FIXME、秘密、本地配置或 Contracts 测试构建残留 | 清洁度 passed |

额外宽检查没有被当作通过证据：

- API 完整 package 测试观察到 3 项非数据库测试通过，9 项因既有 `DATABASE_TEST_URL` 条件跳过；未声称数据库集成套件通过。
- Workspace CLI 完整 package 测试观察到 17 项通过、5 项因固定 `C:\tmp` 写入和 PasswordVault 宿主不可用失败、10 项跳过。相关代码和 Workspace 契约未修改，定向 16 项独立通过；完整 Windows 平台门禁仍由 P-004 所有。

## 5. 发现项与处置

当前无正式 `FND-I-*`。

| ID | 类别 | 严重程度 | 关联需求/验收 | 观察与证据 | 最终功能影响 | 处置 | 置信度 | 建议后续 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |

## 6. 决策、计划偏差与恢复记录

- 无产品、范围、验收层级或阶段边界偏差。
- 技术偏差：Contracts 初次构建将新测试编译到 `dist`，Vitest 拾取陈旧副本。任务内把测试发现限定到 `src`、tsconfig 排除测试源并删除三个可再生测试构建文件；随后 Contracts test/typecheck/build 通过。
- 环境事实：Codex 隔离 Node 24.14.0 满足根引擎范围，但 `.node-version` 为 24.18.0；P-004 最终发布门禁仍需在仓库锁定版本复核。
- Workspace CLI 额外宽测试的固定临时目录/PasswordVault 宿主失败是未改动平台门禁的环境偏差；没有用它宣称完整套件通过，也没有为了 P-001 扩大修复范围。
- 三个任务均在生产编辑前和验证后写入持久检查点；没有中断、暂停、阻塞、用户工作重叠、数据库/外部写入或恢复操作。

## 7. 遗留风险与下一阶段进入条件

- P-002 必须把 P-001 纯领域契约落到正式破坏性重建、SQL 约束、Repository、递归 CTE、稳定图锁、幂等 Sequence 与 Task/Workspace 真实事务，并在隔离 PostgreSQL 17 验证。
- P-003 必须组合应用模块、完整错误/审计/Outbox/Worker/SSE/Workspace 适配并继续保护 Identity/Workspace 公共兼容。
- P-004 必须在 `.node-version` 锁定运行时完成根门禁、数据库、Compose、精确性能、安全、无外部网络和真实平台最终验收。
- 下一阶段尚无详细计划。只有 `$plan-feature-implementation` 可以基于本不可变结果和当前项目事实创建 P-002 计划；实施技能不得自行进入下一阶段。
