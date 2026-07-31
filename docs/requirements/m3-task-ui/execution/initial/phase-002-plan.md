# M3 initial P-002 阶段计划

- 运行编号：`initial`
- 阶段：`P-002`
- 阶段计划修订：`3`
- 父路线图修订：`3`
- 需求指纹：`345e209c7902568717a7f0950257a6ec095ca0bceda409a6ca6289bde9f1cb3b`
- 路线图指纹：`ac4369a39bab6165fe437af785ae3cc45b7c9a34e2fd15c263712d1a781536b8`
- 前置阶段结果指纹：`af443a33b97cbf19097728709c9e20fad9ea5059bef76b0c9cc308286efb1bff`
- 项目基线：Git `9f0a8398c63582f21ed26451bb727f9daca0d89c`，加不可变 P-001 `completed/passed` 工作树
- 创建日期：2026-07-31
- 细节级别：`compact`
- 交付与验证策略：`relaxed`
- 验证结论：`pending`

## 1. 阶段目标、边界与关联需求

在现有已认证 React 项目 shell 中交付完整正式 M3 Task UI：单当前父级 scope 的一幅活动 DAG、详情抽屉、专用层级下降、深链/历史、搜索/筛选/归档浏览，以及 M2 已提供的全部人类 Session 操作、评论、活动、站内通知、附件读取、Admin Mode 和 SSE 恢复。正式页面只消费生产 `/api/v1` 契约，保留精确 `?prototype=task-ui` 隔离入口。

本最终阶段关联 `FR-001`–`FR-040` 与 `AC-001`–`AC-028`，并承担 initial run 的完整集成、真实 PostgreSQL、目标浏览器、参考部署、文档与工作流收口。P-001 的搜索、祖先和 Session 附件服务端结果为冻结前置，不得改写；若执行发现其 core 缺陷，只能暂停并由规划修订追加纠正任务或阶段。

本阶段不实现 Workspace 写入/同步/租约 GUI、Agent、摘要/Wiki/全文搜索、第二幅 DAG、拖拽写事实、跨父级依赖、归档恢复或外部通知/AI/分析服务。

## 2. 任务与文件范围

| 任务 | 结果 | 文件或范围 | 实现摘要 | 验证 | 完成条件 |
| --- | --- | --- | --- | --- | --- |
| P-002-T-001 | 可独立浏览和恢复的生产 Task 数据、导航与单 scope DAG | `apps/web/src/App.tsx`、`apps/web/src/m1/{M1App,ProjectsPanel,ProjectGovernance,use-resource-events,model}.tsx/ts`、新 `apps/web/src/m3/**`、`apps/web/src/task-ui/{layout,model}.ts` 的纯布局复用边界、`apps/web/src/styles.css` 及 Web tests | 在当前项目上下文增加正式 Task 入口；以生产契约建立稳定 query key/API 适配、分页 scope、图完整性校验、有限滚动布局、节点/边/隐藏关系、详情/直接子项、完整祖先面包屑、每层视口和筛选快照、项目/parent/selected/history URL 与 History API；接入项目级搜索及返回前位置、Owner/角色/状态/截止时间/标签 AND 筛选、活动/归档只读模式、安全 Markdown 文本和名称映射；prototype 继续只使用夹具 | Web 模型/路由/query/SSE 单元测试；生产契约类型检查与构建；API/PostgreSQL 读取回归；目标 Chromium 对深链、刷新、前进/后退、深度 20、键盘焦点、200 DAG、5,000 搜索和分页的早期浏览器检查 | `FR-001`–`FR-017`、`FR-036`–`FR-040` 的浏览/安全/兼容行为可由正式页面观察；新 scope 无选择、单 DAG/专用下降/历史只读/搜索返回/筛选和 >200 可达均正确；工程可构建且 P-001/M1/prototype 不回归 |
| P-002-T-002 | M2 全部人类 Session 写入、协作与并发恢复界面 | 新 `apps/web/src/m3/**` 操作控制器/表单/面板及 tests，必要的 `apps/web/src/api.ts` 二进制适配，M1 Admin Mode/成员/角色/事件集成；`packages/database/src/migrations.ts`、Schema profile/Task Repository tests 用于已证实的完成历史删除兼容修复；仅在真实契约缺口被 core 证据证明时修改相邻 contracts/API | 按当前服务端 `actions` 呈现创建/字段/Owner、依赖与请求、关注、blocker、状态/完成/重开、移动/归档/删除；每个意图一个幂等键，所有版本/graph version/影响 token/Admin Mode 明确传递，高影响操作先读服务端影响并语义确认，stale/conflict 保留草稿且重新获取。完成评论/附件选择与安全打开、本人编辑/删除/管理员隐藏、活动分页、通知分页/已读/偏好/安全导航；SSE 只精确失效权威 query，不覆盖草稿或重放写入，登出/切项目/失权清缓存。新增前向迁移解除不可变完成快照对已重开 Task 活动行的删除阻断，快照及其 Task UUID/项目/Workspace 历史必须保留 | Web 操作模型与组件测试；真实 PostgreSQL API 全流程/并发/幂等/授权回归；完成→重开→删除与历史存续；空库/version 3 升级/重复迁移；服务端 `actions` 与负向直接请求；目标浏览器覆盖普通成员、Owner、Project Owner/Admin Mode、所有危险确认、附件、评论、活动、通知、SSE 与草稿恢复 | `FR-018`–`FR-035` 及相应 core AC 全部可在正式 UI 完成；任何写入没有静默覆盖、重复业务结果、假成功、旧确认复用、客户端授权或秘密泄露；已重开 Task 删除不再产生 500 且完成历史不丢失；M2 语义与 Workspace/M4、Agent/M5、摘要/M6 边界保持 |
| P-002-T-003 | 最终硬化、全量门禁、参考发布和 initial 工作流冻结 | Web/API/测试/性能或发布脚本的必要修正，`README.md`、`AGENTS.md`、`docs/01-product-requirements.md`、`docs/04-system-architecture.md`、`docs/07-roadmap-and-validation.md`、`docs/requirements/m3-task-ui/{validation,effective-requirements,change-0}.md` 与本执行目录 | 完成中文/1280×720/键盘/焦点/屏幕阅读器关系/非颜色表达、窄屏安全降级和性能标记；一次性运行最终 Node 24/pnpm 11/PostgreSQL 17 根门禁与迁移兼容；在 `192.168.100.1` 用明确命名的隔离六服务 Compose 栈验证最终源码、TLS/健康/硬化/持久化/秘密扫描、Swagger、正式 Task UI、200 DAG/5,000 Task/深度 20/P95，且不影响既有服务并精确清理；合并全部需求/阶段/发现证据，生成不可变结果、`change-0.md` 和 effective snapshot | 受影响测试后执行根 `pnpm check` 与最终 `pnpm run ci`；目标桌面 Chrome/Chromium 人工可视验收和自动浏览器测量；参考服务器发布/P95/清理证据；逐项审计 40 FR、28 AC、工作树、秘密与封存边界 | 所有 core/hard gate passed；supplemental 只允许合同合格的连续 `FND-I-*`；无 unresolved question/blocker/critical/high/未知影响 finding、半迁移或未清理隔离资源；P-002 结果、`change-0.md`、effective snapshot 和执行状态一致为 `completed/passed` 或合规 `passed_with_findings` |

任务依赖为 `P-002-T-001 → P-002-T-002 → P-002-T-003`。每个任务在首次生产编辑前与验证后写 durable checkpoint；后续任务不得以临时页面或未验证 mock 替代前序生产事实。

## 3. 验证与完成条件

- `core`：正式 URL、单 scope DAG、完整层级/搜索/筛选/历史、200/5,000/深度 20、生产契约、全部 M2 人类操作、版本/影响/幂等/Admin Mode、评论/附件/活动/通知、SSE/缓存、授权/隐私/不可信输入与恢复行为全部通过自动化及目标浏览器证据。
- `core`：Node 24、pnpm 11、PostgreSQL 17 下受影响包门禁、根 `pnpm check`、最终 `pnpm run ci`、重复迁移/OpenAPI、M1/M2/Worker/Workspace CLI/prototype 兼容与发布栈硬门禁通过。
- `core`：目标桌面至少 1280×720，暖缓存 TTI 不超过 2 秒；数据返回后的层级切换、节点选择、抽屉开关和 200 节点主要交互 P95 不超过 100 ms；列表/详情与写入继续满足当前非功能基线。
- `core`：参考服务器只使用可辨识隔离目录、容器、网络、卷、镜像和端口；部署前确认目标，完成后验证这些资源已清理且 `deploy-home-table-1` 等既有服务保持原状。
- `supplemental`：`AC-026`–`AC-028` 的额外浏览器、>200 同层性能、trace/视觉/屏幕阅读器矩阵按可用环境执行；缺少附加证据不替代 core。只有独立证明不影响交付的 medium/low/info 异常可登记连续 `FND-I-*`。
- `relaxed` 不要求 red-first；任何安全、隐私、数据、公共兼容、构建/运行时、恢复、发布、未知影响或其他 core 失败均阻塞。失败后先诊断和修复，不降级验收。

阶段完成时先写 `phase-002-result.md` 并冻结本计划，再生成一致的 `effective-requirements.md`、`change-0.md` 和 `completed` 执行状态。只有全部最终门禁通过后才能提交和推送；Git 交付属于用户指令，不作为功能验收的替代证据。

## 4. 风险、恢复与修订记录

- **操作面广与旧确认漂移**：统一由生产 Task 操作控制器读取最新 `actions`、版本和影响集合；草稿与确认快照分离，成功或负载变化后轮换幂等键并精确失效。任一无法重建的草稿/确认状态先持久化 checkpoint，再修复。
- **DAG 完整性与性能**：复用原型已经验证的纯布局算法，但生产适配先验证节点唯一性、scope、父级、端点、自环和环；只渲染当前已加载/筛选节点及两端可见边，同时报告隐藏关系。不得为性能静默截断权威结果或下载项目正文。
- **History/SSE 与草稿冲突**：URL/History state 只保存可序列化导航和每层视口，不保存秘密、Admin Mode ID、幂等键或未提交正文；SSE 只 invalidate/refetch，若新事实与草稿前态不同则标记冲突并要求用户决定，不自动覆盖或提交。
- **M1 shell 重叠**：保持认证、项目治理、Admin Mode、设备/Workspace 和 prototype 入口；对 `M1App`/项目组件先做最小组合接口扩展。若执行前出现新的用户差异，保留用户工作并按合同判断所有权。
- **参考服务器**：所有操作限于用户授权的 `192.168.100.1`，先检查现有状态和精确隔离命名；不复用生产卷、不重置数据库、不停止既有容器。失败时保留诊断证据，精确清理本次资源后从本地通过门禁的源码快照恢复。
- revision 2 已响应真实 core 证据增加一个前向、非破坏迁移：解除 `task_completion_snapshots` 对已删除活动 Task 行的外键约束，同时保留不可变历史。若后续再证明需要其他迁移、公共契约或不可逆/多写者设计，先暂停并返回 `$plan-feature-implementation`；不得在任务内继续扩张边界。

| 修订 | 日期 | 结论与原因 | 影响 |
| --- | --- | --- | --- |
| 1 | 2026-07-31 | P-001 `completed/passed` 后的最终 compact 阶段计划；三个顺序 checkpoint 覆盖生产浏览、完整操作面和最终验收/冻结 | 建立 P-002 执行权威；未修改需求、P-001 计划或结果 |
| 2 | 2026-07-31 | T-002 真实浏览器删除 core 失败证明完成快照历史外键与既有重开后删除语义冲突；追加最小前向迁移和历史存续回归 | 只扩展 T-002 数据兼容验证；P-001、需求和 M2 冻结记录不变 |
| 3 | 2026-07-31 | 最终冻结审计修正路线图页首修订号与实际 revision 3 记录不一致，并刷新父路线图指纹 | 仅修正执行证据元数据；需求、任务、阶段边界、实现和验证结论不变 |
