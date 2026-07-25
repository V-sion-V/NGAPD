# Workspace Sync initial run：P-001 阶段结果

- 运行编号：`initial`
- 阶段：`P-001`
- 阶段计划：[`phase-001-plan.md`](phase-001-plan.md)
- 阶段计划修订：`1`
- 父路线图修订：`1`
- 完成日期：`2026-07-25`
- 状态：`completed`
- 交付与验证策略：`relaxed`
- 验证结论：`passed`
- 开始基线：分支 `prototype`，提交 `a75be46a624ecb3ef309cac019e597461ddfc6e9`；requirements/contract 为用户已有未跟踪输入
- 结束基线：同一未提交工作树；P-001 文件清单如下，未提交、推送、重置或覆盖用户输入

## 1. 阶段目标与结果

P-001 已建立可供 P-002 直接依赖的真实身份、一次性设备配对、三级 Workspace scope 授权、唯一 Workspace 数据基础和审计边界：

- 本地账号使用 Node 24 内置 Argon2id；Web session、配对关联、设备凭据和短期访问令牌只保存摘要，安全 Cookie 固定 `Secure`、`HttpOnly`、`SameSite=Strict`。
- 用户、Project、Task 与各自唯一 Workspace 在 PostgreSQL 事务内创建；Project Owner/Admin、活动 Membership、有效 Task Owner 和全部对照拒绝由服务端事实与纯领域规则决定。
- `0002-workspace-foundation` 是 additive 前向 migration；新装、从保留 `system_metadata` 的 `0001` 升级、重复 migrate、重复/并发/失败回滚均已在隔离 PostgreSQL 17 证明。
- API 已提供注册、登录、退出、session、配对请求/摘要/决定/消费、设备列表/撤销的版本化 TypeBox/OpenAPI 路由，并保留稳定错误、request ID、同源防护和脱敏审计。
- Web 已提供账号、配对决定和设备撤销人工流；不处理 Workspace 文件，也没有本地 GUI、同步写路由、Agent 业务 MCP 工具、外部 API/AI/LLM 或无认证 fixture 路由。
- 现有健康/系统信息、Web 构建、Workspace CLI status/doctor 与两个只读 MCP 工具保持兼容；P-001 结束时尚未开放租约、版本、对象或同步写流。

隔离 API/Web/PostgreSQL 服务均已停止。已知测试 cluster 位于 `/private/tmp/ngapd-workspace-sync-p001-pgdata`，不在仓库中、无监听、无活动测试 session。

## 2. 任务、需求与验收覆盖

| 任务 | 状态 | 需求与验收 | 完成结果 |
| --- | --- | --- | --- |
| `P-001-T-001` | completed | `FR-001`–`FR-010`、`FR-033`–`FR-035` / `AC-004`、`AC-005`、P-001 范围的 `AC-012`、`AC-013`、`AC-017` | TypeBox 契约、纯授权/有效 Task Owner/配对规则、首批 migration、事务 repository、identity repository 与真实授权 fixture 完成并通过 PostgreSQL/单元门禁 |
| `P-001-T-002` | completed | `FR-001`–`FR-010`、`FR-032`–`FR-035`、`FR-038` / `AC-001`、`AC-004`、`AC-005`、P-001 范围的 `AC-002`、`AC-003`、`AC-012`、`AC-013`、`AC-016`、`AC-017` | Identity/Pairing/Device API、内部 scope provisioning service 与 Web 人工流完成；API 负向矩阵、OpenAPI、浏览器、根门禁和兼容验证通过 |

阶段验收结论：

- `AC-001`、`AC-004`、`AC-005` 及 P-001 范围的 `AC-012`、`AC-013`、`AC-016`、`AC-017` 已通过。
- `AC-002`、`AC-003` 的服务端/Web 前置已通过；CLI 发起/轮询、OS 凭据端口和 CLI 无密码完整证据仍按路线图属于 P-003，本结果不提前宣称整体完成。
- P-001 没有独立 supplemental 验收；没有 `FND-I-*`。

## 3. 文件修改

| 文件或范围 | 修改模式 | 结果 |
| --- | --- | --- |
| `packages/contracts/src/{errors,identity,pairing,projects,tasks,workspaces,index}.ts` | add/modify | 新增身份、设备、配对、Project/Task、Workspace 和稳定错误 TypeBox 公共契约 |
| `packages/domain/src/{authorization,pairing,task-owner,index}.ts` 及测试 | add/modify | 新增纯作用域授权、有效 Task Owner、配对状态转换与 9 项领域测试 |
| `packages/database/src/{client,migrations,types,foundation-repository,identity-repository,index}.ts` 及集成测试 | add/modify | 新增 `0002-workspace-foundation`、Kysely 类型、原子 scope 创建、session/配对/设备仓储和 4 项 PostgreSQL 集成证据 |
| `packages/test-fixtures/src/workspace-authorization*`、`index.ts`、`package.json` | add/modify | 新增 Owner/Admin/Member/Task Owner 确定性对照 fixture |
| `apps/api/src/modules/identity/**`、`identity.integration.test.ts`、`app.ts`、`index.ts`、相关测试/package | add/modify | 新增 Argon2id、session/同源、配对/设备服务与路由、内部 scope service、稳定错误、OpenAPI 和 7 项真实 PostgreSQL/API 测试 |
| `apps/web/src/App.tsx`、`styles.css` | modify | 新增注册/登录/退出、配对批准/拒绝、设备列表/撤销 Web 流，并修复浏览器发现的退出缓存问题 |
| `.env.example`、`compose.yaml` | modify | 增加非秘密 `WEB_ORIGIN` 注入，保留 gateway/TLS 边界 |
| `packages/database/package.json`、`apps/api/package.json`、`pnpm-lock.yaml` | modify | 增加目标测试入口并同步 workspace 内部依赖；没有新增外部运行时包 |
| `docs/requirements/workspace-sync-prototype/implementation-plan.md`、`execution/initial/{execution-state,phase-001-plan,phase-001-result}.md` | add | 保存路线图、当前状态、即时计划与本阶段不可变结果 |

`requirements.md` 与 `workflow-contract.md` 保持用户输入权威，本阶段未改写。

## 4. 测试与验证

| 检查 | 命令或过程 | 观察结果 | 结论 |
| --- | --- | --- | --- |
| 契约与领域 | `pnpm --filter @ngapd/contracts build`；domain test/build | TypeBox 编译通过；4 个领域测试文件、9 项测试通过 | pass |
| Fixture | test-fixtures test/build | 3 个文件、5 项测试通过，包括真实授权对照 | pass |
| PostgreSQL | `DATABASE_TEST_URL=<隔离目标> pnpm --filter @ngapd/database test`；database build | 4 项通过；新装、保留 `system_metadata` 升级、no-op、唯一性、事务失败/并发、配对单次消费与撤销通过 | pass |
| API | `DATABASE_TEST_URL=<隔离目标> pnpm --filter @ngapd/api test`；API build | 2 个文件、7 项通过；Argon2id、Cookie/同源、session、配对负向/过期/单次消费、设备撤销、OpenAPI、request ID、审计脱敏通过 | pass |
| Web | `pnpm --filter @ngapd/web build`、`typecheck` | Vite production build 与 TypeScript 通过 | pass |
| macOS 浏览器 | 真实 macOS in-app Browser + 本地隔离 API/PostgreSQL | 注册、退出、登录、配对摘要、批准、拒绝、消费后设备显示、撤销通过；修复退出缓存后复验；console error 为空 | pass |
| 根门禁 | `DATABASE_TEST_URL=<隔离目标> pnpm check` | format、lint、9 个 workspace build/typecheck、database 4、domain 9、workspace-core 3、API 7、CLI/MCP 10、fixture 5 项测试全部通过 | pass |
| 兼容与范围 | 根测试、工具注册/日志/秘密静态检查、`git diff --check` | 健康/系统信息、Web、CLI status/doctor、两个只读 MCP 工具保持；无 Agent 业务工具、外部 AI/API、真实 secret/local config/debug/transient repo artifact | pass |

## 5. 发现项与处置

无 `FND-I-*`。验证结论为 `passed`。

浏览器首次退出时发现 Web 仍显示旧账号缓存；这是已确认影响 core 退出行为的实现缺陷，不符合 report-only 条件。T-002 内将 React Query 清理由 `setQueryData(undefined)` 改为 `removeQueries`，随后完整重跑退出与登录浏览器流程并通过。

## 6. 决策、计划偏差与恢复记录

- 没有新增产品决策、用户问题或范围变更。
- 使用 Node 24 内置 Argon2id，避免额外原生密码依赖；参数和编码格式在 API security 模块内固定，可由后续版本化迁移。
- P-001 只交付配对的服务端/Web 前置；CLI 与 OS 凭据证据仍保留给 P-003，符合路线图阶段边界。
- PostgreSQL 因 sandbox 共享内存和本地 socket 限制在获批的本机隔离实例执行；目标始终为 `127.0.0.1:55432/ngapd_workspace_sync_p001`，未接触未知或生产数据库。
- 依赖恢复期间的离线元数据重试未改变锁定依赖结论；最终 `pnpm-lock.yaml` 仅增加 test-fixtures 对 domain 的 workspace link。
- 当前无恢复操作；P-001 生产改动、验证和状态一致。

## 7. 遗留风险与下一阶段进入条件

- P-001 没有开放 finding、未决问题、半应用 migration、活动测试服务或未知数据变化。
- P-002 可在本结果、路线图修订 1 和当前项目事实仍一致时规划服务端租约、版本、manifest、ObjectStore、幂等与冲突协议。
- `$plan-feature-implementation` 必须重新读取本结果与当前 diff，创建且只创建 `phase-002-plan.md`；P-001 计划与本结果从此冻结。
- 本阶段完成不授权在同一 invocation 中规划或实施 P-002。
