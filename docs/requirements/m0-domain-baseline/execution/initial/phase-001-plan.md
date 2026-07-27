# P-001：生产领域与共享契约基线阶段计划

- 运行编号：`initial`
- 阶段编号：`P-001`
- 阶段计划修订：`1`
- 父路线图修订：`1`
- 父路线图指纹（SHA-256）：`eb90885df1246062d407f9284e015de0e0521d93e0e00f35ab5debc21af366ad`
- 需求指纹（SHA-256）：`844c505f9c6b15ae64f217026ba27c7c6ac22dd394f0ce80112a43960a8037d1`
- 项目基线：分支 `codex/m0-domain-baseline`，提交 `7f23d31592c72e258efa613a73ea862b9e0f0289`；需求目录为规划前已存在的未跟踪用户工作，其他项目文件干净
- 创建日期：2026-07-27
- 计划详细度：`expanded`
- 交付与验证策略：`relaxed`
- 验证结论：`pending`

## 1. 阶段目标、边界与关联需求

本阶段把 Project/Task 标识、任务树与有效 Owner、同级 DAG 与依赖接受、关注、基础/有效状态、完成冻结、重新打开、确定性影响集合、服务端事实授权、Workspace 生命周期协调端口和统一错误目录落到生产共享包，并使 M1/M2 能复用这些能力。

关联范围为路线图 P-001 行：FR-003、FR-005–FR-019、FR-023–FR-026、FR-028，以及 AC-002、AC-004–AC-007、AC-009–AC-014、AC-017、AC-020、AC-024–AC-026。P-001 只形成纯领域和共享契约证据；真实 PostgreSQL 锁、迁移、跨模块事务、HTTP/Worker/SSE 和最终规模/安全门禁分别由 P-002–P-004 完成。

阶段边界：

- 不修改数据库 Schema、迁移或 Repository。
- 不注册新的 Project/Task 公共 HTTP CRUD，不实现正式 Task UI、本地 Workspace 同步或 Agent 写工具。
- 不改变 Identity、Pairing、Workspace 已发布 TypeBox Schema 和路由输入输出。
- 不把原型 fixture、UI 文本或测试帮助函数作为生产规则权威。

## 2. 任务与文件范围

### 2.1 前置条件与接口约束

- 执行前切换到 `.node-version` 指定的 Node.js 24；Node 20 的结果不得作为阶段通过证据。
- 重查 Git 状态；若 `packages/domain`、`packages/contracts` 或 `packages/test-fixtures` 出现规划后用户修改且与任务重叠，先暂停并记录所有权问题。
- 新领域 API 使用确定性的 discriminated union 或等价稳定结果，失败码可以无歧义进入共享错误目录；纯领域模块不得导入数据库、Fastify、Web 或 CLI。
- 输入集合不依赖调用方顺序；影响集合、闭包和诊断按稳定 ID/Key 顺序输出，便于后续幂等、确认和审计。
- `packages/contracts` 保持 TypeBox 运行时/静态类型单一来源；正式 Task 基础状态与归档生命周期分离。

### 2.2 任务

| 任务 | 结果 | 文件或范围 | 实现摘要 | 验证 | 完成条件 |
| --- | --- | --- | --- | --- | --- |
| P-001-T-001 | 正式标识、任务树和有效 Owner 领域契约 | `packages/domain/src/identifiers*`、`task-tree*`、`task-owner*`、`index.ts` | 建立 Project Key/Task Key/Sequence 规则、同项目邻接树校验、祖先/后代解析、顶层 Owner 和最近活动显式 Owner 解析；覆盖孤儿、跨项目、循环、失活/缺失 Owner 与完成前 Owner 固化输入 | Domain 定向测试、类型检查、构建 | 合法结果确定；全部异常返回稳定诊断；生产接口不依赖 fixture；现有 Workspace/Pairing 领域测试不回归 |
| P-001-T-002 | 正式同级图、状态/冻结/重新打开、影响与授权领域契约 | `packages/domain/src/task-graph*`、`task-lifecycle*`、`task-impact*`、`authorization*`、`workspace-lifecycle*`、`index.ts` | 实现虚拟根/普通父级统一 DAG 校验、依赖请求事实与 stale 判定、关注一跳语义、blocked/完成资格、冻结 guard、deny/cascade 闭包、确定性影响集合，以及使用服务端 Membership/Owner/admin/租约事实的授权与 Workspace 协调端口 | Domain 定向测试，含稳定顺序、权限负向路径、深度 20 与 200 同级主体夹具；类型检查、构建 | 树/图/状态操作保持不变量；确认不能替代授权；关注不改变其他事实；完成/重新打开端口表达原子前置与结果且不实现本地物化 |
| P-001-T-003 | 正式共享运行时 Schema、错误目录和可复用确定性夹具 | `packages/contracts/src/projects*`、`tasks*`、`errors*`、必要的新内部契约文件、`index.ts`；`packages/test-fixtures/src/m0-domain*`、`index.ts`；对应 package 配置 | 把 Project Key 收敛为 2–6 位大写字母，把 Task 基础状态收敛为 `not_started / in_progress / done` 并分离归档；增加图、版本、冻结、陈旧请求与影响确认错误码/内部 DTO；新增只生成输入的 M0 夹具，保留原型 fixture 兼容 | Contracts 运行时 Schema 测试；fixtures 确定性/规模测试；Domain、Contracts、Test Fixtures 的测试、类型检查和构建 | TypeBox 运行时与 TS 类型一致；Identity/Workspace Schema 未改变；客户端依赖方向不越界；共享索引完整；P-001 全部定向门禁通过 |

依赖顺序：P-001-T-002 依赖 P-001-T-001 的树、Owner 和标识结果；P-001-T-003 依赖前两项的稳定枚举与失败目录。每项完成验证并写入执行状态后才能开始下一项。

### 2.3 文件所有权与暴露接口

| 范围 | 本阶段用途 | 不允许的耦合 |
| --- | --- | --- |
| `packages/domain/src/*.ts` | 生产规则、稳定结果、纯算法与端口类型 | Kysely/SQL、Fastify、React、Node 文件系统、原型 JSON |
| `packages/contracts/src/*.ts` | TypeBox Schema、序列化 DTO、公共/内部稳定错误码 | 领域服务实现、Repository、应用容器 |
| `packages/test-fixtures/src/m0-domain*.ts` | 固定种子、深度/宽度/图输入和测试适配 | 成为规则权威或改变现有原型 fixture 语义 |
| 现有 Identity/Pairing/Workspace 契约 | 兼容对照，只在共享导出确有需要时最小改动 | 输入输出重命名、字段删除或语义漂移 |

## 3. 验证与完成条件

在所有实现完成后的最新有效状态执行以下一次性阶段门禁：

| 门禁 | 命令或证据 | 阻塞范围 |
| --- | --- | --- |
| Domain 行为 | `pnpm --filter @ngapd/domain test` | P-001 全部 core 行为 |
| Contracts 运行时行为 | `pnpm --filter @ngapd/contracts test`（若当前包无 test script，本任务同步补齐） | 正式 Schema、错误目录和兼容对照 |
| M0 fixtures | `pnpm --filter @ngapd/test-fixtures test` | 固定种子、深度 20、200 同级与生产接口输入 |
| 静态边界 | `pnpm --filter @ngapd/domain typecheck`、`pnpm --filter @ngapd/contracts typecheck`、`pnpm --filter @ngapd/test-fixtures typecheck`，并检查客户端没有导入服务端领域/数据库实现 | 类型、导出与依赖方向 |
| 可消费构建 | `pnpm --filter @ngapd/domain build`、`pnpm --filter @ngapd/contracts build`、`pnpm --filter @ngapd/test-fixtures build` | P-002/P-003 可消费产物 |
| 公共兼容保护 | 对 Identity、Pairing、Workspace Schema 做结构对照，并运行受共享导出影响的现有 API/CLI 定向测试 | 公共兼容硬门禁 |
| 范围负向检查 | 检查没有新增完整 Project/Task 公共路由、正式 Task UI、本地同步或 Agent 写工具 | FR-028 / AC-024 |

只有以下条件全部满足时才能创建 `phase-001-result.md`：

- 三个任务均有持久检查点，实际文件与计划范围一致或偏差已记录。
- P-001 关联的领域结果均由生产接口直接验证，且所有 core 与硬门禁通过。
- Identity/Workspace 公共契约无回归，客户端依赖方向无越界。
- 仓库在本阶段结束时可构建；没有秘密、调试代码、临时产物或未解释文件。
- 没有未决问题、未知影响或 high/critical finding。Relaxed 策略不得把未证明的 core 结果转为 finding。
- 完成后状态转为 `awaiting_next_phase`，不得在同一次实施调用中规划或执行 P-002。

## 4. 风险、恢复与修订记录

### 4.1 风险与控制

| 风险 | 控制与检查点 |
| --- | --- |
| 大量规则被塞进单文件后难以被数据库/应用复用 | 按标识/树、图、生命周期、影响、授权和 Workspace 端口分离；统一从 `index.ts` 导出 |
| 正式 Task 状态收敛破坏原型或公共 Workspace | 保留原型 fixture 自身语义；只新增 M0 fixture；明确对照 Identity/Workspace Schema 与调用测试 |
| Domain 与 Contracts 枚举或错误码漂移 | P-001-T-003 在前两任务结果稳定后统一 TypeBox/TS 契约，并由运行时 Schema 测试锁定 |
| 影响集合、闭包或图结果受输入顺序影响 | 所有外部可见集合按稳定标识排序，用乱序输入对照测试 |
| 把数据库并发或跨模块原子性误判为纯领域已完成 | P-001 结果只声明纯领域/契约覆盖；P-002/P-003 继续拥有真实事务与应用协调门禁 |

### 4.2 恢复

- 本阶段不触碰数据库或外部系统，恢复边界仅为当前任务涉及的共享包文件。
- 任务开始前在执行状态记录实际 Git diff 与预期文件；中断时保留文件，不使用 reset/stash/discard。
- 若任务部分完成，恢复时先对照当前 diff、已运行测试和任务完成条件，再继续同一任务；不得根据聊天记忆标记完成。
- 若共享契约出现多种合理的公共兼容处理，暂停并记录问题；不得自行改变 Identity/Workspace 输入输出。

精确首次恢复步骤：使用 `$implement-planned-feature` 重新读取合同、路线图、执行状态和本计划，确认 Node.js 24 与工作区重叠，然后在任何生产编辑前把 P-001-T-001 写入 `in_progress` 检查点。

### 4.3 修订记录

| 修订 | 日期 | 结论与依据 | 影响 |
| --- | --- | --- | --- |
| 1 | 2026-07-27 | 初始 P-001 expanded 计划；共享公共契约是详细度依据，任务按稳定依赖顺序执行 | P-001-T-001–P-001-T-003 |
