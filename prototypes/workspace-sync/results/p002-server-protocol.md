# P-002 服务端同步协议结果

- 执行日期：`2026-07-25`
- 运行：`initial / P-002`
- 平台：macOS arm64，Node `24.18.0`，pnpm `11.9.0`
- 数据库：隔离 PostgreSQL `17.10`，目标 `127.0.0.1:55432/ngapd_workspace_sync_p002`
- ObjectStore：仓库外隔离根 `/private/tmp/ngapd-workspace-sync-p002-objects`
- 重复次数：2 个相互隔离的 Task Workspace
- 结论：服务端 `SYNC-001`–`SYNC-007` 通过

结果只记录合成 request ID、状态和摘要结论；不记录访问令牌、租约令牌、设备凭据或对象正文。

| 场景 | 请求/响应与租约状态 | 基线与服务端结果 | 审计结论 |
| --- | --- | --- | --- |
| `SYNC-001` 正常租约与提交 | 获取租约、按 SHA-256 上传两个对象、提交、幂等重放、续租和释放均成功 | `sync_version 0 → 1`；相同请求重放仍为 1，完整 manifest 可读取 | acquire/commit/renew/release 均有操作者、设备、Workspace、request ID 和前后版本 |
| `SYNC-002` 第二设备争用 | 第二 acquire 返回 `LEASE_CONFLICT`；明确 takeover 成功，旧 holder 后续提交返回 `LEASE_INVALID` | 接管前后服务端版本保持 0；任一时刻只有一个未撤销可提交租约 | contention 拒绝和 takeover 成功均有稳定 reason code；旧 lease ID 仅作为非秘密元数据 |
| `SYNC-003` 到期后迟到提交 | 服务端时钟越过 TTL 后旧提交返回 `LEASE_EXPIRED` | `sync_version` 保持 1，旧租约不能改变 manifest | 拒绝审计记录当前版本和恢复原因 |
| `SYNC-004` 基线过期 | 当前租约从版本 1 成功提交版本 2；随后用 base 1 提交返回 `BASE_VERSION_CONFLICT` | 权威事实保持版本 2，不发生静默覆盖 | 成功与拒绝分别记录前后版本和稳定原因 |
| `SYNC-005` 选择本地 | 有资格 holder 明确发送 `choice=use_local` 和完整本地 manifest | 以服务端版本 2 为 CAS 基础，仅创建版本 3；manifest 规范排序且摘要确定 | `workspace.conflict.use_local` 审计包含 2 → 3，不含正文 |
| `SYNC-006` 选择服务端 | 有资格 holder 明确发送 `choice=use_server` | 返回不可变权威版本 3 和对象清单；不创建重复版本 | `workspace.conflict.use_server` 审计前后版本均为 3 |
| `SYNC-007` Owner 变化 | 工作周期变化使旧租约返回 `WORK_CYCLE_CHANGED`；有效 Task Owner 变化后旧 Owner 返回 `FORBIDDEN`，新 Owner 可取得新周期租约并明确选择服务端 | 旧本地变化不能提交；权威版本保持 3 | 资格拒绝与新 Owner 选择均有独立审计 |

## 额外数据完整性与恢复证据

- `0003-workspace-sync-protocol` 从保留 P-001 `system_metadata` 与 Workspace 的 schema 升级，为既有和新建 Workspace 各建立唯一空版本 0；重复 migrate 为 no-op。
- 错误对象哈希、缺失对象、对象大小不一致、不同请求复用幂等键和数据库事务失败路径均不会创建可见半版本。
- ObjectStore 使用哈希派生 storage key、同目录临时文件和原子落位；相同内容重复写安全，错误哈希不留下可读取对象，重新构造 adapter 后仍可校验读取。
- API 应用和 ObjectStore adapter 重建后，PostgreSQL 中的版本 3、manifest 与对象仍一致可读。
- 设备撤销、Workspace 归档、工作周期变化和有效 Owner 变化会立即阻止后续写操作。
- OpenAPI 包含 metadata/version/object、lease、commit 和 conflict 路由；所有路由要求短期设备 Bearer，未暴露无认证 fixture 路由。
- 审计序列化检查未发现访问令牌、租约令牌、设备凭据或对象全文。

P-002 只证明服务端 `use_server` 返回完整权威版本与对象清单。CLI 明确交互、本地冲突副本及原子物化属于 P-003，不在本结果中提前宣称完成。
