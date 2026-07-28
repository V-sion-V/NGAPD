# M1 initial run：P-003 阶段结果

- 运行编号：`initial`
- 阶段：`P-003`
- 阶段计划：[`phase-003-plan.md`](phase-003-plan.md)
- 阶段计划修订：`1`
- 父路线图修订：`1`
- 需求指纹：`sha256:f3ab380a2826c494223aff7b3c7ae7c9e8904d8d2ddf2ad0392adb26488020d8`
- 路线图指纹：`sha256:94c85511348f628b1c0edb0d6133f4b3ca453d91815fbd306f45f7e529a5de22`
- 阶段计划指纹：`sha256:e818fc35eb1fc8f6ce77cd331089e3b9f52332e0b0c491e14c511d176b02063a`
- 完成时间：`2026-07-29T02:28:28+08:00`
- 状态：`completed`
- 交付与验证策略：`relaxed`
- 验证结论：`passed`
- 开始基线：分支 `requirements/m1-project-role-members`，提交 `f9efee992394f1b6761182237cf736f79561ad5b`；P-001/P-002 为同一未提交工作树上的 immutable completed/passed 成果
- 结束基线：同一分支与提交上的未提交工作树；未 commit、push、reset、checkout 或 stash，保留用户 requirements/workflow contract 与全部 P-001/P-002 产出

## 1. 阶段目标与结果

P-003 已在 P-002 冻结的共享 DTO、完整 `/api/v1`、服务端授权、审计、Outbox 和 SSE 边界上完成 M1 最终交付表面：

- React Web 保留注册、登录、登出、设备配对、设备撤销和精确 `?prototype=task-ui` 入口，并新增中文认证后 shell、Unicode 首字素头像、个人资料、默认模板、项目创建/列表/打开和精确 Project Key 加入。
- 项目详情通过真实公共 API 完成申请批准/拒绝/再次申请、成员自助资料和角色绑定、Owner/Admin 治理、Admin 任免、成员移除 preview/阻塞/成功、Owner Transfer 全动作、项目归档/解除归档、Admin Mode 及 Project Role create/edit/copy/archive。
- Web 只以服务端 `actions` 控制呈现；最终授权仍由当前 Web Session、Project、活动 Membership、Admin Mode 和资源版本决定。Role 文本、Membership ID、本地角色或按钮可见性均不授权。
- Admin Mode ID 只存在于当前 React 内存并绑定当前项目；普通读取不续期，关闭、过期、归档、降权、移除、Transfer、登出和服务端拒绝均使本地能力失效。
- 版本冲突显示服务端 `currentVersion` 与恢复建议并重新获取权威资源；一次用户意图复用同一幂等键，新的明确意图才生成新键。SSE 只触发最小 refetch，不承载业务事实。
- 危险操作确认展示目标、当前状态、后果和 blocking task；状态不只靠颜色，表单有明确 label/error 关联，确认对话框和恢复提示有可预测焦点，390×844 窄屏无 document overflow。
- 六份活动正式设计文档已统一到正式 profile version 2/`0008-m1-project-role-members`、完整 M1 API/Web/审计/Outbox/SSE、成员移除保留 Task Owner 并由未完成有效 Owner 阻塞，以及“角色名称 + 单一能力/Agent 提示文本”模型。README 经核查无需修改。

P-003 完成 FR-042、FR-047，并以最终 Web、真实 API/PostgreSQL、工程和文档门禁收口 FR-001–FR-047、AC-001–AC-029。P-001/P-002 的 Contracts、Domain、Database、API、Worker 和 immutable results 均保留；P-003 没有新增 Schema、公共 Task CRUD、外部 API/AI/LLM、生产依赖或第二套权限权威。

## 2. 任务、需求与验收覆盖

| 任务 | 状态 | 阶段范围 | 完成结果 |
| --- | --- | --- | --- |
| `P-003-T-001` | completed | FR-042 的 Web 基础、Profile/Project/Join 和既有入口兼容；AC-023 的基础交互 | same-origin API/error、query keys、幂等意图、SSE refetch、中文 shell、Profile/模板/Project/Join、Pairing/Device/prototype 完成；V-010 passed |
| `P-003-T-002` | completed | FR-042 的完整项目治理和可访问性；AC-023 端到端闭环 | 申请、成员、Admin、移除、Transfer、Admin Mode、Role 和项目生命周期通过真实 API 与多身份浏览器完成；V-011 passed |
| `P-003-T-003` | completed | FR-047、最终集成/发布与 AC-028/AC-029 supplemental | 六份活动正式文档同步；V-012/V-013/V-016 passed，V-014/V-015 按环境适用性记为 `not_run`；最终运行收口条件满足 |

阶段退出不变量全部满足：

- Web 不根据本地角色、Role 名称/文本、Membership ID、颜色或按钮可见性推断授权；所有 mutation 由服务端重新授权并校验当前版本。
- Admin Mode 不跨会话或项目、不由普通读取续期、不写入 local/session storage；受保护 header 只用于当前项目的明确治理写入。
- Project/Membership/Role/Transfer 的版本来自权威响应；403/409/410 后 refetch 并展示稳定恢复信息，不自动改成其他动作。
- 项目说明、成员介绍和 Role 能力文本按不可信文本显示；Web 没有 `dangerouslySetInnerHTML` 或客户端 Markdown 执行面。
- Identity、Pairing、Device、Workspace、SSE、内部 Task、Worker、Workspace CLI 和 Task UI prototype 保持兼容；没有开放公共 Task CRUD。
- 活动正式文档已消除成员移除时清空 Task Owner 和多字段 `ROL-004` 旧结论；M0、其他 feature 和 P-001/P-002 封存记录无 diff。

## 3. 文件修改

| 文件或范围 | 修改模式 | 主要目的 |
| --- | --- | --- |
| `apps/web/src/App.tsx`、`styles.css` | modify | 保留原入口并组合 M1 中文 shell、响应式布局、可见焦点和非颜色状态 |
| `apps/web/src/api.ts`、`api.test.ts`、`App.test.ts` | add | same-origin API、稳定错误、Admin Mode header 边界与入口兼容 |
| `apps/web/src/m1/model.ts`、`query.ts`、`sse.ts` 及目标测试 | add | 中文状态、Unicode 首字素、幂等意图、稳定 query key、SSE refetch 与倒计时纯逻辑 |
| `apps/web/src/m1/M1App.tsx`、认证/Profile/Project/Join/Access 组件 | add | 认证后导航、资料、模板、项目、精确 Key 加入和既有 Pairing/Device |
| `apps/web/src/m1/ProjectGovernance.tsx`、`AdminModePanel.tsx`、`JoinRequestsPanel.tsx`、`MembersPanel.tsx`、`OwnershipPanel.tsx`、`RolesPanel.tsx`、`DangerousAction.tsx` | add | 完整项目治理、危险确认、恢复、焦点和可访问性闭环 |
| `docs/01-product-requirements.md`、`02-domain-model.md`、`03-permission-model.md`、`04-system-architecture.md`、`07-roadmap-and-validation.md`、`08-decisions-and-open-issues.md` | modify | FR-047：同步 M1 正式实现、成员移除、角色模型、API/Web、里程碑和被取代决策 |
| `apps/api/src/m1.integration.test.ts` | test-only adjust | 最终门禁把 Outbox 投影 cutoff 固定为远未来，避免测试在日历跨日后以旧固定 `now` 错误排除 PostgreSQL 当前 `available_at`；不改变生产代码或产品语义 |
| `AGENTS.md` | modify | 持续同步 P-003 任务和 M1 最终状态 |
| `docs/requirements/m1-project-role-members/execution/initial/execution-state.md` | update | T-001–T-003 检查点、有效/无效验证、恢复、finding 与最终协调状态 |
| `docs/requirements/m1-project-role-members/execution/initial/phase-003-result.md` | add | 本 immutable completed/passed 阶段结果 |

`apps/web/package.json` 与 `pnpm-lock.yaml` 未变；未新增测试、路由、状态管理或权限框架依赖。README 经核查仍与产品边界、命令和阶段事实一致，无需修改。

## 4. 测试与验证

最终有效证据使用 Node.js `24.18.0`、pnpm `11.9.0` 和 PostgreSQL `17.10`。隔离实例绑定 `127.0.0.1:55439`，浏览器数据库为 `ngapd_p003`，最终根门禁数据库为 `ngapd_p003_check`；正式迁移首次与重复运行均到 profile version 2、8 migrations、latest `0008-m1-project-role-members`，系统模板为 74。

| 验证 | 方法 | 最终结果 |
| --- | --- | --- |
| V-010 Web 基础 | `@ngapd/web` test/typecheck/build，目标 ESLint/Prettier | passed；4 files/14 tests，90 modules；Profile/Project/Join、API 恢复、幂等/query/SSE 与既有入口兼容 |
| V-011 治理/可访问性 | 真实 PostgreSQL 17、API/Web/Worker；Owner/Admin/Member/Applicant 浏览器；Web 静态门禁 | passed；治理矩阵、SSE 降权、陈旧版本恢复、危险确认/焦点/非颜色状态、390×844 和 console 均通过；最终 Web 4 files/16 tests、97 modules |
| V-012 文档一致性 | 六份活动文档 stale-term 搜索、README 核查、其他封存 feature diff、目标 Prettier 和 `git diff --check` | passed；最终实现与活动文档一致，封存证据无改写 |
| V-013 migration/toolchain | `ci:verify`；`ngapd_p003_check` 首次及重复 `db:migrate`；Schema profile 只读摘要 | passed；Node/pnpm/DB gate 正确，迁移首次 0001–0008、重复 no-op，profile version 2、8 migrations、74 templates |
| V-013 最终根门禁 | 已授权 Windows `C:\tmp`/PasswordVault；显式 `DATABASE_TEST_URL`；从头 `pnpm check` | passed；format、lint、全部 packages/apps build、10 workspace typecheck；273 tests passed、0 failed、7 platform-conditional skipped |
| 根门禁 API/Worker | 根运行中的完整 API/Worker 套件 | passed；API 9 files/27 tests，真实 Windows 双 CLI 两轮 108.11 秒，small sync 1507.19/1514.46ms；Worker 2 files/4 tests |
| V-013 路由/安全/所有权 | OpenAPI/M1 integration、same-origin、稳定错误、added-line 外部调用/reset/secret/transient 搜索、Git/指纹/进程检查 | passed；无外部 API/AI/LLM、秘密持久化/日志、生产 reset/down、临时产物、封存改写或活动未知进程 |
| V-014 Compose | 当前主机 `docker`/`podman` 可用性检查 | `not_run`；主机无 Docker/Compose 或 Podman，未把跳过声明为发布通过 |
| V-015 参考 P95 | 参考服务器/正常内网或 VPN 可用性检查 | `not_run`；当前没有参考服务器或可用目标，未伪造 AC-028 性能数据 |
| V-016 有界额外诊断 | PostgreSQL `project-membership-repository.integration.test.ts` 单文件 | passed；1 file/6 tests、986ms，额外覆盖真实行锁、幂等并发、成员移除/Task Owner、归档/lease 与治理完整性 |

最终根测试分布为 Contracts 12、Domain 68、Workspace Core 27、Workspace CLI 25、Database 47、ObjectStore 7、fixtures 40、API 27、Web 16、Worker 4，共 273 passed；Workspace CLI 有 7 个非当前平台条件测试 skipped。全部 core/硬门禁适用项通过；V-014/V-015 的 `not_run` 由合同允许且不冒充 passed。

## 5. 发现项与处置

当前无开放 `FND-I-*`；下一可用 ID 仍为 `FND-I-001`。

| ID | 类别 | 严重程度 | 关联需求/验收 | 观察与证据 | 最终功能影响 | 处置 | 置信度 | 建议后续 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |

V-014/V-015 是已批准的环境适用性 `not_run`，不是产品异常或 report-only finding。V-016 通过。没有 critical/high、安全、隐私、数据、兼容、构建、运行、未知影响或 core 异常，因此验证结论为 `passed`，不是 `passed_with_findings`。

## 6. 决策、计划偏差与恢复记录

- 沿用用户明确选择的 `relaxed` 策略；没有降低任何 core、安全、隐私、数据、兼容、构建、恢复或适用发布门禁。
- 三个任务严格按 `P-003-T-001 → T-002 → T-003` 执行；V-010 通过后才进入治理，V-011 通过后才修改活动正式文档。
- P-003 无生产后端修改。唯一后端文件变化是 `m1.integration.test.ts` 的测试时间 cutoff：原固定 `2026-07-28T16:00:00Z` 在测试跨日后早于 PostgreSQL 默认 `available_at`，使已正确创建的 Outbox 被证据投影错误排除；固定远未来 cutoff 后目标文件 3/3 与最终 API 27/27 通过。
- 一次手工 Pairing 补充诊断的后台启动器保留日志句柄并等待超时；该尝试不计门禁。已精确停止两个 CLI Node 进程并删除 harness，未产生凭据或生产 diff；Pairing/Device core 由 V-010 和 P-002 V-008/V-009 继续证明。
- V-013 sandbox 根运行已通过 format/lint/build/typecheck 及非 Windows 特权相关套件，仅在固定 `C:\tmp`/PasswordVault 遇到 `EPERM`；一次已授权长运行被工具输出通道超时/EPIPE 截断，均不计结论。最终使用可观察日志与进程边界的同一根命令从头运行至 Worker 结束，全部套件通过。
- `pnpm test -- <file>` 一次被脚本参数规则解释为全 API 套件，在 sandbox 内只因 `C:\tmp` `EPERM` 失败；随后用 workspace 的 Vitest 可执行文件执行明确文件列表，所有目标测试通过。该无效尝试不计产品失败。
- V-014/V-015 按计划因环境不可用记录 `not_run`；没有安装 Docker、联系外部服务或扩大用户授权范围。
- 工作树始终保持未提交；没有覆盖用户 requirements/workflow contract，也没有 commit、push、reset、checkout 或 stash。

恢复边界：

- 正式数据库仍只允许前向迁移/roll forward；P-003 没有新增迁移、down 或自动 reset。
- 若后续发现 P-003 行为缺陷，不得改写本结果；应通过 `$apply-feature-change` 创建连续 change run。
- 临时 PostgreSQL、日志和浏览器/API/Web/Worker 环境只用于本阶段验证，最终必须精确停止和删除；不得假定 55439 或两个测试数据库继续存在。

## 7. 最终初始运行进入条件

- P-001、P-002、P-003 均有 immutable completed/passed result，且 requirements、roadmap、三份 plan/result 指纹一致。
- FR-001–FR-047、AC-001–AC-029 追踪完整；全部 core/硬门禁通过，V-014/V-015 如实 `not_run`，V-016 passed，无开放 finding。
- 可以在完整复读 workflow contract、requirements、roadmap、execution state、三份 plan 和三份 result 后生成 `effective-requirements.md` 与 `change-0.md`，并把 initial execution state 更新为 `completed/passed`。
- 初始记录生成后，本结果与 P-001/P-002 result 均不可修改；后续需求变化只能进入新的 change run。
