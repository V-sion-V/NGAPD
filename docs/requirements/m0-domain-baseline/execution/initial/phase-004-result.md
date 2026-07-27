# M0 initial run：P-004 阶段结果

- 运行编号：`initial`
- 阶段：`P-004`
- 阶段计划：[`phase-004-plan.md`](phase-004-plan.md)
- 阶段计划修订：`1`
- 父路线图修订：`1`
- 完成日期：`2026-07-28`
- 状态：`completed`
- 交付与验证策略：`relaxed`
- 验证结论：`passed`
- 开始基线：分支 `codex/m0-domain-baseline`，原始项目提交 `7f23d31592c72e258efa613a73ea862b9e0f0289`；P-001–P-003 位于同一候选工作树
- 恢复基线：用户在容器前置阻塞期间将候选保存并推送为 `19cc33070b0e90646a80259e457cfdbc78b76d0c`；该动作不改变原始项目基线或 P-004 任务归属
- 结束基线：HEAD 仍为 `19cc33070b0e90646a80259e457cfdbc78b76d0c`，P-004 结束改动与工作流工件保留在未提交工作树；本阶段未提交、推送或发布制品

## 1. 阶段目标与结果

P-004 已在最终代码状态关闭 M0 的工程、发布、数据库、兼容、安全、规模与 initial run 验收：

- `.node-version`、根 `packageManager`、CI 与镜像统一到 Node.js `24.18.0` / pnpm `11.9.0`。CI 先 fail-closed 校验工具链和两个数据库目标，再执行 frozen install、双迁移与根门禁。
- 根构建改为显式 packages→apps 拓扑顺序，clean 容器构建不再受宿主 `tsbuildinfo` 影响。
- Compose 包含 PostgreSQL、一次性 migrate、API、Worker、独立 Web 与 Gateway 六个服务；应用按 Schema/runner readiness 启动，只有 Gateway 暴露宿主端口。
- API、Worker、Web 与 Gateway 均以非 root、只读根文件系统和最小 capability 运行；API/Worker 位于 internal network，真实运行时外部请求被阻断。
- 数据库、对象、备份和 Caddy 数据使用持久卷；API 重启后对象/备份标记保持，第二次 migrate 为 no-op。
- 隔离 PostgreSQL `17.10` 的正式 profile `m0-domain-baseline` v1 与 `0001`–`0007` 迁移通过；真实并发、失败注入、规模、Outbox/Worker、SSE、Workspace 与公共兼容由最终根门禁完整复核。
- 深度 20、200 同级 DAG、5,000 活动 Task 主体规模保持正确；200-DAG 40 次完整 nodes+edges read P95 为 `0.872 ms`，三个确定性随机 DAG seed 和附加诊断通过。
- Workspace Sync、Task UI、Agent Context 三份原型核心复核通过；没有新增 Project/Task 公共 CRUD、正式 Task UI、本地同步或 Agent 写工具。
- FR-001–FR-028、AC-001–AC-026 core 和 AC-027–AC-029 supplemental 全部通过，无 `FND-I-*`。

## 2. 任务、需求与验收覆盖

| 任务 | 状态 | 需求与验收 | 完成结果 |
| --- | --- | --- | --- |
| `P-004-T-001` | completed | FR-002、FR-027；AC-001、AC-022、AC-025、AC-027–AC-028，并复核 FR-001–FR-028 | 精确 Node/pnpm、CI preflight、frozen lock、空库/重复迁移、正式 profile、规模/P95/random、Database 定向静态与构建门禁通过 |
| `P-004-T-002` | completed | FR-027；AC-001、AC-022–AC-023、AC-026 | 真实 Linux 容器引擎下六服务 clean build/up/health、Gateway、重复迁移、非 root、持久卷、网络/端口/秘密负向与 clean down 通过 |
| `P-004-T-003` | completed | FR-001–FR-028；AC-001–AC-029 | 最终根 check、PostgreSQL full integration、三原型、公共兼容、依赖/路由/安全扫描、最终 Compose、findings 和环境收尾通过 |

阶段验收结论：

- FR-001–FR-028 均有生产实现和可追踪验证，未扩大 M0 公共功能边界。
- AC-001–AC-026 core 与全部项目硬门禁通过；没有失败、未知影响或半迁移状态。
- AC-027–AC-029 supplemental 均通过，不需要 `passed_with_findings` 或 report-only 处置。
- P-001–P-003 未受 P-004 工程修正失效；最终根门禁、真实 Compose 和公共边界扫描在最新代码状态复核。

## 3. 文件修改

| 文件或范围 | 修改模式 | 主要目的 |
| --- | --- | --- |
| `.github/workflows/ci.yml` | add | 精确 Node/pnpm、PostgreSQL 17、frozen install、双迁移、根 check 与 Compose smoke CI |
| `scripts/ci/verify-toolchain.mjs` | add | 工具链与数据库环境 fail-closed 预检，不输出连接串 |
| `package.json` | modify | `ci`、`ci:verify`、`compose:smoke` 和确定性 packages/apps 构建顺序 |
| `packages/database/src/task-repository.integration.test.ts` | modify | 200-DAG P95 与三个确定性随机 DAG supplemental 门禁 |
| `.dockerignore` | modify | 排除宿主 `*.tsbuildinfo`，保证 clean 镜像 TypeScript emit |
| `Dockerfile` | modify | 固定 Node/pnpm/Caddy，建立 API/Worker/独立 Web targets 与非 root/capability 约束 |
| `compose.yaml` | modify | 六服务依赖、健康、五个持久卷、权限、唯一 Gateway 端口与 internal backend |
| `deploy/Caddy.Dockerfile` | modify | 固定 Caddy 并以 UID/GID 10001 运行，移除不需要的低端口 file capability |
| `deploy/Caddyfile` | modify | Gateway health、API/health 与独立 Web 反向代理 |
| `deploy/Web.Caddyfile` | add | 独立 Web 静态服务与 live/ready |
| `apps/worker/src/health-server.ts`、`health-server.test.ts` | add | Worker live/ready 只读端点及 fail-closed 测试 |
| `apps/worker/src/index.ts` | modify | runner、正式 Schema readiness 与 health server 生命周期 |
| `scripts/compose/smoke.mjs` | add | 唯一项目的 build/up/assert/restart/repeat-migrate/down 门禁和离线校验镜像恢复 |
| `apps/api/src/modules/tasks/service.integration.test.ts` | modify | type-only import 静态合规 |
| `packages/database/src/schema-profile.integration.test.ts` | modify | type-only import 静态合规 |
| `packages/database/src/task-lifecycle-repository.ts` | modify | 删除未使用 import，不改变运行时行为 |
| `docs/requirements/m0-domain-baseline/execution/initial/phase-004-plan.md` | add | P-004 expanded 阶段计划 revision 1 |
| `docs/requirements/m0-domain-baseline/execution/initial/execution-state.md` | modify | P-004 任务检查点、验证、恢复、findings 与环境收尾权威 |
| `docs/requirements/m0-domain-baseline/execution/initial/phase-004-result.md` | add | 本不可变 completed/passed 阶段结果 |

## 4. 测试与验证

| 命令或检查 | 观察结果 | 结论 |
| --- | --- | --- |
| 精确工具链与 CI preflight | Node `24.18.0`、pnpm `11.9.0`；正向退出 0，缺数据库与 Node 24.14 负向均退出 1；frozen lockfile-only 无漂移 | pass |
| 空库与重复迁移 | PostgreSQL `17.10`；`0001`–`0007` 首次应用，第二次 no-op；正式 profile v1 ready | pass |
| Database 最终规模门禁 | 2 files/9 tests；depth 20、5,000 Task、200 sibling/199 edge DAG；40 次 read P95 `0.872 ms`；三个 96-node/160-edge random seeds 与确定环拒绝 | pass |
| 最终根 `pnpm check` | 精确 Node/pnpm、真实数据库；format、ESLint、确定性 build、10 workspace typecheck 全部通过；Contracts 4、Domain 54、Workspace Core 27、CLI 25、Database 29、Object Store 7、Fixtures 40、API 20、Web 5、Worker 4 项测试通过，平台不适用项按既有条件跳过 | pass |
| Workspace Sync core | Workspace Core 6 files/27 tests；Test Fixtures 6 files/40 tests | pass |
| Task UI core | Task graph fixtures 所在 6 files/40 tests；Web model 1 file/5 tests | pass |
| Agent Context core | 无头 runner 12/12；deep/wide/dense 各 80 次 P95 `0.683/1.259/0.576 ms` | pass |
| 公共兼容与范围 | 根 API/CLI/Web 测试；无公共 `/api/v1/projects` 或 `/api/v1/tasks`；Web/CLI 无 Domain/Database/Object Store 依赖；Identity/Pairing/Workspace 无 T-003 产品 diff | pass |
| 技术与安全 | 六类 ADR 结论保持 passed；无外部 API/AI/LLM/WebSocket、凭据材料或生产 debug；最终数据库 Graphile jobs、活动 lease、pending outbox、重复 active lease group 均为 0 | pass |
| 最终 Compose smoke | Podman 6.0.2/WSL2、Compose 2.40.3；全镜像 build、六服务 health、Gateway Web/API、repeat migrate、四类应用非 root、卷重启、API/Worker egress blocked、无 host binding、秘密日志负向、clean down；退出 0 | pass |
| 工件与环境 | requirements/roadmap/P-001–P-003 result/P-001–P-004 plan 指纹匹配；Prettier、ESLint、`git diff --check` 通过；最终数据库、machine、WSL distro、进程、端口和 25 个 task-owned 临时路径均清理 | pass |

## 5. 发现项与处置

| ID | 类别 | 严重程度 | 关联需求/验收 | 观察与证据 | 最终功能影响 | 处置 | 置信度 | 建议后续 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 无 | 无 | 无 | 无 | 全部 core、硬门禁与 supplemental 通过 | 无 | 无 | 高 | 无 |

验证结论为 `passed`，下一发现项编号仍为 `FND-I-001`。

## 6. 决策、计划偏差与恢复记录

- 无产品需求、验收层级、公共契约或阶段边界变更。
- 宿主最初缺少 Linux 容器引擎。用户离线启用 WSL 2 后，使用校验过的 Podman WSL image 初始化唯一 `ngapd-p004` machine，完成真实 Compose 门禁；最终已删除 machine，未安装或保留通用 Linux 发行版。
- Docker Hub 长流反复 `unexpected EOF`。没有接受截断内容；按 manifest/config/layer 大小与 SHA-256 分块恢复 Node、Caddy、PostgreSQL OCI，并在 Podman 中核对 digest 后用于离线预载。
- 首次真实 clean image build 依次暴露 workspace 构建顺序、宿主 `tsbuildinfo`、Caddy 用户与 file capability 问题；均在 T-002 所有权内作确定性修正，随后 clean build 和 strict runtime 通过。
- Podman 对只有 `EXPOSE` 而无 publish 的服务将 `compose port` 表示为 `:0`；smoke 同时核对 Compose config、`HostConfig.PortBindings={}`、`NetworkSettings.Ports=null` 与非零 PublishedPort 不存在，保持“无宿主直暴露”门禁。
- T-003 首次根命令在 format 通过后由 ESLint 捕获四个 type-only/unused import，未进入完整 build/typecheck/test；静态修正后，唯一一次完整执行到底的根 `pnpm check` 退出 0。
- 首次最终数据库只读概要使用了错误的 profile 表假设和旧租约列名，查询 fail-closed 且没有写入；按正式 Schema 重查后 profile、迁移、Worker、租约与 Outbox 摘要通过。
- 本阶段只在明确的回环数据库、唯一 Compose project、唯一 Podman machine 与逐项记录的临时路径操作；没有接触未知数据库、用户 WSL 发行版、生产服务或公共制品。

## 7. 遗留风险与下一阶段进入条件

- 初始路线图没有下一阶段。P-001–P-004 均已完成且验证结论为 `passed`。
- `change-0.md` 创建后，requirements、workflow contract、initial roadmap、initial execution evidence 和 numbered history 冻结；后续产品变化必须通过新的 schema-v3 change run 表达。
- 本结果没有开放 `FND-I-*`、未决问题、活动服务、迁移半状态或待清理 P-004 临时环境。
