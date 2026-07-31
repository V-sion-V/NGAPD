# M3 平铺树状任务界面工作流回顾

- 报告类型：最佳实践记录
- 工作流合同：[`workflow-contract.md`](workflow-contract.md)，schema `3.2`
- 原始需求：[`requirements.md`](requirements.md)
- 初始路线图：[`implementation-plan.md`](implementation-plan.md)，revision `3`
- 执行证据范围：[`execution/initial/phase-001-plan.md`](execution/initial/phase-001-plan.md) 至 [`execution/initial/phase-002-result.md`](execution/initial/phase-002-result.md)，以及 [`execution/initial/execution-state.md`](execution/initial/execution-state.md)
- 修改记录范围：[`change-0.md`](change-0.md)
- 当前有效需求：[`effective-requirements.md`](effective-requirements.md)
- 生成日期：2026-07-31

## 1. 结论

M3 initial 工作流完整、连续且可恢复，最终状态为 `completed/passed`。唯一 initial run 明确采用 `relaxed` 策略；40 项 `FR-*`、25 项 core `AC-*` 和 3 项 supplemental `AC-*` 全部闭合，没有使用 report-only 例外，也没有开放 `FND-*`、未决问题、半迁移或残留验证资源。

工作流包含 2 个 compact 阶段和 5 个任务。P-001 先交付可独立验证的搜索、祖先链和 Session Workspace 附件读取接口，P-002 再完成正式 Task UI、全部 M2 人类操作和最终集成验收；该阶段边界有独立发布、安全恢复和稳定公共接口依据，规划粒度与风险相称。

编号记录只有连续的 `change-0.md`，不存在后续 `RC-*` 需求增量，因此无需 A/B 分类，也没有需求纠正轮次。本报告选择“最佳实践记录”，不把 initial 内由真实验证暴露并在同一需求边界内修复的实现缺陷误记为需求变化。

## 2. 工作流时间线、阶段与结果

| 时间/顺序 | 运行、阶段或检查点 | 结果与证据 |
| --- | --- | --- |
| 2026-07-31 | 需求澄清完成 | `requirements.md` 确认 40 个 FR、28 个分层 AC、`relaxed` 策略和无未决问题 |
| 1 | initial 路线图 revision 1 | 采用两个 compact 阶段；P-001 建立只读公共接口，P-002 负责完整 Web 和最终验收 |
| 2 | P-001 revision 1，`P-001-T-001`/`T-002` | 搜索、祖先链、Session Workspace 清单/附件读取和授权审计修复完成；真实 PostgreSQL 规模与授权证据通过 |
| 3 | P-001 结果 | [`phase-001-result.md`](execution/initial/phase-001-result.md) 冻结为 `completed/passed`；路线图 revision 2 将 P-002 交接为 `ready` |
| 4 | P-002 revision 1，`P-002-T-001` | 正式单 scope DAG、详情、层级/深链/History、搜索筛选、活动/归档和 SSE query 失效完成；搜索返回前快照缺口在同一任务内修复并复验 |
| 5 | P-002 `T-002` 暂停与滚动规划 | 浏览器暴露“完成→重开→删除”因历史外键返回 500；验收未降级，路线图提升为 revision 3、阶段计划提升为 revision 2 |
| 6 | P-002 `T-002` 恢复 | 增加最小前向迁移 `0010-m3-task-ui-history-compatibility` 和历史存续回归；完整操作、通知安全导航与并发恢复通过 |
| 7 | P-002 revision 3，`T-003` | 只修正父路线图修订号和保存指纹后执行最终硬化、根 CI、浏览器、参考发布、P95 和资源清理 |
| 8 | P-002 结果与 initial 冻结 | [`phase-002-result.md`](execution/initial/phase-002-result.md)、`change-0.md`、effective snapshot 和 execution state 一致为 `completed/passed` |

| 指标 | 结果 |
| --- | --- |
| 运行 | 1 个 initial；strict `0`，relaxed `1` |
| 验证结论 | passed `1`，passed_with_findings `0` |
| 阶段 | 规划 `2`，完成 `2`，纠正阶段 `0` |
| 任务 | 规划 `5`，完成 `5` |
| 路线图 | 最终 revision `3`；初始后保留 2 次修订 |
| 阶段计划 | P-001 revision `1`；P-002 最终 revision `3`，初始后保留 2 次修订 |
| 暂停/阻塞 | 明确暂停 `1`，blocked `0` |
| 恢复 | P-001 依赖安装过程恢复 `1`；P-002 中断任务恢复 `1` |
| 修改记录与需求增量 | change record `1`；`RC-*` `0`；需求纠正轮次 `0` |
| 交付文件 | 从基线 `9f0a839` 到 M3 交付提交 `fca5abd` 共 60 个唯一保留文件 |
| 发现项 | open `0`，closed `0`；各类别与严重程度均为 `0` |

## 3. 需求变更分类

initial 基线之后没有 `change-1` 或任何 `RC-*`。`change-0.md` 是首次实现汇总，不是需求增量分类单元，因此分类表为空。

| 变更项 | 修改记录 | 关联原始需求 | 主分类 | 次要因素 | 严重程度 | 核心依据 | 置信度 |
| --- | --- | --- | --- | --- | --- | --- | --- |

P-001 授权审计 UUID 修复、P-002 搜索快照修复、完成历史删除兼容迁移和通知安全导航均用于满足原始 core 验收，并在 initial 阶段计划、结果和 `change-0.md` 中归并；它们没有改变用户选择的目标行为，因而不产生 A/B 需求变更分类或纠正记录。

## 4. 执行可恢复性与阶段质量

### 4.1 规划比例与阶段边界

- 两阶段拆分有合同支持的独立交付边界：P-001 的服务端只读接口可以单独构建、验证和回退，并为 P-002 提供稳定公共契约。
- 最终 Web、自动化、浏览器、参考发布、文档和冻结均保留在 P-002 内，没有为测试、文档或 closeout 额外制造阶段。
- `compact` 细节级别适合当前单一写入工作树；发现前向迁移需求后，通过任务内修订增加必要恢复和兼容证据，没有把整个工作流无依据扩展为 `expanded`。
- `relaxed` 策略没有要求无必要的 red-first 基线；core 失败出现后均先暂停、诊断和修复，再重跑会被修改失效的证据。

### 4.2 暂停、恢复与修订完整性

- P-001 的本地依赖安装过程曾中断；依赖从冻结锁文件和本机内容寻址仓库恢复，随后强制重建通过，没有修改版本或生产行为。
- P-002-T-002 的删除 core 失败触发唯一明确暂停。状态保存了失败、根因、允许的唯一兼容方向和恢复入口；恢复后仍在同一任务完成，未跳过门禁或制造虚假完成阶段。
- 路线图 revision 3 与 P-002 plan revision 2 记录功能性兼容修正；P-002 plan revision 3 仅修正证据元数据。结果文件引用的 requirements、roadmap、前置结果和 phase plan 指纹均与当前冻结文件一致。
- 没有未知半迁移。`0010` 以前向、非破坏和重复安全方式解除活动行外键阻断，并由完成/重开、Workspace transition 和 tombstone 历史存续证据闭合。

### 4.3 最终状态解释

`implementation-plan.md` 的 P-002 路线图行保留最后一次规划交接状态 `ready`；合同同时明确 `execution-state.md` 才是运行中的当前协调权威。P-002 的不可变 result、最终 execution state、`change-0.md` 和 effective snapshot 均记录 `completed/passed`，且不存在活动或未匹配运行目录。因此该规划快照不表示存在待执行阶段，也不应为镜像最终状态而改写已经冻结的 initial 路线图。

## 5. 最终交付与验证证据

- 最终 Node.js `24.18.0`、pnpm `11.9.0`、PostgreSQL 17 `pnpm run ci` 在两次 migration 后通过 format、lint、build、typecheck 和 test：311 passed、0 failed、9 platform-conditional skipped。
- 正式 Schema 保持 version 3，共 10 个 migration，latest 为 `0010-m3-task-ui-history-compatibility`；空库、version 2/3 前向升级、重复迁移和最终 profile 指纹通过。
- 真实 PostgreSQL 验证覆盖 5,000 Task、深度 20、稳定游标、跨租户授权、Workspace 路径/版本/manifest/hash 和对象完整性。
- 本地目标浏览器覆盖正式单 scope DAG、深链/History、搜索返回、筛选、全部 M2 操作、评论/附件/活动、通知、Admin Mode、版本冲突、SSE 草稿保护和 prototype 隔离。
- 参考六服务栈验证健康、硬化、持久化、秘密扫描、TLS、Swagger、重复迁移和正式 Task UI；列表/详情/创建/更新/200 DAG P95 分别为 23.73/24.86/47.47/32.32/42.46 ms。
- 远端桌面 Chromium 完成父子 Task 创建、完成、重开和不可恢复删除；隔离容器、网络、卷、镜像、目录、临时数据库和隧道全部清理，原服务保持 healthy。
- 2026-07-31 收尾复核在当前分支再次以 Node.js `24.18.0` 执行根 `pnpm check`，结果仍为 311 passed、0 failed、9 platform-conditional skipped；工作区随后保持干净。

## 6. 开放发现项与可选后续

当前没有开放 `FND-*`，也没有可选 report-only 后续。下一可用 initial ID 仍为 `FND-I-001`，但不得为已经通过的行为追溯创建 finding。

| ID | 类别 | 严重程度 | 关联需求/验收 | 观察与证据 | 最终功能影响 | 处置 | 置信度 | 建议后续 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |

后续任何 M3 行为、范围、接口、数据、安全或验收变化必须使用 `$apply-feature-change` 从连续 `change-1` 开始；M4 应建立独立 schema-v3 工作流，不得改写本报告所引用的 initial 证据。

## 7. 可复用实践

- 只有确实可独立发布和恢复的公共接口才形成阶段边界；最终集成、验收和文档留在最终交付阶段。
- 把真实浏览器和真实 PostgreSQL 作为 core 证据，可在冻结前暴露内存夹具和窄回归遗漏的兼容缺口。
- core 失败后保持验收层级不变，通过滚动规划修订同一任务并保存恢复入口，避免把实现反馈伪装成 report-only finding。
- 最终以 change record、effective snapshot、不可变 phase result、completed execution state 和隔离发布清理共同形成可追溯交接点。
