# M3 平铺树状任务界面实施路线图

## 1. 范围与执行模式

- 功能 ID：`m3-task-ui`
- 运行：`initial`
- 执行模式：`phased`
- 细节级别：`compact`
- 交付与验证策略：`relaxed`
- 路线图修订：`3`
- 需求指纹：`345e209c7902568717a7f0950257a6ec095ca0bceda409a6ca6289bde9f1cb3b`
- 项目基线：Git `9f0a8398c63582f21ed26451bb727f9daca0d89c`，分支 `codex/m3-task-ui`
- 规划日期：2026-07-31

本路线图覆盖 `requirements.md` 的完整 M3 initial 范围，不改变已经冻结的 M2 需求、结果或有效快照。采用两个阶段是因为新增的 Task 搜索、祖先链与人类 Session 附件读取是 Web 的前置公共接口，同时也是可以向后兼容发布、独立验证和安全恢复的服务端子系统；完整生产 Web 集成在这些契约稳定后完成，并独占最终整体验收。当前未发现不可逆迁移、多个写入者、二进制生成物或用户生产文件重叠，因此不需要 `expanded` 证据。

## 2. 项目现状与全局实现依据

- `packages/contracts/src/tasks.ts`、`task-comments.ts`、`task-notifications.ts` 已定义 M2 Task、影响、评论、活动和通知运行时契约；`packages/contracts/src/workspaces.ts` 已定义 Workspace 清单与对象哈希结构。
- `packages/database/src/task-query-repository.ts` 已能从正式 Task、同级图、Owner、Workspace、blocker 和依赖事实派生 Task 资源，但列表查询当前按项目载入快照且没有项目级搜索或祖先链读取。
- `apps/api/src/modules/tasks/service.ts` 和 `routes.ts` 已提供全部 M2 人类 Session 写入、评论、活动、通知和 Task Workspace 状态端点；设备 Workspace 对象读取位于独立 Bearer 路径，不能直接用于正式 Web。
- `apps/web` 已有 React 19、TanStack Query、同源 Cookie API/error 层、稳定 M1 query key、幂等键、SSE 失效和项目内存 Admin Mode；正式项目页尚无 Task 导航，也没有生产路由状态。
- `apps/web/src/task-ui` 是隔离原型。其单 scope DAG、布局、键盘和页面状态只能作为交互证据；生产代码必须消费正式契约，不能导入确定性业务夹具。
- 正式数据库 profile 为 version 3、迁移 `0009-m2-task-management`。初始设计不要求迁移；只有确定的查询计划或参考负载证据证明必要时，才在冻结前修订路线图并增加前向、非破坏索引。
- 用户新增的 `docs/requirements/m3-task-ui/requirements.md` 与 `workflow-contract.md` 是规划前唯一工作区差异，属于已确认需求基线；生产文件没有重叠的用户改动。

## 3. 全局详细设计

### 3.1 组件与依赖方向

1. `packages/contracts` 增加 Task 搜索结果、祖先链、Session Workspace 文件清单和安全附件响应 Schema；新契约只引用稳定 Task Key、业务摘要、相对路径、大小和可选哈希，不暴露设备、租约或对象存储标识。
2. `packages/database` 在现有 Task 查询 Repository 上增加项目租户限定的搜索、祖先链和当前 Workspace 版本文件解析所需查询。Task/图/Workspace 继续是唯一事实，不建立第二写入模型。
3. `apps/api` 在 Task 模块增加只读 `/api/v1` 路径，复用 Session、活动 Membership、Task `read`/`read_workspace` 授权、稳定错误和 OpenAPI。附件内容由已注入的对象存储读取，但必须先验证当前 Workspace 版本、规范化相对路径、清单哈希和可选内容哈希。
4. `apps/web` 增加 `m3` 数据/导航层、稳定 query key、History API 适配、生产 DAG/抽屉、操作表单、影响确认、评论/活动/通知和精确失效。现有 M1 项目/成员/角色/Admin Mode 是显示映射和权限上下文，所有写入继续调用 M2 路径。
5. 原型入口精确由 `?prototype=task-ui` 选择并继续消费夹具；可复用布局算法改为结构化泛型输入，使生产和原型共享纯布局代码而不共享业务数据。

依赖方向保持 `Web -> /api/v1 contracts -> Task application/query repositories -> authoritative database/object store`。React 不重新计算权限、有效 Owner、完成资格或影响集合；SSE 只触发 query 失效。

### 3.2 公共接口与客户端状态

- 项目级搜索接受受限 `query`、`lifecycle`、稳定游标和上限，返回 Task 摘要、活动/归档状态及从虚拟根到目标父级的 Task Key 祖先链；Key 精确/前缀优先，标题使用不区分大小写包含匹配并保持稳定 Task Key 顺序。
- 祖先链可按单个 Task Key 独立读取，供有效深链、面包屑和陈旧搜索结果恢复；任何链不一致、跨项目、循环或不可读节点均 fail closed。
- 当前层继续使用 M2 稳定分页和同一 graph scope。Web 可连续读取当前 scope 的所有页后做 Owner/角色/状态/截止时间/标签 AND 投影；超过已加载页时明确展示继续加载入口，不把 200 当成领域上限。
- Session Workspace 清单与附件内容限定在路径参数中的 Project Key/Task Key。内容响应使用安全下载头和通用二进制 MIME；文件名仅作为清理后的展示信息，URL 不包含设备 token、lease token、连接 ID 或对象存储路径。
- 正式 URL 使用现有 `/` 配合可序列化查询参数表达项目、Task 页面、活动/历史模式、父级 scope 和可选选中 Task；`prototype=task-ui` 保持最高优先级且不与生产参数混用。History state 只保存导航和每层视口快照，不保存秘密、Admin Mode ID 或未提交写入。

### 3.3 数据一致性、错误与并发

- 每个用户意图创建一个幂等键；同一未修改负载的显式重试复用该键，成功或负载变化后轮换。
- Task/Graph/Workspace/评论/通知版本、影响令牌和 Admin Mode ID 从当前权威响应传入既有 M2 请求。`stale/conflict` 保留草稿，失效旧预览并要求 refetch/reconfirm。
- DAG 投影先验证 scope、父级、节点唯一性、依赖端点、自环和环；异常时整幅 fail closed。筛选和分页只保留两端可见的边，并单独报告隐藏关系数。
- 高影响操作使用可访问确认界面展示服务端影响。完成表单不得预填“已收到最终版本”或“无本地未提交版本”；删除必须精确输入 Task Key。
- 归档历史是只读模式。归档或删除成功后，生产 Web 清理失效缓存并导航到可解释的历史/不可用状态，不保留可编辑幽灵节点。

### 3.4 安全、隐私与可观测性

- 所有新增路由复用 SameSite Session、Same-Origin 写保护（写路径）、项目 Membership 和 Task 授权；跨项目/无权搜索、深链和附件使用既有不可枚举语义。
- Markdown 以安全、无任意 HTML/脚本的方式呈现；危险 URL 不生成可点击链接。Workspace 路径按平台无关规则规范化并严格匹配授权清单。
- 普通日志、错误、URL 与 SSE 仅包含稳定 Key/资源引用和 request ID，不记录 Cookie、token、lease secret、完整正文或附件内容。
- 客户端错误显示稳定用户消息与 request ID；服务端继续使用现有模块化审计/Outbox 边界，不新增外部遥测、外部 API 或模型调用。

### 3.5 兼容、迁移、发布与恢复

- 新接口为纯新增；既有 M2 请求/响应和 M1/Workspace CLI/Worker/SSE 路径保持不变。未配置对象存储时，附件内容能力明确不可用而 Task 模块其他能力仍可启动和测试。
- P-001 的 5,000 Task 查询证据不需要索引迁移。P-002 的真实浏览器删除流程证明：曾完成后重开的未完成 Task 仍由不可变 `task_completion_snapshots` 外键阻止删除，违反既有删除语义与 AC-015；因此增加下一个正式前向迁移，仅解除历史快照对活动 Task 行的删除约束，保留快照、Task UUID、项目和 Workspace 引用，不改写 M2 冻结记录或删除历史。
- P-001 可独立发布/回退 API 和契约；P-002 发布 Web/API/迁移同一源码快照。失败时停止新应用版本并 roll forward，或恢复迁移前一致备份；绝不 reset。
- 每个阶段结束时工程必须可构建。P-001 不把半完成 Task 页面暴露给用户；P-002 只有在全部 core 门禁通过后才完成 initial 记录。

## 4. 阶段路线图

| 阶段 | 目标 | 关联需求与验收 | 前置阶段 | 退出条件 | 当前状态 |
| --- | --- | --- | --- | --- | --- |
| P-001 | 交付并独立验证生产 Web 所需的搜索、祖先链和人类 Session Task Workspace 只读附件接口 | FR-012、FR-013、FR-017、FR-030、FR-036、FR-038、FR-039；AC-006、AC-016、AC-021、AC-023、AC-024、AC-025 | 无 | 共享 Schema/OpenAPI、Repository、Session/租户/路径授权和 5,000 Task/深度 20 查询证据通过；现有 M2 行为与工程构建不回归 | completed |
| P-002 | 在现有已认证项目 shell 中交付完整正式 Task UI、人类写入操作、实时恢复与最终验收 | FR-001–FR-040；AC-001–AC-028 | P-001 | 所有 core AC、项目硬门禁、真实 PostgreSQL、目标浏览器、200 DAG/5,000 Task/深度 20、参考部署和兼容门禁通过；supplemental 仅可按合同记录无交付影响的 `FND-I-*` | ready |

## 5. 跨阶段依赖与不变量

- 服务端始终是业务、权限、Owner、状态、影响、Workspace 和历史权威；P-001 的查询接口和 P-002 的缓存/URL 都不是第二业务事实。
- 任一时刻只有一个 current scope DAG；依赖只连接同一父级且方向为 predecessor → successor；父子关系不绘制为依赖。
- 层级下降只通过抽屉专用操作；直接子任务列表行不下降。新层、返回和面包屑导航保持无选择并关闭抽屉。
- M2 写语义、冻结、管理员模式、版本、幂等、审计、Outbox 和 Workspace 原子边界不得改变；P-002 只修复重开后删除被历史外键错误阻断的兼容缺口，且必须保留不可变完成快照；M2 冻结证据不得改写。
- P-001 只增加向后兼容只读能力；P-002 只能通过生产契约获取事实，精确 prototype 入口继续隔离。
- M4 同步写入、M5 Agent、M6 摘要/Wiki/全文搜索不提前实现。
- 用户原有工作与秘密不得进入运行累计清单；每个阶段结束时项目可构建且不存在半应用迁移或公开的半完成正式入口。

## 6. 最终集成与整体验证流程

P-002 在其最后一次代码变化之后一次性承担最终证据：

1. 针对共享契约、Task Repository/API、授权、OpenAPI、生产 Web 模型/交互、SSE、幂等和原型兼容运行直接受影响包的自动化测试与类型检查。
2. 在 PostgreSQL 17 上运行适用的迁移/重复迁移、真实写入、并发、5,000 Task、深度 20、200 同层 DAG 和跨租户/附件授权验证；执行根 `pnpm check` 和项目要求的最终 `pnpm run ci`。
3. 在至少 1280×720 的目标 Chromium/Chrome 上验证中文、键盘、焦点、深链/历史、搜索/筛选、DAG/抽屉、全部 M2 人类操作、危险确认、评论/附件/活动/通知、Admin Mode、SSE 草稿保护和 200 节点交互 P95。
4. 在 `192.168.100.1` 使用隔离六服务 Compose 栈验证最终源码快照、健康/硬化/持久化/秘密扫描、Swagger、新 Task UI 与参考 P95；不得影响服务器既有服务，并在完成后清理隔离资源。
5. 合并所有 phase result，确认 40 项 FR 与 28 项 AC 覆盖、无 unresolved question/blocker、无高危或未知影响 finding，再生成 `effective-requirements.md` 与 `change-0.md`。

`relaxed` 不要求 red-first。core、构建/运行时、安全、数据、兼容、恢复与发布门禁全部阻塞；独立证明不影响交付的 supplemental 异常才登记连续的 `FND-I-*`，并在阶段结果、状态与 `change-0.md` 中各按合同准确归并。

## 7. 需求追踪矩阵

| 需求或验收 | 实现阶段 | 验证位置 |
| --- | --- | --- |
| FR-001–FR-011 | P-002 | 已认证项目入口、单 scope DAG、抽屉、层级、URL/历史与真实浏览器交互 |
| FR-012–FR-017 | P-001（服务端事实）+ P-002（生产交互） | 搜索/祖先 API、归档/分页契约、筛选/搜索/历史 Web 与规模测试 |
| FR-018–FR-028 | P-002 | 创建/编辑、Owner、依赖、关注、blocker、状态/完成/重开、移动/归档/删除的版本化集成测试与浏览器确认 |
| FR-029–FR-032 | P-001（附件读取）+ P-002（评论/活动/通知） | Session 附件授权、评论生命周期、游标活动、通知偏好与安全导航 |
| FR-033–FR-035 | P-002 | Admin Mode、幂等/版本漂移、SSE 精确失效与草稿保护测试 |
| FR-036–FR-040 | P-001（接口安全）+ P-002（端到端兼容） | 不可信输入/路径、OpenAPI、单一事实、prototype 隔离和根/发布门禁 |
| AC-001–AC-005 | P-002 | M1 集成、DAG/抽屉/导航/深链 core |
| AC-006 | P-001 + P-002 | 5,000 Task 搜索/祖先 API 与搜索前位置浏览器恢复 |
| AC-007–AC-015 | P-002 | 筛选/历史/可访问性及全部 Task 命令、影响与危险操作 |
| AC-016 | P-001 + P-002 | Session Workspace 文件读取授权与评论附件交互 |
| AC-017–AC-020 | P-002 | 活动/通知、Admin Mode、幂等并发与 SSE 缓存/草稿 |
| AC-021 | P-001 + P-002 | Session/租户/Task 重新授权、不可信内容和秘密检查 |
| AC-022–AC-025 | P-001（查询基础）+ P-002（最终门禁） | 参考 P95、5,000/20/200、OpenAPI/迁移兼容、根 CI/发布栈/prototype |
| AC-026–AC-028（supplemental） | P-002 | 可选额外浏览器/大于 200/trace 与视觉证据；异常按 `FND-I-*` 合同处置 |

## 8. 风险、技术决策与修订记录

### 8.1 主要风险与控制

- **完整操作面状态漂移**：用统一操作控制器、服务端 `actions`、版本/影响令牌和按资源 query key 精确失效控制，不在独立组件复制授权规则。
- **项目快照与规模性能**：P-001 先测现有查询计划；优先限定 SQL/分页/索引，不下载全部正文到浏览器，也不以隐藏节点达标。
- **DAG 正确性与性能**：复用已验证纯布局不变量，生产适配前进行数据完整性校验；有限滚动视口只渲染当前已加载 scope。
- **深链、历史与草稿冲突**：History state 只驱动导航；离开脏表单需确认，SSE 只失效权威查询并标记冲突。
- **附件代理**：必须逐次校验 Session、项目、Task、Workspace 当前版本、规范化路径、清单项与对象哈希；任何不一致 fail closed。
- **危险操作误确认**：只展示服务端影响，显式语义确认；完成安全答案不得预填，删除精确匹配完整 Task Key。

### 8.2 技术决策

| 决策 | 结论 | 依据与影响 |
| --- | --- | --- |
| 阶段数量 | 两个 compact 阶段 | 服务端只读子系统可独立交付并是 Web 的稳定前置；最终 Web 和验收保持在一个完整阶段 |
| 前端路由 | 使用浏览器 History API 与受限查询参数，不新增路由依赖 | 满足深链/刷新/前进后退，同时保持现有 `/` 和 prototype 入口 |
| 当前层筛选 | 在完整加载的当前 scope 权威页集合上做纯投影 | 复用 M2 列表契约；超过已加载范围明确分页，不把 200 设为硬限制 |
| Markdown | 默认安全文本/受限 Markdown 呈现，不允许任意 HTML | 避免引入脚本和危险 URL；以后扩展解析器仍必须保持相同安全边界 |
| 数据库迁移 | 增加一个前向兼容迁移 | 真实浏览器证明“完成→重开→删除”被不可变完成快照外键错误阻断；迁移只解除该活动行外键并保留历史 UUID/项目/Workspace 引用，验证空库、version 3 升级、重复运行和历史存续 |

### 8.3 修订记录

| 修订 | 日期 | 结论与原因 | 影响阶段 | 追踪影响 |
| --- | --- | --- | --- | --- |
| 1 | 2026-07-31 | 初始路线图；采用两个 compact 阶段与 relaxed 验证策略 | P-001、P-002 | 覆盖 FR-001–FR-040、AC-001–AC-028，无未映射项 |
| 2 | 2026-07-31 | P-001 已以 `completed/passed` 冻结；真实 PostgreSQL 规模证据不要求迁移，现按原边界为最终 P-002 生成 just-in-time 计划 | P-001、P-002 | 需求与阶段边界不变；P-001 状态更新为 completed，P-002 更新为 ready |
| 3 | 2026-07-31 | P-002 浏览器 core 验收发现完成后重开的未完成 Task 因 `task_completion_snapshots` 历史外键返回 500；采用唯一保留历史且不改变产品语义的前向迁移 | P-002 | P-002-T-002 增加迁移与回归证据；两阶段边界、需求映射和 relaxed 策略不变 |
