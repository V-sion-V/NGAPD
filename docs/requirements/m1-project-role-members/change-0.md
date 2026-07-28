# M1：项目、角色和成员修改记录 0

- 修改记录编号：`0`
- 修改类型：首次实现
- 原始需求：[`requirements.md`](requirements.md)
- 当前有效需求：[`effective-requirements.md`](effective-requirements.md)
- 初始路线图：[`implementation-plan.md`](implementation-plan.md)，revision `1`
- 执行状态：[`execution-state.md`](execution/initial/execution-state.md)
- 项目基线：分支 `requirements/m1-project-role-members`，提交 `f9efee992394f1b6761182237cf736f79561ad5b`
- 完成日期：`2026-07-29`
- 交付与验证策略：`relaxed`
- 验证结论：`passed`

## 1. 实现概述

首次实现已交付 M1 项目、角色和成员的完整共享闭环：

- P-001 建立 TypeBox 契约、稳定错误、Membership/Admin Mode/Owner Transfer/Logical Role 领域规则、正式 profile version 2/`0008-m1-project-role-members` 前向迁移和既有领域/Worker/fixture 兼容。
- P-002 建立唯一 Membership/Owner 权威的 Repository、固定跨模块锁序、幂等/版本、audit/Outbox 原子事务、服务端授权/application service，以及完整 `/api/v1`、OpenAPI 3.1 和 user/project audience SSE。
- P-003 建立中文 React Web、Profile/Project/Join、完整申请/成员/Admin/移除/Transfer/Admin Mode/Role/归档治理、稳定恢复与可访问性，并同步六份活动正式设计文档。

最终实现保留注册、登录、设备 Pairing/撤销、Workspace、SSE、内部 Task、Worker、Workspace CLI 和 Task UI prototype。成员移除保留 Membership/资料/角色/Task Owner，并由启用态未完成有效 Owner 阻塞；角色模型为名称加单一能力/Agent 提示文本且永不授权。

FR-001–FR-047 与 AC-001–AC-027 core 全部通过；AC-029 supplemental 通过。AC-028 参考服务器 P95 因无参考环境按合同记为 `not_run`，不冒充 passed 且不影响独立 core 结论。没有开放 `FND-I-*`。

## 2. 文件修改

| 文件或范围 | 修改模式 | 主要目的 |
| --- | --- | --- |
| `docs/requirements/m1-project-role-members/{requirements,workflow-contract}.md` | preserved input | 用户批准需求与 schema 3.2 契约，实施期间未改写 |
| `docs/requirements/m1-project-role-members/implementation-plan.md` | add | 三阶段 expanded 路线图 revision 1 |
| `docs/requirements/m1-project-role-members/execution/initial/**` | add/modify | P-001–P-003 plan/result、检查点、验证、恢复和最终状态 |
| `docs/requirements/m1-project-role-members/{effective-requirements,change-0}.md` | add | 当前有效需求与首次实现冻结记录 |
| `packages/contracts/src/**` | add/modify | Profile/Project/Membership/Transfer/Admin Mode/Role DTO、动作、版本和稳定错误 |
| `packages/domain/src/**` | add/modify | Membership 生命周期、治理矩阵、Admin Mode、Owner Transfer、Role 不授权、移除阻塞和系统模板 |
| `packages/database/src/**` | add/modify | `0008`、profile 2、M1 Schema/Repository、锁序、幂等、audit/Outbox、失效和真实并发测试 |
| `apps/api/src/**` | add/modify | M1 application service、授权/audit、全部 `/api/v1` routes、OpenAPI/SSE 和集成测试 |
| `apps/worker/src/outbox-task.integration.test.ts` | modify | project audience Outbox fixture 与同一投影函数兼容 |
| `apps/web/src/**` | add/modify | 中文 M1 shell、Profile/Project/Join、完整治理、SSE/refetch、稳定错误、响应式和可访问性 |
| `packages/test-fixtures/src/**` | modify | Membership 新权威、系统模板 parity 和跨包兼容 fixture |
| `docs/01-product-requirements.md`、`02-domain-model.md`、`03-permission-model.md`、`04-system-architecture.md`、`07-roadmap-and-validation.md`、`08-decisions-and-open-issues.md` | modify | FR-047 正式产品/领域/权限/架构/路线/决策同步 |
| `AGENTS.md` | modify | M1 当前阶段、技术事实、验证和后续入口 |

没有新增生产依赖，`apps/web/package.json` 与 `pnpm-lock.yaml` 未变；没有新增公共 Task CRUD、本地 Workspace GUI/Sync、Agent 业务写工具、外部 API/AI/LLM、SQLite、Redis 或分布式基础设施。

## 3. 需求、阶段与任务完成情况

| 阶段 / 任务 | 状态 | 完成范围 | 需求与验收 |
| --- | --- | --- | --- |
| `P-001-T-001` | completed | M1 runtime Schema、稳定错误、领域状态/授权和 Role 模板 | FR-001–FR-046 的共享边界；V-001 passed |
| `P-001-T-002` | completed | `0008`、profile 2、Schema/Kysely、前向保留、既有 Repository/Worker/fixture 适配 | FR-002、FR-007、FR-019–FR-025、FR-029–FR-039、FR-043–FR-046；V-002/V-003 passed |
| `P-001-T-003` | completed | 兼容、根工程、安全和 P-001 封存 | P-001 范围 AC-001–AC-027；V-004/V-005 passed |
| `P-002-T-001` | completed | 全部 M1 Repository、事务锁序、幂等/版本、audit/Outbox、并发/故障 | FR-001–FR-041、FR-043–FR-046 数据层；V-006 passed |
| `P-002-T-002` | completed | application service、服务端身份/租户/权限、actions 和稳定错误 | 同上 application 层；V-007 passed |
| `P-002-T-003` | completed | 完整 `/api/v1`、OpenAPI、Origin/Cookie、最小披露、Outbox/SSE 和兼容 | AC-001–AC-022、AC-024–AC-027 后端闭环；V-008/V-009 passed |
| `P-003-T-001` | completed | Web API/query/SSE、认证 shell、Profile/Project/Join 与既有入口 | FR-042/AC-023 基础；V-010 passed |
| `P-003-T-002` | completed | 真实 API 的项目治理、多身份和可访问性闭环 | FR-042/AC-023 完整；V-011 passed |
| `P-003-T-003` | completed | FR-047 正式文档、最终根/发布/附加并发诊断和初始封存 | FR-001–FR-047、AC-001–AC-029 最终收口；V-012/V-013/V-016 passed，V-014/V-015 `not_run` |

P-001–P-003 编号连续，三份 plan/result 齐全且均为 `completed/passed`。47 项 FR、27 项 core AC 和适用 supplemental 均已处理；没有把 core 或硬门禁失败降级为 finding。

## 4. 测试与验证

- 最终工具链：Node.js `24.18.0`、pnpm `11.9.0`、PostgreSQL `17.10`
- 正式数据：profile version 2，8 migrations，latest `0008-m1-project-role-members`，74 个系统模板
- 最终验证结论：`passed`
- 开放 finding：无；下一可用 initial finding ID 为 `FND-I-001`

| 检查 | 观察结果 | 结论 |
| --- | --- | --- |
| Contracts/Domain/Database | Contracts 12、Domain 68、Database 47；迁移、领域矩阵、事务、锁、幂等、故障和真实并发通过 | pass |
| API/Worker | API 27、Worker 4；完整 M1 routes/OpenAPI/audit/Outbox/SSE、Cookie/Origin/IDOR 与既有入口兼容 | pass |
| Web/浏览器 | Web 16；Owner/Admin/Member/Applicant 真实浏览器治理、SSE 降权、版本恢复、焦点、键盘、非颜色和窄屏通过 | pass |
| Workspace 兼容 | Workspace Core 27、Workspace CLI 25、ObjectStore 7、fixtures 40；真实 Windows 双 CLI 两轮通过 | pass |
| 最终根门禁 | `DATABASE_TEST_URL=<P-003>` 从头 `pnpm check`；format/lint、全部 build、10 workspace typecheck、273 tests passed、0 failed、7 platform skips | pass |
| 文档/安全/范围 | 六份活动文档、README、OpenAPI、秘密/外部调用/reset/transient、Git diff/check 和封存路径 | pass |
| Compose | 当前主机无 Docker/Compose/Podman | not_run |
| 参考 P95 | 当前无参考服务器或正常内网/VPN 目标 | not_run |
| 附加诊断 | Project Membership PostgreSQL 行锁/并发单文件 6 tests、986ms | pass |

## 5. 与路线图及阶段计划的偏差

- 三个 expanded 阶段的数量、顺序和责任边界没有变化；P-001/P-002 结果生成后未改写。
- P-003 未修改生产后端；最终门禁只把 `m1.integration.test.ts` 的 Outbox 测试 cutoff 从跨日失效的固定旧时间改为远未来，以证明既有投影，而不改变产品语义。
- 一次手工 Pairing 补充 harness 因后台日志句柄等待超时，已精确清理且不计门禁；Pairing/Device 由 V-010 与 P-002 V-008/V-009 证明。
- sandbox 根运行只因 Windows `C:\tmp`/PasswordVault 权限失败；一次已授权执行被工具输出超时截断。最终从头根命令在可观察、已授权环境完成全部 273 项测试。
- 当前主机无 Docker 或参考服务器；V-014/V-015 按预先批准的环境适用规则记为 `not_run`，没有安装外部工具或伪造发布/性能结果。
- 上述偏差均已关闭或按合同收口，没有改变需求、Schema、公共 API、阶段边界、权限语义或 finding 结论。

## 6. 遗留事项与冻结

| ID | 类别 | 严重程度 | 关联需求/验收 | 观察与证据 | 最终功能影响 | 处置 | 置信度 | 建议后续 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 无 | — | — | — | initial run 没有开放 finding、未决问题、半 migration、未知外部状态或用户工作重叠；V-014/V-015 为合同允许的环境 `not_run` | 无 | — | 高 | 在具备 Docker/参考服务器的发布环境执行相应运维证据，不改写本记录 |

本记录创建后，原始 requirements、workflow contract、路线图、initial execution state、P-001–P-003 plans/results、本记录和当前有效需求快照形成首次实现冻结链。后续需求或行为变化必须通过 `$apply-feature-change`、连续 `change-<N>.md` 和更新后的有效需求快照表达。
