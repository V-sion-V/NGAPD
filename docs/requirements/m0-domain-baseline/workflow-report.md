# M0：领域基线和工程骨架工作流回顾

- 报告类型：`root-cause analysis`
- 工作流合同：[`workflow-contract.md`](workflow-contract.md)，schema `3.2`
- 原始需求：[`requirements.md`](requirements.md)
- 初始路线图：[`implementation-plan.md`](implementation-plan.md)，revision 1，`phased + expanded`
- 执行证据范围：[`execution/initial/`](execution/initial/) 至 [`execution/change-2/`](execution/change-2/)
- 修改记录范围：[`change-0.md`](change-0.md) 至 [`change-2.md`](change-2.md)
- 当前有效需求：[`effective-requirements.md`](effective-requirements.md)，应用至 `change-2`
- 生成日期：`2026-07-28`

## 1. 结论

M0 工作流完整、连续且可恢复，最终状态满足 schema 3.2 的完成门禁：

- `change-0`、`change-1`、`change-2` 编号连续，并分别有唯一的 `completed/passed` 执行运行。
- 6 个阶段均有冻结计划和 `completed/passed` 结果；18 个计划任务全部完成。
- 原始 `FR-001`–`FR-028` 与 `AC-001`–`AC-029` 已完整映射到实现和验收，当前有效需求与连续修改记录一致。
- initial 使用 `relaxed`，两个纠正运行使用 `strict`；没有 waiver、`passed_with_findings` 或开放 `FND-*`。
- 所有已记录 SHA-256 均与当前文件匹配；没有活动、暂停、阻塞、半迁移或未知恢复状态。
- 当前 HEAD 在 Node.js `24.18.0`、pnpm `11.9.0` 下重新执行 `pnpm check` 退出 0。真实 PostgreSQL 17、并发、迁移和 Compose 结论由冻结且哈希匹配的运行证据提供。

回顾类型选择为根因分析：6 个 `RC-*` 全部属于对既有需求、实现或验收链的补充/修正，并分布在两个独立纠正记录中。主要根因不是需求偏好变化，而是低层写入口授权矩阵、跨 Task/Workspace 继承一致性和里程碑来源链在 initial 关闭门禁中没有被逐入口、逐事实验证。

## 2. 工作流时间线、阶段与结果

| 日期/运行 | 计划与阶段 | 任务 | 策略/结论 | 关键结果 |
| --- | --- | ---: | --- | --- |
| 2026-07-27 / initial | 初始路线图 revision 1；P-001 | 3/3 | relaxed / passed | 冻结生产 Domain、TypeBox 契约、错误目录和规模夹具 |
| 2026-07-27 / initial | P-002 | 3/3 | relaxed / passed | 正式 PostgreSQL 17 Schema、Repository、稳定锁和 Task/Workspace 原子事务 |
| 2026-07-27 / initial | P-003 | 3/3 | relaxed / passed | 模块服务、Outbox/Worker、SSE、对象检查点和 Workspace 平台端口 |
| 2026-07-27–28 / initial | P-004 | 3/3 | relaxed / passed | Node/pnpm、CI、六服务 Compose、规模、安全、兼容和最终整体验收 |
| 2026-07-28 / change-1 | compact P-001 | 3/3 | strict / passed | 以 3 个 red-first 用例关闭 move-to-root、Owner/Workspace 和子任务创建缺口 |
| 2026-07-28 / change-2 | compact P-001，计划最终 revision 3 | 3/3 | strict / passed | 以 5 个 red-first 用例关闭 Follow/Blocker 缺口并修复 AC-010 来源链 |

### 2.1 汇总指标

| 指标 | 结果 |
| --- | --- |
| 分析源工件 | 24 份：合同、需求、路线图、有效快照、3 个状态、2 个 change plan、6 个 phase plan、6 个 phase result、3 个记录 |
| 运行 / 阶段 / 任务 | 3 / 6 / 18；全部 completed |
| 修改记录 / RC | 3 个连续记录 / 6 个 RC |
| 原始需求覆盖 | 28/28 FR；29/29 AC |
| 运行策略 | relaxed 1；strict 2 |
| 验证结论 | passed 3；passed_with_findings 0 |
| Findings | open 0；closed 0；下一稳定编号分别为 `FND-I-001`、`FND-C1-001`、`FND-C2-001` |
| 路线图/变更计划修订 | initial roadmap revision 1；两个 change plan 均 revision 1，无执行中路线图改写 |
| 阶段计划 | 6 份；5 份 revision 1，change-2 P-001 最终 revision 3，共 2 次追加修订 |
| 暂停/阻塞/恢复 | 正式 pause 0；外部容器前置 blocker 1；同一 P-004 任务恢复 1；未知 partial task 0 |
| 纠正阶段 | 2 个；分别对应 change-1、change-2 |
| 需求演进轮次 | 用户意图变更 0；纠正轮次 2 |
| 唯一保留文件变化 | 从 initial 项目基线 `7f23d31` 至最终 HEAD 共 112 个文件；两轮纠正合计涉及 24 个唯一文件 |

### 2.2 阻塞与恢复

P-004-T-002 因宿主缺少真实 Linux 容器入口形成一次 core blocker。状态文件保存了 `Q-001`、当前代码、静态验证、容器前置和恢复步骤；用户将候选保存为提交 `19cc330`。WSL 2/Podman 前置恢复后，同一任务继续完成六服务 Compose 门禁，专用 machine、发行版、容器、卷、端口和临时路径随后精确清理。

该恢复没有改写已完成阶段结果，没有丢失用户工作，也没有把静态 `compose config` 误当成真实运行证据。完成后不存在活动进程、数据库、Compose project 或 partial task。

### 2.3 规划与验证比例

- initial 的四阶段 expanded 设计有明确边界：生产领域契约、破坏性 Schema/真实并发、应用与技术集成、真实发布门禁。每阶段均保持可构建状态，分阶段是相称的。
- change-1 和 change-2 均把相干纠正压缩为一个 compact 阶段，没有拆出独立文档或验证阶段。
- initial、change-1、change-2 各自运行最终根门禁是合理重复：后续生产修改会使前一轮证据失效。定向测试、扩大回归和最终根门禁的顺序均有明确失效边界。
- change-2 phase plan 的 revision 2/3 主要记录任务开始和完成状态；这些状态本可只由 execution state 承担。它没有损害恢复或冻结完整性，但后续工作流应只在计划内容发生实质变化时递增 phase-plan revision。

## 3. 需求变更分类

分类判定问题是：在每次 delta 之前，实施者是否已能在不发明产品决策的情况下实现并验证目标行为。六项均没有改变用户想要的产品结果；它们补齐了遗漏的授权、原子性、并发条件或验收来源，因此主分类均为 B。

| 变更项 | 修改记录 | 关联原始需求 | 主分类 | 次要因素 | 严重程度 | 核心依据 | 置信度 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| RC-001 | [`change-1.md`](change-1.md) | FR-010、FR-017；AC-008、AC-014 | B：对原始需求的补充或修正 | 无 | 高 | move-to-root 曾把虚拟根依赖控制权误作 Task 结构授权，普通模式可越过目标 Task Owner；strict 回归稳定复现并修复 | 高 |
| RC-002 | [`change-1.md`](change-1.md) | FR-016、FR-022；AC-014、AC-016 | B：对原始需求的补充或修正 | 无 | 高 | Owner 变化未覆盖实际继承后代的 Workspace 版本、未提交状态、快照和 lease；涉及跨聚合数据一致性与故障恢复 | 高 |
| RC-003 | [`change-1.md`](change-1.md) | FR-017、FR-028；AC-020、AC-024 | B：对原始需求的补充或修正 | 无 | 高 | 低层子任务创建入口只验证 Membership，未重查父 Task 有效 Owner/admin，构成授权绕过 | 高 |
| RC-2-001 | [`change-2.md`](change-2.md) | FR-011、FR-016–FR-018、FR-028；AC-009、AC-014、AC-017–AC-018、AC-020、AC-024 | B：对原始需求的补充或修正 | 无 | 高 | Follow 低层入口缺 source Owner/admin、Agent 来源和 impact 条件，且完成 source/remove-not-found 边界不完整 | 高 |
| RC-2-002 | [`change-2.md`](change-2.md) | FR-012、FR-014、FR-017–FR-018、FR-020、FR-028；AC-010、AC-012、AC-017–AC-018、AC-020、AC-024 | B：对原始需求的补充或修正 | 无 | 高 | Blocker 入口缺 Owner/admin 与 expected Task version，可能产生越权或并发陈旧写入 | 高 |
| RC-2-003 | [`change-2.md`](change-2.md) | FR-012、AC-010；M0/M2 路线 | B：对原始需求的补充或修正 | 无 | 低 | 有效快照省略原始 AC-010 的提示来源，同时正式路线把 completion-ready/通知放在 M2；本轮只修复来源链和里程碑表述 | 高 |

分类统计：A 0；B 6。严重程度统计：高 5、低 1。两个包含 B 项的编号记录构成两个纠正轮次，因此适用根因分析分支。

## 4. 执行可恢复性与阶段质量

### 4.1 完整性

- 记录链为 `change-0 → change-1 → change-2`，没有缺号或未匹配运行目录。
- phase ID、task ID 和顺序有效；每个 completed phase 恰有一个计划和一个结果。
- requirements、initial roadmap、6 个 phase result、2 个 change plan、2 个纠正 phase plan/result、3 个记录和最终快照的已记录 SHA-256 全部匹配当前文件。
- initial 历史指纹保留当时生成的 effective snapshot；change-1/change-2 分别记录前一快照和最终快照指纹，没有用当前派生文件反向改写旧历史。
- 没有 unresolved question、失败 core、未知迁移、未解释 gap、开放 finding 或故意破坏的中间状态。

### 4.2 恢复质量

expanded initial 阶段在生产编辑、数据库、Worker、容器和清理边界上保留了足够的基线、目标、端口、哈希和恢复步骤。唯一外部阻塞有明确问题 ID、用户回答、保存提交和恢复链；两轮 strict 纠正则以 compact 状态保存 red/green、当前任务、文件范围和环境清理。总体恢复质量为强。

一个可改进点是 initial 将四阶段实现长期保留在同一候选工作树，直到用户在阻塞期保存提交。虽然状态证据和最终记录完整，后续高风险 phased 工作可在合同允许且不破坏不可变历史的前提下，为每个安全阶段建立更明确的版本基线，减少长工作树恢复压力。

## 5. 最终交付与验证证据

| 范围 | 最终证据 | 结论 |
| --- | --- | --- |
| initial | Node 24.18.0/pnpm 11.9.0 根门禁；PostgreSQL 17.10 正式 profile、双迁移、真实锁/事务；三原型；六服务 Podman/Compose；规模与安全 | passed |
| change-1 | 3 个 red-first 缺口；最终 59 files / 219 tests passed，3 files / 7 tests intentionally skipped；根 `pnpm check` 退出 0 | passed |
| change-2 | 5 个 red-first 缺口；最终 49 files / 229 tests passed，3 files / 7 tests intentionally skipped；根 `pnpm check` 退出 0 | passed |
| 当前 HEAD 复验 | 官方 SHA-256 校验的 Node 24.18.0、pnpm 11.9.0；授权宿主中 `pnpm check` 退出 0，format/lint/build/10 workspace typecheck 全通过；37 files / 174 tests passed | passed；15 files / 62 tests 因未提供数据库环境等既有条件跳过 |
| 当前 Git | 工作区在报告生成前干净；`origin/main` 是当前分支祖先，当前分支领先 8、落后 0 | 可 fast-forward |

当前复验没有重新创建 PostgreSQL 或 Compose 环境；这些高成本门禁使用冻结运行中已观察、哈希匹配且后续未被部署/迁移变化失效的证据。change-2 的最终 PostgreSQL 根门禁覆盖最新 Domain/Contracts/Database/API 代码，当前复验又覆盖最新静态、构建和非数据库测试。

## 6. 开放发现项与可选后续

没有开放 `FND-I-*`、`FND-C1-*` 或 `FND-C2-*`。

| ID | 类别 | 严重程度 | 关联需求/验收 | 观察与证据 | 最终功能影响 | 处置 | 置信度 | 建议后续 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 无 | 无 | 无 | 无 | 三个运行均 completed/passed，全部 findings 表为空 | 无 | closed | 高 | 无 |

如未来需要对某个 report-only finding 继续处理，应使用其稳定 `FND-*` ID 发起后续；当前没有可指定的开放 ID。

## 7. 根因分析与预防规则

| 根因模式 | 影响项/运行 | 最早可检测阶段 | 门禁为何漏过 | 返工影响 | 可验证预防规则 |
| --- | --- | --- | --- | --- | --- |
| 授权只在高层语义中成立，没有逐一覆盖所有低层 mutation 入口 | RC-001、RC-003、RC-2-001、RC-2-002；change-1/change-2 | initial requirements/roadmap 的接口与权限影响分析；最迟 P-002/P-003 phase plan | 验收覆盖了主要业务流，但没有形成 `create/move/follow/blocker` 每个入口的 actor、active membership、effective owner、admin、Agent 来源、冻结、版本和 impact 条件矩阵 | 两轮 strict 纠正；多个 Domain/Contracts/Database/API 文件与 PostgreSQL 回归 | 每个新增或变更 mutation 必须在 phase plan 中列出完整授权条件矩阵，并以低层 Repository 负向测试和应用组合测试各证明一次；任一公共/内部入口缺行即阻塞 |
| 继承影响集合与跨聚合原子事实没有在 Owner 变化验收中逐资源展开 | RC-002；change-1 | initial P-002 的 Task/Workspace 原子设计与 AC-014/AC-016 追踪 | 原有门禁证明目标 Task 的原子性，却未逐个证明实际继承后代的 Task version、Workspace sync、uncommitted state、snapshot 和 lease | Owner-change command、Repository、Contracts/API 和故障注入测试返工 | 对所有递归影响操作，验收必须同时包含继承分支、显式隔离分支、逐资源陈旧/未提交拒绝及事务末端故障注入；四类证据缺一则不得关闭 core |
| 原始验收、有效快照与里程碑路线之间缺少逐条来源重放 | RC-2-003；change-2 | initial finalization / effective snapshot 生成 | FR/AC 总体计数完整，但 AC-010 的“一次提示”没有在 snapshot 中记录保留、退役或后续里程碑来源 | 仅文档与来源链纠正，无产品代码返工 | 每次生成 effective snapshot 时，对每个 AC 子句执行 `原文 → 当前状态 → 来源/退役/后续里程碑` 三向重放；任何子句无去向即阻塞 numbered record |

最高优先级结论：未来 M1/M2 的写能力必须先建立“每个 mutation 入口 × 每个授权/并发/冻结/影响条件”的可执行矩阵，并让 Repository 与应用层各有独立负向证据。M0 的两轮纠正都指向这一共同缺口。
