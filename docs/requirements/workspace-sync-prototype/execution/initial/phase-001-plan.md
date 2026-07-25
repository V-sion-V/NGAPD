# Workspace Sync initial run：P-001 阶段计划

- 运行编号：`initial`
- 阶段：`P-001`
- 计划修订：`1`
- 父路线图修订：`1`
- 需求指纹：`sha256:ba747ca1506cc32b6bf27ef28bd4fa8e126bb8fa3f14ef2bd8454c19c3b65217`
- 项目基线：分支 `prototype`，提交 `a75be46a624ecb3ef309cac019e597461ddfc6e9`
- 创建日期：`2026-07-25`
- 细节级别：`expanded`
- 交付与验证策略：`relaxed`
- 验证结论：`pending`

## 1. 阶段目标、边界与关联需求

### 1.1 目标与安全出口

建立真实本地账号、Web session、一次性设备配对、最小 Project/Membership/Task、三级作用域授权、唯一逻辑 Workspace 和审计基础，使 P-002 可以在不重新定义身份或权限的情况下实现服务端租约与同步。

阶段出口必须同时满足：

- 身份、配对、作用域创建与授权使用真实 PostgreSQL 事务和约束，并在失败/并发下不留下缺失或重复 Workspace。
- Web 能完成注册、登录、退出、配对确认/拒绝和设备撤销的 P-001 范围；API 未认证、错误关联、过期、拒绝、重复消费和撤销路径稳定失败。
- 当前健康/系统信息、Web 基础能力、CLI status/doctor 与两个只读 MCP 工具保持可用；尚不开放租约、同步或 Agent 写能力。
- 隔离数据库、目标自动化、P-001 人工 Web 冒烟和根门禁通过，项目处于可构建安全状态。

### 1.2 前置事实

- 路线图修订 1 已审计通过；不存在 `change-0.md`、既有 initial state 或已完成 phase result。
- 仓库要求 Node `24.18.0` / pnpm `11.9.0`；对应 Node 已安装，默认 shell 当前为 Node 22，因此任何安装、构建或测试前必须显式启用仓库 Node 24。
- PostgreSQL `17.10` 客户端与服务管理工具已安装，当前实例未就绪；任务开始时必须启动 PostgreSQL 并使用明确的隔离测试数据库，不能对未知或生产数据库执行 migration。
- 规划前用户已有未跟踪文件仅为本功能 `requirements.md` 与 `workflow-contract.md`；实现不得改写或声称拥有它们。

### 1.3 范围

- 关联需求：`FR-001`–`FR-010`、`FR-032`–`FR-035`、`FR-038`。
- 当前阶段验收：`AC-001`、`AC-004`、`AC-005`、`AC-012`、`AC-013`、`AC-016`、`AC-017`，以及 `AC-002`/`AC-003` 的服务端和 Web 前置部分。
- 不在本阶段：活动租约、版本/manifest/ObjectStore、同步提交、冲突选择、本地扫描/物化、CLI 配对/同步、OS 凭据实装、macOS/Windows 端到端和任何 Agent 业务工具。

## 2. 任务与文件范围

### 2.1 任务

| 任务 | 结果 | 文件或范围 | 实现摘要 | 验证 | 完成条件 |
| --- | --- | --- | --- | --- | --- |
| `P-001-T-001` | 冻结可复用的身份/作用域契约、纯授权规则和首批 PostgreSQL 数据基础 | `packages/contracts`、`packages/domain`、`packages/database`、`packages/test-fixtures`、相关 package/lock/config | 增加 TypeBox Schema 与稳定错误；实现用户/项目/任务读取写入资格、有效 Task Owner 与配对状态纯规则；以前向 migration、Kysely 类型/repository/transaction 建立 users、sessions、devices、pairing、projects、memberships、tasks、workspaces、audit 及唯一/外键/状态约束；提供确定性授权 fixture | 契约构建、领域/fixture 单测、隔离 PostgreSQL migration 与 repository 集成、事务失败/重复/并发创建、既有 `system_metadata` 兼容 | Schema/领域/数据库边界稳定；三种 scope 的唯一 Workspace 与真实授权对照可重复证明；失败后数据库保持一致 |
| `P-001-T-002` | 交付安全的 Identity/Pairing/最小 scope 服务与 Web 人工流 | `apps/api`、`apps/web`、`.env.example`、`compose.yaml`、相关 package/lock/config | 在 Fastify 模块中接入 Argon2id、Cookie session、同源防护、认证上下文、配对/设备、最小 Project/Task fixture service 与审计；Web 加入注册/登录/退出、配对确认/拒绝、设备列表/撤销；所有调用复用 T-001 契约、领域和 repository | API 注入与真实 PostgreSQL 集成负向矩阵、OpenAPI/错误/request ID、秘密日志扫描、Web 构建/组件与 macOS 浏览器冒烟、最终 `pnpm check`、既有 CLI/API 兼容 | P-001 的 core 与硬门禁通过；未开放同步写流；实际文件、证据和偏差已写回 state |

依赖：`P-001-T-002` 依赖 `P-001-T-001` 完成并冻结其契约、领域和数据库边界。

### 2.2 风险相关文件所有权

| 文件或目录 | 任务 | 用途与所有权边界 |
| --- | --- | --- |
| `packages/contracts/src/identity.ts`、`pairing.ts`、`projects.ts`、`tasks.ts`、`workspaces.ts`、`index.ts`、`errors.ts` | T-001 | 新增外部 Schema、状态和稳定错误；T-002 只消费，不在同一阶段重复定义 |
| `packages/domain/src/authorization.ts`、`task-owner.ts`、`workspace.ts`、`index.ts` 及测试 | T-001 | 纯资格、有效 Owner、配对/Workspace 不变量；不得 import 数据库/API |
| `packages/database/src/migrations.ts`、`types.ts`、新增 repository/transaction 与集成测试 | T-001 | 只追加后继 migration，不修改 `0001-system-metadata` 语义；所有创建服务通过事务入口 |
| `packages/test-fixtures/src/*identity*`、`*workspace*`、`index.ts` 及测试 | T-001 | 确定性 Project/Membership/Task/Workspace 授权场景；不得产生生产 bootstrap 路由 |
| `apps/api/src/modules/identity/**`、`pairing/**`、`projects/**`、`tasks/**`、`authorization/**`、`audit/**` | T-002 | 路由、应用服务、认证上下文和审计；业务判断委托领域/数据库层 |
| `apps/api/src/app.ts`、`index.ts` 与测试 | T-002 | 注册模块、注入依赖与启动配置；保留健康、OpenAPI 和现有错误兼容 |
| `apps/web/src/**` 与 Web 测试 | T-002 | 只处理账号、配对和设备界面；不读取或上传 Workspace 文件 |
| `.env.example`、`compose.yaml` | T-002 | 增加非秘密配置名称和部署注入，不提交真实 secret |
| `package.json`、受影响 workspace `package.json`、`pnpm-lock.yaml` | 各自任务 | 只增加 Node 24 可用的 Argon2/session/test 依赖与脚本；锁文件在最后一次依赖变化后统一生成 |

### 2.3 暴露接口与数据约束

- TypeBox：注册/登录/退出、session actor、配对请求/决定/轮询/消费、设备摘要/撤销、Project/Membership/Task fixture service、Workspace scope metadata、稳定 API error。
- 领域：`resolveEffectiveTaskOwner`、`resolveWorkspaceReadAccess`、`resolveWorkspaceWriteEligibility` 和配对状态转换采用纯输入/输出，不接收客户端自报角色为权威。
- 数据库：repository 只返回明确 DTO；创建用户/项目/任务与对应初始空 Workspace 使用单事务；Project Owner、Membership 状态、Task 祖先与 scope 唯一性由数据库和服务共同约束。
- API：新路由位于 `/api/v1`；session Cookie 只返回不透明标识，设备/配对响应不返回数据库摘要；状态修改执行认证、同源和运行时 Schema。
- Web：React 页面调用正式 API；配对决定前显示设备摘要并要求明确确认/拒绝；不在浏览器持久化密码、令牌或对象内容。

### 2.4 执行顺序

1. T-001 开始前把 state 的运行/阶段/任务改为 `in_progress`，记录 Node 24、隔离数据库标识、当前 Git 范围和完成条件；确认数据库目标不是生产。
2. 先定义契约与纯领域不变量，再追加 migration、Kysely 类型、repository/transaction 和 fixture；先在全新隔离数据库验证 migration，再验证已有 `system_metadata` 数据上的升级与失败恢复。
3. T-001 的目标测试通过后写入任务后检查点；只有数据库结构、授权矩阵和创建事务都稳定，才开始 T-002。
4. T-002 先建立认证/同源/request ID/审计公共设施，再实现 Identity、Pairing、最小 Project/Task 应用服务和 Web 页面；秘密在进入普通日志前统一脱敏。
5. 所有 P-001 实现完成后，在最后一次可能影响结果的位置执行第 3 节验证；失败时停留在当前任务，不开始 P-002 规划或工作流收尾。

## 3. 验证与完成条件

### 3.1 目标验证

1. 使用仓库 Node `v24.18.0` 和 pnpm `11.9.0`；若无法启用，暂停，不用 Node 22 结果替代。
2. 在明确的隔离 PostgreSQL 17 数据库执行 migration：全新安装、保留既有 `system_metadata` 的升级、重复 migrate no-op、约束/事务故障；目标数据库不得包含用户生产数据。
3. 执行受影响 workspace 的契约构建、领域/fixture 单测、database 集成、API 注入/集成和 Web 构建/组件测试；测试必须覆盖：
   - Argon2id 摘要而非明文，注册/项目/任务与唯一 Workspace 原子性；
   - Cookie 属性、匿名/停用/session 过期与同源拒绝；
   - 配对错误尝试、过期、拒绝、错误关联、重复消费与撤销；
   - 用户级本人、Project Owner/Admin、Task 有效 Owner 的写资格及所有对照拒绝；
   - OpenAPI、稳定错误、request ID、审计字段和普通日志脱敏。
4. 在本机 macOS 浏览器对隔离数据执行一次注册、登录、退出、配对确认/拒绝和设备撤销冒烟；只记录合成标识与可复现实验结论，不记录真实密码、Cookie 或令牌。
5. 在全部依赖和代码稳定后执行一次根 `pnpm check`；随后检查现有 `/health/*`、`/api/v1/system/info`、Web 构建、CLI status/doctor 和 MCP 只读工具仍兼容，并确认没有 Agent 业务工具、无认证 fixture 路由或外部 API/AI/LLM 调用。

### 3.2 Core 阻塞门禁

- `AC-001`、`AC-004`、`AC-005`、P-001 范围内的 `AC-012`、`AC-013`、`AC-016`、`AC-017` 全部通过。
- `AC-002`/`AC-003` 的服务端/Web 前置必须通过；CLI 和 OS 凭据剩余证据明确留给 P-003，不能把未实现部分误报为已验收。
- 任何认证、授权、秘密泄露、数据完整性、migration、公共兼容、构建、恢复或用户已有工作保护问题均阻塞。
- `system_metadata` 和已有健康/诊断行为不退化；P-001 结束时不存在半应用 migration、活跃测试秘密或未知数据库目标。

### 3.3 Supplemental 与 finding

P-001 没有可独立关闭的 supplemental 验收。若发现仅影响未来状态呈现或测试夹具精度的异常，只有在独立证据证明所有关联 core 和硬门禁不受影响后，才可从 `FND-I-001` 起记录 report-only finding；未知影响、安全、数据、兼容或 required-gate 异常仍阻塞。

### 3.4 阶段完成条件

- T-001、T-002 都在 execution state 中有任务前/后检查点、实际文件、验证与偏差。
- 所有 P-001 core/硬门禁通过，验证结论为 `passed` 或只含合规 finding 的 `passed_with_findings`。
- 项目可构建，无未决问题、半应用 migration、未清理测试身份或未知数据变化。
- 创建不可变 `phase-001-result.md` 后把运行置为 `awaiting_next_phase`；本次 invocation 不提前创建 P-002 计划。

## 4. 风险、恢复与修订记录

### 4.1 风险与恢复

- 数据库目标：任务前记录隔离数据库名称和连接目标摘要，不输出密码。若目标身份无法确定或疑似生产，立即暂停。测试数据库可以重建；含业务写入的数据库不得盲目 down。
- migration：若 migration 失败，停止 API 启动，保留 Kysely migration 状态、错误和当前 schema 证据；先在隔离数据库修复并重跑。不得手工跳过失败项或用部分新表继续。
- 认证秘密：测试只使用合成秘密；任何普通日志、测试快照或 Git diff 出现密码、Cookie、配对/设备/session token 时立即阻塞并轮换测试材料。
- 公共兼容：若健康、Web 构建或 CLI 诊断退化，只修复受影响边界并重跑其目标检查及最终根门禁；不得通过删除既有检查完成阶段。
- 锁文件与用户工作：依赖变化后用 pnpm 11 更新 lockfile，不整文件替换用户文档；`requirements.md` 与 `workflow-contract.md` 保持输入权威。

精确恢复入口：读取 `execution/initial/execution-state.md` 的当前检查点，核对 requirements/roadmap/phase 指纹与 Git 范围，显式启用 Node `v24.18.0`，验证记录中的隔离 PostgreSQL 目标，然后从当前 `in_progress` 任务的第一个未完成步骤继续。暂停或结束前必须先把实际数据库状态、文件 diff、已观察验证和下一步写回 state。

### 4.2 修订记录

| 修订 | 日期 | 变更 | 原因 | 影响 |
| --- | --- | --- | --- | --- |
| 1 | 2026-07-25 | 初始 P-001 expanded 即时计划 | P-001 前置条件可满足；migration、认证秘密、公开接口和用户输入文件需要风险相关的所有权、顺序与恢复证据 | 建立 T-001/T-002、P-001 验证和安全出口 |
