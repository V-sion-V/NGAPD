# M3 initial P-001 阶段计划

- 运行编号：`initial`
- 阶段：`P-001`
- 阶段计划修订：`1`
- 父路线图修订：`1`
- 需求指纹：`345e209c7902568717a7f0950257a6ec095ca0bceda409a6ca6289bde9f1cb3b`
- 路线图指纹：`065b43dcca7a66c977c7b7de75b7132c049faf10cb2f871160ac3efb963c333a`
- 项目基线：Git `9f0a8398c63582f21ed26451bb727f9daca0d89c`
- 创建日期：2026-07-31
- 细节级别：`compact`
- 交付与验证策略：`relaxed`
- 验证结论：`pending`

## 1. 阶段目标、边界与关联需求

交付生产 Web 所需、但可独立发布和验证的只读服务端子系统：项目级 Task Key/标题搜索及祖先链、单 Task 祖先链、基于人类 Session 的 Task Workspace 当前文件清单与附件内容读取。所有接口进入 TypeBox/OpenAPI，复用项目/Task 授权并保持 M2 路径向后兼容。

本阶段不创建正式 Web 入口、不修改任何 M2 写入语义、不引入 Workspace 写能力或设备/租约凭据，也不默认增加数据库迁移。关联 `FR-012`、`FR-013`、`FR-017`、`FR-030`、`FR-036`、`FR-038`、`FR-039` 与 `AC-006`、`AC-016`、`AC-021`、`AC-023`、`AC-024`、`AC-025`。

## 2. 任务与文件范围

| 任务 | 结果 | 文件或范围 | 实现摘要 | 验证 | 完成条件 |
| --- | --- | --- | --- | --- | --- |
| P-001-T-001 | 可稳定分页的项目搜索与可信祖先链只读 API | `packages/contracts/src/tasks.ts`、`packages/contracts/src/index.ts`、`packages/database/src/task-query-repository.ts`、`apps/api/src/modules/tasks/service.ts`、`apps/api/src/modules/tasks/routes.ts` 及对应 tests/fixtures | 增加受限搜索/祖先 Schema、租户限定 Repository 查询、Session 应用服务与 `/api/v1`/OpenAPI 路由；Key 精确/前缀优先、标题不区分大小写包含、活动/归档范围与 Task Key 稳定游标；链异常 fail closed | contracts 与 database/API 针对性测试；覆盖 5,000 Task、深度 20、跨项目/移除成员/陈旧或归档目标、OpenAPI 与既有列表兼容 | 新接口只返回当前 actor 有权项目内的稳定摘要和祖先链；规模/授权/core 用例通过，现有 M2 读取语义未变化 |
| P-001-T-002 | 人类 Session 下安全的 Task Workspace 当前清单与附件内容读取 | `packages/contracts/src/tasks.ts` 或相邻只读契约、`packages/database/src/workspace-repository.ts`/Task 查询端口、`apps/api/src/app.ts`、`apps/api/src/modules/tasks/*`、对象存储适配及对应 tests | 通过 Project Key/Task Key 重新授权 Task `read_workspace`，读取当前 Workspace 版本清单，规范化并精确匹配相对路径/可选哈希后从对象存储返回内容；不暴露 Workspace 设备/租约/对象路径或写入口，未配置对象存储时只使内容端点明确不可用 | API/PostgreSQL/对象存储集成测试；覆盖正常清单/打开、跨任务/跨项目、失权、已删除/版本或哈希漂移、路径穿越、秘密响应检查和 OpenAPI | 清单与内容均逐次 Session/Project/Task/Workspace 授权，异常 fail closed；全部阶段 core 与兼容检查通过，项目保持可构建 |

任务依赖：`P-001-T-002` 可复用 `P-001-T-001` 建立的只读 Schema/路由错误模式，但不依赖其搜索结果；执行时仍按表中顺序检查点化，避免同时修改同一 Task 模块接口。

## 3. 验证与完成条件

- `core`：contracts 运行时 Schema、OpenAPI 路径/响应、项目租户和活动 Membership、Task read/read_workspace、搜索顺序/游标/生命周期、祖先链完整性、Workspace 当前清单、路径/哈希/权限漂移、5,000 Task 和深度 20 全部通过。
- `core`：直接受影响的 contracts/database/api 单元或集成测试、类型检查和构建通过；M2 Task 列表/详情/写入、设备 Workspace 路径、M1 Session 认证没有可观察回归。
- `core`：无新增外部服务、秘密/正文日志、第二 Task/Workspace 事实或半应用迁移；公共成功/错误语义向后兼容。
- P-001 不运行生产 Web 浏览器验收；该最终门禁属于 P-002。若本阶段的 API 真实规模证据证明需要索引且不止一种兼容方案，先把状态暂停并交回 `$plan-feature-implementation` 修订路线图，不擅自创建迁移。
- `relaxed` 下无需 red-first；任一安全、隐私、数据、兼容、构建、未知影响或上述 core 失败均阻塞。只有与交付无关且有独立 core 证据的 supplemental 异常才可使用下一编号 `FND-I-001`。

阶段完成时写入 `phase-001-result.md`，冻结本计划，并把执行状态设为 `awaiting_next_phase`；不得在同一次 `$implement-planned-feature` 调用中规划或开始 P-002。

## 4. 风险、恢复与修订记录

- 现有 Task 查询会加载项目快照；实现先保持可重建派生语义并用真实 5,000 Task 证据判断。不得为性能下载全部正文到 Web、削弱授权或隐藏结果。
- 附件读取必须先读取当前 Workspace version，再精确解析 manifest 条目和对象哈希；请求期间版本漂移必须返回稳定冲突/不可用结果，不能猜测对象路径。
- `apps/api` 当前只在配置对象存储时注册设备 Workspace 路由；Task 附件内容依赖必须显式可选，不能让没有对象存储的现有测试或 Task API 启动失败。
- 当前生产文件无用户改动。若执行前出现与上述范围重叠的新差异，保留用户工作并按合同暂停判断所有权。

| 修订 | 日期 | 结论与原因 | 影响 |
| --- | --- | --- | --- |
| 1 | 2026-07-31 | 初始 compact 计划；两个顺序任务覆盖搜索/祖先链与 Session 附件读取 | 无既有阶段结果；建立 P-001 执行权威 |
