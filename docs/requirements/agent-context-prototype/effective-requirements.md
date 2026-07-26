# Agent 上下文原型：当前有效需求

- 派生状态：可重新生成
- 原始需求：[`requirements.md`](requirements.md)
- 已应用至修改记录：[`change-0.md`](change-0.md)
- 生成日期：2026-07-26
- 当前交付与验证策略：`relaxed`
- 当前验证结论：`passed`

## 1. 当前目标与范围

当前有效目标是保留一个只使用确定性合成内存数据的 Agent Context 原型：生成来源清晰、稳定排序、受权限和预算约束的可分页引用清单；把正文留给每次重新授权的渐进读取；只根据实际读取结果产生可逐字段比较的结构化任务分析；证明 Workspace、角色、Skill、评论、摘要和提示注入文本不能扩大工具权限。

当前范围包括版本化 actor/项目/任务/关系/Workspace/Skill/摘要夹具、输入校验、底层读取与 Agent 发现双层门禁、固定冲突优先级、必需/可选预算、绑定游标分页、版本化渐进读取、结构化参考消费者、确定性 Node runner、三种主体规模 P95，以及 macOS arm64 和 Windows 11 x64 的同夹具 core 结果。

当前范围不包括登录、真实账号/项目/任务/Workspace、PostgreSQL、migration、正式 Agent Session/Context Manifest/KnowledgeEntry/Task Follow、正式 API/Web/MCP/Workspace CLI 业务入口、生产授权变更、真实写入或租约、Skill 执行、向量/全文搜索服务、外部 API、AI、LLM、模型评测或生产部署组件。

## 2. 当前生效需求

| 当前编号 | 当前生效内容 | 验收要求与层级 | 来源 |
| --- | --- | --- | --- |
| `FR-001` | 提供可由自动化和无头 Node 直接调用的确定性上下文核心，不依赖登录、数据库、真实 Workspace、Web 或外部网络。 | `AC-001` core | `requirements.md` |
| `FR-002` | 夹具具有显式 schema/fixture 版本和稳定合成 ID；相同版本化输入、预算、页大小和游标必须逐字段相同。 | `AC-002` core | `requirements.md` |
| `FR-003` | 夹具覆盖 actor、项目成员、自我介绍、角色、主任务、活动祖先、同级 DAG、predecessor、兄弟、关注/环/长链、三级 Workspace、摘要和图片元数据。 | `AC-002`, `AC-003`, `AC-006`, `AC-009` core | `requirements.md` |
| `FR-004` | 重复 ID、未知类型、无效优先级/token/版本/任务关系/摘要来源和冲突权限事实必须在部分清单产生前稳定拒绝。 | `AC-002` core | `requirements.md` |
| `FR-005` | 默认候选覆盖系统规则、项目规则/Skill/参考、当前任务、当前用户介绍/角色/流程/Skill、活动祖先、已完成 predecessor、直接关注、任务目录/文件和显式附加来源。 | `AC-003` core | `requirements.md` |
| `FR-006` | 系统安全与工具规则具有最高优先级和可信来源，不得被预算、分页或 Workspace 内容静默覆盖或降级。 | `AC-003`, `AC-004`, `AC-012` core | `requirements.md` |
| `FR-007` | 冲突顺序固定为系统 > 项目 > 当前任务 > 用户流程；修正任何与该顺序冲突的原型夹具。 | `AC-004` core | `requirements.md` |
| `FR-008` | 当前任务来源保留 Key、标题、正文引用、Owner/继承、角色、状态、UTC 截止时间、标签、展示类型、层级、依赖、关注与权限合成事实。 | `AC-003`, `AC-010` core | `requirements.md` |
| `FR-009` | 角色上下文包含当前用户全部项目角色和当前任务角色定义、能力、责任、限制与提示来源；角色不改变授权。 | `AC-008` core | `requirements.md` |
| `FR-010` | 用户级自动发现只包含当前用户自己的流程、规则和启用 Skill；其他用户用户级来源默认不可发现。 | `AC-005`, `AC-007` core | `requirements.md` |
| `FR-011` | 活动祖先按稳定关系顺序保留当前信息和相关历史确认摘要，摘要来源和版本独立可追踪。 | `AC-003`, `AC-009` core | `requirements.md` |
| `FR-012` | predecessor 自动来源只包含当前任务已完成且可读 predecessor 的确认摘要；未完成、无关或不可读项不提供正文。 | `AC-003`, `AC-005`, `AC-009` core | `requirements.md` |
| `FR-013` | 当前任务直接关注只展开一跳、按稳定 Task ID 去重；关注环和长链不扩大来源、写权限、状态或依赖能力。 | `AC-006` core | `requirements.md` |
| `FR-014` | 任务级 Workspace 默认只提供目录、文本/图片元数据和引用；正文渐进读取，大型二进制正文不进入清单或读取结果。 | `AC-005`, `AC-010`, `AC-014` core | `requirements.md` |
| `FR-015` | 显式附加任务摘要、项目资料或参考文件保留加入原因、来源、版本和底层授权，且不提升到系统规则之上。 | `AC-003`, `AC-004` core | `requirements.md` |
| `FR-016` | 稳定排除无关兄弟、未选其他任务原文、递归关注、未启用 Skill、整个项目历史评论、大型二进制和无引用归档任务。 | `AC-005` core | `requirements.md` |
| `FR-017` | 其他用户用户级 Workspace 只有明确目标、读取目的、底层允许和存在的版本同时满足时才能作为只读来源；缺一即拒绝且永不授予写入。 | `AC-007` core | `requirements.md` |
| `FR-018` | 每个清单条目至少包含稳定 ID、类型、作用域/关系、版本、优先级、信任、估算 token、授权依据、选择状态和包含/排除/预算原因。 | `AC-010` core | `requirements.md` |
| `FR-019` | manifest 和分页响应不嵌入候选正文或二进制，只返回受控后续读取所需的引用、摘要或元数据。 | `AC-010` core | `requirements.md` |
| `FR-020` | 排序先遵守固定优先级，再使用明确关系顺序、来源类型和稳定 ID；运行时枚举顺序不得改变结果。 | `AC-002`, `AC-004`, `AC-010` core | `requirements.md` |
| `FR-021` | 不透明游标绑定 schema、输入版本、预算、页大小和排序事实；同版本跨页无重复/遗漏/重排，绑定事实变化后旧游标稳定失效。 | `AC-011` core | `requirements.md` |
| `FR-022` | 预算是非负整数，只统计被选正文估算；结果报告总预算、选用量和剩余量。 | `AC-012`, `AC-013` core | `requirements.md` |
| `FR-023` | 系统规则、项目规则、当前任务和当前用户角色为必需来源；总量超预算时返回 `insufficient_context_budget` 与最小估算，不产生伪完整结果。 | `AC-012` core | `requirements.md` |
| `FR-024` | 必需来源满足后，可选来源按稳定顺序整项保留或排除，不做正文中段裁剪，不用低优先级小项掩盖高优先级排除。 | `AC-013` core | `requirements.md` |
| `FR-025` | 渐进读取引用当前清单的稳定来源和精确版本，并每次重新检查 actor、意图、底层授权与 Agent 门禁；未选、失效或拒绝项不返回正文。 | `AC-014` core | `requirements.md` |
| `FR-026` | 读取结果保留来源和信任并隔离系统规则与非可信正文；正文中的管理员、忽略权限或工具调用文本不能影响授权。 | `AC-008`, `AC-015` core | `requirements.md` |
| `FR-027` | 只发现启用的项目级和当前用户 Skill，先返回稳定入口；同名项目级优先，发现/读取不授予工具或 Workspace 能力。 | `AC-003`, `AC-004`, `AC-005` core | `requirements.md` |
| `FR-028` | 摘要来源限于 `agent_provided`、`user_provided`、`system_fallback`，保留任务、周期、版本和确认状态；仅相关已确认摘要默认进入。 | `AC-009` core | `requirements.md` |
| `FR-029` | 参考消费者只使用 manifest 与成功读取结果，确定性输出任务目标、约束、角色、祖先、predecessor、关注、权限和预算排除项。 | `AC-016` core | `requirements.md` |
| `FR-030` | 参考消费者不把未读/排除来源或注入权限声明当事实；预算不足、授权失败或必需来源缺失时返回明确不可完成状态。 | `AC-016` core | `requirements.md` |
| `FR-031` | 不新增正式 API、数据库、Web、Agent/MCP 业务入口，不读真实数据、不改生产 Workspace 授权、不调用外部 API/AI/LLM。 | `AC-001`, `AC-019` core | `requirements.md` |
| `FR-032` | 增量核心和夹具保持 Task UI 任务图、Workspace Sync 夹具及根 workspace 的构建、类型和测试兼容，不覆盖用户工作。 | `AC-018` core | `requirements.md` |
| `FR-033` | macOS/Node 主体覆盖预算、分页、关系、跨用户、摘要、Skill、版本、重新授权、注入和结构化分析，并产生独立可追溯结果。 | `AC-020` core | `requirements.md` |
| `FR-034` | 三种主体规模的 manifest 生成 P95 `< 1 s`，不包含正文读取，且不得删减必需来源、关系、授权或分页完整性。 | `AC-017` core | `requirements.md` |
| `FR-035` | 三个原型主体完成后，Windows 11 x64 使用同一夹具版本和同一确定性 core 通过兼容验证，之后才可最终封存。 | `AC-021` core | `requirements.md` |
| `FR-036` | 每次主体/平台执行新增独立结果，结论只允许 `pass`/`fail`/`inconclusive`，并保留环境、commit、夹具、预算、排序、分页、权限、裁剪、注入、摘要和证据。 | `AC-020`, `AC-021` core | `requirements.md` |

## 3. 当前流程

1. 验证者选择固定 schema/fixture、actor、主任务、预算和页大小；核心先校验任务关系、来源、摘要、权限、版本和 token。
2. 核心先应用底层读取与 Agent 发现门禁，再按系统、项目、当前任务、用户流程及稳定平局规则排序，返回只含引用/元数据的第一页和预算汇总。
3. 调用者使用绑定游标组合后续页面；同版本组合必须等于未分页清单，任一绑定事实漂移后从第一页重建。
4. 参考消费者按固定场景选择来源；每次渐进读取重新校验 actor、意图、底层授权、来源版本和清单成员资格。
5. 消费者只从成功读取内容生成结构化任务分析，并明确列出未读、拒绝、失效或预算排除项；不完整条件返回稳定原因。
6. 预算低于必需来源总量时整体失败；提高预算后从同一不可变输入重新计算，不存在半完成状态。
7. 一跳关注和显式跨用户只读均不产生写入、管理员模式、租约、依赖或状态能力。
8. 加入提示注入材料前后，授权、读写范围、管理员模式、租约和确认要求必须逐字段相同。
9. macOS/Node 和 Windows 11 x64 分别新增平台结果；只有 core、硬门禁和结果字段全部通过时结论才可为 `pass`。

## 4. 当前数据、接口与状态

- 输入是不可变合成值，包含 schema/fixture/scenario、actor/membership/角色、项目/任务/版本/关系、Workspace/Skill/摘要来源、授权事实、预算、页大小和可选游标；不含真实 ID、路径、凭据、令牌或业务正文。
- 来源具有稳定 ID、类型、作用域/关系、版本、信任、优先级、估算 token、底层授权、Agent 发现要求、启用状态及正文引用/图片元数据。
- manifest 在来源字段基础上提供稳定排序解释、`mandatory`、选择状态、授权依据、包含/排除原因和版本化读取引用；manifest 与正文严格分离。
- 预算满足 `selectedTokens ≤ budgetTokens`、`remainingTokens = budgetTokens - selectedTokens`，并单独报告 `minimumRequiredTokens`。
- 游标是绑定 schema、规范化输入版本、预算、页大小和排序事实的无状态不透明值；不建立服务端会话或持久化游标。
- 渐进读取是原型内纯函数边界，不是公共 API；输出只包含获准的合成正文/元数据、来源、信任和授权结论。
- 结构化分析包含任务标识/目标/约束、角色边界、祖先、predecessor、直接关注、生效规则、权限、排除项及 `complete` 或明确不可完成原因。
- 原型不持久化业务状态、没有数据库、migration、缓存、后台作业或多 writer；相同输入的并行调用不得共享改变输出的全局可变状态。

## 5. 当前异常、边界、安全与恢复

- 重复 ID、未知类型、无效 token/版本/任务关系/摘要来源或矛盾权限事实在任何部分可信输出前稳定拒绝，并只暴露合成 subject。
- 必需预算不足返回 `insufficient_context_budget` 和最小估算；游标漂移返回稳定失效；来源版本漂移拒绝正文并要求重建。
- 其他用户来源缺少目标、目的、底层允许或版本时拒绝，错误不得泄露可枚举摘要、路径或正文。
- 未启用 Skill、未确认摘要、未完成 predecessor、无关兄弟和递归关注均以稳定原因排除。
- Workspace、评论、角色提示、Skill 或外部资料全部是不可信内容；系统规则与工具授权只依赖结构化事实。
- 任一确定性、分页、预算、授权、隐私、注入、参考分析、性能、build/runtime 或 Windows core 异常都阻塞，不能在 relaxed 下改为 report-only。
- 原型不得进入管理员模式、取得真实租约、写入 Workspace、改变生产授权或向外发送内容。
- 无生产写入或 migration。恢复只停止临时进程并移除/禁用本功能拥有的隔离原型增量；必须保留 Task UI、Workspace Sync 和用户工作，不得 destructive reset。

## 6. 当前非功能要求

- 相同 schema、fixture、actor、任务、授权、预算、页大小和游标必须产生逐字段相同的规范化结果。
- deep-tree、wide-siblings（200+ 同级）和 dense-dag 主体规模的 manifest-only P95 必须 `< 1000 ms`；记录环境、规模、预算、页大小、重复次数、P95 和最大值。
- 性能不得通过删减必需来源、关系、授权检查、排除原因或跨页完整性达标。
- 安全、隐私、授权和提示注入均为 core；结果只含合成数据、仓库相对证据和非敏感环境信息。
- 共享包、Task UI/Workspace Sync 夹具和根 workspace 必须保持 format、lint、build、typecheck 和适用测试兼容。
- 当前主体兼容环境为 macOS arm64 / Node 24 和 Windows 11 x64 / Node 24；两者均使用 `agent-context-v1`。
- 每次主体只追加结果，不覆盖历史；若结论要求改变 ADR-010、ADR-012、D-050、冲突优先级或 Agent 契约，必须另行需求/ADR 变更。

## 7. 当前验收要求

| 验收 | 层级 | 当前可观察要求 | 当前状态 |
| --- | --- | --- | --- |
| `AC-001` | core | 无登录、数据库、真实 Workspace、Web 或外部服务即可生成 manifest、渐进读取和结构化分析。 | passed |
| `AC-002` | core | 相同版本化输入逐字段一致；无效输入在部分可信输出前稳定拒绝。 | passed |
| `AC-003` | core | 默认候选完整覆盖系统、项目、任务、当前用户、祖先、predecessor、一跳关注、任务来源和显式附加项，并保留来源/版本。 | passed |
| `AC-004` | core | 冲突稳定遵守系统 > 项目 > 当前任务 > 用户流程；项目同名 Skill 优先。 | passed |
| `AC-005` | core | 无关兄弟、未选原文、递归关注、未启用 Skill、未确认摘要、大型二进制和无引用归档项稳定排除。 | passed |
| `AC-006` | core | 直接关注只展开一跳并稳定去重；环和长链不增加二跳、写入、管理员、依赖或状态能力。 | passed |
| `AC-007` | core | 其他用户来源默认不可发现；只有目标、目的和底层允许齐备时返回指定只读来源，拒绝不泄露正文。 | passed |
| `AC-008` | core | 当前用户/任务角色有来源和边界；恶意角色提示前后授权逐字段相同。 | passed |
| `AC-009` | core | 祖先、已完成 predecessor 和三类确认摘要按关系、来源、周期和版本可追踪；未确认摘要排除。 | passed |
| `AC-010` | core | 清单字段完整、选择/排除原因可解释，且不嵌入正文或二进制。 | passed |
| `AC-011` | core | 分页组合等于未分页清单；无重复/遗漏/重排；绑定事实变化后旧游标稳定失效。 | passed |
| `AC-012` | core | 必需来源全部保留；不足时返回最小预算，不截断安全规则或产生伪完整结果。 | passed |
| `AC-013` | core | 可选来源按固定顺序整项选择，预算守恒且每个未选来源有稳定原因。 | passed |
| `AC-014` | core | 渐进读取只接受当前清单精确版本，并每次重新授权；未选、失效或拒绝项不返回正文。 | passed |
| `AC-015` | core | 加入注入夹具前后授权、管理员模式、读写范围、租约和确认逐字段相同。 | passed |
| `AC-016` | core | 分析只使用实际读取结果；缺必需来源、预算失败或读取拒绝时明确不可完成。 | passed |
| `AC-017` | core | 三种主体规模 manifest-only P95 `< 1000 ms`，未牺牲来源、关系、授权或分页。 | passed |
| `AC-018` | core | Agent Context 增量保持共享包、根 workspace、Task UI/Workspace Sync 夹具和用户工作兼容。 | passed |
| `AC-019` | core | 不读/发真实内容，不新增 migration/正式入口，不改生产授权，不进入管理员或调用外部 API/AI/LLM。 | passed |
| `AC-020` | core | macOS arm64 / Node 24 主体记录完整并为 `pass`。 | passed |
| `AC-021` | core | Windows 11 x64 / Node 24 使用相同 `agent-context-v1` core 记录完整并为 `pass`。 | passed |
| `AC-022` | supplemental | 附加规模和分页压力保持预算守恒、稳定分页和一跳关注边界。 | passed |
| `AC-023` | supplemental | 规范化排序键、原因、游标绑定和场景输出足以解释选择、排除和分页决定。 | passed |

## 8. 当前决策

| 决策项 | 当前结论 | 来源 |
| --- | --- | --- |
| 交付策略 | `relaxed`；core 和硬门禁阻塞，只有独立证明无 core/兼容/安全影响的 supplemental 异常才可登记 `FND-I-*`。 | 用户明确确认 |
| 原型范围 | 只保留 Agent Context 前置原型，不提前实现正式 Agent/API/MCP 闭环。 | 原始需求 |
| 数据来源 | 只使用版本化合成数据，复用 Task UI/Workspace 授权 fixture 的公开接口，不访问真实 Workspace。 | 原始需求 / 项目约束 |
| 核心位置 | 独立纯 TypeScript 模块位于 `@ngapd/test-fixtures`，不提升为生产契约。 | 路线图 TD-001 |
| 清单/正文边界 | manifest 只返回引用与元数据；正文由独立且每次重新授权的渐进读取取得。 | 原始需求 |
| 冲突顺序 | 系统 > 项目 > 当前任务 > 用户流程；同名 Skill 项目级优先。 | 原始需求 / 项目约束 |
| 预算 | 只统计选定正文估算；四类必需来源不足时整体失败；可选来源整项保留或排除。 | 原始需求 |
| 分页 | 不透明游标绑定 schema、输入版本、预算、页大小和排序事实；漂移即失效。 | 原始需求 |
| 任务关系 | 活动祖先近到远；predecessor 只用已完成确认摘要；关注只展开一跳并去重。 | 原始需求 |
| 跨用户读取 | 默认不发现；明确目标、目的、底层允许和版本齐备时仅只读。 | 原始需求 / D-050 边界 |
| 生产授权差距 | 使用合成 `underlyingReadAllowed` 等价事实验证 Agent 附加门禁，不修改更严格的生产 resolver。 | 路线图 TD-002 |
| 角色与 Skill | 角色/Skill 提供上下文入口和责任边界，但不授予权限或工具能力。 | 原始需求 |
| 摘要 | 仅 `agent_provided`、`user_provided`、`system_fallback`；保留任务、周期、版本和确认状态。 | 原始需求 |
| 分析证明 | 使用确定性结构化参考消费者和固定预期，不评价真实模型语言质量。 | 原始需求 / 路线图 TD-004 |
| 外部服务 | 不连接外部 API、AI 或 LLM，不执行 Skill，不建立持久化会话。 | 原始需求 |
| 平台顺序 | macOS/Node 主体先完成，三个主体就绪后执行 Windows x64 core；两阶段均已通过。 | 用户明确确认 / 路线图 TD-005 |
| 性能 | 主体规模 manifest-only P95 `< 1 s` 为 core；附加规模/诊断为 supplemental。 | 原始需求 |
| 结果状态 | 平台结果只允许 `pass`、`fail`、`inconclusive`；全部 core 通过才可 `pass`。 | 原始需求 |
| 共享工作保护 | 只做可区分的 Agent Context 增量，不覆盖 Task UI、Workspace Sync 或用户文件。 | 原始需求 / 项目约束 |

## 9. 已替换或退役项目

无。`change-0.md` 是原始需求的首次实现记录，没有 `RC-*` 增量、删除项或替换项。`AC-022`/`AC-023` 保持有效 supplemental，且本次均以低成本证据通过。

## 10. 来源链

- 原始需求：[`requirements.md`](requirements.md)，SHA-256 `569d2e655ef3f346b5196c9e594ccc20c476131b9107a4c6eacfa0b3ed30524a`
- 初始路线图：[`implementation-plan.md`](implementation-plan.md)，revision 1，SHA-256 `e658381e8ee6819411f872b3588a41a1f23ca05a48da0d7406acbfc7a127c339`
- P-001：[`phase-001-plan.md`](execution/initial/phase-001-plan.md) revision 1，SHA-256 `7a97dcf8d92476acd1573efb958f3e4c39c23ac237ba786550018875ce0f5aec` → [`phase-001-result.md`](execution/initial/phase-001-result.md) `passed`，SHA-256 `943dd82d02e80e3d583bcb61ce5fecf99ed5c1894e3d8373ad48f3e936114274`
- P-002：[`phase-002-plan.md`](execution/initial/phase-002-plan.md) revision 1，SHA-256 `3ccc6f720cf7a8aad199934db1dddf77c2e7f6c48a578a138e22e36479fa910c` → [`phase-002-result.md`](execution/initial/phase-002-result.md) `passed`，SHA-256 `7f663948a1a83784d4977d086c63cfbfd6016019ab6755f8828c65ede830ca14`
- 主体证据：[macOS/Node `pass`](../../../prototypes/agent-context/results/2026-07-25-macos-node24.md)；[Windows x64/Node `pass`](../../../prototypes/agent-context/results/2026-07-26-windows-x64-node24.md)
- 初始记录：[`change-0.md`](change-0.md)
- 当前没有开放 `FND-I-*`；下一可用 initial finding ID 为 `FND-I-001`。
