# Workspace Sync initial run：P-002 阶段结果

- 运行编号：`initial`
- 阶段：`P-002`
- 阶段计划：[`phase-002-plan.md`](phase-002-plan.md)
- 阶段计划修订：`1`
- 父路线图修订：`1`
- 完成日期：`2026-07-25`
- 状态：`completed`
- 交付与验证策略：`relaxed`
- 验证结论：`passed`
- 开始基线：分支 `prototype`，提交 `a75be46a624ecb3ef309cac019e597461ddfc6e9`；叠加不可变 P-001 未提交实现
- 结束基线：同一未提交工作树；P-002 文件清单如下，未提交、推送、重置或改写用户输入/P-001 结果

## 1. 阶段目标与结果

P-002 已在 P-001 的真实身份、设备、作用域授权、Workspace 与审计基础上交付可供 P-003 正式 CLI 消费的服务端同步协议：

- 公共 TypeBox 契约覆盖 Workspace metadata/version、完整 manifest、对象、lease acquire/renew/release/takeover、幂等 commit 和 `use_local`/`use_server`；错误具有稳定 code、request ID、适用的当前版本和恢复建议。
- 纯领域规则统一 NFC/相对 `/` 路径、保护路径拒绝、稳定排序/manifest SHA-256、租约/工作周期/连接/设备/token/base 校验和目标绑定提交摘要。
- `0003-workspace-sync-protocol` 以前向 migration 加入 lease、不可变 version/entries、对象引用和幂等记录，为 P-001 既有及后续新 Workspace 建立唯一空版本 0；PostgreSQL Workspace 行锁和部分唯一索引保证每个 Workspace/工作周期最多一个未撤销可提交租约。
- 独立 `@ngapd/object-store` 使用 SHA-256 派生 storage key、同目录临时文件、完整性校验和原子落位；路径不使用用户 manifest 路径，错误或孤立对象不能成为可见版本。
- 正式 API 使用短期设备 Bearer；每次读取资格，写入/续租/接管/冲突选择在 Workspace 锁内重新读取用户、设备、Membership/Owner、lifecycle、work cycle、lease 和 current version，不信任客户端角色声明。
- `SYNC-001`–`SYNC-007` 的服务端部分在两个隔离 Task Workspace 上重复通过；接管、到期、旧基线、工作周期、Owner、设备和 lifecycle 失效均不能改变旧持有者之外的权威事实。
- 相同幂等提交返回原版本，不同请求复用 key、错误/缺失对象和事务末端失败不产生可见半版本；应用/ObjectStore adapter 重建后版本、manifest 和对象保持一致。
- `use_local` 以当前服务端版本 CAS 创建一个新权威版本；`use_server` 返回不变的完整服务端版本和对象清单并审计。CLI 明确交互、本地冲突副本与原子物化仍严格属于 P-003，本结果不提前宣称 `AC-007` 客户端部分完成。

隔离 API 测试实例均由注入测试关闭；PostgreSQL cluster 已停止。专用数据库 `ngapd_workspace_sync_p002` 保留在已知测试 cluster 中作为可识别证据，无监听或活动 session；`/private/tmp/ngapd-workspace-sync-p002-objects` 保留为空的模式 `0700` 测试根。

## 2. 任务、需求与验收覆盖

| 任务 | 状态 | 需求与验收 | 完成结果 |
| --- | --- | --- | --- |
| `P-002-T-001` | completed | `FR-011`–`FR-025`、`FR-033`–`FR-036` / P-002 数据与纯规则范围的 `AC-006`–`AC-008`、`AC-011`–`AC-013`、`AC-017` | 同步契约、manifest/lease/CAS 纯规则、`0003`、transaction repository、内容寻址 ObjectStore 与确定性 fixture 完成；真实 PostgreSQL/ObjectStore 目标门禁通过 |
| `P-002-T-002` | completed | `FR-011`–`FR-025`、`FR-033`–`FR-036`、`FR-038` / `AC-006`、P-002 服务端范围的 `AC-007`、`AC-008`、`AC-011`–`AC-013`、`AC-016`、`AC-017` | 设备 Bearer、metadata/version/object、租约、幂等 commit、接管和双向冲突正式 REST 服务完成；两个隔离 Workspace 的服务端 `SYNC-001`–`SYNC-007`、重启/故障/审计/OpenAPI/根门禁通过 |

阶段验收结论：

- `AC-006`、`AC-008`、`AC-011`、P-002 范围的 `AC-012`、`AC-013`、`AC-016`、`AC-017` 已通过；P-001 的 `AC-004`/`AC-005` 授权与唯一 Workspace 基础保持通过。
- `AC-007` 的服务端明确 choice、资格复核、双方可识别版本、`use_local` CAS、`use_server` 不变版本及审计已通过；CLI 人工确认、本地冲突副本和原子物化留给 P-003。
- P-002 没有独立 supplemental 验收；没有 `FND-I-*`。

## 3. 文件修改

| 文件或范围 | 修改模式 | 结果 |
| --- | --- | --- |
| `packages/contracts/src/{workspaces,errors}.ts` | modify | 增加 Workspace/version/manifest/object/lease/commit/conflict TypeBox 契约和稳定错误 |
| `packages/domain/src/workspace.ts`、`workspace-sync.test.ts` | modify/add | 增加 manifest 规范/哈希、保护路径、lease/base 和幂等请求摘要纯规则及 16 项新增测试 |
| `packages/database/src/{migrations,types,foundation-repository,identity-repository,workspace-repository,index}.ts` | modify/add | 增加 `0003`、初始版本 0、设备访问令牌解析、Workspace 授权快照、行锁 lease/version/object/idempotency transaction repository |
| `packages/database/src/workspace-repository.integration.test.ts`、`foundation-repository.integration.test.ts`、`package.json` | add/modify | 串行真实 PostgreSQL migration/并发/CAS/幂等/事务回滚证据，并保留 P-001 foundation 回归 |
| `packages/object-store/**` | add | 新增独立 ObjectStore port、本地 SHA-256 内容寻址实现和 3 项完整性/重启测试 |
| `packages/test-fixtures/src/{workspace-sync,index}.ts`、`workspace-sync.test.ts` | add/modify | 新增确定性对象、manifest、合成 UUID 和 `SYNC-001`–`SYNC-007` fixture |
| `apps/api/src/modules/identity/{service,errors}.ts` | modify | 增加短期设备 Bearer 解析、撤销/停用即时拒绝和错误 current version 支持 |
| `apps/api/src/modules/workspaces/**` | add | 新增 Workspace 应用服务、正式 REST 路由、授权/lease/object/commit/conflict 协调与错误/审计映射 |
| `apps/api/src/{app,index}.ts`、`workspace.integration.test.ts`、`package.json` | modify/add | 注入 ObjectStore、注册同步模块、要求服务端对象根，并增加 2 次完整服务端场景、OpenAPI、秘密和重启测试 |
| `pnpm-lock.yaml` | modify | 仅增加 API 对 domain/ObjectStore/test-fixtures 的 workspace link 和新 ObjectStore workspace importer；无新增外部运行时包 |
| `prototypes/workspace-sync/results/p002-server-protocol.md` | add | 保存不含秘密/正文的 `SYNC-001`–`SYNC-007` 服务端结果摘要 |
| `docs/requirements/workspace-sync-prototype/execution/initial/{execution-state,phase-002-result}.md` | modify/add | 保存 T-001/T-002 检查点、验证、恢复与不可变 P-002 结果 |

`requirements.md`、`workflow-contract.md`、路线图、P-001 计划和 P-001 结果保持不变。

## 4. 测试与验证

| 检查 | 命令或过程 | 观察结果 | 结论 |
| --- | --- | --- | --- |
| 契约/领域 | contracts build；domain test/build | 公共 Schema 编译；5 个领域测试文件、25 项通过，覆盖确定 manifest、保护路径、lease/base 与摘要 | pass |
| ObjectStore | `@ngapd/object-store` test/build | 1 个文件、3 项通过；正确哈希、重复写、错误无可见对象、绝对根和 adapter 重建通过 | pass |
| Fixture | test-fixtures test/build | 4 个文件、6 项通过；P-002 对象/manifest 和场景 ID 确定 | pass |
| PostgreSQL | `DATABASE_TEST_URL=<隔离目标> pnpm --filter @ngapd/database test`；database build | 2 个文件、8 项通过；`0002 → 0003` 回填/no-op、新 Workspace、并发 lease/takeover、幂等/CAS、缺失对象与末端事务失败回滚通过 | pass |
| API 场景 | `DATABASE_TEST_URL=<隔离目标> pnpm --filter @ngapd/api test` | 3 个文件、9 项通过；两个隔离 Workspace 重复 `SYNC-001`–`SYNC-007`，覆盖设备 Bearer、对象、租约、版本、冲突选择、Owner/周期/设备/lifecycle、重启、OpenAPI 和审计脱敏 | pass |
| 数据库收尾只读汇总 | 隔离 `psql` 查询 migration、活动租约分组、版本与审计 | `0001`/`0002`/`0003` 完整；重复 active `(workspace, work_cycle)` 分组为 0；最大版本 3；Workspace 审计 44 条 | pass |
| 根门禁 | `DATABASE_TEST_URL=<隔离目标> pnpm check` | Prettier、ESLint、10 个 workspace build/typecheck；database 8、domain 25、ObjectStore 3、workspace-core 3、CLI/MCP 10、fixtures 6、API 9 项全部通过 | pass |
| 公共兼容与范围 | 根门禁、OpenAPI/工具注册/配置/外部调用/秘密/transient 扫描、`git diff --check` | 健康/系统信息、P-001 Identity/Web、CLI status/doctor 与两个只读 MCP 工具保持；无 Agent 写工具、无认证 fixture、本地 GUI、外部 API/AI/LLM、真实 secret、仓库内对象或数据库产物 | pass |
| 环境收尾 | `pg_ctl status`、隔离 ObjectStore 根检查 | PostgreSQL 无 server running；对象根为空且模式 `0700` | pass |

根门禁首次在 ESLint 阶段发现两个未使用 import；这是当前任务内的确定性实现缺陷，删除后从根门禁起点重跑并完整通过。API 场景开发时先后修正测试文件的非直接依赖导入与 canonical manifest 排序断言；均属于验证基础设施实现修正，最终证据无异常。

## 5. 发现项与处置

| ID | 类别 | 严重程度 | 关联需求/验收 | 观察与证据 | 最终功能影响 | 处置 | 置信度 | 建议后续 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |

无 `FND-I-*`。验证结论为 `passed`。

## 6. 决策、计划偏差与恢复记录

- 没有新增产品决策、用户问题、范围变化或阶段边界变化。
- 用独立 `@ngapd/object-store` workspace 表达服务端对象 port/adapter，保持 API、数据库和本地客户端依赖边界；只增加 workspace link，无新外部对象服务或运行时依赖。
- 对象先校验原子落位、数据库后登记并最后在版本 transaction 中引用；数据库失败可能留下不可见孤立对象，但不能产生可见半版本，符合路线图 TD-004。
- API 对象上传要求有效写资格和 lease headers；资格在 Workspace 锁内复核，跨介质窗口最多产生不可见孤立对象，不能改变 PostgreSQL 权威版本。
- P-002 结果记录的是服务端 `SYNC-006` 协议：返回完整不可变权威版本/manifest/对象；P-003 才证明本地原子替换。
- pnpm 首次离线链接尝试因供应链元数据校验需要网络而中止并移除了 `node_modules` 链接；随后获批访问官方 registry，锁文件供应链校验通过，并以 `--no-frozen-lockfile` 只加入三个 workspace link 后完整恢复。最终锁差异无外部版本变化。
- PostgreSQL 启动/localhost 连接因 sandbox shared-memory/网络限制使用获批本机隔离执行；目标始终为已知 `127.0.0.1:55432/ngapd_workspace_sync_p002`，未接触 P-001 或未知/生产数据库。

## 7. 遗留风险与下一阶段进入条件

- P-002 没有开放 finding、未决问题、半应用 migration、活动服务、对象残留、真实 secret 或未知数据变化。
- 服务端 lease、version、manifest、ObjectStore、commit 与 conflict API 已冻结，可供 P-003 直接实现 workspace-core、OS 凭据/文件端口和 CLI；CLI 不得直连数据库或复制授权/lease 规则。
- P-003 必须继续证明 CLI 明确 `use_local`/`use_server`、本地冲突副本、受限路径、扫描/差异、临时文件原子物化、OS 凭据和真实 macOS 双进程流程；本结果不替代这些 core 证据。
- `$plan-feature-implementation` 必须重新读取本结果、当前 state 和项目 diff，只创建 `phase-003-plan.md`；P-002 计划与本结果从此冻结。
- 本阶段完成不授权在同一 invocation 中规划或实施 P-003，也不授权创建 `change-0.md` 或 `effective-requirements.md`。
