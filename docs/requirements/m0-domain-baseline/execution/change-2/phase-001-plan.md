# change-2 P-001：Follow/Blocker 授权与验收来源纠正

- 运行编号：`change-2`
- 阶段：`P-001`
- 计划修订：`3`
- 父变更计划修订：`1`
- 当前有效需求指纹：SHA-256 `3b16d6596a178b7d518149f8b21561a2342f4c47f0498f7f387fe22a7aef9485`
- 项目基线：分支 `codex/m0-domain-baseline`，提交 `9b7c87158ebef9a2cf240bc2eb40def2c3690805`
- 创建日期：`2026-07-28`
- 详细度：`compact`
- 交付与验证策略：`strict`
- 验证结论：`pending`
- 状态：`completed`

## 1. 阶段目标、边界与关联需求

在一个可独立验证的阶段中完成 RC-2-001–RC-2-003：让 Follow add/remove 与 Blocker add 的最低层生产入口重新消费有效 Owner、活动 Membership、管理员会话、Agent 显式请求、影响/版本和完成冻结事实；通过应用服务暴露同一内部规则；纠正 AC-010 与 M0/M2 路线的来源链及当前阶段状态。

不新增公共 HTTP、数据库迁移、UI、Agent 写工具或 M2 completion-ready/通知实现；不修改既有 immutable history。

## 2. 任务与文件范围

| 任务 | 结果 | 文件或范围 | 实现摘要 | 验证 | 完成条件 |
| --- | --- | --- | --- | --- | --- |
| P-001-T-001 | strict red-first 证据 | `packages/domain/src/task-graph.test.ts`、`packages/database/src/task-repository.integration.test.ts`、必要的 Contracts/API 测试 | 先加入 source 完成冻结、Follow Owner/admin/impact 和 Blocker Owner/admin/version 的最小失败用例，不修改对应生产逻辑 | Domain 单测；隔离 PostgreSQL 下 Database 定向测试；若契约缺符号，以预期 type/test failure 记录而不伪装为行为红灯 | 失败精确对应 RC-2-001/002，既有测试继续通过，无环境或夹具假失败 |
| P-001-T-002 | Follow/Blocker 生产闭环 | `packages/domain/src/task-graph.ts`、`packages/database/src/task-repository.ts`、`packages/contracts/src/tasks.ts`、`packages/contracts/src/domain-contracts.test.ts`、`apps/api/src/modules/tasks/service.ts`、`apps/api/src/modules/tasks/service.integration.test.ts` | 实现锁内重查、source Owner/admin、impact token、expected version、Task version 增量和统一应用入口；保持无公共路由 | 新增红灯转绿；Domain/Contracts/Database/API 定向与扩大测试；受影响 build/typecheck | 全部 RC-2-001/002 core 场景通过，失败无业务写入，成功 audit/outbox/version 断言成立 |
| P-001-T-003 | 来源链、状态与最终封存 | `effective-requirements.md`、`AGENTS.md`、`docs/12-prototype-preparation.md`、本 change-2 目录、最终 `change-2.md` | 应用 RC-2-003，校准当前阶段；运行最终根门禁并生成不可变结果/记录 | Node 24/pnpm 11/PostgreSQL 17 下 `pnpm check`；文档 replay、指纹、`git diff --check`、路由/迁移负向审查 | 所有 strict core 门禁通过，phase result/change-2/effective/state 一致且无开放 `FND-C2-*` |

## 3. 验证与完成条件

- `strict`：所有本轮 core 与补充检查均阻塞；没有用户 waiver，也不计划 report-only finding。
- red-first 至少直接证明：
  - 非 source Owner、失活 Membership、未显式请求管理员模式的 Agent 不能低层修改 Follow；
  - Follow 没有确认或 source 已完成时不能修改；
  - 非 Task Owner、失活 Membership、陈旧版本、已完成/归档 Task 不能低层添加 blocker。
- green 必须证明 source Owner 和有效管理员路径可用，Follow target 只进入影响集合而不扩大授权，Blocker 成功时 version/blocker/audit/outbox 同事务一致。
- 应用服务失败通过统一错误与 failure audit 表达；不存在新增公共 route。
- 最终根 `pnpm check` 在规定工具链和真实 PostgreSQL 下通过；无法运行数据库 core 证据时不得完成。

## 4. 风险、恢复与修订记录

- 任务前基线为提交 `9b7c87158ebef9a2cf240bc2eb40def2c3690805` 且工作区干净。
- 每个任务开始前把 execution state 与本计划状态置为 `in_progress`，记录当前文件范围和恢复点；完成验证后才切换下一任务。
- 任一测试显示需要迁移、公共 API 或 M2 notification 实现时暂停，不扩大范围。
- 中断时保留当前 diff，记录最后通过/失败命令；不 reset、stash、commit、push 或清理用户文件。

| 修订 | 日期 | 结论 | 影响 |
| --- | --- | --- | --- |
| 1 | 2026-07-28 | 初始 compact phase plan；用户选择 strict | P-001-T-001–T-003 |
| 2 | 2026-07-28 | 开始 P-001-T-001 red-first；生产逻辑保持不变直到红灯证据成立 | P-001-T-001 |
| 3 | 2026-07-28 | P-001-T-001–T-003 与 strict 最终门禁通过，冻结本计划并生成阶段结果 | P-001 completed |
