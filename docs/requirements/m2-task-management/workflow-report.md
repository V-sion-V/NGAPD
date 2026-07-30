# M2 任务管理闭环：工作流回顾

- 报告类型：`最佳实践记录`
- 工作流 Schema：`3.2`
- 原始需求：[`requirements.md`](requirements.md)
- 初始路线图：[`implementation-plan.md`](implementation-plan.md)，revision `1`
- 执行证据：[`execution/initial/`](execution/initial/)
- 修改记录：[`change-0.md`](change-0.md)
- 当前有效需求：[`effective-requirements.md`](effective-requirements.md)
- 生成日期：`2026-07-30`

## 1. 结论

M2 的 schema-v3.2 完成门成立。唯一 initial run 采用用户明确选择的 `relaxed` 策略，以一个 `single + expanded` 阶段和三个顺序任务完成，最终状态与验证结论为 `completed/passed`。原始 32 项 `FR-*`、18 项 core `AC-*` 和 2 项 supplemental `AC-*` 均有连续实现与验收证据；没有开放问题、半迁移、失败硬门禁、未匹配运行、纠正阶段或 `FND-I-*`。

需求、路线图和阶段计划的 SHA-256 与 completed execution state、阶段结果及 `change-0.md` 完全一致。唯一编号记录从 `change-0.md` 连续开始，并与唯一 completed initial run 一一对应；当前有效需求准确派生到 `change-0.md`，没有后续 `RC-*` 增量需要分类。

当前历史可恢复且已经冻结。后续 M2 行为变化必须通过 `$apply-feature-change` 创建连续 `change-1`；M3 应建立独立 schema-v3 工作流，并以本次 M2 交付提交为实现基线。

## 2. 工作流时间线、阶段与结果

| 时间与节点 | 运行 / 阶段 | 证据 | 结果 |
| --- | --- | --- | --- |
| 2026-07-29 需求澄清 | initial 前置 | [`requirements.md`](requirements.md) 的策略与 Q-001 决策 | 用户明确选择 `relaxed`；确认未完成 Task 的作者可编辑/删除本人评论，Task 完成后追加式不可变；无未决问题 |
| 2026-07-29 初始规划 | initial / P-001 | [`implementation-plan.md`](implementation-plan.md) revision 1 | `single + expanded`；一阶段覆盖 FR-001–FR-032、AC-001–AC-020 |
| 2026-07-29 即时阶段规划 | P-001 | [`phase-001-plan.md`](execution/initial/phase-001-plan.md) revision 1 | 三个顺序任务及 V-001–V-012 门禁 ready |
| 2026-07-29 至 2026-07-30 实施 | P-001-T-001 | [`execution-state.md`](execution/initial/execution-state.md) | Schema 3、Contracts/Domain、Task Repository 与事务证据 completed |
| 2026-07-30 实施 | P-001-T-002 | [`execution-state.md`](execution/initial/execution-state.md) | 公共 Task API、评论/投影/通知、Worker/SSE 与兼容证据 completed |
| 2026-07-30 收口 | P-001-T-003 | [`phase-001-result.md`](execution/initial/phase-001-result.md) | 规模、根 CI、Compose、P95、浏览器、文档与范围审查 passed |
| 2026-07-30 initial finalization | initial | [`change-0.md`](change-0.md)、[`effective-requirements.md`](effective-requirements.md)、completed [`execution-state.md`](execution/initial/execution-state.md) | 首次历史冻结，当前有效需求建立 |

### 2.1 数量与策略

| 指标 | 结果 |
| --- | --- |
| 原始需求 / 验收 | 32 FR；20 AC（18 core、2 supplemental） |
| 运行 | 1 initial；0 change run |
| 交付策略 | 0 strict；1 relaxed |
| 验证结论 | 1 passed；0 passed_with_findings |
| 路线图 / 完成阶段 | 1 / 1 |
| 计划 / 完成任务 | 3 / 3 |
| 修改记录 / RC 项 | 1 / 0 |
| 执行 pause / blocked / interrupted recovery | 0 / 0 / 0 |
| 路线图修订 / 阶段计划修订 | revision 1 / revision 1；均无后续修订 |
| 纠正阶段 / 纠正轮次 | 0 / 0 |
| 开放 / 关闭 finding | 0 / 0 |
| 从实现基线到交付提交的唯一保留文件 | 63 |

需求澄清曾为 Q-001 等待用户决定，但发生在执行状态建立前，不是执行 pause、blocked 或任务中断。回答写回原始需求后才进入规划和实现。

## 3. 需求变更分类

`change-0.md` 是首次实现记录，不包含 `RC-*`；当前没有 later change record，因此没有 Category A 或 Category B 分类单元，也没有需求修正轮次。

| 变更项 | 修改记录 | 关联原始需求 | 主分类 | 次要因素 | 严重程度 | 核心依据 | 置信度 |
| --- | --- | --- | --- | --- | --- | --- | --- |

## 4. 执行可恢复性与阶段质量

### 4.1 比例性

- 单阶段合理：M2 是一个原子服务端发布边界，没有旧公共 Task API 双轨迁移、独立外部审批或可先行交付的中间产品；把实现、测试、发布验证或文档拆成独立阶段不会形成安全的独立交付。
- `expanded` 细节有项目事实支持：本轮包含正式 PostgreSQL 前向迁移、Project/Membership/Task/Graph/Workspace/Worker 多写入者、跨模块事务和高成本恢复边界。扩展内容集中在锁序、writer 协调、迁移恢复、检查点和硬门禁，没有因此增加空阶段。
- 三个顺序任务按数据/领域基础、API/Worker 闭环、最终规模与发布收口划分；依赖和文件所有权明确，没有为测试或文档另造阶段。
- `relaxed` 策略执行正确：没有人为制造 red-first 基线，core/supplemental 分级从需求到结果保持不变，最终两级均 passed，未使用 report-only 例外。
- 验证重复均有失效或诊断原因：Caddy `/docs*` 修复和 P95 Project Key 夹具修正后重新执行了受影响证据；没有无中间变更的重复全套门禁。

### 4.2 恢复完整性

- 阶段计划在生产编辑前固定需求、路线图和计划指纹，并记录 Node 24、PostgreSQL 17、隔离数据库、迁移和共享 writer 边界。
- 每个任务完成检查点后才进入下一任务；没有未知部分迁移、未记录重叠 writer、任务中断或需要恢复的半状态。
- 迁移失败路径明确保持 version 2，成功后只允许 roll forward 或恢复迁移前一致备份；没有把 down/reset 当作生产恢复。
- 参考服务器使用独立 Compose project、目录、端口、卷、镜像、数据库和 SSH 隧道；最终精确清理并确认原有服务未受影响。
- completed execution state、阶段结果、`change-0.md` 和 effective snapshot 对阶段、任务、指纹、文件范围、验证结论和无 finding 状态一致。

## 5. 最终交付与验证证据

| 覆盖组 | 实现证据 | 验证证据 | 结论 |
| --- | --- | --- | --- |
| FR-001；AC-001 | `0009-m2-task-management`、profile version 3、确定性角色回填 | 空库、version 2→3、重复迁移、异常回滚和数据保留 | passed |
| FR-002–FR-023；AC-002–AC-011、AC-013、AC-015–AC-017 | Contracts/Domain、Task Query/Command/Lifecycle Repository、Session-only `/api/v1`/OpenAPI、Workspace 原子边界 | 字段、树/DAG、Owner、权限、状态、生命周期、并发、幂等、规模和兼容测试 | passed |
| FR-024–FR-028；AC-012、AC-014 | Comment/Projection Repository、Activity/Notification、Outbox/Worker/SSE | 评论完成竞态、投影重试/重建、通知去重、精确 audience 和 cursor | passed |
| FR-029–FR-032；AC-016、AC-018 | 版本/错误/授权边界、模块依赖、发布网关与活动文档 | Node 24/pnpm 11/PostgreSQL 17 根门禁、六服务 Compose、秘密与范围审查 | passed |
| AC-019、AC-020 supplemental | M2 P95 客户端和浏览器发布表面 | 列表/详情/创建/更新/200 DAG P95 与 Chrome Web/Swagger | passed |

最终运行证据为 Node `24.18.0`、pnpm `11.9.0`、PostgreSQL `17.10` 下 `pnpm run ci`：两次迁移、format、lint、build、typecheck 和 288 tests passed、0 failed、9 个精确平台条件 skip。参考六服务发布栈为 Schema 3、9 migrations，重复迁移、健康、硬化、持久化和秘密扫描通过。

参考 P95 为列表 `15.36 ms`、详情 `19.53 ms`、创建 `45.49 ms`、更新 `29.83 ms`、200 节点 DAG `38.73 ms`，均显著低于 AC-019。Chrome 观察到 Web 注册入口和加载完成的 OpenAPI 3.1 Swagger，包含 27 个 Task 路由与通知表面。

## 6. 开放发现项与可选后续

当前没有开放 `FND-I-*`。下一可用 initial finding ID `FND-I-001` 只是未使用的序列位置，不代表现存问题。

| ID | 类别 | 严重程度 | 关联需求/验收 | 观察与证据 | 最终功能影响 | 处置 | 置信度 | 建议后续 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |

## 7. 最佳实践记录

- 先解决会改变核心评论生命周期的 Q-001，再冻结需求、路线图和执行指纹，避免实现者在完成冻结与评论修改竞态上自行发明产品决定。
- 将数据库迁移、共享领域规则、公共 API、Worker 投影和 Task Workspace 原子性保留在一个发布阶段，同时用三个顺序任务建立可恢复检查点，兼顾发布原子性与执行可恢复性。
- 公共人类 Session 与内部 Agent actor 端口共用领域/授权服务，但不把可信 actor/admin 字段暴露给客户端，为 M3/M5 保留明确的安全边界。
- 把规模正确性设为 core，把精确 P95 和额外浏览器置信度设为 supplemental；最终两类均执行并通过，没有用性能数据替代正确性证据。
- 发布验证发现 `/docs*` 网关缺口后按 core 修复并重建最终隔离栈；最终记录同时保存源码快照、Schema、健康、持久化、秘密扫描、P95、浏览器和精确清理证据。
