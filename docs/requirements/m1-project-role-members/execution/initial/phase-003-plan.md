# M1 初始实现 P-003：Web 闭环、正式文档与最终发布验收

- 运行编号：`initial`
- 阶段编号：`P-003`
- 阶段计划修订：`1`
- 父路线图修订：`1`
- 需求指纹：`sha256:f3ab380a2826c494223aff7b3c7ae7c9e8904d8d2ddf2ad0392adb26488020d8`
- 项目基线：分支 `requirements/m1-project-role-members`，提交 `f9efee992394f1b6761182237cf736f79561ad5b`；P-001/P-002 为未提交但均有 immutable `completed/passed` 结果的工作树
- 创建日期：`2026-07-28`
- 详细度：`expanded`
- 交付与验证策略：`relaxed`
- 验证结论：`pending`

## 1. 阶段目标、边界与关联需求

### 1.1 目标

在 P-002 已冻结的共享契约、完整 `/api/v1`、服务端授权、审计和 Outbox/SSE 边界上，完成 M1 的最终交付表面和验收收口：

- 把现有 React Workspace Access 页面扩展为中文账号、个人资料、项目、加入申请、成员、Owner Transfer、Admin Mode 和 Project Role 闭环，同时保留注册、登录、登出、设备配对、设备撤销与 Task UI prototype 入口。
- 只依据服务端资源、版本、`actions` 和 Admin Mode 状态呈现或提交操作；正确处理幂等键、版本冲突、恢复提示、SSE 失效和受保护操作的 Admin Mode header。
- 为头像占位符、Owner/Admin/Member、pending/removed、active/archived、角色归档和管理员模式提供颜色之外的文本或图形标识；所有表单和确认流程支持键盘、明确标签、错误关联和可预测焦点。
- 同步需求明确取代的活动正式产品、领域、权限、架构、路线和决策结论，不改写任何封存执行证据。
- 在所有生产改动完成后执行最终 Web/API/数据库/工程/发布门禁，收口 AC-028/AC-029 supplemental 证据和连续 `FND-I-*` findings，并为初始运行最终完成提供条件。

P-003 直接实现 FR-042、FR-047，并通过 Web 和最终集成验收覆盖 FR-001–FR-047；阶段门禁覆盖 AC-001–AC-029，其中 AC-001–AC-027 为 core，AC-028/AC-029 为 supplemental。

### 1.2 已验证前置

- `workflow-contract.md` 为 schema `3.2`；requirements 与 roadmap 指纹分别为 `f3ab380a...020d8`、`94c85511...5de22`，与执行状态一致。requirements 未变化且 roadmap revision 1 的 FR/AC 追踪完整，不需要修订路线图。
- P-001/P-002 的 immutable result 指纹分别为 `eb06f279...c255f`、`b2662ce5...ae5c`，均为 `completed/passed`。当前状态为 `awaiting_next_phase`，没有其他 `ready/in_progress/paused/blocked` 阶段，也没有 `change-0.md` 或冻结的初始历史。
- P-002 已交付 Profile、Project、Join Request、Membership、Ownership Transfer、Admin Mode、System Template 和 Project Role 的共享 DTO、稳定错误、完整公共路由、服务端 `actions`、OpenAPI、审计及 user/project audience Outbox/SSE；P-003 不需要发明客户端权限规则或临时 API。
- `apps/web` 当前只有一个 `App.tsx` Workspace Access 页面、全局样式和封存 Task UI prototype；使用 React 19、TanStack Query 5 和 Vite 7，尚无 M1 页面、通用 API/query 层或浏览器交互测试。现有页面已覆盖注册/登录、配对确认和设备撤销，必须保持兼容。
- P-003 相关 Web、README 和六份活动正式设计文档当前没有未记录的用户改动。工作树中的 Contracts/Domain/Database/API/Worker 与 AGENTS 变更均属于 P-001/P-002 已记录成果，不得被覆盖或回退。
- 活动正式文档仍保留“成员移除时清空未完成 Task Owner”和多字段 `ROL-004` 旧结论；精确受影响处已在 `docs/01`、`02`、`03`、`04`、`07`、`08` 中定位。M0 与其他 feature execution/result/change 记录保持只读。
- 当前主机未发现 Docker 命令，也没有已保留的 P-002 PostgreSQL 或参考服务器。实现必须新建显式隔离 PostgreSQL 17 目标；Compose 和参考服务器验证按 requirements 的环境适用规则记录，不能把未运行项写成通过。

### 1.3 阶段退出不变量

- Web 不根据角色名、能力文本、Membership ID、颜色、按钮可见性或本地管理员标志推断授权；服务端 `actions` 只用于展示，最终授权仍由每次请求的服务端会话、项目、Membership、Admin Mode 和版本决定。
- Admin Mode 只作用于当前 Web Session 和当前项目。客户端倒计时仅显示 `expiresAt`，普通读取/轮询不续期；只有明确受保护写入携带当前 `x-ngapd-admin-mode-id`，关闭、过期、资格变化、项目归档或服务端拒绝后立即清除本地能力状态。
- 每个危险或高权限动作在提交前展示目标、当前状态、后果和服务端影响预览（若有）；按钮防重复提交，但不能用客户端确认替代权限、版本或幂等校验。
- Project/Membership/Role/Transfer 的整数版本来自最新权威响应。创建和可重试写入按一次明确用户意图生成幂等键；网络结果不确定时复用同一键，新的用户意图使用新键。
- Project 说明、成员介绍和角色能力按不可信文本安全展示；不得通过 `dangerouslySetInnerHTML`、Prompt 内容或客户端 Markdown 扩展执行代码或影响授权。
- 注册、登录、登出、Pairing、Device、Workspace、SSE、内部 Task 与 `?prototype=task-ui` 持续兼容；P-003 不开放公共 Task CRUD，不修改 Schema/迁移或 P-001/P-002 immutable result。
- 活动正式文档统一采用“移除保留 Membership/Task Owner 且未完成有效 Owner 阻塞移除”以及“角色名称 + 单一能力/Agent 提示文本”结论；封存工作流证据不改写。
- `relaxed` 不降低任何 core、安全、隐私、数据、公共兼容、构建、恢复或适用发布硬门禁。下一 finding ID 保持 `FND-I-001`。

## 2. 任务与文件范围

### 2.1 任务

| 任务 | 结果 | 文件或范围 | 实现摘要 | 验证 | 完成条件 |
| --- | --- | --- | --- | --- | --- |
| P-003-T-001 | 形成可测试的 M1 Web 应用基础，并交付资料、项目、精确 Key 加入和既有设备兼容流程 | `apps/web/src/App.tsx`、新增 Web API/query/model/components、全局与 M1 样式、`apps/web/package.json`/`pnpm-lock.yaml`（仅当目标 DOM 交互测试需要）及目标 tests | 抽取 same-origin API/error 层、稳定 query keys、幂等意图和 SSE 失效处理；保留认证/设备和 Task UI prototype；增加可访问头像、个人默认资料、系统模板选择、项目创建/列表/打开、精确 Key 最小目标与申请流程；所有状态由共享 DTO 和服务端 `actions` 驱动 | V-010 | 登录前后、资料、项目和申请的成功/拒绝/版本恢复可经键盘完成；首字素头像有文本替代；设备配对/撤销和 prototype 入口保持；Web test/typecheck/build 通过 |
| P-003-T-002 | 通过真实 API 完成项目治理、成员、Owner Transfer、Admin Mode 和角色目录的完整中文可访问闭环 | `apps/web/src` 的项目详情、成员/申请、Ownership、Admin Mode、Role 组件与目标 tests；必要时只读引用 P-002 Contracts/OpenAPI | 增加项目状态与归档/解除归档、申请审批/拒绝、成员自助资料/角色绑定、Admin 任免、移除预览/阻塞清单/确认、Transfer 发起与接受/拒绝/取消、Admin Mode 开启/倒计时/关闭、角色创建/编辑/复制/归档；受保护请求只注入当前项目能力；错误后按 `currentVersion`/`recovery` 重新获取并恢复焦点 | V-011 | Owner、Admin、Member 和非成员多身份真实浏览器流程符合服务端矩阵；危险动作完整展示目标/状态/后果；关键状态不只靠颜色且键盘/焦点/错误关联通过；无客户端授权旁路 |
| P-003-T-003 | 活动正式文档、最终集成、发布与 supplemental 证据完成收口 | `docs/01-product-requirements.md`、`02-domain-model.md`、`03-permission-model.md`、`04-system-architecture.md`、`07-roadmap-and-validation.md`、`08-decisions-and-open-issues.md`、`AGENTS.md`，以及 `README.md`（仅在核查发现受影响时）、工作流状态/结果/最终记录 | 按 FR-047 同步成员移除、角色模型、M1 API/Web/里程碑事实和决策替代关系；在所有生产/文档改动后一次性完成根工程、真实数据库、适用 Compose、参考性能与额外规模诊断；连续汇总 findings，只有全部最终门禁满足后生成 P-003 result，并交给同一实施运行完成 `change-0.md`/`effective-requirements.md` | V-012–V-016 | 活动文档与实现一致且封存证据无 diff；全部 core/硬门禁通过；supplemental 通过、明确 `not_run` 或形成合格 finding；最终状态、初始记录和指纹可一致完成 |

依赖顺序：`P-003-T-001 → P-003-T-002 → P-003-T-003`。T-001/T-002 各自结束时保持 Web 可构建和既有入口可用；任一任务未完成或进入 paused/blocked 时不得开始下一任务。

### 2.2 预期文件所有权与接口

| 文件或范围 | 预期目的与接口约束 |
| --- | --- |
| `apps/web/src/App.tsx`、`main.tsx` | 保留 `?prototype=task-ui` 分支和 QueryClient 根；认证后进入 M1 shell，登出时清除全部用户/项目/Admin Mode query 与 SSE 状态 |
| `apps/web/src/api.ts` 或等价模块 | 集中 same-origin `fetch`、`ApiError`、JSON/无正文响应、Admin Mode header 和可中止请求；不记录密码、Cookie、能力 ID 或正文；不得在不同项目间复用 Admin Mode |
| `apps/web/src/m1/model.ts`、query/event 辅助与纯函数 tests | 服务端 action/status 到中文显示、Unicode 首字素、幂等意图、稳定 query keys、事件到 refetch 范围和倒计时显示；这些函数不得决定最终授权 |
| `apps/web/src/m1/*` React 组件与 DOM 交互 tests | 资料、项目、加入、成员、Transfer、Admin Mode、角色和危险确认；使用语义化 landmark/heading/form/dialog 或等价内联确认，明确 label、description、error、live status 和焦点恢复 |
| `apps/web/src/styles.css` 与 M1 局部样式 | 响应式桌面/窄屏布局、可见焦点、高对比文本和非颜色状态徽标；不得用 CSS 隐藏仍可聚焦的无权操作 |
| `apps/web/package.json`、`pnpm-lock.yaml` | 仅在现有 Vitest 无法验证真实 DOM 键盘/焦点/错误关联时增加最小 React DOM 测试依赖；不得引入第二套状态管理、路由或权限框架 |
| P-002 Contracts/OpenAPI/API 模块 | P-003 的只读公共兼容权威，预期不修改。若 Web 无法仅凭已冻结 DTO/路由完成任一 core 流程，停止当前任务并由 rolling planning 追加 corrective phase，不静默改写 P-002 结果 |
| 六份活动正式设计文档 | 分别同步产品 FR、LogicalRole/Membership 领域模型、权限矩阵、模块/API/事务架构、M1/M2 路线及验证、决策替代关系；只改当前活动结论 |
| `AGENTS.md`、`README.md` | AGENTS 在阶段进入和完成时更新真实状态；README 先核查，只在产品边界、命令或阶段声明确实失真时修改 |

### 2.3 Web 资源与交互边界

- 认证与资料：继续使用 `/api/v1/auth/*`、Pairing/Device 路由；Profile 使用 `GET/PATCH /api/v1/users/me/profile`。头像由 `displayName` 首个可显示 Unicode 字素派生，并同时给出“某某的头像占位符”等文本替代。
- 项目入口：项目列表/创建/详情使用 `/api/v1/projects` 资源；加入只能先用精确 Key 的 `join-target`，再向 `/api/v1/membership-join-requests` 提交。不存在项目浏览目录。
- 项目治理：申请、成员、移除预览、权限、Transfer 与生命周期使用 P-002 已冻结子资源。UI 必须提交响应中的当前版本；移除确认必须显示 preview 的成员和阻塞 Task，存在阻塞时不能伪装为可提交。
- Admin Mode：从 Project detail 的当前状态进入；开启后只在当前项目持续显示范围、文本状态和到期时间。角色与他人资料写入携带能力 header；Owner 专属和成员自助操作不因模式存在而改道。
- 角色：系统模板只读；项目角色显示名称、单一能力/Agent 提示文本、来源和 active/archived 文本状态。归档保留历史绑定，新增绑定只列活动且服务端含 `bind` action 的角色。
- 实时与恢复：认证后连接 `/api/v1/events`，只把 `resource-invalidated` 当作重新获取提示；游标过期或重连先刷新当前资源。稳定 API 错误显示 `message`、`recovery`、`blockingTasks` 和适用的 `currentVersion`，不向用户暴露栈或秘密。

### 2.4 有序实施步骤

1. 开始 T-001 前把运行/P-003 置为 `in_progress`，记录当前 diff、Web/正式文档 before-state 和新的显式 PostgreSQL 17 测试目标；确认 P-001/P-002 immutable result 及 P-003 plan 指纹未漂移。
2. 先抽取 API/query/model 层和认证后 shell，再迁移现有 Pairing/Device UI；在兼容目标测试通过后增加 Profile、System Template、Project list/create/open 和精确 Key join。每个 mutation 成功后更新或失效最小 query 集，SSE 只触发 refetch。
3. T-002 先建立 Project detail 的当前 Membership/actions/Admin Mode 上下文，再按申请/成员自助、Owner 直接治理、Transfer、Admin Mode 保护操作和 Role 管理顺序接入。共享确认组件展示目标、当前状态和后果；每次失败保持用户输入，关联错误并把焦点移到恢复提示或首个无效字段。
4. 使用至少 Owner、Admin、Member/申请者身份和真实 API 验证跨会话状态变化。Admin Mode 关闭/过期/资格撤销、项目归档、成员移除和 Transfer 后必须清除或重取相关 query，不得凭旧按钮或缓存继续提交。
5. 只有 Web core 流程完成后开始 T-003。按 FR-047 修订六份活动正式文档，搜索并消除互相冲突的旧结论；不修改 `docs/requirements/*/execution` 中本运行之外的封存证据或任一 immutable phase result。
6. 所有生产和正式文档改动完成后执行一次最终目标门禁。先完成 Web/真实 API 和根工程验证，再根据可用环境执行 Compose、参考 P95 与额外规模诊断；失败只做必要修复/诊断重跑，不为了 relaxed 策略追加无来源的重复全量检查。
7. 全部 core/硬门禁通过后写 immutable `phase-003-result.md`。随后按 implementation skill 的最终门禁完成 `change-0.md`、`effective-requirements.md` 和 execution state；若出现合格 report-only finding，使用 `FND-I-001` 起的连续 ID 在所有最终证据中一致汇总。

## 3. 验证与完成条件

### 3.1 验证项

| 验证 | 层级 | 内容 |
| --- | --- | --- |
| V-010 | core | `@ngapd/web` 目标 test/typecheck/build；覆盖 API 错误恢复、Unicode 首字素、幂等意图/query 失效、注册/登录/登出、Profile、模板、Project list/create/open、精确 Key join，以及 Pairing/Device/Task UI prototype 回归 |
| V-011 | core | 使用真实 PostgreSQL 17 与真实 API/Web 的多身份浏览器验收；覆盖申请审批/拒绝/重新申请、成员自助资料/角色、Admin 任免、移除 preview/阻塞/成功、Transfer 全动作、Admin Mode 范围/关闭/过期/失效、角色 CRUD/copy/archive、项目归档/解除归档、SSE refetch、稳定错误恢复、键盘/焦点/label/error 关联及非颜色状态 |
| V-012 | core | FR-047 文档一致性核查：`docs/01`、`02`、`03`、`04`、`07`、`08`、AGENTS/README（如受影响）与最终实现一致；活动文档不再声称移除时清空 Task Owner或保留多字段 `ROL-004`；M0/其他封存 execution/result/change 记录无 diff |
| V-013 | core | 所有生产改动完成后，在仓库规定 Node 24、pnpm 11 和显式 PostgreSQL 17 上运行一次根 `pnpm check`；同时核查路由/OpenAPI/Schema profile、无新增外部 API/AI/LLM、无秘密持久化/日志、无生产 reset/down、工作树所有权与临时进程 |
| V-014 | 条件性 core 发布门禁 | 若有可用 Linux Docker/Compose 环境，运行适用的 `pnpm compose:smoke`，验证迁移、API/Worker/Web/Gateway/PostgreSQL 健康、非 root、内部网络、持久卷和无应用外连；若环境不可用，必须记为 `not_run` 及原因，不能写成 passed |
| V-015 | supplemental | 在可用参考服务器/正常内网或 VPN 下采集常规 M1 读写 P95，对照 AC-028；无参考环境时明确 `not_run`。仅当异常被独立证明不影响 core 交付时可登记 `FND-I-*` |
| V-016 | supplemental | 在 core 证据之外执行一次有界的超主体规模、随机并发或锁/查询计划诊断以覆盖 AC-029；任何安全、数据、构建、未知影响或 core 新异常立即转为 blocking |

V-010/V-011/V-013 是 P-003 必需门禁。V-014 的适用性由执行环境决定，但未运行不能冒充通过；V-015/V-016 按 `relaxed` findings 规则收口。验证应在结果仍有效的最晚位置运行一次，后续修改若能使证据失效则只重跑受影响项及最终根门禁。

### 3.2 完成门禁

- P-003 三个任务均有前后检查点，实际文件、浏览器场景、环境适用性和任何计划偏差均已记录。
- V-010–V-013 全部通过；V-014 已通过或按 requirements 明确记录不可用环境与 `not_run`，没有把跳过项扩写为发布通过。
- AC-023 的所有 Web 流程可通过公共 API 端到端完成；现有 Identity/Pairing/Device/Workspace/SSE/Web/内部 Task 和 Task UI prototype 保持兼容。
- 所有关键状态均有文本/图形标识；键盘、焦点、标签、错误关联和危险动作后果满足 core；不可信文本不执行，Admin Mode 不跨会话/项目或客户端续期。
- 六份活动正式设计文档、AGENTS 和受影响 README 与最终规则一致；没有改写 P-001/P-002 result、M0 或其他封存证据。
- Node/pnpm、Web/API、真实 PostgreSQL、格式/静态检查/构建/类型/测试与适用发布硬门禁没有 failed、unknown-impact 或未证明 core 异常。
- AC-028/AC-029 为 passed、明确 `not_run`，或仅保留经独立证据证明不影响交付的连续 `FND-I-*` report-only finding；critical/high 或安全、隐私、数据、兼容、构建/运行、未知影响、必需门禁异常始终阻塞。
- 仅在以上条件满足后创建 `phase-003-result.md`，随后完成 `change-0.md`、`effective-requirements.md`、最终执行状态和全部指纹；不能仅因 P-003 代码完成就宣称 initial run 完成。

## 4. 风险、恢复与修订记录

### 4.1 风险控制

| 风险 | 预防与检测 | 失败后的安全状态 |
| --- | --- | --- |
| Web 根据本地角色或旧 `actions` 扩权 | 所有 mutation 由服务端重新授权；客户端 action 只控制呈现，403/409/410 后立即 refetch 并显示恢复建议 | 保留服务端拒绝，不重试为不同操作；当前任务 `in_progress`，修正缓存/呈现后重跑目标场景 |
| Admin Mode 跨项目泄漏、倒计时续期或资格撤销后仍使用 | query key 包含 session/project/capability；普通 GET 不续期；受保护写后重取，登出/归档/降权/移除/Transfer 清除能力 | 清除本地能力 ID并回到普通模式；服务端拒绝是权威，不以本地时钟恢复 |
| 多步骤治理使用陈旧版本或重复产生资源 | 显示当前版本、按钮 pending 锁、一次用户意图一个幂等键；网络结果不确定时以同键查询/重试 | refetch 权威资源并保留表单；不得自动生成新键掩盖未知提交结果 |
| 危险确认或状态只靠颜色，键盘/焦点无法完成 | 共享语义确认模式、文本徽标、可见 focus、label/description/error ID 和 DOM 交互测试；真实浏览器只用键盘走关键流程 | 阻塞 AC-023；保留页面可读状态，修正组件后重跑可访问场景 |
| P-003 发现 P-002 DTO/API 无法支撑 core | 开始前已核对完整 route/DTO；P-003 把 Contracts/API/Database 设为只读兼容边界 | 停止当前任务并记录缺口；不得改写 P-002 result，使用 rolling planning 追加 corrective phase |
| 活动文档修订误改封存证据或仍有互相冲突的旧规则 | 精确限定六份活动文档，前后做 stale-term 搜索与封存路径 diff | 恢复仅限本任务文档 patch；保持 T-003 `in_progress`，不得生成最终记录 |
| 当前主机无 Docker/参考服务器 | 计划前已记录环境事实；把 Compose 设为条件性 core、P95 为 supplemental，并区分 passed/not_run/finding | 不伪造验证；记录环境和影响，core 本地门禁继续完成，按合同决定最终结论 |
| P-001/P-002 未提交成果被 Web/文档任务覆盖 | 每个任务前核对 git diff 与 immutable result，生产后端默认只读；新增依赖只机械更新 Web importer/lock | 立即暂停并保留现场；不 reset/checkout/stash，不在不明重叠上继续 |

### 4.2 恢复与回退

- P-003 不包含数据库迁移。正式数据库仍只允许 version 2/`0008` roll-forward 或经用户确认的备份恢复，不运行自动 down/reset。
- Web mutation 以服务端事务为恢复边界；客户端中断后重新获取权威资源。对于网络结果不确定的幂等写入，恢复时复用原幂等键，不以新请求制造第二结果。
- Admin Mode 只保存在当前运行内存/query cache，不写 localStorage；页面刷新可从 Project detail/能力 GET 恢复，登出必须完全清除。
- 若任务中断，保留 execution state 中的当前任务、最后通过验证和显式测试数据库目标。仅在确认无活动进程且路径属于任务临时范围后清理可再生环境。
- 已完成 P-001/P-002 结果不可修改。P-003 中发现的后端缺陷、产品冲突或 public compatibility 缺口由后续 corrective phase 处理。

### 4.3 精确恢复起点

首次执行从 `P-003-T-001` 开始：读取本计划、`execution-state.md` 和 immutable `phase-002-result.md`，核对 requirements/roadmap/P-001/P-002 result/P-003 plan 指纹与 `git status`，确认 `apps/web` 和六份活动正式设计文档仍无用户重叠；把运行和 P-003 置为 `in_progress`，记录新的显式 PostgreSQL 17 隔离目标，然后先抽取 Web same-origin API/query/model 层并为现有认证、Pairing、Device 与 Task UI prototype 建立兼容测试。若状态中已有任务检查点，只从记录的未完成步骤恢复。

### 4.4 修订记录

| 修订 | 日期 | 变更 | 原因与影响 |
| --- | --- | --- | --- |
| 1 | 2026-07-28 | 首次 P-003 expanded rolling plan | P-002 已 completed/passed 且指纹无漂移；沿用 roadmap revision 1 的公共 Web 兼容、最终发布与多文档一致性风险，不改变路线图修订或 FR/AC 追踪 |
