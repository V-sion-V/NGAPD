# P-004：最终工程、发布与整体验收阶段计划

- 运行编号：`initial`
- 阶段编号：`P-004`
- 阶段计划修订：`1`
- 父路线图修订：`1`
- 父路线图指纹（SHA-256）：`eb90885df1246062d407f9284e015de0e0521d93e0e00f35ab5debc21af366ad`
- 需求指纹（SHA-256）：`844c505f9c6b15ae64f217026ba27c7c6ac22dd394f0ce80112a43960a8037d1`
- 项目基线：分支 `codex/m0-domain-baseline`，提交 `7f23d31592c72e258efa613a73ea862b9e0f0289`；P-001/P-002/P-003 位于同一未提交工作树，immutable result 指纹分别为 `cdad119ffe04d74054dbee35e1dda1712f7e90bd5eb2613931e0f1b1b6cb8f8e`、`ada169fd96445f5cbdd0130d3235995e91e3bd8c70317aec02a930438c9dba2a`、`8eae48d2820cc81ae09b5ce4bda111416b2da87a6fb1e5d171516a5455c30006`
- 创建日期：`2026-07-27`
- 计划详细度：`expanded`
- 交付与验证策略：`relaxed`
- 规划验证结论：`ready`
- 实施验证结论：`pending`

## 1. 阶段目标、边界与关联需求

本阶段是初始运行的唯一最终阶段。它不重新设计 P-001–P-003 已通过的领域、数据库和应用语义，而是在最终代码状态补齐可执行 CI 与自托管发布栈，运行一次完整根工程、真实 PostgreSQL、Compose、兼容、规模、安全和 supplemental 验收，并一致生成 `phase-004-result.md`、`effective-requirements.md` 与 `change-0.md`。

阶段结束时：

- `.node-version` 指定的精确 Node.js 24 与 pnpm `11.9.0` 成为本地/CI/镜像一致运行时；根门禁包含格式、静态检查、构建、类型检查、自动化测试和数据库迁移验证，任何失败均使 CI 失败。
- Compose 明确包含 PostgreSQL、一次性迁移、API、Worker、Web 和 Gateway 六类服务；迁移先于应用 ready，API/Worker/Web/Gateway 均有可观察 live/ready 或等价健康证据，数据/对象/备份卷持久，API/Worker 无外部网络出口。
- 在一个隔离 PostgreSQL 17 最终实例上重新证明显式重建、空库与重复迁移、正式 profile、真实锁/并发/失败注入及完整应用回归；不能把内存模拟或原型 Schema 当作通过证据。
- 深度 20、200 同级 DAG、5,000 活动任务主体规模保持正确且无明显卡顿；运行一次 200 节点局部 DAG P95，执行额外确定性随机树/DAG/并发压力和至少一类附加诊断。
- Identity/Pairing/Workspace/Web/CLI、三个原型核心、共享包依赖方向、公共路由边界、租户/秘密/审计/单写者、Outbox/SSE/Object checkpoint 均在最终状态无退化。
- 全部 core、hard gate 和影响未知问题必须通过。只有 AC-027–AC-029 的 supplemental 异常在已有独立 core 证据且影响明确时可分配 `FND-I-*`；高/严重、core 或影响未知问题不得降级。

关联范围为路线图 P-004 行：FR-001–FR-028、AC-001–AC-029。前置阶段未被本阶段相关改动影响的定向证据可引用 immutable result；根 `pnpm check`、最终数据库集成、Compose 和整体验收只在本阶段最终代码状态运行。

阶段边界：

- 不新增完整 Project/Task 公共 CRUD、正式 Task UI、本地 Workspace 同步、Agent 写工具、公共制品发布、缓存集群、监控栈或集中日志。
- 不修改 `requirements.md`、`workflow-contract.md`、`implementation-plan.md` 和 P-001–P-003 plan/result；不重写历史迁移。
- 不为了让 Compose 或 CI 通过而关闭租户过滤、Schema readiness、健康检查、失败测试或安全负向门禁。
- 不提交、推送、发布镜像或变更外部 CI 状态；本阶段只在工作区实现和验证发布候选。

### 1.1 规划时已确认的工程事实

- 根 `package.json` 已定义 `format:check`、`lint`、`build`、`typecheck`、`test` 和顺序 `check`，但仓库没有 `.github/workflows`，也没有独立数据库/Compose 最终门禁脚本。
- `.node-version` 为 `24.18.0`，`packageManager` 为 `pnpm@11.9.0`，引擎为 Node `>=24 <25`/pnpm `>=11 <12`；当前普通 shell 是 Node `20.13.1`，Codex 隔离运行时是 Node `24.14.0`。二者都不能作为“精确 `.node-version`”最终证据。
- `Dockerfile` 和 `deploy/Caddy.Dockerfile` 使用浮动 `node:24-bookworm-slim`，只定义 API/Worker 或由 Gateway 直接承载 Web 静态文件；现有 Compose 没有独立 Web 服务、Worker 健康检查或 Gateway 健康检查，内部服务网络也未禁止外部出口。
- API 已区分 `/health/live` 与 `/health/ready`，ready 检查正式 Schema profile；Worker 在启动前检查正式 Schema，但没有健康端口；Caddy 当前把 `/api/*` 与 `/health/*` 代理给 API。
- 当前宿主没有 Docker/Podman/nerdctl/buildah，标准 Docker Desktop/Podman 路径不存在，WSL 没有已安装发行版。Compose core 证据不能用静态 YAML 检查替代；执行 T-002 前必须取得可运行的 Linux 容器引擎。若无法取得，P-004 必须停在阻塞状态，不能写 passed result 或 `change-0.md`。
- P-003 PostgreSQL 已停止，`55436` 无 listener，五个 task-owned 临时路径不存在。最终 PostgreSQL 必须使用新的 P-004 唯一端口、数据库和临时路径，完成后停止并精确清理。

## 2. 任务与文件范围

### 2.1 任务

| 任务 | 结果 | 文件或范围 | 实现摘要 | 验证 | 完成条件 |
| --- | --- | --- | --- | --- | --- |
| `P-004-T-001` | 精确运行时与可执行 CI/数据库门禁 | `.github/workflows/**`、`.node-version`、`package.json`、必要的 `scripts/ci/**`、数据库最终门禁测试/脚本、`.env.example` | 固定本地/CI/镜像使用同一 Node 24 patch 与 pnpm 11.9.0；建立单个必需 CI job 或明确依赖的 jobs，顺序执行 frozen install、格式、lint、build、typecheck、真实 PostgreSQL 测试、空库/重复迁移/profile/漂移检查；将 20-depth/200-DAG/5,000-task core 和一次 P95/额外随机压力纳入可重跑门禁；失败必须非零退出，不在 CI 日志输出数据库密码 | workflow 语法/静态审查；脚本 unit/negative；可信 PostgreSQL 17 下数据库门禁；Node/pnpm 精确版本、frozen lock、相关 package test/typecheck/build；changed-area Prettier 与 `git diff --check` | CI 从干净安装可执行 FR-027/AC-022 的全部工程与迁移门禁；迁移失败或测试失败会阻塞；规模测试不被 skip；无秘密、浮动包管理器或静默容错 |
| `P-004-T-002` | 六服务 Compose 发布栈与真实健康证据 | `Dockerfile`、`compose.yaml`、`.dockerignore`、`deploy/Caddy.Dockerfile`/`Caddyfile`、必要的 Web/Worker health 配置与测试、`scripts/compose/**` | 精确固定 Node/pnpm 镜像运行时；增加独立 Web 服务并由 Gateway 代理；Worker 提供不改变业务事实的 live/ready 健康端口；迁移完成后 API/Worker 才 ready；为 PostgreSQL/API/Worker/Web/Gateway 定义健康检查和依赖；持久化数据库/对象/备份数据；应用进程非 root；仅 Gateway 暴露宿主端口，API/Worker 位于无外部出口的内部网络；建立可重复 build/up/wait/assert/down smoke，检查迁移 no-op、服务健康、卷和无公共镜像发布 | 容器引擎真实 `compose config`、全镜像 build、首次空卷 up、所有健康、live/ready、Gateway Web/API 访问、第二次 migrate/no-op、API/Worker 外部网络负向、服务用户/端口/卷检查；clean down 后无容器/网络，命名卷按恢复需要保留或对专用 smoke project 精确删除 | PostgreSQL、migrate、API、Worker、Web、Gateway 全部按依赖健康；应用服务无外部出口、无宿主直暴露、秘密不入镜像/日志；专用 smoke 环境可完整清理 |
| `P-004-T-003` | 最终整体验收、findings 汇总与 initial 关闭 | 最终代码与测试、三份原型核心命令、`phase-004-result.md`、`effective-requirements.md`、`change-0.md`、`execution-state.md` | 在最终代码状态只运行一次完整根 `pnpm check`，并在同一可信 PostgreSQL 17 上执行全仓可用真实集成、并发、失败注入、规模/P95/随机压力/诊断；重跑 Identity/Pairing/Workspace/Web/CLI 与三原型核心；审查 OpenAPI/路由/导出、客户端依赖、外部 API/AI/LLM、租户、秘密/日志、单写租约、审计、Outbox/SSE/checkpoint；核对 FR/AC/result 指纹和所有临时环境；按 relaxed 规则汇总 findings，随后一次性生成 immutable result、有效需求快照和 change-0 | 根 check；Database/API/Worker/客户端/原型完整门禁；200 节点 P95 与随机压力；Compose 最终 smoke 引用；静态依赖/路由/秘密/网络扫描；`git diff --check`；result/change/effective/state 交叉校验和 SHA-256 | FR-001–FR-028、AC-001–AC-026 全部 passed，AC-027–AC-029 passed 或仅有合格 report-only finding；无阻塞/未知文件/活动进程/未清临时产物；四个 immutable phase results 与 change-0/effective/state 一致，运行状态 `completed` |

依赖顺序：T-002 依赖 T-001 固定的精确运行时和可重跑门禁；T-003 依赖 T-002 的真实发布栈证据。每个任务必须先写 state `in_progress` 检查点，再改其范围；完成最小充分验证和 post-task 检查点后才能开始下一任务。不得在 T-003 最终状态之前运行声称为最终的根 `pnpm check`。

### 2.2 关键接口、发布与证据所有权

| 事实或接口 | 权威/写入者 | 约束 |
| --- | --- | --- |
| Node/pnpm 版本 | `.node-version`、根 `packageManager`、CI setup 与镜像 tag | 四处必须一致；不得用满足宽引擎但不同 patch 的运行结果冒充精确发布证据 |
| 正式 Schema ready | Database migrator/profile | migrate 是唯一发布时 Schema 写者；API/Worker ready 只读 profile，不能自动隐式迁移 |
| API live/ready | API health route | live 不触碰依赖；ready 必须拒绝空/behind/prototype/unknown Schema |
| Worker live/ready | Worker 健康端口与 runner 生命周期 | live 只表示进程；ready 同时要求正式 Schema 和活动 runner，不暴露业务 mutation |
| Web/Gateway 健康 | 独立 Web 静态服务与 Gateway 代理 | Gateway 是唯一宿主入口；Web 不直连数据库或服务端实现 |
| 运行时网络 | Compose internal application network | API/Worker/PostgreSQL/migrate/Web 无默认外部出口；Gateway 只拥有反向代理所需双网络 |
| CI/最终测试数据库 | 专用 PostgreSQL 17 服务或 P-004 隔离实例 | 只使用明确目标；空库/重建/清理不能触碰用户未知实例 |
| findings 与完成记录 | `execution-state.md` → immutable phase result/change record | core/hard/高严重度不得 report-only；结果创建后不可改写 |

### 2.3 有序实施与检查点

1. T-001 先验证精确 Node 版本可取得，再固定版本与 CI；数据库脚本必须复用正式 migrator/profile 和既有集成测试，不能复制 Schema 或把 skip 当通过。规模/P95 数据必须记录样本量、计时边界和参考环境。
2. T-002 在任何 Compose destructive cleanup 前固定唯一 project name、端口、卷名和绝对临时路径；先补镜像/健康测试，再取得容器引擎执行真实 build/up。Gateway 只代理 API health/API 路径和独立 Web；API/Worker 的无外部出口必须以运行时负向验证，不只看配置。
3. T-003 先冻结最终代码状态，运行根工程与数据库/兼容/安全门禁，再运行最终 Compose smoke；只读汇总后停止 PostgreSQL/Worker/Compose 并精确清理。全部 core 通过后才创建 `phase-004-result.md`，随后从原始 requirements 生成有效需求快照和 `change-0.md` 并将 state 标为 completed。

## 3. 验证与完成条件

### 3.1 任务级最小验证

1. T-001：精确 Node/pnpm/frozen lock；workflow 与 CI 脚本负向；真实 PostgreSQL 空库/重复迁移/profile/漂移、Database 定向 scale/P95/random；相关 package test/typecheck/build。
2. T-002：真实 Linux 容器引擎下 `compose config`、全镜像 build、专用空卷首次启动、六服务状态与 health、Gateway Web/API、重复迁移、网络/用户/端口/卷/秘密负向、down/cleanup。缺少容器引擎时不得把该任务标为完成。
3. T-003：最终状态下完整根 `pnpm check` 一次；最终 PostgreSQL full integration 与三个原型核心；公共兼容/依赖/路由/安全扫描；最终 Compose smoke；文档指纹与环境清理。

### 3.2 P-004 与 initial 最终关闭门禁

| 门禁 | 证据 | 阻塞范围 |
| --- | --- | --- |
| 根工程与 CI | 精确 Node/pnpm、frozen install、format/lint/build/typecheck/test、CI failure semantics | FR-027 / AC-022 |
| 正式数据库 | 显式目标、空库/重复 migrate、profile/drift、真实并发/失败注入/full integration | FR-002–FR-023 / AC-001–AC-018、AC-025 |
| Compose 发布 | 六服务 build/up、迁移依赖、live/ready、Gateway、持久卷、非 root、clean down | FR-027 / AC-001、AC-023 |
| 公共兼容与范围 | Identity/Pairing/Workspace/Web/CLI、三原型、OpenAPI/路由/导出、无越界 M1–M5 能力 | FR-024、FR-026、FR-028 / AC-019–AC-020、AC-024 |
| 技术与安全 | 六类 ADR 结论、租户、秘密/日志、单写者、Outbox 幂等、SSE cursor、checkpoint、API/Worker 无外部网络 | FR-017–FR-026 / AC-018、AC-021、AC-026 |
| 规模与 supplemental | depth 20、200 DAG、5,000 active；P95；额外随机压力；附加诊断 | AC-025 core；AC-027–AC-029 supplemental |
| 工件与环境 | Prettier、`git diff --check`、秘密/临时文件扫描；无活动 P-004 PostgreSQL/Worker/Compose；四 result 指纹、effective/change/state 一致 | workflow finalization |

任一 core、hard gate、高/严重或影响未知失败均停止 finalization。Relaxed 策略只允许 AC-027–AC-029 的异常在主体规模正确性、无明显卡顿/超时和功能无影响已被独立证明后记录 `FND-I-*`。若没有合格 finding，阶段结论为 `passed`；若只有合格 report-only finding，阶段结论为 `passed_with_findings`。

P-004 完成时必须：

- 为三个任务写 durable completed 检查点和实际文件/验证结果；
- 创建 immutable `phase-004-result.md` 并记录指纹；
- 生成与原始需求一致的 `effective-requirements.md` 和 immutable `change-0.md`；
- 把 state 转为 `completed`，验证结论与阶段/finding 一致；
- 停止所有 task-owned PostgreSQL、Worker 和 Compose 进程，精确清理临时路径；不提交、不推送、不发布镜像。

## 4. 风险、恢复与修订记录

### 4.1 风险与控制

| 风险 | 控制与检查点 |
| --- | --- |
| 当前宿主没有容器引擎 | T-001 可先完成；T-002 前取得可验证的 Linux 容器引擎。若不能取得则记录阻塞并停止，静态 YAML 或仅镜像语法不等于 AC-023 |
| `.node-version` 精确 patch 当前本机不可用 | 优先取得权威精确 Node 24 patch；CI 与镜像也固定同一版本。不得把 Node 24.14 的宽引擎通过写成精确发布通过 |
| 全仓测试因数据库环境变量缺失而 skip | CI/final gate 明确注入专用 `DATABASE_TEST_URL` 并对预期 integration test 数量/marker 做 fail-closed 检查 |
| Compose 健康只证明进程而非依赖 ready | API/Worker ready 读取正式 Schema profile；migrate completion 是依赖；首次空卷与 behind/失败负向均验证 |
| Web 与 Gateway 合并掩盖缺失服务 | 建立独立 Web service 和 health，Gateway 只代理；Compose 服务清单和运行状态同时断言 |
| API/Worker 意外具备外部网络 | 应用网络设为 internal，并从运行中容器做外部连接负向；Gateway 不共享业务凭据 |
| root gate/规模压力被重复运行导致长时与噪声 | 任务内使用定向验证，只有 T-003 最终状态运行一次根 `pnpm check`；记录确切命令、样本与耗时 |
| 平台宿主 CLI 宽测试失败被误降级 | core 公共行为必须在合规参考环境通过；PasswordVault/Windows 专属宿主矩阵不在 M0 时只能在独立 core 证据充分且影响明确后判断，不能自动 report-only |
| finalization 文档与实际证据漂移 | 先冻结代码/验证和 findings，再按 result → effective requirements → change-0 → state 的顺序写入并核对 SHA-256/追踪矩阵 |

### 4.2 中断与精确恢复

- 任一任务中断时保留代码和证据，在 state 记录 active task、实际文件、最后通过门禁、第一个未完成步骤、Node/PostgreSQL/Compose 精确状态；不使用 reset/checkout/stash。
- 数据库异常先停止新请求/Worker，读取 profile/migration/outbox/jobs/lease；只有核对 P-004 唯一连接串后才允许显式 reset。Compose 异常先读取 `ps`、health、logs 和 config，不先删卷。
- 容器清理只作用于记录的 P-004 Compose project 和专用 smoke volumes；删除前解析确切名称。数据库临时目录只删除记录的 P-004 package/runtime/data/log/jar 路径。
- finalization 中断时，已创建的 immutable result/change 不得重写；按合同的 recovery 分支核对哈希并只补缺失的后续记录。若 result 尚未创建，则从 state 的最终验证检查点继续。

精确首次恢复步骤：调用 `$implement-planned-feature`，完整读取 contract、roadmap、state、本计划和 P-001–P-003 immutable results，核对 requirements/roadmap/result/phase-plan 指纹及 Git diff；确认 P-003 环境已关闭；随后在任何生产编辑前把 `P-004-T-001` 写为 `in_progress`。

### 4.3 修订记录

| 修订 | 日期 | 结论与依据 | 影响 |
| --- | --- | --- | --- |
| 1 | 2026-07-27 | 初始 P-004 expanded 计划；CI/精确运行时、需要真实容器引擎的六服务发布栈及最终全仓/数据库/规模/安全/finalization 构成三个顺序风险边界 | `P-004-T-001`–`P-004-T-003` |
