---
schema_version: "3.2"
feature_id: "workspace-cli"
artifacts:
  requirements: "requirements.md"
  implementation_plan: "implementation-plan.md"
  effective_requirements: "effective-requirements.md"
  change_record_pattern: "change-{N}.md"
  workflow_report: "workflow-report.md"
execution:
  root: "execution"
  initial_run: "initial"
  change_run_pattern: "change-{N}"
  state_filename: "execution-state.md"
  change_plan_filename: "change-plan.md"
  phase_plan_pattern: "phase-{P}-plan.md"
  phase_result_pattern: "phase-{P}-result.md"
change_number_start: 0
---

# Feature Workflow Contract

This is the versioned artifact and state-machine contract for one feature workflow. Populate the frontmatter when creating the feature directory. New workflows use schema version `3.2`; v3 skills must continue to read existing `3.1` and `3.0` workflows under their original contract text.

## Compatibility and migration boundary

Schema `3.2` keeps the immutable history, proportional planning, and state-machine guarantees of `3.1` while adding an explicit per-run strict/relaxed delivery policy, tiered acceptance, and durable report-only findings. It does not reinterpret an existing `3.1` contract. Schema `3.1` retains its proportional rules without the required policy choice; schema `3.0` retains its original stricter contract. Schema `2.0` remains incompatible: a v2 implementation plan is not automatically a v3 roadmap, and a dirty workspace is not an execution state. When a skill encounters an unsupported schema version, stop and require an explicit migration request. Never create v3 state or phase evidence by guessing prior progress.

Keep the contract immutable after creation except during an explicit schema migration. A migration must preserve the old contract and artifact meaning in recorded evidence; never overwrite a frozen workflow merely to make a newer skill proceed.

## Artifact authority and lifecycle

- The requirements document is the original product baseline.
- The implementation-plan artifact is the initial implementation roadmap: global design, cross-phase contracts, phase order, and complete `FR-*`/`AC-*` traceability.
- A change run uses its own `change-plan.md` as the pending delta and phase roadmap; it never rewrites the frozen initial roadmap.
- `execution-state.md` is the mutable, current coordination authority for one run. Chat history is never execution-state authority.
- Phase plans are detailed execution instructions for one phase. A phase plan may be revised with an explicit revision entry until its phase result exists.
- Phase results are immutable completion evidence. Never edit a completed result; append a corrective phase when later work invalidates it.
- Numbered change records are immutable, ordered product deltas and consolidated implementation evidence.
- The effective-requirements document is the regenerable current product authority after the latest completed change record.
- The workflow report is a regenerable retrospective derived from requirements, roadmaps, completed execution evidence, effective requirements, and numbered history.

Use relative paths from this contract. Resolve execution paths by joining `execution.root`, the run directory, and the declared filenames or patterns.

The initial run directory is `execution/<initial_run>/`. A later change reserves number `N` with `execution/<change_run_pattern>/`; allow only one non-completed change run at a time. `{P}` is a zero-padded phase number such as `001`, while the stable phase ID is `P-001`.

Requirements and the initial roadmap may be revised before `change-0.md`, subject to the revision and completed-phase rules below. Creating `change-0.md` freezes the requirements, initial roadmap, contract, initial execution evidence, and numbered history. After that point, express product evolution only through a new change run, its final numbered record, and the effective-requirements snapshot.

## Proportional planning and evidence

Use the lightest plan and evidence that can implement, verify, and safely recover the work.

- Default to one phase. Split phases only for a required safe intermediate state, irreversible migration, public compatibility transition, independent approval or external handoff, independently deliverable subsystem, or a correction after an immutable completed phase.
- Implementation, generated-output refresh, automated verification, manual acceptance, documentation, and workflow closeout are normally tasks or gates inside the same phase. They are not phase boundaries by themselves.
- A phase may contain one coherent task. Do not create tasks to satisfy a preferred count.
- Use `compact` detail by default. Use `expanded` detail only for destructive or irreversible operations, migrations, public compatibility changes, multiple writers, user-owned overlapping changes, fragile generated assets, difficult recovery, or another recorded high-risk condition.
- Record each validation once at the latest point where its result remains valid. Repeat it only when later work can invalidate the evidence or a failure requires a diagnostic rerun.
- Prefer targeted checks and existing deterministic evidence. Do not add test-first ordering, a full suite, full generation, or project-wide audits unless the requirements, project rules, observed risk, or user explicitly require them.
- Fingerprints, per-file hashes, full working-copy inventories, process sampling, and detailed recovery protocols are conditional evidence. Require them only when they resolve real drift, ownership, binary/generated-asset, concurrency, or recovery risk.

## Delivery policy, acceptance tiers, and findings

Every run must record one explicit user-selected delivery policy before planning:

- `strict`: use red-first evidence for changed behavior when a deterministic pre-change check is practical; every in-scope `core` and `supplemental` acceptance item is blocking; repair related anomalies or obtain an explicit user waiver.
- `relaxed`: implementation may precede tests; `core` acceptance and hard gates remain blocking; a `supplemental` anomaly proven not to affect delivered behavior may remain open as a report-only finding without repair or repeated diagnostics.

The mode never weakens security, privacy, data integrity, public compatibility, buildability, required project/release gates, recovery safety, user-owned-work protection, or core acceptance. Never downgrade an acceptance item after a failure merely to finish a run. Uncertain product impact is blocking until resolved.

Assign every `AC-*` one tier:

- `core`: observable delivered behavior, changed-area correctness, compatibility, safety, recovery, or a hard gate.
- `supplemental`: additional robustness, diagnostic depth, optional broad regression, fixture precision, or another explicitly non-critical check.

Use stable run-unique finding IDs: `FND-I-001` onward for the initial run and `FND-C<N>-001` onward for `change-<N>`. A report-only finding must include category, severity (`critical`, `high`, `medium`, `low`, or `info`), related `FR-*`/`AC-*`, observation, evidence, confidence, delivered-function impact, disposition, and recommended follow-up. `critical`/`high`, security/privacy/data/compatibility, build/runtime, unknown-impact, required-gate, or independently unproven core-acceptance findings are always blocking. A validation-fixture or tooling finding may reference a core criterion only when separate deterministic evidence proves that core outcome and the finding has no delivered-function impact. A relaxed run may finish as `passed_with_findings`; execution state remains `completed`, and open findings are not unresolved questions.

## Requirements document schema

Use these sections in order:

1. `背景与目标`
2. `范围`, including `包含范围` and `不包含范围`
3. `已确认的项目事实与约束`
4. `交付与验证策略`
5. `功能需求`
6. `用户流程或调用流程`
7. `数据、接口与状态`
8. `异常、边界与恢复`
9. `非功能需求`
10. `初步实现方向与影响范围`
11. `验收标准`
12. `决策记录`
13. `未决问题`

Require numbered `FR-*` requirements and `AC-*` acceptance criteria. Record the user's explicit `strict` or `relaxed` choice in `交付与验证策略`, and mark every `AC-*` as `core` or `supplemental`. Use deterministic, testable wording. Acceptance criteria describe observable outcomes; name exact commands, full suites, generation passes, or evidence formats only when a project rule, release gate, strict-mode requirement, or explicit user decision requires them. Mark non-applicable sections with a reason. Record cross-phase invariants such as compatibility, security, data migration, rollout, recovery, and operational constraints in the applicable requirements sections; do not leave them only in a phase plan.

Use this decision table:

```markdown
| 决策项 | 结论 | 来源 | 回答要求 |
| --- | --- | --- | --- |
| ... | ... | 用户明确确认 / 采用默认回答 / 项目现有约束 | 可默认 / 必须回答 |
```

A `必须回答` decision may use only `用户明确确认` or `项目现有约束`; never use `采用默认回答`.

Use this acceptance table or an equivalent form that preserves the tier:

```markdown
| 验收 | 层级 | 可观察结果 |
| --- | --- | --- |
| AC-001 | core / supplemental | ... |
```

## Initial implementation roadmap schema

Keep the roadmap compact and complementary to the requirements. Use these sections:

1. `范围与执行模式`, declaring `single` or `phased`, `compact` or `expanded` detail, the selected `strict` or `relaxed` delivery policy, the reason, roadmap revision, requirements fingerprint, and project baseline.
2. `项目现状与全局实现依据`.
3. `全局详细设计`, covering components, cross-phase interfaces, data, errors, security, observability, compatibility, migration, rollout, and rollback as applicable.
4. `阶段路线图`.
5. `跨阶段依赖与不变量`.
6. `最终集成与整体验证流程`.
7. `需求追踪矩阵`.
8. `风险、技术决策与修订记录`.

Use stable phase IDs and this roadmap table:

```markdown
| 阶段 | 目标 | 关联需求与验收 | 前置阶段 | 退出条件 | 当前状态 |
| --- | --- | --- | --- | --- | --- |
| P-001 | ... | FR-... / AC-... | 无 | ... | planned/ready/in_progress/paused/blocked/completed/superseded |
```

Map every `FR-*` and `AC-*` to at least one phase and verification step; group items that share the same implementation and evidence instead of repeating them task by task. Default to a single phase that contains its integration and acceptance gate. In a genuinely phased roadmap, make the final phase own complete integration and acceptance. Split only for the conditions in `Proportional planning and evidence`. Every phase must leave the project buildable or otherwise in a contractually safe state.

The validation flow must distinguish core hard gates from supplemental checks. In strict mode, plan practical red-first evidence and full in-scope anomaly closure. In relaxed mode, do not require red-first order or schedule repair work solely for report-only findings; plan implementation-first targeted validation plus final finding consolidation.

Generate detailed phase plans just in time. The initial roadmap creates only the first executable phase plan. Later planning invocations create exactly the next eligible phase plan after reviewing completed results and current project facts.

Increment the roadmap revision for every retained revision. Preserve the prior conclusion, reason, affected phases, user decision or project evidence, and traceability impact in `修订记录`. Never rewrite a completed phase result. If a revision invalidates completed work, append a corrective phase.

## Change-run plan schema

Write `change-plan.md` inside `execution/change-<N>/`. It is pending execution authority, not an immutable numbered change record. Use these sections:

1. `变更说明审核与待生效增量`, containing exact reserved `RC-<N>-*` add/modify/delete rows.
2. `当前有效状态与项目依据`.
3. `影响分析与全局设计`.
4. `阶段路线图` using the roadmap table above.
5. `跨阶段依赖与兼容约束`.
6. `最终集成、回归与验收流程`.
7. `需求与阶段追踪矩阵`.
8. `风险、技术决策与修订记录`.

Apply the same proportional planning, rolling-planning, revision, completed-phase, and safe-state rules as the initial roadmap. A single-phase change run contains its final integration gate; do not append a separate verification phase by default. If the accepted delta changes during execution, revise this plan and add corrective phases rather than altering completed results. The delta becomes official only when the final `change-<N>.md` is written.

Each new change run requires its own explicit strict/relaxed choice; do not inherit the initial run's mode silently. Record it in the change plan and state. A request naming an existing `FND-*` must preserve that finding ID and state whether the run changes product behavior, adds acceptance evidence, or only repairs validation infrastructure.

## Phase-plan schema

Write one plan for the next executable phase using the declared pattern. Include metadata for run ID, phase ID, plan revision, parent roadmap or change-plan revision, requirements/effective-requirements fingerprint, project baseline, creation date, detail level (`compact` or `expanded`), delivery policy (`strict` or `relaxed`), and validation conclusion (`pending` initially).

Use these sections:

1. `阶段目标、边界与关联需求`.
2. `任务与文件范围`.
3. `验证与完成条件`.
4. `风险、恢复与修订记录`.

Give each task a run-unique ID such as `P-001-T-001`. In `compact` detail, use one task table and include only the outcome, affected files or areas, implementation summary, validation, and done condition:

```markdown
| 任务 | 结果 | 文件或范围 | 实现摘要 | 验证 | 完成条件 |
| --- | --- | --- | --- | --- | --- |
| P-001-T-001 | ... | `path/to/file` | ... | ... | ... |
```

One coherent task is valid. Add dependencies only when more than one task exists. Do not repeat the same `FR-*`/`AC-*`, validation command, file purpose, or evidence in several sections.

For `expanded` detail, add only the risk-relevant information needed for safe execution: prerequisites, exact per-file ownership, exposed interfaces, ordered steps, migration or rollback, writer coordination, test procedure, and expected recovery evidence. A separate file table is optional and should be used only when per-file ownership or interface impact is material.

Before a phase result exists, increment the plan revision and preserve every material revision in its revision table. Once the result exists, freeze the plan with the result; represent later correction as a new phase.

## Execution-state schema

Create `execution-state.md` before the first production edit in a run and update it as the first and last operation around every task. Use these metadata fields:

- `运行编号`: `initial` or `change-<N>`
- `运行类型`: `首次实现` or `需求变更`
- `目标记录`: `change-0.md` or `change-<N>.md`
- `运行状态`: `planning`, `ready`, `in_progress`, `paused`, `blocked`, `awaiting_next_phase`, `finalizing`, or `completed`
- `交付与验证策略`: `strict` or `relaxed`
- `验证结论`: `pending`, `passed`, or `passed_with_findings`
- `当前路线图修订`
- `需求指纹`
- `路线图或变更计划指纹`
- `当前阶段`
- `当前任务`
- `项目基线`
- `最后更新时间`

Use these sections:

1. `运行目标或待生效变更`.
2. `阶段状态`.
3. `当前检查点`.
4. `已完成任务`.
5. `运行累计文件变化`.
6. `测试与验证证据`.
7. `决策、待确认问题与回答`.
8. `发现项、偏差、风险与阻塞`.
9. `精确恢复步骤`.
10. `最终完成门禁`.

Use this question table in section 7:

```markdown
| ID | 阶段/任务 | 问题 | 已确认事实 | 可选方案与影响 | 需要确认 | 状态 | 用户回答及来源 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Q-001 | ... | ... | ... | ... | ... | unresolved/resolved | ... |
```

Before changing a task's project files, set the run and phase to `in_progress`, record the active task, affected scope, exact completion condition, and the minimum baseline needed to distinguish prior work from this task. After its required validation, record actual files, observed outcome, deviations, and completion before selecting another task. Use per-file hashes or full status captures only under the proportional-evidence rules.

On pause, uncertainty, failure, or external interruption, do not start another task. Persist the exact safe state, unresolved questions, relevant diff, observed validation, and next action before ending the turn whenever execution is still available. Detailed recovery steps are required only while a task is partial, blocked, or exposed to the expanded-detail risks. If interruption occurred before a post-task checkpoint, keep the task `in_progress`; a later run must reconstruct it from the recorded scope and current project facts and may not assume completion.

Only one phase may be `ready`, `in_progress`, `paused`, or `blocked`. After a non-final phase result, set the run to `awaiting_next_phase`. Set `completed` only after the numbered record and effective snapshot are consistent. A completed state is immutable execution evidence.

Record each `FND-*` once in section 8 and update only its evidence, disposition, and follow-up status. In relaxed mode, a report-only finding may remain `open` while the run becomes `completed`; it must be consolidated into the phase result and numbered record. Never represent an open report-only finding as a failed core check or unresolved user question.

## Phase-result schema

Create the declared result only after the phase exit gate passes. Include run ID, phase ID, phase-plan link and revision, parent roadmap revision, completion date, `状态: completed`, delivery policy, and validation conclusion (`passed` or `passed_with_findings`). Include start/end baselines only when they were required by the plan's detail level or an observed recovery issue.

Use these sections:

1. `阶段目标与结果`.
2. `任务、需求与验收覆盖`.
3. `文件修改` using the common file table.
4. `测试与验证` with commands and observed results.
5. `发现项与处置` using the common finding table.
6. `决策、计划偏差与恢复记录`.
7. `遗留风险与下一阶段进入条件`.

Do not complete a phase with an unresolved material question, failed core or strict-mode-required test, unknown half-applied migration, or deliberately broken project state. A relaxed phase may complete with report-only findings only when every core criterion and hard gate passes and evidence establishes that each finding does not affect delivered behavior. Set its validation conclusion to `passed_with_findings`. Freeze the phase plan and result together.

Use this common finding table in phase results, numbered records, and the workflow report:

```markdown
| ID | 类别 | 严重程度 | 关联需求/验收 | 观察与证据 | 最终功能影响 | 处置 | 置信度 | 建议后续 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FND-I-001 | validation-fixture | low | AC-... supplemental | ... | 无已知影响 | report-only/open | 高/中 | 如需继续，请指定 FND-I-001 |
```

## Effective-requirements snapshot schema

Create this derived document only when `change-0.md` completes, then advance it after each later completed record. Use these sections:

```markdown
# <功能名称>：当前有效需求

- 派生状态：可重新生成
- 原始需求：<relative link>
- 已应用至修改记录：change-<N>.md
- 生成日期：<YYYY-MM-DD>

## 1. 当前目标与范围
## 2. 当前生效需求
## 3. 当前流程
## 4. 当前数据、接口与状态
## 5. 当前异常、边界、安全与恢复
## 6. 当前非功能要求
## 7. 当前验收要求
## 8. 当前决策
## 9. 已替换或退役项目
## 10. 来源链
```

Use this active-requirement table:

```markdown
| 当前编号 | 当前生效内容 | 验收要求与层级 | 来源 |
| --- | --- | --- | --- |
| FR-... / RC-... | ... | AC-... core/supplemental / 可验证条件 | requirements.md / RC-... |
```

For `add`, use the `RC-*` ID unless the delta explicitly creates a stable `FR-*` or `AC-*`. For `modify`, preserve the targeted current ID, replace its effective content, and update its source. For `delete`, remove active behavior and add a provenance-preserving retired entry. Keep unaffected behavior active and make the snapshot self-contained.

## Change-record schema

Use filenames matching the pattern and continuous integers starting at `0`. Use common metadata for number, type, relative requirements link, initial roadmap link, execution-run plan or state link, project baseline, and completion date.

Use lowercase file modes only: `add`, `modify`, `delete`, `rename`, and `move`.

```markdown
| 文件 | 修改模式 | 主要目的 |
| --- | --- | --- |
| `path/to/file` | add/modify/delete/rename/move | ... |
```

Use these common sections:

1. `实现概述`
2. `文件修改`
3. `需求、阶段与任务完成情况`
4. `测试与验证`
5. `与路线图及阶段计划的偏差`
6. `遗留事项`

For `change-0.md`, use only the common sections. Consolidate every retained project and workflow change across the initial phase results. Include the completed execution state, every retained phase plan and result, `change-0.md`, and the new effective snapshot in the inventory.

Record the run's strict/relaxed policy and validation conclusion in `测试与验证`. Consolidate every open `FND-*` in `遗留事项` using the common finding table. A relaxed `passed_with_findings` record is complete only when all such findings are present and none violates a core criterion or hard gate.

For every later record, insert this section before the common sections:

```markdown
## 1. 原始需求变更项目

| 变更项 | 变更类型 | 关联原始需求或历史变更 | 变更前 | 变更后 | 验收影响 |
| --- | --- | --- | --- | --- | --- |
| RC-<N>-001 | add/modify/delete | FR-... / AC-... / RC-... / 新增 | ... | ... | ... |
```

Consolidate the matching change run and include its plan, completed state, every phase plan and result, new change record, and updated effective snapshot. Never use phase results as requirement deltas.

## Workflow-report schema

Use common metadata for report type, requirements, initial roadmap, execution evidence range, change-record range, effective snapshot, and generation date.

Use these common sections:

1. `结论`
2. `工作流时间线、阶段与结果`
3. `需求变更分类`
4. `执行可恢复性与阶段质量`
5. `最终交付与验证证据`
6. `开放发现项与可选后续`

Use this classification table:

```markdown
| 变更项 | 修改记录 | 关联原始需求 | 主分类 | 次要因素 | 严重程度 | 核心依据 | 置信度 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| RC-... | change-...md | FR-... / AC-... / 决策项 | A/B 的完整中文分类 | A/B/无 | 低/中/高 | ... | 高/中 |
```

Report phase count, contract detail level, each run's strict/relaxed policy and validation conclusion, planning and validation proportionality, interrupted or paused checkpoints, plan revisions, corrective phases, recovery integrity, and final verification. List every open `FND-*` exactly once using the common finding table and preserve its continuation ID. Add the branch-specific best-practice, focused-correction, or root-cause sections required by the analysis skill.
