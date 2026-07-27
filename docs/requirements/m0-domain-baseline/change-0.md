# M0：领域基线和工程骨架初始实现记录

- 修改编号：`0`
- 修改类型：`initial implementation`
- 原始需求：[`requirements.md`](requirements.md)
- 初始路线图：[`implementation-plan.md`](implementation-plan.md)
- 执行状态：[`execution/initial/execution-state.md`](execution/initial/execution-state.md)
- 项目基线：分支 `codex/m0-domain-baseline`，原始提交 `7f23d31592c72e258efa613a73ea862b9e0f0289`
- 完成日期：`2026-07-28`
- 交付与验证策略：`relaxed`
- 验证结论：`passed`

## 1. 实现概述

change-0 完成 M0 初始领域基线和工程骨架：

- P-001 将正式 Project/Task 标识、树、有效 Owner、同级 DAG、状态/冻结/重开、影响、授权和 Workspace 生命周期端口落到生产 Domain，并以 TypeBox/TS Contracts 和确定性 fixtures 固定运行时边界。
- P-002 建立可识别、可显式重建的 PostgreSQL 17 正式 Schema/profile、Repository、recursive CTE、稳定 graph lock、幂等 Task Key 与 Task/Workspace/audit/outbox 原子事务。
- P-003 组合九模块应用边界、稳定错误、内部 Task command/query、Graphile Worker/Outbox、授权 SSE、对象一致检查点和 Workspace 平台端口，并关闭六类 ADR 技术验证。
- P-004 固定 Node.js `24.18.0` / pnpm `11.9.0`，建立 fail-closed CI 和六服务 Compose 发布栈，完成最终根、数据库、规模、原型、兼容、安全、网络和 supplemental 验收。

最终产品保持模块化单体、PostgreSQL 和单机自托管 Compose。现有 Identity、Pairing、Workspace、Web 和 Workspace CLI 公共行为保持兼容；没有开放完整 Project/Task CRUD、正式 Task UI、本地 Workspace 同步或 Agent 写工具。

FR-001–FR-028、AC-001–AC-026 core 与 AC-027–AC-029 supplemental 全部通过。没有开放 `FND-I-*`、未决问题、迁移半状态、活动 P-004 服务或未清理任务临时环境。

## 2. 文件修改

### 2.1 生产领域、契约与夹具

| 文件 | 修改模式 | 主要目的 |
| --- | --- | --- |
| `packages/domain/src/identifiers.ts`、`identifiers.test.ts` | add | Project/Task Key、Sequence、规范和不可变验证 |
| `packages/domain/src/task-tree.ts`、`task-tree.test.ts` | add | 同项目邻接树、稳定遍历和移动预检 |
| `packages/domain/src/task-graph.ts`、`task-graph.test.ts` | add | 同级 DAG、依赖请求/接受、stale 和 Follow |
| `packages/domain/src/task-lifecycle.ts`、`task-lifecycle.test.ts` | add | 基础/有效状态、完成、冻结与 deny/cascade 重开 |
| `packages/domain/src/task-impact.ts`、`task-impact.test.ts` | add | 确定性影响集合与确认令牌 |
| `packages/domain/src/workspace-lifecycle.ts`、`workspace-lifecycle.test.ts` | add | Task/Workspace 同事务生命周期端口 |
| `packages/domain/src/task-owner.ts`、`task-owner.test.ts` | modify | 顶层/继承 Owner 与完成固化 |
| `packages/domain/src/authorization.ts`、`authorization.test.ts` | modify | 服务端事实授权、租户、admin/Agent 与 Workspace 策略 |
| `packages/domain/src/index.ts` | modify | 导出正式 M0 Domain 能力 |
| `packages/contracts/src/projects.ts` | modify | 正式 Project Key、生命周期、策略与版本 Schema |
| `packages/contracts/src/tasks.ts` | modify | 正式 Task 状态/归档、图、请求、影响和内部 command DTO |
| `packages/contracts/src/errors.ts` | modify | M0 领域与应用稳定错误目录 |
| `packages/contracts/src/events.ts` | add | SSE cursor 和 invalidation-only runtime 契约 |
| `packages/contracts/src/domain-contracts.test.ts` | add | TypeBox runtime、正式枚举和错误目录验证 |
| `packages/contracts/src/index.ts`、`package.json`、`tsconfig.json` | modify | 导出、测试发现和构建边界 |
| `packages/test-fixtures/src/m0-domain.ts`、`m0-domain.test.ts` | add | depth 20、200 sibling DAG、5,000 active Task 确定性输入 |
| `packages/test-fixtures/src/index.ts` | modify | 导出 M0 fixtures |

### 2.2 PostgreSQL、Repository 与应用集成

| 文件 | 修改模式 | 主要目的 |
| --- | --- | --- |
| `packages/database/src/schema-profile.ts`、`schema-profile.test.ts`、`schema-profile.integration.test.ts` | add | 正式 profile/readiness、迁移 fail-closed、目标确认与真实 PostgreSQL 验证 |
| `packages/database/src/reset.ts` | add | 精确目标确认后的显式破坏性重建 |
| `packages/database/src/migrations.ts`、`migrator.ts`、`types.ts` | modify | `0001`–`0007` 正式 Schema、约束、投影与 profile 迁移 |
| `packages/database/src/task-repository.ts`、`task-repository.integration.test.ts` | add | Task Key、树/Owner/DAG、稳定锁、并发、规模/P95/random |
| `packages/database/src/task-lifecycle-repository.ts`、`task-lifecycle-repository.integration.test.ts` | add | completion/reopen/Owner 与 Workspace 原子协调、故障注入和审计 |
| `packages/database/src/outbox-repository.ts`、`outbox-repository.integration.test.ts` | add | `LIMIT 1 FOR UPDATE SKIP LOCKED`、retry、幂等投影与授权 cursor |
| `packages/database/src/foundation-repository.ts`、`workspace-repository.ts` | modify | 正式 Task/graph seed、Workspace frozen 与扩展审计兼容 |
| `packages/database/src/index.ts`、`package.json` | modify | 正式 profile/Repository 导出、reset 命令与 Domain 依赖 |
| `apps/api/src/application-errors.ts` | add | 集中 ApplicationError 与稳定 HTTP/recovery 映射 |
| `apps/api/src/modules/module-boundaries.ts`、`module-boundaries.test.ts` | add | 九模块归属与允许依赖目录 |
| `apps/api/src/modules/tasks/index.ts`、`service.ts`、`service.integration.test.ts` | add | server actor 驱动的内部 Task command/query 及真实数据库验证 |
| `apps/api/src/modules/events/index.ts`、`service.ts`、`routes.ts`、`events.integration.test.ts` | add | 认证、租户过滤、replay/expired/heartbeat SSE |
| `apps/api/src/app.ts`、`index.ts` | modify | 注册 additive events 并将 readiness 收紧为正式 profile |
| `apps/api/src/modules/identity/errors.ts` | modify | 集中错误的兼容重导出 |
| `apps/api/src/workspace.integration.test.ts`、`workspace-cli.integration.test.ts` | modify | 使用正式合法 Project Key 的兼容 seed |
| `apps/worker/src/outbox-task.ts`、`outbox-task.integration.test.ts` | add | 可测试 Graphile outbox task、双 Worker 与 retry |
| `apps/worker/src/health-server.ts`、`health-server.test.ts` | add | Worker live/ready 只读健康端点 |
| `apps/worker/src/index.ts`、`package.json` | modify | 正式 Schema/runner readiness、health 生命周期与 Database 依赖 |
| `pnpm-lock.yaml` | modify | Database→Domain、Worker→Database、Object Store→Workspace Core workspace links |

### 2.3 Object Store、Workspace Core、CI 与发布

| 文件 | 修改模式 | 主要目的 |
| --- | --- | --- |
| `packages/object-store/src/consistency-checkpoint.ts`、`consistency-checkpoint.test.ts` | add | canonical manifest/object 校验和原子不可变 checkpoint |
| `packages/object-store/src/index.ts`、`package.json` | modify | 导出 checkpoint 并声明 Workspace Core manifest 依赖 |
| `packages/workspace-core/src/workspace-platform.ts`、`workspace-platform.test.ts` | add | UI 无关 watcher/change、monotonic monitor、安全路径和 non-authority |
| `packages/workspace-core/src/index.ts` | modify | 导出 Workspace 平台端口 |
| `.github/workflows/ci.yml` | add | 精确工具链、PostgreSQL 17、frozen install、双迁移、根与 Compose 门禁 |
| `scripts/ci/verify-toolchain.mjs` | add | Node/pnpm 和数据库环境 fail-closed 预检 |
| `package.json` | modify | `ci`、`ci:verify`、`compose:smoke` 与确定性 packages/apps 构建顺序 |
| `.env.example` | modify | Gateway HTTP/HTTPS 端口与站点地址示例 |
| `.dockerignore` | modify | 排除宿主 `*.tsbuildinfo` |
| `Dockerfile` | modify | 固定 Node/pnpm/Caddy、API/Worker/Web targets 与非 root 运行 |
| `compose.yaml` | modify | PostgreSQL/migrate/API/Worker/Web/Gateway、health、权限、网络和五个持久卷 |
| `deploy/Caddy.Dockerfile` | modify | 固定 Caddy、UID/GID 10001 和最小 capability |
| `deploy/Caddyfile` | modify | Gateway health、API/health 和独立 Web 代理 |
| `deploy/Web.Caddyfile` | add | 独立 Web 静态服务与 health |
| `scripts/compose/smoke.mjs` | add | build/up/assert/restart/repeat-migrate/down 与网络/端口/秘密门禁 |

### 2.4 工作流与不可变证据

| 文件 | 修改模式 | 主要目的 |
| --- | --- | --- |
| `docs/requirements/m0-domain-baseline/requirements.md` | add | 用户在工作流开始前提供的原始产品权威；纳入 change-0 冻结，不归属实现编辑 |
| `docs/requirements/m0-domain-baseline/workflow-contract.md` | add | 用户在工作流开始前提供的 schema 3.2 合同；纳入 change-0 冻结 |
| `docs/requirements/m0-domain-baseline/implementation-plan.md` | add | 四阶段 initial roadmap revision 1 |
| `docs/requirements/m0-domain-baseline/execution/initial/execution-state.md` | add | initial 运行检查点、问题、验证、findings、恢复和完成权威 |
| `docs/requirements/m0-domain-baseline/execution/initial/phase-001-plan.md` | add | P-001 expanded 计划 revision 1 |
| `docs/requirements/m0-domain-baseline/execution/initial/phase-001-result.md` | add | P-001 immutable completed/passed 结果 |
| `docs/requirements/m0-domain-baseline/execution/initial/phase-002-plan.md` | add | P-002 expanded 计划 revision 1 |
| `docs/requirements/m0-domain-baseline/execution/initial/phase-002-result.md` | add | P-002 immutable completed/passed 结果 |
| `docs/requirements/m0-domain-baseline/execution/initial/phase-003-plan.md` | add | P-003 expanded 计划 revision 1 |
| `docs/requirements/m0-domain-baseline/execution/initial/phase-003-result.md` | add | P-003 immutable completed/passed 结果 |
| `docs/requirements/m0-domain-baseline/execution/initial/phase-004-plan.md` | add | P-004 expanded 计划 revision 1 |
| `docs/requirements/m0-domain-baseline/execution/initial/phase-004-result.md` | add | P-004 immutable completed/passed 结果，SHA-256 `8b9e9681b3921aeca604464075cee6258d9aac0274ad59dead63d457a1e1322f` |
| `docs/requirements/m0-domain-baseline/effective-requirements.md` | add | 应用至 change-0 的可再生成当前产品权威，SHA-256 `69959b7bcf8303e22c49d1278c3e103d9e9598e421147e3ccd1e07ac41a9d728` |
| `docs/requirements/m0-domain-baseline/change-0.md` | add | 本不可变初始实现记录 |

## 3. 需求、阶段与任务完成情况

| 阶段 | 任务 | 主要覆盖 | 状态与结果 |
| --- | --- | --- | --- |
| P-001 | P-001-T-001–T-003 | FR-003、FR-005–FR-019、FR-023–FR-026、FR-028；对应领域/契约 AC | 3/3 completed；`passed` |
| P-002 | P-002-T-001–T-003 | FR-002–FR-010、FR-012–FR-016、FR-020–FR-022；真实 PostgreSQL AC | 3/3 completed；`passed` |
| P-003 | P-003-T-001–T-003 | FR-001、FR-013–FR-026、FR-028；应用/Worker/SSE/平台 AC | 3/3 completed；`passed` |
| P-004 | P-004-T-001–T-003 | FR-001–FR-028；AC-001–AC-029 最终整合 | 3/3 completed；`passed` |

| 需求或验收组 | 完成阶段 | 最终状态 |
| --- | --- | --- |
| FR-001–FR-028 | P-001–P-004，按路线图追踪矩阵 | 全部 implemented/verified |
| AC-001–AC-026 core | P-001–P-004，最终根/数据库/Compose/兼容/安全复核 | 全部 passed |
| AC-027 supplemental | P-004，200-DAG 40 次完整 read | passed；P95 `0.872 ms` |
| AC-028 supplemental | P-004，三个 96-node/160-edge 确定性随机 DAG seed | passed |
| AC-029 supplemental | P-003/P-004，对象 checkpoint 与数据库/运行诊断 | passed |

当前产品权威已派生到 [`effective-requirements.md`](effective-requirements.md)。原始需求没有 add/modify/delete delta，因此 change-0 不产生 `RC-*`。

## 4. 测试与验证

- 策略：`relaxed`。实现不要求强制 red-first；所有 core、硬门禁、安全、隐私、数据完整性、公共兼容、构建和恢复仍然阻塞。最终没有需要 report-only 的 supplemental 异常。
- 结论：`passed`。

| 门禁 | 最终证据 | 结论 |
| --- | --- | --- |
| 生产 Domain/Contracts/fixtures | Domain 54、Contracts 4、Fixtures 40 项；depth 20、200 sibling、5,000 Task | pass |
| PostgreSQL 正式基线 | PostgreSQL 17.10；显式 reset guard、空库 `0001`–`0007`、重复 migrate no-op、profile v1、Schema fail-closed | pass |
| Repository 与原子事务 | Task Key 并发/幂等、recursive Owner/tree、DAG/move 稳定锁、completion/reopen/Owner 七故障点回滚、审计/Outbox | pass |
| 应用、Worker、SSE 与平台 | 模块/Tasks application、真实双 Graphile Worker、retry/幂等投影、认证 cursor SSE、Object checkpoint、Workspace ports | pass |
| 精确根工程 | Node `24.18.0` / pnpm `11.9.0`；format、lint、deterministic build、10 workspace typecheck 和全部适用 tests，退出 0 | pass |
| 公共兼容与三原型 | Identity/Pairing/Workspace/API/Web/CLI；Workspace Sync 27+40、Task UI 40+5、Agent Context 12/12 | pass |
| 规模与 supplemental | 200-DAG P95 `0.872 ms`，三个 random DAG seed，附加 checkpoint/查询诊断 | pass |
| 六服务 Compose | 真实 Linux engine 全镜像 build、首次空卷 up/health、Gateway、repeat migrate、非 root、卷、无外网/host binding/秘密、clean down | pass |
| 安全与边界 | 无公共 Project/Task CRUD、客户端服务端实现依赖、外部 API/AI/LLM/WebSocket、凭据材料或生产 debug；租户/lease/audit/Outbox 复核 | pass |
| 工件与环境 | requirements/roadmap/plan/result 指纹、Prettier、ESLint、`git diff --check`；数据库、Compose、Podman/WSL、端口、进程和临时路径清理 | pass |

## 5. 与路线图及阶段计划的偏差

- 没有需求、范围、验收层级、公共兼容或阶段边界偏差；四个路线图阶段和每阶段三个任务均按 revision 1 完成。
- P-001 Contracts build 初次产生可再生测试副本并被 Vitest 拾取；限定测试发现到 `src`、构建排除测试源后通过。
- P-002 正式 Project Key 使两个旧 API test seed 失效；只把测试 seed 改为合法值，没有放宽规则或改变公共 API。
- P-002 lifecycle audit 的 legacy NULL 与幂等索引发生兼容冲突；采用五列 NULL-distinct 唯一索引，Database/API 回归通过。
- P-003 首版 Outbox claim 缺显式 `LIMIT 1`，双消费者 barrier 稳定暴露全行锁；修正为 `LIMIT 1 FOR UPDATE SKIP LOCKED` 后真实双 Worker 通过。
- PostgreSQL、Node、Podman、Compose 与基础镜像的大文件下载多次被网络提前关闭；只有在 Content-Length 和发布/manifest 摘要完全匹配后使用，未接受截断制品。
- 宿主最初缺少容器引擎。用户离线启用 WSL 2 后，使用唯一 Podman machine 完成 core Compose；最终 machine 和 WSL distro 均删除。
- 真实 clean image build 暴露 workspace 顺序、宿主 `tsbuildinfo`、Caddy 用户和 file capability；均在 P-004 所有权内修正并完成 clean/runtime 复验。
- T-003 首次根命令在 lint 阶段捕获四个 type-only/unused import；静态修正后唯一完整执行到底的根 `pnpm check` 通过。
- 用户在容器前置阻塞期间自行将候选保存并推送为提交 `19cc33070b0e90646a80259e457cfdbc78b76d0c`。执行恢复时完整保留该状态；本次最终化未提交或推送。

这些偏差均已关闭，没有改变产品需求或留下未知影响。

## 6. 遗留事项

| ID | 类别 | 严重程度 | 关联需求/验收 | 观察与证据 | 最终功能影响 | 处置 | 置信度 | 建议后续 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 无 | 无 | 无 | 无 | 全部 core、硬门禁与 supplemental 通过 | 无 | 无 | 高 | 无 |

initial run 没有开放 `FND-I-*` 或未决产品问题。后续任何需求变化都必须创建下一个连续 change run，不得改写本记录、原始需求、initial roadmap、完成状态或四份阶段结果。
