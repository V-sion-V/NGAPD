# P-001：Task UI 原型与 macOS 主体验证结果

- 运行编号：`initial`
- 阶段编号：`P-001`
- 阶段计划：[`phase-001-plan.md`](phase-001-plan.md)，revision `2`
- 父路线图修订：`1`
- 完成日期：`2026-07-25`
- 状态：`completed`
- 交付与验证策略：`relaxed`
- 验证结论：`passed`
- 项目基线：分支 `prototype`，提交 `bcae1aa1c66081c67ecbb9f6391b9613927f775a`

## 1. 阶段目标与结果

P-001 已交付一个不依赖登录、数据库、Task API 或外部网络的确定性 Task UI 原型。`?prototype=task-ui` 在现有 Web 顶层隔离分派，当前父级只显示一幅有限 DAG；节点选择打开右侧非模态详情抽屉，直接子任务保持为列表，只有专用按钮可以下降层级。项目搜索、当前层 AND 筛选、导航快照、键盘、可见焦点和非颜色状态均已实现。

三个规范 profile 的 fixture、索引、同级 DAG 和负向校验已完成。macOS Apple Silicon 上的真实 Chromium 主体结果为 [`pass`](../../../../../prototypes/task-ui/results/2026-07-25-macos-m2-chromium.md)，最终原始根 `pnpm check` 完整通过。临时 Web 服务、浏览器视口覆盖和验收标签页均已清理，没有数据库、API、Workspace 或其他外部写入。

本阶段完成 `FR-001`–`FR-027` 与 `AC-001`–`AC-018`；`AC-022` 的附加视觉/性能证据已完成。`AC-020` 的大于 200 节点扩展规模与 `AC-021` 的非 Chromium 浏览器是 relaxed 策略下明确可选的 supplemental 检查，未执行且不形成 finding。`FR-028`/`AC-019` 的 Windows 11 x64 core 保留给 P-002。

## 2. 任务、需求与验收覆盖

| 任务 | 状态 | 实际结果 | 需求与验收 | 完成证据 |
| --- | --- | --- | --- | --- |
| `P-001-T-001` | completed | 完成三个固定 profile 的完整合成数据、稳定 Task Key、父子/祖先/有效 Owner 索引、直接子任务统计、同父级 DAG 与稳定错误诊断；保留既有 `createWideTaskFixture` 兼容行为 | `FR-003`–`FR-005`, `FR-024`, `FR-025`; `AC-002`, `AC-007`, `AC-015` | test-fixtures 4 个文件/12 项测试、build、typecheck 全部通过 |
| `P-001-T-002` | completed | 完成隔离入口、纯状态/布局、单 DAG、详情抽屉、直接子任务列表、专用下降、搜索/筛选/恢复、键盘和非颜色呈现；正常 Workspace access 保持 | `FR-001`, `FR-002`, `FR-006`–`FR-023`, `FR-026`; `AC-001`, `AC-003`–`AC-013`, `AC-016`, `AC-017` | Web 1 个文件/5 项测试、build、typecheck 与双入口 Chromium 冒烟通过 |
| `P-001-T-003` | completed | 完成 deep/wide/dense 真实浏览器矩阵、性能、滚动、网络、安全、视觉证据和最终工程门禁；修正主体发现的搜索旧值回写、宽/密集 DAG 布局可读性和根门禁测试就绪竞态 | `FR-001`–`FR-027`; `AC-001`–`AC-018`, `AC-022` | macOS 主体 `pass`；7 张截图与指标汇总；最终 `pnpm check` 退出码 0 |

覆盖结论：P-001 范围内的全部 core 均有自动化或真实浏览器证据且通过。`AC-020`、`AC-021` 是已明确记录的 optional/not run；`AC-022` 通过。没有开放的 `FND-I-*`。

## 3. 文件修改

| 文件 | 修改模式 | 结果 |
| --- | --- | --- |
| `packages/test-fixtures/src/task-graph.ts` | modify | 完整 Task UI fixture、profile、索引、有效 Owner/状态、稳定分层 DAG 与数据校验 |
| `packages/test-fixtures/src/task-graph.test.ts` | modify | 规范、确定性、计数、兼容、字段、孤立节点和负向数据覆盖 |
| `packages/test-fixtures/package.json` | modify | 新增浏览器安全的 `./task-graph` 精确导出 |
| `apps/web/package.json` | modify | 新增 fixture workspace 依赖和 Web Vitest 脚本 |
| `pnpm-lock.yaml` | modify | 同步 Web importer |
| `apps/web/src/App.tsx` | modify | 在挂载 Workspace access hooks 前分派 Task UI |
| `apps/web/src/task-ui/TaskUiApp.tsx` | add | 单 DAG、搜索/筛选、层级、键盘、抽屉、空/错误状态和测量标记 |
| `apps/web/src/task-ui/model.ts` | add | 纯交互状态、快照、搜索与 AND 筛选 |
| `apps/web/src/task-ui/layout.ts` | add | 稳定左到右拓扑布局、边和键盘邻接 |
| `apps/web/src/task-ui/model.test.ts` | add | 核心状态与布局目标测试 |
| `apps/web/src/task-ui/task-ui.css` | add | 前缀化桌面样式、有限视口、非颜色类型和可见焦点 |
| `prototypes/task-ui/README.md` | modify | 本地入口、profile、交互与网络隔离说明 |
| `prototypes/task-ui/results/2026-07-25-macos-m2-chromium.md` | add | macOS Chromium 主体结果 |
| `prototypes/task-ui/results/2026-07-25-macos-m2-chromium/metrics-summary.json` | add | 暖缓存首次可交互与交互 P95 汇总 |
| `prototypes/task-ui/results/2026-07-25-macos-m2-chromium/*.png` | add | deep/wide/dense 共 7 张可追溯视觉证据 |
| `apps/workspace-cli/src/mcp.integration.test.ts` | modify | revision 2 范围内的测试同步修正：等待 MCP 初始化后再验证 SIGINT/SIGTERM 退出码；产品代码与 CLI 行为未变 |
| `docs/requirements/task-ui-prototype/execution/initial/phase-001-plan.md` | add/revise | P-001 计划冻结于 revision 2 |
| `docs/requirements/task-ui-prototype/execution/initial/execution-state.md` | add/update | P-001 执行与恢复权威 |
| `docs/requirements/task-ui-prototype/execution/initial/phase-001-result.md` | add | 本不可变阶段结果 |

`packages/test-fixtures/src/index.ts` 既有通配导出已覆盖新增接口，无需修改。生产 Task contract、API、数据库、Workspace CLI 产品代码以及其他 Workspace 包均未修改。

## 4. 测试与验证

| 检查 | 观察结果 | 结论 |
| --- | --- | --- |
| `pnpm --filter @ngapd/test-fixtures test` | 4 个文件、12 项测试通过 | pass |
| `pnpm --filter @ngapd/test-fixtures build` | TypeScript build 退出码 0 | pass |
| `pnpm --filter @ngapd/test-fixtures typecheck` | TypeScript noEmit 退出码 0 | pass |
| `pnpm --filter @ngapd/web test` | 1 个文件、5 项测试通过 | pass |
| `pnpm --filter @ngapd/web build` | Vite 81 modules；最终 JS 260.80 kB、CSS 10.98 kB；退出码 0 | pass |
| `pnpm --filter @ngapd/web typecheck` | TypeScript noEmit 退出码 0 | pass |
| `pnpm --filter @ngapd/workspace-cli typecheck` | revision 2 测试同步变更类型检查退出码 0 | pass |
| `pnpm --filter @ngapd/workspace-cli test` | 6 个文件通过、1 个按平台跳过；24 项通过、2 项跳过 | pass |
| 最终 `pnpm check` | Prettier、ESLint、10 个适用 workspace build/typecheck 和全部适用测试通过；退出码 0 | pass |
| macOS Chromium `deep-tree` | 从项目根进入至最深作用域，逐层/面包屑返回、项目搜索恢复、抽屉/焦点/键盘状态均符合要求 | pass |
| macOS Chromium `wide-siblings` | 当前作用域 200 节点、300 边、有限 2708×2518 布局；连续横纵滚动、选择、搜索、筛选、空状态和层级切换正常 | pass |
| macOS Chromium `dense-dag` | 36 节点、48 边、有限 1620×866 布局；孤立节点可达，方向文字/箭头明确，直接前置/后续采用非颜色轮廓 | pass |
| 暖缓存性能 | TTI 70.0 ms；选择 P95 59.9 ms；搜索 61.4 ms；筛选 63.9 ms；下降 65.2 ms；返回 13.8 ms | pass |
| 双入口与网络观察 | Task UI 无 `/api`/外部请求和控制台 error/warning；正常根入口仍显示原 Workspace access，并仅在该入口出现预期身份请求 | pass |
| 范围、秘密与外部副作用审查 | `git diff --check` 通过；无秘密、Cookie、真实业务内容、外部资源、数据库/API/Workspace 写入；无活动开发服务 | pass |

最终主体环境：macOS `26.5.2` arm64，MacBook Air / Apple M2 / 8 核 / 16 GB，1280×720，默认 100% 缩放。Codex In-app Browser 提供真实 Chromium 页面环境，但控制接口未公开精确 engine build；所有可观察核心路径、性能与视觉证据均已独立记录。

## 5. 发现项与处置

| ID | 类别 | 严重程度 | 关联需求/验收 | 观察与证据 | 最终功能影响 | 处置 | 置信度 | 建议后续 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 无 | — | — | — | P-001 没有开放 report-only finding | 无 | — | 高 | — |

`AC-020` 与 `AC-021` 的 optional/not run 不是异常或 finding；`AC-022` 已完成。下一可用 finding ID 仍为 `FND-I-001`。

## 6. 决策、计划偏差与恢复记录

- 主体观察到项目搜索输入会在快速清除时读到旧值；修正为在状态提交前捕获输入值，并重新执行受影响测试与浏览器路径。
- 初版 wide/dense 依赖排列会形成过宽单行布局，且 dense 未保留孤立节点；改为稳定分层局部 DAG，保留全部节点/有效边和孤立节点，并重新执行三个 profile、滚动、方向、性能与截图。
- 根 `pnpm check` 两次在未改动的 Workspace CLI 信号测试中暴露固定 150 ms 的服务就绪竞态；相同文件串行 4/4、同包独立 24/24 通过，证明不是 Task UI 回归。为满足不可降级的根门禁，阶段计划升至 revision 2，仅把测试同步改为收到 MCP 初始化响应后再发送信号；未修改 CLI 产品代码。修正后同包与最终原始根门禁均通过。
- `pnpm install` 的供应链元数据查询受沙箱网络限制；经明确批准后在沙箱外完成 workspace 链接重建。没有新增图编辑器或外部运行时依赖。
- 临时 Vite 服务已通过 SIGINT 停止；浏览器 1280×720 视口覆盖已复原，验收标签页已关闭。恢复不需要数据库、外部状态或用户数据操作。
- 最终 Git 状态复核时出现独立的未跟踪 `docs/requirements/agent-context-prototype/`；它不与 P-001 范围重叠，未被读取、修改或计入本结果，也不被视为 P-002 前置已满足。

## 7. 遗留风险与下一阶段进入条件

P-001 没有未决产品问题、开放 finding、活动服务、半完成实现或未知外部状态。工作副本保持可构建，可安全停在 `awaiting_next_phase`。

P-002 仍为未规划的 Windows 11 x64 core 阶段，只有以下前置全部满足后，才可单独调用 `$plan-feature-implementation` 创建即时计划：

1. 本 P-001 结果和 macOS 主体结果保持可读、不可变。
2. Agent Context 主体有可追溯 `pass` 结果。
3. 真实 Windows 11 x64 Chromium 入口可执行。
4. 规划时先复核 P-001 后的 Web/fixture 项目漂移；若处理方式不唯一，暂停确认。

在 P-002 完成前不得创建 `change-0.md`、`effective-requirements.md`，也不得把 initial run 标记为 `completed`。
