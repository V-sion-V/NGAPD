# P-001：Task UI 原型与 macOS 主体验证

- 运行编号：`initial`
- 阶段编号：`P-001`
- 计划修订：`2`
- 父路线图修订：`1`
- 需求指纹：`sha256:222a3f69cef2d36970c621336398792cfa3056bf342597c9822230d6582a99a0`
- 项目基线：分支 `prototype`，提交 `bcae1aa1c66081c67ecbb9f6391b9613927f775a`
- 创建日期：`2026-07-25`
- 详细度：`compact`
- 交付与验证策略：`relaxed`
- 验证结论：`pending`

## 1. 阶段目标、边界与关联需求

交付一个不依赖登录、数据库、Task API 或外部网络的确定性 Task UI 原型，在现有 Web 中实现单幅有限 DAG、右侧非模态详情抽屉、直接子任务列表、专用层级进入、搜索/筛选/恢复、键盘与非颜色状态，并在真实 macOS Apple Silicon Chromium 中形成可追溯主体 `pass` 结果。

本阶段覆盖 `FR-001`–`FR-027` 与 `AC-001`–`AC-018`；`AC-020`–`AC-022` 是 supplemental。`FR-028`/`AC-019` 的 Windows core 不在本阶段执行，但“P-001 后安全等待且不最终封存”是本阶段出口硬约束。

不在本阶段实现或修改：正式 Project/Task API、`packages/contracts/src/tasks.ts` 的生产状态、数据库/migration、任务写入、权限、评论、通知、实时协作、正式前端路由、无限画布、语义缩放、第二幅 DAG、移动端、Agent Context、Windows 验收或 Workspace CLI 产品代码。唯一例外是最终根门禁实际暴露且已隔离证明的 `apps/workspace-cli/src/mcp.integration.test.ts` 服务就绪竞态；允许在 T-003 内只修正测试同步，不改变产品实现或 CLI 行为。

开始第一个任务前必须确认：

- requirements、路线图和本计划的 revision/指纹一致，不存在 `change-0.md`、P-001 result 或另一活动阶段。
- Git 除当前工作流文档外没有与本阶段范围重叠的用户修改；若出现重叠且所有权不唯一，先暂停。
- 执行 `nvm use "$(cat .node-version)"` 后 Node 为 `v24.18.0`，pnpm 为 `11.9.0`。
- `prototypes/task-ui/fixtures/dataset.json` 与 results 模板仍是需求审计时的规范，现有 Workspace access 行为尚未被其他工作改变。

## 2. 任务与文件范围

| 任务 | 结果 | 文件或范围 | 实现摘要 | 验证 | 完成条件 |
| --- | --- | --- | --- | --- | --- |
| `P-001-T-001` | 完整、确定且可拒绝无效数据的 Task UI fixture/索引层 | `packages/test-fixtures/src/task-graph.ts` 或新增同职责模块、`index.ts`、对应测试；只读使用 `prototypes/task-ui/fixtures/dataset.json` | 扩展 profile、任务、Owner/继承、角色、状态、截止时间、标签、统计和依赖类型；按固定 seed 生成 deep/wide/dense 数据；建立 Task/parent/ancestor 索引和同级 DAG 校验；保留现有 `createWideTaskFixture` 兼容导出 | 运行 test-fixtures 目标 test、build、typecheck；验证相同输入稳定、8 层/200/36 计数、同父 DAG/无环、Owner/时间/标签字段，以及重复 Key、孤儿、跨层边、自环、重复边和环的稳定拒绝 | `FR-003`–`FR-005`、`FR-024`、`FR-025` 的纯数据结果可由 Web 消费；目标门禁通过，实际文件/证据/偏差写入 state |
| `P-001-T-002` | 现有 Web 中可完整操作且不触发 API 的单 DAG/抽屉原型 | `apps/web/package.json`、`pnpm-lock.yaml`、`apps/web/src/App.tsx`、新增 `apps/web/src/task-ui/**` 与前缀样式/测试；`prototypes/task-ui/README.md` 的入口和交互说明 | 用 `?prototype=task-ui` 顶层分派隔离原型；Web 依赖 `@ngapd/test-fixtures`；实现纯搜索/筛选/导航快照/选择状态与拓扑布局，HTML 按钮节点 + SVG 边、有限滚动视口、roving focus、非模态抽屉、直接子任务列表和专用进入按钮；不新增图编辑器依赖 | 运行 Web 目标 test、build、typecheck；纯测试覆盖单 DAG、抽屉/选择、进入/返回、搜索恢复、AND 筛选/隐藏边、刷新初态、拓扑方向；本地浏览器冒烟确认 Task 入口无 API、正常入口仍渲染 Workspace access | `FR-001`、`FR-002`、`FR-006`–`FR-023`、`FR-026` 的实现完成；所有目标检查通过，现有正常入口和生产契约不回归 |
| `P-001-T-003` | macOS Chromium 主体证据和 P-001 完整门禁闭合 | P-001 实现范围内仅限验证发现的 core 修正；`prototypes/task-ui/results/**`；当前 execution state 与阶段 result；若根门禁复现已隔离的服务就绪竞态，仅限 `apps/workspace-cli/src/mcp.integration.test.ts` 的测试同步 | 在真实 macOS Chromium 对三个 profile 执行指针/键盘功能、焦点/非颜色、深层往返、搜索/筛选、错误/空状态与性能路径；记录环境、样本、P95、滚动、截图/trace；最后执行一次根质量门并形成主体 result；测试同步必须等待 MCP 初始化完成后再发送信号，不触碰产品代码 | 真实浏览器矩阵、Performance API 或等价测量、网络观察、正常入口冒烟、最终 `pnpm check`、范围/秘密/外部请求审查、结果模板完整性检查 | `AC-001`–`AC-018` 全部通过；supplemental 通过、明确记录未执行的可选广泛检查，或仅有合规 `FND-I-*`；macOS result 为 `pass`，P-001 可写不可变 result 并安全等待 P-002 |

依赖：`P-001-T-002` 依赖 T-001 冻结 fixture 接口；`P-001-T-003` 依赖 T-001/T-002 完成。每个任务只有在其目标门禁通过并把实际文件、结果与偏差写入 state 后才能开始下一任务。

## 3. 验证与完成条件

### 3.1 Core 阻塞门禁

1. 环境与范围
   - Node 必须为 `v24.18.0`，pnpm 必须为 `11.9.0`。
   - Git 范围只包含本阶段拥有的 fixture、Web、prototype 说明/结果、package/lock 和工作流执行证据；不得修改生产 Task contract、API、数据库、Workspace CLI 或无关文档。
2. 确定性 fixture 与负向数据
   - `@ngapd/test-fixtures` 的 test、build、typecheck 全部通过。
   - 三 profile 重复生成稳定；深度 8、宽度 200、密集 36、稳定 Key、完整字段和同级无环边符合规范。
   - 重复 Key、孤儿父引用、跨父级边、自环、重复边和环在展示前被稳定拒绝；空 profile/搜索/筛选/子任务有明确恢复路径。
3. Web 目标验证
   - Web 的 Task UI 纯状态/布局测试、build 和 typecheck 通过。
   - `?prototype=task-ui` 不挂载身份 Query 或发出 `/api`/外部请求；无该参数时仍进入原 Workspace access。
   - 任一时刻只有当前父级一幅 DAG；孤立节点和所有有效方向边存在，不出现跨层边、第二幅 DAG、无限画布或语义缩放。
   - 未选择时抽屉关闭；节点选择、替换选择、关闭/`Escape`、焦点返回、列表非导航、专用进入、无子项禁用、进入后清空、返回/面包屑、搜索恢复和过滤隐藏选择均符合需求。
4. 真实 macOS Chromium
   - 记录 macOS/arm64、Chromium 版本、至少 1280×720、100% 缩放、硬件摘要和 Git commit。
   - 对 `deep-tree` 完成项目根到最深任务及逐级返回；对 `wide-siblings` 完成 200 节点滚动、选择、搜索、筛选和层级切换；对 `dense-dag` 确认 36 节点方向、孤立节点和选中前后关系。
   - 用键盘完成 DAG 聚焦/移动/选择、搜索、筛选、抽屉关闭、进入与返回；焦点可见，状态、展示类型、选中和方向不只用颜色表达。
   - 暖缓存首次可交互小于 3 s；夹具就绪后对选择、搜索、筛选和层级切换分别采集足够重复样本计算 P95，均不超过 200 ms；200 节点连续滚动保持输入可响应且无空白、错选或节点/边错位。
5. 最终工程与证据
   - 在最后一次可能影响 package、lock、fixture、Web 或 CSS 的修正之后执行一次根 `pnpm check`，完整通过 format、lint、build、typecheck 和适用测试。
   - Task UI 路由网络观察、源码范围和 Git diff 确认没有真实业务内容、外部服务、Cookie 读取、数据库/API/Workspace 写入或秘密。
   - `prototypes/task-ui/results/` 新增符合模板的 macOS 结果及可追溯视觉/性能证据；结论只有全部主体 core 通过时才是 `pass`。

任一 core、构建、正常 Web 兼容、安全、数据校验、键盘、性能或证据完整性失败都阻塞当前任务/阶段。不得为完成阶段降低 AC 层级或把未知影响登记为 report-only。

### 3.2 Supplemental 与 finding

- `AC-020`：在不扩大实现的前提下，可用参数化 fixture 检查超过 200 节点仍可搜索、筛选和滚动；不要求达到 200 节点主体性能数值。
- `AC-021`：Safari、Firefox 或其他非主体浏览器是可选广泛回归；未执行必须明确记录为 optional/not run，不构成 core 失败或伪造 finding。
- `AC-022`：优先保留能解释 200/36 节点布局和性能的 trace/截图；额外诊断缺失不影响已经独立证明的 core。
- supplemental 出现异常时，只有证据证明不影响 core 交付行为，才能从 `FND-I-001` 起连续编号，记录类别、严重程度、关联需求/AC、证据、影响、处置、置信度和建议后续。不得只为 report-only finding 安排重复诊断或额外修复任务。

### 3.3 阶段完成条件

- T-001、T-002、T-003 均在 execution state 中有任务前/后检查点、实际文件、验证、偏差和 finding。
- P-001 core 与硬门禁全部通过，验证结论为 `passed` 或只含合规 finding 的 `passed_with_findings`；macOS Task UI 主体 result 为 `pass`。
- 项目保持可构建；没有未决产品问题、用户工作重叠、活动 Web 服务、真实数据/秘密、未知外部状态或半完成实现。
- 创建不可变 `phase-001-result.md` 后把运行置为 `awaiting_next_phase`，当前任务与阶段活动状态清空。
- 本次 P-001 实现 invocation 不创建 P-002 计划、`change-0.md` 或 `effective-requirements.md`。P-002 只有在 Agent Context 主体和真实 Windows 入口都满足后才能独立规划。

## 4. 风险、恢复与修订记录

### 4.1 风险与恢复

- 200 节点性能：先使用纯 O(V+E) 拓扑分层、稳定排序和 memo 化；只有真实证据失败时才在同一任务增加视口裁剪。不得通过删节点、丢边或放宽测量达标。
- 状态一致性：`selectedTaskId` 是抽屉唯一事实，导航/搜索快照只由纯状态转换更新。出现 React 与纯状态不一致时停在 T-002 修正，不把视觉 workaround 当作修复。
- 正常入口兼容：Task UI 与 Workspace access 通过顶层组件分派隔离，样式使用前缀。若正常入口行为或全局样式回归，T-002/T-003 保持 `in_progress` 并修复后重跑相关目标检查和最终根门禁。
- 依赖与 lockfile：只增加现有 workspace fixture 依赖和 Web 测试所需的已锁定工具；无证据不增加图编辑器。依赖变化后以最终 lockfile 为准执行 Web 和根门禁。
- 浏览器证据：验证只使用合成 profile。临时 Web 服务、截图或 trace 路径必须在 state 中记录；结束前停止服务，证据只进入明确的 prototype results 范围。
- 恢复：本阶段没有数据库或外部写入。中断时先把当前任务、已改文件、最后通过检查、活动 Web 服务和下一步写入 state；恢复时从当前 `in_progress` 任务第一个未完成门禁继续。不得用 `git reset --hard`、整目录删除或覆盖用户重叠改动。

精确恢复入口：读取 `execution-state.md`、本计划、requirements 和路线图，核对指纹与 Git 范围；切换 Node 24。若 state 为 T-001，从 fixture 目标测试继续；T-002 从纯状态/布局和 Web 目标测试继续；T-003 先确认临时 Web 服务与浏览器证据状态，再从未完成的真实浏览器矩阵或最终根门禁继续。任何 core 修正后只重跑其可能失效的目标检查，并在最后保留一次根 `pnpm check`。

### 4.2 修订记录

| 修订 | 日期 | 变更 | 原因 | 影响 |
| --- | --- | --- | --- | --- |
| 1 | 2026-07-25 | 初始 P-001 compact 即时计划 | requirements/contract/roadmap 审计通过；fixture、Web、真实 macOS 主体可以作为一个可构建阶段完成，没有 migration/不可逆风险；Windows 外部交接留给 P-002 | 建立 T-001 fixture、T-002 Web 原型、T-003 macOS 主体与完整 P-001 门禁 |
| 2 | 2026-07-25 | T-003 文件范围增加仅限测试同步的 `apps/workspace-cli/src/mcp.integration.test.ts` | 最终根门禁连续在固定 150 ms 后发送信号的退出断言中出现 `code=null`；相同测试单独 4/4、该包完整 24/24 通过，且 Workspace CLI 无本阶段改动，证明是并行启动时服务尚未注册信号处理器的既有验证竞态。根 `pnpm check` 是不可降级硬门禁，因此在结果封存前修正测试等待条件 | 不改变产品范围、CLI 实现或验收映射；只让既有信号测试等待 MCP 初始化完成后再验证退出码，随后重跑目标包和原始根门禁 |
