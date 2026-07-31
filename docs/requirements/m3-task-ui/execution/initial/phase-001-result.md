# M3 initial run：P-001 阶段结果

- 运行编号：`initial`
- 阶段：`P-001`
- 阶段计划：[`phase-001-plan.md`](phase-001-plan.md)
- 阶段计划修订：`1`
- 父路线图修订：`1`
- 需求指纹：`sha256:345e209c7902568717a7f0950257a6ec095ca0bceda409a6ca6289bde9f1cb3b`
- 路线图指纹：`sha256:065b43dcca7a66c977c7b7de75b7132c049faf10cb2f871160ac3efb963c333a`
- 阶段计划指纹：`sha256:35747f0a4b848e4c45a244d81e2daf93146370e967a267b6600c389471207b26`
- 完成时间：`2026-07-31T04:09:37+08:00`
- 状态：`completed`
- 交付与验证策略：`relaxed`
- 验证结论：`passed`
- 开始基线：分支 `codex/m3-task-ui`，提交 `9f0a8398c63582f21ed26451bb727f9daca0d89c`
- 结束基线：同一分支上的未提交 P-001 工作树；本结果生成后冻结，最终按用户要求与 P-002 一并提交和推送

## 1. 阶段目标与结果

P-001 完成生产 Web 所需且可独立验证的只读服务端子系统：

- 项目级 Task 搜索支持 Task Key 精确/前缀优先、标题不区分大小写包含、生命周期过滤、稳定 Key 游标和有限分页；结果携带从虚拟根到目标父级的完整祖先链。
- 单 Task 祖先读取与搜索共同使用租户限定 Repository 和树完整性校验；缺失父级、跨项目、循环或不可读节点一律 fail closed。
- 人类 SameSite Session 可读取当前 Task Workspace 文件清单和单个附件内容；每次请求重新验证项目成员、Task `read_workspace`、当前 Workspace version、manifest hash、规范化路径、文件哈希、对象哈希与大小。
- 附件响应使用通用二进制 MIME、`no-store`、`nosniff` 和清理后的下载文件名；公开 DTO/URL 不包含设备、租约、token、连接 ID、对象路径或正文。
- 未配置对象存储时仅内容端点稳定不可用，Task 模块其余能力仍可启动；没有增加 Workspace 写能力、数据库迁移、第二事实模型或正式 Web 半成品入口。

## 2. 任务、需求与验收覆盖

| 任务 | 状态 | 完成范围 | 验证 |
| --- | --- | --- | --- |
| `P-001-T-001` | completed | 搜索/祖先 TypeBox 契约、租户限定 Repository、Session 应用服务、`/api/v1`/OpenAPI；修复失败授权审计的非法 UUID target | Contracts、强制构建/typecheck、PostgreSQL 17 规模/授权集成 passed |
| `P-001-T-002` | completed | 当前 Workspace 文件清单、安全附件代理、对象存储可选注入、路径/哈希/版本漂移重验和响应隐私 | Contracts、Workspace/Object Store、Database、M1/M2/设备 Workspace/API 回归 passed |

本阶段覆盖 `FR-012`、`FR-013`、`FR-017`、`FR-030`、`FR-036`、`FR-038`、`FR-039` 的服务端事实，以及 `AC-006`、`AC-016`、`AC-021`、`AC-023`、`AC-024`、`AC-025` 的 P-001 部分。生产交互与最终端到端证明仍按路线图归属 P-002。

阶段退出不变量全部满足：

- 新端点只返回当前 actor 可读项目和 Task 的稳定摘要、祖先或清单内容，不允许跨项目、跨 Task 或已移除成员读取。
- 5,000 Task、深度 20、游标与祖先链在真实 PostgreSQL 17 上通过，不需要新索引或迁移。
- Workspace 内容只来自当前 manifest 的授权条目；请求期间任何版本、manifest、路径、哈希、对象或权限漂移均拒绝。
- 既有 M1 Session、M2 Task 写入、设备 Workspace、OpenAPI 和工程构建保持兼容。
- 没有 unresolved question、半迁移、开放 `FND-I-*` 或 core/hard-gate 失败。

## 3. 文件修改

| 文件或范围 | 修改模式 | 主要目的 |
| --- | --- | --- |
| `packages/contracts/src/{tasks,domain-contracts.test}.ts` | modify | 搜索、位置、祖先与 Workspace 文件公开运行时契约及敏感字段边界 |
| `packages/database/src/task-query-repository.ts` | modify | 租户限定搜索、稳定分页、完整祖先链和树完整性错误 |
| `apps/api/src/modules/tasks/{service,routes}.ts` | modify | Session-only 搜索/祖先/Workspace 文件应用服务与 `/api/v1`/OpenAPI |
| `apps/api/src/app.ts` | modify | 向 Task 服务注入既有可选对象存储 |
| `apps/api/src/modules/authorization-audit/service.ts` | modify | 失败 Project Key 审计使用合法 nullable/Project UUID target |
| `apps/api/package.json`、`pnpm-lock.yaml` | modify | 显式声明 API 对共享 Workspace manifest/path 规则的工作区依赖 |
| `apps/api/src/m3-read.integration.test.ts` | add | 5,000 Task、深度 20、搜索/祖先、授权与附件安全的 PostgreSQL/Object Store 证据 |

没有数据库迁移、生产配置、外部服务、Worker、Web 入口或封存 M2 记录变化。

## 4. 测试与验证

最终阶段证据使用 Node.js `24.18.0`、pnpm `11.9.0` 和隔离 PostgreSQL `17.10-alpine`。

| 验证 | 最终结果 |
| --- | --- |
| Contracts | passed；2 files、14 tests |
| 受影响构建/typecheck | passed；Contracts、Domain、Workspace Core、Database、Object Store、API 强制重建 |
| M3 API/PostgreSQL/Object Store | passed；1 file、6 tests，覆盖 5,000 Task、深度 20、游标、OpenAPI、授权、路径、哈希、版本漂移与未配置对象存储 |
| Workspace Core/Object Store | passed；8 files、34 tests |
| Task/Projection/Lifecycle/Workspace Repository | passed；4 files、32 PostgreSQL tests |
| M1/API shell | passed；3 tests；首次经 SSH tunnel 在 5.012 秒触发默认 5 秒上限，同一用例用 15 秒诊断上限重跑通过 |
| M2 Task/API service | passed；2 files、7 tests |
| 设备 Workspace/API CLI | passed；2 files、2 tests，另 1 个既有 platform-conditional skip |
| Prettier/ESLint | passed；全部 P-001 受影响文件 |

M1 首次超时没有断言失败、产品错误或源码修改，属于远程 SSH tunnel 延迟；诊断重跑完整通过，不作为独立成功计数。最终根 `pnpm check`、`pnpm run ci`、浏览器和参考部署按合同归属 P-002。

## 5. 发现项与处置

当前无开放 `FND-I-*`；下一可用 ID 仍为 `FND-I-001`。

| ID | 类别 | 严重程度 | 关联需求/验收 | 观察与证据 | 最终功能影响 | 处置 | 置信度 | 建议后续 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

所有 P-001 core 门槛通过，没有可保留的 report-only 异常，因此阶段验证结论为 `passed`。

## 6. 决策、计划偏差与恢复记录

- 沿用用户选择的 `relaxed` 策略；没有降低安全、隐私、数据、兼容、构建或恢复门禁。
- 两个任务严格按 `P-001-T-001 → P-001-T-002` 执行，每个 checkpoint 通过后才进入下一任务。
- 为满足 `AC-021` 的真实授权门禁，修复了既有失败审计把未解析 Project Key 写入 UUID `target_id` 导致 500 的缺陷；成功授权、公开错误语义和产品范围未改变。
- 本地 pnpm 离线安装在重建 `node_modules` 时中断；依赖最终从冻结锁文件和本机内容寻址仓库恢复。增量类型缓存经强制重建后通过，未修改生产行为或锁定版本。
- 规模证据证明当前查询设计满足本阶段正确性与交互前置要求，未出现必须增加索引且存在多种兼容方案的规划修订条件。

## 7. 阶段冻结与下一步

- P-001 为连续、不可变的 `completed/passed` 结果；requirements、roadmap 和 phase plan 指纹一致。
- [`execution-state.md`](execution-state.md) 已更新为 `awaiting_next_phase`；P-002 尚无阶段计划，也未开始实现。
- 下一次只能调用 `$plan-feature-implementation` 审计本结果并生成 P-002 的 just-in-time 阶段计划；不得改写本结果或 `phase-001-plan.md`。
