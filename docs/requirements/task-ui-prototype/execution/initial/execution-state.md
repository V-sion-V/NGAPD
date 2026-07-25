# 平铺树状 Task UI 原型：初始执行状态

- 运行编号：`initial`
- 运行类型：`首次实现`
- 目标记录：`change-0.md`
- 运行状态：`awaiting_next_phase`
- 交付与验证策略：`relaxed`
- 验证结论：`passed`
- 当前路线图修订：`1`
- 需求指纹：`sha256:222a3f69cef2d36970c621336398792cfa3056bf342597c9822230d6582a99a0`
- 路线图或变更计划指纹：`sha256:32e027d7698f367572ad85d39b8713f75153c8310ce0cc73964f478858127375`
- 当前阶段：无
- 当前任务：无
- 项目基线：分支 `prototype`，提交 `bcae1aa1c66081c67ecbb9f6391b9613927f775a`
- 最后更新时间：`2026-07-25`

## 1. 运行目标或待生效变更

实现并验证夹具驱动的平铺树状 Task UI 原型：当前父级作用域只显示一幅有限 DAG，选择节点后打开右侧详情抽屉和直接子任务列表，只有专用按钮可以进入下一层；完成项目搜索、当前层筛选、键盘/非颜色状态和 macOS Chromium 主体性能证据。P-001 完成后安全等待 Agent Context 主体与真实 Windows 入口，P-002 最终完成 Windows 11 x64 core 兼容和工作流封存。

规划审核结论：schema `3.2` 需求完整，用户明确选择 `relaxed`，28 个 `FR-*` 与 22 个分级 `AC-*` 均有路线图实现或验证映射；没有未决产品问题。路线图因最后的 Windows 真实环境和 Agent Context 主体构成独立外部交接而采用两阶段 `phased`，但没有 migration、不可逆数据、公共兼容切换、多 writer 或困难恢复风险，因此使用 `compact` 细节。

## 2. 阶段状态

| 阶段 | 状态 | 计划 | 结果 | 目标 | 下一进入条件 |
| --- | --- | --- | --- | --- | --- |
| P-001 | completed | [`phase-001-plan.md`](phase-001-plan.md) revision 2 | [`phase-001-result.md`](phase-001-result.md) | 实现原型、自动化和 macOS Chromium 主体结果 | 已完成；结果冻结 |
| P-002 | planned | 无；前置满足后即时创建 | 无 | Windows 11 x64 core、最终漂移复核与工作流封存 | P-001 完成；Agent Context 主体 `pass`；真实 Windows 11 x64 浏览器入口可执行 |

当前没有活动阶段。P-001 已完成并冻结；P-002 不可在外部前置满足前创建阶段计划。

## 3. 当前检查点

- 契约与权威：`workflow-contract.md` schema `3.2`；requirements 与 roadmap revision 1 保持原指纹；P-001 计划冻结于 revision 2，结果为 [`phase-001-result.md`](phase-001-result.md)。
- P-001 结论：`FR-001`–`FR-027`、`AC-001`–`AC-018` core 全部通过；`AC-022` 通过；`AC-020` 与 `AC-021` 为 optional/not run，不形成 finding。
- fixture：三个 profile 的确定性数据、稳定 Key、父子/祖先/有效 Owner 索引、直接子任务统计、同父级 DAG 和稳定负向诊断完成；12/12 目标测试、build、typecheck 通过。
- Web：隔离 Task UI 入口、纯状态/布局、有限单 DAG、非模态抽屉、直接子任务列表、专用下降、搜索/筛选/快照、键盘与非颜色状态完成；5/5 目标测试、build、typecheck 通过，正常 Workspace access 保持。
- macOS 主体：macOS `26.5.2` arm64、MacBook Air/M2/8 核/16 GB、真实 Chromium、1280×720、100% 缩放；deep/wide/dense 功能、方向、滚动、空状态、焦点与性能全部通过。主体结果与 7 张截图、指标汇总位于 `prototypes/task-ui/results/`。
- 性能：暖缓存首次可交互 70.0 ms；选择/搜索/筛选/下降/返回 P95 分别为 59.9/61.4/63.9/65.2/13.8 ms，均满足门槛。
- 最终工程门禁：修正 Workspace CLI 测试的 MCP 就绪同步后，目标包 24/24 通过；最终原始 `pnpm check` 的 format、lint、10 个适用 workspace build/typecheck 和全部适用测试完整通过。
- 安全与范围：Task UI 无 `/api`/外部请求、Cookie、真实业务内容、数据库/API/Workspace 写入或秘密；生产 Task contract、API、数据库和 Workspace CLI 产品代码未修改。
- 并行用户工作：最终状态复核出现独立未跟踪目录 `docs/requirements/agent-context-prototype/`；它与 P-001 范围不重叠，未读取、未修改、未纳入本阶段，也不代表 P-002 前置已满足。
- 清理：临时 Vite 服务已停止；浏览器视口覆盖已复原，验收标签页已关闭；没有活动服务、外部写入或半完成实现。
- 当前安全状态：`awaiting_next_phase`。用户明确要求暂不执行 P-002；在 Agent Context 主体 `pass` 与真实 Windows 11 x64 入口满足前，不创建 P-002 计划、`change-0.md` 或 `effective-requirements.md`。

## 4. 已完成任务

| 任务 | 状态 | 实际结果 | 验证 |
| --- | --- | --- | --- |
| `P-001-T-001` | completed | 新增完整 Task UI 数据模型、固定 profile 生成、索引、局部 DAG 和稳定校验；保留宽层级兼容接口 | test-fixtures 4 个文件/12 项测试通过；build 与 typecheck 通过 |
| `P-001-T-002` | completed | 隔离 Task UI 顶层入口、纯状态/搜索/筛选/导航/布局、单 DAG React UI、详情抽屉、键盘与原型说明 | Web 1 个文件/5 项测试通过；build、typecheck 与 Chromium 双入口冒烟通过 |
| `P-001-T-003` | completed | 完成三个 profile 的 macOS Chromium 主体、性能/滚动/焦点/非颜色/网络与视觉证据；修正主体 core 问题和根门禁测试同步竞态 | macOS 主体 `pass`；7 张截图和指标汇总；Workspace CLI 24/24；最终 `pnpm check` 通过 |

## 5. 运行累计文件变化

| 文件 | 修改模式 | 归属与状态 |
| --- | --- | --- |
| `docs/requirements/task-ui-prototype/requirements.md` | add | 已批准需求输入；实现阶段不得修改，除非先执行显式 pre-freeze 需求修订 |
| `docs/requirements/task-ui-prototype/workflow-contract.md` | add | schema 3.2 契约；保持不可变 |
| `docs/requirements/task-ui-prototype/implementation-plan.md` | add | 路线图 revision 1 |
| `docs/requirements/task-ui-prototype/execution/initial/execution-state.md` | add | 当前可变执行权威 |
| `docs/requirements/task-ui-prototype/execution/initial/phase-001-plan.md` | add/revise | P-001 阶段计划冻结于 revision 2 |
| `packages/test-fixtures/src/task-graph.ts` | modify | `P-001-T-001` 完成；完整确定性 fixture/索引/校验实现 |
| `packages/test-fixtures/src/task-graph.test.ts` | modify | `P-001-T-001` 完成；规范对齐、profile、字段、兼容与负向验证 |
| `packages/test-fixtures/package.json` | modify | `P-001-T-002` 集成；新增浏览器安全的 `./task-graph` 精确导出 |
| `apps/web/package.json` | modify | `P-001-T-002` 完成；fixture workspace 依赖与 Vitest 目标脚本 |
| `pnpm-lock.yaml` | modify | `P-001-T-002` 完成；同步 Web workspace 依赖/测试工具 importer |
| `apps/web/src/App.tsx` | modify | `P-001-T-002` 完成；Task UI/Workspace access 顶层分派 |
| `apps/web/src/task-ui/TaskUiApp.tsx` | add | `P-001-T-002` 完成；单 DAG、抽屉、搜索/筛选、层级与键盘呈现 |
| `apps/web/src/task-ui/model.ts` | add | `P-001-T-002` 完成；纯交互状态、快照、搜索和 AND 筛选 |
| `apps/web/src/task-ui/layout.ts` | add | `P-001-T-002` 完成；稳定拓扑布局、边路径和方向键邻接 |
| `apps/web/src/task-ui/model.test.ts` | add | `P-001-T-002` 完成；核心状态和布局目标测试 |
| `apps/web/src/task-ui/task-ui.css` | add | `P-001-T-002` 完成；前缀化桌面样式、非颜色类型和可见焦点 |
| `prototypes/task-ui/README.md` | modify | `P-001-T-002` 完成；入口、profile 与隔离网络边界说明 |
| `prototypes/task-ui/results/2026-07-25-macos-m2-chromium.md` | add | `P-001-T-003` 完成；macOS Chromium 主体 `pass` 结果 |
| `prototypes/task-ui/results/2026-07-25-macos-m2-chromium/metrics-summary.json` | add | `P-001-T-003` 完成；TTI 与重复交互 P95 汇总 |
| `prototypes/task-ui/results/2026-07-25-macos-m2-chromium/*.png` | add | `P-001-T-003` 完成；deep/wide/dense 共 7 张视觉证据 |
| `apps/workspace-cli/src/mcp.integration.test.ts` | modify | `P-001-T-003` revision 2；仅修正测试等待 MCP 初始化的同步竞态，产品代码与 CLI 行为未变 |
| `docs/requirements/task-ui-prototype/execution/initial/phase-001-result.md` | add | P-001 不可变完成结果 |

`packages/test-fixtures/src/index.ts` 无需修改，既有 `export * from "./task-graph.js"` 已导出新增接口。

## 6. 测试与验证证据

| 检查 | 范围 | 观察结果 | 结论 |
| --- | --- | --- | --- |
| 契约与路径审计 | requirements、workflow contract、feature directory | schema 3.2；声明路径一致；无 frozen history 或 schema 冲突 | pass |
| 需求完整性与追踪 | 28 个 FR、22 个 AC、决策和未决问题 | policy 位于功能需求前；AC 全部分级；必须回答项来自用户明确确认；路线图映射完整 | pass |
| 项目实现基线 | Web、test-fixtures、原型规范、根工具链、Workspace Sync 等待状态 | 支持两阶段 compact 方案；P-001 可独立执行，P-002 当前前置未满足 | pass |
| 规划文档格式 | requirements、contract、roadmap | Prettier 与 `git diff --check` 通过 | pass |
| `pnpm --filter @ngapd/test-fixtures test` | test-fixtures 目标测试 | 4 个测试文件、12 项测试全部通过 | pass |
| `pnpm --filter @ngapd/test-fixtures build` | test-fixtures 生成构建 | TypeScript build 退出码 0 | pass |
| `pnpm --filter @ngapd/test-fixtures typecheck` | test-fixtures 类型检查 | TypeScript noEmit 退出码 0 | pass |
| `pnpm --filter @ngapd/web test` | Web 纯状态与布局 | 1 个测试文件、5 项测试全部通过 | pass |
| `pnpm --filter @ngapd/web build` | Web 生产 bundle | 精确 fixture 子路径修正后 Vite 81 modules；最终 JS 260.80 kB、CSS 10.98 kB；退出码 0 | pass |
| `pnpm --filter @ngapd/web typecheck` | Web 类型检查 | TypeScript noEmit 退出码 0 | pass |
| macOS Chromium Task UI 冒烟 | `deep-tree` 顶级节点、抽屉、专用进入 | 6 节点/3 边；选择 `ZERO-D-0001` 显示完整详情/5 个直接子任务；进入后 5 节点/2 边、无选择且抽屉收起；控制台无错误 | pass |
| macOS Chromium 双入口网络/内容观察 | Task UI 与正常根入口 | Task UI 期间无 Vite `/api` 代理记录；切换正常入口后出现预期 `/api/v1/auth/session` 代理尝试并显示原注册/登录 UI | pass |
| macOS Chromium 三 profile 主体 | deep-tree、wide-siblings、dense-dag | 深层往返/搜索恢复；200 节点 300 边有限滚动；36 节点 48 边方向、直接关系与孤立节点；键盘/焦点/非颜色/空状态均通过 | pass |
| 浏览器性能 | wide-siblings 暖缓存 | TTI 70.0 ms；选择/搜索/筛选/下降/返回 P95 均低于 66 ms，全部低于 200 ms | pass |
| `pnpm --filter @ngapd/workspace-cli typecheck` | revision 2 测试同步 | TypeScript noEmit 退出码 0 | pass |
| `pnpm --filter @ngapd/workspace-cli test` | Workspace CLI 完整包 | 6 个文件通过、1 个按平台跳过；24 项通过、2 项跳过 | pass |
| 最终 `pnpm check` | 全仓根门禁 | Prettier、ESLint、10 个适用 workspace build/typecheck 和全部适用测试通过，退出码 0 | pass |
| 范围、秘密与外部副作用审查 | Git diff、Task UI 源码与证据 | `git diff --check` 通过；无秘密、Cookie、外部资源、真实业务数据或外部写入；无活动服务 | pass |

## 7. 决策、待确认问题与回答

| ID | 阶段/任务 | 问题 | 已确认事实 | 可选方案与影响 | 需要确认 | 状态 | 用户回答及来源 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Q-001 | requirements | 交付与验证策略 | schema 3.2 必须由用户选择 | strict / relaxed | 选择当前运行策略 | resolved | 用户明确选择 `relaxed` |
| Q-002 | requirements | 当前层、详情和下降交互 | 用户要求只有一幅 DAG，详情为右侧抽屉，子任务为列表 | 普通列表/多 DAG/单 DAG 抽屉 | 确认可观察 UI 行为 | resolved | 用户明确确认单 DAG、抽屉、子任务列表和专用进入按钮 |
| Q-003 | requirements | 平台验证顺序 | macOS 当前可执行；Windows 与 Agent Context 尚未就绪 | 现在等待 / macOS 先行、Windows 最后 | 确认 core 顺序 | resolved | 用户明确要求先完成 macOS 可执行内容，Windows 放到最后且保持 core |

无未决问题。

## 8. 发现项、偏差、风险与阻塞

- 下一可用 finding ID：`FND-I-001`。
- 当前没有 `FND-I-*`；下一可用 ID 为 `FND-I-001`。
- `AC-020` 和 `AC-021` 的 optional/not run 不是 finding；`AC-022` 已完成。
- P-001 执行中发现的搜索旧值回写、宽/密集布局可读性和测试就绪竞态均已修正并通过受影响检查，不留开放风险。
- 唯一未完成平台范围是 P-002 的 Windows 11 x64 core；这是需求明确的后续外部门禁，不影响已冻结的 P-001，也不允许整个 initial run 最终封存。
- 用户工作重叠：未发现。独立出现的 `docs/requirements/agent-context-prototype/` 属于非重叠并行工作，已原样保留。

## 9. 精确恢复步骤

P-001 已完成并处于只读安全等待；没有活动 Vite 服务、浏览器会话、数据库或外部写入。后续只在用户重新要求且 P-002 外部前置满足时恢复：

1. 读取本 state、`phase-001-result.md`、`../../implementation-plan.md`、`../../requirements.md` 和 macOS 主体结果。
2. 验证 requirements 指纹仍为 `sha256:222a3f69cef2d36970c621336398792cfa3056bf342597c9822230d6582a99a0`，roadmap 指纹仍为 `sha256:32e027d7698f367572ad85d39b8713f75153c8310ce0cc73964f478858127375`，P-001 plan/result 未被修改，且不存在 `change-0.md`。
3. 确认 Agent Context 主体结果为 `pass`，且真实 Windows 11 x64 Chromium 入口可执行；任一条件不满足都保持 `awaiting_next_phase`。
4. 检查 P-001 后的 Git 与 Web/fixture 项目漂移；若处理方式不唯一或与用户工作重叠，暂停确认。
5. 只有以上条件满足后，单独调用 `$plan-feature-implementation` 即时创建 P-002 计划；不得从聊天记录猜测或提前执行 Windows core。

## 10. 最终完成门禁

- [x] P-001 的 T-001–T-003、全部 core、macOS 主体、根工程与安全硬门禁通过。
- [x] P-001 计划/结果冻结，运行安全转为 `awaiting_next_phase`，没有活动服务或半完成实现。
- [x] P-002 未提前规划，`change-0.md` 与 `effective-requirements.md` 未创建。

- [ ] P-001 与 P-002 都有完成且不可变的 phase result。
- [ ] `FR-001`–`FR-028` 和 `AC-001`–`AC-022` 的最终追踪一致。
- [ ] 所有 core、构建、安全、恢复、正常 Web 兼容和平台硬门禁通过。
- [ ] macOS Apple Silicon 与 Windows 11 x64 真实浏览器 core 场景都有可追溯证据。
- [ ] 所有开放 `FND-I-*` 均符合 relaxed report-only 规则并汇总到最终记录。
- [ ] 没有未决产品问题、用户工作重叠、活动测试服务、半完成实现或未知外部状态。
- [ ] `change-0.md` 与 `effective-requirements.md` 只在 P-002 最终门禁通过后创建并与本 state 一致。
- [ ] 运行最终更新为 `completed`，验证结论为 `passed` 或合规的 `passed_with_findings`。
