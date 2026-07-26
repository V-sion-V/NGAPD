# 平铺树状 Task UI 原型：当前有效需求

- 派生状态：可重新生成
- 原始需求：[`requirements.md`](requirements.md)
- 已应用至修改记录：[`change-0.md`](change-0.md)
- 生成日期：2026-07-26
- 当前交付与验证策略：`relaxed`
- 当前验证结论：`passed`

## 1. 当前目标与范围

当前有效目标是在现有 React/Vite Web 中保留一个可重复进入的、夹具驱动的平铺树状 Task UI 原型，用于验证 H-005：用户不依赖语义缩放、无限画布、递归子图或第二幅 DAG，仍可通过“当前父级的一幅有限 DAG + 右侧非模态详情抽屉 + 直接子任务列表 + 专用下降按钮 + 面包屑/返回”理解深层任务分解和同级依赖。

当前范围包括固定 seed 的三个 profile、完整展示字段、同父级有向依赖、抽屉/选择一致性、层级快照、项目搜索、当前层五类 AND 筛选、中文桌面键盘交互、非颜色表达，以及 macOS Apple Silicon 和 Windows x64 真实 Chromium/Chrome core 证据。正常 Workspace access 注册、登录、配对和设备入口保持原行为。

当前范围不包括正式 Project/Task API、数据库、任务写入/编辑、权限执行、评论、通知、活动流、实时协作、服务端搜索/分页、生产路由、移动端、无限画布、语义缩放、递归子图、第二幅同时可见 DAG、外部 API/AI/LLM 或真实项目内容。

## 2. 当前生效需求

| 当前编号 | 当前生效内容 | 验收要求与层级 | 来源 |
| --- | --- | --- | --- |
| `FR-001` | 现有 Web 提供隔离 Task UI 原型入口；使用确定性内存夹具，不要求登录、PostgreSQL、Task API 或外部网络。 | `AC-001` core | `requirements.md` |
| `FR-002` | 原型入口不得改变现有账号、会话、设备配对和撤销入口的可观察行为。 | `AC-001`, `AC-017` core | `requirements.md` |
| `FR-003` | 固定 seed/profile 必须稳定生成唯一 Task Key、树、同级依赖、正文、Owner/继承、角色、状态、UTC 截止时间、标签、展示类型和子任务统计。 | `AC-002` core | `requirements.md` |
| `FR-004` | 完整支持 `deep-tree`、`wide-siblings`、`dense-dag`，分别覆盖 8 层、200 个直接子任务和 36 节点密集无环依赖。 | `AC-002`, `AC-003` core | `requirements.md` |
| `FR-005` | 有效状态为未开始、进行中、已阻塞、已完成；阻塞可派生，归档不混入活动 DAG。 | `AC-002` core | `requirements.md` |
| `FR-006` | 任一时刻只渲染虚拟项目根或普通任务当前作用域的一幅 DAG，节点恰好是直接子任务。 | `AC-003` core | `requirements.md` |
| `FR-007` | DAG 展示全部可见同级节点和孤立节点；边明确为 predecessor → successor，且无跨父级、自环或环。 | `AC-003` core | `requirements.md` |
| `FR-008` | DAG 位于有限可滚动视口；可裁剪/聚焦，但不得使用无限画布、语义缩放、递归子图或第二幅 DAG。 | `AC-003`, `AC-014` core | `requirements.md` |
| `FR-009` | 项目根和新作用域初始无选择、抽屉收起，不自动选择任务。 | `AC-004` core | `requirements.md` |
| `FR-010` | 选择 DAG 节点打开右侧非模态抽屉；改选只替换内容，不改变作用域或 DAG 布局。 | `AC-004` core | `requirements.md` |
| `FR-011` | 抽屉展示 Task Key、标题、正文、显式/有效 Owner、继承来源、角色、有效状态、本地化截止时间、标签、展示类型和直接子任务统计。 | `AC-004` core | `requirements.md` |
| `FR-012` | 抽屉以非 DAG 列表展示直接子任务摘要；列表行不承担层级下降。 | `AC-006` core | `requirements.md` |
| `FR-013` | 抽屉可由右上角按钮或 `Escape` 收回；清除选择/高亮，保留层级、搜索、筛选、视口和滚动，焦点返回来源节点。 | `AC-005` core | `requirements.md` |
| `FR-014` | 只有抽屉内“进入子任务视图”可下降；没有直接子任务时按钮禁用并说明原因。 | `AC-006`, `AC-007` core | `requirements.md` |
| `FR-015` | 下降后 DAG 整体替换为所选任务的直接子任务/同级依赖，抽屉收起、选择清空且不自动选择首节点。 | `AC-006` core | `requirements.md` |
| `FR-016` | 面包屑表达祖先链；返回恢复上一作用域 DAG、筛选、搜索、视口和滚动，同时保持无选择/抽屉收起。 | `AC-008`, `AC-009` core | `requirements.md` |
| `FR-017` | 项目搜索支持 Task Key 精确/前缀和标题不区分大小写包含；选择结果恢复祖先链、父级 DAG 并打开目标详情。 | `AC-010` core | `requirements.md` |
| `FR-018` | 搜索导航前保存完整位置；“返回搜索前位置”恢复作用域、视口、滚动、筛选、选择和抽屉。 | `AC-010` core | `requirements.md` |
| `FR-019` | Owner、角色、状态、截止时间、标签只过滤当前 DAG并按 AND 组合；只保留两端可见的边并提示隐藏关联。 | `AC-011` core | `requirements.md` |
| `FR-020` | 筛选隐藏选中节点时清除选择并收起抽屉。 | `AC-011` core | `requirements.md` |
| `FR-021` | 普通、冲刺、里程碑只改变非纯色外观，不改变选择、导航、依赖、状态或筛选语义。 | `AC-012` core | `requirements.md` |
| `FR-022` | 节点、搜索、筛选、面包屑、返回、抽屉和下降按钮可通过键盘操作；焦点可见，状态/方向/类型不只用颜色表达。 | `AC-013` core | `requirements.md` |
| `FR-023` | 刷新可确定性回到项目根、无选择、抽屉收起；不依赖持久化选择、URL 深链或浏览器历史。 | `AC-004`, `AC-013` core | `requirements.md` |
| `FR-024` | 重复 Key、缺失父任务、跨父级依赖、自环或环在展示前稳定拒绝并显示可诊断错误。 | `AC-015` core | `requirements.md` |
| `FR-025` | 空 DAG、无搜索/筛选结果和无直接子任务都有明确空状态及恢复入口。 | `AC-007` core | `requirements.md` |
| `FR-026` | 不读取/发送真实项目内容，不调用外部 API/AI/LLM，不改变服务端 Task、Workspace 或身份数据。 | `AC-016` core | `requirements.md` |
| `FR-027` | macOS Apple Silicon 真实 Chromium 覆盖三 profile、深层往返、200 节点、搜索/筛选、方向、抽屉、键盘、非颜色和性能，并保留可追溯结果。 | `AC-014`, `AC-018` core | `requirements.md` |
| `FR-028` | Windows x64 真实浏览器重复并通过 Task UI core；通过前工作流不得最终封存。 | `AC-019` core | `requirements.md` |

## 3. 当前流程

1. 打开 `?prototype=task-ui`，系统生成并校验选定 profile，以虚拟项目根显示一幅有限 DAG；初始无选择和抽屉。
2. 通过指针或键盘选择当前 DAG 节点，右侧抽屉原位显示详情和直接子任务列表；关闭后清除选择并恢复节点焦点。
3. 只有抽屉专用按钮可以把当前任务变为新父级；进入后选择/抽屉清空。返回和面包屑恢复对应层级的筛选与视口快照。
4. 项目搜索定位深层任务并保留搜索前完整页面快照；返回搜索前位置后原状态恢复。
5. 当前层 Owner、角色、状态、截止时间和标签按 AND 过滤节点及诱导边；隐藏选中节点时详情同步清除。
6. 刷新回到 URL 指定 profile 的项目根、无选择和抽屉收起。
7. 真实浏览器执行新增而不覆盖历史的主体记录；core 全部通过才可使用 `pass`。

## 4. 当前数据、接口与状态

- profile 固定 seed `20260724`、Project Key `ZERO`，产生不可变任务、依赖和索引；可见投影不回写夹具。
- 任务包含稳定 ID/Key、父引用、标题/正文、显式/有效 Owner 与来源、角色、基础/有效状态、UTC 截止时间、标签、展示类型和直接子任务统计。
- 依赖包含 predecessor/successor ID；两端必须同项目、同父级且不同，不重复并在各作用域无环。
- `currentParentId = null` 表示虚拟项目根。客户端只维护 profile、当前父级、选中任务、筛选、搜索、搜索前快照和逐层视口快照。
- 选中任务是抽屉打开的单一事实来源；fixture 生成、索引、校验、搜索/筛选、状态转换和布局可脱离 React 验证。
- Task UI 只消费本地 `@ngapd/test-fixtures/task-graph`，不修改生产 Task contract、数据库或公共 API。

## 5. 当前异常、边界、安全与恢复

- 重复 ID/Key、孤儿、跨项目/跨父级边、缺失端点、自环、重复边、环和无效 UTC 均在渲染前稳定拒绝。
- 空作用域、无搜索/筛选结果和叶任务均显示明确状态与恢复/禁用原因；不得保留其他作用域节点、边或详情。
- Task UI 不挂载身份 Query，不读取 Cookie 内容，不引用外部资源，不上传数据，不处理真实项目正文或秘密。
- 正常 Workspace access 与其授权边界保持；Task UI 不能改变账号、设备、Workspace 或服务端 Task 数据。
- 无 migration、持久化缓存、后台作业、外部写入或并发 writer。运行恢复只涉及停止临时 Web 服务、恢复临时浏览器视口和关闭验收标签页。
- 项目文件恢复必须保留用户无关工作；不得用 destructive reset 覆盖用户修改。

## 6. 当前非功能要求

- 真实主体视口至少 1280×720、100% 缩放；中文桌面 UI、键盘可达、可见焦点和非颜色状态为 core。
- 暖缓存首次可交互 `< 3 s`；夹具就绪后的选择、搜索、筛选和层级切换 P95 `≤ 200 ms`。
- `wide-siblings` 的 200 节点连续滚动必须保持响应、无空白/错选/节点边错位；不得通过隐藏节点、丢边或改变筛选语义达标。
- 当前主体兼容环境为 macOS Apple Silicon Chromium 与 Windows x64 Chrome；Safari/Firefox 属于可选 supplemental。
- Web、共享 fixture 和相关 workspace 必须保持 format、lint、build、typecheck 和适用测试通过；正常入口不得回归。
- 每次真实执行新增包含结论、Git 基线、浏览器、视口/缩放、硬件、profile、路径、测量方法和相对证据的结果，不覆盖历史。

## 7. 当前验收要求

| 验收 | 层级 | 当前可观察要求 | 当前状态 |
| --- | --- | --- | --- |
| `AC-001` | core | 无登录/数据库/API/外部服务即可打开 Task UI；正常账号/设备入口保持。 | passed |
| `AC-002` | core | 相同 seed/profile 生成完全稳定；8 层、200 子任务、36 节点密集 DAG 符合规范。 | passed |
| `AC-003` | core | 每个作用域只有一幅同级 DAG；全部节点/孤立节点可达，边方向正确且无跨层、自环、环。 | passed |
| `AC-004` | core | 新作用域无选择/抽屉；选择展示完整详情，改选不重排 DAG。 | passed |
| `AC-005` | core | 关闭/`Escape` 清除选择并恢复焦点，保留层级、筛选、搜索和视口。 | passed |
| `AC-006` | core | 直接子任务列表不导航；只有专用按钮下降，进入后选择/抽屉清空。 | passed |
| `AC-007` | core | 叶任务禁用下降并说明原因；各类空状态有恢复入口。 | passed |
| `AC-008` | core | 可从根逐层进入深树最深层，并通过返回/面包屑稳定恢复任意祖先。 | passed |
| `AC-009` | core | 返回恢复上一层 DAG、筛选、搜索、视口/滚动，保持无选择/抽屉。 | passed |
| `AC-010` | core | Key/标题搜索定位深层任务并打开详情；返回搜索前位置恢复完整页面状态。 | passed |
| `AC-011` | core | 五类筛选按 AND；边只连接可见端点，隐藏关联明确，隐藏选择同步清除。 | passed |
| `AC-012` | core | 三种展示类型非纯色区分且交互语义一致。 | passed |
| `AC-013` | core | 所有主要操作键盘可达、焦点可见、状态/方向不只依赖颜色。 | passed |
| `AC-014` | core | macOS Chromium 交互 P95 `≤ 200 ms`、暖缓存 `< 3 s`，200 节点滚动稳定。 | passed |
| `AC-015` | core | 无效树/DAG 数据稳定拒绝且不渲染误导性部分结果。 | passed |
| `AC-016` | core | 不读取/发送真实内容，不改变服务端 Task、身份或 Workspace 数据。 | passed |
| `AC-017` | core | Web、fixture、测试保持构建/类型正确，正常账号/配对 core 不回归。 | passed |
| `AC-018` | core | macOS 真实 Chromium 主体记录完整且结论为 `pass`。 | passed |
| `AC-019` | core | Windows x64 真实 Chrome core 记录完整且结论为 `pass`。 | passed |
| `AC-020` | supplemental | 超过 200 同级节点仍可搜索、筛选、滚动。 | optional / not run |
| `AC-021` | supplemental | 非主体桌面浏览器附加检查不影响 core。 | optional / not run |
| `AC-022` | supplemental | 截图、性能样本和布局/网络诊断可解释主体行为。 | passed |

## 8. 当前决策

| 决策项 | 当前结论 | 来源 |
| --- | --- | --- |
| 交付策略 | `relaxed`；core 和硬门禁阻塞，独立证明无影响的 supplemental 异常才可 report-only。 | 用户明确确认 |
| 原型宿主 | 使用现有 `apps/web` 的隔离查询参数入口，不建立独立前端应用或正式路由。 | 原始需求 / ADR-008 |
| 数据来源 | 固定 seed 的确定性内存 fixture，不要求登录、数据库或 Task API。 | 原始需求 |
| 任务状态 | 使用独立原型有效状态语义，不扩展 Workspace Sync 最小生产状态契约。 | 原始需求 / 项目约束 |
| 主视图 | 当前父级兄弟任务只显示为一幅有限 DAG；直接子任务只在抽屉内以列表呈现。 | 用户明确确认 |
| 详情与下降 | 右侧非模态抽屉；关闭清除选择；只有专用按钮下降，进入后清空选择/抽屉。 | 用户明确确认 |
| 搜索与筛选 | 项目级搜索定位并可恢复；当前层五类筛选按 AND。 | 原始需求 |
| 恢复 | 刷新回项目根；URL 深链和浏览器历史不属于 core。 | 原始需求 |
| 平台顺序 | macOS 主体先完成，Windows x64 core 最后集中验证；两者均已通过。 | 用户明确确认 |
| 性能 | 暖缓存 `< 3 s`；主要交互 P95 `≤ 200 ms`；200 节点滚动保持响应和正确性。 | 原始需求 / 项目约束 |
| 结果状态 | 真实主体只能为 `pass`、`fail` 或 `inconclusive`；core 全部通过才可 `pass`。 | 原始需求 |

## 9. 已替换或退役项目

无。`change-0.md` 是原始需求的首次实现记录，没有新增 `RC-*` 需求增量、删除项或替换项。`AC-020`/`AC-021` 保持有效但可选，并未退役。

## 10. 来源链

- 原始需求：[`requirements.md`](requirements.md)，SHA-256 `222a3f69cef2d36970c621336398792cfa3056bf342597c9822230d6582a99a0`
- 初始路线图：[`implementation-plan.md`](implementation-plan.md)，revision 1，SHA-256 `32e027d7698f367572ad85d39b8713f75153c8310ce0cc73964f478858127375`
- P-001：[`phase-001-plan.md`](execution/initial/phase-001-plan.md) revision 2 → [`phase-001-result.md`](execution/initial/phase-001-result.md) `passed`
- P-002：[`phase-002-plan.md`](execution/initial/phase-002-plan.md) revision 1 → [`phase-002-result.md`](execution/initial/phase-002-result.md) `passed`
- 主体证据：[macOS Chromium `pass`](../../../prototypes/task-ui/results/2026-07-25-macos-m2-chromium.md)；[Windows Chrome `pass`](../../../prototypes/task-ui/results/2026-07-26-windows-x64-chromium.md)
- 初始记录：[`change-0.md`](change-0.md)
- 当前没有开放 `FND-I-*`；下一可用 initial finding ID 为 `FND-I-001`。
