# P-004 Windows Workspace 客户端结果

- 执行日期：`2026-07-26`
- 运行：`initial / P-004`
- 结论：`pass`
- 基线：分支 `prototype`，提交 `aed6cbbcf4528d68ee536a580ba5f9a0ec0ce830`
- 平台：Microsoft Windows NT `10.0.26200.0`、x64；项目卷与测试卷均为 NTFS
- 工具链：Node `24.18.0` x64、pnpm `11.9.0`
- 服务端：隔离 PostgreSQL `17.10`、回环 HTTP API 与 task-owned ObjectStore
- 客户端：两个独立正式 CLI 进程、两个独立 NTFS 根、两个隔离 PasswordVault 命名空间
- 重复次数：连续两轮 `SYNC-001`–`SYNC-009`

本结果只记录合成状态、版本、计数、摘要与 wall time；不记录密码、关联秘密、设备凭据、访问令牌、租约令牌、对象正文、合成账号、设备/Workspace 实例 ID 或实际 PasswordVault resource/account。

## 场景证据

| 场景 | 两个真实 CLI 进程的观察 | 权威/本地结果 |
| --- | --- | --- |
| `SYNC-001` 正常同步 | 设备 A 完成配对、连接、首次版本 0 物化、租约获取和文本/二进制文件同步；无变化重跑不提交 | 服务端从版本 0 推进到 1；本地 state/manifest 只含非秘密摘要 |
| `SYNC-002` 第二设备争用 | 设备 B 首次获取租约返回 `LEASE_CONFLICT`，显式确认接管成功；A 的旧租约写入返回 `LEASE_INVALID` | 接管不改变版本；任一时刻只有一个可提交 writer |
| `SYNC-003` 服务端到期 | 服务端时钟越过 TTL 后续租返回 `LEASE_EXPIRED`；本地租约凭据与摘要清理后可显式恢复 | 到期请求不改变服务端版本，客户端时钟不能延长租约 |
| `SYNC-004` 旧基线 | B 修改、删除、重命名并提交版本 2；A 显示本地 1/远端 2 和显式冲突 | 不自动上传或选边，版本 2 保持权威 |
| `SYNC-005` 显式选择本地 | A 显式接管当前基线并执行 `conflict use-local --confirm` | 只创建版本 3，本地基线与租约摘要同步推进 |
| `SYNC-006` 显式选择服务端 | B 保留本地编辑并显式执行 `conflict use-server --confirm` | 服务端保持版本 3，本地编辑成为 conflict copy，权威对象原子物化后才推进本地基线 |
| `SYNC-007` 资格与设备失效 | work cycle 变化、Owner 变化和设备撤销分别返回稳定拒绝；logout 删除当前设备和租约凭据 | 无越权写入，失效设备不能刷新或提交 |
| `SYNC-008` 路径保护 | Windows 保留名、非 NFC 物理名称、大小写折叠碰撞、尾点/尾空格、非法字符与受保护路径在对象写入前拒绝 | 返回稳定路径错误，服务端版本保持不变 |
| `SYNC-009` NTFS 占用、原子写与恢复 | `conflict use-server` 物化时以真实独占句柄锁定受管文件，返回 `SCAN_RETRY`；释放句柄后重试成功 | 锁定期间服务端版本保持 3，旧本地 state/基线不推进；恢复后无 journal/tmp/半物化内容 |

## Windows 平台适配证据

- 正式 runtime 按 `process.platform` 分派：Windows 使用当前用户 `Windows.Security.Credentials.PasswordVault`，macOS 继续使用 Keychain，不支持平台保持明确拒绝。
- PasswordVault bridge 使用固定绝对 PowerShell/WinRT 入口、`shell: false`、静态命令、stdin JSON、15 秒超时和 64 KiB 有界输出。secret 不进入 argv、环境持久化、普通文件、stdout/stderr 或错误文本。
- 两类合成凭据均完成 put/get、adapter reopen、delete、缺失和失败脱敏验证；测试结束只按精确 locator 删除自身条目，重新读取均为缺失。
- NTFS 测试覆盖稳定长路径扫描、非 NFC 名称、大小写折叠、Windows 保留名、junction、环境允许时的 file symlink、root containment、registry/state 双 writer、lock/CAS、原子 replace、共享占用和 reopen journal recovery。
- Windows 不支持目录句柄 `fsync` 时采用能力探测；临时 JSON/内容文件仍独立 `fsync` 后再 rename。任何失败都不把部分内容标记为已同步。
- Windows 独占创建返回的 sharing violation 在专用状态锁路径上视为短暂争用，避免锁释放与二次 `lstat` 之间的 TOCTOU 误判；真实 NTFS 集成测试连续 10 轮、共 30 项均通过。

## 运行时与服务端完整性

- EDB PostgreSQL `17.10-2` Windows archive 在当前网络反复中断，未使用任何不完整字节。
- 改用 Zonky `embedded-postgres-binaries-windows-amd64:17.10.0` 测试 bundle；Maven Central 发布 SHA-512 与本地计算完全匹配：`8c5a905a35b41f97f4a675bc50a983abac094a49b57262d35e7e38f56ad482eb60fc4dbc3412f1906d3a810dd67782ad391be443757e60397835fc41f473bcf8`，本地 SHA-256 为 `f418c95daa6473f05d5129803fdb674d49fb472ee5c94039d408c941f50a9721`。
- 解包后的 `postgres`、`initdb`、`pg_ctl` 均报告 `17.10`；测试实例只监听 `127.0.0.1:55434`，使用专用数据库 `ngapd_workspace_sync_p004`，未连接生产或未知数据库。
- 最终数据库包含 migration `0001-system-metadata`、`0002-workspace-foundation`、`0003-workspace-sync-protocol`；`workspace_versions` 16 行，最大版本 3；Workspace 审计 44 条；活动租约重复分组为 0。
- 收尾前 4 个测试活动租约统一标记 `test_cleanup`，活动租约降为 0；随后 PostgreSQL 正常 fast stop，端口 `55434` 无监听。

## 最终工程门禁

| 检查 | 观察 | 结论 |
| --- | --- | --- |
| Windows 主体目标测试 | 两轮小同步 `1708.56 ms` / `1692.39 ms`，均低于 10 秒；锁定文件返回 `SCAN_RETRY`，解锁后恢复 | pass |
| PasswordVault/NTFS 目标回归 | PasswordVault 2 项、NTFS 3 项；NTFS 锁竞争另连续 10 轮 30/30 | pass |
| 根 `pnpm check` | Prettier、ESLint、10 个 workspace build/typecheck；database 9、domain 25、ObjectStore 3、workspace-core 24、CLI 25、fixtures 37、API 12、Web 5 项 | pass |
| 公共兼容与范围 | OpenAPI、health/system、P-001 Web/Identity、P-002 API、CLI help/status/doctor、人类/JSON 投影和两个只读 MCP 工具保持 | pass |
| 秘密与临时产物 | 无 secret、对象正文或真实实例 ID进入结果/普通文件；两个 NTFS 根、ObjectStore、vault 条目、journal/tmp、测试数据库运行时与日志均精确清理 | pass |

最终未新增外部生产依赖、监听器、本地 GUI、Agent 写工具、外部 API/AI/LLM 或仓库内测试数据产物。仓库中既有 Task UI Windows 证据日志不属于 Workspace Sync P-004，也未被修改或清理。
