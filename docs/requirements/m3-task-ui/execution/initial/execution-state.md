# M3 平铺树状任务界面 initial 执行状态

- 运行编号：`initial`
- 运行类型：`首次实现`
- 目标记录：`change-0.md`
- 运行状态：`completed`
- 交付与验证策略：`relaxed`
- 验证结论：`passed`
- 当前路线图修订：`3`
- 需求指纹：`345e209c7902568717a7f0950257a6ec095ca0bceda409a6ca6289bde9f1cb3b`
- 路线图或变更计划指纹：`ac4369a39bab6165fe437af785ae3cc45b7c9a34e2fd15c263712d1a781536b8`
- 当前阶段计划修订：`3`
- 当前阶段计划指纹：`bb835398a4856569a1c3d5f7dee31612d175a54fa7daf2add13eb213795bfab5`
- 当前阶段：`无（initial 已完成）`
- 当前任务：`无`
- 下一发现项 ID：`FND-I-001`
- 项目基线：Git `9f0a8398c63582f21ed26451bb727f9daca0d89c`，分支 `codex/m3-task-ui`
- 最后更新时间：2026-07-31

## 1. 运行目标或待生效变更

已按确认的 `requirements.md` 首次交付完整 M3 正式平铺树状 Task UI。P-001/P-002、全部 core/硬门禁、真实浏览器和参考部署验证均已完成，`phase-002-result.md`、`change-0.md` 与 `effective-requirements.md` 一致冻结。

## 2. 阶段状态

| 阶段 | 状态 | 计划 | 结果 | 说明 |
| --- | --- | --- | --- | --- |
| P-001 | completed | [`phase-001-plan.md`](phase-001-plan.md) revision 1 | [`phase-001-result.md`](phase-001-result.md) | `completed/passed`，计划与结果已冻结 |
| P-002 | completed | [`phase-002-plan.md`](phase-002-plan.md) revision 3 | [`phase-002-result.md`](phase-002-result.md) | `completed/passed`，计划与结果已冻结 |

## 3. 当前检查点

- `P-001-T-001` 与 `P-001-T-002` 已按序完成，阶段 core、构建、安全、数据和兼容门禁全部通过。
- 实际结果：新增 Task Key 精确/前缀、标题不区分大小写包含搜索，稳定生命周期/游标、完整祖先链、独立祖先读取，以及逐次 Session/Project/Task `read_workspace` 授权的当前 Workspace 文件清单与安全二进制读取。
- 附件读取只接受清单内规范化相对路径和可选当前哈希；请求前后重验 Workspace version/manifest hash，并由对象存储验证内容哈希和大小。路径穿越、跨任务、哈希或版本漂移、缺失对象及未配置对象存储均稳定 fail closed。
- 授权诊断发现并修复既有 Project Key 失败审计把非 UUID Key 写入 UUID `target_id` 而导致 500 的缺陷；现在不存在项目使用空 target，已解析项目使用 Project UUID，非成员稳定返回 403。
- 阶段影响范围与证据已冻结在 `phase-001-result.md`；没有数据库迁移、Workspace 写能力或公开半成品 Web 入口。
- `$plan-feature-implementation` 已审计 P-001 结果和当前项目事实，将路线图提升为 revision 2，并创建最终 compact `phase-002-plan.md` revision 1；需求、两阶段边界和 `relaxed` 策略不变。
- P-002 按 `T-001` 生产浏览/导航/DAG、`T-002` 完整 M2 操作/协作、`T-003` 硬化/最终门禁/参考部署/冻结顺序执行。
- `P-002-T-001` 已完成：当前已认证项目可进入生产 Task 页，正式页面只消费生产契约并支持分页单 scope DAG、图完整性校验、详情/直接子项、专用下降、完整面包屑/返回/每层快照、正式 URL/History、服务端搜索及返回前位置、AND 筛选、活动/归档分离、安全文本和成员/角色名称映射。
- SSE 失效已扩展到用户或当前项目的稳定 M3 query 前缀；只触发权威 refetch，未把事件当作业务事实。prototype 布局改为结构化泛型输入，精确入口仍只消费隔离夹具。
- 浏览器首次搜索验收发现返回前位置仍保留搜索词；根因为搜索前快照在选择结果时才创建。已改为输入首字符时保存完整快照，并以纯模型测试和同一浏览器流程复验返回空搜索、原 scope、无选择/抽屉。
- `P-002-T-001` 影响范围、验证和偏差已写入已完成任务、累计文件与测试证据；当前尚未开始 `P-002-T-002`。
- `P-002-T-002` 已完成生产 Web 操作面实现和大部分真实浏览器流程：创建/编辑、Owner、依赖直改与双方请求接受/拒绝、关注、blocker、状态/完成/重开、移动、归档、评论/附件/活动、通知偏好/已读/安全深链、普通成员与显式 Admin Mode 均已观察到权威结果。
- 不可恢复删除验收发现 core 失败：曾完成后重开的未完成 Task 在确认影响和完整 Task Key 后返回 500。代码与正式 Schema 诊断确认 `task_completion_snapshots` 的不可变历史外键仍引用活动 `tasks` 行；基础删除回归未覆盖完成→重开历史。
- `$plan-feature-implementation` 已据此把路线图提升为 revision 3、P-002 计划提升为 revision 2。唯一兼容方案是前向解除完成历史对活动 Task 行的删除约束，同时保留快照及 Task UUID、项目和 Workspace 历史；需求、两阶段边界、`relaxed` 策略和 M2 冻结记录不变。现在按 `$implement-planned-feature` 从同一 `P-002-T-002` 恢复。
- `P-002-T-002` 已恢复并完成：正式 UI 完整编排 M2 人类写入、评论/附件/活动/通知和 Admin Mode；幂等键按 payload/成功轮换，版本和影响确认显式绑定，SSE 只失效权威 query，草稿冲突保留。
- 正式 `0010-m3-task-ui-history-compatibility` 前向迁移只解除 `task_completion_snapshots` 的活动 Task 外键，不删除或修改完成/重开历史。完成→重开→删除回归为 passed，并证明 `task_completion_snapshots`、`task_workspace_transition_snapshots` 和 Task Key tombstone 均保留。
- 通知资源现在显式返回 nullable `projectKey`/`taskKey`；Repository 只在接收者 Membership 仍活动且 Task 仍存在时提供导航 Key，标记已读响应遵守同一规则。Web 不再从历史 `resourceRefs` 推断可导航 Key。
- `P-002-T-003` 开始检查点：只做最终硬化、一次性根门禁、version 3/0010 升级与重复迁移、参考服务器隔离发布/浏览器/P95、文档和 initial 冻结；不得扩大产品范围。
- `P-002-T-003` 已完成：根 `pnpm check` 和最终 `pnpm run ci` 通过，311 tests passed、0 failed、9 platform-conditional skipped；Schema version 3/10 migrations、`0010` 前向/重复运行和完成历史存续通过。
- `192.168.100.1` 隔离六服务发布、健康/硬化/持久化/秘密扫描、正式 HTTPS smoke、5,000/深度 20、桌面 Chromium 正式 Task UI/Swagger 和 P95 全部通过；完成→重开→不可恢复删除在真实浏览器闭合原 500。
- 参考栈、网络、卷、镜像、目录、临时数据库和 SSH 隧道均已精确清理，原 `deploy-home-table-1` 保持 healthy。无开放 finding。
- 最终规划一致性审计把路线图页首修正为实际 revision 3，并将 P-002 计划提升为 revision 3、刷新父路线图指纹；只修正证据元数据，不改变需求或实现。
- 幂等性、乐观版本、impact 预览/确认和项目/用户稳定 query 失效必须沿用权威契约；SSE 只触发 refetch，存在未提交草稿时不得覆盖输入。附件只经认证二进制请求和短生命周期 Blob URL 打开，不把对象密钥、绝对路径、Session 或秘密写入 URL、History、日志或可复制文本。
- 完成条件：受影响 Web 单元/类型/静态检查通过，真实 Session/PostgreSQL 浏览器至少覆盖成功写入、版本冲突、impact 确认、评论/附件/活动、通知/Admin Mode 与草稿保护；发现契约缺口或多种产品语义时停止生产编辑并回到滚动规划。
- 基线所有权：规划前只有未跟踪的 `docs/requirements/m3-task-ui/requirements.md` 与 `workflow-contract.md`，它们是用户已确认的需求基线；生产文件无既有差异。

## 4. 已完成任务

| 任务 | 完成结果 | 实际文件 | 验证 |
| --- | --- | --- | --- |
| P-001-T-001 | 搜索/祖先链契约、Repository、应用服务与 `/api/v1`/OpenAPI 完成；授权失败不再退化为 500 | `packages/contracts/src/tasks.ts`、`packages/contracts/src/domain-contracts.test.ts`、`packages/database/src/task-query-repository.ts`、`apps/api/src/modules/tasks/service.ts`、`apps/api/src/modules/tasks/routes.ts`、`apps/api/src/modules/authorization-audit/service.ts`、`apps/api/src/m3-read.integration.test.ts` | Node 24.18.0；contracts 13/13；M3 PostgreSQL 17 API 5/5；contracts/database/api typecheck passed |
| P-001-T-002 | 人类 Session 的当前 Workspace 文件清单和安全附件内容 API 完成；版本、路径、哈希、对象与授权漂移全部 fail closed | `apps/api/package.json`、`pnpm-lock.yaml`、`packages/contracts/src/tasks.ts`、`packages/contracts/src/domain-contracts.test.ts`、`apps/api/src/app.ts`、`apps/api/src/modules/tasks/service.ts`、`apps/api/src/modules/tasks/routes.ts`、`apps/api/src/m3-read.integration.test.ts` | Node 24.18.0；最终 contracts 14/14；M3 PostgreSQL 17 API 6/6；Workspace/Object Store 34/34；Database 32/32；M1/M2/Workspace API 15 passed、1 platform-conditional skipped |
| P-002-T-001 | 生产 Task 数据/导航/单 DAG、详情、搜索筛选、活动/历史和 SSE query 失效完成；prototype 保持隔离 | `apps/web/src/m3/**`、`apps/web/src/m1/{M1App,model,model.test,use-resource-events}.ts(x)`、`apps/web/src/task-ui/layout.ts` | Web 5 files/21 tests；typecheck/lint/format passed；Vite production bundle passed；真实 Session/PostgreSQL 浏览器覆盖 5,000/200、深度 20、搜索返回、History、下降、筛选和 prototype |
| P-002-T-002 | 完整人类 Session 操作、协作/附件/活动/通知、并发恢复与 Admin Mode UI 完成；完成历史删除兼容和安全通知导航缺口已修复 | `apps/web/src/{api,m3/**}`、`apps/web/src/m1/M1App.tsx`、`packages/contracts/src/task-notifications.ts`、`packages/database/src/{migrations,schema-profile,task-projection-repository}.ts` 及相关 Web/Contracts/Database/API tests | Web 3 files/18 tests、Contracts 1 file/9 tests、Database migration 4 tests、Task Repository 20 tests、Projection 4 tests、API 2 files/8 tests passed；四个受影响包 typecheck、根 lint/format passed；真实浏览器覆盖完整 UI 操作面并由完成→重开→删除 PostgreSQL 回归闭合原 500 |

## 5. 运行累计文件变化

| 文件 | 所有权/模式 | 当前用途 |
| --- | --- | --- |
| `docs/requirements/m3-task-ui/requirements.md` | 用户基线 / add | 已确认产品需求，不归属实现任务修改 |
| `docs/requirements/m3-task-ui/workflow-contract.md` | 用户基线 / add | schema 3.2 工作流合同，不归属实现任务修改 |
| `docs/requirements/m3-task-ui/implementation-plan.md` | initial / add | revision 3 全局路线图 |
| `docs/requirements/m3-task-ui/execution/initial/phase-001-plan.md` | initial / add | revision 1 P-001 执行权威 |
| `docs/requirements/m3-task-ui/execution/initial/phase-001-result.md` | initial / add | P-001 不可变 `completed/passed` 结果 |
| `docs/requirements/m3-task-ui/execution/initial/phase-002-plan.md` | initial / add | revision 3 P-002 执行权威 |
| `docs/requirements/m3-task-ui/execution/initial/phase-002-result.md` | initial / add | P-002 不可变 `completed/passed` 结果 |
| `docs/requirements/m3-task-ui/validation/reference-server-2026-07-31.md` | initial / add | 最终参考发布、浏览器、P95 与清理证据 |
| `docs/requirements/m3-task-ui/effective-requirements.md`、`change-0.md` | initial / add | 当前有效需求与首次实现冻结记录 |
| `docs/requirements/m3-task-ui/execution/initial/execution-state.md` | initial / add | `completed/passed` durable 协调状态 |

规划基线尚无生产差异；当前生产与测试累计变化如下。T-002 依据 revision 3/2 新增一个前向、非破坏迁移；没有生产配置、外部服务或生成物变化。

P-001-T-001 新增或修改：

| 文件 | 模式 | 目的 |
| --- | --- | --- |
| `packages/contracts/src/tasks.ts` | modify | M3 搜索、位置与祖先运行时契约 |
| `packages/contracts/src/domain-contracts.test.ts` | modify | 新契约边界测试 |
| `packages/database/src/task-query-repository.ts` | modify | 租户限定搜索、稳定分页与完整祖先链 |
| `apps/api/src/modules/tasks/service.ts` | modify | Session 搜索/位置应用服务和完整性错误映射 |
| `apps/api/src/modules/tasks/routes.ts` | modify | 新增只读 `/api/v1`/OpenAPI 路由 |
| `apps/api/src/modules/authorization-audit/service.ts` | modify | Project Key 解析失败使用合法 nullable/UUID 审计目标 |
| `apps/api/src/m3-read.integration.test.ts` | add | 深度 20、5,000 Task、游标、OpenAPI 与授权集成证据 |

P-001-T-002 新增或修改：

| 文件 | 模式 | 目的 |
| --- | --- | --- |
| `apps/api/package.json`、`pnpm-lock.yaml` | modify | 显式声明 API 对 Workspace 路径/manifest 规则的工作区依赖 |
| `packages/contracts/src/tasks.ts` | modify | Workspace 文件清单、内容查询与公开文件元数据契约 |
| `packages/contracts/src/domain-contracts.test.ts` | modify | 附件公开契约与敏感字段边界测试 |
| `apps/api/src/app.ts` | modify | 把既有可选对象存储注入 Task 应用服务 |
| `apps/api/src/modules/tasks/service.ts` | modify | Session/项目/Task/Workspace 重授权、manifest 漂移与对象完整性校验 |
| `apps/api/src/modules/tasks/routes.ts` | modify | 清单与安全二进制内容 `/api/v1`/OpenAPI 路由 |
| `apps/api/src/m3-read.integration.test.ts` | modify | 路径、哈希、版本、跨任务、未配置对象存储和响应隐私证据 |

P-002-T-001 新增或修改：

| 文件 | 模式 | 目的 |
| --- | --- | --- |
| `apps/web/src/m3/model.ts`、`model.test.ts` | add | 正式 URL/History、每层快照、搜索返回、AND 筛选、分页 scope 与 DAG fail-closed 纯状态 |
| `apps/web/src/m3/query-keys.ts` | add | 用户/项目/作用域/Task/位置/搜索/子项稳定 query key |
| `apps/web/src/m3/TaskWorkspace.tsx` | add | 生产项目 Task 查询、导航、搜索筛选、活动/历史和页面编排 |
| `apps/web/src/m3/TaskGraph.tsx` | add | 单 DAG、孤立节点、两端可见边、键盘方向导航和非颜色节点表达 |
| `apps/web/src/m3/TaskDrawer.tsx` | add | 安全正文、权威详情、关系、直接子项列表和专用下降 |
| `apps/web/src/m3/task-workspace.css` | add | 有限滚动视口、详情抽屉、中文桌面和窄屏安全降级样式 |
| `apps/web/src/m1/M1App.tsx` | modify | 在既有已认证 shell 与当前项目上下文增加正式 Task 页面及深链恢复 |
| `apps/web/src/m1/model.ts`、`model.test.ts`、`use-resource-events.ts` | modify | M1/M3 稳定前缀的精确 SSE 权威 refetch |
| `apps/web/src/task-ui/layout.ts` | modify | 把已验证布局改为结构化泛型输入，生产与 prototype 共用纯布局但不共用夹具事实 |

P-002-T-002 当前新增或修改：

| 文件 | 模式 | 目的 |
| --- | --- | --- |
| `apps/web/src/m3/{operations,task-api,use-intent}.ts`、`query-keys.ts` | add/modify | M2 命令映射、影响事实、稳定幂等键和精确 query 失效 |
| `apps/web/src/m3/{TaskCreatePanel,TaskEditPanel,TaskSimpleOperations,TaskImpactOperations,TaskDependencyRequests}.tsx` | add | 完整字段、状态、Owner、依赖/请求、关注、完成/重开、移动、归档/删除操作面 |
| `apps/web/src/m3/{TaskCollaboration,NotificationsPanel,TaskDrawer,TaskWorkspace}.tsx` | add/modify | 评论/附件/活动、通知、Admin Mode 与页面组合 |
| `apps/web/src/api.ts`、`apps/web/src/m1/M1App.tsx` | modify | 同源二进制读取、管理员上下文和全局通知入口 |
| `packages/contracts/src/task-notifications.ts`、`packages/database/src/task-projection-repository.ts`、Task routes | modify | 仅在当前仍有项目/Task 权限时返回安全导航 Key |
| `packages/database/src/{migrations,schema-profile}.ts` 及 migration/Task Repository tests | add/modify | 正式 `0010` 前向完成历史删除兼容、正式 baseline 识别、重复升级和历史存续回归 |

## 6. 测试与验证证据

| 命令/环境 | 结果 |
| --- | --- |
| Node 20 预检查：contracts/database/api typecheck | passed；随后按项目要求改用 Node 24 重验 |
| Node 24.18.0 Contracts | 2 files、14 tests passed |
| Node 24.18.0 Contracts/Domain/Workspace Core/Database/Object Store/API 强制构建与 typecheck | passed |
| PostgreSQL 17.10 隔离容器，经 SSH tunnel 执行 `vitest run apps/api/src/m3-read.integration.test.ts --fileParallelism=false` | 1 file、6 tests passed；含 5,000 Task、深度 20、搜索游标、OpenAPI、匿名/非成员隔离、附件授权/路径/哈希/版本/对象存储 |
| Workspace Core/Object Store 单元回归 | 8 files、34 tests passed |
| Task/Projection/Lifecycle/Workspace Repository PostgreSQL 回归 | 4 files、32 tests passed |
| M1/API shell 回归 | 初次通过 SSH tunnel 的 5 秒默认超时在 5.012 秒触发；同一用例以 15 秒诊断上限重跑 3/3 passed，未修改产品或测试 |
| M2 Task/API 服务回归 | 2 files、7 tests passed |
| 设备 Workspace/API CLI 回归 | 2 files、2 passed、1 个既有 platform-conditional skipped |
| 受影响文件 Prettier 与 ESLint | passed |
| Node 24.18.0 Web tests/typecheck/lint/format | 5 files、21 tests passed；typecheck、受影响 ESLint 和 Prettier passed |
| Vite production bundle | passed；103 modules，CSS 28.70 kB、JS 340.21 kB；Codex 文件锁定环境使用一次性 `dist-m3-verify` 输出，验证后精确清理，最终根门禁仍将验证标准 `dist` |
| 本地隔离真实 Session/PostgreSQL 17 + in-app Chromium 生产页 | passed；MSCL 5,000 Task 首屏 200 节点/下一页入口、详情抽屉；MTHR 深度 20 深链/19 层祖先；搜索返回前位置、浏览器前进/后退、专用下降、筛选隐藏选择与精确 prototype 入口均通过且无页面错误 |
| P-002-T-002 本地真实 Session/PostgreSQL 17 + in-app Chromium | passed；完整操作、评论/附件/活动、通知、Admin Mode、依赖请求双方确认和归档通过；原删除 500 已由 revision 3/2 的 `0010` 与历史存续回归修复 |
| PostgreSQL 17 Task Repository 完整回归 | 1 file、20 tests passed；普通未完成子树删除及完成→重开→删除均通过，完成/重开历史和 tombstone 保留 |
| PostgreSQL 17 正式 Schema/迁移 | schema profile 1/1、M1→latest 3/3 passed；空库、version 2/3 升级、`0010`、重复迁移和最终指纹通过；测试上限因新增迁移由 5 秒显式调整为 15 秒后在 5.52 秒通过 |
| PostgreSQL 17 Notification projection | 1 file、4 tests passed；当前活动 Membership/Task 返回 Key，标记已读保持 Key，失权后两 Key 为 null，删除后只保留项目 Key |
| P-002-T-002 Web/Contracts | Web 3 files、18 tests；Contracts 1 file、9 tests passed；幂等、影响 fail closed、附件 current manifest、通知 Key、导航/历史/SSE 模型覆盖 |
| P-002-T-002 API | M2 + M3 read 2 files、8 tests passed；通知运行时响应含安全 Key，既有 M2 与 P-001 接口兼容 |
| P-002-T-002 静态门禁 | Contracts/Database/API/Web typecheck passed；根 ESLint 和 Prettier passed |
| 根 `pnpm check` | passed；format、lint、build、typecheck、test 全部通过 |
| 最终 Node 24.18.0 / pnpm 11.9.0 / PostgreSQL 17 `pnpm run ci` | passed，313.6 秒；两次 migration，311 passed、0 failed、9 platform-conditional skipped |
| `192.168.100.1` 隔离六服务与 P95 | passed；Schema 3/10、重复 migration、健康/硬化/持久化/秘密扫描/TLS/Swagger；列表/详情/创建/更新/200 DAG P95 为 23.73/24.86/47.47/32.32/42.46 ms |
| 远端桌面 Chromium | passed；注册/建项目、父子 Task、完成→重开→不可恢复删除、DAG 归零和 Swagger OAS 3.1，无应用页面错误 |
| 最终资源清理 | passed；隔离容器/网络/卷/镜像/目录/数据库/隧道已删除，原 `deploy-home-table-1` healthy |

第一次数据库执行准确暴露非成员请求 500；确认根因为失败审计 target UUID 不合法，修复后同一用例重跑 5/5 passed。该诊断重跑由真实 core 失败触发，不是重复证据。

## 7. 决策、待确认问题与回答

| ID | 阶段/任务 | 问题 | 已确认事实 | 可选方案与影响 | 需要确认 | 状态 | 用户回答及来源 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| — | — | 无未决问题 | `requirements.md` 第 13 节为“无”且交付策略明确为 `relaxed` | — | — | resolved | 用户已确认需求工作流 |

## 8. 发现项、偏差、风险与阻塞

- 开放 `FND-I-*`：无。
- 计划偏差：为满足 AC-021 授权硬门禁，额外修改 `apps/api/src/modules/authorization-audit/service.ts` 修复已证实的失败审计 UUID 缺陷；不改变成功授权或产品范围。P-002-T-002 的完成→重开→删除 500 已作为 core 缺口进入路线图 revision 3 和阶段计划 revision 2，不作为 report-only finding降级。
- 证据修订：P-002 phase revision 3 只修正路线图页首修订号和旧指纹；需求、阶段边界、实现与验证不变。
- 阻塞：无；所有 core、hard gate 和 supplemental 均通过。

## 9. 精确恢复步骤

无恢复动作：initial 已 `completed/passed`，本状态和两个阶段结果均为冻结执行证据。后续 M3 变化从 `$apply-feature-change` 的连续 `change-1` 开始；下一独立产品里程碑 M4 使用 `$clarify-feature-requirements`。

## 10. 最终完成门禁

- [x] P-001 有不可变 `phase-001-result.md` 且 core/硬门禁通过。
- [x] P-002 已经滚动规划、执行并有不可变阶段结果。
- [x] FR-001–FR-040 与 AC-001–AC-028 在记录策略下完整覆盖。
- [x] PostgreSQL 17、根 `pnpm check`、最终 `pnpm run ci` 和适用迁移/OpenAPI/发布门禁通过。
- [x] 目标桌面浏览器、200 DAG、5,000 Task、深度 20、全部 M2 人类操作与可访问性 core 通过。
- [x] `192.168.100.1` 隔离发布栈、浏览器和参考性能验证通过并清理。
- [x] 无 unresolved question、blocker、critical/high/未知影响 finding 或未解释保留文件。
- [x] `effective-requirements.md` 与 `change-0.md` 已生成并相互一致，状态为 `completed/passed`。
