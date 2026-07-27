# M0 initial run：P-002 阶段结果

- 运行编号：`initial`
- 阶段：`P-002`
- 阶段计划：[`phase-002-plan.md`](phase-002-plan.md)
- 阶段计划修订：`1`
- 父路线图修订：`1`
- 完成日期：`2026-07-27`
- 状态：`completed`
- 交付与验证策略：`relaxed`
- 验证结论：`passed`
- 开始基线：分支 `codex/m0-domain-baseline`，提交 `7f23d31592c72e258efa613a73ea862b9e0f0289`；P-001 生产改动与运行制品位于未提交工作树
- 结束基线：同一未提交工作树；P-001/P-002 变更完整保留，未提交、推送、重置、stash 或改写用户 requirements/contract

## 1. 阶段目标与结果

P-002 已把 P-001 的生产领域语义落到正式 PostgreSQL 17 Schema、Repository、稳定锁和跨 Task/Workspace 原子事务：

- 普通 `migrate` 只接受空库或可识别的正式 profile 前缀；prototype、unknown、超前和不完整状态 fail-closed。独立 `reset:m0` 只在 `--confirm-destroy` 与规范 `host:port/database` 完全一致时执行破坏性重建，且输出不包含凭据。
- `0001`–`0006` 建立正式 profile、Project/Task、同级 graph scope、依赖/请求、follow/blocker、completion/transition snapshot、扩展 audit、outbox 和既有 Identity/Workspace 兼容表。两轮空库重建得到相同规范 Schema 指纹。
- Project 事务锁内单调分配 Task Sequence/Key；并发创建和同一幂等键重试只生成一个业务结果。Project/Task Key 不可变且归档不释放。
- recursive CTE 解析祖先、后代和最近活动显式 Owner；图读写、移动、依赖请求/接受、follow/blocker 和影响读取直接消费 P-001 Domain 决策。
- 所有 graph scope 按 UUID 稳定排序后 `FOR UPDATE`；数据库 guard 保护跨项目/跨父依赖、树环、DAG 环、冻结端点和精确 graph version 递增。
- completion、reopen 和 Owner 变化通过一个 PostgreSQL 事务协调 Task、不可变 snapshot、Workspace 生命周期/工作周期、lease revoke、success audit 与 outbox。SQL/提交故障整体回滚后，只写一条独立、幂等的 failure audit。
- 完成后的 Task 与 Workspace 受低层 guard 保护；旧 completion/transition snapshot、Workspace version 和 audit 不可更新或删除，Task↔Workspace 一致性由延迟约束在提交时复核。
- Identity/Pairing/Workspace 已发布契约和 API 模块未改变；既有 API 全量真实数据库与 Windows CLI 集成测试通过。只把两个旧 seed Project Key 改成合法正式输入，没有新增公共 Project/Task 路由、Worker/SSE 消费或客户端服务端依赖。

P-002 只证明正式 Schema、Repository、数据库并发/事务和受影响公共兼容。应用服务编排、完整 HTTP 错误映射、Worker/Outbox 消费、SSE 与最终根工程/Compose/平台门禁仍由 P-003/P-004 所有。

## 2. 任务、需求与验收覆盖

| 任务 | 状态 | 需求与验收 | 完成结果 |
| --- | --- | --- | --- |
| `P-002-T-001` | completed | FR-002、FR-003、FR-020–FR-022 / AC-001–AC-004、AC-018 | 正式 profile、显式破坏性重建、确定 Schema、不可变记录和既有 Repository 最小兼容完成 |
| `P-002-T-002` | completed | FR-004–FR-010、FR-012、FR-016、FR-020–FR-021 / AC-002–AC-008、AC-010、AC-025 | Task Key/Owner/tree/DAG/request/move/follow/blocker Repository、稳定锁、并发和规模正确性完成 |
| `P-002-T-003` | completed | FR-013–FR-016、FR-020–FR-022 / AC-011–AC-016、AC-018 | completion/reopen/Owner 变化的 Task/Workspace 原子协调、失败审计、低层冻结和不可变 snapshot 完成 |

阶段验收结论：

- P-002 关联 core 行为全部在真实 PostgreSQL 17.10、真实行锁、约束和事务中通过；没有用 mock 或 SQLite 替代。
- 20 并发 Task、同键三次重试、深度 20 Owner/tree、200 同级/199 边 DAG、5,000 活动 Task 和两种显式锁交错均通过。
- 七个 lifecycle 故障注入点各重复两次；每次 Task、Workspace、snapshot、lease、success audit 和 outbox 均无半状态，并且只留下一个 failure audit。
- P-003/P-004 所有的公共 HTTP/Worker/SSE、Compose、精确 P95、supplemental 随机压力和最终平台结论未被提前声明完成。

## 3. 文件修改

| 文件 | 修改模式 | 主要目的 |
| --- | --- | --- |
| `packages/database/package.json` | modify | 增加开发/生产正式重建入口和 Domain workspace 依赖 |
| `packages/database/src/schema-profile.ts` | add | 正式 profile/readiness、迁移前置识别、规范目标和重建 guard |
| `packages/database/src/schema-profile.test.ts` | add | URL、参数、凭据隐藏和确认负向测试 |
| `packages/database/src/schema-profile.integration.test.ts` | add | 真实 PostgreSQL fail-closed、双重建和 Schema 指纹测试 |
| `packages/database/src/reset.ts` | add | 目标精确确认后重建并迁移正式 Schema |
| `packages/database/src/migrations.ts` | modify | `0004`–`0006` 正式 M0、graph guard 与 lifecycle/immutability 迁移 |
| `packages/database/src/migrator.ts` | modify | 普通迁移 empty/formal-only fail-closed 前后检查 |
| `packages/database/src/types.ts` | modify | 正式 Project/Task/graph/lifecycle/audit/outbox Kysely 类型 |
| `packages/database/src/foundation-repository.ts` | modify | 正式 Task Key/sequence、graph scope 与扩展 audit 输入兼容 |
| `packages/database/src/workspace-repository.ts` | modify | 正式 `frozen` Workspace 生命周期类型兼容 |
| `packages/database/src/task-repository.ts` | add | Domain 驱动的 Task/graph/impact/幂等/稳定锁 Repository |
| `packages/database/src/task-repository.integration.test.ts` | add | Key、recursive CTE、DAG、request、移动、规模和并发证据 |
| `packages/database/src/task-lifecycle-repository.ts` | add | completion/reopen/Owner 变化的原子 Task/Workspace 协调 |
| `packages/database/src/task-lifecycle-repository.integration.test.ts` | add | 事务成功、重复、失败注入、冻结、重开和 Owner 变化证据 |
| `packages/database/src/index.ts` | modify | 导出正式 profile 与 Repository |
| `apps/api/src/workspace.integration.test.ts` | modify | 把旧 Project seed 改为合法正式 Key |
| `apps/api/src/workspace-cli.integration.test.ts` | modify | 把旧 Project seed 改为合法正式 Key |
| `pnpm-lock.yaml` | modify | Database 到 Domain 的 workspace link 增量 |

## 4. 测试与验证

全部通过证据使用 Node.js `24.14.0`、pnpm `11.9.0` 和经发布 SHA-512 核验的 Zonky PostgreSQL `17.10` Windows x64 bundle。数据库只监听 `127.0.0.1:55435`，唯一目标为 `ngapd_m0_domain_p002`。

| 命令或检查 | 观察结果 | 结论 |
| --- | --- | --- |
| `reset:m0` 错误确认 | `127.0.0.1:55435/not-the-target` 原生退出 1，目标未重建 | 破坏性目标 guard passed |
| 精确 `reset:m0` 与重复 `migrate` | `0001`–`0006` 成功；两次普通 migrate no-op | 正式重建/迁移幂等 passed |
| Schema profile integration | 空库、两轮重建指纹一致；prototype/unknown/incomplete 拒绝 | fail-closed 与确定 Schema passed |
| Database full test | 6 个测试文件、25 项测试通过 | Database core passed |
| Task/graph 定向测试 | 7/7 通过；并发、幂等、深度 20、200 DAG、5,000 Task、两种 lock queue 通过 | Repository/锁/规模 passed |
| Lifecycle 定向测试 | 1 个文件、5 项测试通过；七个故障点重复回滚、重开/Owner/冻结通过 | 原子边界 passed |
| Database `typecheck` / `build` | 均通过 | 类型、导出和可消费构建 passed |
| Domain / Contracts / Test Fixtures tests | 54/54、3/3、40/40 通过 | P-001 生产语义回归 passed |
| 三包 `typecheck` / `build` | 全部通过 | P-001 静态/构建回归 passed |
| API full test（真实数据库） | 4 个测试文件、12 项通过；含 Identity、Pairing、Workspace 和真实 Windows CLI | 既有公共兼容 passed |
| API `typecheck` / `build` | 均通过 | 受影响应用静态/构建 passed |
| Identity/Pairing/Workspace 与应用模块 diff | 相对开始提交无变化；客户端 package 无服务端依赖变化；API/Worker 路由模块无变化 | 契约、依赖方向和范围负向 passed |
| 最终只读数据库概要 | profile `m0-domain-baseline` v1、6 个迁移、28 张 public 表 | 最终 Schema ready |
| Changed-area Prettier / `git diff --check` | 通过 | 格式与补丁结构 passed |
| 秘密与临时产物扫描 | 无连接串、密码、私钥或本地凭据进入仓库 | 清洁度 passed |
| PostgreSQL 清理 | server 正常停止；端口 `55435` 无监听；runtime/data/log/jar 四个精确路径均不存在 | 环境清理 passed |

## 5. 发现项与处置

当前无正式 `FND-I-*`。

| ID | 类别 | 严重程度 | 关联需求/验收 | 观察与证据 | 最终功能影响 | 处置 | 置信度 | 建议后续 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |

## 6. 决策、计划偏差与恢复记录

- 无产品、范围、验收层级或阶段边界偏差。
- 环境恢复：系统没有可用 PostgreSQL/Docker 入口。按计划下载 Maven Central 的 Zonky `embedded-postgres-binaries-windows-amd64:17.10.0`，本地 SHA-512 与发布值 `8c5a905a…473bcf8` 完全一致；bundle 不含 `createdb`/`psql`，仅用项目既有 `pg` 驱动创建专用数据库。
- 依赖恢复：首次 offline install 因元数据不完整停止；随后非 frozen install 恢复 workspace 链接。lockfile 最终只增加 Database→Domain 三行，没有升级第三方依赖。
- 兼容修正：API 全量回归首次发现两个旧测试 seed 使用 `S1`/`CLI1` 非法 Project Key，按计划只把 seed 改为 `SYNCA`/`SYNCB` 与 `CLIA`/`CLIB`，未放宽正式约束或修改公共 API。
- 审计索引修正：首次 API 回归证明把 legacy `target_id = null` 事件纳入 lifecycle 幂等唯一性会使既有请求 ID 冲突；首次最终 Database 回归又证明 partial index 不能匹配现有 `ON CONFLICT`。最终使用 `(request_id, action, result, target_type, target_id)` 默认 NULL-distinct 唯一索引，既保护 Task lifecycle 尝试幂等，又保持 legacy audit 兼容；Database/API 全量回归随后通过。
- 格式工具恢复：`pnpm exec prettier` 在恢复后的 workspace 未解析命令，但根 `node_modules/.bin/prettier.CMD` 可用；使用同一锁定依赖完成 changed-area write/check。
- 三个任务均在生产编辑前和验证后写入持久检查点；无用户工作重叠、未知数据库、未停止进程或未清理测试数据。

## 7. 遗留风险与下一阶段进入条件

- P-003 必须只组合已经验证的 Domain/Database 端口，实现模块应用服务、稳定公共错误/审计、Outbox Worker、SSE 和 Workspace 接线，并继续保护既有公共兼容。
- P-004 必须在 `.node-version` 锁定 Node `24.18.0` 完成根门禁、Compose、精确性能、安全、无外部网络和真实平台最终验收；本阶段使用的 Node `24.14.0` 只证明满足根 `>=24 <25` 引擎范围。
- 下一阶段尚无详细计划。只有 `$plan-feature-implementation` 可以基于本不可变结果和当前项目事实创建 P-003 计划；本次实施调用不得自行规划或执行 P-003。
