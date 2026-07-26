# Workspace 租约、同步与最小身份基础原型：修改记录 0

- 修改记录编号：`0`
- 修改类型：首次实现
- 原始需求：[`requirements.md`](requirements.md)
- 当前有效需求：[`effective-requirements.md`](effective-requirements.md)
- 初始路线图：[`implementation-plan.md`](implementation-plan.md)，revision `1`
- 执行状态：[`execution-state.md`](execution/initial/execution-state.md)
- 项目基线：分支 `prototype`；规划基线 `a75be46a624ecb3ef309cac019e597461ddfc6e9`；P-004 实施起点与当前 HEAD `aed6cbbcf4528d68ee536a580ba5f9a0ec0ce830`
- 完成日期：`2026-07-26`

## 1. 实现概述

首次实现已交付真实的 Workspace 身份、授权、租约、版本、对象和跨平台客户端闭环。Web 提供本地账号、Secure Cookie session、一次性设备配对和撤销；PostgreSQL 以前向 migration 保存最小 Project/Membership/Task、三级唯一 Workspace、设备、租约、不可变版本、manifest、幂等和审计；本地 ObjectStore 只按 SHA-256 存放校验后的内容。

Workspace CLI 不接收账号密码或 secret 参数，通过正式 REST/TypeBox/OpenAPI 获取短期设备身份；长期设备材料和活动租约分别进入 macOS Keychain 或当前用户 Windows PasswordVault。`@ngapd/workspace-core` 与平台 adapter 负责受限路径、重新扫描、稳定 manifest/diff、唯一租约、显式 `use_local/use_server`、state-last 原子物化和 journal 恢复；本地状态和对象缓存不成为服务端权威。

`SYNC-001`–`SYNC-009` 已在正式 API、PostgreSQL、ObjectStore 和两个独立 CLI 进程上重复。真实 macOS Apple Silicon/APFS/Keychain 与 Windows 11 x64/NTFS/PasswordVault 均通过；Windows 额外覆盖非 NFC、大小写/保留名/长路径、junction/symlink、sharing violation、registry/state 锁、CAS、占用文件和重启恢复。全部 core、硬门禁和 supplemental 通过，无 `FND-I-*`。

## 2. 文件修改

| 文件或范围 | 修改模式 | 主要目的 |
| --- | --- | --- |
| `docs/requirements/workspace-sync-prototype/{requirements,workflow-contract}.md` | preserved input | 已批准需求与 schema 3.2 契约；实现期间保持权威且未改写 |
| `docs/requirements/workspace-sync-prototype/implementation-plan.md` | add | 四阶段 expanded 路线图 revision 1 |
| `docs/requirements/workspace-sync-prototype/execution/initial/execution-state.md` | add/modify | initial run 的任务、恢复、验证、finding 和最终完成权威 |
| `docs/requirements/workspace-sync-prototype/execution/initial/phase-001-*.md` | add | P-001 身份、授权、最小 scope 与 Web 配对计划/不可变结果 |
| `docs/requirements/workspace-sync-prototype/execution/initial/phase-002-*.md` | add | P-002 服务端租约、版本、ObjectStore 与同步协议计划/不可变结果 |
| `docs/requirements/workspace-sync-prototype/execution/initial/phase-003-*.md` | add | P-003 core、正式 CLI 与 macOS 主体计划/不可变结果 |
| `docs/requirements/workspace-sync-prototype/execution/initial/phase-004-*.md` | add | P-004 Windows 平台关闭与最终集成计划/不可变结果 |
| `docs/requirements/workspace-sync-prototype/{effective-requirements,change-0}.md` | add | 应用至 change-0 的当前有效需求与首次实现封存记录 |
| `packages/contracts/src/{errors,identity,pairing,projects,tasks,workspaces,index}.ts` | add/modify | 身份、配对、scope、Workspace、对象、租约、提交、冲突与稳定错误 TypeBox 契约 |
| `packages/domain/src/{authorization,pairing,task-owner,workspace,index}.ts` 及测试 | add/modify | 纯授权、Owner、配对、manifest、租约/CAS/幂等与冲突规则 |
| `packages/database/src/{migrations,types,foundation-repository,identity-repository,workspace-repository,index}.ts` 及测试 | add/modify | `0002`/`0003`、真实身份/scope、行锁租约、不可变版本、对象引用、幂等和审计事务 |
| `packages/object-store/**` | add | SHA-256 内容寻址、校验、原子落位和重启可读的本地 ObjectStore |
| `packages/workspace-core/src/**` 及测试 | add/modify | 平台无关路径、manifest/diff、状态机、同步/冲突、物化 journal 和恢复 |
| `packages/test-fixtures/src/workspace-*` 及测试 | add/modify | 授权 fixture 与确定性 `SYNC-001`–`SYNC-009` 场景 |
| `apps/api/src/modules/identity/**`、`modules/workspaces/**`、应用入口及集成测试 | add/modify | 正式 Identity/Pairing/Device/Workspace REST、审计、OpenAPI 和真实数据库/ObjectStore 场景 |
| `apps/web/src/{App.tsx,styles.css}` | modify | 注册、登录/退出、配对确认/拒绝、设备显示与撤销 |
| `apps/workspace-cli/src/adapters/{filesystem,local-state,http,macos-keychain,windows-password-vault}.ts` 及测试 | add/modify | 受限文件/控制状态、正式 HTTP、macOS Keychain、Windows PasswordVault 和真实 APFS/NTFS 证据 |
| `apps/workspace-cli/src/{commands,workspace-runtime,cli,presentation,node-platform,index}.ts` 及测试 | add/modify | 正式命令/runtime、统一人类/JSON 投影、明确确认、租约 hold 与平台组合 |
| `apps/workspace-cli/src/performance.integration.test.ts` | add | 显式运行的 macOS 500 文件/100 MiB、2,000 文件和软限制证据 |
| `prototypes/workspace-sync/results/{p002-server-protocol,p003-macos-client,p004-windows-client}.md` | add | 不含 secret、正文或实例 ID 的服务端、macOS 和 Windows 主体证据 |
| `.env.example`、`compose.yaml`、相关 `package.json`、`pnpm-lock.yaml` | modify | 非秘密 origin/root/ObjectStore 配置与 workspace 内部依赖；无 P-004 新外部运行时依赖 |

没有新增本地 GUI、Agent 业务写 MCP 工具、外部 API/AI/LLM、SQLite、Redis 或外部对象服务；没有改变两个既有只读 MCP 工具、PostgreSQL 权威、Web 人工职责或用户 requirements/contract。

## 3. 需求、阶段与任务完成情况

| 阶段 / 任务 | 状态 | 完成范围 | 需求与验收 |
| --- | --- | --- | --- |
| `P-001-T-001` | completed | 身份/scope 契约、授权与 Owner 规则、`0002`、事务 repository、确定性授权 fixture | `FR-001`–`FR-010`, `FR-033`–`FR-035`; P-001 范围 `AC-004`, `AC-005`, `AC-012`, `AC-013`, `AC-017` |
| `P-001-T-002` | completed | Identity/Pairing/Device API、最小 scope service、Web 人工流与兼容门禁 | `FR-001`–`FR-010`, `FR-032`–`FR-035`, `FR-038`; `AC-001`–`AC-005`, `AC-012`, `AC-013`, `AC-016`, `AC-017` |
| `P-002-T-001` | completed | 同步契约、manifest/lease/CAS 规则、`0003`、Workspace repository、ObjectStore | `FR-011`–`FR-025`, `FR-033`–`FR-036`; 服务端数据范围 `AC-006`–`AC-008`, `AC-011`–`AC-013`, `AC-017` |
| `P-002-T-002` | completed | 设备 Bearer、Workspace/object/lease/commit/conflict REST 与服务端 `SYNC-001`–`SYNC-007` | 同上及 `FR-038`; P-002 服务端范围 `AC-006`–`AC-008`, `AC-011`–`AC-013`, `AC-016`, `AC-017` |
| `P-003-T-001` | completed | pairing status、错误上限、device credential exchange/current revoke | `FR-003`–`FR-006`; 认证范围 `AC-002`, `AC-003`, `AC-012`, `AC-013`, `AC-017` |
| `P-003-T-002` | completed | workspace-core、受限 APFS、状态/journal、HTTP 和真实 Keychain | `FR-021`–`FR-030`; `AC-007`, `AC-009`, `AC-010`, `AC-014`, `AC-016`–`AC-019` |
| `P-003-T-003` | completed | 正式 CLI、统一呈现、Web 配对、macOS 双进程两轮完整场景与性能 | `FR-003`–`FR-006`, `FR-011`–`FR-032`, `FR-036`–`FR-038`; `AC-002`, `AC-003`, `AC-006`–`AC-014`, `AC-016`–`AC-020` |
| `P-004-T-001` | completed | PasswordVault、Windows runtime 分派、NTFS 文件/锁/state/恢复 | `FR-003`–`FR-006`, `FR-011`–`FR-031`, `FR-033`, `FR-036`–`FR-038`; `AC-002`, `AC-003`, `AC-006`–`AC-017` |
| `P-004-T-002` | completed | Windows 双进程主体、占用恢复、最终根门禁、全量追踪与封存 | 最终 `FR-001`–`FR-038`; `AC-001`–`AC-020` |

P-001 至 P-004 编号连续，计划与不可变结果齐全，均为 `completed/passed`。38 项 FR、17 项 core AC 和 3 项 supplemental AC 均已通过；没有把 core 或硬门禁失败降级为 report-only finding。

## 4. 测试与验证

- 交付与验证策略：`relaxed`
- 最终验证结论：`passed`
- 开放 finding：无；下一可用 initial finding ID 为 `FND-I-001`

| 检查 | 观察结果 | 结论 |
| --- | --- | --- |
| 身份、授权与 migration | PostgreSQL `0001`–`0003`；database 9、domain 25；Argon2id、session、三级 scope、Owner、配对/撤销、migration/事务/并发通过 | pass |
| ObjectStore 与服务端协议 | ObjectStore 3；两个隔离 Workspace 重复服务端 `SYNC-001`–`SYNC-007`；对象、租约、CAS、幂等、冲突、重启和审计通过 | pass |
| workspace-core / CLI | core 24；CLI 25；路径、manifest/diff、状态、冲突、物化、恢复、parser/runtime、HTTP、凭据和 MCP 兼容通过 | pass |
| macOS 主体 | 真实 macOS Apple Silicon、APFS、两个 Keychain、两个 CLI 进程，两轮 `SYNC-001`–`SYNC-009` 与 Web 配对通过 | pass |
| macOS supplemental | 500 文件/100 MiB `211.33 ms`；2,000 文件 `411.81 ms`；小同步 `278.53/260.62 ms`；软限制通过 | pass |
| Windows 凭据/NTFS | PasswordVault 2/2；NTFS 3/3；锁压力连续 10 轮共 30/30；无残留条目、journal、tmp 或错误基线 | pass |
| Windows 主体 | Windows 11 x64/NTFS、两个 PasswordVault namespace、两个正式 CLI 进程，两轮完整场景；最终同步 `1708.56/1692.39 ms` | pass |
| 最终根门禁 | 精确 Node 24.18.0 / pnpm 11.9.0；format、lint、10 workspace build/typecheck；database 9、domain 25、ObjectStore 3、core 24、CLI 25、fixtures 37、API 12、Web 5；原生退出码 0 | pass |
| 数据与环境收尾 | 版本 16、最大版本 3、Workspace 审计 44、重复活动 lease 分组 0；4 个测试 lease 清理后活动数 0；外部目标和端口已清理 | pass |
| 最终范围与追踪 | requirements/roadmap/P-001–P-004 指纹和不可变结果一致；全量 diff、秘密、兼容、transient 与 `git diff --check` 复核通过 | pass |

## 5. 与路线图及阶段计划的偏差

- 四个 expanded 阶段的数量、顺序和责任边界没有变化；Windows core 按三个原型主体完成后的既定前置进入 P-004。
- P-001 浏览器验证发现退出后旧账号缓存，P-002 根 lint 发现未使用 import，P-003 整合发现接管租约 base 可领先本地 base；均作为当前阶段 core 实现缺陷修正并从必要门禁起点复验，不作为 finding。
- P-003 增加 API 对 CLI 的 workspace-only 测试依赖和隔离 Keychain 测试入口；没有增加外部生产依赖或改变公共协议。
- P-004 官方 EDB Windows archive 网络中断且未使用不完整下载；测试环境改用校验发布摘要的 PostgreSQL 17.10 Windows bundle，只改变测试运行时取得方式。
- Windows 实机暴露目录 `fsync` 能力、非 NFC 物理名称、sharing violation、测试中的 `/private/tmp` 可移植性和状态锁 TOCTOU；均在 P-004 计划所有权内最小修正，目标压力测试和最终根门禁通过。
- 两次嵌套长时工具执行被工具生命周期截断，不作为结论；最终同一根命令从起点经原生命令通道取得退出码 0。
- 上述偏差均已关闭，没有改变需求、同步协议、数据库 schema、阶段边界、公共兼容或 finding 结论。

## 6. 遗留事项与冻结

| ID | 类别 | 严重程度 | 关联需求/验收 | 观察与证据 | 最终功能影响 | 处置 | 置信度 | 建议后续 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 无 | — | — | — | initial run 没有开放 finding、未决问题、活动服务、凭据条目、lease、journal、半应用 migration、未知外部状态或用户工作重叠 | 无 | — | 高 | — |

本记录创建后，原始 requirements、路线图、workflow contract、initial execution state、P-001–P-004 plans/results、本记录和当前有效需求快照形成首次实现冻结链。后续需求或行为变化必须通过新的 `$apply-feature-change` 运行、连续 `change-<N>.md` 和更新后的有效需求快照表达。
