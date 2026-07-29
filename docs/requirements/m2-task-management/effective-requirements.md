# M2：任务管理闭环当前有效需求

- 派生状态：可重新生成
- 原始需求：[`requirements.md`](requirements.md)
- 已应用至修改记录：[`change-0.md`](change-0.md)
- 生成日期：2026-07-30
- 当前交付与验证策略：`relaxed`
- 当前验证结论：`passed`

## 1. 当前目标与范围

当前有效目标是在 M1 Identity、Project/Membership/Role/Admin Mode、Workspace、Audit/Outbox/SSE 和中文治理 Web 基线上，提供完整服务端任务管理闭环：正式 Schema version 3、递归 Task 树与同级 DAG、显式/有效 Owner、状态/blocker、完成/重开、影响预览、Task Workspace、评论、活动、站内通知、面向已认证人类 Session 的 `/api/v1`/OpenAPI，以及可重建的 Worker 投影。

M2 范围不包含 M3 正式平铺树状 Task UI、M4 本地 Workspace 平台适配器、M5 Agent 工具/Skill 与公开 Agent 写入口、M6 摘要/Wiki/全文搜索。内部 Agent actor 端口继续非公开，后续入口必须复用当前领域、应用服务和权限边界。

## 2. 当前生效功能需求

| 当前编号 | 当前生效内容 | 当前状态 | 来源 |
| --- | --- | --- | --- |
| `FR-001` | 从 M1 Schema version 2 通过非破坏性、可重复、可诊断的正式迁移建立 M2 Task 数据结构、约束和索引；不要求 reset，不丢失或重写既有 Project、Membership、Role、Task、Workspace、审计或 Outbox 事实。 | passed | `requirements.md` |
| `FR-002` | 所有正式 Task HTTP 能力位于 `/api/v1`，使用 TypeBox 运行时 Schema 并进入 OpenAPI 3.1；客户端不能声明可信 user/project/Owner/管理员/actor，服务端从认证会话和资源关系解析。 | passed | `requirements.md` |
| `FR-003` | 活动项目成员可读取活动/归档任务树、直接子任务与同级依赖、完整详情、显式/有效 Owner、状态、统计、阻塞、关注、评论、活动和服务端 `actions`。 | passed | `requirements.md` |
| `FR-004` | 新建 Task 事务性分配不可复用 Task Key 并建立唯一任务级逻辑 Workspace；顶层指定活动显式 Owner，子 Task 可指定活动成员或继承；幂等重试只产生一个结果。 | passed | `requirements.md` |
| `FR-005` | 未完成、未归档 Task 的有效 Owner 或有效 Admin Mode 可按权限修改标题、Markdown 正文、项目逻辑角色、UTC 截止时间、标签和 `normal/sprint/milestone` 展示类型；归档角色不能新绑定，展示类型不改变业务语义。 | passed | `requirements.md` |
| `FR-006` | 有效 Owner 可为任意未完成后代设置/替换活动显式 Owner；非顶层显式 Owner 可清空自身绑定回落到最近祖先，顶层不能清空；变化先展示完整影响。 | passed | `requirements.md` |
| `FR-007` | Owner 变化原子更新责任事实、Task/Workspace 版本、ownership-change 快照和旧租约撤销；旧 Owner 立即失去写资格，新 Owner 只能在提交后申请租约，失败无半状态。 | passed | `requirements.md` |
| `FR-008` | M1 成员移除继续按未完成有效 Task Owner 返回稳定阻塞清单；成功移除不清空、重写或删除 Task Owner/历史引用。 | passed | `requirements.md` |
| `FR-009` | 同父级作用域依赖保持唯一、有向、无环；拥有两端或共同父 Task 可直接修改，顶层由 Project Owner 控制，单端拥有者通过绑定两端 Owner 与 `graph_version` 的请求交由另一端接受。 | passed | `requirements.md` |
| `FR-010` | 依赖请求支持接受、拒绝、过期以及因 Owner/端点/图版本变化失效；完成、归档、跨父、重复、自环、成环、无权或陈旧变更提交前稳定拒绝，低层入口不能绕过。 | passed | `requirements.md` |
| `FR-011` | 有效 Owner 或有效 Admin Mode 可维护未完成 Task 的同项目一跳关注；关注只扩展上下文发现，不递归、不扩权、不改变 Task/图/Workspace 权威事实。 | passed | `requirements.md` |
| `FR-012` | 基础状态支持 `not_started → in_progress → done`；有效状态在活动 predecessor 未完成或 blocker 未解决时派生为 `blocked`；blocker 写入受权限与 Task 版本保护。 | passed | `requirements.md` |
| `FR-013` | 可重建、幂等的 `completion_ready` 仅在直接启用子 Task、活动 predecessor 和 blocker 条件全部满足时为 true；首次满足向当前有效 Owner 产生一次通知，条件失效后再次满足可产生新通知。 | passed | `requirements.md` |
| `FR-014` | `completion_ready` 不自动完成 Task；只有有效 Owner 或有效 Admin Mode 显式完成，且条件、Task/图/Workspace 版本仍匹配时才提交。 | passed | `requirements.md` |
| `FR-015` | 完成事务使用最终服务端 Workspace 版本，固化继承 Owner、创建不可变快照、冻结 Task/Workspace、释放租约并写审计/Outbox；任一步失败整体回滚。 | passed | `requirements.md` |
| `FR-016` | 完成后冻结 Task 内容、Owner、结构、依赖、blocker 和 Workspace；仍允许活动成员追加评论、显式重开和归档已完成顶层 Task。 | passed | `requirements.md` |
| `FR-017` | 重开恢复 `in_progress` 并创建新 Workspace 周期、保留旧快照；祖先先显式重开；`deny` 拒绝已完成 successor，`cascade` 原子重开完整已完成 successor 闭包并在跨 Owner 时要求 Admin Mode 与完整影响确认。 | passed | `requirements.md` |
| `FR-018` | 历史 Owner 不活动时，重开必须同时指定活动显式 Owner；Task、Owner、Workspace、周期、图版本或影响集合漂移时旧操作返回稳定 stale/conflict。 | passed | `requirements.md` |
| `FR-019` | 未完成 Task 移动先返回稳定影响，要求结构权限、无活动依赖、目标父未完成、目标不在自身子树和双图版本匹配；按稳定锁序原子移动并递增版本、审计和事件。 | passed | `requirements.md` |
| `FR-020` | 仅顶层 Task 可归档且不恢复；归档保留任务、子树、Workspace、评论、来源引用、审计和依赖历史，子树退出活动计算并更新适用图版本。 | passed | `requirements.md` |
| `FR-021` | 仅未完成非顶层 Task 可不可恢复删除；删除子树、活动依赖和 Workspace 业务内容，保留 Task Key 墓碑与审计；含完成 Task/外部完成端点时拒绝，提交必须匹配完整 Task Key。 | passed | `requirements.md` |
| `FR-022` | 移动、归档、删除、Owner 变化、级联重开和关注从服务端事实计算稳定完整影响；绑定版本或影响指纹漂移后不能执行。 | passed | `requirements.md` |
| `FR-023` | 每个 Task 恰有一个服务端逻辑 Workspace，提供清单、`sync_version`、生命周期、工作周期、快照和唯一租约契约；完成/重开/Owner/租约/冻结的原子边界可供 M4 直接复用。 | passed | `requirements.md` |
| `FR-024` | 活动成员可发布 Markdown 评论；未完成 Task 仅作者可编辑/删除本人评论，完成后所有评论追加式不可变；附件仅引用有权读取的 Workspace 文件，Admin Mode 隐藏保留原文、操作者、原因和审计。 | passed | `requirements.md` |
| `FR-025` | 活动流按时间稳定排序、分页和续读，覆盖 Task、图、Owner、状态、结构、生命周期、评论与管理员隐藏；活动流不是第二写入事实。 | passed | `requirements.md` |
| `FR-026` | 站内关键通知覆盖 Owner、blocker、依赖请求、评论/提及、截止时间、`completion_ready` 和破坏性/权限结果；关键通知不可关闭，非关键偏好可配置，重复 Outbox 不产生重复通知。 | passed | `requirements.md` |
| `FR-027` | Task 成功/失败尝试写不可变审计，包含 actor/project/target/request/action/result/reason/version；密码、token、lease secret 和完整评论/Workspace 正文不进入普通日志或审计元数据。 | passed | `requirements.md` |
| `FR-028` | 已提交 Task/评论/通知事件经事务 Outbox 交给 Worker；SSE 只发布精确 user/project audience 的资源引用，支持 cursor 与幂等，不跨项目泄露。 | passed | `requirements.md` |
| `FR-029` | 资源写使用 Task/图/Workspace 版本、幂等键或等价条件；错误返回稳定机器码、可读消息、request ID、适用版本和恢复建议；并发只有完整前态或后态。 | passed | `requirements.md` |
| `FR-030` | 普通模式只修改当前用户有效拥有且完整影响均授权的 Task；跨 Owner 内容/状态/结构/存续/批量影响要求 Admin Mode。Admin Mode 不绕过他人 Task Workspace、冻结、Key 确认、唯一租约或 Agent 人工确认。 | passed | `requirements.md` |
| `FR-031` | 公开 Task 写接口面向已认证人类 Session 并由服务端推导 actor；不提供客户端自称 Agent/管理员旁路；内部 Agent actor 端口非公开并为 M5 复用同一领域/授权服务。 | passed | `requirements.md` |
| `FR-032` | M0/M1 Identity、Project/Membership、Roles、Admin Mode、Workspace、审计、Outbox/SSE、Web 治理和 Workspace CLI 保持可观察兼容；跨模块仅经应用服务、只读端口或已提交事件协作。 | passed | `requirements.md` |

## 3. 当前生效数据与安全不变量

- 正式 profile 为 version `3`，最新迁移 `0009-m2-task-management`；只允许前向迁移，生产迁移前需要一致备份，失败后 roll forward 或恢复迁移前备份。
- Project/Membership/Role 继续是成员和权限权威；Task 保存显式 Owner，有效 Owner 从最近显式祖先派生。评论/活动/通知投影不成为第二业务权威。
- Task、Graph、Workspace、影响集合和幂等条件共同保护写入；Audit/Outbox 与业务状态同事务，Worker/SSE 至少一次且下游幂等。
- 公开请求不接受可信 actor/admin/project ID；Admin Mode 不授予他人 Task Workspace 写入权，不绕过完成冻结、精确 Key 或唯一租约。
- 任务数据、评论与 Workspace 文本按不可信输入处理；秘密和不必要正文不得进入日志、审计或 SSE。

## 4. 当前生效验收

| 当前编号 | 层级 | 当前生效验收 | 结果 | 来源 |
| --- | --- | --- | --- | --- |
| `AC-001` | core | version 2→3 前向/空库/重复/异常回滚保持既有数据、ID、Key 和历史，异常 fail closed。 | passed | `requirements.md` |
| `AC-002` | core | `/api/v1`/OpenAPI 完整读取与创建/更新 M2 Task 字段，Task Key/UTC/角色/标签/展示类型稳定且 M1 不回归。 | passed | `requirements.md` |
| `AC-003` | core | 顶层 Owner、祖先继承、后代指派/清空与影响分支正确，Owner/Workspace/快照/租约原子。 | passed | `requirements.md` |
| `AC-004` | core | 成员移除稳定阻塞未完成有效 Owner，成功不改写 Owner/历史并撤销能力与租约。 | passed | `requirements.md` |
| `AC-005` | core | 虚拟根/普通父级唯一同级 DAG、依赖请求、stale/过期、图版本、授权/冻结/环检测均不可绕过。 | passed | `requirements.md` |
| `AC-006` | core | Follow 仅同项目一跳且不扩权、不递归、不改变其他权威事实。 | passed | `requirements.md` |
| `AC-007` | core | blocked 派生、状态/blocker 并发、`completion_ready` 与 Owner 通知幂等，父 Task 不自动完成。 | passed | `requirements.md` |
| `AC-008` | core | 完成条件、版本、Owner 固化、快照、冻结、租约、审计和 Outbox 同事务，故障只有完整前/后态。 | passed | `requirements.md` |
| `AC-009` | core | 完成冻结、`deny`/`cascade` 重开闭包、工作周期/旧快照和跨 Owner/stale 防护正确。 | passed | `requirements.md` |
| `AC-010` | core | 移动/归档/删除的完整影响、图并发、历史保留、完整 Key 和完成子树/外部端点拒绝正确。 | passed | `requirements.md` |
| `AC-011` | core | 每 Task 唯一 Workspace 及清单/版本/周期/快照/租约，生命周期原子边界由服务端证明。 | passed | `requirements.md` |
| `AC-012` | core | 评论生命周期、Workspace 引用、管理员隐藏、活动分页、关键通知及 Worker 去重正确。 | passed | `requirements.md` |
| `AC-013` | core | 普通/Owner/Admin Mode/有效 Owner 权限矩阵、完整影响、Workspace 隔离和 actor/admin/Agent 防伪正确。 | passed | `requirements.md` |
| `AC-014` | core | 成功/失败审计、Outbox、Worker 投影、精确 SSE、cursor、幂等、跨租户与重建正确。 | passed | `requirements.md` |
| `AC-015` | core | 全部关键并发和幂等操作只产生完整合法结果，陈旧条件返回稳定版本与恢复建议。 | passed | `requirements.md` |
| `AC-016` | core | 全部 Task 输入输出进入运行时 Schema/OpenAPI，错误不退化为 500，`actions` 服务端派生，既有 core 兼容。 | passed | `requirements.md` |
| `AC-017` | core | 深度 20、200 同级、200 DAG、5,000 Task 的递归/排序/分页/授权/完整性无硬限制、溢出或跨租户遗漏。 | passed | `requirements.md` |
| `AC-018` | core | format/lint/build/typecheck/test、PostgreSQL、根工程与适用发布门禁通过；无外部 API/AI/LLM 或秘密泄露。 | passed | `requirements.md` |
| `AC-019` | supplemental | 列表/详情 P95 <500 ms，创建/更新/200 DAG <800 ms。 | passed | `requirements.md` |
| `AC-020` | supplemental | 浏览器和参考发布补充验证增加置信度，异常只在独立证明无交付影响时可 report-only。 | passed | `requirements.md` |

## 5. 当前交付与后续变更规则

- 当前没有开放 `FND-*`、unresolved question 或 blocked gate。
- M2 initial 的路线图、阶段计划/结果、执行状态和 `change-0.md` 是连续冻结记录。
- 任何 M2 行为、范围、接口、数据、安全或验收变化必须使用 `$apply-feature-change` 创建 `change-1` 及其连续证据；不得改写本快照的来源记录。
- M3–M6 必须作为各自独立功能工作流推进，并继续复用本快照中的 Task/Graph/Owner/Workspace/权限/审计不变量。
