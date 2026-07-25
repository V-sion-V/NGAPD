# Workspace Sync initial run：P-002 阶段计划

- 运行编号：`initial`
- 阶段：`P-002`
- 计划修订：`1`
- 父路线图修订：`1`
- 需求指纹：`sha256:ba747ca1506cc32b6bf27ef28bd4fa8e126bb8fa3f14ef2bd8454c19c3b65217`
- 项目基线：分支 `prototype`，提交 `a75be46a624ecb3ef309cac019e597461ddfc6e9`；叠加已冻结的 P-001 未提交实现
- 创建日期：`2026-07-25`
- 细节级别：`expanded`
- 交付与验证策略：`relaxed`
- 验证结论：`pending`

## 1. 阶段目标、边界与关联需求

### 1.1 目标与安全出口

在 P-001 的真实身份、设备、作用域授权、Workspace 与审计基础上，交付可由后续 CLI 直接调用的服务端同步协议：设备认证、多个只读连接、唯一写租约、不可变版本与完整 manifest、内容寻址 ObjectStore、CAS/幂等提交、强制接管和双向冲突选择。

阶段出口必须同时满足：

- `SYNC-001`–`SYNC-007` 的服务端部分在真实 PostgreSQL 17 和隔离本地 ObjectStore 上确定性重复通过；任一 Workspace/工作周期最多一个可提交租约，旧租约、旧基线、旧设备或失去资格者不能改变服务端事实。
- 每个 Workspace 具有可读取的初始空版本 0；成功提交只增加一个不可变版本，幂等重试不重复增加版本，错误幂等复用、缺失/错误对象和事务失败不产生可见半版本。
- `use_local` 通过当前权威版本 CAS 创建唯一新版本；`use_server` 只确认并返回当前不可变服务端版本及对象清单，不修改服务端事实。P-003 才负责 CLI 明确交互、本地冲突副本和原子物化，因此本阶段不宣称 `AC-007` 的客户端部分完成。
- 新同步 REST 接口具有 TypeBox 运行时校验、OpenAPI、稳定错误、request ID 与脱敏审计；既有身份/Web、健康、系统信息、CLI status/doctor 和两个只读 MCP 工具保持兼容。
- 第二批前向 migration、目标自动化、重启/故障恢复、范围检查和根门禁通过，仓库处于可构建且可安全进入 P-003 的状态。

### 1.2 已验证前置事实

- P-001 的 [`phase-001-result.md`](phase-001-result.md) 状态为 `completed`、验证为 `passed`；其计划和结果已冻结，当前 state 为 `awaiting_next_phase`，无未决问题、finding、半应用 migration 或活动测试服务。
- requirements、路线图与 P-001 计划指纹仍分别为 `ba747ca…5217`、`baaa0c…2af0`、`50340de…966f`；路线图修订仍为 1，P-002 是唯一 eligible 的未规划阶段。
- P-001 已交付 `0002-workspace-foundation`、`sync_version = 0` 的 Workspace、真实用户/设备/授权 repository、审计与 Identity API；尚无 lease/version/manifest/object/idempotency 表、ObjectStore 实现、设备 Bearer 解析或同步路由。
- 仓库要求 Node `24.18.0` / pnpm `11.9.0`；默认 shell 仍可能是 Node 22，执行前必须显式启用仓库 Node 24。
- 已知 P-001 隔离 PostgreSQL cluster 位于 `/private/tmp/ngapd-workspace-sync-p001-pgdata` 且当前停止。P-002 只可在明确隔离数据库 `ngapd_workspace_sync_p002` 上运行 migration/集成测试，并使用仓库外隔离对象目录 `/private/tmp/ngapd-workspace-sync-p002-objects`；不得接触未知或生产数据。

### 1.3 范围

- 关联需求：`FR-011`–`FR-025`、`FR-033`–`FR-036`、`FR-038`。
- 当前阶段 core：`AC-006`、`AC-008`、`AC-011`、`AC-012`、`AC-013`、`AC-016`、`AC-017`；`AC-004`/`AC-005` 作为持续授权与数据基础门禁；`AC-007` 只关闭服务端协议部分。
- 场景：完整实现并记录 `SYNC-001`–`SYNC-007` 的服务端请求、租约/基线、权威 manifest 与审计结果；`SYNC-005` 验证 `use_local` 服务端 CAS，`SYNC-006` 验证 `use_server` 返回未变的权威版本，客户端文件替换留给 P-003。
- 不在本阶段：本地路径登记、扫描/差异、文件监听、OS 凭据实装、CLI 命令/提示与明确选择 UI、本地冲突副本、下载原子替换、macOS/Windows 实机文件系统证据、Agent 业务工具和后台 GC。

## 2. 任务与文件范围

### 2.1 任务

| 任务 | 结果 | 文件或范围 | 实现摘要 | 验证 | 完成条件 |
| --- | --- | --- | --- | --- | --- |
| `P-002-T-001` | 冻结服务端同步契约、纯规则、第二批数据模型与 ObjectStore 边界 | `packages/contracts`、`packages/domain`、`packages/database`、新增服务端 ObjectStore 模块、`packages/test-fixtures`、相关 package/lock/config | 增加 Workspace metadata/version/manifest/object/lease/commit/conflict Schema 与稳定错误；用纯规则表达服务端时钟租约、资格/周期/基线复核、manifest 确定性、CAS、幂等摘要和冲突选择；追加 `0003-workspace-sync-protocol`，回填初始空版本 0，并加入 lease/version/entries/object/idempotency 约束、事务 repository 和 SHA-256 内容寻址文件存储 | contracts/domain 目标构建与单测；全新/从 P-001 升级/重复 migrate；真实 PostgreSQL 并发/回滚；隔离 ObjectStore 写入、重复、哈希错误、缺失和重启读取 | 数据与接口边界可供 API 直接消费；数据库和对象引用以失败安全顺序写入；任何失败都不改变可见版本或破坏 `system_metadata`/P-001 事实 |
| `P-002-T-002` | 交付设备认证的 Workspace/lease/object/commit/conflict REST 服务并通过服务端场景门禁 | `apps/api/src/modules/workspaces/**`、Identity 设备认证扩展、`apps/api/src/{app,index}.ts`、API/fixture 集成测试、`prototypes/workspace-sync/results/**`、`.env.example`/`compose.yaml`（仅需时）、相关 package/lock/config | 解析短期设备 Bearer 身份；每次读取/续租/提交/接管/选择都从 PostgreSQL 重建授权事实；实现 metadata/manifest/object、获取/续租/释放/接管、幂等 commit 与 `use_local`/`use_server`；在事务内写版本及审计，稳定映射争用、过期、撤销、资格/周期/基线和对象错误 | 真实 PostgreSQL + 隔离 ObjectStore API 集成；`SYNC-001`–`SYNC-007` 重复、并发、故障注入和重启；OpenAPI/错误/request ID/审计脱敏；目标 build/typecheck/test；最后一次根 `pnpm check` 与既有 API/Web/CLI/MCP 兼容 | P-002 core/硬门禁通过，服务端事实可由 P-003 的正式 CLI 消费；无本地文件实现、无 Agent 写工具、无无认证 fixture 路由；实际文件、证据和偏差写回 state |

依赖：`P-002-T-002` 依赖 `P-002-T-001` 完成并冻结契约、领域、migration/repository 与 ObjectStore port；不得在路由层另写一套租约或授权规则。

### 2.2 风险相关文件所有权

| 文件或目录 | 任务 | 用途与所有权边界 |
| --- | --- | --- |
| `packages/contracts/src/workspaces.ts`、`errors.ts`、`index.ts` 及相关新文件 | T-001 | 公共 Workspace/version/manifest/object/lease/commit/conflict TypeBox Schema 与稳定错误；不得暴露数据库行型、对象物理路径、令牌摘要或 CLI 文本 |
| `packages/domain/src/workspace.ts` 及测试 | T-001 | 纯租约/CAS/冲突/manifest 不变量；接收服务端提供的 `now` 和权威事实，不读取数据库、文件系统或客户端角色声明 |
| `packages/database/src/migrations.ts`、`types.ts`、新增 workspace repository 与集成测试 | T-001 | 追加第二批 migration、行锁/事务、唯一活动租约、不可变版本、对象引用和幂等结果；不改写 `0001`/`0002` 已有语义 |
| 服务端 ObjectStore port/本地实现及测试 | T-001 | 使用哈希派生的存储键和临时文件校验/原子落位；根目录由显式配置注入且不得位于用户 Workspace；不接受用户路径作为存储键 |
| `packages/test-fixtures/src/*workspace-sync*`、`prototypes/workspace-sync/fixtures/**` | T-001/T-002 | 复用已存在的确定性场景和 manifest，补充真实 UUID/字节/授权构建器；不得修改场景语义或开放生产 bootstrap 路由 |
| `apps/api/src/modules/identity/**` | T-002 | 只扩展短期设备访问令牌解析/认证上下文与撤销即时性，不改变已冻结的 Web session/配对行为 |
| `apps/api/src/modules/workspaces/**` | T-002 | 应用服务、正式路由、授权事实装配、错误映射和审计协调；调用 T-001 规则/repository/ObjectStore，不复制底层不变量 |
| `apps/api/src/app.ts`、`index.ts` 与 API 测试 | T-002 | 注入数据库、服务端时钟和 ObjectStore，注册 `/api/v1` 路由；保留健康、OpenAPI 和通用错误处理 |
| `prototypes/workspace-sync/results/**` | T-002 | 按既有模板记录合成请求/响应摘要、租约/版本/manifest 与审计结论；不得记录 Bearer、租约令牌、设备凭据或对象全文 |
| `.env.example`、`compose.yaml`、受影响 `package.json`、`pnpm-lock.yaml` | 各自任务 | 只在现有配置不足时接通 `OBJECT_STORE_PATH` 与 workspace 内部依赖；不提交真实 secret，不无依据新增外部服务 |

### 2.3 暴露接口与数据约束

- 契约至少覆盖：Workspace metadata/current version、规范化完整 manifest、对象存在/上传/下载、lease acquire/renew/release/takeover、commit request/result、conflict `use_local`/`use_server` request/result，以及恢复建议和当前版本。
- manifest 路径为 NFC、`/` 分隔的规范化相对路径；条目按路径稳定排序，每项包含 `path`、`kind`、`size`、`sha256`。服务端拒绝绝对/穿越/保护路径、重复规范路径、非文件条目和摘要/大小不一致；P-003 再增加平台映射、链接和扫描竞态检查。
- ObjectStore port 以 SHA-256 和字节流/缓冲为输入，执行 `putVerified`、`exists`、`read` 等最小能力；本地实现写入同根临时文件、校验后原子重命名，已存在相同哈希为安全成功，错误哈希不留下可引用对象。
- `workspace_versions` 记录 Workspace、单调版本、完整 manifest 摘要、创建者/设备/租约/幂等来源和时间；entries 与对象引用只指向已校验对象。版本 0 是不可变空 manifest，P-001 已有 Workspace 在 migration 中确定性回填。
- lease 绑定 Workspace、`work_cycle`、用户、设备、连接、不可逆 token 摘要、`base_sync_version`、签发/续租/过期/撤销时间与原因；数据库保证同 Workspace/周期最多一个可提交 active 行。过期只由注入的服务端时钟判断，获取新租约前在同一 Workspace 锁内终止过期行。
- 幂等目标至少绑定设备/用户、Workspace、操作、key、规范请求摘要和稳定结果；相同目标/键/摘要重放原结果，不同摘要稳定冲突。幂等成功记录与版本创建在同一事务，失败不得保存伪成功。
- API 使用 `Authorization: Bearer <短期设备访问令牌>`；只比较数据库摘要，响应、错误、审计和普通日志不含访问令牌、租约令牌、设备凭据、对象全文或物理存储路径。Web session 不自动成为 CLI 同步写身份。
- 所有写服务在事务内锁定 Workspace 权威行，重新读取账号、设备、Membership/Owner、Workspace lifecycle/work cycle、lease 与当前版本；对象存在/哈希校验在版本引用提交前完成，数据库 commit 是可见性的唯一边界。
- `use_local` 需要新取得的有效租约、明确 choice、当前服务端版本和完整本地 manifest，复用 commit/CAS 原语并审计；`use_server` 需要仍有写资格、有效租约和明确 choice，只返回当前服务端版本/manifest/对象获取信息并审计，不建立重复版本。

### 2.4 执行顺序

1. T-001 开始前把 state 的运行/阶段/任务置为 `in_progress`，记录 Git 范围、Node 24、隔离 PostgreSQL 数据库和隔离 ObjectStore 绝对路径；验证路径不位于仓库、用户 Workspace 或未知数据根。
2. 先扩展契约和纯领域规则，再追加 migration、Kysely 类型、transaction repository 与 ObjectStore port/本地实现；先在全新 P-002 数据库验证，再验证从完整 P-001 schema/数据升级、初始版本回填、重复 migrate 与失败恢复。
3. 在 repository 测试中证明 Workspace 行锁、过期清理、活动租约唯一性、CAS、幂等与不可变版本；在 ObjectStore 测试中证明正确哈希落位、重复安全、错误/中断不可引用和进程重建后可读。目标门禁通过后写 T-001 后检查点。
4. T-002 先加入设备 Bearer 解析与 Workspace 授权事实装配，再按 metadata/manifest/object、lease、commit、conflict 顺序注册应用服务和路由；所有错误通过公共 handler 输出稳定 code、request ID、适用的当前版本和恢复建议。
5. 使用测试构建器而非生产 seed 路由执行 `SYNC-001`–`SYNC-007`，包含并发请求、可控服务端时钟、设备/Owner/成员/lifecycle/work-cycle 变化、对象缺失/错误、事务故障和 API/服务重启；结果写入原型 results。
6. 所有实现稳定后在最后一次可能影响结果的位置执行第 3 节门禁。任何 core/硬门禁失败都停留在当前任务修复；不得开始 P-003 规划、CLI/本地文件实现或 initial run 收尾。

## 3. 验证与完成条件

### 3.1 目标验证

1. 显式使用仓库 Node `v24.18.0` 和 pnpm `11.9.0`；若无法启用，不以 Node 22 结果替代。
2. 在明确隔离的 PostgreSQL 17 目标执行第二批 migration：全新安装、从保留 P-001 身份/Workspace/`system_metadata` 数据升级、为全部 Workspace 回填唯一空版本 0、重复 migrate no-op、约束/事务故障与重启读取。
3. 对契约/领域/database/ObjectStore 运行最小充分目标检查，至少证明：
   - 多读连接不创建写 lease；并发 acquire/takeover 只有一个可提交持有者，服务端时间到期、续租/释放和旧 token/连接/周期稳定；
   - 当前真实资格、设备、lifecycle、work cycle 和 base version 每次复核，任一变化后旧租约不可续租或提交；
   - manifest 规范/排序/摘要确定，对象正确哈希才可引用；失败对象写、缺失/错误对象、数据库回滚不产生可见版本；
   - CAS 只从当前版本增加 1，相同幂等请求返回相同结果，不同内容复用 key 拒绝，版本/entries 不可变。
4. 对正式 API 运行真实 PostgreSQL + ObjectStore 集成，覆盖 metadata/manifest/object、lease 全生命周期、commit 和两种 conflict choice；验证 TypeBox、OpenAPI、Bearer 撤销、稳定错误/current version/recovery、request ID 和成功/拒绝审计脱敏。
5. 将 `SYNC-001`–`SYNC-007` 至少连续执行两次，隔离各次 Workspace/幂等目标；加入两个并发客户端、可控时钟、事务故障、ObjectStore 中断和进程重建。每个场景记录合成 ID、状态转换、前后版本/manifest 摘要及审计，不记录秘密或正文。
6. 在全部依赖和代码变化完成后执行一次根 `pnpm check`；随后确认 `/health/*`、`/api/v1/system/info`、P-001 Identity/Web、CLI status/doctor 和两个只读 MCP 工具仍兼容，并静态确认无 Agent 业务工具、无认证 fixture 路由、本地 GUI、外部 API/AI/LLM 或仓库内对象/数据库临时产物。

### 3.2 Core 阻塞门禁

- P-002 范围的 `AC-006`、`AC-008`、`AC-011`、`AC-012`、`AC-013`、`AC-016`、`AC-017` 全部通过；P-001 的 `AC-004`/`AC-005` 数据与授权基础不退化。
- `AC-007` 的服务端 `use_local`/`use_server` 协议、明确 choice 字段、资格复核、双方可识别版本保留与审计必须通过；CLI 人工确认、冲突副本和原子物化明确保留给 P-003，不能在本结果中误报整体完成。
- 任一授权绕过、秘密/全文泄露、双 active writer、非单调/半可见版本、manifest 引用缺失或错误对象、幂等漂移、migration/重启损坏、公共兼容、构建或恢复异常均阻塞。
- P-002 结束时不得存在半应用 migration、活动测试服务、未知数据库/ObjectStore 目标、仓库内对象字节或未说明的数据变化。

### 3.3 Supplemental 与 finding

P-002 没有可独立关闭的 supplemental 验收；性能、软限制呈现与完整 CLI 状态属于 P-003/P-004。若发现仅影响非交付性的原型结果呈现，只有独立证据证明所有关联 core、数据完整性和硬门禁均不受影响后，才可从 state 的下一 ID `FND-I-001` 连续记录 report-only finding。未知影响或与安全、授权、版本、对象、恢复、兼容、required gate 相关的异常仍阻塞，不能为保留 finding 单独安排修复或重复诊断。

### 3.4 阶段完成条件

- T-001、T-002 都在 execution state 中有任务前/后检查点、实际文件、数据库/ObjectStore 状态、验证与偏差。
- P-002 core/硬门禁通过，验证结论为 `passed` 或只含合规 finding 的 `passed_with_findings`；服务端 `SYNC-001`–`SYNC-007` 可重复，客户端剩余边界明确。
- 项目可构建，无未决问题、半应用 migration、活动测试服务、未清理的合成 secret 或未知数据变化。
- 创建不可变 `phase-002-result.md` 后把运行置为 `awaiting_next_phase`；该 implementation invocation 不创建 P-003 计划、不实现 CLI/本地文件，并保留 `change-0.md`/`effective-requirements.md` 未创建。

## 4. 风险、恢复与修订记录

### 4.1 风险与恢复

- 数据库/ObjectStore 目标：任务前记录隔离数据库名、监听目标摘要和对象根绝对路径，不输出密码。若目标身份不明、疑似生产或对象根落入仓库/用户 Workspace，立即暂停。隔离目标可重建；有业务事实的目标不得盲目 down 或删除。
- migration：失败时停止同步服务启动，保留 Kysely migration 状态、schema 和既有数据证据；只在隔离数据库修复后重跑，不手工跳过 `0003` 或用部分表写业务。
- 多 writer/CAS：所有 acquire/takeover/commit 在 Workspace 行锁和数据库约束下串行决定。若测试出现两个可提交租约、版本跳号或旧资格成功，视为 core 缺陷，保留失败事实并停在当前任务。
- 跨介质一致性：对象先校验落位，数据库引用后提交；数据库回滚可留下不可见孤立对象。若已提交 manifest 引用缺失/错误字节，立即阻塞，不以重试或 GC 掩盖。
- 秘密与证据：测试只用合成访问/租约 token，数据库仅存摘要；普通日志、结果、错误、审计、Git diff 出现真实 token、凭据或对象全文时立即阻塞并轮换合成材料。
- 公共兼容与用户工作：P-001 API/Web 和既有诊断退化时只修复受影响边界并重跑其目标检查及最终根门禁；不改写 requirements、contract、P-001 计划/结果或用户已有文件。

精确恢复入口：读取 `execution/initial/execution-state.md`、本计划与不可变 P-001 结果，核对 requirements/roadmap/phase 指纹和当前 Git 范围；显式启用 Node `v24.18.0`；启动并验证 state 记录的隔离 PostgreSQL 目标，创建/验证 `/private/tmp/ngapd-workspace-sync-p002-objects` 不在仓库或用户 Workspace；再从 state 当前 `in_progress` 任务的第一个未完成步骤继续。暂停或结束前必须把数据库/ObjectStore 状态、实际 diff、已观察验证、finding/偏差和下一步写回 state。

### 4.2 修订记录

| 修订 | 日期 | 变更 | 原因 | 影响 |
| --- | --- | --- | --- | --- |
| 1 | 2026-07-25 | 初始 P-002 expanded 即时计划 | P-001 出口仍成立；第二批 migration、多个 writer、公共同步 API 与数据库/ObjectStore 跨介质恢复需要风险相关的所有权、顺序和证据 | 建立 T-001/T-002、服务端 `SYNC-001`–`SYNC-007` 门禁和进入 P-003 的安全出口 |
