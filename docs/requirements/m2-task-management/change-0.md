# M2：任务管理闭环修改记录 0

- 修改记录编号：`0`
- 修改类型：首次实现
- 原始需求：[`requirements.md`](requirements.md)
- 当前有效需求：[`effective-requirements.md`](effective-requirements.md)
- 初始路线图：[`implementation-plan.md`](implementation-plan.md)，revision `1`
- 执行状态：[`execution-state.md`](execution/initial/execution-state.md)
- 项目基线：分支 `codex/m2-clarify-requirements`，提交 `39b779dd4f1347e89158a37554cdcd4ceeb773dd`
- 完成日期：`2026-07-30`
- 交付与验证策略：`relaxed`
- 验证结论：`passed`

## 1. 实现概述

首次实现以一个 expanded 阶段交付完整 M2 服务端任务管理闭环：

- `0009-m2-task-management` 把正式 Schema 从 version 2 前向提升到 version 3，新增或正式化 Task 字段、Project Role ID、评论、活动、通知、偏好/已读、`completion_ready` 与投影去重事实，同时保留 M0/M1 数据和兼容表面。
- 共享 Contracts/Domain/Database 建立 Task 树、同级 DAG、有效 Owner、状态/blocker、完成/重开、移动/归档/删除、影响集合、Task Workspace、评论和通知的单一权威。
- API 提供面向人类 Session 的完整 `/api/v1`/OpenAPI；所有 actor、项目、Owner、Admin Mode、版本与影响都由服务端解析，公共请求不能伪造 Agent 或管理员。
- Graphile Worker 通过事务 Outbox 幂等维护 Activity、`completion_ready`、关键通知和 due reminder；SSE 只发送精确 audience 资源引用，投影可重建。
- 确定性规模夹具、最终根 CI、六服务参考发布、浏览器 Swagger/Web 和 M2 P95 均通过；发布网关补齐 `/docs*` API 代理。

M3 正式 Task UI、M4 本地 Workspace 适配、M5 Agent/Skill 和 M6 摘要/Wiki 保持在后续里程碑。

## 2. 文件修改

| 文件 | 修改模式 | 主要目的 |
| --- | --- | --- |
| `docs/requirements/m2-task-management/{requirements,workflow-contract}.md` | modify | 保留用户合同；按明确 Q-001 回答冻结评论生命周期与验收 |
| `docs/requirements/m2-task-management/implementation-plan.md` | add | initial single/expanded 路线图 revision 1 |
| `docs/requirements/m2-task-management/execution/initial/phase-001-plan.md` | add | 唯一阶段计划、三个顺序任务、门禁和恢复边界 |
| `docs/requirements/m2-task-management/execution/initial/phase-001-result.md` | add | immutable completed/passed 阶段结果 |
| `docs/requirements/m2-task-management/execution/initial/execution-state.md` | add | completed/passed initial 协调状态 |
| `docs/requirements/m2-task-management/validation/reference-server-2026-07-30.md` | add | 最终源码发布、浏览器、P95 与清理证据 |
| `docs/requirements/m2-task-management/{effective-requirements,change-0}.md` | add | 当前有效需求与首次实现冻结记录 |
| `packages/contracts/src/**` | add/modify | M2 Task/Comment/Notification DTO、运行时 Schema 与稳定错误 |
| `packages/domain/src/**` | add/modify | M2 字段、评论、投影、Owner/状态/权限规则与测试 |
| `packages/database/src/**` | add/modify | `0009`/profile 3、Task Query/Command/Lifecycle/Comment/Projection Repository、Audit/Outbox |
| `apps/api/src/**` | add/modify | Session-only Task application service、完整 `/api/v1`/OpenAPI 与集成测试 |
| `apps/worker/src/**` | modify | 投影消费和截止时间提醒 |
| `packages/test-fixtures/src/**` | add/modify | M2 深度、同级、DAG、5,000 Task 规模夹具 |
| `scripts/performance/m2-reference-p95.mjs`、`package.json` | add/modify | M2 隔离参考 P95 入口 |
| `deploy/Caddyfile` | modify | 发布网关代理 Swagger/OpenAPI `/docs*` |
| `docs/01`–`04`、`07`、`08`、`README.md`、`AGENTS.md` | modify | 同步 M2 实现、Schema 3、命令、验证和下一里程碑 |

没有新增生产依赖或锁文件变化；没有改写 M0/M1/原型封存 result、change record 或 effective snapshot。

## 3. 需求、阶段与任务完成情况

| 阶段 / 任务 | 状态 | 完成范围 | 需求与验收 |
| --- | --- | --- | --- |
| `P-001-T-001` | completed | Schema 3、共享契约/领域、Task 数据/事务/投影 Repository | FR-001–FR-032 的共享基础；AC-001、AC-003–AC-015、AC-017 基础；V-001–V-003 passed |
| `P-001-T-002` | completed | 完整 Task API、评论/活动/通知、Worker/SSE 与兼容 | FR-002–FR-032 公共闭环；AC-002、AC-005–AC-016；V-004–V-006 passed |
| `P-001-T-003` | completed | 规模、最终 CI、参考发布/P95/浏览器、正式文档与冻结 | FR-001–FR-032、AC-001–AC-020 最终收口；V-007–V-012 passed |

唯一 P-001 的 plan/result 连续且为 `completed/passed`。32 项 FR、18 项 core AC 和 2 项 supplemental AC 全部完成；无半迁移、开放问题或 `FND-I-*`。

## 4. 测试与验证

本运行使用 `relaxed` 策略，但所有 core、hard gate 和 supplemental 均通过，没有使用 report-only 例外。

- Node `24.18.0`、pnpm `11.9.0`、PostgreSQL `17.10`。
- 最终 `pnpm run ci`：两次 migration，format/lint/build/typecheck 全部通过；288 tests passed、0 failed、9 platform-conditional skipped。
- 正式 profile version 3、9 migrations、latest `0009-m2-task-management`；空库/前向/重复/异常回滚与投影重建通过。
- 最终参考源码 SHA-256 `854cc17a913fce1a30be9ccb1380bab6f273a65417636983942a5cb865c71514`；六服务健康、硬化、持久化、秘密扫描和 Chrome Web/Swagger 通过。
- P95：列表 15.36 ms、详情 19.53 ms、创建 45.49 ms、更新 29.83 ms、200 DAG 38.73 ms，全部通过 AC-019。
- 隔离远端栈/卷/镜像/目录、CI PostgreSQL 和 SSH 隧道已清理；原有服务保持。

## 5. 与路线图及阶段计划的偏差

- 阶段数量、任务顺序、范围和 gate split 与路线图/阶段计划一致。
- 最终根命令使用 `pnpm run ci`，因为 `pnpm ci` 是 pnpm 自身 clean-install 别名而不是仓库 script；验证内容完全等价于计划，并已同步开发文档。
- 发布检查原本仅在发布栈有 diff 时触发。初次参考验证发现 Caddy 未代理 `/docs*`，修复形成发布栈 diff，因此按计划执行并通过 V-009。
- M2 P95 Project Key 生成器的一次输入错误在有效采样前修正；最终数据来自最终隔离源码快照，不改变需求或实现范围。

没有 roadmap/phase 修订、纠正阶段、风险接受或越界实现。

## 6. 遗留事项

当前无开放 finding；下一可用 initial ID 为 `FND-I-001`。

| ID | 类别 | 严重程度 | 关联需求/验收 | 观察与证据 | 最终功能影响 | 处置 | 置信度 | 建议后续 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |

后续 M2 变更必须使用 `$apply-feature-change` 创建连续 `change-1`；M3–M6 作为独立工作流推进。
