# M0：领域基线和工程骨架初始执行状态

- 运行编号：`initial`
- 运行类型：`首次实现`
- 目标记录：`change-0.md`
- 运行状态：`completed`
- 交付与验证策略：`relaxed`
- 验证结论：`passed`
- 当前路线图修订：`1`
- 需求指纹（SHA-256）：`844c505f9c6b15ae64f217026ba27c7c6ac22dd394f0ce80112a43960a8037d1`
- 路线图或变更计划指纹（SHA-256）：`eb90885df1246062d407f9284e015de0e0521d93e0e00f35ab5debc21af366ad`
- 当前阶段：`P-004`
- 当前阶段计划：[`phase-004-plan.md`](phase-004-plan.md) revision 1，SHA-256 `f505ef3f129e91f6b4ea97169134d9b85bdbae34068028e5bc42f79a67c4b79f`
- 当前任务：无（initial run 已完成）
- 下一发现项编号：`FND-I-001`
- 项目基线：分支 `codex/m0-domain-baseline`，提交 `7f23d31592c72e258efa613a73ea862b9e0f0289`
- 最后更新时间：`2026-07-28T00:47:20+08:00`

## 1. 运行目标或待生效变更

按 `requirements.md` 和 `implementation-plan.md` 完成 M0 领域基线与工程骨架。初始运行共有四个阶段；P-001、P-002、P-003 已完成，P-004 expanded 计划已 ready，当前只允许下一次 `$implement-planned-feature` 执行 P-004，不得改写前三个阶段的 immutable result。

规划前工作区事实：

- `docs/requirements/m0-domain-baseline/requirements.md` 与 `workflow-contract.md` 是已存在的未跟踪用户工作，规划不得改写或归属为实现产物。
- 除该需求目录外，Git 工作区无已跟踪或未跟踪变更。
- 当前 shell 是 Node.js `20.13.1`、pnpm `11.9.0`；实施验证前必须切换到仓库要求的 Node.js 24。

## 2. 阶段状态

| 阶段 | 目标 | 计划 | 结果 | 状态 |
| --- | --- | --- | --- | --- |
| P-001 | 生产领域语义、授权、共享契约和错误目录 | [`phase-001-plan.md`](phase-001-plan.md) revision 1 | [`phase-001-result.md`](phase-001-result.md) | completed |
| P-002 | 正式 Schema、Repository 与真实 PostgreSQL 并发/事务 | [`phase-002-plan.md`](phase-002-plan.md) revision 1 | [`phase-002-result.md`](phase-002-result.md) | completed |
| P-003 | 模块应用服务、错误/审计/Outbox/Worker/SSE/Workspace 集成 | [`phase-003-plan.md`](phase-003-plan.md) revision 1 | [`phase-003-result.md`](phase-003-result.md) | completed |
| P-004 | 最终 CI、迁移、Compose、规模、安全与整体验收 | [`phase-004-plan.md`](phase-004-plan.md) revision 1 | [`phase-004-result.md`](phase-004-result.md) | completed |

P-001–P-004 的 12 个任务和全部阶段关闭门禁均已完成并通过；`phase-004-result.md`、`effective-requirements.md` 与 `change-0.md` 已一致生成，initial run 已封存。

## 3. 当前检查点

- 检查点状态：P-001–P-004 的四份不可变阶段结果、当前有效需求和 change-0 已一致生成；全部验证和环境清理通过，运行状态为 `completed`。
- 已完成阶段：P-001、P-002、P-003、P-004。
- 阶段结果：[`phase-001-result.md`](phase-001-result.md)，SHA-256 `cdad119ffe04d74054dbee35e1dda1712f7e90bd5eb2613931e0f1b1b6cb8f8e`；[`phase-002-result.md`](phase-002-result.md)，SHA-256 `ada169fd96445f5cbdd0130d3235995e91e3bd8c70317aec02a930438c9dba2a`；[`phase-003-result.md`](phase-003-result.md)，SHA-256 `8eae48d2820cc81ae09b5ce4bda111416b2da87a6fb1e5d171516a5455c30006`；[`phase-004-result.md`](phase-004-result.md)，SHA-256 `8b9e9681b3921aeca604464075cee6258d9aac0274ad59dead63d457a1e1322f`。
- 最终工件：[`../../effective-requirements.md`](../../effective-requirements.md)，SHA-256 `69959b7bcf8303e22c49d1278c3e103d9e9598e421147e3ccd1e07ac41a9d728`；[`../../change-0.md`](../../change-0.md)，SHA-256 `16674766402841e287af63fc1119661ec593ea96bfdabe5efe87c18168c0d7ed`。
- 当前阶段/任务：P-004 completed / 无。
- 恢复基线：用户在阻塞期间将完整候选保存并推送为提交 `19cc33070b0e90646a80259e457cfdbc78b76d0c`（提交说明 `no docker`）；该提交相对原始项目基线包含当前记录的 P-001–P-004-T-002 范围，分支与远端一致且恢复时工作区干净。此保存动作不改变原始项目基线、任务归属或尚未通过的 T-002/T-003 门禁。
- P-001-T-003 实际范围：修改 Contracts 的 Projects/Tasks/Errors、package/tsconfig；新增运行时契约测试；新增 M0 Domain fixture 与测试并导出。Contracts `index.ts` 无需修改，因为既有模块级导出已覆盖新增符号。
- P-001-T-003 结果：Project Key、Task 基础/有效状态、独立归档、Project 状态、图作用域、依赖请求、影响集合和扩展错误目录具有 TypeBox/TS 单一来源；固定深度 20、200 同级和 5,000 活动任务 fixture 直接调用生产领域接口。
- 公共兼容：Identity/Pairing/Workspace 三个契约哈希与任务前一致；API/CLI/Workspace Core/Object Store 无代码变化；客户端没有导入 `@ngapd/domain` 或 `@ngapd/database`；未新增公共路由。
- P-002 计划：[`phase-002-plan.md`](phase-002-plan.md) revision 1，SHA-256 `d2142acffcbb1e29e2a0457ebcdb19c61978b0462fb9e18097f556622d187e0d`；三个顺序任务覆盖正式重建、Task/graph Repository 与 Task/Workspace 原子生命周期。
- P-002-T-001 基线：提交仍为 `7f23d315…f0289`；`packages/database` 在任务前无 Git 变更。基线 SHA-256：`migrations.ts` `b8c30acc…f9cb2`、`types.ts` `b1a0c231…66146`、`migrator.ts` `64c9473c…85a4`、`migrate.ts` `9de4673f…4509`、`package.json` `b31d4c25…6bbb`；其余 Database 源码逐文件哈希已在任务前命令输出中观察。
- P-002-T-001 实际范围：计划文件及新增 `schema-profile.ts`/unit+integration tests、`reset.ts`、迁移/types/migrator/package/index；另最小修改 `foundation-repository.ts` 以在新 Schema 中原子创建 graph scope、分配正式 Task Key，修改 `workspace-repository.ts` 以接受 `frozen` 生命周期。后两项是“既有 Repository 可消费正式 Schema”的必要同步，不改变公共 HTTP 路由。
- P-002-T-001 结果：普通 migrate 只接受空库或正式 profile 的可识别前缀；prototype/unknown/incomplete fail-closed。`reset:m0` 隐藏凭据并要求规范 `host:port/database` 完全匹配。正式 migration `0001`–`0004` 建立 M0 表、约束、profile 和既有 Identity/Workspace 兼容结构；两轮重建 Schema 指纹一致。
- P-002-T-001 环境：Zonky PostgreSQL 17.10 Windows x64 bundle 发布 SHA-512 与本地值完全匹配；`postgres`/`initdb`/`pg_ctl` 均报告 17.10。task-owned cluster 仅监听 `127.0.0.1:55435`，唯一测试数据库为 `ngapd_m0_domain_p002`。
- P-002-T-002 基线：T-001 后 Database diff 与上方实际范围一致，`git diff --check` 通过；当前正式 Schema ready，PostgreSQL 只监听 `127.0.0.1:55435`，无 API/Worker/公共路由变化。
- P-002-T-002 实际范围：新增 `task-repository.ts` 与集成测试；Database 增加对 `@ngapd/domain` 的 workspace 依赖并只增量更新 lockfile；`0005-task-graph-guards`、profile 期望和集成迁移期望同步更新；index 导出正式 Repository。未修改 API/Worker/公共路由或 P-001 生产语义。
- P-002-T-002 结果：项目锁内 Task Sequence/Key 与幂等记录同事务；recursive CTE 诊断有效 Owner；dependency/request/acceptance/move/follow/blocker 调用 P-001 Domain；graph scope 稳定 UUID 顺序锁；数据库 guard 保护 Project/Task Key、树环、依赖环、完成冻结并自动精确递增 graph version。
- P-002-T-002 规模/并发：20 个并发创建得到唯一 `KEYS-1`–`KEYS-20`，三次同键重试只产生 `KEYS-21`；深度 20 Owner、5,000 Task、200 同级/199 边链 DAG 通过；closing cycle 无版本漂移；依赖请求在图版本变化后 stale；显式 PostgreSQL 锁等待队列分别固定 dependency-first 与 move-first，两种顺序均只有一致前态或后态。
- P-002-T-003 基线：T-002 后 Database 5 files/20 tests、typecheck/build 通过，lockfile 仅有 Database→Domain workspace link；当前 Schema profile ready 至 `0005`，无 API/Worker/公共路由变化。
- P-002-T-003 预期范围：新增 `task-lifecycle-repository.ts` 与真实 PostgreSQL 失败注入/并发测试；新增 `0006` lifecycle/immutability/Task↔Workspace consistency guard 与必要类型；扩展 audit 输入、Workspace 低层冻结保护和 index 导出；不实现 Worker 消费或公共 HTTP。
- P-002-T-003 验证/完成条件：completion/reopen/Owner 变化直接调用 P-001 lifecycle/workspace/authorization；Task、snapshot、Workspace、lease、audit、outbox 各失败点回滚；成功审计同事务、失败审计幂等独立记录；旧快照不变、work cycle 单调、冻结低层不可绕过；database 定向/full test/typecheck/build 通过。
- P-002-T-003 实际范围：新增 lifecycle Repository 与集成测试；`0006` 增加 lifecycle/immutability/Task↔Workspace 延迟一致性 guard；扩展 audit 类型/写入并导出 Repository。API 仅把两个旧 Workspace 测试 seed 改为合法正式 Project Key。
- P-002-T-003 结果：completion/reopen/Owner 变化通过单一 PostgreSQL 事务协调 Task、snapshot、Workspace、lease、audit 与 outbox；七个故障点重复注入均无半状态且 failure audit 幂等；旧 snapshot、work cycle 单调和低层冻结 guard 通过。
- P-002 阶段关闭：错误 reset 目标退出 1；精确 reset、两次 migrate no-op 与双重建 Schema 指纹通过；Database 6 files/25 tests、API 4 files/12 tests、Domain 54/54、Contracts 3/3、Fixtures 40/40 通过；相关 typecheck/build、Prettier、`git diff --check`、公共契约/依赖/路由负向检查通过。
- P-003 计划：[`phase-003-plan.md`](phase-003-plan.md) revision 1，SHA-256 `e5f054bb6861ec2ece85a0657fcda43101d05c7aec0a709ba8719888fd9cf7c1`；expanded 的依据是前向投影迁移、API/Worker 多写入协调和 additive 公共 SSE 兼容面。
- P-003 规划审计：requirements/roadmap/P-001/P-002 指纹全部匹配；`apps/api/src/modules`、`apps/worker`、`packages/object-store`、`packages/workspace-core` 相对开始提交无改动，Contracts/Database diff 均由 completed 前置阶段解释；无用户重叠、未决问题、活动 PostgreSQL 或临时产物。
- P-003 三个顺序任务：T-001 模块应用服务/错误/audit-outbox 边界；T-002 Graphile Worker/Outbox/SSE cursor 与 `0007` 前向投影；T-003 Object checkpoint/Workspace 平台端口及六类技术/公共兼容关闭。
- P-003-T-001 基线：四个父级指纹和 phase plan 指纹匹配；`apps/api/src/modules` 相对开始提交无改动，Contracts/Database 当前 diff 全部由 P-001/P-002 result 解释；无 P-003 用户重叠修改。预期范围为统一 application error、模块边界、内部 Tasks 应用服务/测试、必要 Contracts DTO/error 与 Database task/audit/outbox 事务扩展。
- P-003-T-001 完成条件：server-resolved tenant/membership/actor 上下文；内部 command/query 组合 P-001/P-002 端口；所有 in-scope failure 稳定映射且不退化 500；success audit/outbox 与业务同事务、failure audit 独立幂等；无公共 Task CRUD；Contracts/API/Database 定向测试、typecheck/build 通过。
- P-003-T-001 实际范围：新增集中 `application-errors.ts`、九模块边界契约/测试、内部 Tasks application service/index/集成测试；Contracts 增加内部 Task command runtime Schema 与稳定错误码；Database 增加 server actor 解析、幂等 audit 写入，以及 create/dependency/move/follow/blocker 的事务内 success audit/outbox。Identity error 文件改为兼容重导出；未注册任何 Task 路由。
- P-003-T-001 结果：同一应用端口从认证 user 解析 server project/membership，租户越界为 403 且两次重复只留一条 failure audit；Task create 幂等重放只留一个任务、success audit/outbox；completion 直接组合 P-002 原子端口并同时冻结 Task/Workspace；missing Task 稳定映射 404 `TASK_NOT_FOUND`。
- P-003 环境：Codex Node `24.14.0`/pnpm `11.9.0`；Maven Central Zonky PostgreSQL 17.10 artifact 通过可恢复 Range 下载，SHA-512 与计划发布值完全匹配；二进制均报告 17.10。阶段验证只使用 `127.0.0.1:55436/ngapd_m0_domain_p003`，关闭前正式 profile ready 至 `0007`；当前 server 已停止、端口无 listener、五个 task-owned 路径均不存在。
- 下载偏差：PowerShell/curl 的 Schannel 连接和首次 Python 全量响应均提前关闭；未接受截断 artifact。依据 Maven `Content-Length`/`Accept-Ranges` 用 256 KiB Range 续传到完整 `23,357,276` bytes 后才校验发布 SHA-512，通过后再解压启动；该偏差已关闭。
- P-003-T-002 基线：P-003-T-001 的统一错误、server actor、success/failure audit 与事务内 outbox 已通过；正式 Schema profile ready 至 `0006`；API 仍未注册公共 Task CRUD；Worker 仍是最小 Graphile health task；尚无事件投影或 SSE 路由。
- P-003-T-002 预期范围：只新增前向 `0007-application-projections`；新增 Database outbox claim/project/ack/retry 与授权 cursor read model；把 Worker handler 与进程启动分离并注册真实 Graphile Worker task；新增只携带资源失效提示的事件 Contracts 和带认证、租户过滤、游标重放/过期/断开的 SSE；同步 Schema ready 检查与必要的 package/index/type。
- P-003-T-002 完成条件：真实 PostgreSQL 17 与真实 Graphile Worker 以明确 barrier 验证已提交可见、回滚不可见、失败重试、两个 Worker、outbox ID 幂等投影；SSE 验证认证、服务端 membership 租户过滤、cursor 重放/过期/断开；`0007` migrate/profile、Database/Worker/API/Contracts 定向测试及 typecheck/build 全部通过。
- P-003-T-002 实际范围：新增事件 Contracts 与 `EVENT_CURSOR_EXPIRED`；新增前向 `0007-application-projections`、投影/retention 表、Database `OutboxRepository`/`EventRepository` 和集成测试；新增 Graphile `outbox_dispatch` task、真实双 Worker/重试集成测试及 Schema-ready 启动保护；新增 Event application service、认证 SSE 路由和 API 集成测试；API readiness 改为正式 profile ready。未新增 Task CRUD 或 mutation 路由，SSE payload 不含 outbox payload。
- P-003-T-002 结果：提交/回滚、失败 attempt/backoff、outbox ID 唯一投影、服务端 membership 过滤、cursor replay/expired、OpenAPI 3.1 路由和可控断开均通过；双消费者门禁发现 `executeTakeFirst()` 不自动生成 `LIMIT 1`，首个 claim 会锁住全部行，已补显式 `LIMIT 1` 后验证两个实际 Worker 可同时 claim 不同行。
- P-003-T-002 验证：Database outbox 3/3、Schema profile 2 files/4 tests、真实 Graphile Worker 2/2、API SSE 3/3、Contracts 4/4；Contracts/Database/Worker/API typecheck 与 build、changed-area Prettier、`git diff --check` 全部通过。正式 profile ready 至 `0007`。
- P-003-T-003 基线：Object Store 与 Workspace Core 相对开始提交及 T-003 开始均无 Git 变化；Object Store 已有内容寻址、写临时文件并原子 rename、读取时重验哈希的单对象能力；Workspace Core 已有规范路径/Unicode/大小写碰撞、manifest、materialization journal/atomic replace/recovery 和本地非权威状态语义，但尚无一致性 checkpoint 或 watcher/change 平台端口。
- P-003-T-003 预期范围：新增独立 Object consistency checkpoint 及缺失/损坏/重复/发布前崩溃测试；新增 Workspace UI 无关 watcher/change 事件、atomic replace/local non-authority 平台端口与测试，复用现有路径/manifest/materialization 规则；不实现真实文件监听、同步调度、恢复用户入口或业务权威写入。
- P-003-T-003 完成条件：Object Store 与 Workspace Core 定向/full tests 通过；随后在最新代码状态只运行一次 P-003 六类技术结论和受影响公共兼容关闭门禁，包括 Contracts/Database/API/Worker/Object Store/Workspace Core 静态/测试、真实数据库 API、Identity/Pairing/Workspace/Web/CLI、OpenAPI/路由/依赖/外部 API/AI/LLM/秘密负向、Prettier 与 `git diff --check`；无 core 失败、越界能力或未清理 P-003 进程/临时产物。
- P-003-T-003 实际范围：Object Store 新增 canonical manifest/对象逐一验证、临时文件 sync、原子 hard-link 发布和不可变重放 checkpoint；Workspace Core 新增 watcher/change port、monotonic monitor、安全路径规范化/碰撞拒绝与 `local-replica-non-authoritative` 事件。没有真实 watcher、备份恢复用户入口、同步调度或业务权威写入。
- P-003-T-003 结果：Object Store 2 files/7 tests、Workspace Core 6 files/27 tests 通过；六类 ADR 实现细节全部得到 `passed`，无需替代 ADR；Database 7/28、Worker 1/2、API 7/20、Contracts 1/4、Web 1/5、CLI affected 4/20 及八包 typecheck/build 通过；兼容/依赖/路由/外部 AI/秘密/格式负向通过。
- P-003 阶段关闭：创建 immutable [`phase-003-result.md`](phase-003-result.md)；最终只读数据库 profile ready 至 `0007`、Graphile jobs 0、活动 lease 0；PostgreSQL 正常停止，端口 `55436` listener 0，package/runtime/data/log/jar 五个精确路径全部删除。
- P-004 计划：[`phase-004-plan.md`](phase-004-plan.md) revision 1，SHA-256 `f505ef3f129e91f6b4ea97169134d9b85bdbae34068028e5bc42f79a67c4b79f`；三个顺序任务覆盖精确运行时/CI、真实六服务 Compose 发布栈，以及最终全仓/数据库/兼容/规模/安全/finalization。
- P-004 规划审计：requirements/roadmap/P-001–P-003 result 指纹全部匹配；现有根门禁脚本可复用但无 CI；镜像 Node 24 浮动，Compose 缺独立 Web、Worker/Gateway health 和运行时无外部出口证据；当前宿主无 Docker/Podman/nerdctl/buildah 或 WSL 发行版，T-002 完成前必须取得真实 Linux 容器引擎。
- P-004 三个顺序任务：T-001 精确 Node/pnpm、CI/数据库/规模门禁；T-002 六服务 Compose、health、持久卷和网络隔离；T-003 最终根 check、PostgreSQL/兼容/安全/supplemental 验收并一致生成 result/effective/change-0/completed state。
- P-004-T-001 基线：官方 Node 发布索引存在 `v24.18.0` Windows x64 zip；普通 shell Node 20.13.1、Codex 隔离 Node 24.14.0 均不作为精确版本证据。`.node-version`/`package.json`/`.env.example`/Database Task integration/lockfile 的任务前 SHA-256 分别为 `55075b5e…0700ce`、`8f224344…65afc`、`bb1fa5b2…2fcc5`、`5b2acb11…3a73`、`f1516af6…d973`；`.github` 与 `scripts` 均不存在。
- P-004-T-001 既有证据：Database Task integration 已在真实 PostgreSQL 覆盖深度 20、5,000 Task（<10s core）和 200 同级/199 edge DAG，但尚无 200-DAG P95、额外随机压力或 CI fail-closed environment assertion。
- P-004-T-001 预期范围：新增 CI workflow 与最小跨平台 gate 脚本；固定精确 Node/pnpm；补 Database 最终规模/P95/random 证据；必要时同步根 scripts 与 `.env.example`。不修改业务 Schema、公共路由、P-001–P-003 result 或容器栈。
- P-004-T-001 完成条件：精确 Node 24.18.0/pnpm 11.9.0、frozen lock、CI workflow/负向、真实 PostgreSQL 空库/重复 migrate/profile/Database scale-P95-random、相关 test/typecheck/build、changed-area Prettier 与 `git diff --check` 全部通过；数据库与临时运行时精确关闭。
- P-004-T-001 实际范围：新增 `.github/workflows/ci.yml` 的 Node/pnpm/frozen install/PostgreSQL 17/双 migrate/根 check required job；新增 `scripts/ci/verify-toolchain.mjs`，对精确版本和两个数据库目标 fail-closed 且不输出连接串；根 `package.json` 增加 `ci`/`ci:verify`；Database Task integration 在既有 200 DAG 上增加 40 次完整 nodes+edges read P95，并增加三个确定性随机 96-node/160-edge DAG seed 与确定反向环拒绝。
- P-004-T-001 结果：官方 Node `v24.18.0` Windows x64 ZIP SHA-256 `0ae68406…26e821` 与发布清单完全一致；pnpm `11.9.0`。preflight 正向退出 0，缺 database 与 Node 24.14 分别退出 1；frozen lockfile-only 校验无新 lock diff。首次空库和重复 migrate 成功，profile ready 至 `0007`；Database 2 files/9 tests 通过，40 样本 200-DAG read P95 `0.872 ms`，三 random seeds 通过。
- P-004-T-001 偏差与处置：官方 Node/PostgreSQL 大文件因 Schannel 多次提前关闭，仅通过 Range 续传且最终 SHA-256/SHA-512 完全匹配后使用。随机测试首版用“末→首”假设成环，真实数据库正确接受了无路径时的合法边；测试夹具改为反转已存在边形成确定 2-node cycle，生产逻辑未改，重跑通过。一次同 shell 静态构建观察到 tsbuildinfo/dist EPERM，独立同版本重跑立即通过且无活动任务 Node 进程或只读属性。
- P-004-T-001 环境关闭：P-004 PostgreSQL 17.10 正常停止，`55437` listener 0，package/runtime/data/log/jar/sha 六个精确路径不存在。官方 Node 24.18.0 archive/checksum/runtime 保留在三个记录的 P-004 task-owned 路径，供 T-002/T-003 继续使用并在 phase close 精确清理。
- P-004-T-002 基线：任务前 `Dockerfile`/`compose.yaml`/`.dockerignore`/`deploy/Caddy.Dockerfile`/`deploy/Caddyfile`/Worker index/package/CI workflow SHA-256 分别为 `43a69c1e…8a4fc`、`8388da95…20731`、`79c2f716…3a8d0`、`7bb127de…9c0c`、`8dc284cc…7325`、`838353d7…2f79a`、`ebe5e199…b9251`、`c6be5c72…08d79`。API 已有 live/ready；Worker 只有启动时 profile check 和 ready log；Gateway 直接承载 Web，无独立 Web 服务。
- P-004-T-002 容器运行时：官方便携 Podman `6.0.2` ZIP SHA-256 `2c055d36…1b78e` 匹配；客户端可运行。WSL layer 已按 OCI manifest 完整下载为 `249,426,976` bytes，SHA-256 `e22b4f68…a5b7ec` 匹配；官方 Docker Compose `v2.40.3` 为 `77,739,008` bytes，SHA-256 `4c864dd7…e1532` 与发布清单匹配。命名 machine `ngapd-p004` 初始化时确认宿主未启用 WSL；machine list 仍为 `[]`。备用 Hyper-V provider 的官方 manifest/层可解析，但宿主没有 `vmms` 服务或 Hyper-V PowerShell 模块，不能作为可用 provider；未下载其 1,099,504,009-byte layer。
- P-004-T-002 预期范围：精确 Node 24.18.0/pnpm 11.9.0 镜像；独立 Web 与 Gateway；Worker live/ready；六服务 health/depends_on、对象/备份/数据库卷、非 root、仅 Gateway 宿主入口和 API/Worker internal network；可重跑 Compose smoke 与 CI compose job。唯一 smoke project 为 `ngapd-p004-smoke`，宿主 HTTP/HTTPS 端口使用非特权 P-004 专用值。
- P-004-T-002 完成条件：真实 Podman Linux engine + Docker Compose CLI 下 config、全镜像 build、空卷 up、六服务状态/health、Gateway Web/API、重复 migrate、容器用户/端口/卷和 API/Worker 外部网络负向全部通过；down 后无 smoke 容器/网络/卷，machine 与 task-owned downloads 最终按 phase recovery 管理。
- P-004-T-002 实际范围：锁定 Dockerfile 的 Node 24.18.0/pnpm 11.9.0/Caddy 2.10.2；增加独立 Web 镜像和 Web/Gateway health；Worker 增加只读 live/ready server并把 ready 绑定到 runner 与正式 Schema profile；Compose 扩为 PostgreSQL/migrate/API/Worker/Web/Gateway 六服务，增加 depends-on health、五个持久卷、非 root/read-only/no-new-privileges、仅 Gateway 端口和 internal backend；增加可清理的 `ngapd-p004-smoke` build/up/assert/down 脚本和 CI Compose job。真实 clean build 另暴露并修复根 workspace 构建顺序、Docker context 携带 `*.tsbuildinfo`、Caddy 基础镜像无运行用户/低端口 file capability，以及 Podman `EXPOSE` 的 `:0` publisher 兼容语义。
- P-004-T-002 结果：Podman 6.0.2 WSL machine 与 Docker Compose 2.40.3 下，六服务 config/full image build/首次空卷 up/health 全部通过；Gateway HTTPS 可达 Web/API live/ready；第二次 migrate no-op；API/Worker/Web/Gateway UID 均非 0；对象/备份卷经 API 重启后保持；API/Worker 外部请求失败且无实际宿主 PortBindings；随机数据库密码未出现在日志。最终 smoke 输出 `services:6`、`applicationEgress:"blocked"`、`persistentVolumes:"verified"` 并退出 0。
- P-004-T-002 环境关闭：`down --volumes --remove-orphans` 后，专用 project 容器、网络、五个卷均为空。唯一 machine `ngapd-p004` 继续运行，只为同阶段 T-003 最终 PostgreSQL/Compose 门禁保留；三张官方基础镜像已用逐 blob SHA-256 校验的离线 OCI archive 预载，须在 P-004 关闭时与 machine/task-owned 工件精确清理。
- P-004-T-003 基线：分支 HEAD 仍为用户保存提交 `19cc33070b0e90646a80259e457cfdbc78b76d0c`；T-002 post-task 工作树只包含 `.dockerignore`、`Dockerfile`、`deploy/Caddy.Dockerfile`、`package.json`、`scripts/compose/smoke.mjs` 与本 state 的已解释修改，`git diff --check` 通过。当前无 smoke 容器/网络/卷，machine `ngapd-p004` running。
- P-004-T-003 预期范围与完成条件：冻结最终产品代码后，在精确 Node 24.18.0/pnpm 11.9.0 与隔离 PostgreSQL 17.10 上只运行一次根 `pnpm check`，完成 full integration、三原型、兼容/依赖/路由/秘密/网络/租户/单写者与最终 Compose 门禁；随后清理全部 task-owned 环境并按 result → effective requirements → change-0 → completed state 顺序封存。任一 core/hard/影响未知失败停止 finalization。
- P-004-T-003 实际范围：最终根 lint 暴露的四个纯静态问题只在对应测试文件改为 type-only import，并从 `task-lifecycle-repository.ts` 删除两个未使用 import；没有改变产品行为、Schema、公共契约或依赖。其余工作仅为验证、只读审查和本工作流证据。
- P-004-T-003 最终根与数据库：唯一隔离 PostgreSQL `17.10` 只绑定 `127.0.0.1:55438`，正式 profile 为 `m0-domain-baseline` v1，`0001`–`0007` 首次 migrate 后第二次 no-op。在精确 Node `24.18.0` / pnpm `11.9.0` 和非空 `DATABASE_TEST_URL` 下，唯一一次完整执行到底的根 `pnpm check` 退出 0：format、ESLint、确定性 build、10 workspace typecheck 与全部适用测试通过。
- P-004-T-003 原型与兼容：Workspace Sync 的 Workspace Core 27/27 和 fixtures 40/40、Task UI 的 fixtures 40/40 与 Web 5/5、Agent Context 无头 runner 12/12 通过；Agent Context 三档 80 次 P95 分别为 `0.683 ms`、`1.259 ms`、`0.576 ms`。公共路由没有 `/api/v1/projects` 或 `/api/v1/tasks`，Web/CLI 没有 Domain/Database/Object Store 服务端依赖，Identity/Pairing/Workspace 兼容范围无 T-003 产品 diff。
- P-004-T-003 安全与整合：外部 API/AI/LLM/WebSocket、凭据材料与生产 debug 扫描通过；最终数据库活动租约、待处理 Outbox、重复活动租约组均为 0。最终 Compose smoke 在最新代码状态再次完成全镜像构建、六服务健康、Gateway Web/API、重复迁移、非 root、持久卷、API/Worker 无外网、无宿主直暴露、秘密日志负向和 clean down，输出 `services:6`、`applicationEgress:"blocked"`、`persistentVolumes:"verified"` 并退出 0。
- P-004-T-003 findings 结论：FR-001–FR-028 与 AC-001–AC-026 core 全部通过；AC-027 的 200-DAG 40 样本 P95、AC-028 的三个确定性随机 DAG seed、AC-029 的 Object checkpoint/查询与运行诊断均通过。无 `FND-I-*`，验证结论为 `passed`。
- P-004-T-003 环境关闭：删除唯一最终 PostgreSQL 容器后 `55438` 无 listener；停止并删除唯一 `ngapd-p004` machine 后 Podman machine list 与 WSL 发行版列表均为空；无 `podman`/`docker-compose`/`wslhost` 进程或 `18443`/`18080` listener。25 个逐项解析且位于 `C:\tmp` 的 Node/Podman/Compose/OCI/archive/log/script 路径已删除，P-004 名称扫描为空。
- 运行时：Codex 隔离运行时 Node.js `24.14.0`、pnpm `11.9.0`，满足 `package.json` 的 `>=24 <25`；`.node-version` 为 `24.18.0`，补丁差异保留到最终发布门禁复核。
- 数据库执行环境：PATH、`C:\Program Files\PostgreSQL\17` 与 Docker 仍无系统入口；P-002 使用的 task-owned PostgreSQL 17.10 只连接回环 `55435/ngapd_m0_domain_p002`。阶段关闭后 server 已停止、端口无监听，runtime/data/log/jar 四个精确临时路径已删除。

## 4. 已完成任务

| 任务 | 完成时间 | 结果 | 证据 |
| --- | --- | --- | --- |
| P-001-T-001 | 2026-07-27T00:51:40+08:00 | 正式标识、任务树与有效 Owner 领域契约完成 | Node 24.14.0；Domain test 7 files/33 tests passed；typecheck/build passed |
| P-001-T-002 | 2026-07-27T00:59:24+08:00 | 正式图、生命周期、影响、授权与 Workspace 协调端口完成 | Node 24.14.0；Domain test 11 files/54 tests passed；typecheck/build passed |
| P-001-T-003 | 2026-07-27T01:08:03+08:00 | 正式运行时 Schema、错误目录和 M0 固定规模 fixture 完成 | Contracts 3/3、Fixtures 40/40、Domain 54/54；三包 typecheck/build；API 3/3、CLI 定向 16/16 |
| P-002-T-001 | 2026-07-27T01:36:56+08:00 | 正式 profile、显式破坏性重建、空库 Schema 与既有 Repository 最小兼容完成 | PostgreSQL 17.10；错误确认退出 1、精确 reset 成功；Database 4 files/13 tests、typecheck/build passed；两轮 Schema 指纹一致 |
| P-002-T-002 | 2026-07-27T01:54:20+08:00 | 正式 Task/graph Repository、递归 Owner、稳定锁、幂等与数据库 guard 完成 | Task/graph targeted 7/7；Database 5 files/20 tests、typecheck/build passed；20 并发、深度 20、200 DAG、5,000 Task 与两种锁交错通过 |
| P-002-T-003 | 2026-07-27T02:24:32+08:00 | Task completion/reopen/Owner 与 Workspace 原子协调、不可变快照和失败审计完成 | Lifecycle 5/5、Database 6 files/25 tests、API 4 files/12 tests；七个故障点重复回滚；typecheck/build passed |
| P-003-T-001 | 2026-07-27T02:52:58+08:00 | 模块边界、统一错误、server actor 与内部 Task 应用端口完成 | API application/module 5/5；Database Task/lifecycle 12/12；Contracts 3/3；Contracts/Database/API typecheck/build passed |
| P-003-T-002 | 2026-07-27T03:17:14+08:00 | 前向事件投影、Outbox/Graphile Worker 与认证 SSE cursor 完成 | Database outbox 3/3、profile 4/4；真实 Graphile Worker 2/2；API SSE 3/3；Contracts 4/4；四包 typecheck/build passed |
| P-003-T-003 | 2026-07-27T03:41:13+08:00 | Object consistency checkpoint、Workspace 平台端口和 P-003 技术/兼容关闭完成 | Object Store 7/7、Workspace Core 27/27；Database 28/28、Worker 2/2、API 20/20、Web 5/5、CLI affected 20/20；八包 typecheck/build passed |
| P-004-T-001 | 2026-07-27T04:05:56+08:00 | 精确运行时、可执行 CI/数据库门禁与最终规模 supplemental 证据完成 | Node 24.18.0/pnpm 11.9.0；preflight 正/负；frozen lock；双 migrate/profile；Database 2 files/9 tests，P95 0.872 ms，3 random seeds；typecheck/build/format/lint/diff passed |
| P-004-T-002 | 2026-07-28T00:18:10+08:00 | 六服务 Compose 发布栈、clean image build、健康、网络与持久卷门禁完成 | Podman 6.0.2/WSL2 + Compose 2.40.3；六服务 build/up/health、Gateway Web/API、repeat migrate、4 个非 root 用户、卷重启、API/Worker egress/ports、secret logs、down cleanup passed |
| P-004-T-003 | 2026-07-28T00:37:06+08:00 | 最终根、PostgreSQL、原型、兼容、安全、supplemental 与 Compose 整体验收完成 | Node 24.18.0/pnpm 11.9.0 根 `pnpm check` 退出 0；PostgreSQL 17.10/profile/双 migrate；三原型 core；边界/秘密扫描；最终六服务 Compose smoke 全部 passed |

当前已完成 3/3 个 P-001、3/3 个 P-002、3/3 个 P-003 和 3/3 个 P-004 任务。

## 5. 运行累计文件变化

| 文件 | 修改模式 | 归属与目的 |
| --- | --- | --- |
| `docs/requirements/m0-domain-baseline/requirements.md` | pre-existing | 用户提供的产品权威；本次规划未修改 |
| `docs/requirements/m0-domain-baseline/workflow-contract.md` | pre-existing | 用户提供的 schema 3.2 合同；本次规划未修改 |
| `docs/requirements/m0-domain-baseline/implementation-plan.md` | add | 初始四阶段路线图 revision 1 |
| `.github/workflows/ci.yml` | add | 精确 Node/pnpm、PostgreSQL、双迁移与根 required gate |
| `scripts/ci/verify-toolchain.mjs` | add | CI 精确工具链和数据库环境 fail-closed 预检 |
| `.dockerignore` | modify | 排除可再生 `*.tsbuildinfo`，防止 clean image build 误跳过 TypeScript emit |
| `package.json` | modify | 增加 `ci`、`ci:verify`、`compose:smoke` 入口和确定性 packages/apps 构建顺序 |
| `Dockerfile` | modify | 锁定镜像运行时并生成非 root API/Worker/独立 Web targets；显式 Caddy UID/GID 并移除不需要的低端口 capability |
| `compose.yaml` | modify | 六服务依赖、健康、持久卷、权限、端口与 internal network |
| `deploy/Caddy.Dockerfile` | modify | 锁定并以显式 UID/GID 10001 非 root Gateway 运行 Caddy，移除不需要的低端口 capability |
| `deploy/Caddyfile` | modify | Gateway live/ready、API health/API 与独立 Web 反向代理 |
| `deploy/Web.Caddyfile` | add | 独立静态 Web 服务与 live/ready |
| `apps/worker/src/health-server.ts` | add | Worker live/ready 只读健康端点 |
| `apps/worker/src/health-server.test.ts` | add | Worker liveness/readiness/fail-closed 测试 |
| `apps/worker/src/index.ts` | modify | runner/profile readiness 与健康 server 生命周期 |
| `scripts/compose/smoke.mjs` | add | 唯一 project 的真实 config/build/up/assert/down 门禁；默认 pull，支持显式逐 blob 校验后的离线预载恢复，并兼容证明无 host binding 的 Podman `:0` publisher |
| `docs/requirements/m0-domain-baseline/execution/initial/phase-001-plan.md` | add | 当前 P-001 expanded 阶段计划 revision 1 |
| `docs/requirements/m0-domain-baseline/execution/initial/phase-002-plan.md` | add | 当前 P-002 expanded 阶段计划 revision 1 |
| `docs/requirements/m0-domain-baseline/execution/initial/phase-002-result.md` | add | P-002 immutable completed/passed 证据 |
| `docs/requirements/m0-domain-baseline/execution/initial/phase-003-plan.md` | add | 当前 P-003 expanded 阶段计划 revision 1 |
| `docs/requirements/m0-domain-baseline/execution/initial/phase-004-plan.md` | add | 当前 P-004 expanded 阶段计划 revision 1 |
| `docs/requirements/m0-domain-baseline/execution/initial/execution-state.md` | add | 初始运行持久状态 |
| `docs/requirements/m0-domain-baseline/execution/initial/phase-004-result.md` | add | P-004 immutable completed/passed 证据 |
| `docs/requirements/m0-domain-baseline/effective-requirements.md` | add | 应用至 change-0 的可再生成当前有效需求 |
| `docs/requirements/m0-domain-baseline/change-0.md` | add | initial run 不可变实现与验证记录 |
| `packages/domain/src/identifiers.ts` | add | Project/Task Key、Sequence 与不可变 Project Key 领域契约 |
| `packages/domain/src/identifiers.test.ts` | add | 标识规范、拒绝与不可变测试 |
| `packages/domain/src/task-tree.ts` | add | 同项目邻接树、移动和稳定遍历契约 |
| `packages/domain/src/task-tree.test.ts` | add | 树异常、移动与确定性遍历测试 |
| `packages/domain/src/task-owner.ts` | modify | 顶层 Owner 不变量与完成 Owner 固化意图 |
| `packages/domain/src/task-owner.test.ts` | modify | Owner 不变量与固化测试 |
| `packages/domain/src/index.ts` | modify | 导出 P-001 正式领域能力 |
| `packages/domain/src/task-graph.ts` | add | 同级 DAG、依赖请求/接受与关注契约 |
| `packages/domain/src/task-graph.test.ts` | add | 根/普通作用域、权限、stale、冻结与 200 节点 DAG 测试 |
| `packages/domain/src/task-lifecycle.ts` | add | 状态、完成、冻结与 deny/cascade 重开契约 |
| `packages/domain/src/task-lifecycle.test.ts` | add | 状态/冻结/完成与跨 Owner 重开测试 |
| `packages/domain/src/task-impact.ts` | add | 确定性操作影响集合与确认令牌 |
| `packages/domain/src/task-impact.test.ts` | add | 影响覆盖、深度 20 与输入乱序测试 |
| `packages/domain/src/workspace-lifecycle.ts` | add | Task/Workspace 同事务生命周期端口 |
| `packages/domain/src/workspace-lifecycle.test.ts` | add | 完成、重开和 Owner 变化端口测试 |
| `packages/domain/src/authorization.ts` | modify | 用户 Workspace 只读、Agent 意图和 Task 操作授权 |
| `packages/domain/src/authorization.test.ts` | modify | 租户、确认、admin 与 Agent 权限负向测试 |
| `packages/contracts/src/projects.ts` | modify | 正式 Project Key、生命周期、重开策略与版本 Schema |
| `packages/contracts/src/tasks.ts` | modify | 正式 Task 状态/归档、图、依赖请求和影响 Schema |
| `packages/contracts/src/errors.ts` | modify | 稳定 M0 领域/应用错误目录 |
| `packages/contracts/src/domain-contracts.test.ts` | add | TypeBox 运行时与错误目录测试 |
| `packages/contracts/package.json` | modify | 增加限定 `src` 的 Contracts 测试脚本 |
| `packages/contracts/tsconfig.json` | modify | 构建排除测试文件，避免测试生成物进入 `dist` |
| `packages/test-fixtures/src/m0-domain.ts` | add | 深度 20、200 同级与 5,000 活动任务确定性输入 |
| `packages/test-fixtures/src/m0-domain.test.ts` | add | 使用生产 Domain 验证固定规模 fixture |
| `packages/test-fixtures/src/index.ts` | modify | 导出 M0 fixture |
| `docs/requirements/m0-domain-baseline/execution/initial/phase-001-result.md` | add | P-001 immutable completed/passed 证据 |
| `packages/database/package.json` | modify | 增加开发/生产 `reset:m0` 显式入口 |
| `packages/database/src/schema-profile.ts` | add | 正式 profile、迁移前置识别、ready、规范目标与重建 guard |
| `packages/database/src/schema-profile.test.ts` | add | URL/参数/秘密负向与确认解析测试 |
| `packages/database/src/schema-profile.integration.test.ts` | add | 真实 PostgreSQL fail-closed、重复重建与 Schema 指纹测试 |
| `packages/database/src/reset.ts` | add | 目标确认后重建并迁移正式 M0 Schema |
| `packages/database/src/migrations.ts` | modify | profile 元数据与 `0004-m0-domain-baseline` 正式表/约束 |
| `packages/database/src/migrator.ts` | modify | 普通迁移的 empty/formal-only fail-closed 前后检查 |
| `packages/database/src/types.ts` | modify | 正式 Project/Task/graph/lifecycle/audit/outbox Kysely 类型 |
| `packages/database/src/foundation-repository.ts` | modify | 新 Schema 最小兼容：正式 Task Key/sequence 与 graph scope 同事务创建 |
| `packages/database/src/workspace-repository.ts` | modify | 正式 `frozen` Workspace 生命周期类型兼容 |
| `packages/database/src/index.ts` | modify | 导出正式 Schema profile/readiness API |
| `packages/database/src/task-repository.ts` | add | Domain 驱动的 Task/graph/impact/幂等/稳定锁 Repository |
| `packages/database/src/task-repository.integration.test.ts` | add/modify | 真实 PostgreSQL Task Key、递归 Owner、DAG、请求、移动、规模、并发、200-DAG P95 与随机 seed 证据 |
| `packages/database/src/task-lifecycle-repository.ts` | add | completion/reopen/Owner 变化的原子 Task/Workspace 协调 |
| `packages/database/src/task-lifecycle-repository.integration.test.ts` | add | 事务成功、重复、故障注入、冻结、重开和 Owner 变化证据 |
| `apps/api/src/workspace.integration.test.ts` | modify | 使用合法正式 Project Key 的 Workspace API seed |
| `apps/api/src/workspace-cli.integration.test.ts` | modify | 使用合法正式 Project Key 的 Windows CLI seed |
| `apps/api/src/application-errors.ts` | add | 集中稳定应用错误与 Task failure 映射 |
| `apps/api/src/modules/identity/errors.ts` | modify | 保留旧模块导入的兼容重导出 |
| `apps/api/src/modules/module-boundaries.ts` | add | 九个 M0 API 模块归属和允许依赖契约 |
| `apps/api/src/modules/module-boundaries.test.ts` | add | 模块目录完整与负向依赖测试 |
| `apps/api/src/modules/tasks/service.ts` | add | server actor 驱动的内部 Task command/query 应用端口 |
| `apps/api/src/modules/tasks/index.ts` | add | 导出内部 Tasks 应用端口 |
| `apps/api/src/modules/tasks/service.integration.test.ts` | add | 租户、错误、audit/outbox 和 lifecycle 组合证据 |
| `packages/contracts/src/events.ts` | add | 单调 cursor 与只失效通知的 SSE runtime/TS 契约 |
| `packages/database/src/outbox-repository.ts` | add | `LIMIT 1 FOR UPDATE SKIP LOCKED` claim、幂等投影/retry 与授权 cursor read model |
| `packages/database/src/outbox-repository.integration.test.ts` | add | 提交/回滚、失败重试、显式双消费者、幂等投影与租户/cursor 证据 |
| `apps/worker/src/outbox-task.ts` | add | 可测试的 Graphile `outbox_dispatch` task 与持续调度 |
| `apps/worker/src/outbox-task.integration.test.ts` | add | 两个真实 Worker 的 barrier、唯一投影与 Graphile retry 证据 |
| `apps/worker/src/index.ts` | modify | 正式 Schema-ready 后启动 Worker 并登记 outbox job |
| `apps/worker/package.json` | modify | 增加 Database workspace 依赖和测试脚本 |
| `apps/api/src/modules/events/service.ts` | add | 授权 replay 与稳定 cursor-expired 映射 |
| `apps/api/src/modules/events/routes.ts` | add | session/Bearer 认证、租户过滤、replay/heartbeat/断开 SSE |
| `apps/api/src/modules/events/events.integration.test.ts` | add | 认证、OpenAPI、租户/秘密负向、replay 与 expired 集成证据 |
| `apps/api/src/app.ts` | modify | 注册 additive `/api/v1/events` 与可控事件流参数 |
| `apps/api/src/index.ts` | modify | readiness 从 ping 收紧为正式 Schema profile ready |
| `packages/object-store/src/consistency-checkpoint.ts` | add | canonical manifest/object 验证与原子不可变内容寻址 checkpoint |
| `packages/object-store/src/consistency-checkpoint.test.ts` | add | 缺失/损坏/重复、发布前后崩溃和不可变证据 |
| `packages/object-store/src/index.ts`、`package.json` | modify | 导出 checkpoint 并声明 Workspace Core manifest 依赖 |
| `packages/workspace-core/src/workspace-platform.ts` | add | UI 无关 watcher/change、monotonic monitor、安全路径与 non-authority 端口 |
| `packages/workspace-core/src/workspace-platform.test.ts` | add | 生命周期、路径逃逸、Unicode/大小写碰撞与非权威事件证据 |
| `packages/workspace-core/src/index.ts` | modify | 导出平台端口 |
| `docs/requirements/m0-domain-baseline/execution/initial/phase-003-result.md` | add | P-003 immutable completed/passed 证据 |
| `pnpm-lock.yaml` | modify | Database→Domain、Worker→Database、Object Store→Workspace Core 三个 workspace link 增量 |

除显式记录的内部 Task 应用端口、additive SSE、Worker/outbox 与两个旧 API seed 外，无 Web/CLI 公共业务能力、Task CRUD、AI/LLM 或生成文件变化。

## 6. 测试与验证证据

| 时间 | 命令或检查 | 结果 | 适用范围 |
| --- | --- | --- | --- |
| 2026-07-27 | 只读检查合同、完整需求、相关源码/测试、项目文档、三个原型报告和 Git 状态 | 规划审计通过；schema 3.2、relaxed、core/supplemental 分层及无未决问题成立 | 规划 |
| 2026-07-27 | P-002 滚动规划：重核 contract/state/roadmap/P-001 result 指纹、Database Schema/Repository/测试与 Git diff | 前置阶段完整且无需求/路线图漂移；创建且仅创建 P-002 expanded 计划，计划指纹 `d2142acf…87e0d` | P-002 规划 |
| 2026-07-27 | P-004 滚动规划：重核 contract/state/roadmap/P-001–P-003 results、CI/Node/Compose/health 与 Git diff | 前置阶段和指纹完整；创建且仅创建 P-004 expanded 计划，计划指纹 `f505ef3f…c4b79f`；记录真实容器引擎为 T-002 core 前置 | P-004 规划 |
| 2026-07-27 | 官方 Node 24.18.0/pnpm 11.9.0 与 CI preflight | Node ZIP SHA-256 `0ae68406…26e821` 匹配；正向 0、缺 DB 1、Node 24.14 1；frozen lockfile-only 通过且无新 lock diff | P-004-T-001 |
| 2026-07-27 | P-004 首次空库/重复 migrate 与正式 profile | `0001`–`0007` 首次成功、第二次 no-op；profile `ready` 至 `0007` | FR-002、FR-027 / AC-001、AC-022 |
| 2026-07-27 | Database schema-profile + Task final gate | 2 files/9 tests 通过；depth 20、5,000 Task、200 chain DAG；40 次 nodes+edges read P95 `0.872 ms`；3 个 96-node/160-edge random DAG seeds 与确定反向环拒绝通过 | AC-025 core；AC-027–AC-028 supplemental |
| 2026-07-27 | T-001 ESLint/Prettier、Database typecheck/build、`git diff --check` | 全部通过；workflow YAML 被 Prettier parser 接受 | P-004-T-001 工程门禁 |
| 2026-07-27 | P-004-T-001 PostgreSQL 清理 | server 停止；55437 listener 0；package/runtime/data/log/jar/sha 六个精确路径不存在 | P-004-T-001 环境关闭 |
| 2026-07-27 | Worker health/full test、typecheck/build、相关 ESLint/Prettier、`git diff --check` | health 2/2；Worker 2 passed/2 skipped；静态、构建和工作树卫生通过 | P-004-T-002 partial |
| 2026-07-27 | Docker Compose v2.40.3 `config --quiet/services/volumes` | 发布 SHA-256 `4c864dd7…e1532` 匹配；六服务和五持久卷可解析 | P-004-T-002 partial；非真实启动证据 |
| 2026-07-27 | Podman 6.0.2 WSL/Hyper-V provider 探测 | WSL image SHA-256 `e22b4f68…a5b7ec` 匹配，但 WSL 功能未启用；Hyper-V 管理服务/模块不存在；machine list `[]` | AC-023 core blocker |
| 2026-07-28 | WSL/Podman machine 恢复 | 用户证据与宿主复核：WSL 2.7.11.0、内核 6.18.33.2-2、默认 WSL2、无发行版；唯一 `ngapd-p004` 从已校验 WSL image 初始化并提供默认 Docker npipe，Podman info 为 Linux/amd64 6.0.2 | Q-001 resolved / T-002 runtime |
| 2026-07-28 | 官方基础镜像分块 OCI 预载 | Docker Hub 长流重复 EOF 后，1 MiB Range 续传并逐 manifest/config/layer 大小+SHA-256 校验；Node manifest `d45d78e7…352d6`/80,292,593 bytes，Caddy `d8c17a86…16b83`/22,511,111，PostgreSQL `af194ccf…c746a`/117,155,648；Podman inspect digest 一致 | T-002可信离线恢复 |
| 2026-07-28 | clean image build 诊断与修复 | 真实构建依次暴露 workspace 顺序、宿主 tsbuildinfo、缺失 Caddy 用户/file capability；均以确定性根因修复，最终 6 packages/4 apps clean build 与五个应用镜像构建通过 | FR-027 / AC-022–AC-023 |
| 2026-07-28 | `NGAPD_COMPOSE_VERIFIED_PRELOAD=1 pnpm compose:smoke` | 六服务首次空卷 up/health；Gateway Web/API；repeat migrate；API/Worker/Web/Gateway 非 root；对象/备份卷跨 API restart；API/Worker egress blocked、无实际 host binding；密码日志负向；最终 JSON 通过并退出 0 | FR-027 / AC-001、AC-023、AC-026 |
| 2026-07-28 | 精确 Node/pnpm 根 build 与 T-002 hygiene | Node 24.18.0/pnpm 11.9.0 根 build 通过；smoke Prettier/ESLint、Compose config、`git diff --check` 通过 | T-002 post-task |
| 2026-07-28 | T-002 专用资源清理 | Compose ps、Podman project containers/volumes/networks 均为空；machine `ngapd-p004` 仅为同阶段 T-003 保留 | T-002 environment close |
| 2026-07-28 | T-003 最终 PostgreSQL migrate/profile 与根门禁 | PostgreSQL 17.10；正式 profile v1、`0001`–`0007`、第二次 migrate no-op；精确 Node 24.18.0/pnpm 11.9.0 下唯一完整根 `pnpm check` 退出 0 | FR-001–FR-027 / AC-001–AC-022、AC-025–AC-026 |
| 2026-07-28 | 三份原型核心回归 | Workspace Core 27/27 + fixtures 40/40；Task UI fixtures 40/40 + Web 5/5；Agent Context 12/12，三档 80 次 P95 `0.683/1.259/0.576 ms` | FR-024、FR-026、FR-028 / AC-019–AC-020、AC-024–AC-025 |
| 2026-07-28 | 最终兼容、依赖、路由与安全扫描 | 无公共 Project/Task CRUD；Web/CLI 无服务端实现依赖；无 AI/LLM/WebSocket、凭据材料或生产 debug；活动 lease、pending outbox、重复 active lease group 均 0 | FR-017–FR-026、FR-028 / AC-017–AC-021、AC-024、AC-026 |
| 2026-07-28 | 最新代码状态最终 Compose smoke | clean 全镜像 build；六服务 health；Gateway Web/API；repeat migrate；非 root；持久卷；API/Worker egress blocked；无 host binding/秘密日志；clean down，退出 0 | FR-027 / AC-001、AC-023、AC-026 |
| 2026-07-28 | supplemental 最终汇总 | 200-DAG 40 样本 P95 `0.872 ms`；三个 96-node/160-edge random DAG seed；Object checkpoint 与查询/运行诊断均通过 | AC-027–AC-029 |
| 2026-07-28 | P-004 最终环境清理 | 最终 PostgreSQL 容器、`ngapd-p004` machine、WSL 发行版、任务进程/端口与 25 个精确 `C:\tmp` 路径全部为空；`git diff --check` 通过 | P-004 environment close |
| 2026-07-28 | initial finalization | P-004 result SHA-256 `8b9e9681…e1322f`、effective requirements `69959b7b…a9d728`、change-0 `16674766…0d7ed`；四阶段/12 任务、FR/AC、findings 与环境状态交叉一致 | initial completed/passed |
| 2026-07-27 | PostgreSQL/Docker 入口探测与既有 Windows 证据复核 | 当前无本地入口或活动目标；仓库证据记录 PostgreSQL 17.10 测试 bundle 的发布 SHA-512 和成功隔离运行，实施前必须重新取得/核验 | P-002 执行前置，非数据库通过证据 |
| 2026-07-27 | P-002-T-001 实施前 Git/status、Database 逐文件 SHA-256、端口与 postgres 进程探测 | Database 范围无任务前改动；55430–55440 无已观察监听，未发现 postgres 进程；P-001 用户/运行 diff 完整保留 | P-002-T-001 baseline |
| 2026-07-27 | Maven Central bundle 下载 SHA-512；`postgres/initdb/pg_ctl --version` | `8c5a905a…473bcf8` 与发布记录完全匹配；三个二进制均为 PostgreSQL 17.10 | P-002-T-001 可信运行时 |
| 2026-07-27 | `reset:m0` 错误确认与精确确认；两轮 rebuild/migrate/catalog 指纹 | `wrong-target` 原生退出 1 且未清空；精确 `127.0.0.1:55435/ngapd_m0_domain_p002` 成功；空库/重复/第二轮指纹一致；prototype/unknown profile 拒绝 | FR-002 / AC-001 |
| 2026-07-27 | `DATABASE_TEST_URL=<P-002> pnpm --filter @ngapd/database test` | 4 个文件、13 项通过；formal profile、迁移、Foundation/Identity/Workspace 既有集成均通过 | P-002-T-001 |
| 2026-07-27 | Database `typecheck` / `build` | 均通过，Node 24.14.0 / pnpm 11.9.0 | P-002-T-001 |
| 2026-07-27 | Task/graph PostgreSQL 定向测试 | 7/7 通过；20 并发与同键重试、深度 20、5,000 Task、200 sibling/199 edge DAG、request stale、两种显式 lock queue、Key 低层 guard | P-002-T-002 |
| 2026-07-27 | Database `typecheck` / `build` / full test | typecheck/build 通过；5 个文件、20 项 PostgreSQL/unit 测试通过 | P-002-T-002 |
| 2026-07-27 | Lifecycle PostgreSQL 定向测试 | 1 个文件、5 项通过；成功/重放、七个故障点重复回滚、重开、deny/cascade、Owner 变化和低层冻结/不可变 guard 通过 | P-002-T-003 |
| 2026-07-27 | P-002 最终 Database full test / typecheck / build | 6 个文件、25 项测试通过；typecheck/build 通过 | P-002 阶段关闭 |
| 2026-07-27 | P-001 生产规则回归 | Domain 54/54、Contracts 3/3、Test Fixtures 40/40；三包 typecheck/build 通过 | P-002 阶段关闭 |
| 2026-07-27 | `DATABASE_TEST_URL=<P-002> pnpm --filter @ngapd/api test` | 4 个文件、12 项真实数据库/Windows CLI 测试通过；API typecheck/build 通过 | Identity/Pairing/Workspace 公共兼容 |
| 2026-07-27 | 最终 reset/migrate/profile 概要 | 错误目标退出 1；精确 reset 成功；两次 migrate no-op；profile `m0-domain-baseline` v1、6 migrations、28 public tables | FR-002 / AC-001 |
| 2026-07-27 | 公共契约、客户端依赖、API/Worker 路由 diff | Identity/Pairing/Workspace 与应用生产模块相对开始提交无变化；客户端 package 无服务端依赖变化 | P-002 范围与兼容负向 |
| 2026-07-27 | Changed-area Prettier、`git diff --check`、秘密扫描 | 全部通过；无连接串、密码、私钥或凭据进入仓库 | P-002 工件卫生 |
| 2026-07-27 | PostgreSQL server/临时产物清理 | server 正常停止；55435 无监听；runtime/data/log/jar 四个精确路径不存在 | P-002 环境关闭 |
| 2026-07-27 | P-003 PostgreSQL runtime 下载/校验/启动 | Schannel/全量响应截断被拒绝；Range 恢复后完整 23,357,276 bytes，SHA-512 `8c5a905a…473bcf8` 匹配；三个二进制 17.10；只使用 `127.0.0.1:55436/ngapd_m0_domain_p003` | P-003 可信环境 |
| 2026-07-27 | API Tasks application / module boundary 定向测试 | 2 files/5 tests 通过；server actor、create replay、成功/失败审计、outbox、completion 与 missing error 通过 | P-003-T-001 |
| 2026-07-27 | Database Task/graph/lifecycle 受影响回归 | 2 files/12 tests 通过 | P-003-T-001 |
| 2026-07-27 | Contracts runtime test | 1 file/3 tests 通过 | P-003-T-001 |
| 2026-07-27 | Contracts/Database/API typecheck/build | 三包全部通过 | P-003-T-001 |
| 2026-07-27 | Database outbox PostgreSQL 定向测试 | 3/3 通过；提交/回滚、失败 attempt/backoff、显式双消费者、outbox ID 唯一投影、租户过滤与 cursor expiry | P-003-T-002 |
| 2026-07-27 | Database formal profile 定向测试 | 2 files/4 tests 通过；`0007`、重复迁移、双重建指纹与 fail-closed 通过 | P-003-T-002 |
| 2026-07-27 | 真实 Graphile Worker 定向测试 | 2/2 通过；两个实际 runner 以 claim barrier 并发，12/12 唯一投影；Graphile failure/retry 成功 | P-003-T-002 |
| 2026-07-27 | API SSE PostgreSQL 定向测试 | 3/3 通过；认证、OpenAPI 3.1、服务端 membership、秘密负向、cursor replay/expired 与可控断开 | P-003-T-002 |
| 2026-07-27 | Contracts runtime test | 4/4 通过；cursor 与 invalidation-only payload 运行时契约通过 | P-003-T-002 |
| 2026-07-27 | Contracts/Database/Worker/API typecheck/build、changed-area Prettier、`git diff --check` | 全部通过 | P-003-T-002 |
| 2026-07-27 | Object Store / Workspace Core 定向与 full tests | Object Store 2 files/7 tests；Workspace Core 6 files/27 tests 全部通过 | P-003-T-003 |
| 2026-07-27 | P-003 最终 Database / Worker / API full | 真实 PostgreSQL Database 7/28、真实 Graphile Worker 1/2、API 7/20 全部通过；API 两轮小同步约 1501/1505 ms | P-003 阶段关闭 |
| 2026-07-27 | Contracts / Web / Workspace CLI affected | Contracts 1/4、Web 1/5、CLI cli/http/mcp/runtime 4/20 全部通过 | P-003 公共兼容 |
| 2026-07-27 | 八包 typecheck/build 与六类技术结论 | Contracts/Database/Worker/API/Object Store/Workspace Core/Web/CLI 全部通过；ADR 第 16 节六项均 `passed`，无需替代 ADR | FR-025 / AC-021 |
| 2026-07-27 | 契约/依赖/路由/外部 AI/秘密/debug/格式负向 | Identity/Pairing/Workspace 契约无 diff；客户端无服务端包；无 Task/Project 公共路由、外部 AI/LLM/WebSocket、秘密或 debug；Prettier/`git diff --check` 通过 | P-003 范围、安全与兼容 |
| 2026-07-27 | 最终数据库概要与 P-003 环境清理 | profile ready 至 `0007`、Graphile jobs 0、活动 lease 0；server 停止、55436 listener 0、五个精确临时路径不存在 | P-003 阶段关闭 |
| 2026-07-27 | `node --version` / `pnpm --version` | 默认 Node `20.13.1` 不满足门禁；pnpm `11.9.0` 满足 | 环境事实，非通过证据 |
| 2026-07-27 | Codex 隔离 Node/pnpm 版本检查 | Node `24.14.0`、pnpm `11.9.0`；满足根 `engines` 的 Node 24/pnpm 11 范围 | P-001 计划运行时 |
| 2026-07-27 | `pnpm --filter @ngapd/domain test` | 7 个测试文件、33 项测试通过 | P-001-T-001 |
| 2026-07-27 | `pnpm --filter @ngapd/domain typecheck` | 通过 | P-001-T-001 |
| 2026-07-27 | `pnpm --filter @ngapd/domain build` | 通过 | P-001-T-001 |
| 2026-07-27 | `pnpm --filter @ngapd/domain test` | 11 个测试文件、54 项测试通过 | P-001-T-002（含 T-001 回归） |
| 2026-07-27 | `pnpm --filter @ngapd/domain typecheck` | 通过 | P-001-T-002 |
| 2026-07-27 | `pnpm --filter @ngapd/domain build` | 通过 | P-001-T-002 |
| 2026-07-27 | `pnpm --filter @ngapd/domain test` | 11 个测试文件、54 项测试通过 | P-001-T-003 阶段最新 Domain 回归 |
| 2026-07-27 | `pnpm --filter @ngapd/contracts test` | 初次发现 `dist` 陈旧测试副本；限定到 `src` 并清理可再生副本后 1 个文件、3 项测试通过 | P-001-T-003 |
| 2026-07-27 | `pnpm --filter @ngapd/test-fixtures test` | 6 个测试文件、40 项测试通过 | P-001-T-003 |
| 2026-07-27 | Domain/Contracts/Test Fixtures `typecheck` 与 `build` | 三包全部通过 | P-001-T-003 |
| 2026-07-27 | `pnpm --filter @ngapd/api test` | 1 个文件/3 项非数据库兼容测试通过；3 个数据库文件/9 项按既有 `DATABASE_TEST_URL` 条件跳过，未声称数据库套件通过 | P-001 公共兼容定向证据 |
| 2026-07-27 | Workspace CLI 完整测试（额外宽检查） | 17 项通过、5 项因固定 `C:\tmp`/PasswordVault 宿主失败、10 项跳过；没有 CLI/Workspace 代码变化，未声称完整套件通过 | 环境偏差，非 P-001 功能失败 |
| 2026-07-27 | Workspace CLI `cli/http/mcp` 定向测试 | 3 个文件、16 项测试通过 | P-001 公共兼容定向证据 |
| 2026-07-27 | 公共契约哈希、客户端导入与路由 diff | Identity/Pairing/Workspace 哈希未变；客户端无服务端导入；API 模块无变化 | P-001 公共兼容与范围负向证据 |
| 2026-07-27 | Changed-area Prettier、`git diff --check`、调试/临时产物审查 | 全部通过；无秘密、本地配置、调试标记或 Contracts 测试构建残留 | P-001 阶段关闭 |

P-001、P-002、P-003 阶段验证结论均为 `passed`；initial run 总体验证结论在 P-004 完成前保持 `pending`。

## 7. 决策、待确认问题与回答

| ID | 阶段/任务 | 问题 | 已确认事实 | 可选方案与影响 | 需要确认 | 状态 | 用户回答及来源 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Q-001 | P-004 / P-004-T-002 | 如何提供真实 Linux 容器引擎？ | WSL 已启用并重启；默认 WSL 2；无发行版；所有静态 T-002 改动与校验工件已安全保留；无 machine/容器 | 使用已校验的 Podman WSL machine image 初始化唯一 `ngapd-p004`，再运行真实 Compose 门禁 | WSL 2 宿主前置是否已完成 | resolved | 用户在当前消息明确提供：WSL `2.7.11.0`、内核 `6.18.33.2-2`、默认版本 2、发行版列表为空；2026-07-27T23:05:12+08:00 宿主权限复核一致 |

当前无未决问题。已生效决策：

- 初始运行使用用户明确选择的 `relaxed` 策略。
- 当前原型数据库实例可丢弃，但任何破坏性重建仍必须解析并确认准确目标。
- 采用 `phased + expanded`，依据是破坏性正式迁移和既有公共兼容边界。

## 8. 发现项、偏差、风险与阻塞

| ID | 类别 | 严重程度 | 关联需求/验收 | 观察与证据 | 最终功能影响 | 处置 | 置信度 | 建议后续 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |

- 当前无正式 `FND-I-*`。
- 环境风险：默认 Node 20 不能用于 P-001 完成证据；已解析隔离 Node 24.14.0。它满足根引擎范围但低于 `.node-version` 的 24.18.0，最终发布门禁仍需按锁定版本复核；当前不是 finding。
- 已关闭 P-002-T-001 环境前置：可信 PostgreSQL 17.10 已核验并只在回环 `55435` 启动，专用目标已确认；阶段关闭后 server、端口和四个精确临时路径均已清理。
- 已关闭验证偏差：bundle 为精简服务端包，不含 `createdb`/`psql`；首次启动命令在 server ready 后因此退出 1。随后通过项目既有 `pg` 驱动连接 `postgres` 并只创建 `ngapd_m0_domain_p002`，未使用未知客户端或目标。首次 CLI 验证还发现 pnpm 会转发字面 `--`；参数解析已支持该标准分隔符，负向与成功 CLI 重跑通过。
- 已关闭依赖安装偏差：首次 `pnpm install --offline` 因本机元数据不完整停止；非交互 `pnpm install` 首次又因 CI frozen lock 在清理可再生 `node_modules` 后停止。随后用同一 pnpm 11.9.0 执行 `--no-frozen-lockfile` 成功恢复全部 workspace 链接，lockfile 只新增 Database→Domain 三行，typecheck/build/test 通过。
- 已关闭断言校准：move-first 交错中旧 dependency 操作在锁后先命中 `graph_version_conflict`，比再次计算 `cross_parent_dependency` 更早且同样是要求的陈旧拒绝；数据库事实证明 move 完整提交、dependency 为 0，断言按稳定错误顺序校准后两种交错通过。
- 所有规划制品都位于原有未跟踪需求目录内；实施必须继续区分用户原始 requirements/contract 与本运行新增证据。
- 已关闭验证偏差：Contracts 初次构建把测试编译到 `dist`，Vitest 拾取陈旧副本；测试脚本已限定 `src`、tsconfig 已排除测试且可再生副本已删除，随后 test/typecheck/build 通过。
- 已关闭公共兼容偏差：正式 Project Key 约束使 API 的旧测试 seed `S1`/`CLI1` 失败；只把 seed 改为合法 Key，未放宽约束或改变公共行为，API 4 files/12 tests 随后通过。
- 已关闭审计索引偏差：legacy `target_id = null` audit 与 lifecycle 幂等索引冲突，partial index 又不能匹配 `ON CONFLICT`；最终五列 NULL-distinct 唯一索引同时满足两类调用，Database/API 全量回归通过。
- 已关闭 Outbox 并发缺陷：初版 claim 使用 `executeTakeFirst()` 但未显式 `LIMIT 1`，PostgreSQL 因而锁住全部匹配待处理行，双消费者 barrier 超时；查询补 `LIMIT 1 FOR UPDATE SKIP LOCKED` 后 Database 双消费者和两个真实 Graphile Worker 门禁均通过。
- 已关闭 P-003 依赖链接恢复偏差：新增 Worker→Database 与 Object Store→Workspace Core workspace link 后，无交互普通安装两次请求重建可再生 `node_modules` 并在工具边界停止；获准联网的同一 pnpm 11.9.0 完成链接重建。lockfile diff 仅保留三个 workspace link 共 12 行，没有第三方升级；八包静态/构建和相关测试通过。
- 外部环境偏差：额外执行的宽 Workspace CLI 套件复现 5 项固定 `C:\tmp` sandbox/PasswordVault 宿主失败；未修改平台适配器或降低断言。在允许固定测试目录的宿主下，P-003 受影响的 cli/http/mcp/runtime 4 files/20 tests 独立通过。该宽结果不被声称为凭证平台矩阵通过，最终平台门禁仍由 P-004 所有。
- 已关闭 P-004 宿主前置与 AC-023 发布栈：用户离线启用 WSL 2 后，唯一 Podman machine/Compose smoke 完整通过真实六服务 build/up/health/network/volume/down；专用 project 已精确清理。Docker Hub 长流截断通过逐 blob SHA-256 校验 OCI 预载关闭，未接受截断镜像。
- 已关闭 clean image build 缺陷：显式 workspace 构建顺序、排除宿主 tsbuildinfo、显式 Caddy 非 root 用户并移除其不再需要的低端口 file capability 后，clean build 与 strict capability 运行均通过。
- 已关闭 Podman publisher 兼容偏差：`compose port` 对只有 `EXPOSE`、无发布绑定的服务返回 `:0`；Podman `HostConfig.PortBindings={}`、`NetworkSettings.Ports=null`，Compose config 无 ports。smoke 同时断言无非零 PublishedPort/host URL，未降低“无宿主直暴露”门禁。
- 已关闭 T-003 根静态检查偏差：首次根命令在 format 通过后由 ESLint 捕获四个 type-only/unused import，尚未进入完整 build/typecheck/test。只作静态 import 修正并完成定向 Prettier/ESLint 后，同一精确环境唯一一次完整执行到底的 `pnpm check` 退出 0；该偏差没有产品行为影响，不构成 finding。
- 已关闭最终数据库查询校准：首次只读概要误将 profile 当作独立表并使用旧租约列名，查询稳定拒绝且没有写入；根据正式 `system_metadata` 与 `workspace_leases.revoked_at` Schema 重新执行后，profile/migration、Graphile jobs、活动租约和 Outbox 摘要均通过。

## 9. 精确恢复步骤

本 initial run 已完成，不存在可恢复的 partial task、活动数据库、Compose project、Podman machine 或任务临时路径。

1. 复核 requirements、roadmap、四份 phase plan/result、change-0 与 effective requirements 的已记录 SHA-256；不得改写已完成工件。
2. 若只需重新生成派生视图，以 `requirements.md` + 连续 numbered records 为来源重建 `effective-requirements.md`。
3. 若提出产品、验收或实现变化，使用下一个连续编号创建独立 `execution/change-<N>/` change run，并显式选择 strict/relaxed 策略。
4. 不得通过修改本 completed state、P-001–P-004 result、initial roadmap 或 change-0 表达后续变化。

## 10. 最终完成门禁

| 门禁 | 当前状态 |
| --- | --- |
| FR-001–FR-028 全部实现并可追踪 | passed |
| AC-001–AC-026 core 全部有独立通过证据 | passed |
| AC-027–AC-029 supplemental 通过或形成合格 report-only finding | passed；无 `FND-I-*` |
| P-001–P-004 均有 immutable completed result | passed；四份 result 均 completed/passed 且哈希已记录 |
| Node 24/pnpm 11 根工程、数据库迁移与真实并发门禁通过 | passed |
| Identity/Workspace/Web/CLI 与原型核心兼容 | passed |
| Compose 迁移、API/Worker/Web/Gateway/PostgreSQL 健康启动 | passed：真实六服务 build/up/health/network/volume/down 与 clean cleanup |
| 安全、租户、秘密、无外部 API/AI/LLM 与单写者门禁通过 | passed |
| 无未决问题、阻塞、未知文件或不合格 finding | passed；task-owned 环境已清理 |
| `effective-requirements.md` 与 `change-0.md` 一致生成 | passed；哈希已记录 |
