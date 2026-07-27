# P-002：正式 Schema、Repository 与 PostgreSQL 原子边界阶段计划

- 运行编号：`initial`
- 阶段编号：`P-002`
- 阶段计划修订：`1`
- 父路线图修订：`1`
- 父路线图指纹（SHA-256）：`eb90885df1246062d407f9284e015de0e0521d93e0e00f35ab5debc21af366ad`
- 需求指纹（SHA-256）：`844c505f9c6b15ae64f217026ba27c7c6ac22dd394f0ce80112a43960a8037d1`
- 项目基线：分支 `codex/m0-domain-baseline`，提交 `7f23d31592c72e258efa613a73ea862b9e0f0289`；P-001 生产改动与本运行工件仍为未提交工作，P-001 result 指纹为 `cdad119ffe04d74054dbee35e1dda1712f7e90bd5eb2613931e0f1b1b6cb8f8e`
- 创建日期：2026-07-27
- 计划详细度：`expanded`
- 交付与验证策略：`relaxed`
- 规划验证结论：`ready`

## 1. 阶段目标、边界与关联需求

本阶段把 P-001 已冻结的标识、树、有效 Owner、同级 DAG、依赖请求、状态、冻结、重新打开、影响集合和 Workspace 生命周期契约落到正式 PostgreSQL 17 Schema、Repository、行锁与事务边界。阶段结束时必须能够显式重建已确认可丢弃的原型数据库，从空库得到确定 Schema，并在真实并发和失败注入下证明 Task、图、审计与 Workspace 不会留下半状态。

关联范围为路线图 P-002 行：FR-002–FR-010、FR-012–FR-016、FR-020–FR-022；AC-001–AC-008、AC-010–AC-016、AC-018、AC-025。P-002 形成数据库和事务层的独立证据；应用/Worker 对 Schema ready 的最终接线、公共错误适配、Outbox 消费、SSE 和整体 HTTP 场景继续由 P-003/P-004 完成，不能在本阶段提前声称对应验收已最终关闭。

阶段边界：

- 不新增完整 Project/Task 公共 CRUD 路由、正式 Task UI、本地 Workspace 物化/同步或 Agent 写工具。
- 不实现 Worker 消费、重试调度或 SSE 投影；只允许建立后续消费所需的事务性 Outbox 持久化事实。
- 不修改已封存的 P-001 plan/result、需求、工作流合同或路线图；Database 只能消费 P-001 生产领域结果，不得复制第二套业务规则。
- 不执行最终根 `pnpm check`、Compose、Linux 发布、精确 P95 或 supplemental 诊断；这些只在最终代码状态由 P-004 执行。
- 不对未知、生产或未明确确认可丢弃的数据库执行任何破坏性操作。

## 2. 前置条件、数据保护与接口约束

### 2.1 执行前硬门禁

- 使用 Codex 隔离 Node.js `24.14.0` 与 pnpm `11.9.0` 执行本阶段；默认 Node `20.13.1` 的结果无效。`.node-version` 的精确 `24.18.0` 差异继续由 P-004 最终发布门禁复核。
- 重新读取 contract、roadmap、state、本计划与 P-001 immutable result，并核对上述三个指纹；重查 Git diff。若 `packages/database`、受影响 API 测试或 P-001 生产文件出现实施开始后的用户重叠修改，暂停并记录所有权，不覆盖、不 reset。
- 当前 PATH、`C:\Program Files\PostgreSQL\17` 与 Docker 均无 PostgreSQL 入口。任何数据库写入前，必须取得可信 PostgreSQL 17 Windows x64 测试运行时、核对发布摘要并记录版本。可复用仓库既有 Windows 证据所核验的 Zonky `embedded-postgres-binaries-windows-amd64:17.10.0`：发布 SHA-512 `8c5a905a35b41f97f4a675bc50a983abac094a49b57262d35e7e38f56ad482eb60fc4dbc3412f1906d3a810dd67782ad391be443757e60397835fc41f473bcf8`。摘要、版本或来源不能核实时暂停，不能用 SQLite、mock 或外部未知数据库代替。
- PostgreSQL 只监听 `127.0.0.1` 的 task-owned 空闲端口，数据、日志和运行时位于解析后的 P-002 专用临时路径，只创建数据库 `ngapd_m0_domain_p002`。先证明端口、路径和数据库名未被未知主体占用，再设置仅对当前命令生效的 `DATABASE_TEST_URL`；不得把连接串、密码或令牌写入仓库、计划、状态、日志摘要或审计。

### 2.2 正式重建与兼容约束

- 普通 `migrate` 只允许空数据库或带正式 `schema_profile`/版本元数据的数据库前向迁移；发现既有 Kysely 历史但缺少正式 profile、未知 profile、超前版本或不完整状态时，以稳定诊断停止，绝不自动 drop、truncate 或重写历史。
- 新增独立 `reset:m0` 入口。它必须解析 `DATABASE_URL` 的规范化 `host:port/database`，要求 `--confirm-destroy` 与该目标完全一致，输出时隐藏凭据；确认缺失、目标不匹配、数据库名未知或 profile 不可判定时拒绝。测试目标只允许 `127.0.0.1:<P-002>/ngapd_m0_domain_p002`。
- 已明确当前原型数据可以丢弃，所以不规划数据转换、备份或恢复。回滚边界是停止测试实例、恢复代码版本并从空库重建；任何旧原型业务记录都不被描述为可恢复。
- Identity、Pairing 与 Workspace 现有表、Repository 返回形状和已发布 API 行为保持兼容。正式 Project/Task Schema 可以收敛，但既有内部 seed/ScopeProvisioning 调用必须改为合法的正式输入，不能让调用方继续把任意 Task Key 当作权威分配结果。

### 2.3 持久化不变量

- Project 使用 UUID 关联、`[A-Z]{2,6}` 全局唯一且不可变的 `project_key`、事务性 `task_sequence`、Owner、重新打开策略、状态、`recovery_epoch` 和版本；归档不得释放 Key。
- Task 保存项目内唯一且不可更新的 Sequence/Task Key、邻接父级、可空显式 Owner、正式基础状态、独立归档、内容/展示字段、版本与冻结事实。复合外键、检查约束、唯一索引和必要的数据库 guard 为租户、同级、不可变与完成冻结提供第二层保护。
- 每个项目虚拟根和每个普通父任务恰有一个 sibling graph scope。Task 指向其直接父级 scope；依赖的两个端点必须通过复合外键属于同一 scope。所有图写入按 scope UUID 稳定排序并 `FOR UPDATE`，移动与依赖增删共享该互斥边界。
- 完成快照、Workspace 版本、审计为不可变记录；Outbox 是可重建交付记录而非业务权威。任务完成、Owner 固化、Workspace 快照/冻结、租约撤销、审计和 Outbox success 必须在同一 PostgreSQL 事务中提交；重新打开以同一边界创建新工作周期并保留旧快照。

## 3. 任务与文件范围

### 3.1 任务

| 任务 | 结果 | 文件或范围 | 实现摘要 | 验证 | 完成条件 |
| --- | --- | --- | --- | --- | --- |
| P-002-T-001 | 正式可识别、可显式重建的 M0 Schema 基线 | `packages/database/src/migrations.ts`、`types.ts`、`migrator.ts`、`migrate.ts`、新增 `schema-profile*`/`reset*`/migration 集成测试、`package.json`、必要的数据库导出 | 用正式空库基线替代原型布局；写入并读取固定 profile/版本；建立 Project/Task、graph scope、dependency/request/follow/blocker、completion snapshot、扩展 audit、outbox 与既有 Workspace/Identity 兼容表；增加 unknown/prototype/incomplete schema fail-closed 检查和目标完全匹配的 `reset:m0` | 无数据库的参数/目标负向测试；隔离 PostgreSQL 17 上显式 reset、空库迁移、重复 migrate no-op、Schema 指纹一致、原型 profile 拒绝、不完整迁移回滚；database typecheck/build | 普通 migrate 不含隐式破坏；只有精确确认入口能清空 P-002 目标；两次空库重建得到相同正式 Schema/profile；Identity/Workspace 结构仍可被既有 Repository 消费 |
| P-002-T-002 | 标识、树、Owner、同级图和幂等操作 Repository | 新增 `packages/database/src/task-repository*` 及必要的 query/transaction 内部模块与 PostgreSQL 集成测试；调整 `foundation-repository.ts`、`types.ts`、`index.ts`、数据库 package 依赖；按需更新仅用于合法 seed 的 API 集成测试输入 | Repository 直接调用 `@ngapd/domain` 的 P-001 解析/决策；项目事务内分配 Sequence 并绑定创建幂等记录；用 recursive CTE 读取祖先/后代和最近活动 Owner并返回异常诊断；建立同级图 snapshot、依赖直接变更/请求/接受、移动、blocker/follow 和确定性影响读取；稳定锁定 graph scope 后在锁内重授权、重校验版本/Owner/环/冻结 | 真实 PostgreSQL 约束和低层负向测试；并发 Task 创建与同键重试；深度 20 Owner/树；200 同级 DAG；5,000 活动 Task 查询正确性；依赖增删/请求 stale；移动与依赖多种交错；transaction rollback 与 graph version 精确递增 | Task Key 唯一、单调、不复用且重试只返回一个任务；跨租户/跨父/环/冻结不能由低层入口写入；图版本、结构和依赖在任一交错下只有完整前态或后态；P-001 失败码与确定顺序未漂移 |
| P-002-T-003 | 完成、重新打开、Owner 变化与 Workspace 的同事务协调 | 新增或扩展 `packages/database/src/task-lifecycle-repository*`、`workspace-repository.ts`、`foundation-repository.ts`、相关集成测试和数据库导出 | 在稳定锁顺序下装载 Task/图/Owner/Workspace 权威事实并调用 P-001 completion/reopen/impact/workspace lifecycle 决策；原子固化 Owner、冻结或重新激活 Task/Workspace、引用最终 sync version、创建不可变 completion snapshot、递增工作周期、撤销 lease、写成功审计与 Outbox；领域拒绝在无业务变更事务中写失败审计，事务故障整体回滚后以独立幂等失败审计记录尝试 | 完成条件矩阵、完成后低层冻结、deny/cascade 与陈旧影响确认；Owner/版本/租约并发；在任务更新、快照、Workspace、lease、audit/outbox 各边界注入失败并复核无半状态；审计字段与秘密负向扫描 | 每个成功操作只产生一个一致事实边界；每个可记录的失败尝试只有失败审计而无业务半状态；旧快照不变、工作周期单调、活动租约按计划撤销；Task 与 Workspace 不会一侧提交 |

依赖顺序：P-002-T-002 依赖 T-001 正式 Schema/profile 与隔离数据库门禁通过；P-002-T-003 依赖 T-002 的 Task/graph 锁、递归读取和幂等写边界。每个任务必须在 state 写入持久检查点并完成自身最小验证后才开始下一任务。

### 3.2 文件所有权与暴露接口

| 范围 | 本阶段用途 | 不允许的耦合 |
| --- | --- | --- |
| `packages/database/src/migrations*`、`schema-profile*`、`reset*` | 正式 Schema、版本/profile、显式破坏入口和 readiness 查询 | 普通 migrate 隐式销毁；从未确认目标读取或写入；日志输出凭据 |
| `packages/database/src/task-repository*`、`task-lifecycle-repository*` | 真实 PostgreSQL 查询、稳定锁、事务、幂等和领域决策适配 | 复制 P-001 规则；Fastify/HTTP/React/CLI；把测试 fixture 当作规则权威 |
| `foundation-repository.ts`、`workspace-repository.ts` | 保持现有 Identity/Workspace 能力并接入正式 Project/Task 与生命周期原子边界 | 改变已发布 Workspace 协议；绕过完成冻结、租户、租约或工作周期 |
| `apps/api/src/*integration.test.ts` 的 seed 部分 | 使用合法正式 Project Key 与 Repository 分配的 Task Key，验证既有 API 行为 | 注册新 Project/Task 公共路由；修改公开输入输出以迁就测试 |
| `packages/test-fixtures/src/m0-domain*` | 提供深度 20、200 同级和 5,000 Task 的确定输入 | 在生产 Repository 中导入 fixture；执行 supplemental 随机压力 |

数据库包对外只暴露类型安全的 Schema status、显式 Repository/Unit of Work 与稳定失败结果。Kysely transaction 不得跨出应用边界供任意调用方拼接业务写入；P-003 只组合已证明的事务端口。

## 4. 验证与完成条件

### 4.1 任务级最小验证

1. T-001 先运行不需要数据库的 reset 参数/目标负向测试；可信隔离 PostgreSQL 就绪后，执行 database migration/profile 定向测试和 database typecheck/build。迁移测试必须自行创建唯一临时 schema 或数据库并清理，不能复用未知状态。
2. T-002 只运行 database Task/graph 定向集成测试以及 database typecheck/build；使用固定调度屏障制造并发交错，不能以循环碰运气作为 core 证据。
3. T-003 只运行 lifecycle/Workspace/audit/outbox 定向集成测试以及 database typecheck/build；失败注入必须在每个事务阶段复核 Task、Workspace、snapshot、lease、audit 和 outbox 的完整计数与版本。

### 4.2 阶段关闭门禁

在所有实现完成后的最新有效状态执行一次 P-002 阶段门禁：

| 门禁 | 命令或证据 | 阻塞范围 |
| --- | --- | --- |
| 正式重建与迁移 | 对 P-002 专用 PostgreSQL 执行确认不匹配负向、精确确认 reset、空库 migrate、重复 migrate、第二次 reset/migrate；比较 profile、Kysely history 与 `information_schema`/`pg_catalog` 规范化指纹 | FR-002 / AC-001 |
| Database 行为 | `DATABASE_TEST_URL=<P-002> pnpm --filter @ngapd/database test` | 标识、树、Owner、DAG、请求、移动、冻结、重新打开、Workspace、审计与并发 core |
| Database 静态与构建 | `pnpm --filter @ngapd/database typecheck`、`pnpm --filter @ngapd/database build` | 类型、导出与可消费产物 |
| P-001 生产规则回归 | `pnpm --filter @ngapd/domain test`、`pnpm --filter @ngapd/contracts test`、`pnpm --filter @ngapd/test-fixtures test` | Repository 未复制或改变 P-001 语义；规模 fixture 仍确定 |
| Identity/Workspace 公共兼容 | `DATABASE_TEST_URL=<P-002> pnpm --filter @ngapd/api test`，并对 Identity/Pairing/Workspace Schema 哈希和公共路由做结构对照 | 既有 API、租约、同步、冲突、Web/CLI 服务端行为 |
| 低层与范围负向 | SQL/Repository 负向测试；检查客户端无 `@ngapd/domain`/`@ngapd/database` 新依赖，无新 Project/Task 公共路由、Worker/SSE 消费或本地写入 | 冻结、租户、阶段边界 |
| 工件与环境 | changed-area Prettier、`git diff --check`、秘密/连接串/临时产物扫描；只读数据库汇总后停止 cluster，确认端口无监听并精确清理 P-002 runtime/data/log | 仓库可恢复、无未知数据或活动进程 |

只有以下条件全部满足时才能创建 `phase-002-result.md`：

- 三个任务均有 state 检查点，实际文件范围与计划一致或偏差已记录。
- 所有关联 core 行为在真实 PostgreSQL 17、真实行锁、约束和事务中通过；没有用 mock/SQLite 替代。
- reset 只作用于精确确认的 P-002 目标；普通迁移 fail-closed；空库两轮 Schema 指纹一致。
- Identity/Pairing/Workspace 公共兼容通过；没有新增越界公开能力。
- 没有 high/critical finding、未知影响、未决问题、未停止进程、未清理测试数据或迁移半状态。Relaxed 策略不得把未证明的 core 结果降级为 finding。
- 完成后 state 转为 `awaiting_next_phase`，同一次实施调用不得规划或执行 P-003。

## 5. 风险、恢复与修订记录

### 5.1 风险与控制

| 风险 | 控制与检查点 |
| --- | --- |
| 重写正式基线误作用于原型外数据库 | profile 预检、普通 migrate fail-closed、规范目标完全匹配、P-002 固定数据库名、回环监听与负向测试；未知目标立即停止 |
| Schema 收敛破坏 Identity/Workspace | 保留既有表和 Repository 形状；每个迁移任务运行 database/API 真实集成回归；公共 Schema 哈希对照 |
| 同级约束只靠应用校验而可被低层绕过 | graph scope 与端点复合外键、唯一/检查约束、完成冻结 guard，再叠加 P-001 决策与稳定行锁；直接 SQL 负向测试 |
| 移动与依赖使用不同锁顺序造成死锁或半图 | 所有相关操作对 graph scope UUID 排序后锁定，在锁内重读；用显式屏障覆盖两种提交顺序、陈旧版本与回滚 |
| 完成/重新打开跨 Task 与 Workspace 留下半状态 | 单一 Kysely/PostgreSQL transaction、不可变 snapshot、lease revoke、audit/outbox 同提交；逐边界失败注入与提交后计数复核 |
| 失败审计与业务回滚互相冲突 | 领域拒绝在无业务变化事务中提交失败审计；SQL/提交故障先整体回滚，再以 request ID 幂等写独立失败审计；失败审计不宣称业务成功 |
| 规模测试演变成重复或不稳定性能门禁 | P-002 只验证深度 20、200 同级、5,000 Task 的正确性和无明显超时；精确 P95 与 supplemental 只在 P-004 最终状态执行一次 |

### 5.2 恢复

- 阶段开始前把当前 Git diff、可信 PostgreSQL 来源/摘要、解析后的 P-002 路径、端口和数据库名写入 state；任何生产编辑前把 P-002-T-001 标记 `in_progress`。
- 任务中断时保留实际文件和数据库证据，记录当前 task、最后通过门禁、migration/profile、cluster PID/端口和第一个未完成步骤；不使用 reset、checkout、stash 或整目录覆盖恢复代码。
- 若迁移中断或 profile 未知，停止 API/Worker/测试写入并保留诊断；只在重新核对精确目标后使用 `reset:m0` 从空库恢复。不得手工修改 Kysely history 伪造就绪。
- 若并发/事务测试失败，先停止新增写入，读取相关 Task、graph scope、Workspace、lease、snapshot、audit/outbox 的只读事实并写入 state；随后停止隔离 cluster。不能通过删除失败断言或串行化所有业务操作绕过要求。
- 若公共兼容出现多种合理处理，暂停并记录决策问题；不得自行改变 Identity/Workspace 公共输入输出。

精确首次恢复步骤：使用 `$implement-planned-feature` 重新读取 contract、roadmap、state、本计划和 P-001 result，核对指纹与 Git diff；确认可信 PostgreSQL 17 取得路径和 P-002 隔离目标方案；随后在任何生产编辑或数据库写入前把 P-002-T-001 写入 `in_progress` 检查点。

### 5.3 修订记录

| 修订 | 日期 | 结论与依据 | 影响 |
| --- | --- | --- | --- |
| 1 | 2026-07-27 | 初始 P-002 expanded 计划；破坏性正式基线、公共兼容、稳定锁和 Task/Workspace 原子恢复风险要求三个顺序任务 | P-002-T-001–P-002-T-003 |
