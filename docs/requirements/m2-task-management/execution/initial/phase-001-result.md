# M2 initial run：P-001 阶段结果

- 运行编号：`initial`
- 阶段：`P-001`
- 阶段计划：[`phase-001-plan.md`](phase-001-plan.md)
- 阶段计划修订：`1`
- 父路线图修订：`1`
- 需求指纹：`sha256:37f1e0c2a34c7578bdf2e3f55d0c47834353322ebd09cfc186fe14fc16685094`
- 路线图指纹：`sha256:43d93afe30f6c67579ccb301203ac673e2684e3bfc6f2973d54ce77e2988bd11`
- 阶段计划指纹：`sha256:4013923bb57935e5dce8366cc4e3ed104a180349ec2203ca073293ed051358a4`
- 完成时间：`2026-07-30T06:45:00+08:00`
- 状态：`completed`
- 交付与验证策略：`relaxed`
- 验证结论：`passed`
- 开始基线：分支 `codex/m2-clarify-requirements`，提交 `39b779dd4f1347e89158a37554cdcd4ceeb773dd`
- 结束基线：同一分支上的完整未提交 M2 工作树；阶段结果写入后按用户指令统一 commit/push，不改写用户提供的工作流合同或封存的 M0/M1/原型记录

## 1. 阶段目标与结果

P-001 在一个可发布边界内完成 FR-001–FR-032 和 AC-001–AC-020：

- 正式数据库通过非破坏性 `0009-m2-task-management` 从 profile version 2 前向建立 version 3；空库、既有前缀、重复 migrate、legacy role 回填、零/多匹配 fail-closed 和事务回滚均有真实 PostgreSQL 17 证据。
- Contracts/Domain/Database 建立完整 Task 字段、树、同级 DAG、显式/有效 Owner、状态/blocker、影响集合、完成/重开、归档/不可恢复删除、Task Workspace、评论、活动、站内通知和可重建投影规则。
- 面向人类 Session 的 `/api/v1`/OpenAPI 提供 Task 查询/命令、依赖变更请求、关注、blocker、评论、活动、通知和 Task Workspace 状态；服务端解析 actor、项目、有效 Owner、Admin Mode、版本和影响集合，拒绝客户端 actor/admin/Agent 注入。
- Task/Graph/Owner/Lifecycle/Comment/Workspace 写入继续使用事务、版本、幂等、不可变审计和 Outbox；Graphile Worker 幂等生成 Activity、`completion_ready`、关键通知和截止时间提醒，SSE 只发精确 audience 资源引用。
- 深度 20、单父级 200 Task、200 节点 DAG 和单项目 5,000 Task 的确定性规模正确性通过；M0/M1 Identity、Project/Membership/Role/Admin Mode、Web 治理、Workspace、SSE、Worker 和 Workspace CLI 保持兼容。
- 发布网关补齐 `/docs*` 到 API 的代理规则，使 Compose 网关上的 Swagger/OpenAPI 与直接 API 表面一致；没有新增服务、生产依赖、外部 API、AI/LLM、Redis 或搜索集群。

M3 正式 Task UI、M4 本地 Workspace 平台适配器、M5 Agent 工具/Skill 和 M6 摘要/Wiki 均未提前实现。

## 2. 任务、需求与验收覆盖

| 任务 | 状态 | 完成范围 | 验证 |
| --- | --- | --- | --- |
| `P-001-T-001` | completed | `0009`/profile 3、共享 Task/Comment/Notification 契约、领域规则、Query/Command/Lifecycle/Comment/Projection Repository、Audit/Outbox | V-001/V-002/V-003 passed |
| `P-001-T-002` | completed | Session-only Task `/api/v1`/OpenAPI、评论/活动/通知、Worker 投影/reminder、精确 SSE 和兼容 | V-004/V-005/V-006 passed |
| `P-001-T-003` | completed | 规模夹具、M2 P95 入口、最终根门禁、发布硬化、Chrome 验收、正式文档与工作流收口 | V-007–V-012 passed |

阶段退出不变量全部满足：

- 32 项 FR、18 项 core AC 和 2 项 supplemental AC 均有实现与有效证据。
- 任何公共 Task mutation 都从当前人类 Session 推导 actor；内部 Agent actor 端口未公开。
- 普通权限、Admin Mode、完成冻结、精确 Key 删除确认、唯一租约、版本与完整影响集合没有低层绕过入口。
- 评论完成竞态、管理员隐藏原文保留、投影重试/重建和通知去重均通过。
- 没有 unresolved question、半迁移、core/hard-gate 失败或开放 `FND-I-*`。

## 3. 文件修改

| 文件或范围 | 修改模式 | 主要目的 |
| --- | --- | --- |
| `packages/contracts/src/{tasks,task-comments,task-notifications,errors,index}.ts` | add/modify | M2 公共 DTO、运行时 Schema、稳定错误与导出 |
| `packages/domain/src/{task-fields,task-comments,task-projections,task-m2.test,index}.ts` | add/modify | 字段、评论、投影和权限无框架规则 |
| `packages/database/src/{migrations,schema-profile,types,task-*,outbox-*,foundation-*}.ts` | add/modify | `0009`、profile 3、查询/命令/生命周期/评论/投影 Repository、Audit/Outbox |
| `apps/api/src/{app,application-errors,m2.integration.test}.ts`、`apps/api/src/modules/tasks/**` | add/modify | 完整 Session-only `/api/v1`/OpenAPI 和真实 PostgreSQL 闭环测试 |
| `apps/worker/src/{index,outbox-task}.ts` | modify | Activity/Notification/`completion_ready` 投影与 due reminder |
| `packages/test-fixtures/src/m2-tasks*` | add/modify | 深度、同级、DAG、5,000 Task 与并发确定性夹具 |
| `scripts/performance/m2-reference-p95.mjs`、`package.json` | add/modify | 隔离目标确认、LAN/TLS 连接和 M2 P95 采样入口 |
| `deploy/Caddyfile` | modify | 网关代理 `/docs*` 到 API，修复发布栈 OpenAPI 可达性 |
| Workspace/API 的 Windows 测试文件 | modify | 使用仓库内隔离临时目录；仅精确 PasswordVault 不可用条件可跳过 |
| `docs/01`–`04`、`07`、`08`、`README.md`、`AGENTS.md` | modify | 同步 Schema 3、M2 完成状态、公共表面、正确 CI/P95 命令和下一里程碑 |
| `docs/requirements/m2-task-management/**` | add/modify | 路线图、阶段计划/结果、执行状态、验证、change-0 与 effective snapshot |

没有修改 M0/M1/原型封存的 result、change record 或 effective snapshot；没有新增生产依赖或锁文件变化。

## 4. 测试与验证

最终工程证据使用 Node.js `24.18.0`、pnpm `11.9.0`、PostgreSQL `17.10`。Node 压缩包按 nodejs.org 官方 SHA-256 `0ae68406b42d7725661da979b1403ec9926da205c6770827f33aac9d8f26e821` 校验。

| 验证 | 最终结果 |
| --- | --- |
| V-001 共享规则 | passed；Contracts 12、Domain 73、Test Fixtures 42 tests |
| V-002 migration/profile | passed；version 2→3、空库、重复、异常回滚、legacy role fail-closed、profile 3 |
| V-003 Repository/事务 | passed；完整 Database 11 files/55 tests，含并发、幂等、故障注入和投影恢复 |
| V-004 API/OpenAPI/安全 | passed；全部 Task routes 可发现，actor/admin/project 注入与跨租户负向稳定拒绝 |
| V-005 评论/投影/通知 | passed；完成后追加式不可变、管理员隐藏保留原文、Worker 重试/重建不重复 |
| V-006 兼容 | passed；M0/M1、Workspace、SSE、Worker、Web 和 Workspace CLI 保持 |
| V-007 规模 | passed；深度 20、200 同级、200 DAG、5,000 Task 正确，无硬限制或跨租户遗漏 |
| V-008 最终根门禁 | passed；`pnpm run ci` 259 秒，两次 migrate、format/lint/build/typecheck 和 288 passed、0 failed、9 platform-conditional skipped |
| V-009 发布栈 | passed；最终源码 SHA-256 `854cc17a913fce1a30be9ccb1380bab6f273a65417636983942a5cb865c71514`，六服务健康、Schema 3/9 migrations、重复迁移、硬化、持久化与秘密扫描通过 |
| V-010 参考 P95 | passed；列表 15.36 ms、详情 19.53 ms、创建 45.49 ms、更新 29.83 ms、200 节点 DAG 38.73 ms |
| V-011 浏览器补充 | passed；Chrome 从 LAN 打开 NGAPD Web 注册入口和 Swagger UI，Swagger 呈现 27 个 Task 路由与通知表面 |
| V-012 最终审查 | passed；无 secret、外部 API/AI/LLM、生产 reset/down、M3–M6 越界、封存改写或未知进程 |

最终测试分布为 Contracts 12、Domain 73、Workspace Core 27、Workspace CLI 24、Database 55、Object Store 7、Test Fixtures 42、API 28、Web 16、Worker 4，共 288 passed。Workspace CLI 有 8 个既有平台条件 skip；API 有 1 个当前 Codex 沙箱无法访问 Windows PasswordVault 的精确 `CREDENTIAL_UNAVAILABLE` skip，其他错误仍失败，且 M1 已保留真实 Windows 凭据基线。

详细远端环境、命令边界、P95 和清理证据见 [`validation/reference-server-2026-07-30.md`](../../validation/reference-server-2026-07-30.md)。

## 5. 发现项与处置

当前无开放 `FND-I-*`；下一可用 ID 仍为 `FND-I-001`。

| ID | 类别 | 严重程度 | 关联需求/验收 | 观察与证据 | 最终功能影响 | 处置 | 置信度 | 建议后续 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |

所有 supplemental 门槛均通过，没有可保留的 report-only 异常，因此最终验证结论为 `passed`。

## 6. 决策、计划偏差与恢复记录

- 沿用用户选择的 `relaxed` 策略；没有降低 core、安全、隐私、数据、兼容、构建、恢复或适用发布门禁。
- 三个任务严格按 `P-001-T-001 → T-002 → T-003` 执行；每个 checkpoint 通过后才进入下一任务。
- 计划写作 `pnpm ci`，执行时发现 pnpm 会把它解释为 clean-install 而非仓库脚本；该无效尝试在恢复离线依赖后未计入证据。最终使用等价且无歧义的 `pnpm run ci`，并同步 README/AGENTS。
- 初次发布验证发现网关把 `/docs/json` 错误回退到 Web；这是发布 core 缺口，已在 `deploy/Caddyfile` 修复 `/docs*` 代理并触发 V-009。最终重建、TLS、OpenAPI 和全部硬化检查通过。
- M2 P95 脚本第一次生成包含数字的 Project Key，被既有 `[A-Z]{2,6}` 运行时契约拒绝；修正为纯大写字母后在最终隔离栈重新完整采样，失败尝试未产生项目/Task 数据且不计性能结论。
- Browser in-app 无法解析 `ngapd.local`，且其私网 URL 策略阻止直接 IP；按浏览器技能切换用户 Chrome 后完成 LAN Web/Swagger 可视验收。原始 `/docs/json` 的直接导航被扩展拦截，但同一端点已由远端 curl/内容检查和 Swagger 实际加载独立证明。

数据库恢复边界保持前向迁移/roll forward；生产迁移前仍需一致备份。参考服务器仅使用明确命名的隔离栈、卷、镜像、目录、开发数据库和 SSH 隧道；最终全部精确删除，原有 `deploy-home-table-1` 保持运行。

## 7. 初始运行冻结条件

- P-001 有连续、不可变的 completed/passed result，requirements、roadmap 和 phase plan 指纹一致。
- FR-001–FR-032、AC-001–AC-020 全部完成；全部 core/hard gate 和 supplemental 门槛通过，无开放 finding。
- [`execution-state.md`](execution-state.md) 已更新为 `completed/passed`，并生成 [`effective-requirements.md`](../../effective-requirements.md) 与 [`change-0.md`](../../change-0.md)。
- 本结果、`change-0.md` 和 effective snapshot 生成后不可改写；后续 M2 行为变化只能使用 `$apply-feature-change` 创建连续 change run。
