# M3 平铺树状任务界面修改记录 0

- 修改记录编号：`0`
- 修改类型：首次实现
- 原始需求：[`requirements.md`](requirements.md)
- 当前有效需求：[`effective-requirements.md`](effective-requirements.md)
- 初始路线图：[`implementation-plan.md`](implementation-plan.md)，revision `3`
- 执行状态：[`execution-state.md`](execution/initial/execution-state.md)
- 项目基线：分支 `codex/m3-task-ui`，提交 `9f0a8398c63582f21ed26451bb727f9daca0d89c`
- 完成日期：`2026-07-31`
- 交付与验证策略：`relaxed`
- 验证结论：`passed`

## 1. 实现概述

首次实现以两个 compact 阶段交付完整 M3 正式平铺树状 Task UI：

- P-001 增加项目级 Task Key/标题搜索、完整祖先链，以及面向人类 Session 的当前 Task Workspace 文件清单和安全附件读取；全部进入 TypeBox、`/api/v1` 与 OpenAPI 3.1。
- P-002 在既有认证/项目 shell 中交付单 scope DAG、非模态详情、专用下降、层级/深链/History、搜索返回、AND 筛选、活动/归档历史和 200+ 分页访问。
- 正式 UI 覆盖 M2 全部人类操作、评论/附件/活动/通知、Admin Mode、版本/影响/幂等恢复和 SSE 草稿保护；所有权限与业务事实仍由服务端重新计算。
- 通知安全导航只使用当前活动 Membership/Task 返回的 nullable Key；已删除或失权目标保留通知语义但不泄露内容。
- `0010-m3-task-ui-history-compatibility` 保持 Schema version 3，仅解除不可变完成快照对活动 Task 行的删除阻断；完成/重开和 Workspace transition 历史继续保留。
- 最终根 CI、重复迁移、真实 PostgreSQL 规模、六服务参考发布、桌面 Chromium 正式业务链、Swagger 和 P95 全部通过，隔离资源精确清理。

M4 本地 Workspace 同步/租约写入、M5 Agent 工具/提案确认和 M6 摘要/Wiki/全文搜索没有提前实现。精确 `?prototype=task-ui` 继续隔离。

## 2. 文件修改

| 文件 | 修改模式 | 主要目的 |
| --- | --- | --- |
| `docs/requirements/m3-task-ui/{requirements,workflow-contract}.md` | add | 用户确认的 M3 产品权威与 schema 3.2 工作流合同 |
| `docs/requirements/m3-task-ui/implementation-plan.md` | add | 两阶段 compact initial 路线图 revision 3 |
| `docs/requirements/m3-task-ui/execution/initial/phase-001-plan.md` | add | 搜索/祖先/Session 附件读取阶段计划 |
| `docs/requirements/m3-task-ui/execution/initial/phase-001-result.md` | add | 不可变 P-001 `completed/passed` 结果 |
| `docs/requirements/m3-task-ui/execution/initial/phase-002-plan.md` | add | 正式 UI 与最终收口阶段计划 revision 3 |
| `docs/requirements/m3-task-ui/execution/initial/phase-002-result.md` | add | 不可变 P-002 `completed/passed` 结果 |
| `docs/requirements/m3-task-ui/execution/initial/execution-state.md` | add | `completed/passed` initial 协调状态 |
| `docs/requirements/m3-task-ui/validation/reference-server-2026-07-31.md` | add | 最终源码、发布硬化、浏览器、P95 与清理证据 |
| `docs/requirements/m3-task-ui/{effective-requirements,change-0}.md` | add | 当前有效需求与首次实现冻结记录 |
| `packages/contracts/src/{tasks,task-notifications,domain-contracts.test}.ts` | modify | 搜索/祖先/附件与安全通知导航运行时契约 |
| `packages/database/src/{task-query-repository,task-projection-repository}.ts` | modify | 租户限定搜索/祖先和当前授权通知 Key 投影 |
| `packages/database/src/{migrations,schema-profile}.ts` | modify | 正式 `0010` 和 version 3/10 migration profile |
| `packages/database/src/*integration.test.ts` | modify | 前向/重复迁移、完成历史删除和通知失权回归 |
| `apps/api/src/modules/tasks/**`、`apps/api/src/app.ts` | modify | Session 搜索/祖先/附件服务与 OpenAPI 路由、对象存储注入 |
| `apps/api/src/modules/authorization-audit/service.ts` | modify | Project Key 授权失败使用合法 UUID/null 审计目标 |
| `apps/api/src/{m2,m3-read}.integration.test.ts` | add/modify | M2 兼容及 5,000/深度 20/授权/附件真实 PostgreSQL 证据 |
| `apps/api/package.json`、`pnpm-lock.yaml` | modify | API 显式复用 Workspace 路径/manifest 规则 |
| `apps/web/src/m3/**` | add | 正式页面、query/model、DAG、详情、全部操作、协作、通知、样式和测试 |
| `apps/web/src/{api,m1/**,task-ui/layout}.ts(x)` | modify | 同源二进制、shell/深链/通知、SSE 失效与纯布局复用 |
| `apps/worker/src/outbox-task.integration.test.ts` | modify | 完整 CI 负载下重试用例的显式诊断上限 |
| `README.md`、`AGENTS.md`、`docs/01-product-requirements.md`、`docs/04-system-architecture.md`、`docs/07-roadmap-and-validation.md` | modify | 同步 M3 完成状态、Schema 3/0010、验证证据和下一里程碑 |

没有改写 M0/M1/M2、Workspace CLI 或 prototype 封存的 phase result、change record 和 effective snapshot。

## 3. 需求、阶段与任务完成情况

| 阶段 / 任务 | 状态 | 完成范围 | 需求与验收 |
| --- | --- | --- | --- |
| `P-001-T-001` | completed | Task 搜索/祖先契约、Repository、Session service、`/api/v1`/OpenAPI 与授权审计修复 | FR-012/013/038/039；AC-006/021/023/024 基础 |
| `P-001-T-002` | completed | 当前 Workspace 清单和安全附件二进制读取，路径/版本/哈希/对象/授权漂移 fail closed | FR-029/030/036/038；AC-016/021/024 基础 |
| `P-002-T-001` | completed | 生产单 DAG、详情/导航/History、搜索筛选、活动/归档、SSE query 失效和 prototype 隔离 | FR-001–FR-017、FR-036–FR-040；AC-001–AC-009、AC-021/023/025 |
| `P-002-T-002` | completed | M2 全部人类写入、协作/附件/活动/通知、Admin Mode、并发恢复、`0010` 与通知安全深链 | FR-018–FR-035；AC-010–AC-021、AC-024/025 |
| `P-002-T-003` | completed | 最终硬化、根门禁、重复迁移、参考发布/P95/浏览器、文档和冻结 | FR-001–FR-040、AC-001–AC-028 最终收口 |

P-001、P-002 的 plan/result 连续且均为 `completed/passed`。40 项 FR、25 项 core AC 和 3 项 supplemental AC 全部通过；无半完成公开入口、半迁移、未决问题或开放 `FND-I-*`。

## 4. 测试与验证

本运行使用 `relaxed` 策略，但全部 core、hard gate 与已声明 supplemental 验收通过，没有使用 report-only 例外。

- Node `24.18.0`、pnpm `11.9.0`、PostgreSQL 17。
- 根 `pnpm check` passed。
- 最终 `pnpm run ci`：313.6 秒，两次 migration、format/lint/build/typecheck 全部通过；311 tests passed、0 failed、9 platform-conditional skipped。
- 正式 Schema profile version 3、10 migrations、latest `0010-m3-task-ui-history-compatibility`；空库、version 2/3 前向、重复 migrate、最终指纹与历史存续通过。
- P-001 真实 PostgreSQL 6/6：5,000 Task、深度 20、游标、OpenAPI、授权隔离和附件完整性。
- Task Repository 20/20、Notification Projection 4/4；完成→重开→删除保留完成/Workspace transition 历史和 tombstone。
- 本地真实浏览器覆盖深链/History/搜索返回/筛选、全部 M2 操作、评论/附件/活动、通知、Admin Mode、版本冲突、SSE 草稿和 prototype。
- 参考源码 SHA-256 `63785a39551fc38c090ba4cbbde7c64d5eb3f8e29bd5a567e210829858949a2f`；六服务健康/硬化/持久化/秘密扫描/TLS/Swagger passed。
- 参考 P95：列表 23.73 ms、详情 24.86 ms、创建 47.47 ms、更新 32.32 ms、200 DAG 42.46 ms。
- 远端桌面 Chromium 完成注册、建项目、父子 Task、完成→重开→不可恢复删除与 DAG 归零；应用页面无错误。
- 隔离容器、网络、卷、镜像、目录、临时数据库和 SSH 隧道全部删除；原有 `deploy-home-table-1` 保持 healthy。

详细证据见 [`execution/initial/phase-001-result.md`](execution/initial/phase-001-result.md)、[`execution/initial/phase-002-result.md`](execution/initial/phase-002-result.md)和[`validation/reference-server-2026-07-31.md`](validation/reference-server-2026-07-31.md)。

## 5. 与路线图及阶段计划的偏差

- 阶段数量和顺序保持 `P-001 → P-002`，任务顺序保持计划一致。
- P-002 真实浏览器首先发现完成后重开 Task 的删除因 `task_completion_snapshots` 外键返回 500；这是 core 缺口，按合同暂停并由 `$plan-feature-implementation` 把路线图提升到 revision 3、阶段计划提升到 revision 2，再增加最小前向 `0010` 和历史存续回归。没有降级验收或改写 M2 历史。
- 最终冻结审计把路线图页首修订号与保存指纹修正到实际 revision 3，并把 P-002 计划提升到 revision 3；这是纯证据元数据修复。
- 完整 CI 负载下 Schema profile 和 Worker retry 用例超过默认 5 秒，显式调整单用例诊断上限为 15 秒后通过；产品性能门槛未放宽。
- 远端可视验证使用 localhost SSH 映射维持 Web Crypto 安全上下文，不安装私有 CA 或绕过警告；正式 HTTPS 在前后均通过发布 smoke。

除上述已记录并通过重验的修订外，没有风险接受、越界实现或未验证偏差。

## 6. 遗留事项

当前无开放 finding；下一可用 initial ID 为 `FND-I-001`。

| ID | 类别 | 严重程度 | 关联需求/验收 | 观察与证据 | 最终功能影响 | 处置 | 置信度 | 建议后续 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |

后续任何 M3 行为、范围、接口、数据、安全或验收变化必须使用 `$apply-feature-change` 创建连续 `change-1`。下一独立产品工作流是 M4 Workspace 同步平台适配器，应先使用 `$clarify-feature-requirements`，不得改写本记录、effective snapshot 或 initial phase evidence。
