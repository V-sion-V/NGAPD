# Workspace Sync initial run：P-004 阶段计划

- 运行编号：`initial`
- 阶段：`P-004`
- 计划修订：`1`
- 父路线图修订：`1`
- 需求指纹：`sha256:ba747ca1506cc32b6bf27ef28bd4fa8e126bb8fa3f14ef2bd8454c19c3b65217`
- 项目基线：分支 `prototype`，提交 `aed6cbbcf4528d68ee536a580ba5f9a0ec0ce830`
- 创建日期：`2026-07-26`
- 细节级别：`expanded`
- 交付与验证策略：`relaxed`
- 验证结论：`pending`

## 1. 阶段目标、边界与关联需求

### 1.1 目标与安全出口

在不改写 P-001–P-003 不可变计划/结果的前提下，关闭 Workspace Sync 的 Windows 11 x64/NTFS core 缺口，完成最终跨阶段集成、全量追踪与 initial run 封存：

- 为正式 Workspace CLI 提供 Windows 用户级 OS 凭据保护端口和平台分派；长期设备材料与活动租约秘密不得进入参数、环境持久化、普通文件、输出、日志、审计或结果文档。
- 使受限文件、registry/state、进程间锁、扫描和恢复物化在 NTFS/Windows 语义下可执行；大小写、Unicode、保留名、非法字符、长路径、junction/符号链接、原子替换、文件占用和崩溃恢复不得产生越界访问、两个本地权威状态或错误同步基线。
- 在隔离 PostgreSQL 17、ObjectStore、NTFS 根、两个 Windows CLI 进程和两个隔离凭据命名空间上重复执行 `SYNC-001`–`SYNC-009`；配对、租约争用/接管、过期/旧 holder、双向显式冲突、Owner/工作周期/设备失效和重启恢复必须保持 P-003 已冻结协议。
- 只重跑会被 Windows 适配或 P-003 后三处测试可移植性改动影响的目标检查，并在最后一次可能失效的位置执行一次根门禁；`AC-018`–`AC-020` 的 P-003 证据若未被本阶段变化影响则复用，不重复制造性能或呈现检查。
- 所有 core、硬门禁、最终追踪和环境收尾通过后创建不可变 P-004 result，并由 `$implement-planned-feature` 在同一最终阶段生成 `change-0.md` 与 `effective-requirements.md`、把 initial state 封存为 `completed`。本规划 invocation 不实施或最终化。

### 1.2 已验证前置事实

- requirements、路线图、P-003 plan 和 P-003 result 指纹仍为 `ba747ca…5217`、`baaa0c…2af0`、`63bccab4…688f`、`e2305d19…b6f`；P-001/P-002/P-003 均为 `completed/passed`，无开放 `FND-I-*`、未决问题、半应用 migration 或活动恢复状态。
- Task UI 的 Windows Chrome 主体结果与 Agent Context 的 Windows/Node 主体结果均为 `pass`，对应 initial run 已生成 `change-0.md` 并封存为 `completed/passed`；路线图要求的两个外部原型前置已满足。
- 当前分支 `prototype` 的 HEAD 与 `origin/prototype` 均为 `aed6cbbcf4528d68ee536a580ba5f9a0ec0ce830`，工作树干净。P-003 提交 `bcae1aa` 后与 Workspace Sync 相关的漂移仅为三个测试文件的 Windows 临时目录、平台 guard 和 MCP signal/初始化可移植性修正；没有 Workspace Sync 产品实现、协议、数据或结果漂移。
- 当前主机为 Windows 11 x64，Windows NT `10.0.26200.0`；项目卷 `D:` 为 NTFS。仓库要求 Node `24.18.0` / pnpm `11.9.0`；默认 Node 是 `20.13.1`，但 `C:\tmp` 中已有可执行的精确 Node `24.18.0` x64 运行时，执行前必须显式使用它。
- Windows Runtime `Windows.Security.Credentials.PasswordVault` 类型可解析并实例化，足以作为用户级 OS 凭据保护技术基础；尚未对用户 vault 执行写入、读取或删除。真实验证只能使用 run-unique 合成 resource/account，并精确清理自身条目。
- 当前没有 PostgreSQL/`psql`/`pg_ctl` 或 Docker 可执行入口，也没有已监听的测试 PostgreSQL。T-001 可独立开始；T-002 在任何数据库或端到端写入前必须 provision 一个校验来源与摘要的隔离 PostgreSQL 17 Windows 运行时，只使用 task-owned 数据目录和数据库 `ngapd_workspace_sync_p004`。无法建立可核验隔离目标时暂停，不以 SQLite、mock 或外部未知数据库替代。

### 1.3 范围

- 最终关联：`FR-001`–`FR-038` / `AC-001`–`AC-020`；最终追踪复核覆盖全部需求。
- 当前实现与 Windows core 重点：`FR-003`–`FR-006`、`FR-011`–`FR-031`、`FR-033`、`FR-036`–`FR-038` / `AC-002`、`AC-003`、`AC-006`–`AC-017`。
- 持续硬门禁：P-001 的身份/授权/唯一 Workspace，P-002 的 migration/租约/版本/ObjectStore/幂等/审计，P-003 的协议、CLI 明确选择、秘密、本地恢复、macOS core 和公共兼容结论不得退化。
- supplemental：`AC-018`–`AC-020`。只有本阶段代码实际影响其证据有效性时才重跑对应检查；`AC-019` 的数据不损坏部分始终是硬门禁。
- 不在本阶段：改变需求或协议、增加本地 GUI/Agent 业务写工具、实现完整 Project/Task UI、引入外部对象服务、修改 P-001–P-003 结果、重做 Task UI/Agent Context、生产安装器/HA/备份/GC、外部 API/AI/LLM。

## 2. 任务与文件范围

### 2.1 任务

| 任务 | 结果 | 文件或范围 | 实现摘要 | 验证 | 完成条件 |
| --- | --- | --- | --- | --- | --- |
| `P-004-T-001` | 冻结 Windows OS 凭据、NTFS 文件/控制状态与正式 CLI 平台分派 | `apps/workspace-cli/src/adapters/{windows-password-vault,filesystem,local-state}.ts` 及 Windows/共享测试、`workspace-runtime.ts`、`node-platform.ts`、`index.ts`、必要的非秘密配置/测试脚本 | 新增基于当前用户 `PasswordVault` 的 `CredentialPort`，只用静态 PowerShell/WinRT bridge 和 stdin 传递合成/运行时值，不把 secret 放入 argv、环境或诊断；按 `process.platform` 选择 macOS/Windows 凭据端口并拒绝不支持平台；收敛 Windows 下目录 durability、replace/rename、文件占用、reparse point、realpath containment、锁与 CAS 差异，同时保持纯 core 和 macOS 接口不变 | 精确 Node 24 下 CLI build/typecheck；PasswordVault put/get/reopen/delete 与失败脱敏；真实 NTFS 扫描/碰撞/保留名/非法字符/长路径/junction/可用时的文件 symlink；registry/state 双 writer、原子替换各故障点和 journal 重启恢复；现有 core/CLI 目标回归 | 正式 CLI 可在 Windows 启动并只经 OS vault 取得长期材料；NTFS 上无越界、秘密普通落盘、错误基线或两个本地权威状态；所有测试条目与临时根可精确清理 |
| `P-004-T-002` | 完成真实 Windows 双进程主体、最终根门禁与工作流封存 | 新增或泛化 `apps/api/src/workspace-cli*.integration.test.ts`、`prototypes/workspace-sync/results/p004-windows-client.md`、必要的 Workspace Sync 测试/配置，以及本运行 state/result、`change-0.md`、`effective-requirements.md` | 在校验后的隔离 PostgreSQL 17、ObjectStore、两个 NTFS 根和两个 run-unique PasswordVault 命名空间启动正式 API/CLI；以真实 HTTP 和两个独立 CLI 进程连续两轮执行 `SYNC-001`–`SYNC-009`，覆盖配对批准、设备刷新/撤销、租约争用/接管/过期、旧 holder/base、双向显式冲突、Owner/周期失效、保护/碰撞路径、锁定文件、原子恢复与重启；最后复核完整追踪、finding、范围/秘密与不可变历史 | Windows 主体目标测试、受影响 workspace build/typecheck/test、一次最终 `DATABASE_TEST_URL=<P-004 隔离目标> pnpm check`、OpenAPI/health/Web/CLI/MCP/依赖/网络/秘密/临时产物检查；结果与 phase/workflow 工件交叉复核 | Windows 11 x64/NTFS 结果为 `pass`；全部 core/硬门禁和最终 traceability 通过，supplemental 通过或形成合规 `FND-I-*`；无活动服务、lease、vault 条目、journal 或未知数据；P-004 result、change-0、effective snapshot 与 completed state 一致 |

依赖：`P-004-T-002` 依赖 T-001 的 Windows 凭据、NTFS 文件/控制状态和平台分派已通过目标门禁，并依赖校验后的隔离 PostgreSQL 17 目标就绪。T-001/T-002 均不得修改已冻结的 requirements、contract、路线图或 P-001–P-003 plan/result。

### 2.2 风险相关文件所有权

| 文件或目录 | 任务 | 用途与所有权边界 |
| --- | --- | --- |
| `apps/workspace-cli/src/adapters/windows-password-vault.ts` 及测试 | T-001 | Windows 用户级 `CredentialPort`；resource/account 由固定 namespace、规范 origin 和非秘密 ID 派生；静态 bridge 只通过 stdin 接收值，输出结构化状态并对已知 secret 脱敏；不得枚举、覆盖或删除非本运行 vault 条目 |
| `apps/workspace-cli/src/adapters/{filesystem,local-state}.ts` 及集成测试 | T-001 | 处理 NTFS realpath/reparse point、大小写、原子 replace、文件锁、directory durability 能力差异和进程间 lock/CAS；保持 P-003 state/journal schema 与 core 端口不变 |
| `apps/workspace-cli/src/{workspace-runtime,node-platform,index}.ts` 及测试 | T-001 | 平台选择和正式 runtime 组合；macOS 继续使用 Keychain，Windows 使用 PasswordVault；不修改 CLI 参数、同步协议或 MCP 工具集合 |
| `packages/workspace-core/src/**` | T-001（仅缺陷暴露时） | 优先保持冻结的纯跨平台规则；只有真实 Windows 证据证明平台无关不变量缺口时才做最小纠正，并补充纯回归。不得下沉 Windows process/凭据/文件 API |
| `apps/api/src/workspace-cli*.integration.test.ts` | T-002 | 新增 Windows 主体或抽取共享场景；macOS P-003 测试语义保持，Windows 使用正式 CLI/HTTP、两根、两凭据命名空间和隔离数据库/ObjectStore |
| `prototypes/workspace-sync/results/p004-windows-client.md` | T-002 | 记录环境、合成场景、版本/摘要、Windows 文件系统与凭据结论、验证和清理；不得记录 secret、对象正文、个人目录或实际 vault resource/account |
| `docs/requirements/workspace-sync-prototype/execution/initial/**`、`change-0.md`、`effective-requirements.md` | T-002 收尾 | 保存任务检查点、不可变 P-004 结果和 schema 3.2 首次实现封存；只在全部 core/硬门禁通过后最终化 |
| `package.json`、受影响 workspace `package.json`、`pnpm-lock.yaml`、`.env.example` | 各自任务（仅需时） | 优先使用 Node 24 与系统 PowerShell/WinRT，不无依据增加 native 依赖；只增加非秘密 Windows 配置或 workspace link，不写真实凭据/路径 |

### 2.3 暴露接口、平台数据与秘密约束

- Windows credential adapter 实现既有 `CredentialPort`，不改变 `CredentialReference`、API 或本地 state schema。`PasswordVault` resource/account 必须是确定性非秘密 locator；密码字段只保存设备凭据或 lease token，调用、错误、测试输出与结果均不得回显。
- PowerShell 仅作为 Windows Runtime bridge：使用固定绝对系统可执行入口、`shell: false`、静态命令和有界 stdio；secret 只在子进程 stdin/内存与 vault 内短暂出现。子进程启动失败、输出非结构化、目标缺失或删除失败都映射稳定脱敏错误。
- 测试 vault namespace 使用不可碰撞的 run ID；只按执行前记录的精确 resource/account 写、读、重开和删除。不得调用全量删除、不得展示用户现有 vault 内容；清理未确认时阻塞阶段完成。
- NTFS 适配必须在每次访问复核配置根/Workspace realpath containment，并把 junction、目录链接和其他 reparse point 当作不可信边界；平台不能提供 `O_NOFOLLOW` 或目录 `fsync` 时，使用能力探测和 Windows 支持的文件句柄/rename 顺序保持“内容完成后才推进 state”，不得静默跳过恢复语义。
- registry、state、journal 与受管文件继续采用同目录临时项、受控 replace/rename、版本 CAS 和进程间 lock。Windows sharing violation/占用失败返回 retry 或 materialization failure，保留原内容/恢复副本且不推进基线。
- Windows 路径证据至少覆盖大小写折叠、Unicode NFC、尾点/尾空格、保留名、非法字符、长路径安全上限、根/子 junction、可用时的文件 symlink、根外目标和保护路径；在产生对象或本地写入前拒绝。
- T-002 隔离根固定在 task-owned `C:\tmp\ngapd-workspace-sync-p004-*` 范围，并在创建前验证实际卷为 NTFS、目标不存在或确属本运行。数据库/ObjectStore/Workspace/vault/日志必须彼此隔离且不位于仓库或用户默认 Workspace。
- P-001–P-003 的服务端协议、数据库 schema、ObjectStore 和审计是冻结依赖；Windows 只调用正式公共边界。若 Windows 暴露公共协议或平台无关 core 缺陷，在本阶段做最小纠正并完整复验，不改写历史结果。

### 2.4 执行顺序

1. T-001 开始前把 state 的运行、P-004 与任务置为 `in_progress`；验证分支/HEAD、requirements/roadmap/P-001–P-003 指纹、三个 P-003 后测试 diff、精确 Node 24/pnpm、Windows build/arch、NTFS 目标卷和 task-owned 临时根。记录 vault namespace，但不读取用户 vault 清单。
2. 先实现并独立验证 PasswordVault adapter，再接入 runtime/node-platform 分派；所有调用使用静态 bridge + stdin，并在每次失败路径检查 argv、stdout/stderr 和错误不含 secret。完成后删除精确测试条目并验证重新读取为缺失。
3. 在真实 NTFS 上验证文件、控制状态和恢复端口；只修正已观察到的 Windows 能力差异。完成路径/链接/锁/replace/journal 故障矩阵和两 writer 回归后写入 T-001 任务后检查点。
4. T-002 在任何数据库写入前获取并校验可信 PostgreSQL 17 Windows 运行时，解析 `C:\tmp` 下精确数据/日志/ObjectStore/Workspace 路径并确认非生产；只创建 `ngapd_workspace_sync_p004`，监听回环地址和任务专用端口。无法证明来源、摘要、目标或隔离时暂停。
5. 启动正式 API，使用两个 run-unique vault namespace 和两个独立 CLI 进程连续两轮完成 `SYNC-001`–`SYNC-009`；以受控服务端时钟和真实 NTFS 故障条件覆盖接管、过期、冲突、资格/设备失效、路径拒绝、文件占用与重启恢复。任何 core 异常停留在 T-002 修复并重跑受影响目标。
6. 在最后一次实现变化后执行第 3 节的唯一最终根门禁、兼容/范围/秘密/清理与追踪审查；只在全部阻塞项关闭后写 Windows result、不可变 P-004 result、change-0、effective snapshot 和 completed state。

## 3. 验证与完成条件

### 3.1 目标验证

1. V-001 环境与不可变基线：显式使用 Node `v24.18.0` / pnpm `11.9.0`，确认 Windows 11 x64/build、NTFS、clean `aed6cbb`、requirements/roadmap/P-001–P-003 和外部两个 `pass` 结果指纹；确认 P-003 后只有三个已知测试可移植性改动且已提交，无用户工作重叠。
2. V-002 Windows adapter：在 run-unique namespace 对 device/lease 两类 credential 执行 PasswordVault put/get/reopen/delete、缺失与错误脱敏；在两个 task-owned NTFS 根执行扫描、稳定 manifest、碰撞/保留名/非法字符/长路径、junction/符号链接、registry/state 双 writer、lock/CAS、原子 replace、文件占用和所有 journal 恢复故障点。普通文件和进程可观察面不得出现 secret。
3. V-003 正式 Windows 主体：在隔离 PostgreSQL 17/ObjectStore/API 上，用两个独立正式 CLI 进程、两个 NTFS Workspace 和两个 vault namespace 连续两轮执行 `SYNC-001`–`SYNC-009`；证明配对/令牌刷新与撤销、唯一写租约、接管后旧 holder、到期/旧 base、正常同步/幂等、`use_local`/`use_server`、Owner/work-cycle/设备失效、保护路径和进程/adapter 重建。
4. V-004 最终工程与兼容：对实际受影响 workspace 运行 build/typecheck/test；随后只执行一次带 P-004 隔离数据库的根 `pnpm check`。复核 OpenAPI、health/system、P-001 Web/Identity、P-002 API、CLI help/status/doctor、人类/JSON 状态和 MCP 仍仅两个只读工具；检查无本地 GUI、Agent 写工具、外部 API/AI/LLM、新生产监听或真实 secret。
5. V-005 结果、追踪与收尾：复核 `FR-001`–`FR-038` / `AC-001`–`AC-020` 全量矩阵、P-001–P-004 连续计划/结果、finding 和偏差；确认 PostgreSQL/API/CLI hold 已停止，测试 lease 已关闭，ObjectStore/NTFS 根/journal/tmp/精确 vault 条目已清理或以已知可恢复证据保留；`git diff --check` 与结果/工件交叉链接通过。

### 3.2 Core 阻塞门禁

- `AC-015` 的真实 Windows 11 x64/NTFS 同核心契约必须通过；`AC-002`、`AC-003`、`AC-006`–`AC-013`、`AC-016`、`AC-017` 在 Windows 变化后不得退化。
- 任一 vault secret 泄露/残留、非本运行 credential 影响、任意路径越界、junction/symlink 逃逸、两个可提交 writer、失效租约/资格/设备成功、静默冲突选择、混合 manifest、半物化被标记同步、已提交版本或对象损坏均阻塞。
- PostgreSQL 来源/摘要/目标不明、半应用 migration、未知数据库/ObjectStore/Workspace 根、无法解释的用户 diff、Windows 平台或精确 Node 不匹配、build/runtime/root gate 失败均阻塞。
- P-001–P-003 不可变结果、macOS 证据、公共 REST/CLI/MCP 兼容和 requirements/roadmap 指纹必须保持；若当前事实需要改变需求或公共兼容，暂停而不是自行改写。
- P-004 结束时不得有活动服务、测试数据库监听、CLI hold、未关闭 lease、vault 条目、恢复 journal、临时 Workspace/ObjectStore、真实 secret 或未知外部状态。

### 3.3 Supplemental 与 finding

- `AC-018` 的参考 macOS 性能证据已在 P-003 通过；只有 T-001/T-002 修改共享扫描/差异/同步语义并可能使其失效时才重跑对应目标，不为 Windows 阶段重复完整性能实验。
- `AC-019` 的 2,000 文件和 50 MiB/2 GiB 边界可复用纯 core/P-003 证据；Windows 路径/提示受影响部分需目标复核，已有服务端版本不损坏始终阻塞。
- `AC-020` 的统一人类/JSON 投影未发生变化时以目标回归和 P-003 证据复核；只有 Windows 呈现差异影响实际输出时才增加检查。
- 合规 report-only finding 从 `FND-I-001` 连续编号，只允许已独立证明不影响交付行为的 supplemental 低/中等级异常；安全、隐私、数据、兼容、build/runtime、unknown-impact、required gate 或 core 异常不可降级。

### 3.4 阶段与运行完成条件

- T-001/T-002 都在 execution state 中有任务前/后检查点、实际文件、环境、验证、偏差、finding 与精确恢复/清理状态。
- P-004 验证结论为 `passed` 或只含合规 finding 的 `passed_with_findings`；Windows 主体结果可追溯且不依赖模拟凭据、mock 数据库或非 NTFS 路径。
- 全部 core、硬门禁、最终追踪和用户工作保护关闭；supplemental 通过或完整汇总为 `FND-I-*`。
- 创建不可变 `phase-004-result.md` 后，完整重读 requirements、路线图、state、P-001–P-004 plan/result 和最终 diff；只有一致时才生成 `change-0.md`、`effective-requirements.md` 并把 state 更新为 `completed`。

## 4. 风险、恢复与修订记录

### 4.1 风险与恢复

- Windows vault：只操作 state 记录的 run-unique resource/account；任何删除前按精确 locator 复核，不枚举或批量清理用户凭据。测试中断时保留 locator 的哈希/非秘密摘要与下一步，恢复后先精确删除自身合成条目。
- NTFS/用户内容：只使用验证后的 `C:\tmp\ngapd-workspace-sync-p004-*` task-owned 根；删除或重建前解析绝对路径、卷类型、目标标识和是否位于仓库/用户 Workspace。未知路径、junction 目标或文件占用时暂停，不用递归删除掩盖状态。
- PostgreSQL/ObjectStore：运行时、data、log、数据库名、回环端口和对象根必须明确且隔离；迁移失败停止 API，不手工跳过 migration。数据库可见版本是对象引用权威；错误恢复不得删除未知对象或业务数据。
- 原子物化：任何 Windows sharing/reparse/rename/durability 异常都必须保留原内容或恢复副本和 journal，不推进基线；恢复后从 journal 的第一个未完成操作继续或回滚，不能以覆盖/清空 state 完成。
- 多进程/服务：每个任务记录 API/PostgreSQL/CLI PID、端口、lease 与精确根，只清理本运行创建的目标。两个本地进程的 registry/state 仍受 lock/CAS 保护，服务端租约是唯一写权威。
- 公共兼容与用户工作：只修复 Windows 暴露的最小边界并重跑受影响检查；不修改冻结历史。若出现用户新增 diff 或与本计划文件重叠，记录后暂停，不覆盖或归因给本运行。

精确恢复入口：读取 `execution/initial/execution-state.md`、本计划与 P-001–P-003 不可变结果，核对 requirements/roadmap/phase 指纹、当前 HEAD/status 和外部两个 `pass` 结果；显式启用 Node `v24.18.0`。若 state 指向 T-001，先复核 run-unique vault locator 与 NTFS task root；若指向 T-002，再复核校验后的 PostgreSQL runtime/data/database/port、ObjectStore、两个 Workspace 根、vault locator、活动 PID/lease 和 journal。只从当前 `in_progress` 任务的第一个未完成步骤继续，暂停或结束前把实际文件、外部状态、验证、finding/偏差和下一步写回 state。

### 4.2 修订记录

| 修订 | 日期 | 变更 | 原因 | 影响 |
| --- | --- | --- | --- | --- |
| 1 | 2026-07-26 | 初始 P-004 expanded 即时计划 | P-001–P-003、Task UI 与 Agent Context 主体均已完成；Windows x64/NTFS 与 PasswordVault 可执行入口已满足。当前正式 CLI 仍只有 macOS 凭据组合，Windows 文件/状态能力未形成主体证据，且最终阶段需处理真实外部数据库、vault、多进程与不可变封存风险 | 建立 T-001/T-002、Windows `AC-015` 与最终 `FR-001`–`FR-038` / `AC-001`–`AC-020` 集成门禁 |
