# M0 initial run：P-003 阶段结果

- 运行编号：`initial`
- 阶段：`P-003`
- 阶段计划：[`phase-003-plan.md`](phase-003-plan.md)
- 阶段计划修订：`1`
- 父路线图修订：`1`
- 完成日期：`2026-07-27`
- 状态：`completed`
- 交付与验证策略：`relaxed`
- 验证结论：`passed`
- 开始基线：分支 `codex/m0-domain-baseline`，提交 `7f23d31592c72e258efa613a73ea862b9e0f0289`；P-001/P-002 生产改动和运行制品位于未提交工作树
- 结束基线：同一未提交工作树；P-001–P-003 变更完整保留，未提交、推送、重置、stash 或改写用户 requirements/contract

## 1. 阶段目标与结果

P-003 已把 P-001 领域语义和 P-002 PostgreSQL 端口组合成模块应用边界、可靠事件投影、认证 SSE 与剩余平台 Spike：

- 九个 API 模块具有可执行的允许依赖目录；集中 `ApplicationError` 把 Task 应用失败稳定映射为机器码、HTTP 状态和恢复建议。内部 `TaskApplicationService` 只从已认证 user 和服务端 Project/Membership 事实构造 actor，组合既有 Domain/Repository，不注册公共 Task/Project CRUD。
- Task create、dependency、move、follow、blocker 和 lifecycle 成功路径在业务事务内写 audit/outbox；失败只在业务未改变或完整回滚后独立幂等写 audit。跨租户、缺失、冻结和生命周期拒绝不退化为 500。
- 前向 `0007-application-projections` 增加可重建资源失效投影和 retention floor；历史迁移语义未改。Outbox claim 使用稳定顺序和显式 `LIMIT 1 FOR UPDATE SKIP LOCKED`，失败更新 attempt/error/available，投影以 outbox ID 唯一。
- Graphile `outbox_dispatch` handler 与进程启动分离；Worker 只在正式 Schema ready 后启动。两个真实 Graphile runner 以明确 claim barrier 同时处理不同行，失败 job 由 Graphile 重试且只产生一个投影。
- `/api/v1/events` 支持 session/Bearer 认证、服务端 membership 租户过滤、`Last-Event-ID` 重放、心跳、断开和过期游标恢复。事件只携带 cursor、Project、资源类型/ID、事件类型和 `refetch: true`，不携带 outbox payload 或业务正文。
- Object consistency checkpoint 在 canonical manifest hash 和全部对象的大小/哈希复核通过后，从已同步临时文件原子发布不可变内容寻址 checkpoint；缺失、损坏和发布前崩溃不留下可见 checkpoint，发布后重试为幂等。它不是备份/恢复用户入口。
- Workspace Core 新增 UI 无关 watcher/change port 和纯协调 monitor；事件规范化安全路径、拒绝 Unicode/大小写碰撞并显式标记 `local-replica-non-authoritative`。既有 journal、atomic replace、恢复和本地状态端口继续所有文件写入语义；M0 未实现真实 watcher 或新增本地写入口。
- Identity、Pairing、Workspace 已发布契约没有 diff；API 全量真实数据库、Web 和 Workspace CLI 受影响兼容均通过。客户端没有新增 Database/Domain/Object Store 依赖，没有公共 Task/Project 路由、外部 AI/LLM、WebSocket、秘密或调试残留。

P-003 只完成应用编排、六类技术验证和公共兼容。根 CI、精确 Node `24.18.0`、Compose/容器健康、最终规模/安全和 initial run 封存仍由 P-004 所有。

## 2. 任务、需求与验收覆盖

| 任务 | 状态 | 需求与验收 | 完成结果 |
| --- | --- | --- | --- |
| `P-003-T-001` | completed | FR-001、FR-013–FR-020 / AC-011–AC-018 | 模块边界、集中错误、server actor、内部 Task 应用端口和 success/failure audit-outbox 边界完成 |
| `P-003-T-002` | completed | FR-017–FR-020、FR-025 / AC-017–AC-018、AC-021、AC-026 | `0007`、Outbox claim/retry、真实 Graphile Worker、授权 cursor read model 和 SSE 完成 |
| `P-003-T-003` | completed | FR-021–FR-026、FR-028 / AC-015–AC-016、AC-019–AC-021、AC-024、AC-026 | Object checkpoint、Workspace 平台端口、六类技术结论和公共兼容关闭完成 |

阶段验收结论：

- P-003 关联 core 与硬门禁全部通过；没有使用 mock Worker、SQLite、客户端自称租户或时间碰运气替代核心证据。
- 没有否定既有技术选型，因此不需要新增替代 ADR；六类实现细节均得到明确 `passed` 结论。
- 没有新增正式 `FND-I-*`。额外宽 Workspace CLI 套件复现的固定 `C:\tmp` sandbox 和 PasswordVault 宿主限制已在前置阶段记录；受影响 cli/http/mcp/runtime 4 files/20 tests 在允许其固定测试目录的宿主下独立通过，不构成 P-003 功能失败。
- P-004 所有的根仓库/Compose、发布运行时精确版本、supplemental 性能和最终封存未被提前声明完成。

## 3. 文件修改

| 文件或范围 | 修改模式 | 主要目的 |
| --- | --- | --- |
| `apps/api/src/application-errors.ts` | add | 集中应用错误与 Task failure 稳定映射 |
| `apps/api/src/modules/module-boundaries*` | add | 九模块归属、允许依赖和负向测试 |
| `apps/api/src/modules/tasks/**` | add | server actor 驱动的内部 Task command/query 应用端口与 PostgreSQL 集成 |
| `apps/api/src/modules/events/**` | add | 授权事件 replay、cursor-expired 映射、SSE 路由和集成测试 |
| `apps/api/src/app.ts`、`index.ts` | modify | 注册 additive SSE；readiness 收紧为正式 Schema ready |
| `apps/api/src/modules/identity/errors.ts` | modify | 集中错误的兼容重导出 |
| `packages/contracts/src/tasks.ts`、`errors.ts`、`events.ts`、`index.ts` | add/modify | 内部 Task command、稳定错误、cursor/invalidation runtime 契约 |
| `packages/database/src/foundation-repository.ts`、`task-repository.ts` | modify | 幂等 audit、server actor 和事务内 success audit/outbox |
| `packages/database/src/migrations.ts`、`types.ts`、`schema-profile*` | modify | 前向 `0007`、投影/retention 类型与正式 profile 期望 |
| `packages/database/src/outbox-repository*`、`index.ts` | add/modify | `LIMIT 1 SKIP LOCKED` claim、retry、幂等投影和授权 cursor read model |
| `apps/worker/src/outbox-task*`、`index.ts`、`package.json` | add/modify | 可测试 Graphile task、真实双 Worker/retry、ready 启动和 workspace 依赖 |
| `packages/object-store/src/consistency-checkpoint*`、`index.ts`、`package.json` | add/modify | canonical manifest/object 验证、原子不可变 checkpoint 和崩溃边界 |
| `packages/workspace-core/src/workspace-platform*`、`index.ts` | add/modify | watcher/change 平台端口、路径安全和 non-authority 协调 |
| `pnpm-lock.yaml` | modify | Worker→Database、Object Store→Workspace Core workspace link；保留 P-002 Database→Domain link |

## 4. 六类 M0 技术结论

| ADR 第 16 节事项 | 证据 | 结论 |
| --- | --- | --- |
| Fastify、TypeBox、Kysely、OpenAPI | 集中错误、TypeBox runtime 4/4、API 7 files/20 tests、OpenAPI `3.1.0` 含 `/api/v1/events` 且无 Task CRUD；API typecheck/build | passed；既有选型可继续 |
| PostgreSQL recursive CTE、稳定锁和并发夹具 | Database 7 files/28 tests 重跑 P-002 recursive/graph/lifecycle；P-003 双 claim 暴露并修复缺失 `LIMIT 1` 后通过 | passed；PostgreSQL 17/Kysely 可继续 |
| Graphile Worker 与 Outbox 事务交接 | 回滚不可见、提交可见、attempt/backoff、两个真实 runner、Graphile retry、12/12 唯一投影 | passed；Graphile Worker 可继续 |
| 本地内容存储、manifest hash 和一致 checkpoint | Object Store 2 files/7 tests；缺失/损坏/重复、发布前后崩溃、临时同步与原子 hard-link 发布 | passed；内容寻址本地存储可继续 |
| Workspace watcher、atomic replace、non-authority、安全路径 | Workspace Core 6 files/27 tests；watcher monotonic/lifecycle、路径逃逸、NFC/大小写、journal/atomic recovery 和非权威标记 | passed；共享核心平台端口可继续 |
| SSE 重连、cursor 与重新获取 | 认证、租户过滤、秘密负向、`Last-Event-ID` replay、expired recovery、heartbeat/断开；API SSE 3/3 | passed；SSE 可继续，无需 WebSocket |

## 5. 测试与验证

全部数据库/Worker 证据使用 Node.js `24.14.0`、pnpm `11.9.0` 和经发布 SHA-512 核验的 Zonky PostgreSQL `17.10` Windows x64 bundle。数据库只监听 `127.0.0.1:55436`，唯一目标为 `ngapd_m0_domain_p003`。

| 命令或检查 | 观察结果 | 结论 |
| --- | --- | --- |
| Database outbox 定向 | 3/3；提交/回滚、失败 retry、显式双消费者、唯一投影、租户/cursor | Outbox Repository passed |
| Database profile 定向 | 2 files/4 tests；`0007`、双重建指纹、重复迁移、fail-closed | forward/profile passed |
| Graphile Worker 定向/full | 1 file/2 tests；两个真实 runner、12/12 唯一投影、失败/重试 | Worker passed |
| API SSE 定向 | 1 file/3 tests；认证、OpenAPI、租户、正文/秘密负向、replay/expired/断开 | SSE passed |
| Contracts full | 1 file/4 tests | runtime contracts passed |
| Database full（真实 PostgreSQL） | 7 files/28 tests | Schema/Repository/并发/事务回归 passed |
| API full（真实 PostgreSQL） | 7 files/20 tests；两轮小 Workspace 同步分别约 `1501 ms`、`1505 ms`，目标 `<10 s` | Identity/Pairing/Workspace/Task/SSE 兼容 passed |
| Workspace Core full | 6 files/27 tests | 平台端口、路径、manifest、materialization/recovery/sync passed |
| Object Store full | 2 files/7 tests | 对象与 checkpoint passed |
| Web full | 1 file/5 tests | 已发布 Web Task UI 兼容 passed |
| Workspace CLI affected | cli/http/mcp/runtime 4 files/20 tests | CLI/共享核心兼容 passed |
| Contracts/Database/Worker/API/Object Store/Workspace Core/Web/CLI typecheck/build | 全部通过 | 类型、依赖和可消费构建 passed |
| Identity/Pairing/Workspace 契约 diff | 无差异 | 已发布契约兼容 passed |
| 客户端依赖与公共路由负向 | Web/CLI 无 Database/Domain/Object Store import；无公共 `/api/v1/tasks`/`projects` | 范围与依赖方向 passed |
| 外部 API/AI/LLM/WebSocket、秘密、debug 扫描 | 无匹配；生产文件无连接串、私钥、fixture secret 或调试语句 | 安全/范围负向 passed |
| Changed-area Prettier / `git diff --check` | 全部通过；格式修正后 Contracts/Database/API typecheck 复核通过 | 工件卫生 passed |
| 最终只读数据库概要 | profile ready、`0001`–`0007`；Graphile jobs 0、活动 lease 0。隔离 API 测试最后留下 3 条 pending outbox，随后随测试库删除 | ready/无活动业务进程 |
| PostgreSQL 与临时产物清理 | server 正常停止；`55436` listener 0；package/runtime/data/log/jar 五个精确路径均不存在 | 环境清理 passed |

## 6. 发现项与处置

当前无正式 `FND-I-*`。

| ID | 类别 | 严重程度 | 关联需求/验收 | 观察与证据 | 最终功能影响 | 处置 | 置信度 | 建议后续 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |

## 7. 决策、计划偏差与恢复记录

- 无产品、范围、验收层级或阶段边界偏差。
- Outbox 并发修正：首版 `executeTakeFirst()` 查询没有 SQL `LIMIT 1`，因此第一个 `FOR UPDATE SKIP LOCKED` claim 锁住全部匹配行；显式双消费者 barrier 稳定捕获该缺陷。补为 `LIMIT 1 FOR UPDATE SKIP LOCKED` 后，Database 双消费者和两个真实 Graphile Worker 均通过。
- 依赖恢复：新增 workspace links 后，无交互 pnpm 两次选择重建可再生 `node_modules` 并在 60 秒工具边界停止；使用同一 pnpm 11.9.0 和获准的注册表访问完成恢复。lockfile 只新增 Worker→Database 与 Object Store→Workspace Core，并保留 P-002 Database→Domain，共 12 行 diff，没有第三方版本升级。
- API 全量测试首次被 60 秒工具边界截断且没有失败输出；确认同一组孤立进程自然结束后，使用可等待的同一命令完整捕获 7 files/20 tests、`exit 0`。没有修改实现来规避测试。
- Workspace CLI 宽套件额外复现既有固定 `C:\tmp` sandbox 和 PasswordVault 宿主限制；未修改平台适配器或降低断言。受影响的 cli/http/mcp/runtime 在允许固定测试目录的宿主下 4 files/20 tests 通过；M0 不重复 macOS/Windows 凭证矩阵。
- P-003 PostgreSQL bundle 初次 PowerShell/curl 和 Python 全量下载均被 Schannel/连接提前关闭；只在按 `Content-Length`/`Accept-Ranges` 完整 Range 恢复并核对发布 SHA-512 后解压。阶段关闭时 server、端口和全部五个 task-owned 路径已清理。
- 三个任务均在生产编辑前和验证后写入 durable 检查点；没有用户工作重叠、未知数据库、未停止 Worker/PostgreSQL 或未清理测试产物。

## 8. 遗留风险与下一阶段进入条件

- P-004 必须在 `.node-version` 锁定 Node `24.18.0` 完成根 CI、迁移、Compose/容器健康、最终规模/安全、无外部网络和 findings 汇总；本阶段 Node `24.14.0` 只证明满足根 `>=24 <25`。
- P-004 需要决定并验证最终 Compose 中 migration、API、Worker、Web、Gateway、对象/备份卷与最小权限启动顺序；P-003 checkpoint 不是正式备份/恢复入口。
- 下一阶段尚无详细计划。只有 `$plan-feature-implementation` 可以基于本不可变结果和当前项目事实创建 P-004 计划；本次实施调用不得自行规划或执行 P-004。
