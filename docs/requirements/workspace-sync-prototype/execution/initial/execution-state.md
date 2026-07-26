# Workspace Sync initial run：执行状态

- 运行编号：`initial`
- 运行类型：`首次实现`
- 目标记录：`change-0.md`
- 运行状态：`completed`
- 交付与验证策略：`relaxed`
- 验证结论：`passed`
- 当前路线图修订：`1`
- 需求指纹：`sha256:ba747ca1506cc32b6bf27ef28bd4fa8e126bb8fa3f14ef2bd8454c19c3b65217`
- 路线图或变更计划指纹：`sha256:baaa0c76bb21392edee0826d2c11c33815804e1b5f3339ed9c16b8e73a452af0`
- 当前阶段：`none`
- 当前任务：`none`
- 项目基线：分支 `prototype`；初始规划/实施基线 `a75be46a624ecb3ef309cac019e597461ddfc6e9`；P-004 规划基线 `aed6cbbcf4528d68ee536a580ba5f9a0ec0ce830`
- 最后更新时间：`2026-07-26T23:37:35+08:00`

## 1. 运行目标或待生效变更

在真实身份与权限基础上交付用户级、项目级和任务级 Workspace 的独占租约、版本/manifest/ObjectStore、CLI/Web 配对、本地扫描/物化、显式冲突恢复，以及 macOS 与 Windows 实机证据；在全部 core 和硬门禁通过后生成 `change-0.md` 与当前有效需求快照。

规划与执行结论：schema `3.2` 需求完整，用户已明确选择 `relaxed`，38 个 `FR-*` 与 20 个分级 `AC-*` 均有路线图、阶段实现和最终验证证据，无未决产品问题。路线图因前向 migration/安全公共接口、本地原子写入和延后 Windows 外部 core 门禁采用四阶段 `expanded` 模式；P-001–P-004 与 initial finalization 均已完成。

## 2. 阶段状态

| 阶段 | 状态 | 计划修订 | 阶段计划指纹 | 目标 | 进入/退出条件 |
| --- | --- | --- | --- | --- | --- |
| P-001 | completed | 1 | `sha256:50340de364a25bb2b9983a38d17023e31bc9b850ecde2d8f63ece78ac478966f` | 建立身份、配对、三级作用域授权与唯一 Workspace 数据基础 | T-001/T-002 与阶段门禁通过；不可变结果见 [`phase-001-result.md`](phase-001-result.md) |
| P-002 | completed | 1 | `sha256:53abdace6074c915c99e5f184fd06f27e8c54e1768d5811b0d473ef5981c34d7` | 完成服务端租约、版本、ObjectStore、幂等与冲突协议 | T-001/T-002 与阶段门禁通过；不可变结果见 [`phase-002-result.md`](phase-002-result.md) |
| P-003 | completed | 1 | `sha256:63bccab4905c4d26dc12b32c7af0c2b985a30dbc87e137c0c13f52e6f23c688f` | 完成本地核心、CLI 与 macOS Apple Silicon 主体 | T-001/T-002/T-003 与 macOS 阶段门禁通过；不可变结果见 [`phase-003-result.md`](phase-003-result.md) |
| P-004 | completed | 1 | `sha256:0a8a2a5859cdf964f604c70504ea3f744296b6034ee1e80740f564eb83330497` | 完成 Windows 11 x64/NTFS 与最终集成验收 | T-001/T-002、Windows 主体与最终根门禁通过；不可变结果见 [`phase-004-result.md`](phase-004-result.md) |

P-001–P-004 均已完成并有不可变阶段结果。initial run 已完整重读 requirements、路线图、state、P-001–P-004 plans/results 与最终 diff，创建 [`change-0.md`](../../change-0.md) 和 [`effective-requirements.md`](../../effective-requirements.md) 后封存为 `completed/passed`；P-004 结果指纹为 `sha256:73b3bba6f6c2a7fac6bfab6bb939502b3aa65505b22f11fd3019727f473a76db`。

## 3. 当前检查点

- P-004 当前 rolling planning 检查点：完整复核 schema `3.2` contract、requirements、路线图 revision 1、当前 state、P-001–P-003 plans/results、P-004 映射的全部 `FR-*`/`AC-*`、当前源/测试、外部两个原型结果和 Git 漂移；requirements/roadmap/P-003 plan/P-003 result 指纹仍为 `ba747ca…5217`、`baaa0c…2af0`、`63bccab4…688f`、`e2305d19…b6f`，P-001–P-003 出口继续成立。
- P-004 外部前置已满足：Task UI Windows Chrome 主体和 Agent Context Windows/Node 主体结果均为 `pass`，两个工作流均已生成 `change-0.md` 并处于 `completed/passed`。当前主机为 Windows 11 x64，Windows NT `10.0.26200.0`；项目卷 `D:` 为 NTFS，`PasswordVault` WinRT 类型可实例化，精确 Node `24.18.0` x64 运行时位于 task-owned `C:\tmp`。
- P-004 Git/漂移事实：分支、HEAD 和 `origin/prototype` 为 `aed6cbbcf4528d68ee536a580ba5f9a0ec0ce830`，规划写入前工作树干净。P-003 提交 `bcae1aa` 后的 Workspace Sync 相关变化只涉及 `filesystem.integration.test.ts`、`mcp.integration.test.ts`、`workspace-runtime.test.ts` 的 Windows 临时目录、平台 guard 和 MCP signal/初始化可移植性；没有产品协议、数据、core、CLI runtime 或不可变结果漂移。
- P-004 项目依据：正式 runtime 的 `openCredentials` 与 node-platform 仍只组合 macOS Keychain；Windows 尚无 OS credential adapter。共享文件/控制状态实现仍需在 NTFS 上证明 reparse point、directory durability/rename、sharing violation、锁/CAS 和 journal 恢复语义，因此 P-004 包含一个 Windows 平台关闭任务和一个真实双进程/最终封存任务，继续使用路线图既定 `expanded`。
- P-004 环境前置：默认 Node 为 `v20.13.1`，不得用于证据；pnpm 为 `11.9.0`。当前没有 PostgreSQL/`pg_ctl`/`psql` 或 Docker 入口，T-002 在写入前必须 provision 校验来源/摘要的隔离 PostgreSQL 17 Windows 运行时并只使用 `ngapd_workspace_sync_p004`；无法建立可核验目标时暂停，不能使用 mock/SQLite/未知数据库代替。
- P-004 eligibility 结论：外部原型、真实 Windows x64/NTFS、OS credential 技术入口和首个独立任务均可执行；已创建 [`phase-004-plan.md`](phase-004-plan.md) revision 1，指纹 `sha256:0a8a2a5859cdf964f604c70504ea3f744296b6034ee1e80740f564eb83330497`，运行与 P-004 置为 `ready`，验证结论为 `pending`，下一任务为 `P-004-T-001`。
- P-004 T-001 任务前检查点：2026-07-26T22:06:51+08:00 完整重读 contract、requirements、路线图、当前 state、P-001–P-004 plans 与 P-001–P-003 results；requirements/roadmap/P-001/P-002/P-003/P-004 plan 与 P-003 result 指纹分别为 `ba747ca…5217`、`baaa0c…2af0`、`50340de…966f`、`53abdace…34d7`、`63bccab4…688f`、`0a8a2a58…0497`、`e2305d19…b6f`，冻结交接一致。
- P-004 T-001 Git/环境基线：分支 `prototype`，HEAD/origin `aed6cbbcf4528d68ee536a580ba5f9a0ec0ce830`；status 只有本次规划拥有的 state 修改与未跟踪 P-004 plan，无生产源码 diff 或用户重叠。显式运行时为 `C:\tmp\ngapd-agent-context-runtime\node-v24.18.0-win-x64\node.exe`（SHA-256 `9a4eb5f1…52de`）、`win32/x64`、pnpm `11.9.0`；Windows NT `10.0.26200.0`，`C:`/`D:` 均为 NTFS，PasswordVault 可实例化。
- P-004 T-001 外部与漂移复核：Task UI Windows 结果指纹 `a631bb94…61d0`、Agent Context Windows 结果指纹 `c1652154…fe39`，两者仍为 `pass` 且 initial run 已封存。`bcae1aa..HEAD` 的相关漂移仍只有三个已提交测试可移植性修正；T-001 源基线为 filesystem `bd016306…49cf`、local-state `415dfab4…780c`、runtime `d45464aa…2650`、node-platform `e007b636…a1ef`、index `ef3f99f5…e1d7`、macOS Keychain `eebea719…4610`。
- P-004 T-001 隔离目标：唯一 task root 为 `C:\tmp\ngapd-workspace-sync-p004-t001`，执行前确认不存在且所在卷为 NTFS；所有文件/控制状态/外部目标只能位于其子路径。PasswordVault namespace 固定为 `com.ngapd.workspace.p004.t001.aed6cbb`；测试只操作 resource `com.ngapd.workspace.p004.t001.aed6cbb.device`/`.lease` 与两个精确 account `device:700fca01278ce824360cfeb63fa23b089267548959b6a270cb7b6d70093cad45:current-device:-`、`lease:700fca01278ce824360cfeb63fa23b089267548959b6a270cb7b6d70093cad45:20000000-0000-4000-8000-000000000001:10000000-0000-4000-8000-000000000001`；不得枚举 vault 或操作其他 locator。
- P-004 T-001 影响范围与验证：只修改计划声明的 Windows PasswordVault adapter/测试、filesystem/local-state Windows 能力与测试、runtime/node-platform/index 平台分派；只有真实 NTFS 暴露平台无关缺陷时才最小修改 core。先完成 PasswordVault put/get/reopen/delete/缺失/脱敏，再完成 NTFS 路径/reparse/long-path/占用/registry/state lock-CAS/replace/journal 矩阵，最后执行 CLI 与 core 目标 build/typecheck/test、格式/lint/diff/秘密/临时项检查。
- P-004 T-001 精确完成条件：正式 CLI 在 Windows 使用当前用户 PasswordVault 且不把 secret 放入 argv/env/普通文件/输出；NTFS 任一路径、占用、原子写或恢复失败不越界、不产生两个本地权威状态、不推进错误基线；精确 vault 条目和 task root 均清理。达成后先写任务后检查点并把当前任务切到 `P-004-T-002`，不得在未完成 T-001 时 provision 数据库或开始双进程主体。
- P-004 T-001 基线目标验证：精确 Node 24 下 `@ngapd/workspace-cli` 为 3 文件/16 项通过、4 文件/10 项按既有平台 guard 跳过，build/typecheck 通过；该基线不构成 Windows adapter/NTFS core 证据。
- P-004 T-001 完成检查点：新增 `WindowsPasswordVaultCredentialAdapter`，以固定绝对 PowerShell/WinRT bridge、`shell: false`、静态命令、15 秒超时、64 KiB 有界输出和 stdin JSON 实现精确 put/get/delete/reopen；正式 runtime、node-platform 与 package export 按 win32 分派 PasswordVault，macOS Keychain 与不支持平台拒绝保持明确。
- P-004 T-001 NTFS 修正：Windows 目录 handle `fsync` 的 `EPERM` 被能力探测识别，但文件内容与 JSON 临时文件仍先独立 `fsync` 再 rename；NTFS 非 NFC 物理名称在扫描前明确拒绝，junction/file symlink、保留/保护/尾空格、大小写碰撞与长路径保持安全；Windows 锁文件已存在时的 `EPERM` 被识别为争用，独占占用映射 `STATE_BUSY`/`SCAN_RETRY`，旧 state/文件/基线和恢复 journal 不被错误推进。
- P-004 T-001 真实验证：Windows PasswordVault 2 项通过；真实 NTFS 3 项通过，覆盖稳定长路径 scan、非 NFC、junction、可用 file symlink、两 writer registry/lock、locked state、locked managed file、成功 retry 与 reopen journal recovery；正式 runtime 4 项通过。最终目标为 core 5 文件/24 项、CLI 6 文件/25 项通过，3 文件/7 项既有 macOS/APFS/performance guard 跳过；两个 workspace build/typecheck、目标 Prettier/ESLint 与 `git diff --check` 通过。
- P-004 T-001 外部收尾：精确 vault resource `com.ngapd.workspace.p004.t001.aed6cbb.device`/`.lease` 只读复核均 `Found=false`；`C:\tmp\ngapd-workspace-sync-p004-t001` 与全部 `C:\tmp\ngapd-workspace-sync-p004-t001-runtime-*` 不存在，无 lock helper、journal、tmp 或秘密残留。文件后指纹为 PasswordVault `8d9f8248…cf62`、vault test `75da4d0c…c1a3`、filesystem `eb99009c…9ef1`、NTFS test `892c6575…c663`、local-state `575bf490…5936`、runtime `94468885…ec6b`、runtime test `2f74612e…36c2`、node-platform `6f724f3c…d66d`、index `7951b403…3965`。
- P-004 T-001 偏差/finding：沙箱用户可实例化 PasswordVault 类型但不能打开用户 vault，真实凭据测试按计划在明确的宿主用户上下文执行；首轮 NTFS 证据暴露非 NFC 与 `EPERM` 锁语义，两项均作为当前 core 实现缺陷修正并完整重跑。无产品/范围偏差，无 `FND-I-*`。
- P-004 T-002 任务前检查点：T-001 core/硬门禁和清理已通过，当前 Git status 只含本运行 planning/state 与 T-001 计划文件，未出现用户重叠。当前仍无 PostgreSQL/`pg_ctl`/`psql`/Docker；T-002 第一个未完成步骤是从可信来源取得并核验 PostgreSQL 17 Windows x64 运行时，任何数据库/API/双进程写入均尚未开始。
- P-004 T-002 隔离目标：预留 PostgreSQL/runtime/data/log `C:\tmp\ngapd-workspace-sync-p004-{postgres-runtime,pgdata,postgres.log}`、数据库 `ngapd_workspace_sync_p004`、回环端口 `55434`、API 端口 `3004`、ObjectStore `C:\tmp\ngapd-workspace-sync-p004-server-objects`、两个根 `C:\tmp\ngapd-workspace-sync-p004-local-a`/`-local-b` 与 vault namespaces `com.ngapd.workspace.p004.t002.a`/`.b`；路径均确认不存在、端口均无监听。下载归档路径与 SHA-256 必须在来源确认后另行记录。
- P-004 T-002 影响范围/验证/完成条件：优先泛化现有 `apps/api/src/workspace-cli.integration.test.ts` 以在 Windows 正式 API/HTTP、两个 CLI 进程、两个 NTFS 根与两个 PasswordVault namespace 连续两轮执行 `SYNC-001`–`SYNC-009`，并补充 Windows 锁定文件/恢复条件；随后执行受影响目标和唯一最终 `DATABASE_TEST_URL=<P-004> pnpm check`、范围/秘密/清理/全量追踪。只有 Windows 主体、全部 core/硬门禁和 finalization 交叉复核通过，才创建 P-004 result、`change-0.md`、`effective-requirements.md` 并把 state 封存为 `completed`。
- P-004 T-002 运行时与主体检查点：EDB 官方 PostgreSQL 17.10-2 Windows archive 在当前网络重复提前断开，未使用任何不完整字节；改用 Zonky `embedded-postgres-binaries-windows-amd64:17.10.0` 测试 bundle，经 Maven Central 发布 SHA-512 `8c5a905a…473bcf8` 与本地计算完全匹配，本地 SHA-256 为 `f418c95d…a9721`。解包的 `postgres`/`initdb`/`pg_ctl` 均报告 17.10；只在 `127.0.0.1:55434` 启动 task-owned cluster 并创建 `ngapd_workspace_sync_p004`。Windows 主体目标测试两轮 `SYNC-001`–`SYNC-009` 通过，小同步 `1872.17 ms`/`1825.74 ms`，锁定文件返回 `SCAN_RETRY` 且版本保持 3，解锁后恢复；测试内精确 vault 删除复核与 NTFS/ObjectStore 根清理通过。
- P-004 T-002 最终根首次尝试：format、lint、10 个 workspace build/typecheck、database 9、domain 25、ObjectStore 3、workspace-core 24、Workspace CLI 25 和 fixture 37 项均通过；API Windows 主体两轮同样完成，但 `apps/api/src/workspace.integration.test.ts` 在 `beforeAll` 仍硬编码 `/private/tmp/ngapd-workspace-sync-p002-objects/api-*`，Windows 返回 `ENOENT`，`afterAll` 又对未赋值 `objectRoot` 调用 `rm`。这是 required API 门禁的测试可移植性缺陷，不是产品主体失败或 report-only finding；按 P-004 T-002 测试/配置范围修正为系统 temp 下的 task-owned 父目录并保护未初始化清理后，必须从根门禁起点完整重跑。
- P-004 T-002 根门禁环境复核：修正 API 临时路径后的一次重跑虽然由精确 Node 24 父进程启动，但未把该 runtime 目录置于 `PATH` 首位，Vite 子进程实际报告 Node `20.13.1`；在测试开始前主动停止，该次结果作为无效环境尝试而非产品失败。随后以精确 Node 24 父进程和 `PATH` 双重固定从头重跑，format、lint、全部 build/typecheck、database 9、domain 25、ObjectStore 3 与 workspace-core 24 项通过，但真实 NTFS registry/state 双 writer 测试偶发 `EPERM`：锁持有者恰在 `open("wx")` 返回 sharing violation 后、`lstat` 复核前释放文件，现有争用识别因 TOCTOU 将其误抛。该问题位于 T-001 已纳入的 Windows lock core 范围，必须最小修复、重复压力验证并从根门禁起点再跑；当前仍无 report-only finding。
- P-004 T-002 NTFS 锁时序修复检查点：`acquireFileLock` 现在把 Windows 独占创建返回的 `EACCES`/`EBUSY`/`EPERM` 直接归类为该专用锁路径上的短暂争用，不再以会与释放并发的二次 `lstat` 决定是否误抛；文件已消失时既有 stale-lock 分支安全重试。精确 Node 24 在真实 `C:\tmp`/NTFS 上连续 10 轮执行 3 项 Windows filesystem/registry/state 集成测试，共 30 项全部通过；下一步从根 `pnpm check` 起点完整重跑。
- P-004 T-002 最终完成检查点：原生长时命令通道以精确 Node `24.18.0`、pnpm `11.9.0` 与隔离 PostgreSQL 17 从根执行 `pnpm check` 并返回退出码 0；Prettier、ESLint、10 个 workspace build/typecheck、database 9、domain 25、ObjectStore 3、workspace-core 24、CLI 25、fixtures 37、API 12、Web 5 项通过，Windows 两轮小同步为 `1708.56 ms`/`1692.39 ms`。迁移 `0001`–`0003` 完整，版本表 16 行/最大 3、Workspace 审计 44、重复 active lease 分组 0；4 个测试活动租约标记 `test_cleanup` 后活动数 0。精确 vault 条目、NTFS 根、ObjectStore、journal/tmp、PostgreSQL runtime/data/download/log 均清理，cluster 已 fast stop 且 `55434` 无监听。
- P-004 阶段关闭检查点：`P-004-T-001`/`P-004-T-002` 与全部 core/硬门禁通过，无 `FND-I-*`；Windows 主体结果 [`p004-windows-client.md`](../../../../../prototypes/workspace-sync/results/p004-windows-client.md) 指纹 `sha256:dbc1da60dc6d0008e1c9e370a2208bc4e90b621453a411977ba70ba593bdccd3`，不可变 [`phase-004-result.md`](phase-004-result.md) 指纹 `sha256:73b3bba6f6c2a7fac6bfab6bb939502b3aa65505b22f11fd3019727f473a76db`。运行已进入 `finalizing`，当前任务清空；只有 finalization 交叉复核及两个封存工件一致时才可置为 `completed`。
- initial finalization 完成检查点：完整重读 `requirements.md`、路线图 revision 1、本 state、P-001–P-004 全部 plans/results 与最终产品/测试 diff；38 个 FR、20 个 AC、阶段指纹、finding/偏差、数据/环境收尾和用户工作边界一致。已创建 [`effective-requirements.md`](../../effective-requirements.md)，指纹 `sha256:ff8a94396002bc675c40bbfe68150ff10ff514b37d2666f89eee8a7da85d80e7`，以及 [`change-0.md`](../../change-0.md)，指纹 `sha256:b5f78710f106b1dd51b72018479565f1b239c1a2f978845838f26eb67efb2499`；两个文件通过 Prettier，运行封存为 `completed/passed`。
- P-004 历史等待检查点（2026-07-25）：当时已连续三次复核 P-001–P-003 出口，但 Task UI/Agent Context 尚无主体 `pass` 结果，主机为 macOS 且没有 Windows runner，故没有创建空壳计划并保持 `awaiting_next_phase`。该外部等待已于 2026-07-26 解除，不是 finding 或产品问题。
- 检查点：`P-003-T-003` 与 P-003 出口检查点均已完成；不可变阶段结果指纹为 `sha256:e2305d196461d4377c3e837e1846aa2beeb66091f9ac337582a94188818b6b6f`，macOS 主体证据指纹为 `sha256:460cf9c68d2529ffe35f80d5266aea8cd51783b703592425fef092ae3eb10b6f`。
- 当前执行权威：路线图修订 1、本 state、不可变 P-001–P-004 plans/results；P-003/P-004 计划指纹分别为 `sha256:63bccab4905c4d26dc12b32c7af0c2b985a30dbc87e137c0c13f52e6f23c688f`、`sha256:0a8a2a5859cdf964f604c70504ea3f744296b6034ee1e80740f564eb83330497`，P-003/P-004 结果指纹分别为 `sha256:e2305d196461d4377c3e837e1846aa2beeb66091f9ac337582a94188818b6b6f`、`sha256:73b3bba6f6c2a7fac6bfab6bb939502b3aa65505b22f11fd3019727f473a76db`。
- 已完成任务：`P-003-T-001`、`P-003-T-002`、`P-003-T-003`；认证闭环、本地同步 core、Node/macOS adapter、正式 CLI/runtime 与 macOS 双进程主体全部完成。
- 当前任务：`none`。P-004 与 initial finalization 已完成；不可变 phase results、`change-0.md` 和当前有效需求快照已形成冻结链。
- P-003 T-003 实际结果：保留 help/version/status/doctor 与两个只读 MCP 工具，新增 pair、auth status/logout、connect、workspace status、lease acquire/renew/hold/release/takeover、sync 和 conflict use-local/use-server；人类与 JSON 输出来自同一结构化结果。
- P-003 T-003 安全与恢复结果：只有 connect 接受根内相对路径，后续命令只由 Workspace ID/alias 与 root registry 定位；correlation/access 只在内存，device/lease secret 只经 Keychain；hold 每 20 秒续租并在 signal 尝试安全释放；接管与冲突方向均要求明确确认，失败不推进错误基线。
- P-003 T-003 场景结果：两个独立 CLI 进程、两个 APFS 根、两个一次性 Keychain 与正式 HTTP/PostgreSQL/ObjectStore 连续两轮通过 `SYNC-001`–`SYNC-009`，含 lease 争用/接管/旧 holder/到期/旧基线、双向冲突、Task work-cycle/Owner/设备失效、保护路径与恢复。
- P-003 T-003 Web 与性能结果：真实 Web 完成配对批准、设备有效与 CLI logout 后撤销；500 文件/100 MiB 扫描+diff `211.33 ms`，2,000 文件 `411.81 ms`，根门禁两轮小同步 `278.53 ms`/`260.62 ms`，50 MiB/2 GiB 边界通过。
- P-003 T-003 文件后指纹：CLI `cli c0afcc0d…7b2a`、`commands cbf04620…514`、`presentation 84e3b404…c7e1`、`runtime d45464aa…650`、`index ef3f99f5…e1d7`、Keychain `eebea719…4610`、local state `415dfab4…80c`；core `state 29c5787a…63fa`、`sync 53a09761…1aab`；fixture `workspace-sync 7cab32a4…163`；API CLI integration `64314867…edb`；lock `0374911e…3254`。
- P-003 T-003 验证结果：core 5 文件/24 项、CLI 6 文件/24 项、fixture 4 文件/6 项、API 最终 4 文件/12 项通过；最终根 `pnpm check` 的 format/lint、10 个 workspace build/typecheck 与 database 9、domain 25、ObjectStore 3、core 24、CLI 24、fixture 6、API 12 项全部通过；范围、秘密、兼容与 `git diff --check` 通过。
- P-003 T-003 整合修正：双实例场景证明接管租约 base 可领先本地旧 base；阶段内将 local-state invariant 收窄为 lease base 不得落后本地 base，冲突保留有效 lease，明确 `use_local` 使用接管 lease base，并以纯 core 与真实双进程回归关闭；公共协议和需求未改变。
- P-003 T-003 环境收尾：根门禁后的 4 个测试 active lease 已标记 `test_cleanup`，活动数为 0；版本表 16 行、最大版本 3、Workspace 审计 44 条；隔离 PostgreSQL 已停止，无监听、API/Web/CLI hold、APFS 根、ObjectStore、Keychain 或恢复 journal，只保留已知 PostgreSQL 日志与专用测试数据库。
- P-003 T-003 任务前验证：requirements/roadmap/phase 指纹仍为 `ba747ca…5217`、`baaa0c…2af0`、`63bccab4…688f`；分支 `prototype`、HEAD `a75be46a624ecb3ef309cac019e597461ddfc6e9`；Node `v24.18.0`、pnpm `11.9.0`；Git status 与累计 P-001/P-002/T-001/T-002 清单一致，无无法解释的用户重叠。
- P-003 T-003 文件基线：CLI `cli d303fb9c…318`、`presentation fc7bfcec…4000`、`stdio cc58bc90…c90`、`index 898c07f9…47f`、`bin b014117c…2c73`、`node-platform e007b636…a1ef`、Keychain `26831dc4…550d`、CLI test `a067f90d…46be`、MCP test `0a64c81e…2b2b`、package `aceb26a1…751`；fixture `workspace-sync 0ecd75a7…afc`、index `b7daa182…1181`、package `db79efde…2d76`；API package `76d0bb3e…6179`；lock `79d3e10e…3439`。
- P-003 T-003 影响范围：`apps/workspace-cli/src/{cli,index,presentation,bin,node-platform}.ts`、只为隔离 Keychain runtime reopening 所需的 additive adapter 入口、新增命令/runtime 模块与测试、`packages/test-fixtures/src/workspace-sync*`、必要的 API 客户端集成测试/package/config/lock、`prototypes/workspace-sync/results/p003-macos-client.md` 和本阶段 result/state；`stdio-server.ts` 只允许兼容复核，不增加写工具。
- P-003 T-003 预定验证：CLI parser/presentation/runtime 的人类/JSON 成功、等待、只读、冲突、恢复、usage/error 矩阵；参数/输出/普通状态秘密扫描；真实 Web + API/PostgreSQL/ObjectStore + 两个独立 CLI 进程、两个 APFS 根和两个隔离 Keychain 连续两轮 `SYNC-001`–`SYNC-009`；接管、旧 holder、到期/旧基线、双向冲突、Owner/设备失效、保护路径/碰撞、重启恢复；500 文件/100 MiB、2,000 文件、50 MiB/2 GiB 边界；最终 `DATABASE_TEST_URL=<P-003> pnpm check`、OpenAPI/health/system/P-001/P-002/CLI/MCP/范围检查。
- P-003 T-003 精确完成条件：后续命令只由 configured root registry + Workspace ID/alias 定位；pair 不接收账号密码且 correlation/access 只在内存，device/lease secret 只经 Keychain；hold 每 20 秒续租并在 signal 安全释放；接管和两种冲突选择在非交互缺确认时拒绝；两个进程不能同时合法提交；失败/冲突/恢复不推进错误基线或覆盖双方；P-003 core/硬门禁全部通过，supplemental 通过或形成合规 finding，创建不可变 P-003 result 后安全停在 `awaiting_next_phase`。
- P-003 T-003 环境基线：已知 PostgreSQL cluster `/private/tmp/ngapd-workspace-sync-p001-pgdata` 为 `no server running`，数据库目标固定为 `127.0.0.1:55432/ngapd_workspace_sync_p003`；ObjectStore `/private/tmp/ngapd-workspace-sync-p003-server-objects`、本地根 `/private/tmp/ngapd-workspace-sync-p003-local-a` 与 `-local-b`、Keychain `/private/tmp/ngapd-workspace-sync-p003-device-a.keychain-db` 与 `-device-b.keychain-db` 均不存在；当前唯一 P-003 临时项仍为已知 PostgreSQL log，无活动 API/Web/CLI hold 进程或恢复 journal。
- P-003 T-002 实际结果：新增 pairing/device auth 与 Workspace API、凭据、时钟、受限文件、registry/control 和物化端口；实现 NFC/`/` 路径策略、Windows 通用名称拒绝、稳定 manifest/hash/diff、500/2,000 文件及 50 MiB/2 GiB 软限制、本地状态机、显式 `sync`/`use_local`/`use_server` 编排和 state-last 恢复日志。
- P-003 T-002 文件与恢复结果：Node/APFS adapter 在每次访问复核 realpath containment，读取使用 `O_NOFOLLOW` 与 inode/device 复核，同目录临时文件、rename 和 fsync 完成原子替换；恢复目录链接替换、根/子链接、穿越、碰撞、保留名、竞态均稳定拒绝；删除、覆盖、冲突副本、状态写入和重建恢复故障不推进旧基线。
- P-003 T-002 凭据与 HTTP 结果：macOS Keychain 通过不经 shell 的 `/usr/bin/security -i` stdin 保存设备/lease 长期材料，隔离 Keychain put/get/delete/reopen 与失败脱敏通过；HTTP adapter 覆盖 pairing/status/consume/device-token/current-revoke 及全部 Workspace 路由，响应运行时 Schema 校验，access/correlation/device/lease 材料不进入 URL、普通状态或错误回显。
- P-003 T-002 文件后指纹：core `types 76525703…3f90`、`index cbe89289…0fff`、`errors 5cada58c…0d58`、`path 42cb1905…b4bd`、`manifest 57029b28…8d04`、`diff 96c7d3dd…6fd`、`state 6210fa48…1461`、`materialization d27a9985…9c7`、`sync 2f52b7ab…8919`；CLI `node-platform e007b636…a1ef`、`index 898c07f9…47f`、filesystem `bd016306…49cf`、local-state `4dcd888d…f9e1`、Keychain `26831dc4…550d`、HTTP `f000df62…80f`、package `aceb26a1…751`；lock `79d3e10e…3439`。
- P-003 T-002 验证结果：core build/typecheck、5 文件/23 项纯测试通过；CLI build/typecheck、5 文件/20 项完整测试通过，其中真实 APFS、隔离 Keychain 与 HTTP/runtime-schema 均通过；目标 Prettier/ESLint、依赖边界、秘密/链接/恢复/transient 和 `git diff --check` 通过。
- P-003 T-002 环境收尾：`/private/tmp/ngapd-workspace-sync-p003-local-t002`、动态测试 Keychain、恢复 journal 和临时文件均已删除，Keychain search list 未改变；已知 PostgreSQL 为 `no server running`，P-003 临时项仍只有既有 `/private/tmp/ngapd-workspace-sync-p003-postgres.log`。
- P-003 T-002 偏差：无产品、范围或验证偏差，无 finding；真实 Keychain、最终 pnpm 安装/依赖索引因 sandbox 权限在明确目标上获批执行，初次受限失败均由同一测试在宿主环境通过，不改变交付结论。
- P-003 T-002 任务前验证：requirements/roadmap/phase 指纹仍为 `ba747ca…5217`、`baaa0c…2af0`、`63bccab4…688f`；分支 `prototype`、HEAD `a75be46a624ecb3ef309cac019e597461ddfc6e9`；Git status 与累计清单及 T-001 文件一致，无无法解释的用户重叠。
- P-003 T-002 文件基线：workspace-core `types 511391a6…679`、`service 8bcdf138…c4f`、`index 9e074fa5…db36`、test `8d7de8eb…10c8`、package `207be7ba…9ec0`；CLI `node-platform ff271417…8f2`、`index 7e90c145…82d3`、package `90dcb48d…8842`；lock `7481f7be…1f0a`。
- P-003 T-002 影响范围：`packages/workspace-core/src/**` 与测试、`apps/workspace-cli/src/adapters/**`、`node-platform.ts`、adapter 测试及必要的 package/lock；只做结构化 core/端口和平台 adapter，不修改 CLI parser/presentation/stdio 注册。
- P-003 T-002 预定验证：Node 24/pnpm 11；core 纯路径/manifest/diff/state/sync/物化与故障注入；`/private/tmp/ngapd-workspace-sync-p003-local-t002` 的真实 APFS 扫描/链接/竞态/原子替换/崩溃恢复；动态 P-003 一次性 Keychain put/get/delete/reopen 与脱敏；HTTP runtime-schema/fake server；500/2,000 文件、50 MiB/2 GiB 边界；目标 build/typecheck/format/lint/依赖/秘密/transient 检查。
- P-003 T-002 精确完成条件：同一输入得到相同 NFC manifest/hash 与确定 diff；保护路径、碰撞、保留名、非法字符、穿越和任意链接在读写前拒绝；扫描竞态返回 retry；物化任一故障不推进基线且重建后可恢复；registry/state 原子 CAS 与路径占用可跨实例协调；长期设备/lease 材料只经 Keychain，HTTP/控制状态/错误不泄露秘密；core 可完全用假端口运行。
- P-003 T-002 环境基线：已知 PostgreSQL cluster 停止；精确 APFS 根 `/private/tmp/ngapd-workspace-sync-p003-local-t002` 不存在；当前唯一 P-003 临时项为已知 PostgreSQL 日志 `/private/tmp/ngapd-workspace-sync-p003-postgres.log`；尚无 T-002 Keychain、恢复 journal 或活动进程。
- P-003 T-001 任务前验证：requirements/roadmap/phase 指纹分别为 `ba747ca…5217`、`baaa0c…2af0`、`63bccab4…688f`；分支 `prototype`、HEAD `a75be46a624ecb3ef309cac019e597461ddfc6e9`；Git status 与累计清单一致，无无法解释的重叠。
- P-003 T-001 当前基线：contracts `identity ae6f0570…2a4`、`pairing 6333b16f…f48`、`errors 3e08b525…899`、`index 058fb9ca…24f`；Identity repository `fe977342…5a6`；API Identity `service 3b655e6f…184`、`routes ec7364d7…973`、integration test `8bf5475b…511`。
- P-003 T-001 实际结果：CLI pairing status 只接受正文中的 correlation secret；pending/approved/expired 与单次消费稳定；错误关联在第 5 次事务内锁定并对 CLI/Web 返回稳定上限错误；有效且未撤销的 device credential 可换取新的 15 分钟 access token。
- P-003 T-001 撤销与安全结果：Bearer current-device revoke 复用事务级联撤销设备、credential、全部 access token 和关联 pairing；撤销后的 credential exchange 与旧 token 均被拒绝，P-002 Workspace 写流继续共享同一 Bearer 解析边界；秘密只在请求/成功响应内短暂出现，审计只记录摘要外的身份与结果元数据。
- P-003 T-001 文件后指纹：contracts `identity dc2f43f2…52cc`、`pairing b49507b9…91b0`、`errors c30317cd…c6af`；Identity repository `043a33a1…8aa7`、database integration `cbc729e6…6a5d`；API Identity `service 36930848…4193`、`routes 7d317b03…8a36`、integration test `6bcfe5b1…f184`。
- P-003 T-001 验证结果：contracts/database/API build 与 typecheck 通过；真实 PostgreSQL database 2 文件/9 项、API 3 文件/11 项通过；OpenAPI、稳定错误/request ID、脱敏审计、秘密断言、受影响 Prettier/ESLint 和 `git diff --check` 通过。
- P-003 T-001 影响范围：Identity/Pairing contracts/errors、identity repository/API/service/routes 与真实 PostgreSQL 测试；只做 pairing status、错误尝试封顶、设备 credential exchange 和 current-device revoke 的 additive 闭环，不改写 Web session/P-002 Workspace 协议。
- P-003 T-001 偏差：无产品、范围或验证偏差，无 finding；测试连接因 sandbox 限制按已获批模式访问明确隔离的本机 PostgreSQL。
- P-003 T-001 执行前 Git 基线：分支 `prototype`、HEAD `a75be46a624ecb3ef309cac019e597461ddfc6e9`；status 与 P-001/P-002 result 及本运行累计清单一致，新增 P-003 计划/state 为本次规划所有，没有无法解释的生产文件重叠。
- P-003 交界文件基线指纹：workspace-core `types 511391a6…679`、`service 8bcdf138…c4f`；CLI `cli d303fb9c…318`、`stdio cc58bc90…c90`；contracts `identity ae6f0570…2a4`、`pairing 6333b16f…f48`；Identity `service 3b655e6f…184`、`routes ec7364d7…973`、repository `fe977342…5a6`。完整 SHA-256 已在规划命令输出观察。
- P-003 T-001 环境收尾：只创建/使用 `ngapd_workspace_sync_p003`；验证后已停止已知隔离 PostgreSQL，`pg_ctl status` 为 `no server running`；未创建 T-002/T-003 ObjectStore、本地根或 Keychain。
- 运行环境：显式 PATH 下 Node `v24.18.0`、pnpm `11.9.0`；macOS `26.5.2` arm64/APFS，`/usr/bin/security` 可执行；已知隔离 PostgreSQL `17.10` cluster 当前停止，位置 `/private/tmp/ngapd-workspace-sync-p001-pgdata`，此前仅监听 `127.0.0.1:55432` 并使用本机 trust 测试认证，不含生产数据。
- P-003 规划时事实：当时配对消费已签发 15 分钟 access token 和设备 credential，但缺少 CLI pairing status、credential exchange、current-device revoke 和尝试封顶；这些认证缺口现已由 T-001 关闭，workspace-core/CLI 仍为离线只读骨架并留给 T-002/T-003。
- P-003 隔离目标：计划使用数据库 `ngapd_workspace_sync_p003`、ObjectStore `/private/tmp/ngapd-workspace-sync-p003-server-objects`、本地根 `/private/tmp/ngapd-workspace-sync-p003-local-*` 与 `/private/tmp/ngapd-workspace-sync-p003-*.keychain-db`；执行时必须解析并复核精确目标后才可创建或清理。
- 以下 P-001/P-002 项为已冻结历史检查点，保留用于恢复与兼容对照。
- P-002 T-001 影响范围：`packages/contracts`、`packages/domain`、`packages/database`、新增服务端 ObjectStore 模块、`packages/test-fixtures` 及相关 package/lock/config；不修改 P-001 Web 行为、不增加 CLI/Agent 写能力。
- P-002 T-001 完成条件：同步契约与纯规则稳定；`0003-workspace-sync-protocol` 在全新/从 P-001 升级/重复 migrate 下通过；真实 PostgreSQL 证明行锁、唯一租约、CAS/幂等/回滚；隔离 ObjectStore 证明哈希校验、重复安全、错误不可引用与重启读取；目标 build/test 通过。
- P-002 T-001 执行前 Git 基线：分支 `prototype`、HEAD `a75be46a624ecb3ef309cac019e597461ddfc6e9`；status 与 P-001 result/本运行累计清单一致，除 P-002 计划/state 外没有无法解释的新增重叠。
- P-002 T-001 交界文件基线指纹：contracts `workspaces 672243f5…332a`、`errors cf0e5b81…5bb`、`index 058fb9ca…24f`；domain `workspace abb0e17c…7e9b`、`index ead81e9b…bf8`；database `migrations 5dae4b8a…f29c`、`types 3128fe3f…e68`、`index c0077279…314c`、`package 5729be70…2077`；fixtures `index 7f8f0389…c02`、`package db79efde…2d76`。完整 SHA-256 已在本任务前命令输出观察。
- P-002 T-001 首个实现动作：显式启用 Node `v24.18.0`；启动并验证已知隔离 PostgreSQL cluster，只创建/使用 `ngapd_workspace_sync_p002`，并确认 `/private/tmp/ngapd-workspace-sync-p002-objects` 不在仓库、用户 Workspace 或未知数据根。
- T-001 实际结果：新增身份、配对、Project/Task/Workspace TypeBox 契约与稳定错误；新增纯作用域授权、有效 Task Owner 和配对状态规则；追加 `0002-workspace-foundation` migration、Kysely 类型、foundation/identity repository 与确定性授权 fixture。
- T-001 数据结果：新装/从 `0001-system-metadata` 升级/重复 migrate no-op 均通过；用户/项目/任务与唯一 Workspace 同事务创建，重复并发和无 Owner 失败均回滚；配对只消费一次且设备撤销级联到凭据与短期令牌。
- T-001 偏差：无产品或范围偏差；数据库测试脚本收窄为 `vitest run src`，避免 build 后的 `dist` 测试副本被重复收集。
- P-001 T-002 任务基线：`apps/api` 与 `apps/web` 仍为提交 `a75be46a624ecb3ef309cac019e597461ddfc6e9` 的原始骨架且无用户重叠修改；T-001 公共契约与 repository 是当前依赖边界。
- P-001 T-002 影响范围：`apps/api`、`apps/web`、`.env.example`、`compose.yaml` 及相关 package/lock/config；不会注册 CLI 同步命令、Agent 业务工具或无认证 fixture 路由。
- P-001 T-002 完成条件：Argon2id、本地账号安全 session/同源、一次性配对与设备撤销、稳定错误/request ID/脱敏审计、最小内部 scope service 和 Web 人工流通过真实 PostgreSQL/API 负向矩阵、OpenAPI、Web 构建/组件、macOS 浏览器冒烟、根 `pnpm check` 与既有 API/CLI/MCP 兼容门禁。
- P-001 T-002 实际结果：使用 Node 24 内置 Argon2id 交付账号注册/登录/退出、安全 Cookie、同源防护、session、一次性配对、设备凭据/短期令牌摘要、设备撤销、稳定错误/request ID、脱敏审计和内部 scope provisioning service；Web 交付账号、配对决定和设备撤销人工流。
- P-001 T-002 浏览器修复：macOS in-app Browser 首次退出显示仍保留旧账号状态；根因是 React Query `setQueryData(undefined)` 未清除缓存。改用 `removeQueries` 后重新执行注册、退出、登录、配对批准/拒绝、消费后设备显示与撤销，全部通过且浏览器 console 无 error。
- P-001 T-002 偏差：无产品/范围偏差；浏览器发现的问题已作为 core 范围内实现缺陷修复并复验，没有保留 finding。
- 环境收尾：本地 API/Web 冒烟服务和隔离 PostgreSQL 已停止；隔离 cluster 仅保留在 `/private/tmp/ngapd-workspace-sync-p001-pgdata` 作为可识别测试证据，不在仓库内且无监听或活跃测试 session。
- P-002 T-001 实际结果：扩展 Workspace/lease/version/manifest/object/commit/conflict TypeBox 契约与稳定错误；新增纯 manifest 规范/哈希、lease/base 校验和幂等请求摘要；追加 `0003-workspace-sync-protocol` 与 transaction repository；新增独立 `@ngapd/object-store` 本地内容寻址适配器和确定性同步 fixture。
- P-002 T-001 数据结果：从 `0002` 保留 `system_metadata`/Workspace 升级并回填唯一空版本 0、重复 migrate no-op、迁移后新 Workspace 空版本通过；并发 acquire 只有一个成功，takeover 使旧租约失效；成功 commit 只产生版本 1，相同幂等重放不增版本，不同请求复用 key 和缺失对象不改变权威版本。
- P-002 T-001 ObjectStore 结果：SHA-256 正确内容按派生 storage key 原子落位、重复写安全、错误哈希无可见对象、重新构造 adapter 后可读；对象根为 `/private/tmp/ngapd-workspace-sync-p002-objects`，不在仓库/用户 Workspace，当前无业务对象。
- P-002 T-001 验证：contracts build；domain 5 文件/25 项；ObjectStore 1 文件/3 项；test-fixtures 4 文件/6 项；database 2 文件/8 项真实 PostgreSQL 测试；相关 build 与格式检查通过。
- P-002 T-001 偏差：无产品/范围偏差或 finding；PostgreSQL 启动/连接因 sandbox shared-memory/localhost 限制按既有模式使用获批本机隔离执行，目标始终为 `127.0.0.1:55432/ngapd_workspace_sync_p002`。
- P-002 T-002 影响范围：`apps/api/src/modules/workspaces/**`、Identity 设备访问令牌解析、`apps/api/src/{app,index}.ts`、API/fixture 集成测试、原型 results、相关 package/lock/config；不修改 Web、本地 Workspace 或 CLI/MCP 能力。
- P-002 T-002 完成条件：正式设备 Bearer 认证、metadata/manifest/object、lease acquire/renew/release/takeover、commit、`use_local`/`use_server` 路由通过真实授权与审计；`SYNC-001`–`SYNC-007` 可重复、并发/时钟/资格/故障/重启稳定；OpenAPI、错误、根门禁和既有接口兼容通过。
- P-002 T-002 交界文件基线指纹：API `app 81f703ca…7da`、`index 9cfa207c…bb7`、`package afc3f61c…1e0`、Identity service `509d8a7f…8b0`；database Identity repository `fbf8684a…e3a4`。这些是 P-001 已冻结实现，T-002 只做同步认证所需 additive 扩展。
- P-002 T-002 实际结果：新增短期设备 Bearer 解析和正式 Workspace metadata/version/object、lease acquire/renew/release/takeover、commit、`use_local`/`use_server` REST 服务；所有写流在 Workspace 锁内复核资格/lifecycle/work cycle/lease/base 并写脱敏审计。
- P-002 T-002 场景结果：两个隔离 Task Workspace 重复通过服务端 `SYNC-001`–`SYNC-007`；接管、到期、旧基线、错误/缺失对象、幂等冲突、Owner/周期/设备/lifecycle 失效与应用/ObjectStore adapter 重建均保持权威版本一致。
- P-002 T-002 验证：API 3 文件/9 项通过；最终根 `pnpm check` 完整通过，包括 database 8、domain 25、ObjectStore 3、workspace-core 3、CLI/MCP 10、fixtures 6、API 9 项；OpenAPI、静态范围/秘密/transient 和 `git diff --check` 通过。
- P-002 T-002 偏差：无产品/范围偏差或 finding；开发期两个 fixture 断言和根门禁两个未使用 import 均在当前任务内修复并完整复验。
- P-002 环境收尾：隔离 PostgreSQL 已停止且 `pg_ctl status` 为无 server running；`ngapd_workspace_sync_p002` 保留为已知测试证据；ObjectStore 根 `/private/tmp/ngapd-workspace-sync-p002-objects` 为空且模式 `0700`。
- 下一动作：完成 finalization 交叉复核，生成 `change-0.md` 与 `effective-requirements.md`，复核指纹/库存/证据一致后把 initial state 置为 `completed`；若任一项不一致则保持 `finalizing`。
- 规划前已有工作：`requirements.md` 与 `workflow-contract.md` 是用户已有未跟踪输入；本运行不声称拥有或改写它们。
- 初始规划新增文件：`implementation-plan.md`、本 state 与 `phase-001-plan.md`；P-001–P-003 生产实现与不可变结果已完整记录，先前滚动规划新增 `phase-002-plan.md`/`phase-003-plan.md`，本次滚动规划新增 `phase-004-plan.md`。
- 初始/P-003 历史环境事实：当时主机为 macOS `26.5.2` arm64/APFS；默认 shell Node 为 `v22.22.1`，仓库 Node `v24.18.0` 已安装；pnpm `11.9.0`；PostgreSQL `17.10` 与 `/usr/bin/security` 可执行，但没有 Docker/Windows 实机证据。当前 Windows 环境事实以上方 P-004 检查点为准。

## 4. 已完成任务

| 任务 | 状态 | 关联需求与验收 | 实际结果 | 验证 |
| --- | --- | --- | --- | --- |
| `P-001-T-001` | completed | `FR-001`–`FR-010`、`FR-033`–`FR-035` / `AC-004`、`AC-005`、P-001 范围的 `AC-012`、`AC-013`、`AC-017` | 契约、纯领域规则、首批 additive migration、事务 repository 与授权 fixture 已完成；未开放同步写流 | contracts/domain/database/test-fixtures 目标构建与单测通过；隔离 PostgreSQL 4 个集成测试通过；`git diff --check` 与秘密模式扫描通过 |
| `P-001-T-002` | completed | `FR-001`–`FR-010`、`FR-032`–`FR-035`、`FR-038` / `AC-001`、`AC-004`、`AC-005`、P-001 范围的 `AC-002`、`AC-003`、`AC-012`、`AC-013`、`AC-016`、`AC-017` | Identity/Pairing/Device API、内部 scope service 与 Web 人工流完成；无同步写路由、Agent 业务工具或无认证 fixture 路由 | API/PostgreSQL 7 项、浏览器完整人工流、Web build/typecheck、根 `pnpm check` 和既有 CLI/MCP 兼容全部通过 |
| `P-002-T-001` | completed | `FR-011`–`FR-025`、`FR-033`–`FR-036` / P-002 数据与纯规则范围的 `AC-006`–`AC-008`、`AC-011`–`AC-013`、`AC-017` | 同步 TypeBox 契约、纯 manifest/lease/CAS 规则、`0003-workspace-sync-protocol`、transaction repository、内容寻址 ObjectStore 与确定性 fixture 完成 | contracts/domain/ObjectStore/fixtures 目标 build/test 通过；database 2 文件/8 项真实 PostgreSQL migration/并发/幂等/半版本集成通过；格式与范围检查通过 |
| `P-002-T-002` | completed | `FR-011`–`FR-025`、`FR-033`–`FR-036`、`FR-038` / `AC-006`、P-002 服务端范围的 `AC-007`、`AC-008`、`AC-011`–`AC-013`、`AC-016`、`AC-017` | 设备 Bearer、Workspace/对象/租约/提交/冲突 REST 服务完成；两个隔离 Workspace 的服务端 `SYNC-001`–`SYNC-007` 与重启/故障/审计证据完成 | API 3 文件/9 项、最终根门禁和静态兼容/范围检查全部通过；不可变结果见 `phase-002-result.md` |
| `P-003-T-001` | completed | `FR-003`–`FR-006`、`FR-032`、`FR-034`、`FR-038` / P-003 认证范围的 `AC-001`、`AC-002`、`AC-004`、`AC-005`、`AC-013`、`AC-016`、`AC-017` | correlation-secret pairing status、5 次错误关联封顶、15 分钟 device credential exchange 与 Bearer current-device revoke 完成；Web session 与 P-002 Workspace 协议保持兼容 | contracts/database/API build/typecheck；database 2 文件/9 项与 API 3 文件/11 项真实 PostgreSQL 测试；OpenAPI/错误/审计/秘密/格式/lint/diff 全部通过 |
| `P-003-T-002` | completed | `FR-021`–`FR-031`、`FR-034`、`FR-036`–`FR-038` / P-003 本地 core 范围的 `AC-009`–`AC-017`，`AC-018`/`AC-019` 边界准备 | 平台无关路径/manifest/diff/state/sync/物化 core 与 Node/APFS、原子 registry/state、macOS Keychain、runtime-schema HTTP adapter 完成；未注册 T-003 CLI 命令 | core 5 文件/23 项，CLI 5 文件/20 项含真实 APFS/隔离 Keychain；build/typecheck/format/lint/依赖/秘密/transient/diff 门禁通过 |
| `P-003-T-003` | completed | `FR-003`–`FR-006`、`FR-011`–`FR-032`、`FR-036`–`FR-038` / `AC-002`、`AC-003`、`AC-006`–`AC-014`、`AC-016`–`AC-020` | 正式 CLI/runtime、统一投影、20 秒 hold/安全 release、显式接管/冲突、两进程两轮 `SYNC-001`–`SYNC-009`、Web 配对撤销和 macOS 性能主体完成 | core 24、CLI 24、fixture 6、API 12；真实 Web/APFS/Keychain/PostgreSQL/ObjectStore、显式性能、最终根门禁和范围/收尾全部通过；不可变结果见 `phase-003-result.md` |
| `P-004-T-001` | completed | `FR-003`–`FR-006`、`FR-026`–`FR-031`、`FR-036`–`FR-038` / Windows 范围的 `AC-002`、`AC-003`、`AC-009`、`AC-010`、`AC-013`、`AC-015`–`AC-017` | Windows PasswordVault、正式平台分派、NTFS 目录 durability、非 NFC/链接/长路径、锁/CAS、文件占用与 journal 恢复完成；macOS/core 公共边界保持 | PasswordVault 2、NTFS 3、runtime 4；core 24、CLI 25；build/typecheck/Prettier/ESLint/diff 和精确外部清理通过 |
| `P-004-T-002` | completed | 最终 `FR-001`–`FR-038` / `AC-001`–`AC-020` | 正式 Windows 双进程两轮完整场景、独占文件锁失败/恢复、最终根门禁、数据库/秘密/路径/进程/环境收尾完成 | Windows 目标主体通过；NTFS 锁压力 30/30；根门禁 database 9、domain 25、ObjectStore 3、core 24、CLI 25、fixtures 37、API 12、Web 5，退出码 0；不可变结果见 `phase-004-result.md` |

## 5. 运行累计文件变化

| 文件 | 修改模式 | 主要目的 |
| --- | --- | --- |
| `docs/requirements/workspace-sync-prototype/implementation-plan.md` | add | 建立四阶段 expanded 全局路线图、设计、依赖和完整追踪 |
| `docs/requirements/workspace-sync-prototype/execution/initial/phase-001-plan.md` | add | 建立当前唯一可执行 P-001 的 expanded 即时计划 |
| `docs/requirements/workspace-sync-prototype/execution/initial/execution-state.md` | add | 建立 initial run 当前协调、发现项连续性和恢复权威 |
| `docs/requirements/workspace-sync-prototype/execution/initial/phase-002-plan.md` | add | 建立当前唯一可执行 P-002 的 expanded 即时计划、服务端同步边界与恢复门禁 |
| `docs/requirements/workspace-sync-prototype/execution/initial/phase-003-plan.md` | add | 建立当前唯一可执行 P-003 的 expanded 即时计划、客户端认证/本地安全/macOS 双进程门禁与恢复边界 |
| `docs/requirements/workspace-sync-prototype/execution/initial/phase-004-plan.md` | add | 建立当前唯一可执行 P-004 的 expanded 即时计划、Windows PasswordVault/NTFS/双进程 core 与最终封存门禁 |
| `packages/contracts/src/{errors,identity,pairing,projects,tasks,workspaces,index}.ts` | add/modify | 身份、设备、配对状态/尝试封顶/credential exchange、作用域以及 P-002 Workspace/manifest/object/lease/commit/conflict 稳定 TypeBox 公共契约与错误 |
| `packages/domain/src/{authorization,pairing,task-owner,workspace,index}.ts` 及测试 | add/modify | 纯作用域授权、有效 Task Owner、配对状态、manifest 规范/哈希、租约/base/CAS 不变量与确定性单测 |
| `packages/database/src/{migrations,types,foundation-repository,identity-repository,workspace-repository,index}.ts` 及集成测试 | add/modify | `0002` 身份基础及 `0003` 租约/版本/manifest/对象/幂等前向 migration、配对尝试封顶、设备令牌签发/级联撤销、事务 repository 与真实 PostgreSQL 证据 |
| `packages/object-store/**` | add | 独立服务端 ObjectStore port、本地 SHA-256 内容寻址、临时文件原子落位、完整性复读与单测 |
| `packages/test-fixtures/src/{workspace-authorization,workspace-sync}*`、相关 package/index | add/modify | 真实授权对照和 P-002 确定性对象/manifest/`SYNC-001`–`SYNC-007` fixture |
| `packages/database/package.json`、`packages/test-fixtures/package.json`、`pnpm-lock.yaml` | modify | 目标测试脚本、workspace 内部依赖与锁文件同步 |
| `apps/api/src/modules/identity/**`、`identity.integration.test.ts`、`app.ts`、`index.ts`、相关测试/package | add/modify | Argon2id、session/同源、配对 status/消费、设备 credential exchange/current revoke 应用服务与路由、稳定错误、OpenAPI 和真实 PostgreSQL 负向矩阵 |
| `apps/api/src/modules/workspaces/**`、`workspace.integration.test.ts`、相关 app/index/package | add/modify | 设备 Bearer、Workspace metadata/version/object、租约、幂等提交、接管、冲突选择正式 API 与两次服务端场景 |
| `apps/web/src/App.tsx`、`styles.css` | modify | 注册/登录/退出、配对确认/拒绝、设备列表/撤销人工 Web 流和退出缓存修复 |
| `.env.example`、`compose.yaml` | modify | 增加非秘密 `WEB_ORIGIN` 注入，保持 TLS/gateway 部署边界 |
| `docs/requirements/workspace-sync-prototype/execution/initial/phase-001-result.md` | add | 冻结 P-001 任务、文件、验证、偏差与下一阶段进入条件 |
| `prototypes/workspace-sync/results/p002-server-protocol.md` | add | 保存不含秘密/正文的服务端 `SYNC-001`–`SYNC-007` 重复结果 |
| `docs/requirements/workspace-sync-prototype/execution/initial/phase-002-result.md` | add | 冻结 P-002 任务、文件、验证、偏差与下一阶段进入条件 |
| `packages/workspace-core/src/{types,index,errors,path-policy,manifest,diff,state-machine,materialization,sync}.ts` 及测试 | add/modify | 定义客户端端口、本地状态与错误；实现可移植路径、稳定扫描/manifest/diff、显式同步/冲突、state-last 物化与崩溃恢复 |
| `apps/workspace-cli/src/adapters/{filesystem,local-state,macos-keychain,http}.ts` 及测试 | add | 交付受限 APFS 文件、原子 registry/control、真实 macOS Keychain、正式 API/runtime-schema adapter 与平台集成证据 |
| `apps/workspace-cli/src/{node-platform,index}.ts`、`package.json`、`pnpm-lock.yaml` | modify | 暴露 Node/macOS adapter 组合，加入 contracts/TypeBox 直接依赖并同步 workspace lock |
| `apps/workspace-cli/src/{commands,workspace-runtime,cli,presentation,index}.ts` 及测试 | add/modify | 交付正式 Workspace 命令模型、依赖注入 runtime、统一人类/JSON 投影、确认门禁、hold 生命周期与客户端单元/真实平台证据 |
| `apps/workspace-cli/src/adapters/windows-password-vault.ts` 及集成测试 | add | 交付当前 Windows 用户 PasswordVault 凭据端口、固定有界 PowerShell/WinRT bridge、精确 locator 与 put/get/reopen/delete/脱敏证据 |
| `apps/workspace-cli/src/adapters/{filesystem,local-state}.ts`、Windows 集成测试 | modify/add | 关闭 NTFS 目录 durability、非 NFC/reparse/长路径、锁争用、独占占用、state CAS、原子替换与 journal recovery 差异 |
| `apps/workspace-cli/src/{workspace-runtime,node-platform,index}.ts` 及测试 | modify | 按平台选择 macOS Keychain/Windows PasswordVault，公开 Windows 组合入口并在真实 NTFS 跑正式 runtime |
| `apps/workspace-cli/src/performance.integration.test.ts` | add | 保存真实 APFS 的 500 文件/100 MiB、2,000 文件和 50 MiB 边界 supplemental 测试 |
| `apps/api/src/workspace-cli.integration.test.ts`、`workspace.integration.test.ts`、`apps/api/package.json` | add/modify | 交付两个独立 CLI 进程与正式 HTTP/PostgreSQL/ObjectStore 在 APFS/Keychain 和 NTFS/PasswordVault 的两轮完整场景；Windows 独占文件失败/恢复；系统 temp 可移植性；增加 workspace-only 测试依赖 |
| `packages/test-fixtures/src/workspace-sync*` | modify | 将确定性客户端场景扩展到 `SYNC-008`/`SYNC-009` |
| `prototypes/workspace-sync/results/p003-macos-client.md` | add | 保存不含秘密、正文或实例 ID 的 macOS 客户端、性能与场景证据 |
| `docs/requirements/workspace-sync-prototype/execution/initial/phase-003-result.md` | add | 冻结 P-003 任务、文件、验证、整合修正、收尾与下一阶段进入条件 |
| `prototypes/workspace-sync/results/p004-windows-client.md` | add | 保存不含秘密、正文或实例 ID 的 Windows PasswordVault/NTFS、双进程、性能、完整性与收尾证据 |
| `docs/requirements/workspace-sync-prototype/execution/initial/phase-004-result.md` | add | 冻结 P-004 Windows 关闭、双进程、最终根门禁、偏差、数据与环境收尾结果 |
| `docs/requirements/workspace-sync-prototype/effective-requirements.md` | add | 保存应用至 change-0 的 38 项 FR、20 项 AC、流程、边界、决策和来源链当前快照 |
| `docs/requirements/workspace-sync-prototype/change-0.md` | add | 封存首次实现的阶段、文件、验证、偏差、finding 和遗留事项汇总 |
| `.env.example`、`pnpm-lock.yaml` | modify | 增加非秘密 CLI origin/root 示例并同步 API→CLI workspace 测试 link；无新外部运行时依赖 |

`requirements.md` 与 `workflow-contract.md` 不计入本运行新增变化；它们是规划前已存在的用户输入。

## 6. 测试与验证证据

| 类型 | 命令或检查 | 观察结果 | 结论 |
| --- | --- | --- | --- |
| 合同审核 | 完整读取 `workflow-contract.md` | schema `3.2`；路径、比例化阶段、expanded 条件、relaxed finding 与 state/phase schema 可支持本运行 | pass |
| 需求审核 | 完整读取 `requirements.md` 并核对项目设计基线 | `relaxed` 为用户明确选择；`FR-001`–`FR-038`、`AC-001`–`AC-020`、安全/恢复/平台边界和决策完整，无未决问题 | pass |
| 需求指纹 | `shasum -a 256 requirements.md` | `ba747ca1506cc32b6bf27ef28bd4fa8e126bb8fa3f14ef2bd8454c19c3b65217` | pass |
| 项目实现依据 | 只读检查 contracts/domain/database/API/Web/workspace-core/CLI、测试、原型夹具和架构/权限/非功能文档 | 当前只有骨架；依赖方向、读取资格、migration、公共兼容、macOS/Windows 和根门禁事实一致 | pass |
| 基线 | `git branch --show-current`、`git rev-parse HEAD`、规划前 status | 分支 `prototype`，HEAD `a75be46a624ecb3ef309cac019e597461ddfc6e9`；规划前仅本功能 requirements/contract 未跟踪 | pass |
| 环境可执行性 | Node/pnpm/macOS/PostgreSQL 工具与 ready 探测 | 仓库 Node 24 与 pnpm 11 可用；PostgreSQL 17 可启动但当前未就绪，已在 P-001 前置/恢复中显式约束隔离目标 | pass with execution prerequisite |
| T-001 隔离数据库 | 初始化本地 PostgreSQL 17 cluster，创建 `ngapd_workspace_sync_p001` 并执行 `pg_isready` | `127.0.0.1:55432` 接受 `ngapd_p001` 的隔离测试连接；无生产数据或外部监听 | pass |
| T-001 契约构建 | `pnpm --filter @ngapd/contracts build` | TypeBox 契约编译通过 | pass |
| T-001 领域规则 | `pnpm --filter @ngapd/domain test`、`build` | 4 个文件、9 项测试通过；领域构建通过 | pass |
| T-001 fixture | `pnpm --filter @ngapd/test-fixtures test`、`build` | 3 个文件、5 项测试通过；fixture 构建通过 | pass |
| T-001 数据库 | `DATABASE_TEST_URL=<隔离目标> pnpm --filter @ngapd/database test`、`build` | 4 项 PostgreSQL 集成测试通过；migration 新装/升级/no-op、事务/并发/配对撤销证据通过；数据库构建通过 | pass |
| T-001 范围检查 | `git diff --check` 与私钥/带密码数据库 URL/Bearer 模式扫描 | 无 whitespace 错误或疑似真实秘密 | pass |
| T-002 API 自动化 | `DATABASE_TEST_URL=<隔离目标> pnpm --filter @ngapd/api test` | 2 个文件、7 项测试通过；覆盖 Argon2id、原子用户 Workspace、安全 Cookie/同源、session、配对负向/过期/单次消费、撤销、OpenAPI、request ID 与审计脱敏 | pass |
| T-002 Web | `pnpm --filter @ngapd/web build`、`typecheck` | Vite production build 与 TypeScript 通过 | pass |
| T-002 macOS 浏览器 | 真实 macOS in-app Browser + 本地隔离 API/PostgreSQL | 注册、退出、登录、配对摘要、批准、拒绝、消费后设备显示与撤销通过；首次暴露的退出缓存问题修复后复验；console error 为空 | pass |
| P-001 根门禁 | `DATABASE_TEST_URL=<隔离目标> pnpm check` | format、lint、9 个 workspace build/typecheck、database 4、domain 9、workspace-core 3、API 7、CLI/MCP 10、fixture 5 项测试全部通过 | pass |
| P-001 兼容与范围 | 根测试、静态工具注册/日志/秘密扫描、`git diff --check` | 健康/系统信息、Web、CLI status/doctor 与两个只读 MCP 工具保持；无 Agent 业务工具、外部 AI/API、普通日志秘密、真实配置或 transient repo artifact | pass |
| 路线图指纹 | `shasum -a 256 implementation-plan.md` | `baaa0c76bb21392edee0826d2c11c33815804e1b5f3339ed9c16b8e73a452af0` | pass |
| 阶段计划指纹 | `shasum -a 256 phase-001-plan.md` | `50340de364a25bb2b9983a38d17023e31bc9b850ecde2d8f63ece78ac478966f` | pass |
| 追踪审核 | 路线图需求追踪矩阵与阶段表 | 所有 38 个 FR 和 20 个 AC 均映射到阶段与可观察验证，P-004 负责最终集成结论 | pass |
| P-002 滚动规划前置 | 复核 requirements/roadmap/P-001 plan 指纹、完整 P-001 result、当前 state 和相关 Git diff | 指纹未变；P-001 `completed/passed` 出口仍成立；无多义漂移、未决问题、finding、半应用 migration 或活动测试服务；P-002 为唯一 eligible 阶段 | pass |
| P-002 项目依据 | 只读检查 contracts/domain/database/API、设备认证边界、ObjectStore 配置和 `SYNC-001`–`SYNC-007` fixture | P-001 边界可直接扩展；尚无同步表/ObjectStore/设备 Bearer/同步路由；服务端协议与 P-003 本地原子物化可独立验证 | pass |
| P-002 阶段计划指纹 | `shasum -a 256 phase-002-plan.md` | `53abdace6074c915c99e5f184fd06f27e8c54e1768d5811b0d473ef5981c34d7` | pass |
| P-002 追踪与活动阶段 | 复核阶段计划任务、core/supplemental 分层和 state 阶段表 | `FR-011`–`FR-025`、`FR-033`–`FR-036`、`FR-038` 映射到 T-001/T-002；仅 P-002 为 `ready`，P-003/P-004 仍未规划 | pass |
| P-002 T-001 环境 | 已知 cluster 启动、`pg_isready`、数据库清单、专用数据库创建和 ObjectStore 根真实路径/权限检查 | 仅 `127.0.0.1:55432/ngapd_workspace_sync_p002` 与 `/private/tmp/ngapd-workspace-sync-p002-objects`；无生产/未知数据，根目录模式 `0700` | pass |
| P-002 T-001 契约/领域 | contracts build；domain test/build | 公共同步 Schema 编译；domain 5 个文件、25 项通过，覆盖 manifest 确定性/拒绝、请求摘要和租约/base 失效 | pass |
| P-002 T-001 ObjectStore | `@ngapd/object-store` test/build | 1 个文件、3 项通过；正确哈希、重复写、错误哈希无可见对象、重建 adapter 读取与绝对根限制通过 | pass |
| P-002 T-001 fixture | test-fixtures test/build | 4 个文件、6 项通过；P-002 对象/manifest 与 `SYNC-001`–`SYNC-007` ID 确定 | pass |
| P-002 T-001 PostgreSQL | `DATABASE_TEST_URL=<P-002 隔离目标> pnpm --filter @ngapd/database test`；database build | 2 个文件、8 项通过；`0002` 升级/回填/no-op、新 Workspace、并发 lease/takeover/迟到拒绝、幂等/CAS、缺失对象无半版本通过 | pass |
| P-002 T-001 格式/范围 | 目标 Prettier check、`git diff --check`、transient 文件扫描 | 格式和 whitespace 通过；无仓库内 `.tmp/.log/.db/.sqlite` 对象或数据库产物 | pass |
| P-002 T-002 API/场景 | `DATABASE_TEST_URL=<P-002 隔离目标> pnpm --filter @ngapd/api test` | 3 个文件、9 项通过；两个隔离 Task Workspace 重复服务端 `SYNC-001`–`SYNC-007`，含 Bearer、对象、租约、版本、冲突、Owner/周期/设备/lifecycle、重启、OpenAPI 和审计 | pass |
| P-002 数据库收尾汇总 | 隔离 `psql` 只读查询 migration、活动租约分组、版本与 Workspace 审计 | `0001`/`0002`/`0003` 完整；重复 active `(workspace, work_cycle)` 分组 0；最大版本 3；Workspace 审计 44 条 | pass |
| P-002 根门禁 | `DATABASE_TEST_URL=<P-002 隔离目标> pnpm check` | Prettier、ESLint、10 个 workspace build/typecheck；database 8、domain 25、ObjectStore 3、workspace-core 3、CLI/MCP 10、fixtures 6、API 9 项全部通过 | pass |
| P-002 兼容/范围/秘密 | OpenAPI、工具注册、配置、外部调用、私钥/带密码 URL/Bearer literal、transient 与 `git diff --check` 扫描 | 健康/系统信息、P-001 Identity/Web、CLI status/doctor、两个只读 MCP 保持；无 Agent 写工具、无认证 fixture、本地 GUI、外部 API/AI/LLM、真实 secret 或仓库内对象/数据库产物 | pass |
| P-002 环境收尾 | `pg_ctl status`、ObjectStore 根 `find/stat` | PostgreSQL 无 server running；`/private/tmp/ngapd-workspace-sync-p002-objects` 为空且模式 `0700` | pass |
| P-003 滚动规划前置 | 复核 requirements/roadmap/P-001/P-002 plan 指纹、完整 P-001/P-002 result、当前 state 和 Git diff | 指纹未变；P-001/P-002 `completed/passed` 出口仍成立；无未决问题、finding、活动服务、半应用 migration 或无法解释的用户重叠；P-003 为唯一 eligible 阶段 | pass |
| P-003 项目依据 | 只读检查 contracts/Identity repository/API、Workspace REST、workspace-core/CLI、ADR-014 与 `SYNC-001`–`SYNC-009` fixture | 服务端同步协议可直接消费；客户端认证缺少 pairing status/credential exchange/current revoke/尝试封顶；本地 core/CLI 仍为只读骨架，均可在 P-003 additive 关闭 | pass |
| P-003 平台依据 | `uname -m`、`sw_vers`、`mount`、Node/pnpm/PostgreSQL/`security` 探测 | macOS `26.5.2` arm64/APFS；Node 24、pnpm 11、PostgreSQL 17.10 和真实 Keychain CLI 可用；cluster 停止，P-002 对象根为空；无 Windows/Docker | pass with execution prerequisites |
| P-003 阶段计划指纹 | `shasum -a 256 phase-003-plan.md` | `63bccab4905c4d26dc12b32c7af0c2b985a30dbc87e137c0c13f52e6f23c688f` | pass |
| P-003 追踪与活动阶段 | 复核阶段任务、core/supplemental、秘密/路径/恢复边界和 state 阶段表 | `FR-003`–`FR-006`、`FR-021`–`FR-032`、`FR-036`–`FR-038` 映射到 T-001/T-002/T-003；规划时仅 P-003 为 `ready`，P-004 仍未规划 | pass |
| P-003 计划格式 | `pnpm exec prettier --check phase-003-plan.md` | 计划文件符合仓库 Prettier 格式 | pass |
| P-003 T-001 隔离数据库 | 启动已知 PostgreSQL 17 cluster、确认并创建专用数据库 `ngapd_workspace_sync_p003` | 仅连接 `127.0.0.1:55432/ngapd_workspace_sync_p003`，用户 `ngapd_p001`；无生产数据或外部监听 | pass |
| P-003 T-001 构建与类型 | `pnpm --filter @ngapd/contracts --filter @ngapd/database --filter @ngapd/api run build`、`run typecheck` | 三个受影响 workspace 的 TypeScript 构建和 no-emit 类型检查全部通过 | pass |
| P-003 T-001 数据库 | `DATABASE_TEST_URL=<P-003 隔离目标> pnpm --filter @ngapd/database test` | 2 个文件、9 项通过；真实行锁下的错误关联计数/第 5 次锁定、正确 secret 锁后拒绝、设备 credential 换令牌与撤销传递失效通过 | pass |
| P-003 T-001 API/兼容 | `DATABASE_TEST_URL=<P-003 隔离目标> pnpm --filter @ngapd/api test` | 3 个文件、11 项通过；pending/status/approve/expire/并发单次消费、15 分钟过期与刷新、Web/current revoke、P-002 Workspace/API 回归、OpenAPI/request ID 通过 | pass |
| P-003 T-001 安全与静态门禁 | 集成测试审计秘密断言；目标 Prettier/ESLint；`git diff --check` | correlation secret、device credential 与 access token 未进入审计；请求秘密不在 URL；目标格式/lint 与 whitespace 全部通过 | pass |
| P-003 T-001 环境收尾 | `pg_ctl ... stop -m fast`、`pg_ctl ... status` | 隔离 PostgreSQL 已停止，状态为 `no server running`；专用数据库保留为已知测试证据 | pass |
| P-003 T-002 core | `pnpm --filter @ngapd/workspace-core test`、`build`、`typecheck` | 5 个文件、23 项通过；NFC/碰撞/保护与 Windows 名称、稳定扫描/diff/state、500/2,000 文件与 50 MiB/2 GiB、同步/显式冲突、对象完整性、各物化故障和重建恢复通过 | pass |
| P-003 T-002 APFS/控制状态 | `pnpm --filter @ngapd/workspace-cli test` 中真实 `/private/tmp` 集成 | 根/子/恢复链接、穿越、竞态、文本/二进制/空目录、删除/覆盖/冲突副本、原子 fsync/rollback/reopen journal、registry 占用与跨实例锁/CAS/权限通过 | pass |
| P-003 T-002 Keychain/HTTP | 同一 CLI 完整测试的隔离 Keychain 与 fake HTTP | Keychain put/get/delete/reopen、search list 恢复、删除后错误脱敏；pairing/device/Workspace API 运行时 Schema、object ack、远端错误和 access/correlation/device/lease 脱敏通过 | pass |
| P-003 T-002 构建与静态门禁 | core/CLI build+typecheck；目标 Prettier/ESLint；依赖列表/静态边界、秘密/transient、`git diff --check` | 两个 workspace 构建/类型通过；格式/lint/whitespace 通过；core 无外部生产依赖且未引用 app/database/object-store/domain/React/fs/child-process；CLI 仅声明 5 个预期生产依赖，无 shell 执行或普通文件秘密 | pass |
| P-003 T-002 环境收尾 | `find /private/tmp`、repo transient 扫描、Keychain 测试断言、`pg_ctl status` | APFS 根、一次性 Keychain、journal/tmp 全部不存在；search list 未改变；PostgreSQL `no server running`；只保留既有 P-003 PostgreSQL log | pass |
| P-003 T-003 CLI/runtime | `pnpm --filter @ngapd/workspace-cli test`、build/typecheck | 最终 6 文件/24 项通过，显式性能文件在普通根门禁中按设计跳过；parser/presentation/runtime、真实 APFS/Keychain、HTTP Schema 和 MCP 兼容通过 | pass |
| P-003 T-003 双进程 | `workspace-cli.integration.test.ts`；正式 HTTP、两个 CLI 进程、两个 APFS 根、两个隔离 Keychain | 两轮 `SYNC-001`–`SYNC-009`、争用/接管/到期/旧 holder、旧基线/双向冲突、Owner/work-cycle/设备失效、保护名、重启、秘密与审计通过 | pass |
| P-003 T-003 真实 Web | 隔离 API/Web + 应用内浏览器 + 等待中的正式 CLI | 注册、配对码、设备摘要、明确批准、CLI 消费、有效设备、CLI logout、Web 已撤销全部通过；服务与页面已关闭 | pass |
| P-003 supplemental 性能 | `RUN_WORKSPACE_PERF=1` 真实 APFS 测试与双进程 wall time | 500 文件/100 MiB `211.33 ms`；2,000 文件 `411.81 ms`；小同步 `278.53`/`260.62 ms`；50 MiB/2 GiB 边界通过 | pass |
| P-003 根门禁 | `DATABASE_TEST_URL=<P-003 隔离目标> pnpm check` | format/lint、10 workspace build/typecheck；database 9、domain 25、ObjectStore 3、core 24、CLI 24、fixture 6、API 12 项全部通过 | pass |
| P-003 公共兼容与范围 | OpenAPI/根测试、CLI help/status/doctor、MCP 注册、依赖/网络/秘密/transient/`git diff --check` | health/system、P-001 Web+Identity、P-002 API 保持；MCP 仍为 2 个只读工具；无本地 GUI、CLI listener、Agent 写工具、外部 API/AI/LLM、真实秘密或仓库内运行产物 | pass |
| P-003 数据与环境收尾 | 隔离数据库汇总与 active lease 清理；Keychain/根/ObjectStore/process/port/`pg_ctl` 检查 | 版本 16、最大版本 3、Workspace 审计 44；4 个测试 active lease 标记 `test_cleanup` 后活动数 0；cluster 停止，只保留已知日志 | pass |
| P-004 历史 rolling planning 前置 | 不可变指纹、外部原型 results/实现入口、主机/虚拟化/Windows runner 只读检查 | 2026-07-25 时 P-001–P-003 出口未漂移，但 Task UI/Agent Context 尚无主体 `pass` 结果且 macOS 主机无 Windows 入口 | historical not eligible；当时保持 `awaiting_next_phase`，现已解除 |
| P-004 当前 rolling planning 前置 | requirements/roadmap/P-001–P-003 指纹与结果、外部原型结果、Windows/NTFS/Node/PasswordVault、Git status/drift | P-001–P-003 `completed/passed` 且指纹不变；Task UI/Agent Context Windows 结果均为 `pass`；Windows 11 x64/NTFS、精确 Node 24 与 PasswordVault 技术入口可用；clean `aed6cbb`，仅三个已提交测试可移植性改动 | pass；P-004 唯一 eligible，已创建 revision 1 计划 |
| P-004 当前项目依据 | Workspace runtime/platform/file/control adapters、Windows test drift、PostgreSQL/Docker 工具探测 | 正式凭据组合仍仅支持 macOS；NTFS/reparse/rename/lock/recovery 需要真实门禁；当前无 PostgreSQL/Docker，隔离 PostgreSQL 17 provision 是 T-002 执行前置而非产品决策 | pass with execution prerequisite；T-001 可独立开始 |
| P-004 阶段计划 | `phase-004-plan.md` schema/任务/追踪/core-supplemental/恢复检查与 SHA-256 | revision 1、`expanded`、`relaxed`、验证 `pending`；T-001 Windows 平台关闭，T-002 双进程/最终封存；指纹 `0a8a2a58…0497` | pass；仅 P-004 为 `ready` |
| P-004 T-001 任务前门禁 | 完整输入/冻结结果、Git/漂移、外部结果、Windows/NTFS、精确 Node/pnpm、PasswordVault、隔离 root/locator 与 CLI 基线 | 全部指纹/前置匹配；HEAD/origin `aed6cbb`，无生产 diff/用户重叠；`win32/x64`、Node `24.18.0`、pnpm `11.9.0`、C:/D: NTFS；task root 不存在；vault namespace/account 已精确记录；CLI 16 项/build/typecheck 通过 | pass；run/P-004/T-001 置为 `in_progress` |
| P-004 T-001 PasswordVault | 真实用户 vault 的精确 device/lease put/get/reopen/delete/缺失、非法输入与可观察配置脱敏 | 2/2 通过；静态 bridge/args 无 secret；精确 resource/account 结束后均 `Found=false` | pass |
| P-004 T-001 NTFS | 真实 NTFS 稳定 scan/长路径/NFC/portable 名称/junction/file symlink、registry/lock/state CAS、独占占用、retry 与 reopen journal recovery | 3/3 通过；非 NFC 在对象/写入前拒绝；锁定 state/file 不推进旧 state/基线；恢复后无 journal/tmp/root | pass |
| P-004 T-001 runtime/core | core/CLI test、build/typecheck、目标 Prettier/ESLint、`git diff --check` | core 5 文件/24 项；CLI 6 文件/25 项通过、3 文件/7 项既有 macOS/APFS/performance guard；两个 workspace build/typecheck 与静态门禁通过 | pass；T-001 completed，进入 T-002 |
| P-004 T-002 任务前门禁 | T-001 后 Git/清理、PostgreSQL/Docker 入口、预留路径/端口 | T-001 清理完成、无用户重叠；无现成 PostgreSQL/Docker；六个预留路径不存在，55434/3004 无监听 | pass with execution prerequisite；先 provision 可信且有摘要的 PostgreSQL 17 |
| P-004 T-002 Windows 主体 | 正式 API、两个正式 CLI、两个 NTFS 根、两个 PasswordVault namespace、PostgreSQL/ObjectStore 两轮 `SYNC-001`–`SYNC-009` | 目标两轮 `1872.17`/`1825.74 ms`；最终根两轮 `1708.56`/`1692.39 ms`；独占文件锁定时 `SCAN_RETRY`/版本 3，解锁后恢复 | pass |
| P-004 NTFS 锁压力 | Windows filesystem/registry/state 集成连续 10 轮 | 30/30；无 sharing violation/释放 TOCTOU 误抛 | pass |
| P-004 最终根门禁 | 精确 Node 24/pnpm 11 与 `DATABASE_TEST_URL=<P-004>` 执行 `pnpm check` | Prettier、ESLint、10 workspace build/typecheck；database 9、domain 25、ObjectStore 3、core 24、CLI 25、fixtures 37、API 12、Web 5，原生退出码 0 | pass |
| P-004 数据与环境收尾 | migration/版本/审计/active lease 汇总；vault/根/ObjectStore/journal/tmp/runtime/process/port 检查 | migration `0001`–`0003`；版本 16/最大 3；Workspace 审计 44；重复 active 分组 0，4 个测试 active lease 清理后为 0；所有 P-004 外部目标删除，PostgreSQL 停止且 55434 无监听 | pass |
| P-004 不可变结果 | `phase-004-result.md` 与 Windows 主体证据格式、指纹、链接 | 阶段结果 `73b3bba6…a76db`，Windows 结果 `dbc1da60…dccd3`；无 `FND-I-*` | pass；运行进入 `finalizing` |
| initial finalization | 完整回读需求/路线图/state/全部 plan/result/最终 diff；effective/change 格式、指纹与链接复核 | 38 FR/20 AC、四阶段、全部偏差/finding/收尾一致；effective `ff8a9439…80e7`，change-0 `b5f78710…2499` | pass；运行 `completed` |

P-001–P-004 的全部任务与阶段门禁完成，验证结论均为 `passed`，不可变结果已创建。全量交叉复核、`change-0.md` 与 `effective-requirements.md` 已完成，initial run 状态为 `completed`、验证结论为 `passed`。

## 7. 决策、待确认问题与回答

| ID | 阶段/任务 | 问题 | 已确认事实 | 可选方案与影响 | 需要确认 | 状态 | 用户回答及来源 |
| --- | --- | --- | --- | --- | --- | --- | --- |

无未决问题。已生效用户决策以 requirements 的决策记录为准；路线图 TD-001 至 TD-006 仅记录由项目约束支持的可恢复技术选择。

## 8. 发现项、偏差、风险与阻塞

- 下一可用 finding ID：`FND-I-001`。
- 当前无 `FND-I-*`、计划偏差或阻塞。
- 已关闭的高风险：两批 migration、认证/设备秘密、租约/版本/ObjectStore 多 writer/跨介质一致性、本地路径/凭据/原子状态与物化恢复、正式 CLI、真实双进程 macOS/Windows 场景、supplemental 性能/呈现和 initial finalization 均已通过。
- 已解除的历史外部等待：2026-07-25 时 Task UI/Agent Context 尚无 `pass` 主体且没有 Windows 入口，因此按 requirements 保持 `awaiting_next_phase`，未写 `Q-*` 或 finding。2026-07-26 两个外部主体和 Windows x64/NTFS 入口均已满足；当前无 goal/workflow blocker。
- Core 阻塞集合：`AC-001`–`AC-017`，以及安全、隐私、数据完整性、公共兼容、构建、恢复、必需项目检查和用户已有工作保护。
- Supplemental 集合 `AC-018`–`AC-020` 已全部通过；`AC-019` 的数据不损坏硬门禁同时通过。
- 当前无活动 PostgreSQL/API/CLI hold、测试 lease、PasswordVault/Keychain 条目、Workspace/ObjectStore 根、journal/tmp、监听端口、半应用 migration、未知外部状态或用户工作重叠。

## 9. 精确恢复步骤

运行已完成，无活动恢复动作。后续若需求或产品行为变化，调用 `$apply-feature-change docs/requirements/workspace-sync-prototype/`，从 [`effective-requirements.md`](../../effective-requirements.md)、[`change-0.md`](../../change-0.md)、本 state 与不可变 P-001–P-004 plans/results 建立连续 change run；不得改写 initial 历史或把新变化追加到 `change-0.md`。

## 10. 最终完成门禁

- [x] P-001 至 P-004 均有完成且不可变的 phase result。
- [x] `FR-001`–`FR-038` 与 `AC-001`–`AC-020` 的最终证据完整。
- [x] 所有 core 和硬门禁通过；supplemental 已通过或作为合规 `FND-I-*` 完整汇总。
- [x] macOS Apple Silicon 与 Windows 11 x64/NTFS core 场景均有真实证据。
- [x] migration、对象引用、本地内容、秘密和既有用户工作没有未恢复风险。
- [x] 实际文件、测试、偏差、finding 和恢复记录与全部 phase result 一致。
- [x] `change-0.md` 与 `effective-requirements.md` 已创建并复核，运行已标记为 `completed`。
