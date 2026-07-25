# P-003 macOS Workspace 客户端结果

- 执行日期：`2026-07-25`
- 运行：`initial / P-003`
- 平台：macOS `26.5.2`、Apple Silicon arm64、APFS
- 工具链：Node `24.18.0`、pnpm `11.9.0`
- 服务端：隔离 PostgreSQL `17.10` 与仓库外临时 ObjectStore
- 客户端：两个独立 CLI 进程、两个已登记 APFS 根、两个一次性隔离 macOS Keychain
- 重复次数：2 个相互隔离的用户 Workspace；Task Owner/work-cycle 失效路径同样重复
- 结论：客户端/服务端 `SYNC-001`–`SYNC-009` 与 P-003 supplemental 全部通过

本结果只记录合成状态、版本、计数、摘要和 wall time；不记录密码、关联秘密、设备凭据、访问令牌、租约令牌、对象正文、合成账号或设备/Workspace 实例 ID。

| 场景 | 两个真实 CLI 进程的观察 | 权威/本地结果 |
| --- | --- | --- |
| `SYNC-001` 正常同步 | 设备 A 连接并首次物化版本 0，获取租约，扫描文本与二进制文件并同步；无变化重跑不提交 | 服务端 `0 → 1`；本地 state/manifest 只保存非秘密摘要，无变化重跑仍为版本 1 |
| `SYNC-002` 第二设备争用 | 设备 B 获取租约返回 `LEASE_CONFLICT`；带 `--confirm` 接管成功；A 后续上传/提交返回 `LEASE_INVALID` | 接管前后版本保持 1；旧 holder 本地 lease 被清除，任一时刻只有一个可提交 writer |
| `SYNC-003` 服务端到期 | 服务端时钟越过 TTL 后 B 续租返回 `LEASE_EXPIRED`；本地租约秘密与摘要清理后，明确接管可恢复 | 到期请求不改变版本；客户端时钟不能延长服务端租约 |
| `SYNC-004` 旧基线 | B 从版本 1 修改、删除和重命名并提交版本 2；A 的 `workspace status` 投影本地 1 / 远端 2 和 conflict | 客户端不自动上传或选择方向；服务端版本 2 保持权威 |
| `SYNC-005` 明确选择本地 | A 带 `--confirm` 接管当前基线 2，再执行 `conflict use-local` | 接管租约基线允许领先本地旧基线；只创建一个版本 3，本地基线/lease 摘要同步推进 |
| `SYNC-006` 明确选择服务端 | B 保留本地编辑，带 `--confirm` 接管并执行 `conflict use-server` | 服务端仍为版本 3；本地编辑保存为可识别 conflict copy，权威对象原子物化后才推进本地基线 |
| `SYNC-007` 资格与设备失效 | Task work cycle 变化后旧 CLI 续租返回 `WORK_CYCLE_CHANGED`；Task Owner 变化后返回 `FORBIDDEN`；`auth logout` 撤销当前设备并删除 Keychain 条目 | Task Workspace 版本保持 0；已撤销设备无法刷新或写入，Web 刷新显示设备“已撤销” |
| `SYNC-008` 保护与完整性 | 真实 APFS 中的 Windows 保留名在 `sync` 扫描阶段返回 `PATH_NOT_PORTABLE`；core/adapter 继续覆盖保护路径、哈希错误、链接逃逸和竞态 | 拒绝发生在对象产生/服务端版本变化前；权威版本保持 3 |
| `SYNC-009` 碰撞、原子写与恢复 | core/APFS 覆盖 NFC/大小写碰撞、跨平台非法名、状态写/临时写/rename/fsync/删除故障及进程重建 journal 恢复 | 失败不把部分内容标记为同步；原内容恢复或生成 conflict copy，无半物化基线 |

## 真实 Web 与凭据证据

- 应用内真实浏览器完成账号注册、输入正式 CLI 输出的 8 位配对码、查看 `macos · pending` 设备摘要并点击“确认此设备”。
- 等待中的正式 CLI 只持有内存关联秘密，观察批准后消费一次性请求；成功输出只含设备 ID 和访问令牌到期时间，不含关联秘密、设备凭据或访问令牌。
- Web 刷新后设备显示“有效”；正式 CLI `auth logout` 通过短期令牌撤销当前设备并删除唯一 Keychain 项，Web 再刷新显示“已撤销”。
- 两轮端到端自动化使用一次性隔离 Keychain，覆盖 create/open、put/get、进程重开、delete 和错误脱敏；用户 Keychain search list 不变，隔离 Keychain 全部删除。

## 性能、边界与呈现

| 指标 | 输入 | 观察 | 目标 | 结论 |
| --- | --- | --- | --- | --- |
| 扫描与 diff | 500 个文本为主文件，恰好 100 MiB | `211.33 ms` | `< 5,000 ms` | pass |
| 正确性规模 | 2,000 个真实 APFS 文件 | `411.81 ms`，2,000 项/2,000 bytes 均被扫描 | 确定完成 | pass |
| 正常小文件同步 | 2 个文件，正式 HTTP/PostgreSQL/ObjectStore/Keychain，根门禁两轮 | `278.53 ms`、`260.62 ms` | `< 10,000 ms` | pass |
| 单文件软限制 | 50 MiB sparse APFS 文件及 50 MiB + 1 byte | 边界成功；超 1 byte 返回 `FILE_SIZE_LIMIT_EXCEEDED` | 清晰且不改变服务端版本 | pass |
| Workspace 软限制 | 2 GiB 纯端口边界与超界 | 边界成功；超界返回 `WORKSPACE_SIZE_LIMIT_EXCEEDED` | 清晰且不上传 | pass |
| 人类/JSON 状态 | pair/auth/connect/status/lease/sync/conflict/usage/error | 同一 `WorkspaceCliResult` 投影 waiting/read-only/conflict/recovered/recovery/倒计时 | 一致可复用 | pass |

## 兼容、安全与收尾

- `status`、`doctor`、help/version 和 stdio transport 保持；MCP 仍只注册 `workspace_status` 与 `workspace_doctor` 两个只读工具。
- 后续命令只接收 Workspace ID 或登记别名；只有 `connect` 接收根内相对登记路径，路径与每次访问均由 registry、realpath/lstat 和 core 策略复核。
- 密码、关联秘密、设备凭据、访问令牌和租约令牌不能作为 CLI 参数；普通输出、日志、审计、registry/state/journal 和本结果均未发现秘密或对象正文。
- 根 `pnpm check` 通过：format、lint、10 个 workspace build/typecheck；database 9、domain 25、ObjectStore 3、workspace-core 24、CLI 24、fixture 6、API 12 项测试通过。性能测试作为显式 supplemental 运行并另有 2 项通过。
- OpenAPI、`/health/*`、system info、P-001 Web/Identity、P-002 服务端同步、CLI 只读诊断和两个 MCP 工具全部保持兼容；无本地 GUI、网络监听、Agent 业务写工具、无认证 fixture、外部 API/AI/LLM 或仓库内 Workspace/ObjectStore/Keychain 产物。
- 验证服务、CLI hold、两个本地根、ObjectStore、性能根、恢复 journal 和一次性 Keychain 均已清理；隔离 PostgreSQL 中测试遗留活动 lease 标记为 `test_cleanup` 后停止 cluster，只保留已知日志与专用数据库。

