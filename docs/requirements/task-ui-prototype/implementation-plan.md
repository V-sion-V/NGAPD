# 平铺树状 Task UI 原型：初始实施路线图

## 1. 范围与执行模式

- 执行模式：`phased`
- 计划详细度：`compact`
- 交付与验证策略：`relaxed`
- 路线图修订：`1`
- 需求指纹：`sha256:222a3f69cef2d36970c621336398792cfa3056bf342597c9822230d6582a99a0`
- 项目基线：分支 `prototype`，提交 `bcae1aa1c66081c67ecbb9f6391b9613927f775a`
- 选择理由：原型实现、自动化和 macOS Chromium 主体验收可以作为一个完整、可构建、可独立验证的阶段交付；最终 Windows 11 x64 core 验证必须等待 Agent Context 主体及真实 Windows 入口，是需求明确规定的独立外部交接，因此保留第二阶段。不存在 migration、不可逆数据、公共 API 过渡、多 writer、二进制资产或困难恢复风险，两个阶段均采用 `compact` 细节。
- 规划时工作区状态：`requirements.md` 与 `workflow-contract.md` 是本工作流已批准但尚未跟踪的输入，没有其他已修改或未跟踪文件。当前 shell 的 Node.js 为 `v22.22.1`，实现前必须切换到 `.node-version` 声明的 `24.18.0`；pnpm 已为 `11.9.0`。

本路线图只覆盖夹具驱动的 Task UI 前置原型，不提前实现正式 Project/Task API、数据库持久化、任务编辑、权限执行、评论、通知、实时协作、生产路由或第二幅 DAG。

## 2. 项目现状与全局实现依据

- `apps/web` 是 React 19 + Vite 的单入口浏览器应用，现有 `App.tsx` 直接承载账号、登录、设备配对和设备撤销界面；目前没有路由器、Task 页面、DAG 组件或前端测试脚本。
- `apps/web` 已依赖 TanStack Query，但 Task UI 原型不得创建 Query 或发起 API 请求；正常入口继续使用现有 QueryClient 和身份 API。
- `packages/test-fixtures` 是现有确定性原型数据包，使用 TypeScript、Vitest、独立 build/typecheck，并已通过仓库级测试读取 `prototypes/task-ui/fixtures/dataset.json`。
- 当前 `createWideTaskFixture` 只有 Key、父 Key、标题和展示类型。实现必须兼容该现有导出，同时增加完整 profile、展示字段、依赖、索引和数据校验。
- `packages/contracts/src/tasks.ts` 是 Workspace Sync 的最小生产契约；本原型不修改它，也不把 fixture 状态提升为正式 API。
- 原型规范已经固定 seed、三个 profile、深度、宽度、依赖密度、展示类型、状态和标签；实际生成器必须把 JSON 规范作为可审计基线，而不是在组件中临时造数。
- ADR-008 固定 React/Vite、当前父级局部依赖、键盘可达和非颜色状态；用户进一步确认当前层本身用一幅有限 DAG 显示，右侧只使用详情抽屉和直接子任务列表。
- 根 `pnpm check` 依次覆盖 format、lint、全 workspace build、typecheck 和 test。Web 需要增加最小 Vitest 脚本来验证纯状态与布局逻辑，真实布局、焦点和性能由实际 Chromium 补足。
- 当前主机为 macOS `26.5.2` arm64。Task UI 与 Agent Context results 仍只有模板，Windows 入口不可用；这不影响 P-001，但使 P-002 当前不可即时规划。

## 3. 全局详细设计

### 3.1 组件与依赖方向

依赖方向固定为：

```text
dataset.json 规范
      ↓
@ngapd/test-fixtures 确定性生成、索引与校验
      ↓
apps/web/task-ui 纯查询、筛选、搜索、状态与有限 DAG 布局
      ↓
React 原型入口、DAG 视口、详情抽屉与浏览器证据
```

1. `@ngapd/test-fixtures`
   - 扩展 Task UI 的 profile、任务、Owner/角色、状态、标签、UTC 截止时间、子任务统计和同级依赖类型。
   - 用固定 seed 生成稳定 Task Key 与关系；提供按 profile 生成、索引、祖先链、有效 Owner 和同级 DAG 校验的纯接口。
   - 保留 `createWideTaskFixture` 的现有兼容行为，避免影响已有测试调用方。
   - 对重复 Key、孤儿父引用、跨父级边、自环、重复边和环返回稳定诊断，不生成部分可用数据。
2. `apps/web/task-ui`
   - 使用 `?prototype=task-ui` 选择隔离原型，允许可选 `profile` 参数作为初始 profile；未命中该参数时渲染原有 Workspace access 应用。
   - 从 `@ngapd/test-fixtures` 读取内存数据，不调用 TanStack Query、API、数据库或外部服务。
   - 将派生查询、搜索/筛选、导航快照、抽屉/选择状态和 DAG 布局保持为 React 组件外可测试的纯模块；React 只负责事件与呈现。
   - 使用统一 Task UI 类名前缀和独立样式文件，避免现有账号/配对全局样式被无意改变。
3. 有限 DAG 与抽屉
   - 不引入带无限画布/语义缩放默认行为的图编辑器。使用稳定的拓扑分层：predecessor 位于 successor 左侧，同 rank 节点按 Task Key 稳定排序；HTML 按钮节点覆盖在只读 SVG 有向边层上。
   - DAG 容器尺寸有限并可双向滚动；200 节点先采用确定布局与必要的视口裁剪，只有真实性能证据需要时再增加更细粒度虚拟化。
   - 节点使用 roving focus 或等价单一 Tab 入口；方向键在相邻布局节点间移动，Enter/Space 打开抽屉，`Escape` 关闭并把焦点还给来源节点。
   - 抽屉是右侧非模态覆盖层，不改变 DAG 布局。选中任务是抽屉打开的唯一状态来源；关闭、筛选隐藏、进入子任务视图都会清空选择。

### 3.2 数据、状态与交互契约

- 一个 profile 生成不可变 `tasks`、`dependencies` 和按 ID/Key/parent 建立的索引；所有可见投影从该事实集合派生，不回写夹具。
- `currentParentId = null` 表示虚拟项目根；DAG 节点恰好是 `parentTaskId` 等于当前作用域的任务，边恰好是两端都属于该节点集合的依赖。
- 客户端状态只包含 profile、当前父级、选中任务、筛选、搜索结果、搜索前快照和逐层视口快照。刷新重新生成同一数据并回到项目根、无选择、抽屉收起。
- 点击 DAG 节点只更新选择/抽屉。抽屉的直接子任务列表只展示摘要；唯一层级下降入口是当前任务的“进入子任务视图”按钮。
- 进入子任务视图时把当前选中任务设为新父级、保存旧作用域快照、清空选择并关闭抽屉。返回或面包屑恢复目标层的筛选与视口，但保持无选择和抽屉关闭。
- 项目级搜索按 Task Key 精确/前缀及标题不区分大小写包含匹配；选择结果恢复其父级 DAG 并打开目标抽屉。返回搜索前位置恢复完整页面快照。
- 当前层筛选按有效 Owner、逻辑角色、有效状态、截止时间和标签执行 AND；诱导子图只保留两端可见的边，并计算被隐藏关联数量。筛选隐藏选中节点时清空选择。
- 截止时间以 UTC 字符串存储，通过浏览器系统时区格式化；无效值属于夹具错误。

### 3.3 错误、安全、兼容与恢复

- fixture 生成或校验失败时显示完整原型错误状态，不渲染残缺 DAG；错误信息只包含 profile、稳定诊断码和合成 Task Key。
- Task UI 入口不得注册 API Query、读取 Cookie 内容、上传数据或引用外部资源；浏览器网络观察必须只有本地静态资源。
- 正常 Web 入口继续渲染现有账号/配对组件。入口分派只选择顶层组件，不在同一组件中条件调用 Hooks。
- 无数据库 migration、服务端状态、持久化缓存、后台作业、外部副作用或并发 writer。恢复只需停止临时 Web 服务并撤回本功能拥有的 Web/fixture/结果文件，不处理数据库或用户工作区。
- P-001 完成后，代码和 macOS 主体结果保持可构建并安全停在 `awaiting_next_phase`。P-002 只在外部前置满足后规划，先复核项目漂移，再执行 Windows core；不能用模拟浏览器或 macOS 结果代替。

### 3.4 验证与证据策略

- `relaxed` 模式允许先实现。共享 fixture 与纯状态/布局以 Vitest 验证确定性、负向数据、搜索/筛选、导航快照和布局方向；Web build/typecheck 验证集成。
- P-001 的最后一个任务统一执行根 `pnpm check`，避免后续 package/lock/CSS 变化使较早的全局证据失效。
- 在真实 macOS Chromium、至少 1280×720、100% 缩放中对三个 profile 执行功能、键盘、焦点、非颜色状态和性能路径；通过 Performance API 或等价浏览器时钟记录重复交互 P95、首次可交互及 200 节点滚动响应。
- `prototypes/task-ui/results/` 新增 macOS 主体结果和可追溯截图/trace，不覆盖模板或历史结果。真实秘密、业务正文、个人目录和浏览器会话材料不得进入证据。
- P-002 最终只重跑可能被 P-001 后项目漂移影响的共享门禁，并在 Windows 11 x64 真实 Chromium 执行 core 浏览器矩阵；最终汇总所有 `FND-I-*` 后才能封存。

## 4. 阶段路线图

| 阶段 | 目标 | 关联需求与验收 | 前置阶段 | 退出条件 | 当前状态 |
| --- | --- | --- | --- | --- | --- |
| P-001 | 交付确定性 Task UI 原型、自动化和 macOS Chromium 主体结果 | `FR-001`–`FR-027`; `AC-001`–`AC-018`, `AC-020`–`AC-022`；持续保持 `FR-028`/`AC-019` 的最终等待约束 | 无 | 所有 P-001 core 与硬门禁通过；supplemental 通过、未执行的可选广泛检查被明确记录，或异常形成合规 `FND-I-*`；macOS 主体结果为 `pass`，项目可构建 | ready |
| P-002 | 在外部前置满足后完成 Windows 11 x64 core 兼容、最终漂移复核与工作流封存 | `FR-028`; `AC-019`；最终复核 `FR-001`–`FR-027` / `AC-001`–`AC-018` 及全部开放 finding | P-001 完成；Agent Context 主体有可追溯 `pass` 结果；真实 Windows 11 x64 浏览器入口可执行 | Windows core 和必要共享门禁通过；全部 core 与硬门禁闭合，supplemental/finding 合规汇总；可创建最终记录与有效需求快照 | planned |

P-001 和 P-002 都必须结束于可构建或只读安全等待状态。当前只为 P-001 创建即时阶段计划；P-002 在前置未满足时不得创建空壳计划。

## 5. 跨阶段依赖与不变量

- 任一时刻只显示当前父级作用域的一幅有限 DAG；不得在 P-002 或后续修正中引入第二幅 DAG、无限画布、语义缩放或跨父级边。
- 未选择任务时抽屉关闭；选择只来自当前 DAG；关闭、筛选隐藏或进入下一层都必须清空选择。
- 直接子任务始终是抽屉内列表；下降层级始终只通过专用按钮，并在进入后关闭抽屉且不自动选择节点。
- 原型数据始终是固定 seed 的合成内存事实；不得迁移到生产 Task 契约、数据库或外部服务。
- 正常账号/配对入口、API、Workspace CLI、数据库和服务端权威行为不得因原型而改变。
- 每阶段完成时根工程保持可构建，结果证据不含真实秘密、业务内容或个人绝对路径。
- P-001 macOS 主体 `pass` 可以解锁 Agent Context 主体，但不能生成 `change-0.md`；P-002 Windows core 未通过前整个 initial run 不得完成。
- P-002 规划前必须读取 P-001 不可变结果、当前 state、Agent Context 主体结果和项目现状；如果共享 Web/fixture 已漂移且处理方式不唯一，先暂停而不是猜测。

## 6. 最终集成与整体验证流程

1. P-001 完成 fixture、纯状态/布局、React 原型和文档入口后，运行目标测试、Web build/typecheck 与一次最终根 `pnpm check`。
2. 在真实 macOS Chromium 中依次验证顶级 DAG、详情抽屉、直接子任务列表、专用下降、8 层往返、项目搜索恢复、当前层 AND 筛选、依赖方向、三种展示类型、错误/空状态、键盘、焦点和非颜色表达。
3. 在 `wide-siblings` 上记录暖缓存首次可交互、选择/搜索/筛选/层级切换 P95 和 200 节点滚动；在 `dense-dag` 上确认方向与可读性不通过隐藏有效边来获得。
4. 复核 Task UI 入口无 API/外部请求，正常 Workspace access 入口仍存在且工程门禁通过；写入 macOS 主体 result 和 P-001 不可变阶段结果，运行安全停在 `awaiting_next_phase`。
5. 等待 Agent Context 主体 `pass` 与真实 Windows 11 x64 入口；之后单独调用 `$plan-feature-implementation`，只即时创建 P-002 计划。
6. P-002 先复核 P-001 证据与后续项目漂移，只重跑会被漂移影响的共享检查；随后在 Windows 11 x64 真实 Chromium 重复 core 路径和性能可用性检查。
7. 全部 core、硬门禁和 finding 处置一致后，P-002 才能形成不可变结果、`change-0.md` 与 `effective-requirements.md`；relaxed report-only 项以连续 `FND-I-*` 汇总。

## 7. 需求追踪矩阵

| 需求与验收 | 阶段 | 实现落点 | 验证 |
| --- | --- | --- | --- |
| `FR-001`, `FR-002`, `FR-026`; `AC-001`, `AC-016`, `AC-017` | P-001；P-002 最终漂移复核 | Web 顶层入口分派、原 Workspace access 组件、无网络 fixture 边界 | Task 入口网络观察、正常入口冒烟、目标 Web 检查与最终根门禁 |
| `FR-003`–`FR-005`, `FR-024`, `FR-025`; `AC-002`, `AC-007`, `AC-015` | P-001 | `@ngapd/test-fixtures` 生成/索引/校验、Web 错误与空状态 | 确定性快照/计数、负向树/DAG 数据、空结果与恢复测试 |
| `FR-006`–`FR-008`; `AC-003` | P-001；P-002 Windows 复核 | 纯拓扑布局、有限滚动视口、SVG 有向边和可访问节点 | 同级诱导图、孤立节点、箭头方向、无跨层/环及 36/200 节点浏览器检查 |
| `FR-009`–`FR-015`; `AC-004`–`AC-007` | P-001；P-002 Windows 复核 | 选择/抽屉状态、详情与子任务列表、专用进入按钮、焦点恢复 | 纯状态转换、React 交互、指针与键盘真实浏览器路径 |
| `FR-016`–`FR-020`; `AC-008`–`AC-011` | P-001；P-002 Windows 复核 | 面包屑/层级快照、项目搜索、当前层过滤和隐藏边计数 | 8 层往返、搜索定位/恢复、多条件 AND、隐藏选择/边检查 |
| `FR-021`–`FR-023`; `AC-012`, `AC-013` | P-001；P-002 Windows 复核 | 展示类型样式、roving focus、刷新初始状态 | 等价交互、非颜色标记、键盘/焦点、刷新恢复检查 |
| `FR-027`; `AC-014`, `AC-018` | P-001 | macOS Chromium 验收和 `prototypes/task-ui/results/**` | 三 profile 主体路径、重复交互 P95、滚动/首次可交互、环境与证据记录 |
| `FR-028`; `AC-019` | P-002 | Windows 11 x64 真实浏览器与最终工作流证据 | Windows core 矩阵、后续漂移相关共享门禁和最终汇总 |
| `AC-020`–`AC-022` | P-001 supplemental；P-002 仅在相关漂移时复核 | 扩展 profile、可选浏览器、性能/布局诊断 | relaxed 下执行低成本附加检查；异常只有证明不影响 core 后才能登记 `FND-I-*` |

覆盖结论：`FR-001`–`FR-028` 与 `AC-001`–`AC-022` 均映射到实现、平台验收或最终外部门禁；P-002 拥有完整集成与最终完成结论。

## 8. 风险、技术决策与修订记录

### 8.1 风险与处置

| 风险 | 级别 | 处置 |
| --- | --- | --- |
| 200 节点与中密度边导致布局、滚动或交互超过 200 ms | 高 | 使用 O(V+E) 拓扑分层和稳定索引，布局/过滤 memo 化；先以真实 profile 测量，再只对可见绘制增加裁剪，不隐藏节点或有效边 |
| 密集 DAG 边交叉造成方向不可读 | 高 | 固定左到右 rank、箭头和非颜色方向信息，选中节点突出直接前后关系；36 节点真实浏览器检查阻塞 P-001 |
| 抽屉、选择、过滤和层级快照产生状态漂移 | 高 | 用单一纯状态模型定义不变量并目标测试；React 不另存重复 drawer/selection 事实 |
| 原型入口触发现有身份 Query 或 CSS 污染正常页面 | 高 | 顶层组件分派后才挂载对应子应用；Task UI 不 import API 层，样式使用前缀；正常入口冒烟和根门禁阻塞 |
| fixture 状态误入生产 Task 契约 | 中 | 只扩展私有 `@ngapd/test-fixtures`，Web 显式依赖该包；不修改 `packages/contracts/src/tasks.ts` 或数据库 |
| 浏览器性能结果受环境或测量方法影响 | 中 | 记录硬件、浏览器、视口、缩放、样本和测量点；功能正确性与性能分别判断，证据不足使用 `inconclusive` |
| P-001 后长期等待 Windows 导致共享 Web 漂移 | 中 | P-001 形成不可变结果并安全等待；P-002 即时规划时先做指纹/项目漂移审计，只重跑被影响检查 |

### 8.2 技术决策

| ID | 决策 | 依据与影响 |
| --- | --- | --- |
| TD-001 | 原型入口使用 `?prototype=task-ui`，可选 `profile` 指定初始数据 | 不引入正式路由器即可保持正常入口和无数据库运行；后续 M3 可独立决定生产路由 |
| TD-002 | 完整合成数据与校验进入 `@ngapd/test-fixtures`，Web 以 workspace dependency 消费 | 复用现有确定性夹具惯例，保证生成/校验可脱离 React 测试；该私有依赖只服务隔离原型 |
| TD-003 | 使用自有纯拓扑分层 + HTML 按钮节点 + SVG 边，不新增图编辑器运行时依赖 | 200/36 节点规模可用线性布局验证，避免引入无限画布、语义缩放和不必要交互语义 |
| TD-004 | 抽屉开关由 `selectedTaskId` 单一派生，导航/搜索使用显式快照 | 直接满足关闭、进入、过滤与恢复不变量，避免多份 React state 漂移 |
| TD-005 | 路线图采用两个 compact 阶段 | P-001 是完整 macOS 主体；P-002 是需求明确的 Agent Context/Windows 外部交接与最终兼容门禁 |

### 8.3 修订记录

| 修订 | 日期 | 原结论 | 原因与证据 | 影响阶段 | 追踪影响 |
| --- | --- | --- | --- | --- | --- |
| 1 | 2026-07-25 | 初始路线图 | schema 3.2 完整审计通过；用户明确选择 relaxed、单 DAG/抽屉交互和 macOS 优先/Windows 最后；当前代码确认无 Task UI、无 migration 或不可逆风险，Windows 是唯一独立外部交接 | P-001、P-002 | 首次建立 `FR-001`–`FR-028` 与 `AC-001`–`AC-022` 完整映射 |
