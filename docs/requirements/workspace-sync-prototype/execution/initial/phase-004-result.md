# Workspace Sync initial run：P-004 阶段结果

- 运行编号：`initial`
- 阶段：`P-004`
- 阶段计划：[`phase-004-plan.md`](phase-004-plan.md)
- 阶段计划修订：`1`
- 父路线图修订：`1`
- 完成日期：`2026-07-26`
- 状态：`completed`
- 交付与验证策略：`relaxed`
- 验证结论：`passed`
- 开始基线：分支 `prototype`，提交 `aed6cbbcf4528d68ee536a580ba5f9a0ec0ce830`
- 结束基线：同一未提交工作树；未提交、推送、重置、stash 或改写 P-001–P-003 不可变结果

## 1. 阶段目标与结果

P-004 已关闭 Workspace Sync initial run 的 Windows 11 x64/NTFS core 缺口，并在真实平台、正式 API/CLI、隔离 PostgreSQL 17、ObjectStore、两个 NTFS 根与两个 PasswordVault 命名空间上完成最终集成：

- T-001 新增当前用户 Windows PasswordVault credential adapter，通过固定 PowerShell/WinRT bridge、stdin JSON、有界输出、超时和稳定脱敏错误保护长期设备材料与活动租约秘密；正式 runtime 按平台选择 macOS Keychain 或 Windows PasswordVault。
- NTFS 文件和控制状态端口现在明确处理目录 durability 能力、非 NFC 物理名称、大小写折叠、保留名、长路径、junction/file symlink、共享占用、原子 replace、registry/state 双 writer、lock/CAS 和 reopen journal recovery。
- Windows 专用状态锁将独占创建的 sharing violation 视为短暂争用，消除锁释放与二次路径检查之间的 TOCTOU；真实 NTFS 三项集成测试连续 10 轮、共 30 项通过。
- T-002 将既有正式双进程场景泛化到 Windows；两轮 `SYNC-001`–`SYNC-009` 覆盖配对、刷新/撤销、租约争用/接管/到期/旧 holder、旧基线、双向显式冲突、Owner/work-cycle/设备失效、Windows 路径拒绝、锁定文件和解锁恢复。
- Windows 锁定文件时 `conflict use-server` 返回 `SCAN_RETRY`，服务端版本保持 3，本地旧 state/基线不推进；释放句柄后重试成功，无 journal/tmp 或半物化状态。
- 最终根 `pnpm check` 使用精确 Node 24 与隔离 PostgreSQL 17 获得原生退出码 0：format、lint、10 个 workspace build/typecheck、全部数据库、domain、ObjectStore、core、CLI、fixture、API 与 Web 测试通过。
- Windows 主体证据见 [`prototypes/workspace-sync/results/p004-windows-client.md`](../../../../../prototypes/workspace-sync/results/p004-windows-client.md)。

P-004 的全部 core、硬门禁和 supplemental 复核通过，无 `FND-I-*`；P-001–P-003 冻结协议、macOS 主体和外部 Task UI/Agent Context Windows 主体未退化。

## 2. 任务、需求与验收覆盖

| 任务 | 状态 | 需求与验收 | 完成结果 |
| --- | --- | --- | --- |
| `P-004-T-001` | completed | `FR-003`–`FR-006`、`FR-011`–`FR-031`、`FR-033`、`FR-036`–`FR-038` / `AC-002`、`AC-003`、`AC-006`–`AC-017` | PasswordVault、Windows runtime 分派、NTFS 文件/控制状态/原子恢复完成；真实 vault 2 项、NTFS 3 项、core 24 项、CLI 25 项及构建/类型/静态门禁通过 |
| `P-004-T-002` | completed | 最终 `FR-001`–`FR-038` / `AC-001`–`AC-020` | 两个正式 Windows CLI 进程连续两轮完整场景、锁定文件恢复、最终全仓根门禁、追踪、秘密/范围/数据/环境收尾和 initial finalization 前置交叉复核通过 |

阶段验收结论：

- `AC-015` 的真实 Windows 11 x64/NTFS 同核心套约通过；Windows 变化后 `AC-002`、`AC-003`、`AC-006`–`AC-013`、`AC-016`、`AC-017` 未退化。
- P-001/P-002 的身份、授权、唯一 Workspace、migration、租约、版本、ObjectStore、幂等与审计证据在最终根门禁继续通过。
- P-003 的纯 core、CLI 明确冲突、秘密、macOS 主体、公共兼容和恢复证据保持冻结且成立。
- `AC-018`–`AC-020` 的 P-003 supplemental 证据未被 Windows 变更失效；Windows 小同步两轮仍分别为 `1708.56 ms` 与 `1692.39 ms`，低于 10 秒。

## 3. 文件修改

| 文件或范围 | 修改模式 | 结果 |
| --- | --- | --- |
| `apps/workspace-cli/src/adapters/windows-password-vault.ts` 及集成测试 | add | 当前用户 PasswordVault `CredentialPort`、固定 WinRT bridge、put/get/reopen/delete、缺失和脱敏验证 |
| `apps/workspace-cli/src/adapters/filesystem.ts`、`filesystem.windows.integration.test.ts` | modify/add | Windows 目录 durability 能力探测、非 NFC 拒绝、真实 NTFS 路径/reparse/共享占用/恢复矩阵 |
| `apps/workspace-cli/src/adapters/local-state.ts` | modify | Windows lock sharing violation、registry/state 双 writer、CAS 与锁释放 TOCTOU 修正 |
| `apps/workspace-cli/src/{workspace-runtime,node-platform,index}.ts` 及 runtime 测试 | modify | 正式 Windows credential 平台分派、导出与回归；macOS/不支持平台语义保持 |
| `apps/api/src/workspace-cli.integration.test.ts` | modify | 平台化双进程主体、两轮 Windows PasswordVault/NTFS、非 NFC 与独占文件锁恢复 |
| `apps/api/src/workspace.integration.test.ts` | modify | 将硬编码 macOS `/private/tmp` 改为系统 temp 下的 task-owned 根并保护未初始化清理 |
| `prototypes/workspace-sync/results/p004-windows-client.md` | add | 保存不含秘密、正文或实例 ID 的 Windows 平台、场景、性能、完整性和收尾证据 |
| `docs/requirements/workspace-sync-prototype/execution/initial/{execution-state,phase-004-plan,phase-004-result}.md` | modify/add | 保存滚动计划、任务检查点、恢复记录与不可变 P-004 结果 |

未修改 `requirements.md`、`workflow-contract.md`、路线图、P-001–P-003 plans/results、数据库 schema、同步公共协议、CLI 参数、MCP 工具集、package manifest 或 lockfile；未新增生产/外部运行时依赖。

## 4. 测试与验证

| 检查 | 命令或过程 | 观察结果 | 结论 |
| --- | --- | --- | --- |
| Windows PasswordVault | 精确 Node 24，真实当前用户 vault 的两类合成 credential put/get/reopen/delete/缺失/脱敏 | 2/2；精确条目结束后重新读取为缺失 | pass |
| Windows NTFS | task-owned `C:\tmp`、真实 NTFS 文件/registry/state/journal 集成 | 3/3；长路径、非 NFC、碰撞、保留名、junction/symlink、双 writer、占用、恢复通过 | pass |
| NTFS 锁时序压力 | 同一 Windows filesystem 集成连续 10 轮 | 30/30，无 `EPERM` TOCTOU 复现 | pass |
| Windows 双进程主体 | 正式 API、两个正式 CLI 进程、两个 NTFS 根、两个 PasswordVault namespace、PostgreSQL/ObjectStore | 连续两轮 `SYNC-001`–`SYNC-009`；目标运行 `1872.17`/`1825.74 ms`，最终根运行 `1708.56`/`1692.39 ms` | pass |
| 锁定文件恢复 | PowerShell 仅作为真实独占 NTFS 句柄 helper | 锁定时 `SCAN_RETRY` 且服务端版本 3；释放后恢复，无错误基线 | pass |
| 最终根门禁 | `DATABASE_TEST_URL=<P-004> pnpm check`，精确 Node `24.18.0` / pnpm `11.9.0` | Prettier、ESLint、10 workspace build/typecheck；database 9、domain 25、ObjectStore 3、core 24、CLI 25、fixtures 37、API 12、Web 5 | pass |
| 数据库收尾 | migration、版本、审计、活动租约与重复 active 分组查询 | 3 个 migration；版本 16、最大 3；Workspace 审计 44；重复 active 分组 0；4 个测试活动租约标记 `test_cleanup` 后为 0 | pass |
| 兼容、范围与清理 | OpenAPI/health/Web/CLI/MCP、依赖/秘密/transient/`git diff --check`、路径/端口检查 | 两个只读 MCP 工具保持；无新依赖/secret/仓库内 P-004 产物；隔离根/vault/ObjectStore/数据库/日志清理，PostgreSQL 停止且端口释放 | pass |

## 5. 发现项与处置

| ID | 类别 | 严重程度 | 关联需求/验收 | 观察与证据 | 最终功能影响 | 处置 | 置信度 | 建议后续 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |

无 `FND-I-*`。验证结论为 `passed`。

## 6. 决策、计划偏差与恢复记录

- 没有新增产品决策、用户问题、需求/协议变更或阶段边界变化；P-004 按 revision 1 的 T-001/T-002 完成。
- EDB 官方 Windows archive 在当前网络重复中断，未使用任何不完整下载；改用面向测试的 Zonky PostgreSQL 17.10 Windows bundle，Maven Central 发布 SHA-512 与本地计算完全匹配。该变化只替换测试运行时取得方式，不改变产品、数据库或验收语义。
- 首个真实 NTFS 运行暴露目录 `fsync` 能力差异、非 NFC 物理名称与 sharing violation；均在 T-001 Windows adapter/core 所有权内最小修正并完整复验。
- 最终双进程根门禁暴露 `apps/api/src/workspace.integration.test.ts` 硬编码 macOS `/private/tmp`；修正为系统 temp 下 task-owned 根，不改变产品行为。
- 完整根门禁随后暴露状态锁 `open("wx")` 的 Windows sharing violation 与二次 `lstat` 之间 TOCTOU；改为专用锁路径直接归类争用，连续 10 轮 NTFS 压力和最终全仓重跑通过。
- 两次嵌套长时执行由工具生命周期以 `-1` 收尾：一次已输出 API 4/4、12/12 通过，另一次在 API 第一轮后截断。它们不作为门禁结论；最终通过原生长时命令通道从起点完整执行同一根命令并取得退出码 0。
- PostgreSQL 只监听回环专用端口并使用专用测试数据库；未接触生产、未知数据库、默认用户 Workspace 或非本运行凭据。

## 7. 阶段收尾

- 两个 Windows PasswordVault 命名空间的精确测试条目均已删除并验证缺失；未枚举或批量清理用户 vault。
- 两个 NTFS Workspace 根、ObjectStore、T-001 根、journal/tmp、测试活动租约、PostgreSQL data/runtime、下载归档和诊断日志均已精确清理。
- PostgreSQL `17.10` 已 fast stop，`127.0.0.1:55434` 无监听；无 API、CLI hold 或 lock helper 进程遗留。
- `git diff --check` 通过；工作树只含本 invocation 计划拥有的实现、测试和 schema-v3 工件，无无法解释的用户重叠。
- P-004 已完成且可作为不可变结果；initial run 只有在完整重读 requirements、roadmap、state、P-001–P-004 plans/results 和最终 diff，并生成 `change-0.md`、`effective-requirements.md` 后才能标记 `completed`。
