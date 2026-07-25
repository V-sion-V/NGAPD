# Agent 上下文原型：初始实施路线图

## 1. 范围与执行模式

- 执行模式：`phased`
- 计划详细度：`compact`
- 交付与验证策略：`relaxed`
- 路线图修订：`1`
- 需求指纹：`sha256:569d2e655ef3f346b5196c9e594ccc20c476131b9107a4c6eacfa0b3ed30524a`
- 项目基线：分支 `prototype`，提交 `bcae1aa1c66081c67ecbb9f6391b9613927f775a`
- 选择理由：确定性 TypeScript 核心、自动化、性能测量和 macOS/Node 主体结果可以在一个可构建、可独立验证的阶段内完成；最终 Windows 11 x64 core 必须等待三个原型主体全部完成并取得真实 Windows 入口，属于需求明确的独立外部交接，因此保留第二阶段。
- 详细度理由：本功能没有 migration、不可逆数据、公共 API 过渡、生产写入或二进制产物。当前用户改动集中在 Task UI 的 `task-graph*`、Web、`package.json` 和锁文件；P-001 通过新增独立 Agent Context 模块并只修改未被占用的导出文件来避免直接文件重叠，故使用 `compact`，同时把共享包所有权检查保留为执行硬门禁。
- 规划时工作区状态：需求与契约是尚未跟踪的已批准输入；Task UI P-001 的 Web、共享夹具、测试、锁文件和结果仍是用户未提交改动，另有 Workspace CLI 测试同步修正。规划不认领、回退或改写这些既有变化。
- 工具链事实：仓库要求 `.node-version` 的 Node `24.18.0` 和 pnpm `11.9.0`；规划 shell 当前为 Node `v22.22.1`，P-001 实施前必须切换到 Node 24。

本路线图只覆盖 Agent Context 前置原型，不新增正式 Agent/API/MCP 业务入口、数据库、Web 页面、真实 Workspace 读取、生产授权变更、外部 API、AI 或 LLM。

## 2. 项目现状与全局实现依据

- `prototypes/agent-context/` 目前只有假设说明、`context-sources.json`、提示注入样例和结果模板；没有上下文清单核心、预算、分页、渐进读取、参考消费者或可执行入口。
- 现有 `context-sources.json` 将 `current-task` 排在 `project-rules` 前，和已确认的“系统 > 项目 > 当前任务 > 用户流程”冲突；这是原型夹具漂移，只能在 Agent Context 夹具范围内修正。
- `packages/test-fixtures` 是现有确定性原型数据包，已有 Task UI 的深树、200 同级和密集 DAG，以及 Workspace 授权夹具、独立 Vitest、build 和 typecheck。Agent Context 应复用这些公开接口，不复制或重定义 Task UI 字段。
- `packages/domain/src/authorization.ts` 当前对非本人用户级 Workspace 直接返回 `not_scope_owner`，比 D-050 更严格。原型的跨用户允许场景必须使用显式合成的底层读取事实验证 Agent 附加门禁，不得修改或绕过生产 resolver。
- 根 `pnpm check` 依次执行格式、lint、全 workspace build、typecheck 和 test，是共享包兼容与可构建性的现有最终门禁；Agent Context 不需要新增运行时依赖。
- Task UI 已有可追溯 macOS Chromium `pass` 主体结果；Workspace Sync 已完成真实 macOS 客户端 P-003 且验证结论为 `passed`。Agent Context 是集中 Windows 验证前最后一个未完成主体。
- 当前主机为 macOS Darwin `25.5.0`、arm64。仓库没有 Windows runner，当前 PATH 未发现 Docker、Podman、Lima、Multipass、PowerShell、Wine 或 QEMU；这不阻塞 P-001，但 P-002 目前不可即时规划或执行。

## 3. 全局详细设计

### 3.1 组件与依赖方向

依赖方向固定为：

```text
Task UI task-graph + Workspace 授权夹具 + Agent Context JSON/注入样例
                              ↓
@ngapd/test-fixtures/agent-context 纯类型、校验与确定性核心
                              ↓
原型无头 Node 入口与规范化场景断言
                              ↓
只追加的 macOS / Windows 结果记录
```

1. `@ngapd/test-fixtures` 的独立 Agent Context 模块
   - 定义版本化合成输入、actor/membership/角色、任务关系、Workspace/Skill/摘要来源、授权事实、预算、清单条目、读取结果和结构化分析类型。
   - 从既有 Task UI fixture 读取任务 Key、正文、Owner、角色、状态、UTC 时间、标签、层级和同级 predecessor，不修改 `task-graph.ts` 的类型或生成语义。
   - 在任何候选输出前完成输入校验；重复 ID、未知类型、无效优先级/token/版本/关系/摘要来源和冲突授权事实返回稳定错误，不产生部分可信结果。
2. 上下文清单核心
   - 先应用底层读取事实和 Agent 发现门禁，再按系统、项目、当前任务、用户流程的固定优先级，以及祖先近到远、来源类型、稳定 ID 的平局规则排序。
   - 默认只展开活动祖先、已完成 predecessor 和当前任务一跳关注；其他用户用户级来源不进入默认候选、搜索或清单。显式跨用户场景同时要求目标、目的、底层允许和版本存在，结果永远只读。
   - 清单条目只包含稳定引用、来源/关系/版本、优先级、信任、估算 token、授权依据、选择状态及包含/排除原因，不嵌入文本正文或二进制。
3. 预算与分页
   - 系统规则、项目规则、当前任务和当前用户角色为必需来源。必需估算超过预算时返回 `insufficient_context_budget` 和 `minimumRequiredTokens`，不生成成功清单或分析。
   - 可选来源按已排序顺序整项纳入；预算只统计被选正文估算，不统计清单元数据，不做正文中段裁剪，并为每个未选来源保留稳定原因。
   - 游标对 schema、规范化输入版本、预算、页大小和排序事实生成不透明绑定；同一版本分页组合等于未分页清单，任一绑定事实变化后旧游标稳定失效。分页为纯计算，不保存服务端会话。
4. 渐进读取与参考消费者
   - 读取只接受当前清单内已选择的稳定来源与精确版本，并在每次调用重新检查 actor、显式意图、底层允许和 Agent 门禁；未选、失效或拒绝的来源不返回正文。
   - 读取结果保留来源和信任级别，系统规则与非可信 Workspace、评论、角色提示和外部资料分隔；正文中的管理员、忽略权限或工具调用文本只作为内容。
   - 参考消费者只使用实际读取结果，确定性输出任务目标、约束、角色边界、祖先、predecessor、一跳关注、权限和排除项；预算不足、必需来源缺失或读取拒绝时返回明确不可完成状态。
5. 无头入口与结果
   - 原型 Node 入口组合固定场景、目标断言、规范化输出和仅清单生成的重复性能测量；它不登录、不启动 PostgreSQL、Web 或外部网络，也不执行 Skill。
   - 每次主体或最终平台执行只新增结果 Markdown，记录环境、commit、夹具版本、预算、排序、分页、权限、裁剪、注入前后、摘要来源、性能和证据位置；结论只允许 `pass`、`fail` 或 `inconclusive`。

### 3.2 数据、接口与状态契约

- 原型输入是不可变合成值；`schemaVersion`、fixture version、scenario ID、任务/source version、预算和页大小共同决定规范化输出。
- 来源正文与 manifest 分离。manifest 的引用不能直接被当作已读取事实；参考消费者必须持有成功读取结果。
- 排序键和游标编码是原型内部契约，不提升为生产 API。稳定错误至少区分输入无效、预算不足、游标失效、来源版本失效、未选择和读取拒绝。
- 摘要只允许 `agent_provided`、`user_provided`、`system_fallback`，并保留来源任务、工作周期、版本和确认状态；未确认或不相关摘要不进入默认上下文。
- Skill 只发现已启用的项目级和当前用户级入口；同名时项目级优先，读取 Skill 不授予工具或 Workspace 能力。
- 原型无数据库、migration、缓存、后台作业、共享可变全局或写入状态；相同输入并行调用必须逐字段相同。

### 3.3 错误、安全、兼容、回滚与可观察性

- 任何安全、隐私、授权、提示注入、核心预算、分页、确定性、性能或 build/runtime 异常均阻塞；relaxed 策略不能把这些项目转为 report-only。
- 错误只暴露稳定代码和可定位的合成 subject，不泄露其他用户来源是否存在、路径、摘要或正文。
- 提示注入对照复用相同授权事实，加入或移除 `workspace-injection.md` 后读写、管理员模式、租约和确认结论必须逐字段相同。
- 不修改 `packages/domain/src/authorization.ts`、正式 API/Web/MCP、Task UI `task-graph*`、Workspace Sync 行为、数据库或锁文件；不引入真实 ID、个人路径、凭据、令牌或业务正文。
- P-001 完成后模块、自动化、根工程和 macOS 结果必须可构建并安全停在 `awaiting_next_phase`。恢复只撤回本功能拥有的新增模块、入口、夹具增量和结果，不删除 Task UI、Workspace Sync 或其他用户变化。
- 规范化 scenario 输出、稳定错误、预算汇总、分页组合、读取/分析结果和性能统计构成可自动比较的观察面；附加诊断 trace 属于 supplemental，不替代 core 断言。

### 3.4 验证与证据策略

- `relaxed` 允许先实现，不要求 red-first。纯核心以 Vitest 覆盖确定性、负向输入、发现、排序、预算、分页、授权、读取、摘要、Skill、注入和参考分析。
- P-001 在最终代码与夹具稳定后运行一次 Agent Context 全场景无头主体和 P95 测量，再运行 test-fixtures build/typecheck/test 与最终根 `pnpm check`；较早的目标测试不重复充当最终证据。
- macOS 主体只有所有 P-001 core 与硬门禁通过时才能记录 `pass`；证据不足记录 `inconclusive`，观察到 core 失败记录 `fail`。
- `AC-022` 与 `AC-023` 是 supplemental。低成本现有场景可以执行；若出现异常，只有独立证据证明不影响 core、兼容和硬门禁时，才以连续 `FND-I-*` 记录并允许 `passed_with_findings`。
- P-002 在即时规划时先复核 P-001 不可变结果、三个主体状态和项目漂移，只重跑会被后续变化影响的共享检查，并在真实 Windows 11 x64/Node 24 上执行同一确定性 core 套件。

## 4. 阶段路线图

| 阶段 | 目标 | 关联需求与验收 | 前置阶段 | 退出条件 | 当前状态 |
| --- | --- | --- | --- | --- | --- |
| P-001 | 交付确定性 Agent Context 核心、无头入口、自动化、性能与 macOS/Node 主体结果 | `FR-001`–`FR-034`, `FR-036`; `AC-001`–`AC-020`, `AC-022`, `AC-023`；持续保持 `FR-035`/`AC-021` 的最终等待约束 | 无 | P-001 core 与硬门禁通过；supplemental 通过、未执行的可选检查被明确记录，或异常形成合规 `FND-I-*`；macOS 主体结果为 `pass`，项目可构建并安全等待 | ready |
| P-002 | 在三个主体和真实 Windows 入口就绪后完成 Windows 11 x64 core、最终漂移复核与工作流封存 | `FR-035`; `AC-021`；最终复核 `FR-001`–`FR-036` / `AC-001`–`AC-023` 及全部开放 finding | P-001 完成；Task UI 与 Workspace Sync 主体结果保持通过；真实 Windows 11 x64/Node 24 入口可执行 | Windows core 和必要共享门禁通过；全部 core 与硬门禁闭合，supplemental/finding 合规汇总；可以创建最终记录与有效需求快照 | planned |

P-001 和 P-002 都必须结束于可构建或只读安全等待状态。当前只为 P-001 创建即时阶段计划；P-002 在外部前置未满足时不得创建空壳计划。

## 5. 跨阶段依赖与不变量

- 系统安全规则不可丢弃；项目规则始终优先于当前任务，当前任务优先于用户流程。
- manifest 不嵌入正文；读取每次重新授权；参考消费者不使用未读取、未选择、失效或未授权来源。
- 其他用户用户级来源默认不可发现；显式跨用户读取必须同时具备目标、目的、底层允许和版本，且永远只读。
- 关注只展开当前任务的一跳并稳定去重；角色、Skill、摘要、评论和 Workspace 文本都不授予权限。
- 必需来源预算不足时整体失败；可选来源只整项选择或排除，不能截断安全内容或返回伪完整分析。
- 原型只使用合成数据，不修改生产授权，不进入管理员模式，不取得真实租约，不调用外部 API、AI 或 LLM。
- Task UI、Workspace Sync、根 workspace build/type/test 和用户已有改动在每个阶段末保持兼容。
- P-001 macOS 主体 `pass` 只解锁集中 Windows 验证，不能创建 `change-0.md`；P-002 Windows core 未通过前 initial run 不得完成。
- P-002 规划前必须读取 P-001 不可变结果、当前 state、Task UI/Workspace Sync 主体证据和当前项目事实；若共享夹具漂移有多种合理处理方式，先暂停确认。

## 6. 最终集成与整体验证流程

1. P-001 完成版本化合成 fixture、输入校验、候选发现、排序、预算、分页、渐进读取和参考消费者，并通过目标单元/场景测试。
2. 从 Node 24 无头入口执行正常预算、预算不足、多页、祖先、predecessor、一跳关注/环、跨用户拒绝/显式允许、摘要、Skill 冲突、版本失效和提示注入对照，比较规范化输出。
3. 在主体规模上只测量 manifest 生成并计算 P95，确认小于 1 秒且没有删减必需来源、任务关系、授权复核或分页完整性。
4. 代码与夹具稳定后运行 test-fixtures build/typecheck/test 和一次最终根 `pnpm check`；复核没有生产 API、授权、Web、数据库、外部网络或真实数据变化。
5. 新增 macOS/Node 结果记录并写入 P-001 不可变结果；所有 P-001 core 通过时结论为 `pass`，随后运行安全停在 `awaiting_next_phase`。
6. 等待 P-001、Task UI、Workspace Sync 三个主体通过并取得真实 Windows 11 x64/Node 24 入口；之后单独调用 `$plan-feature-implementation`，只即时创建 P-002 计划。
7. P-002 复核后续漂移，只重跑会失效的共享证据，并在 Windows 执行同一 Agent Context core 套件。全部 core、硬门禁和 finding 处置一致后，才生成 `change-0.md` 与 `effective-requirements.md`。

## 7. 需求追踪矩阵

| 需求与验收 | 阶段 | 实现落点 | 验证 |
| --- | --- | --- | --- |
| `FR-001`–`FR-004`, `FR-031`, `FR-032`; `AC-001`, `AC-002`, `AC-018`, `AC-019` | P-001；P-002 最终漂移复核 | 独立 Agent Context 类型/校验、合成数据边界、无头入口、共享包导出 | 无效输入负向矩阵、无外部依赖执行、共享包目标门禁与最终根门禁 |
| `FR-005`–`FR-018`, `FR-027`, `FR-028`; `AC-003`–`AC-010` | P-001；P-002 Windows 复核 | 候选发现、关系展开、授权门禁、角色/Skill/摘要、稳定来源元数据 | 默认/排除集合、冲突优先级、祖先/predecessor/关注环、跨用户、Skill 与摘要场景 |
| `FR-019`–`FR-024`; `AC-010`–`AC-013` | P-001；P-002 Windows 复核 | 引用 manifest、稳定排序、绑定游标、必需/可选预算选择 | 正文隔离、分页等价/失效、预算不足、预算守恒和排除原因断言 |
| `FR-025`–`FR-030`; `AC-014`–`AC-016` | P-001；P-002 Windows 复核 | 重新授权的渐进读取、信任分隔、确定性参考消费者 | 未选/失效/拒绝读取、注入前后授权对照、完整与不可完成分析比较 |
| `FR-033`, `FR-034`, `FR-036`; `AC-017`, `AC-020`, `AC-022`, `AC-023` | P-001 | 场景 runner、P95 测量、只追加 results | macOS/Node core 矩阵、性能、结果字段与可选附加规模/trace |
| `FR-035`; `AC-021` | P-002 | Windows 11 x64/Node 24 结果与最终工作流证据 | 同 fixture 版本的确定性 core、漂移相关共享门禁和最终汇总 |

覆盖结论：`FR-001`–`FR-036` 与 `AC-001`–`AC-023` 均映射到实现、主体证据或最终外部门禁；P-002 拥有完整集成与最终完成结论。

## 8. 风险、技术决策与修订记录

### 8.1 风险与处置

| 风险 | 级别 | 处置 |
| --- | --- | --- |
| 共享 `packages/test-fixtures` 存在未提交 Task UI 改动 | 高 | Agent Context 使用独立新增模块，只修改未占用的 `src/index.ts`；开始任务前重新检查 file-level diff，不改 `task-graph*`、package manifest 或 lock，所有权不唯一时暂停 |
| 预算/排序错误产生伪完整上下文 | 高 | 必需来源先行、稳定排序键、整项选择与预算守恒使用独立断言；预算不足不返回成功 manifest/analysis |
| 跨用户 fixture 被误当作生产授权扩展 | 高 | 只接受显式合成底层允许事实，不修改或调用生产 resolver 来制造允许；默认发现集合和错误输出均验证不泄露 |
| 提示注入或角色/Skill 文本影响授权 | 高 | 授权决定只依赖结构化 actor/事实；对照输出逐字段比较读写、管理员、租约和确认边界 |
| 游标或来源版本漂移后续读错误 | 高 | 游标绑定全部排序事实；读取同时绑定 manifest/source version，漂移统一失败并要求从第一页重建 |
| 长期等待 Windows 导致共享夹具漂移 | 中 | P-001 形成不可变结果并安全等待；P-002 即时规划先审计指纹、结果和当前 diff，只重跑被影响证据 |
| 当前 shell Node 版本低于项目要求 | 中 | P-001 第一个执行检查切换到 `.node-version` 的 Node 24；版本不符时不产生主体或性能结论 |

### 8.2 技术决策

| ID | 决策 | 依据与影响 |
| --- | --- | --- |
| TD-001 | Agent Context 核心新增为 `@ngapd/test-fixtures` 的独立纯模块，并复用 Task UI/Workspace 授权 fixture 的公开接口 | 符合现有原型数据包惯例，避免修改正在演进的 Task UI 字段或提升为生产契约 |
| TD-002 | 跨用户允许使用合成 `underlyingReadAllowed` 等价事实，而生产 resolver 保持不变 | 同时验证 D-050 的 Agent 附加门禁与当前更严格生产实现，不扩大真实权限 |
| TD-003 | manifest、游标、读取和参考消费者使用版本化纯输入/输出，不建立持久化会话 | 直接获得确定性、并行安全、漂移失效和简单恢复边界 |
| TD-004 | 无头入口输出规范化结构与性能统计，结果记录只引用这些证据，不引入模型或人工语义评分 | 能逐字段验证任务分析和安全边界，且保持无外部 API/AI/LLM |
| TD-005 | 路线图采用两个 compact 阶段 | P-001 是完整 macOS/Node 主体；P-002 是需求明确的三个主体/Windows 外部交接与最终兼容门禁 |

### 8.3 修订记录

| 修订 | 日期 | 原结论 | 原因与证据 | 影响阶段 | 追踪影响 |
| --- | --- | --- | --- | --- | --- |
| 1 | 2026-07-25 | 初始路线图 | schema 3.2 完整审计通过；用户明确选择 relaxed；现有 fixture/core/runner 缺口可由一个主体阶段闭合，Windows 真实环境是唯一独立外部交接；共享用户改动可通过 file-level 边界避免重叠 | P-001、P-002 | 首次建立 `FR-001`–`FR-036` 与 `AC-001`–`AC-023` 完整映射 |
