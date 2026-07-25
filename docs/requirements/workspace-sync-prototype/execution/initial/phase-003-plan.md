# Workspace Sync initial run：P-003 阶段计划

- 运行编号：`initial`
- 阶段：`P-003`
- 计划修订：`1`
- 父路线图修订：`1`
- 需求指纹：`sha256:ba747ca1506cc32b6bf27ef28bd4fa8e126bb8fa3f14ef2bd8454c19c3b65217`
- 项目基线：分支 `prototype`，提交 `a75be46a624ecb3ef309cac019e597461ddfc6e9`；叠加已冻结的 P-001/P-002 未提交实现
- 创建日期：`2026-07-25`
- 细节级别：`expanded`
- 交付与验证策略：`relaxed`
- 验证结论：`pending`

## 1. 阶段目标、边界与关联需求

### 1.1 目标与安全出口

在 P-001/P-002 已冻结的真实身份、作用域授权和服务端同步协议上，交付 UI/CLI 无关的本地 Workspace 核心、受限 macOS 文件与凭据适配器，以及可实际使用的 Workspace CLI；用真实 macOS Apple Silicon、Web 配对、OS 凭据、两个 CLI 进程和隔离 PostgreSQL/ObjectStore 完成客户端主体证据。

阶段出口必须同时满足：

- CLI 不接收账号密码；一次性配对、关联状态轮询、设备凭据换取短期访问令牌和当前设备撤销都通过正式版本化 API。长期设备材料和活动租约秘密只经 OS 凭据端口，秘密不进入参数、普通输出、日志、审计或本地控制状态。
- `@ngapd/workspace-core` 独立实现规范路径、保护路径、平台映射、重新扫描、稳定 manifest/差异、本地副本状态、冲突编排、恢复日志和原子物化；不依赖 CLI 参数解析、React/DOM、数据库或具体凭据实现。
- 本地访问只落在用户配置的 NGAPD 根和已登记 Workspace 路径；路径穿越、越界或任意符号链接、大小写/Unicode 碰撞、Windows 保留名/非法字符和保护路径在产生对象或写入前稳定拒绝。
- CLI 能完成人工配对、认证状态/当前设备退出、连接/首次物化、Workspace 状态、租约获取/续租/释放/接管、正常同步和显式 `use_local`/`use_server`；租约或基线失效时停止上传，保留可识别本地冲突副本且不替用户选择。
- `SYNC-001`–`SYNC-009` 的完整客户端/服务端路径在真实 macOS arm64 上可重复；故障注入不能把部分物化标记为已同步，两个进程不能成为两个合法写入者，已失效设备/租约/资格不能提交。
- P-003 core、硬门禁和根项目检查通过；supplemental 通过或按 `relaxed` 规则记录连续 `FND-I-*`。阶段完成后安全停在 `awaiting_next_phase`，不提前规划 P-004 或创建 `change-0.md`/`effective-requirements.md`。

### 1.2 已验证前置事实

- P-001/P-002 的不可变 result 状态均为 `completed`、验证均为 `passed`；requirements、路线图和 P-002 计划指纹仍分别为 `ba747ca…5217`、`baaa0c…2af0`、`53abdace…34d7`，state 为 `awaiting_next_phase`，P-003 是唯一 eligible 阶段。
- P-002 已提供设备 Bearer、Workspace metadata/version/object、lease、commit 和 conflict REST 契约；CLI 不得直连数据库、读取服务端 ObjectStore 路径或复制授权/租约判定。
- 现有配对消费会一次性返回 15 分钟访问令牌与设备凭据，但尚无关联秘密保护的 CLI 状态查询、设备凭据换取新短令牌或 Bearer 撤销当前设备接口；错误关联会计数但尚未达到上限后终止。P-003 以 additive API/契约/repository 扩展关闭 `FR-003`–`FR-006` 的完整客户端认证闭环，不改写已冻结阶段结果。
- `packages/workspace-core` 仍只有离线状态/诊断和平台信息端口；`apps/workspace-cli` 仍只有 help/version/status/doctor、两个只读 MCP 工具和 stdio transport，没有网络、路径、凭据或同步实现。
- 主机为 macOS `26.5.2` arm64，数据卷为 APFS；`/usr/bin/security` 可执行，可使用仓库外一次性测试 Keychain 验证真实 OS 凭据适配器。Docker/Windows 实机仍不可用，Windows core 证据严格留给 P-004。
- 默认 shell Node 为 `v22.22.1`，仓库 Node `v24.18.0` 位于已知 NVM 路径，pnpm 为 `11.9.0`；执行与验证必须显式启用 Node 24。
- 已知 PostgreSQL 17.10 cluster 位于 `/private/tmp/ngapd-workspace-sync-p001-pgdata` 且当前停止；P-002 对象根 `/private/tmp/ngapd-workspace-sync-p002-objects` 为空、模式 `0700`。P-003 只使用新的隔离数据库 `ngapd_workspace_sync_p003` 和 P-003 专用临时根。

### 1.3 范围

- 关联需求：`FR-003`–`FR-006`、`FR-021`–`FR-032`、`FR-036`–`FR-038`。
- 当前阶段 core：`AC-002`、`AC-003`、`AC-006`–`AC-014`、`AC-016`、`AC-017`；P-001/P-002 已通过的身份、授权、幂等、migration、公共接口和数据完整性结论持续作为回归门禁。
- 当前阶段 supplemental：`AC-018`–`AC-020`。其中 `AC-019` 的“不得损坏既有服务端版本”仍是数据完整性硬门禁。
- 场景：以正式 API、真实 macOS 文件系统/Keychain 和两个 CLI 进程重复执行 `SYNC-001`–`SYNC-009`；包括 Web 人工批准/拒绝、首次物化、文本/二进制/删除/重命名、租约争用/接管/到期、旧基线、两种冲突选择、Owner/设备失效、保护路径和跨平台名称。
- 不在本阶段：Windows 11 x64/NTFS 证据、Task UI、Agent Context、完整 Project/Task UI、本地 GUI、文件监听正确性、后台 daemon/局域网 IPC、Agent 业务写 MCP 工具、外部 API/AI/LLM、对象 GC、安装器或生产级 HA。

## 2. 任务与文件范围

### 2.1 任务

| 任务 | 结果 | 文件或范围 | 实现摘要 | 验证 | 完成条件 |
| --- | --- | --- | --- | --- | --- |
| `P-003-T-001` | 冻结 CLI 可持续使用且可撤销的设备认证闭环 | `packages/contracts/src/{identity,pairing,errors,index}.ts`、`packages/database/src/identity-repository.ts` 及测试、`apps/api/src/modules/identity/**`、Identity API 集成测试、相关 package/lock/config | 增加关联秘密保护的配对状态查询、稳定 pending/尝试超限结果、设备凭据换取短期访问令牌、Bearer 撤销当前设备；在事务内验证账号/设备/凭据与撤销状态、限制错误关联、签发摘要令牌并写脱敏审计；既有 Web session/配对/设备列表路由保持兼容 | contracts build；Identity repository/API 真实 PostgreSQL 正负向、并发/单次消费/尝试上限/短令牌过期与刷新/当前撤销；OpenAPI、request ID、审计和秘密扫描 | CLI 每次进程可只从 OS 端口取长期材料并在内存获得短令牌；撤销后刷新、续租和写入稳定失败；P-001/P-002 既有接口与测试不退化 |
| `P-003-T-002` | 冻结平台无关本地同步核心与真实 macOS 端口 | `packages/workspace-core/src/**`、`apps/workspace-cli/src/adapters/**`、`apps/workspace-cli/src/node-platform.ts`、对应测试与相关 package/lock/config | 在 core 定义 HTTP、凭据、受限文件、控制状态和时钟端口；实现 NFC/`/` 路径、通用跨平台拒绝、稳定扫描/manifest/差异、软限制、本地状态机、幂等同步/冲突编排、恢复日志与物化事务；Node/macOS 适配器使用受限 realpath/lstat、同目录临时文件/原子 rename/fsync、原子 registry/state 和不经 shell 的 `/usr/bin/security` | core 纯单元/故障注入/依赖扫描；APFS 临时根真实文件扫描、竞态、链接/路径/碰撞、删除/重命名、崩溃恢复与原子替换；一次性隔离 Keychain 的 put/get/delete/reopen；无秘密/越界/transient repo artifact | 同一输入产生同一 manifest；混合时刻扫描要求重试；任一物化失败保留原内容或可恢复副本且不推进基线；凭据与租约秘密不落普通文件；核心可由假端口独立运行 |
| `P-003-T-003` | 交付正式 CLI 并完成真实 macOS 双进程端到端主体 | `apps/workspace-cli/src/{cli,index,presentation,stdio-server}.ts`、新增命令/运行时模块与测试、`packages/test-fixtures/src/workspace-sync*`、`prototypes/workspace-sync/results/**`、必要的 README/配置示例、相关 package/lock/config | 保留 status/doctor/MCP 只读能力，新增 pair、auth status/logout、connect/materialize、workspace status、lease acquire/hold/renew/release/takeover、sync、conflict use-local/use-server 的人类/JSON 投影；路径只由 root registry + Workspace ID 解析，接管/冲突需要明确 choice/确认；短令牌只在内存，设备/租约秘密只经 Keychain；使用正式 API 完成首次物化、续租、同步和冲突恢复 | CLI parser/presentation/runtime/API 目标测试；真实 Web 配对与隔离 Keychain；隔离 PostgreSQL/ObjectStore 上两个身份/两个根/两个 CLI 进程重复 `SYNC-001`–`SYNC-009`；500 文件/100 MiB、2,000 文件与软限制证据；最终根 `pnpm check`、OpenAPI/兼容/范围/秘密检查 | P-003 全部 core/硬门禁通过；supplemental 达标或形成合规 finding；结果不含秘密/正文/个人路径；创建 P-003 result 并安全等待 P-004 |

依赖：T-002 的纯 core 可在 T-001 后按冻结公共契约实现，T-003 依赖 T-001 的设备认证接口和 T-002 的端口/编排均完成。每个任务只有在目标门禁通过并把实际文件、证据和偏差写入 state 后才能进入下一任务。

### 2.2 风险相关文件所有权

| 文件或目录 | 任务 | 用途与所有权边界 |
| --- | --- | --- |
| `packages/contracts/src/{identity,pairing,errors,index}.ts` | T-001 | 只做 additive 的 CLI pairing status、设备 access-token exchange/current revoke Schema 与稳定错误；不得暴露摘要、Keychain 标识或 CLI 文本 |
| `packages/database/src/identity-repository.ts` 及 Identity 集成测试 | T-001 | 在事务内锁定并验证 pairing/device credential，限制错误关联、签发短令牌、撤销当前设备并审计；不新增客户端本地状态 |
| `apps/api/src/modules/identity/**` 与 Identity API 测试 | T-001 | 正式 `/api/v1` 设备认证闭环；关联秘密/设备凭据只接受 body，不进入 URL、参数、普通日志或审计 |
| `packages/workspace-core/src/types.ts`、新增路径/manifest/diff/state/materialization/sync 模块及测试 | T-002 | UI/CLI 无关模型、纯算法、编排和端口；不得 import `apps/**`、数据库、React/DOM、`node:child_process` 或 CLI parser |
| `apps/workspace-cli/src/adapters/filesystem.ts`、`local-state.ts`、`macos-keychain.ts`、`http.ts` 及测试 | T-002 | Node/macOS 文件、控制状态、OS 凭据与正式 HTTP 适配；不处理 CLI 文本，不调用外部域名，不读取服务端数据库/ObjectStore |
| `apps/workspace-cli/src/cli.ts`、命令/运行时模块、`presentation.ts` 与测试 | T-003 | 参数、明确确认、进程生命周期、人类/JSON 呈现；只调用 core 和 adapter，不复制路径/租约/冲突规则 |
| `apps/workspace-cli/src/stdio-server.ts` 与 MCP 测试 | T-003 | 继续只注册 `workspace_status`、`workspace_doctor`；不得把新人工同步命令暴露为 Agent 业务工具 |
| `packages/test-fixtures/src/workspace-sync*`、`prototypes/workspace-sync/results/**` | T-003 | 扩展 `SYNC-008`/`SYNC-009` 与 macOS 客户端证据；只记录合成 ID、哈希、版本、状态、时间和错误码，不记录 secret/正文/个人绝对路径 |
| 受影响 `package.json`、`pnpm-lock.yaml`、非秘密配置示例 | 各自任务 | 优先使用 Node 24 `fs`/`fetch`/`crypto`/`child_process`，无依据不加外部运行时依赖；锁文件在最后一次依赖变化后生成 |

### 2.3 暴露接口、本地数据与秘密约束

- 设备认证 API 至少包含：关联秘密保护的 pairing status、device credential exchange、current-device revoke。访问令牌 TTL 保持 15 分钟；设备凭据只比较摘要，签发/撤销事务写稳定审计。错误关联达到固定上限后请求终止且不能再签发。
- `WorkspaceApiPort` 只表达 pairing/device auth、Workspace metadata/version/object、lease、commit 与 conflict；所有 HTTP 调用只面向用户明确配置的 HTTP(S) origin，运行时 Schema 校验响应，错误保留 code/request ID/current version/recovery。
- macOS Keychain 使用固定非敏感 service namespace 和规范 origin/account 定位设备凭据及活动租约秘密；调用 `/usr/bin/security` 使用 argv + stdin 或受控进程输入，不经 shell，错误输出先脱敏。测试使用 `/private/tmp` 中一次性独立 Keychain，结束时删除。
- NGAPD 根由用户显式配置并解析 realpath；根控制面保存原子 registry，Workspace 内 `.ngapd/` 保存非秘密 connection ID、Workspace ID、相对登记路径、基线版本、manifest 摘要、本地状态、lease ID/到期时间和恢复日志。任何 token、credential、密码或对象全文不得写入这些 JSON。
- 后续命令只接受 Workspace ID/登记别名，不接受任意文件目标；由 registry 解析相对目录并在每次访问前复核 realpath containment。首次 `connect` 是唯一登记入口，要求目标位于配置根、未被其他 Workspace 占用且通过名称/链接/保护路径检查。
- manifest 路径使用 UTF-8 NFC、`/`、相对路径和稳定排序；扫描拒绝根/子目录符号链接、穿越、保护路径、规范化重复、大小写折叠碰撞、Windows 保留名/非法结尾/非法字符及不能跨平台安全映射的名称。
- 扫描读取每个文件前后比较身份、大小和修改时间并计算 SHA-256；变化返回稳定 retry 状态，不生成混合 manifest。默认限制 2,000 项、50 MiB/文件、2 GiB/Workspace 可由非秘密配置收窄/调整，超限不上传、不改变服务端版本。
- 物化先完成对象下载/哈希校验和恢复计划，再以每个目标同目录临时文件执行原子 rename；删除/替换前保存恢复副本或 journal。全部受管内容完成并 fsync 后才原子更新本地基线；启动时必须先恢复未完成 journal。
- 本地副本状态至少区分 `unmaterialized`、`clean`、`dirty_with_lease`、`lease_or_base_invalid`、`conflict`、`materialization_failed`；连接状态与 lease 状态分离。人类和 JSON 输出投影同一结构化结果。
- 活动租约 token 只存 Keychain；非秘密 lease 摘要存控制状态。前台 hold/renew 流用注入时钟按 20 秒间隔续租并响应 signal 安全释放；所有提交前仍由服务端重新验证，客户端时钟不能延长租约。

### 2.4 执行顺序

1. T-001 开始前把 state 的运行/阶段/任务置为 `in_progress`，显式启用 Node 24；启动已知隔离 PostgreSQL cluster，只创建/使用 `ngapd_workspace_sync_p003`，确认新 ObjectStore、本地根、Keychain 路径不在仓库、用户 Workspace 或未知数据根。
2. T-001 先扩展 TypeBox/错误，再实现 repository transaction 和 API service/routes；用真实 PostgreSQL 证明 pairing pending/approve/deny/expire/attempt ceiling/单次消费、credential exchange、短令牌过期和 current revoke，目标门禁通过后冻结接口。
3. T-002 先固定 core 类型/端口和纯路径/manifest/差异规则，再实现本地状态机、同步/冲突编排和恢复 journal；最后接入 Node/APFS/Keychain/HTTP adapter。纯测试先用内存假端口，平台测试只用 P-003 临时根与一次性 Keychain。
4. T-003 先建立依赖注入的命令/运行时和统一结果投影，再接 pair/auth/connect/status/lease/sync/conflict；保留现有离线 status/doctor 和 MCP stdio，所有破坏性或冲突选择都要求明确 choice/确认并在 non-interactive 缺失时拒绝。
5. 在正式 API、真实 Web 和真实 macOS 上建立两个合成设备/两个已登记 Workspace 根，使用独立 CLI 进程执行 `SYNC-001`–`SYNC-009` 两轮，并加入崩溃/扫描竞态/物化故障/设备与 Owner 失效；任何秘密只存在内存、数据库摘要或测试 Keychain。
6. 完成性能/软限制、重启、兼容、静态范围和最后根门禁后写 `prototypes/workspace-sync/results/p003-macos-client.md` 与不可变 `phase-003-result.md`。任何 core/硬门禁失败都停在当前任务修复；不得开始 P-004 规划或 initial run 收尾。

## 3. 验证与完成条件

### 3.1 目标验证

1. 显式使用 Node `v24.18.0` / pnpm `11.9.0`；真实平台证据记录 macOS `26.5.2`、arm64、APFS、`/usr/bin/security` 和 PostgreSQL 17.10，不用 Node 22、模拟 Keychain 或其他平台结果替代。
2. 在 `ngapd_workspace_sync_p003` 上运行现有 migration 和 T-001 Identity/API 集成；证明设备凭据只换取短令牌、账号/设备/凭据撤销或过期稳定拒绝、关联尝试封顶、配对单次消费、当前设备撤销使续租/提交即时失效，且审计/日志/OpenAPI 不含秘密。
3. 对 workspace-core 与平台 adapter 运行最小充分单元/集成/故障测试，至少覆盖：
   - NFC、稳定排序/hash、大小写折叠、Windows 保留名/非法字符、保护路径、穿越、根/子目录符号链接和真实路径越界；
   - 文本/二进制、新增/修改/删除/重命名、空目录消失、扫描期间修改的 retry、500/2,000 文件、50 MiB/2 GiB 软限制；
   - 正常/缺失/错误对象、临时写/rename/fsync/删除/状态写各故障点，进程重建后的 journal 恢复，失败不推进本地基线；
   - Keychain put/get/delete/reopen 和错误脱敏；registry/state 原子写、路径占用与多进程一致性。
4. 对 CLI 人类与 `--json` 表面运行成功/等待/只读/冲突/恢复/usage/error 矩阵；确认密码和所有 secret 不可作为参数，JSON 与人类输出源自同一结果，现有 help/version/status/doctor/MCP stdio 的兼容语义保持。
5. 在真实 Web + API/PostgreSQL/ObjectStore + macOS Keychain/APFS 上至少连续两轮执行 `SYNC-001`–`SYNC-009`：
   - 两个 CLI 进程争用同一 Workspace，接管后旧进程续租/提交拒绝；
   - 正常扫描/上传/幂等提交/释放，租约到期与旧基线停止上传；
   - `use_local` 只增加一个服务端版本，`use_server` 保留冲突副本并原子物化，Owner/设备失效者不能选择本地；
   - 保护路径和跨平台碰撞在产生对象/本地写入前拒绝；应用、CLI、adapter 重建后权威/本地状态一致。
6. 在参考 macOS 设备测量 500 个文本为主、总计 100 MiB 的扫描/差异与正常小文件同步；验证 2,000 文件正确性和 50 MiB/2 GiB 软限制提示。记录 wall time、输入摘要和结论，不提交生成数据。
7. 在最后一次可能影响结果的位置执行 `DATABASE_TEST_URL=<P-003 隔离目标> pnpm check`；随后复核 OpenAPI、`/health/*`、system info、P-001 Web/Identity、P-002 服务端场景、CLI 只读诊断与两个 MCP 工具，并静态确认无本地 GUI、Agent 业务工具、网络监听、无认证 fixture、外部 API/AI/LLM、真实秘密、对象全文或仓库内临时数据。

### 3.2 Core 阻塞门禁

- `AC-002`、`AC-003`、`AC-006`–`AC-014`、`AC-016`、`AC-017` 全部通过；P-001/P-002 已冻结 core 在 P-003 变化后仍通过。
- 任一密码/设备/访问/租约/配对秘密泄露、任意未登记路径访问、符号链接逃逸、保护路径写入、两个可提交 writer、失效资格/设备/租约成功、静默冲突选择、混合 manifest、半物化被标记同步或既有服务端版本损坏均阻塞。
- Web/API/CLI/OpenAPI/MCP 公共兼容、构建/typecheck/lint/format/适用测试、PostgreSQL/ObjectStore 权威、审计脱敏、重启恢复和用户已有工作保护均是硬门禁。
- P-003 结束时不得存在活动测试服务/CLI hold 进程、未知数据库/ObjectStore/Keychain/本地根、半完成恢复 journal、未清理合成 secret 或仓库内生成 Workspace 数据。
- Windows 证据缺失不在 P-003 记 finding，也不阻塞 P-003 自身的 macOS 出口；它阻止 initial run 最终完成，state 必须保持 `awaiting_next_phase`。

### 3.3 Supplemental 与 finding

- `AC-018`：若 500 文件/100 MiB 扫描差异超过 5 秒或正常小文件同步超过 10 秒，只有独立证据证明算法正确、无超限/数据/恢复/权限影响且环境记录完整时，才可分配连续 `FND-I-*` 作为 report-only。
- `AC-019`：2,000 文件正确性、50 MiB/2 GiB 边界阻止新增超限同步且既有版本不损坏是硬门禁；仅提示措辞/非关键呈现差异可在不影响行为时 report-only。
- `AC-020`：人类/JSON 状态必须稳定表达配对等待、只读争用、租约倒计时、未同步、冲突和恢复建议。仅非关键排版或 supplemental 呈现偏差可在结构化语义完整且 core 不受影响时 report-only。
- 所有 finding 从 state 当前下一 ID `FND-I-001` 连续编号，记录证据、影响、置信度和可选后续；不得为 report-only finding 安排无依据的修复阶段或重复诊断。

### 3.4 阶段完成条件

- T-001、T-002、T-003 都在 execution state 中有任务前/后检查点、实际文件、数据库/ObjectStore/本地根/Keychain 状态、验证、finding 与偏差。
- P-003 core/硬门禁通过，验证结论为 `passed` 或只含合规 finding 的 `passed_with_findings`；`SYNC-001`–`SYNC-009`、Web 配对、OS 凭据、双进程和 macOS 原子文件证据可重复。
- 项目可构建；无未决材料问题、活动服务/进程、半应用 migration、未恢复 journal、真实 secret、未知外部状态或无法解释的用户工作重叠。
- 创建不可变 `phase-003-result.md` 后把运行置为 `awaiting_next_phase`；该 implementation invocation 不创建 P-004 计划、`change-0.md` 或 `effective-requirements.md`。

## 4. 风险、恢复与修订记录

### 4.1 风险与恢复

- 数据库/ObjectStore/本地根：任务前记录隔离数据库名、监听摘要和 P-003 临时根绝对路径，不输出密码。若目标不明、疑似生产、对象根与用户 Workspace 重叠或本地路径不在配置根，立即暂停；不得用递归删除处理未知目标。
- OS 凭据：测试 Keychain 使用随机一次性密码和 `/private/tmp/ngapd-workspace-sync-p003-*.keychain-db`，只由测试进程持有；调用不经 shell，结果和错误脱敏。若无法确认是一次性目标或清理会影响用户默认 Keychain/search list，则停止真实凭据测试。
- 本地物化：每次物化先原子写恢复 journal；只有全部对象验证、替换/删除和目录同步完成后推进基线。崩溃时下一次启动优先恢复 journal；未知中间状态保留副本并阻塞同步，不以覆盖或删除规避。
- 租约/设备秘密：长期设备凭据和活动 lease token 只放 Keychain，访问令牌只在进程内存；任何普通文件、CLI args/stdout/stderr、日志、审计、结果文档或 Git diff 出现秘密时立即阻塞并轮换合成材料。
- 多进程：registry/state 采用同目录临时文件、原子 rename 和进程间锁/版本检查；锁争用或 state CAS 失败返回重试，不同时写出两个本地权威摘要。服务端租约仍是唯一写入权威。
- 公共兼容与用户工作：P-001/P-002 API/Web、CLI status/doctor、MCP 退化时只修复受影响边界并重跑其目标检查和最终根门禁；不改写 requirements、contract、路线图或已完成 plan/result。

精确恢复入口：读取 `execution/initial/execution-state.md`、本计划与不可变 P-001/P-002 结果，核对 requirements/roadmap/phase 指纹和 Git 范围；显式启用 Node `v24.18.0`。若 state 指向 T-001，验证/启动已知 PostgreSQL cluster 并只使用 `ngapd_workspace_sync_p003`；若指向 T-002/T-003，再核对 state 记录的 ObjectStore、本地根、Keychain 和恢复 journal 均为明确的 P-003 隔离目标。从当前 `in_progress` 任务第一个未完成步骤继续，暂停或结束前写回实际服务/进程、凭据容器、文件 diff、验证、finding/偏差和下一步。

### 4.2 修订记录

| 修订 | 日期 | 变更 | 原因 | 影响 |
| --- | --- | --- | --- | --- |
| 1 | 2026-07-25 | 初始 P-003 expanded 即时计划 | P-002 出口仍成立；客户端认证续期、本地路径/秘密、原子物化、多进程与真实 macOS 外部状态需要风险相关的所有权、顺序、故障和恢复证据 | 建立 T-001/T-002/T-003、完整 `SYNC-001`–`SYNC-009` macOS 门禁与安全等待 P-004 的出口 |
