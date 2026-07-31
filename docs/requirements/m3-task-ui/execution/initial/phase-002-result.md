# M3 initial run：P-002 阶段结果

- 运行编号：`initial`
- 阶段：`P-002`
- 阶段计划：[`phase-002-plan.md`](phase-002-plan.md)
- 阶段计划修订：`3`
- 父路线图修订：`3`
- 需求指纹：`sha256:345e209c7902568717a7f0950257a6ec095ca0bceda409a6ca6289bde9f1cb3b`
- 路线图指纹：`sha256:ac4369a39bab6165fe437af785ae3cc45b7c9a34e2fd15c263712d1a781536b8`
- 阶段计划指纹：`sha256:bb835398a4856569a1c3d5f7dee31612d175a54fa7daf2add13eb213795bfab5`
- 前置阶段结果指纹：`sha256:af443a33b97cbf19097728709c9e20fad9ea5059bef76b0c9cc308286efb1bff`
- 完成时间：`2026-07-31T12:45:59+08:00`
- 状态：`completed`
- 交付与验证策略：`relaxed`
- 验证结论：`passed`
- 开始基线：分支 `codex/m3-task-ui`，提交 `9f0a8398c63582f21ed26451bb727f9daca0d89c`，加不可变 P-001 `completed/passed` 工作树
- 结束基线：同一分支上的完整未提交 M3 工作树；阶段结果写入后按用户指令统一 commit/push

## 1. 阶段目标与结果

P-002 在 P-001 已冻结的搜索、祖先链和 Session 附件读取契约之上，完成正式 M3 平铺树状 Task UI 与 initial 收口：

- 已认证 React shell 增加项目 Task 页面，任一时刻只呈现虚拟项目根或普通父 Task 的一幅当前 scope DAG；支持孤立节点、两端可见依赖、分页、图完整性 fail-closed、右侧非模态详情和抽屉内专用层级下降。
- 正式 URL/History 可恢复项目、父级、选中 Task 和每层快照；完整面包屑、返回上级、项目级 Key/标题搜索、返回搜索前位置、AND 筛选及活动/归档分离均由生产契约驱动。
- UI 覆盖 M2 全部人类 Session 操作：创建/编辑、Owner、依赖直改与双方请求、关注、blocker、状态、完成/重开、移动、归档/删除、评论/附件/活动、通知和显式 Admin Mode。
- 每个写入意图使用稳定幂等键并绑定 Task/Graph/Workspace/评论/通知版本及服务端影响；SSE 只失效权威 query，草稿、冲突和旧确认不会被自动覆盖或重放。
- 通知只在当前仍有项目 Membership 和 Task 读取权时返回可导航 Key；删除或失权后保留通知语义而不从历史引用推断深链。
- 新增前向 `0010-m3-task-ui-history-compatibility`，解除完成快照对活动 Task 行的删除约束，同时保留完成/重开、Workspace transition 和 Task Key tombstone 历史；正式 profile 保持 version 3。
- 生产 M3 只消费 `/api/v1` 契约；精确 `?prototype=task-ui` 继续使用隔离夹具。M4 Workspace 写入/同步、M5 Agent 写入口和 M6 摘要/Wiki 未提前实现。

最终 40 项 FR、25 项 core AC 和 3 项 supplemental AC 全部通过，无半迁移、开放问题、未知影响或 `FND-I-*`。

## 2. 任务、需求与验收覆盖

| 任务 | 状态 | 完成范围 | 需求与验收 |
| --- | --- | --- | --- |
| `P-002-T-001` | completed | 生产数据适配、单 scope DAG、详情/子项、层级/深链/History、搜索筛选、活动/历史、SSE query 失效及 prototype 隔离 | FR-001–FR-017、FR-036–FR-040；AC-001–AC-009、AC-021、AC-023–AC-025 |
| `P-002-T-002` | completed | 全部 M2 人类写入、评论/附件/活动/通知、Admin Mode、并发恢复；`0010` 完成历史删除兼容与安全通知导航 | FR-018–FR-035；AC-010–AC-021、AC-024–AC-025 |
| `P-002-T-003` | completed | 最终硬化、根门禁、重复迁移、参考发布/P95/浏览器、正式文档、资源清理和 initial 冻结 | FR-001–FR-040；AC-001–AC-028 最终收口 |

阶段退出不变量全部满足：

- 任一时刻一幅当前 scope DAG；依赖只连接同父级且方向不反转；下降只通过专用操作。
- 服务端仍是 Task、Graph、Owner、Workspace、权限和影响的唯一权威；按钮、URL、History、SSE 与客户端缓存均不成为第二事实。
- 高影响提交绑定同一预览、版本和语义确认；完成安全答案不预填，删除精确匹配完整 Task Key。
- M1/M2、Worker/SSE、Workspace CLI、发布栈和 prototype 保持兼容。

## 3. 文件修改

| 文件或范围 | 修改模式 | 主要目的 |
| --- | --- | --- |
| `apps/web/src/m3/**` | add | 正式 Task 页面、模型/query、DAG、详情、全部操作、协作、通知、Admin Mode、样式与测试 |
| `apps/web/src/{api,m1/**,task-ui/layout}.ts(x)` | modify | 同源二进制读取、M1 shell/深链/通知入口、SSE 精确失效及纯布局复用 |
| `packages/contracts/src/{tasks,task-notifications,domain-contracts.test}.ts` | modify | 搜索/祖先/附件、安全通知 Key 契约及运行时边界 |
| `packages/database/src/{task-query-repository,task-projection-repository,migrations,schema-profile}.ts` | modify | 搜索/祖先、通知安全导航、`0010` 与正式 profile |
| `packages/database/src/{m2-migration,schema-profile,task-repository,task-projection-repository}.integration.test.ts` | modify | 空库/前向/重复迁移、完成历史删除和通知失权回归 |
| `apps/api/src/{app,m2.integration.test,m3-read.integration.test}.ts` | add/modify | 对象存储注入、M2 兼容和 M3 真实 PostgreSQL/OpenAPI/授权/规模证据 |
| `apps/api/src/modules/{tasks,authorization-audit}/**` | modify | Session 搜索/祖先/附件服务、路由和失败审计合法 UUID/null target |
| `apps/api/package.json`、`pnpm-lock.yaml` | modify | 显式声明 API 对 Workspace 路径/manifest 规则的工作区依赖 |
| `apps/worker/src/outbox-task.integration.test.ts` | modify | 为完整 CI 负载下的重试集成用例设置显式 15 秒诊断上限 |
| `README.md`、`AGENTS.md`、`docs/01-product-requirements.md`、`docs/04-system-architecture.md`、`docs/07-roadmap-and-validation.md` | modify | 同步 M3 完成状态、Schema 3/0010、验证和下一 M4 里程碑 |
| `docs/requirements/m3-task-ui/**` | add | 路线图、阶段计划/结果、执行状态、参考验证、change-0 与 effective snapshot |

没有改写 M0/M1/M2、Workspace CLI 或原型的封存 phase result、change record 或 effective snapshot；没有新增外部服务、生产 AI/LLM、路由依赖或 Workspace 写入口。

## 4. 测试与验证

最终工程证据使用 Node.js `24.18.0`、pnpm `11.9.0` 和 PostgreSQL 17。

| 验证 | 最终结果 |
| --- | --- |
| 受影响 Contracts/Web/API/Database | passed；运行时 Schema、类型、单元与真实 PostgreSQL 集成均通过 |
| P-001 M3 read | passed；6/6，覆盖 5,000 Task、深度 20、稳定游标、OpenAPI、授权和附件完整性 |
| Task Repository | passed；20/20，含完成→重开→删除、历史快照/Workspace transition/tombstone 保留 |
| Notification projection | passed；4/4，活动 Membership/Task 才返回 Key，失权或删除后安全降级 |
| Web 模型与操作 | passed；导航/History/DAG/筛选、幂等、影响 fail-closed、附件、通知和 SSE 草稿保护 |
| 根 `pnpm check` | passed；format、lint、build、typecheck、test 全部通过 |
| 最终 `pnpm run ci` | passed，313.6 秒；两次 migration、format/lint/build/typecheck，311 passed、0 failed、9 platform-conditional skipped |
| Schema/profile | passed；version 3、10 migrations、latest `0010`，空库、version 2/3 前向、重复迁移和最终指纹一致 |
| 本地真实浏览器 | passed；5,000/200、深度 20、搜索返回、History、筛选、全部 M2 操作、版本冲突、评论/附件/活动、通知、Admin Mode 与 prototype |
| 参考六服务栈 | passed；源码 SHA-256 `63785a39551fc38c090ba4cbbde7c64d5eb3f8e29bd5a567e210829858949a2f`，健康、硬化、持久化、秘密扫描、TLS、Swagger 与重复迁移通过 |
| 参考 P95 | passed；列表 23.73、详情 24.86、创建 47.47、更新 32.32、200 DAG 42.46 ms |
| 远端桌面 Chromium | passed；注册/建项目、父子 Task、完成→重开→不可恢复删除、DAG 归零和 Swagger OAS 3.1；无应用页面错误 |
| 资源清理 | passed；隔离容器/网络/卷/镜像/目录/数据库/SSH 隧道全部删除，原 `deploy-home-table-1` 仍 healthy |

详细远端环境、浏览器、P95 和清理证据见 [`validation/reference-server-2026-07-31.md`](../../validation/reference-server-2026-07-31.md)。

## 5. 发现项与处置

当前无开放 `FND-I-*`；下一可用 ID 仍为 `FND-I-001`。

| ID | 类别 | 严重程度 | 关联需求/验收 | 观察与证据 | 最终功能影响 | 处置 | 置信度 | 建议后续 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |

全部 supplemental 门槛均通过，没有使用 report-only 例外，因此验证结论为 `passed`。

## 6. 决策、计划偏差与恢复记录

- 沿用用户选择的 `relaxed` 策略；没有降低 core、安全、隐私、数据、兼容、构建、恢复或发布门禁。
- 真实浏览器在 T-002 暴露“完成→重开→删除”因完成快照外键返回 500。实现按 `$plan-feature-implementation` revision 3/phase revision 2 暂停并滚动规划，随后只增加 `0010` 和历史存续回归；没有改写 M2 冻结历史或改变产品删除语义。
- 最终冻结审计发现路线图页首修订号和 P-002 保存指纹仍指向旧元数据；phase revision 3 只修正修订号与指纹，不改变需求、任务、实现或验证。
- Schema profile 和 Worker 重试测试在完整 CI 负载下超过默认 5 秒；分别设置显式 15 秒用例上限后通过，未放宽产品性能门槛或跳过验证。
- 远端浏览器不安装私有 Caddy CA，也不绕过安全警告；使用短时 localhost SSH 映射完成安全上下文内的 UI 流程，再恢复正式 HTTPS 并重跑 smoke。
- 参考服务器始终使用唯一隔离命名；失败的过早 TLS 就绪探测和无效纯数字 Project Key 尝试均在有效结论前纠正，没有形成产品数据或降级最终门禁。

数据库恢复边界保持前向迁移/roll forward；生产迁移前仍需一致备份。所有临时验证资源已经精确清理。

## 7. 遗留风险与下一阶段进入条件

当前无开放 finding、unresolved question、半迁移或残留验证资源。P-002 已满足最终阶段退出条件；M3 initial 可以生成 `change-0.md` 和 `effective-requirements.md` 并切换为 `completed/passed`。

M4 必须建立独立 schema-v3 工作流，复用本阶段的 Task/Graph/Owner/Workspace/权限/附件边界。任何 M3 行为、范围、接口、数据或验收变化必须使用 `$apply-feature-change` 创建连续 `change-1`，不得改写本计划、结果或 initial 历史。
