# P-002：Task UI Windows core 与最终封存结果

- 运行编号：`initial`
- 阶段编号：`P-002`
- 阶段计划：[`phase-002-plan.md`](phase-002-plan.md)，revision `1`
- 父路线图修订：`1`
- 完成日期：`2026-07-26`
- 状态：`completed`
- 交付与验证策略：`relaxed`
- 验证结论：`passed`
- 项目基线：分支 `prototype`，提交 `a3044bf4ef207df597b0c37ce3b4ef8f3dba52fd`

## 1. 阶段目标与结果

P-002 已在真实 Windows x64、NTFS、Node `24.18.0` 和 Google Chrome `150.0.7871.186` 环境中闭合 `FR-028`/`AC-019`。Windows Chrome 主体结果为 [`pass`](../../../../../prototypes/task-ui/results/2026-07-26-windows-x64-chromium.md)：`deep-tree`、`wide-siblings` 和 `dense-dag` 的有限单 DAG、抽屉/选择一致性、专用下降、逐层/面包屑返回、搜索恢复、五类 AND 筛选、空状态、刷新、键盘、焦点、非颜色表达、关系方向、孤立节点和普通 Workspace access 兼容全部通过。

Windows 暖缓存首次可交互为 151.4 ms；节点选择、搜索、筛选、下降和返回 P95 分别为 88.5、100.7、106.7、93.5 和 11.1 ms，均低于 200 ms。Task UI 入口没有 `/api` 或外部请求；只有切换到普通根入口后才出现预期的 `/api/v1/auth/session` 代理尝试。

P-002 同时修正了 Workspace CLI 测试中的 Windows 临时目录、signal 观察和明确 macOS/APFS 守卫，没有修改 Workspace CLI 产品代码或行为。浏览器性能复测发现原型指标依赖下一动画帧，在 Windows Chrome 窗口被系统判定为遮挡时会产生约 1 秒的虚假延迟；指标已在 Task UI 自有范围改为 React DOM 提交完成时收尾，随后重新执行受影响 Web 自动化、真实浏览器性能和主体路径。

最终根 `pnpm check` 在 Node `24.18.0` / pnpm `11.9.0` 下完整通过。临时服务、5173 端口、Chrome 视口覆盖和验收标签页均已清理；没有数据库、API、Workspace、身份或其他外部写入。本阶段完成后，初始路线图的两个连续阶段均具备不可变结果，可进入 `change-0.md` 与有效需求快照的最终复核。

## 2. 任务、需求与验收覆盖

| 任务 | 状态 | 实际结果 | 需求与验收 | 完成证据 |
| --- | --- | --- | --- | --- |
| `P-002-T-001` | completed | 使用平台安全临时目录；保留 POSIX signal 退出码并验证 Windows signal 观察；依赖 macOS/APFS 目录 `fsync`/文件名语义的集成在非 macOS 明确跳过；未修改 CLI 产品代码 | `FR-028`; `AC-019` 的 Windows 工程前置；`V-001` | task graph 7/7、Web 5/5、Web build/typecheck、Workspace CLI 16/16 适用项通过；10 项既有性能/Keychain 或明确 macOS/APFS 集成按平台跳过 |
| `P-002-T-002` | completed | 完成 Windows Chrome 三 profile core、有限滚动、性能、网络、安全、刷新、普通入口、视觉证据和最终根门禁；修正遮挡窗口动画帧节流导致的诊断指标伪失败 | `FR-001`–`FR-028`; `AC-001`–`AC-019`, `AC-022`; `V-002`–`V-005` | Windows 主体 `pass`；11 张截图、性能原始样本和 Vite 日志；最终 `pnpm check` 退出码 0 |

覆盖结论：`FR-001`–`FR-028` 与 core `AC-001`–`AC-019` 均有自动化或真实浏览器证据并通过。`AC-020`、`AC-021` 是 relaxed 策略下明确的 optional/not run，不形成 finding；`AC-022` 通过。没有开放 `FND-I-*`。

## 3. 文件修改

| 文件 | 修改模式 | 结果 |
| --- | --- | --- |
| `apps/workspace-cli/src/adapters/filesystem.integration.test.ts` | modify | 使用系统临时目录并把 Node/APFS 集成明确限制到 macOS |
| `apps/workspace-cli/src/workspace-runtime.test.ts` | modify | 使用系统临时目录并把依赖 macOS/APFS 的真实适配器集成明确限制到 macOS |
| `apps/workspace-cli/src/mcp.integration.test.ts` | modify | signal 测试同时验证 POSIX 退出码与 Windows signal 观察；保留 P-001 的 MCP 就绪同步 |
| `apps/web/src/task-ui/TaskUiApp.tsx` | modify | 把交互性能诊断从下一动画帧改为 React DOM 提交完成，避免遮挡窗口的 rAF 节流伪失败 |
| `prototypes/task-ui/results/2026-07-26-windows-x64-chromium.md` | add | Windows Chrome 主体 `pass` 结果 |
| `prototypes/task-ui/results/2026-07-26-windows-x64-chromium/metrics-summary.json` | add | Windows 暖缓存首次可交互与重复交互原始样本/P95 汇总 |
| `prototypes/task-ui/results/2026-07-26-windows-x64-chromium/*.png` | add | deep/wide/dense 与普通入口共 11 张相对视觉证据 |
| `prototypes/task-ui/results/2026-07-26-windows-x64-chromium/vite.stdout.log` | add | 本地 Vite 启动信息 |
| `prototypes/task-ui/results/2026-07-26-windows-x64-chromium/vite.stderr.log` | add | 仅普通根入口触发的预期身份 session 代理失败 |
| `docs/requirements/task-ui-prototype/execution/initial/phase-002-plan.md` | add | P-002 compact 即时计划 revision 1 |
| `docs/requirements/task-ui-prototype/execution/initial/execution-state.md` | update | P-002 执行、阻塞恢复、验证与最终化权威 |
| `docs/requirements/task-ui-prototype/execution/initial/phase-002-result.md` | add | 本不可变阶段结果 |

生产 Task contract、Task API、数据库、Workspace CLI 产品代码、同步协议、凭据和其他 Workspace 包均未修改。P-001 计划、结果和 macOS 主体证据保持不可变。

## 4. 测试与验证

| 检查 | 观察结果 | 结论 |
| --- | --- | --- |
| `pnpm --filter @ngapd/test-fixtures test -- src/task-graph.test.ts` | 7 项 Task graph 目标测试通过 | pass |
| `pnpm --filter @ngapd/web test` | 1 个文件、5 项测试通过 | pass |
| `pnpm --filter @ngapd/web build` | Vite 81 modules；最终 JS 260.92 kB、CSS 10.98 kB；退出码 0 | pass |
| `pnpm --filter @ngapd/web typecheck` | TypeScript noEmit 退出码 0 | pass |
| `pnpm --filter @ngapd/workspace-cli test` | 3 个文件通过、4 个按平台跳过；16 项通过、10 项跳过 | pass |
| Windows Chrome `deep-tree` | 6 节点/2 边项目根；完整抽屉/5 行直接子任务；6 层下降、面包屑/逐层返回、搜索恢复、刷新、键盘/焦点/非颜色状态通过 | pass |
| Windows Chrome `wide-siblings` | 200 节点、300 边、2708×2518 有限画布；连续横纵滚动始终保持节点/边；隐藏选择清理、五类 AND 空结果和清除恢复通过 | pass |
| Windows Chrome `dense-dag` | 36 节点、48 边；`ZERO-G-0007` 为 1 前置/2 后续/3 关系边；`ZERO-G-0036` 为 0 前置/0 后续孤立节点 | pass |
| Windows 暖缓存性能 | TTI 151.4 ms；选择/搜索/筛选/下降/返回 P95 为 88.5/100.7/106.7/93.5/11.1 ms | pass |
| 双入口与网络观察 | Task UI 阶段无 `/api`/外部请求；普通根入口保持原注册/登录 UI，并仅在该入口出现 `/api/v1/auth/session` 代理尝试 | pass |
| 最终 `pnpm check` | Prettier、ESLint、10 个适用 workspace build/typecheck 和全部适用测试通过；退出码 0 | pass |
| 范围、秘密与外部副作用审查 | `git diff --check` 通过；证据无个人绝对路径或秘密；测试令牌为既有合成值；无活动服务、5173 监听、数据库/API/Workspace 写入 | pass |

最终主体环境：Windows 11 x64 build `26200.8875`、NTFS、Ryzen 9 3900X / 24 逻辑处理器 / 32 GB、Chrome `150.0.7871.186`、内容视口 1284×720、默认 100% 缩放。

## 5. 发现项与处置

| ID | 类别 | 严重程度 | 关联需求/验收 | 观察与证据 | 最终功能影响 | 处置 | 置信度 | 建议后续 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 无 | — | — | — | P-002 没有开放 report-only finding | 无 | — | 高 | — |

`AC-020` 与 `AC-021` 的 optional/not run 不是异常或 finding；`AC-022` 已完成。Chrome 控制扩展自身的 `chrome-extension://` 内容脚本动态导入错误不来自应用或本地服务，且有独立 DOM、截图、指标和服务日志证明 core 未受影响，因此不登记为产品 finding。下一可用 finding ID 仍为 `FND-I-001`。

## 6. 决策、计划偏差与恢复记录

- P-002-T-001 首次 Windows 基线暴露 `/private/tmp` 与 POSIX signal 测试假设。阶段只修改三个授权测试文件：系统临时目录、Windows signal 观察和明确 macOS/APFS 守卫；未改变 Workspace CLI 产品行为。
- Chrome extension 在前两次执行中不可选择，阶段按契约记录为 `blocked` 并安全停止 Vite/Chrome，不创建半成品 Windows 结果。用户侧重新安装后 extension 可选择，阶段恢复为 `in_progress` 并从 `P-002-T-002` 继续，没有重复 P-002-T-001。
- 初次 Windows 性能序列在 Chrome 窗口被系统判定为遮挡后出现约 1 秒 rAF 节流。独立复测证明 DOM 更新本身低于门槛；在 Task UI 自有范围把指标收尾移到 `useLayoutEffect`，重新执行 Web test/build/typecheck 和完整性能序列后全部通过。
- Task UI 期间 Vite 标准错误为空；切到普通入口后才记录预期的 `/api/v1/auth/session` 代理失败。没有启动 API/数据库或提交账号表单。
- 临时 Vite PID `29236` 已停止，5173 无监听；Chrome 临时视口覆盖已复原，验收标签页已关闭。恢复不依赖数据库、外部账号或用户数据。

## 7. 最终化进入条件

P-002 没有未决产品问题、开放 finding、活动服务、半完成实现、未知外部状态或用户工作重叠。P-001 与 P-002 现在都有连续、完成、可读的 phase result；全部 core 与 hard gate 通过。

执行状态应进入 `finalizing`，随后由本次 `$implement-planned-feature` 调用重新读取完整 requirements、roadmap、state、两个阶段的计划/结果和最终 diff，验证 `FR-001`–`FR-028`、`AC-001`–`AC-022`、跨阶段不变量、完整 inventory 与 findings 一致后，生成 `effective-requirements.md`、`change-0.md` 并把 initial run 冻结为 `completed`。
