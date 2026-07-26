# 平铺树状 Task UI 原型：修改记录 0

- 修改记录编号：`0`
- 修改类型：首次实现
- 原始需求：[`requirements.md`](requirements.md)
- 初始路线图：[`implementation-plan.md`](implementation-plan.md)，revision `1`
- 执行状态：[`execution-state.md`](execution/initial/execution-state.md)
- 项目基线：分支 `prototype`；初始提交 `bcae1aa1c66081c67ecbb9f6391b9613927f775a`；最终阶段复核提交 `a3044bf4ef207df597b0c37ce3b4ef8f3dba52fd`
- 完成日期：`2026-07-26`

## 1. 实现概述

首次实现已交付一个位于现有 React/Vite Web 的隔离 Task UI 原型。固定 seed 的共享 fixture 生成并校验 `deep-tree`、`wide-siblings`、`dense-dag` 三个 profile、完整任务展示字段、Owner 继承、直接子任务统计和同父级无环依赖。Web 在任一时刻只显示当前父级的一幅有限 DAG；节点选择打开右侧非模态详情抽屉，直接子任务保持列表，只有专用按钮可以下降层级。

搜索定位/恢复、五类当前层 AND 筛选、层级/视口快照、刷新归零、键盘 roving focus、可见焦点和非颜色状态均已完成。正常 Workspace access 入口保持原注册、登录和设备行为，Task UI 不需要登录、数据库、Task API 或外部服务。

macOS Apple Silicon 真实 Chromium 与 Windows x64 真实 Chrome 主体均为 `pass`。Windows 阶段还把三个 Workspace CLI 测试文件改为平台安全临时目录、平台正确 signal 观察和明确 macOS/APFS 守卫，并把 Task UI 性能诊断从易受遮挡窗口节流影响的下一动画帧改为 React DOM 提交完成；没有 Workspace CLI 产品代码、Task API、数据库或生产 Task 契约变化。

## 2. 文件修改

| 文件 | 修改模式 | 主要目的 |
| --- | --- | --- |
| `docs/requirements/task-ui-prototype/requirements.md` | add | 已批准的 28 项 FR、22 项分级 AC、决策和边界 |
| `docs/requirements/task-ui-prototype/workflow-contract.md` | add | schema 3.2 工作流契约 |
| `docs/requirements/task-ui-prototype/implementation-plan.md` | add | 两阶段 compact 初始路线图 revision 1 |
| `docs/requirements/task-ui-prototype/execution/initial/execution-state.md` | add | initial run 的执行、恢复、验证和完成权威 |
| `docs/requirements/task-ui-prototype/execution/initial/phase-001-plan.md` | add | P-001 即时计划，冻结于 revision 2 |
| `docs/requirements/task-ui-prototype/execution/initial/phase-001-result.md` | add | P-001 不可变 `passed` 结果 |
| `docs/requirements/task-ui-prototype/execution/initial/phase-002-plan.md` | add | P-002 即时计划 revision 1 |
| `docs/requirements/task-ui-prototype/execution/initial/phase-002-result.md` | add | P-002 不可变 `passed` 结果 |
| `docs/requirements/task-ui-prototype/change-0.md` | add | 本首次实现的不可变汇总记录 |
| `docs/requirements/task-ui-prototype/effective-requirements.md` | add | 应用至 change-0 的当前有效需求快照 |
| `packages/test-fixtures/src/task-graph.ts` | modify | 完整确定性 profile、任务/Owner/状态/依赖生成、索引和稳定校验 |
| `packages/test-fixtures/src/task-graph.test.ts` | modify | 规范、确定性、字段、计数、兼容、孤立节点和负向数据测试 |
| `packages/test-fixtures/package.json` | modify | 新增浏览器安全的 `./task-graph` 精确导出 |
| `apps/web/package.json` | modify | 增加 fixture workspace 依赖和 Web Vitest 脚本 |
| `pnpm-lock.yaml` | modify | 同步 Web workspace importer |
| `apps/web/src/App.tsx` | modify | 在挂载身份 Query 前隔离分派 Task UI / Workspace access |
| `apps/web/src/task-ui/TaskUiApp.tsx` | add | 单 DAG、抽屉、详情/子任务、搜索/筛选、层级、键盘和 DOM 提交性能标记 |
| `apps/web/src/task-ui/model.ts` | add | 纯状态、快照、搜索和 AND 筛选 |
| `apps/web/src/task-ui/layout.ts` | add | 稳定拓扑分层、SVG 边路径和方向键邻接 |
| `apps/web/src/task-ui/model.test.ts` | add | 核心状态与布局测试 |
| `apps/web/src/task-ui/task-ui.css` | add | 前缀化桌面样式、有限滚动视口、焦点和非颜色状态 |
| `prototypes/task-ui/README.md` | modify | 原型入口、profile、交互和网络隔离说明 |
| `prototypes/task-ui/results/2026-07-25-macos-m2-chromium.md` | add | macOS Chromium 主体 `pass` 记录 |
| `prototypes/task-ui/results/2026-07-25-macos-m2-chromium/*` | add | 7 张截图和性能指标汇总 |
| `prototypes/task-ui/results/2026-07-26-windows-x64-chromium.md` | add | Windows Chrome 主体 `pass` 记录 |
| `prototypes/task-ui/results/2026-07-26-windows-x64-chromium/*` | add | 11 张截图、性能原始样本和双入口 Vite 日志 |
| `apps/workspace-cli/src/mcp.integration.test.ts` | modify | P-001 等待 MCP 初始化；P-002 验证 POSIX 退出码和 Windows signal 观察 |
| `apps/workspace-cli/src/adapters/filesystem.integration.test.ts` | modify | 系统临时目录和明确 macOS/APFS 集成守卫 |
| `apps/workspace-cli/src/workspace-runtime.test.ts` | modify | 系统临时目录和明确 macOS/APFS 真实适配器守卫 |

`packages/test-fixtures/src/index.ts` 的既有通配导出已覆盖新增接口，无需修改。生产 Task contract、API、数据库、Workspace CLI 产品实现、同步协议、凭据和其他 Workspace 包均未修改。

## 3. 需求、阶段与任务完成情况

| 阶段 / 任务 | 状态 | 完成范围 | 需求与验收 |
| --- | --- | --- | --- |
| `P-001-T-001` | completed | 三 profile 确定性数据、稳定 Key、完整字段、Owner/祖先索引、同级 DAG 和负向诊断 | `FR-003`–`FR-005`, `FR-024`, `FR-025`; `AC-002`, `AC-007`, `AC-015` |
| `P-001-T-002` | completed | 隔离入口、有限单 DAG、详情抽屉、直接子任务列表、专用下降、搜索/筛选/恢复、键盘和非颜色呈现 | `FR-001`, `FR-002`, `FR-006`–`FR-023`, `FR-026`; `AC-001`, `AC-003`–`AC-013`, `AC-016`, `AC-017` |
| `P-001-T-003` | completed | macOS Chromium 三 profile 主体、性能、网络、安全、视觉证据和根门禁 | `FR-001`–`FR-027`; `AC-001`–`AC-018`, `AC-022` |
| `P-002-T-001` | completed | Windows 自动化与共享工程门禁；三个测试文件的最小跨平台基础设施 | `FR-028`; `AC-019`; `V-001` |
| `P-002-T-002` | completed | Windows Chrome 三 profile core、性能、网络、刷新、普通入口、视觉证据与最终门禁 | `FR-001`–`FR-028`; `AC-001`–`AC-019`, `AC-022`; `V-002`–`V-005` |

P-001 与 P-002 编号连续、计划/结果齐全并均为 `completed` / `passed`。`FR-001`–`FR-028` 与 core `AC-001`–`AC-019` 全部通过；`AC-022` 通过。`AC-020` 的大于 200 节点附加规模和 `AC-021` 的 Safari/Firefox 附加浏览器为 relaxed 策略下的 optional/not run，不形成 finding。

## 4. 测试与验证

- 交付与验证策略：`relaxed`
- 最终验证结论：`passed`
- 开放 finding：无；下一可用 initial finding ID 为 `FND-I-001`

| 检查 | 观察结果 | 结论 |
| --- | --- | --- |
| test-fixtures 目标 test/build/typecheck | P-001 12 项目标测试通过；P-002 Task graph 7/7 通过；最终根运行 test-fixtures 37/37 通过 | pass |
| Web test/build/typecheck | Web 5/5；Vite 81 modules；最终 JS 260.92 kB、CSS 10.98 kB；typecheck 退出码 0 | pass |
| Workspace CLI | macOS P-001 24/24 适用项；Windows P-002 16/16 适用项，10 项明确平台/环境跳过 | pass |
| macOS Chromium 主体 | deep/wide/dense、8 层往返、搜索/筛选、键盘/焦点、非颜色、网络和普通入口；结果 `pass` | pass |
| macOS 性能 | TTI 70.0 ms；选择/搜索/筛选/下降/返回 P95 59.9/61.4/63.9/65.2/13.8 ms | pass |
| Windows Chrome 主体 | deep/wide/dense、200 节点连续滚动、五类 AND、关系/孤立节点、刷新、键盘/焦点、网络和普通入口；结果 `pass` | pass |
| Windows 性能 | TTI 151.4 ms；选择/搜索/筛选/下降/返回 P95 88.5/100.7/106.7/93.5/11.1 ms | pass |
| 最终根 `pnpm check` | Node 24.18.0 / pnpm 11.9.0；Prettier、ESLint、10 个适用 workspace build/typecheck 和全部适用测试通过 | pass |
| 范围、安全与清理 | `git diff --check` 通过；无个人绝对路径或秘密；无真实数据/API/数据库/Workspace 写入；无活动 Vite、5173 监听、临时视口或验收标签页 | pass |

## 5. 与路线图及阶段计划的偏差

- 路线图按外部 Windows 交接使用两个 compact 阶段，最终阶段拥有完整集成门禁；阶段数量和顺序未偏离。
- P-001 计划升至 revision 2，只为修正最终根门禁暴露的 MCP 服务就绪测试竞态；没有 Workspace CLI 产品实现变化。
- P-001 浏览器观察到搜索快速清除旧值回写、宽/密集布局可读性和密集孤立节点问题；均在 P-001 自有范围修正并重跑受影响路径。
- P-002-T-001 只在计划授权的三个测试文件中关闭 `/private/tmp`、POSIX signal 和明确 macOS/APFS 假设。
- P-002 Chrome extension 两次不可用时状态保持 `blocked` 并安全清理；用户侧恢复后从原任务继续，没有重写 P-001 或重复已有效门禁。
- Windows 遮挡窗口把 rAF 节流到约 1 秒，导致性能诊断伪失败；Task UI 指标改为 React DOM 提交完成，独立重复样本和最终根门禁全部通过。
- `AC-020`/`AC-021` 按原 relaxed 计划明确不运行；`AC-022` 由 18 张跨平台截图、两份指标汇总和 Windows 双入口日志完成。

## 6. 遗留事项

| ID | 类别 | 严重程度 | 关联需求/验收 | 观察与证据 | 最终功能影响 | 处置 | 置信度 | 建议后续 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 无 | — | — | — | initial run 没有开放 report-only finding | 无 | — | 高 | — |

本记录创建后，原始 requirements、初始路线图、contract、initial execution state、P-001/P-002 计划与结果以及本记录均冻结。后续产品行为或需求变化必须通过新的 `$apply-feature-change` 运行、连续的 `change-<N>.md` 和更新后的有效需求快照表达。
