# M1：项目、角色和成员当前有效需求

- 派生状态：可重新生成
- 原始需求：[`requirements.md`](requirements.md)
- 已应用至修改记录：[`change-0.md`](change-0.md)
- 生成日期：2026-07-29
- 当前交付与验证策略：`relaxed`
- 当前验证结论：`passed`

## 1. 当前目标与范围

当前有效目标是在既有本地账号、Session、Project/Task/Workspace 基线上提供完整 M1 项目、角色和成员闭环：开放注册用户可维护个人默认资料，以唯一 Project Key 创建或精确申请项目；Owner、Admin 和 Member 按服务端矩阵治理 Membership、Owner Transfer、Admin Mode 和 Logical Role；React Web 与 `/api/v1` 复用同一领域、事务和权限权威。

当前范围包括个人资料与可访问头像占位符、项目创建/列表/详情/归档、加入申请、保留式 Membership、成员资料/权限、有效 Task Owner 移除阻塞、重新加入、Owner Transfer、会话/项目绑定 Admin Mode、系统模板和项目角色、版本/幂等、审计、Outbox/SSE、前向 `0008` 迁移、中文 Web 与既有 Identity/Pairing/Device/Workspace/内部 Task 兼容。

当前范围不包括邮箱、邮件验证、密码重置、头像上传、邀请、项目公开目录、通知/评论、M2 Task UI、Workspace 本地同步、Agent 业务写工具、备份恢复、分布式基础设施、外部 API、AI 或 LLM。

## 2. 当前生效功能需求

| 当前编号 | 当前生效内容 | 当前状态 | 来源 |
| --- | --- | --- | --- |
| `FR-001` | 保持开放本地账号注册、登录、登出；登录名按 NFKC/大小写无关唯一且不可修改，密码边界和 Argon2id/认证最小披露不变。 | passed | `requirements.md` |
| `FR-002` | 注册事务原子创建 User、唯一用户 Workspace 和初始版本，并签发兼容 Web Session；失败不留半账号。 | passed | `requirements.md` |
| `FR-003` | 用户可维护 `display_name`、`default_introduction` 和去重的系统模板默认集合；字段长度、Markdown 文本和模板存在性受运行时校验。 | passed | `requirements.md` |
| `FR-004` | Web 从当前显示名首个可显示 Unicode 字素派生有文本替代的头像占位符；不保存头像文件、URL 或上传状态。 | passed | `requirements.md` |
| `FR-005` | 用户只能修改自己的默认资料；默认资料只在首次加入时初始化项目成员资料，二者之后不自动同步。 | passed | `requirements.md` |
| `FR-006` | 活动认证用户可用唯一 `[A-Z]{2,6}` Project Key、名称和说明幂等创建项目，默认完成后 successor reopen 策略为 `deny`。 | passed | `requirements.md` |
| `FR-007` | 项目创建原子产生 Project、Owner Membership/权威字段、虚拟根、项目 Workspace/初始版本和全部系统模板快照；失败或重试不产生半项目或重复资源。 | passed | `requirements.md` |
| `FR-008` | 活动成员可列出/打开自己的项目和目录；非成员不能枚举，精确 Key join-target 只披露 Key、名称和是否接受申请。 | passed | `requirements.md` |
| `FR-009` | 只有 Owner 可用当前版本直接归档/解除归档；归档后已有成员只读、项目范围写和新租约拒绝，既有租约和 Admin Mode 失效。 | passed | `requirements.md` |
| `FR-010` | 解除归档恢复 `active`，但不恢复旧租约、管理员能力、拒绝申请或移除成员，也不构成备份恢复。 | passed | `requirements.md` |
| `FR-011` | 已认证非活动成员只可用精确 Project Key 对活动项目幂等申请；无项目目录或邀请，同一用户/项目最多一个 pending 申请。 | passed | `requirements.md` |
| `FR-012` | 首次申请建立或复用唯一 Membership，置为 `pending/member`；申请人批准前不能读取项目详情、Workspace 或目录。 | passed | `requirements.md` |
| `FR-013` | 只有当前 Owner 可直接批准/拒绝；批准重查版本，首次批准激活 Membership、复制当时默认介绍并绑定对应活动模板快照。 | passed | `requirements.md` |
| `FR-014` | 拒绝保留审计和唯一 Membership 并置为 `removed`；再次申请在同一 Membership 的 `removed → pending → active` 上演进。 | passed | `requirements.md` |
| `FR-015` | 活动成员可直接维护自己的项目介绍和去重活动角色绑定；个人默认资料后续变化不改写项目资料。 | passed | `requirements.md` |
| `FR-016` | Owner 可直接任免活动成员 Admin，不以 `permission_level` 表达 Owner；权限变化与 Workspace 租约和 Admin Mode 失效原子协调。 | passed | `requirements.md` |
| `FR-017` | Owner/Admin 编辑他人介绍或角色绑定必须有活动 Admin Mode；未开启模式的 Admin 与普通 Member 相同。 | passed | `requirements.md` |
| `FR-018` | 只有 Owner 可直接发起成员移除且不能移除自己；请求携带当前 Project/Membership 版本并先返回可判定影响预览。 | passed | `requirements.md` |
| `FR-019` | 移除前按显式和继承有效 Owner 检查全部启用态未完成 Task；任一命中整体拒绝并返回稳定 Task Key/ID，完成 Task 和归档顶层子树不阻塞。 | passed | `requirements.md` |
| `FR-020` | 合格移除保留同一 Membership、介绍、角色、审计和全部 Task Owner 引用，只置为 `removed/member`；不清空或替换 Task Owner。 | passed | `requirements.md` |
| `FR-021` | Membership/Admin/租约/Admin Mode/audit/Outbox 在同一业务事务协调；失败不留半移除或残余能力。 | passed | `requirements.md` |
| `FR-022` | `pending/removed` Membership 无项目读写、租约、新 Task Owner 或成员操作资格；非活动有效 Owner 的 Task Workspace 只读。 | passed | `requirements.md` |
| `FR-023` | 正常路径不产生 removed Membership 有效拥有启用态未完成 Task；历史异常只可由活动 Admin Mode 修复普通数据或显式 Owner，恢复前 Workspace 不可写。 | passed | `requirements.md` |
| `FR-024` | 引用 removed Membership 的完成 Task 继续冻结；只能在活动 Admin Mode 下按正式 reopen、活动显式 Owner、项目策略和完整影响确认继续工作。 | passed | `requirements.md` |
| `FR-025` | 重新批准复用同一 Membership，保持 Member、介绍、角色和 Task Owner 引用，不重复制个人默认资料；完成冻结和唯一租约仍生效。 | passed | `requirements.md` |
| `FR-026` | 只有当前 Owner 可向同项目另一活动成员发起 Owner Transfer；同项目最多一个 pending 请求。 | passed | `requirements.md` |
| `FR-027` | 当前 Owner 可取消，目标可接受/拒绝，请求不自动过期；任一绑定事实或版本变化使旧请求稳定失效。 | passed | `requirements.md` |
| `FR-028` | 接受时重查项目、当前 Owner 和目标活动状态，只更新 `owner_membership_id`；双方 `admin/member` 值不自动改变。 | passed | `requirements.md` |
| `FR-029` | Owner Transfer 与 Project 版本、Owner 能力、Workspace 资格/租约、Admin Mode、audit/Outbox 原子协调，任何可提交状态恰有一个活动 Owner。 | passed | `requirements.md` |
| `FR-030` | 活动 Owner/Admin 只能为当前 Web Session 和当前项目显式开启服务端签发的 Admin Mode；资格不会自动开启，Web 持续显示范围和状态。 | passed | `requirements.md` |
| `FR-031` | Admin Mode 30 分钟无操作过期；关闭、登出、Session/账号/Membership/Admin/项目状态或项目不匹配立即失效。 | passed | `requirements.md` |
| `FR-032` | Admin Mode 开关/过期/拒绝/失效均审计；每个受保护操作重新检查 Session、Project、Membership、资格、能力和版本。 | passed | `requirements.md` |
| `FR-033` | Owner 专属治理无需 Admin Mode；Owner/Admin 编辑角色目录或他人资料需 Admin Mode；成员只直接编辑自己。 | passed | `requirements.md` |
| `FR-034` | Admin Mode 不授予跨项目访问，不绕过 Workspace 资格/唯一租约、完成冻结、Owner 专属操作或 Role 不授权原则。 | passed | `requirements.md` |
| `FR-035` | 系统模板不可编辑，只有 `id/title/desc`；`desc` 同时是完整能力和 Agent 提示，不引入独立 level/responsibility/limitation/task hint/prompt 字段。 | passed | `requirements.md` |
| `FR-036` | 项目创建为每个系统模板复制独立项目角色，保留来源、名称、能力、状态和版本；系统模板后续变化不覆盖既有快照。 | passed | `requirements.md` |
| `FR-037` | Owner/Admin 在活动 Admin Mode 下可创建、编辑、复制、归档项目角色；项目角色为名称加单一能力/Agent 提示文本。 | passed | `requirements.md` |
| `FR-038` | 归档角色保留历史绑定和 Task 引用，拒绝新绑定/新 Task 修改且不可原地恢复；可复制为新的活动角色。 | passed | `requirements.md` |
| `FR-039` | 活动成员可绑定零到多个去重角色；绑定、名称、能力、来源和任何字符串都不授予 Web、Workspace、Agent 或 Admin 权限。 | passed | `requirements.md` |
| `FR-040` | M1 HTTP 位于 `/api/v1`，使用共享 TypeBox 和 OpenAPI 3.1；资源写带版本/条件，可重试治理写支持幂等。 | passed | `requirements.md` |
| `FR-041` | 公共能力覆盖资料、项目、join-target/申请、成员、Admin、Transfer、Admin Mode、系统模板和项目角色，并返回调用者 `actions`/Admin Mode 状态。 | passed | `requirements.md` |
| `FR-042` | 中文 Web 对应公共 API 并保留注册、登录、设备配对/撤销；危险动作展示目标/状态/后果，头像/Admin Mode/归档/移除不只靠颜色。 | passed | `requirements.md` |
| `FR-043` | 账号和全部 M1 治理成功/失败尝试写不可变审计，包含 actor/type、project、target、request ID、时间、前后版本、结果和稳定原因码。 | passed | `requirements.md` |
| `FR-044` | 成功写入通过既有 Outbox 产生资源失效事件；SSE 只通知 refetch，不承载业务提交或秘密。 | passed | `requirements.md` |
| `FR-045` | 保持 Identity、Pairing、Device、Workspace、SSE、Web 和内部 M0 Task 端口兼容，不破坏 SessionActor、Cookie、设备令牌或 Workspace I/O。 | passed | `requirements.md` |
| `FR-046` | `0008` 从空库和现有正式 Schema 前向保留数据，回填 User/Membership/Project/模板快照，不改写 Task Owner/状态、Workspace 版本、租约历史或审计。 | passed | `requirements.md` |
| `FR-047` | M1 新规则已同步产品、领域、权限、架构、路线和决策文档；旧“移除清空 Task Owner”和多字段 `ROL-004` 已替换，封存记录未改写。 | passed | `requirements.md` |

## 3. 当前流程

1. 用户注册/登录并维护显示名、默认介绍和系统模板默认集合；Web 显示有文本替代的 Unicode 首字素头像。
2. 活动用户幂等创建 Project，事务同时建立唯一 Owner、虚拟根、项目 Workspace/初始版本和 74 个角色快照；成员只能列出自己的项目。
3. 非成员以精确 Project Key 获取最小 join-target 并申请；Owner 批准/拒绝。首次批准复制当时默认资料，再次批准复用同一 Membership 并保留项目资料。
4. 成员自助编辑介绍/角色；Owner 直接任免 Admin。Owner/Admin 需显式为当前 Session/Project 开启 Admin Mode 才能编辑角色目录或他人资料。
5. Owner 先查看移除 preview；目标仍是任一启用态未完成 Task 的有效 Owner 时稳定阻塞，否则原子置为 `removed/member` 并保留资料、角色和全部 Task Owner。
6. Owner 发起单一 pending Transfer；Owner 可取消，目标可拒绝/接受。接受只切换唯一 Owner 字段并原子重算能力、租约和失效。
7. Owner 可归档/解除归档项目；归档保持成员只读并撤销项目范围能力/租约，解除归档不恢复旧能力。
8. 成功写入同事务产生 audit/Outbox；Worker 生成 user/project audience invalidation，Web SSE 只按提示 refetch 权威资源。

## 4. 当前数据、接口与状态

- PostgreSQL 正式 profile 为 `m0-domain-baseline` version 2，迁移 latest 为 `0008-m1-project-role-members`；Membership 的唯一权威是 `status` 与 `permission_level`，Project Owner 的唯一权威是 `owner_membership_id`。
- User 保存显示名、默认介绍、默认模板和版本；Project 保存不可变 Key、说明、状态、策略和版本；Membership 在 `pending/active/removed` 间演进且不物理删除。
- Join Request 和 Owner Transfer 为版本化状态机；Admin Mode 绑定 Web Session、Project、Membership、服务端到期时间；Project Role 保存名称、单一能力文本、来源、状态和版本。
- Task Owner、Workspace、lease、audit 和 Outbox 沿用 M0 正式权威。成员移除不改写 Task Owner；非活动有效 Owner 使 Task Workspace 不可写。
- 公共 `/api/v1`、共享 TypeBox DTO、稳定错误、OpenAPI 3.1、request ID、Cookie/Origin 与资源 `actions` 是 Web/集成边界；客户端展示不成为授权权威。
- React Web 的 Admin Mode 只保存在当前运行内存；SSE 只触发 query 失效；不可信 Markdown/角色文本按纯文本显示。

## 5. 当前异常、边界、安全与恢复

- 非法/重复 Project Key、未知字段、非成员枚举、陈旧版本、幂等冲突、跨项目 ID、越权、无效 Admin Mode、归档写、阻塞移除和失效 Transfer 均返回稳定错误、request ID、适用版本与恢复建议。
- 权限变化、成员移除、Transfer 和归档遵循 Project → Membership → Request/Admin/Role → Task → Workspace/Lease 的稳定锁顺序；业务、幂等、audit、Outbox 和失效要么全部提交，要么完整回滚。
- 密码、Cookie、设备/访问/lease secret、Admin Mode ID、Workspace 正文和不必要的项目外数据不进入普通日志、错误、审计或 SSE。
- API/Worker 不调用外部 API、AI 或 LLM；客户端不执行不可信 HTML/Markdown，不以 Role/Prompt 文本授权。
- 数据库只允许前向迁移/roll forward；项目解除归档不是备份恢复。initial 记录冻结后，任何需求或行为变化进入新的 change run。
- `relaxed` 不降低 core、安全、隐私、数据、公共兼容、构建、恢复或适用发布门禁。

## 6. 当前非功能要求

- Node.js 24、pnpm 11、TypeScript、Fastify、TypeBox、Kysely、React/TanStack Query/Vite 和 PostgreSQL 17 保持项目权威；根 format/lint/build/typecheck/test 门禁通过。
- 目标规模为 200 项目、10,000 Membership、100 Role/项目、500 pending Join Request/项目和 5,000 active Task/项目；正确性优先于吞吐。
- 初期常规读目标 P95 `<500 ms`、普通写目标 P95 `<800 ms`；缺少参考服务器时按合同 `not_run`，不得伪造数据。
- Web 为中文、键盘可达、焦点可见、label/error 关联明确；头像、Admin Mode、Membership/Project/Role 状态不只靠颜色，窄屏无页面级横向溢出。
- 审计不可变，应用日志结构化；`/health/live` 与 `/health/ready` 分离，API/Worker ready 依赖正式 Schema，Worker 还依赖 runner。
- 保持模块化单体、PostgreSQL 和单机 Docker Compose；不引入高可用、消息中间件或分布式基础设施。

## 7. 当前验收要求

| 验收 | 层级 | 当前可观察要求 | 当前状态 |
| --- | --- | --- | --- |
| `AC-001` | core | 注册/登录/登出兼容，成功 User 恰有一个用户 Workspace/初始版本，失败不留半账号。 | passed |
| `AC-002` | core | 用户可维护默认资料；Web 有可访问首字素头像且不持久化头像内容。 | passed |
| `AC-003` | core | 项目原子创建唯一 Project、Owner、虚拟根、Workspace/初始版本和完整模板快照，幂等不重复。 | passed |
| `AC-004` | core | Project Key 格式/全局唯一/不可变；成员项目列表隔离，非成员精确 Key 只得最小信息。 | passed |
| `AC-005` | core | 只有 Owner 归档/解除归档；归档只读并使租约/Admin Mode 失效，解除不恢复旧能力。 | passed |
| `AC-006` | core | 精确 Key 申请、唯一 Membership/pending request 和归档/重复/陈旧拒绝成立。 | passed |
| `AC-007` | core | 只有 Owner 审批；首次复制默认资料，再次批准复用 Membership 并保留项目资料。 | passed |
| `AC-008` | core | 成员自助介绍/多角色绑定；默认资料不回写，Role 不影响授权。 | passed |
| `AC-009` | core | 只有 Owner 直接任免 Admin；资格不自动开模式，撤销立即终止能力和资格。 | passed |
| `AC-010` | core | 显式/继承有效 Owner 的未完成 Task 阻塞移除并返回稳定清单，竞态不能绕过。 | passed |
| `AC-011` | core | 合格移除保留 Membership/资料/Role/Task Owner，只置 `removed/member` 并撤销能力/租约。 | passed |
| `AC-012` | core | 重新加入复用 Membership/资料/Task 引用；完成冻结和新租约要求继续成立。 | passed |
| `AC-013` | core | 非活动有效 Owner 的 Workspace 不可写；异常未完成 Task 仅活动 Admin Mode 可修复，完成 Task 走正式 reopen。 | passed |
| `AC-014` | core | 单一 pending Transfer；接受只切唯一 Owner 字段、保留权限且项目始终一个活动 Owner。 | passed |
| `AC-015` | core | Admin Mode 显式开启、Session/Project 绑定、30 分钟无操作过期并在资格/状态变化时失效和审计。 | passed |
| `AC-016` | core | Owner/Admin Mode/成员自助矩阵在所有层一致，Repository、内部端口、确认或 UI 不可绕过。 | passed |
| `AC-017` | core | 系统模板为 `id/title/desc`；项目角色为名称和单一能力/Agent 提示，快照独立。 | passed |
| `AC-018` | core | 合格管理员可创建/编辑/复制/归档角色；归档保留历史、拒绝新绑定，复制独立。 | passed |
| `AC-019` | core | 所有授权忽略 Role 内容/名称/绑定，Prompt 文本不能扩权。 | passed |
| `AC-020` | core | 治理写在真实 PostgreSQL 并发/故障下只有完整前态或后态，无半权限、半 Owner、遗留租约或重复记录。 | passed |
| `AC-021` | core | 空库/现有 Schema 可前向迁移，现有 ID/Task Owner/Workspace/审计保留，角色快照幂等。 | passed |
| `AC-022` | core | M1 API/OpenAPI/runtime/稳定错误/版本/幂等覆盖成功、拒绝、陈旧和恢复。 | passed |
| `AC-023` | core | 中文 Web 可端到端完成全部 M1 流程并保留设备配对；键盘、焦点和非颜色状态通过。 | passed |
| `AC-024` | core | 关键成功/失败 audit 和 Outbox/SSE 完整且不泄露秘密、跨项目数据或 Workspace 正文。 | passed |
| `AC-025` | core | 既有 Identity/Pairing/Device/Workspace/SSE/Web/内部 Task 兼容及格式、构建、测试、迁移和适用发布门禁通过。 | passed |
| `AC-026` | core | 无外部 API/AI/LLM；租户、Cookie/Origin、秘密、最小披露和非活动 Membership 拒绝通过。 | passed |
| `AC-027` | core | 初期目标规模下页面/API 无明显卡顿或超时，未引入分布式基础设施。 | passed |
| `AC-028` | supplemental | 参考服务器常规读/写 P95 目标；当前无参考服务器或内网/VPN 目标。 | not_run |
| `AC-029` | supplemental | 附加真实并发/锁诊断未发现 core 之外的新异常。 | passed |

## 8. 当前决策

| 决策项 | 当前结论 | 来源 |
| --- | --- | --- |
| 交付策略 | `relaxed`；core/硬门禁阻塞，仅独立证明不影响交付的 supplemental 异常可登记 finding。 | 用户明确确认 |
| 工作流 | schema 3.2 initial run，`phased + expanded` 三阶段，P-001–P-003 均 completed/passed。 | workflow contract / roadmap |
| 交付表面 | Web + `/api/v1`；保留设备配对，不进入 M2 Task UI、CLI Sync 或 Agent 写入。 | 原始需求 |
| 个人资料/头像 | 显示名、默认介绍、默认模板；登录名不可改，无邮箱/重置；头像仅首字素占位符。 | 用户明确确认 |
| 成员入口 | 精确 Project Key 申请、Owner 审批，无邀请/目录；拒绝/移除后可再次申请。 | 原始需求 |
| 权限矩阵 | Owner 直接治理；Owner/Admin 编辑 Role/他人资料需 Admin Mode；成员直接编辑自己。 | 用户明确确认 |
| 成员移除 | 保留 Membership 与 Task Owner；未完成有效 Owner 阻塞；removed Admin 降为 Member。 | 用户明确确认 |
| 重新加入/完成冻结 | 复用 Membership/项目资料；完成 Task 保持冻结，继续工作需正式 reopen 和活动 Owner。 | 用户明确确认 |
| 角色模型 | 系统模板 `id/title/desc`；项目角色为名称 + 单一能力/Agent 提示，Role 不授权。 | 用户明确确认 |
| Project 生命周期/Owner | 归档只读而非备份；单一 pending Transfer，只切唯一 Owner 字段且权限值不变。 | 原始需求 |
| 数据/基础设施 | 前向迁移、PostgreSQL 权威、模块化单体和单机 Compose；无隐式 reset/分布式设施。 | 项目约束 |

## 9. 已替换或退役项目

无产品需求被 `change-0.md` 删除。原始 FR-001–FR-047 与 AC-001–AC-029 全部继续生效；AC-028 因当前无参考环境记为 `not_run`，不是删除或失败。

M1 正式规则取代活动设计文档中的两个旧结论：成员移除不再清空未完成 Task Owner，而是保留引用并由有效未完成 Owner 阻塞移除；`ROL-004` 不再使用多字段角色模型，而是名称加单一能力/Agent 提示文本。该同步是原始 FR-047 的实现，不构成后续 `RC-*`。

## 10. 来源链

- 原始需求：[`requirements.md`](requirements.md)，SHA-256 `f3ab380a2826c494223aff7b3c7ae7c9e8904d8d2ddf2ad0392adb26488020d8`
- 工作流契约：[`workflow-contract.md`](workflow-contract.md)，schema `3.2`，SHA-256 `221995f2237a8ee94867b4a95bf948d54162e3cb586955d379c4443998f66ae3`
- 初始路线图：[`implementation-plan.md`](implementation-plan.md)，revision 1，SHA-256 `94c85511348f628b1c0edb0d6133f4b3ca453d91815fbd306f45f7e529a5de22`
- P-001：[`phase-001-plan.md`](execution/initial/phase-001-plan.md) `87d211f6...17964` → [`phase-001-result.md`](execution/initial/phase-001-result.md) `eb06f279...c255f`，passed
- P-002：[`phase-002-plan.md`](execution/initial/phase-002-plan.md) `a8da8f75...29865` → [`phase-002-result.md`](execution/initial/phase-002-result.md) `b2662ce5...ae5c`，passed
- P-003：[`phase-003-plan.md`](execution/initial/phase-003-plan.md) `e818fc35...063a` → [`phase-003-result.md`](execution/initial/phase-003-result.md) `774fc276...b7dd`，passed
- 初始记录：[`change-0.md`](change-0.md)
- 当前没有开放 `FND-I-*`；下一可用 initial finding ID 为 `FND-I-001`。
