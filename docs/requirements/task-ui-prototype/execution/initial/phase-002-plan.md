# P-002：Task UI Windows core 与最终封存计划

- 运行编号：`initial`
- 阶段编号：`P-002`
- 计划修订：`1`
- 父路线图修订：`1`
- 需求指纹：`sha256:222a3f69cef2d36970c621336398792cfa3056bf342597c9822230d6582a99a0`
- 项目基线：分支 `prototype`，提交 `a3044bf4ef207df597b0c37ce3b4ef8f3dba52fd`
- 创建日期：`2026-07-26`
- 计划详细度：`compact`
- 交付与验证策略：`relaxed`
- 验证结论：`pending`

## 1. 阶段目标、边界与关联需求

本阶段在已满足外部前置的真实 Windows 11 x64、NTFS 和 Chromium 环境中完成 `FR-028`/`AC-019`，并最终复核 P-001 已交付的 `FR-001`–`FR-027`、`AC-001`–`AC-018` 以及全部硬门禁。P-001 计划、结果和 macOS 主体证据保持不可变；Agent Context 主体已有可追溯 `pass` 结果，当前 Windows 入口为 x64、Node `24.18.0` 和真实 Chrome。

范围包括 Windows 暴露的 Task UI 兼容修正、三个 profile 的真实浏览器 core 矩阵、性能可用性、网络与正常 Web 兼容、结果证据和最终工程门禁。若根门禁仍被已确认的 macOS 临时路径或 POSIX signal 测试假设阻塞，只允许在 `apps/workspace-cli` 的对应测试文件中做最小跨平台测试基础设施修正；不得修改 Workspace CLI 产品代码、协议、凭据、同步行为或 P-004 产品范围。任何超出该测试专用边界的需要都必须暂停。

本阶段不新增 Task API、数据库、正式路由、持久化、第二幅 DAG、无限画布或其他浏览器主体。`AC-020`、`AC-021` 保持 supplemental；`AC-022` 只保留低成本诊断证据。`relaxed` 策略不降低 Windows core、构建、兼容、安全、恢复或用户工作保护门禁；合规 report-only finding 从 `FND-I-001` 连续编号。

## 2. 任务与文件范围

| 任务 | 结果 | 文件或范围 | 实现摘要 | 验证 | 完成条件 |
| --- | --- | --- | --- | --- | --- |
| `P-002-T-001` | 关闭 Windows 自动化与共享工程门禁的执行前差异 | `apps/web/src/task-ui/**`、`apps/web/src/App.tsx`、`packages/test-fixtures/src/task-graph*` 仅在真实缺陷时；`apps/workspace-cli/src/adapters/filesystem.integration.test.ts`、`apps/workspace-cli/src/workspace-runtime.test.ts`、`apps/workspace-cli/src/mcp.integration.test.ts` 仅限跨平台测试基础设施 | 先复核 P-001 后漂移和当前 Windows 基线；保留 Task UI 行为不变量。对确认的共享门禁异常只使用平台安全临时目录、正确的 Windows 子进程退出观察或等价测试守卫，保持 macOS 断言且不改变 CLI 产品行为 | `V-001` | Task UI 目标自动化仍通过；共享测试基础设施在 Windows 可执行；没有生产 API、数据库、Workspace CLI 或 Task 契约变更 |
| `P-002-T-002` | 完成真实 Windows Chromium core、证据和最终可封存状态 | `apps/web/src/task-ui/**` 与相关测试只在浏览器暴露真实 core 缺陷时；`prototypes/task-ui/results/2026-07-26-windows-x64-chromium.md` 及其相对证据目录；Task UI README 只在入口说明确需同步时 | 在至少 1280×720、100% 缩放的真实 Chrome 中执行 deep/wide/dense 全部 core 路径，记录版本、硬件、操作、网络、性能、键盘、焦点、非颜色状态和视觉证据；core 失败只做最小 Task UI 范围修正并重新验证受影响路径 | `V-002`–`V-005` | Windows 主体记录结论为 `pass`；全部 core 与硬门禁通过；supplemental 已通过、明确未运行或形成合规 finding；服务、浏览器覆盖和临时证据均已安全收尾 |

依赖：`P-002-T-002` 依赖 `P-002-T-001` 完成。

## 3. 验证与完成条件

| 验证 | 层级 | 执行与可观察结果 |
| --- | --- | --- |
| `V-001` | core / hard gate | 使用仓库 Node `24.18.0`/pnpm `11.9.0` 执行 `pnpm --filter @ngapd/test-fixtures test -- src/task-graph.test.ts`、`pnpm --filter @ngapd/web test`、`pnpm --filter @ngapd/web build`、`pnpm --filter @ngapd/web typecheck`；若三个共享测试文件有修改，再执行 `pnpm --filter @ngapd/workspace-cli test`。所有适用检查退出码为 0，且测试修正不改变 CLI 产品行为。 |
| `V-002` | core | 在真实 Windows 11 x64 Chrome 中验证无登录/数据库入口、单 DAG、全部节点/孤立节点与方向、抽屉与字段、直接子任务列表、专用下降、8 层往返、搜索恢复、五类 AND 筛选、空/错误状态、三种展示类型、刷新、键盘、焦点和非颜色表达；正常 Workspace access 入口保持。 |
| `V-003` | core | 对 `wide-siblings` 记录 200 节点连续横纵滚动、暖缓存首次可交互以及选择/搜索/筛选/下降/返回重复样本；沿用既有 `<3 s`、P95 `≤200 ms` 和输入响应/无错位门槛。`dense-dag` 保留全部 36 节点、48 边、孤立节点和可解释方向。 |
| `V-004` | core / hard gate | 在所有实现与证据变化之后一次执行根 `pnpm check`；复核 Task UI 无 `/api` 或外部请求、无真实内容/秘密/数据库/API/Workspace 写入，正常账号/配对入口不回归，并通过 `git diff --check` 与范围审查。 |
| `V-005` | supplemental / closeout | 新增而不覆盖历史 Windows 结果和相对截图/指标；`AC-020`/`AC-021` 只在低成本且不干扰 core 时执行，`AC-022` 记录实际取得的诊断。异常只有在独立证据证明不影响 core 和硬门禁后才可登记连续 `FND-I-*`。 |

阶段只有在 P-001 不可变证据仍一致、`FR-001`–`FR-028`/`AC-001`–`AC-019` 最终追踪闭合、Windows 结果为 `pass`、根工程门禁通过、无未决问题或未知用户工作重叠时才能创建不可变 `phase-002-result.md`。这是路线图最终阶段；阶段结果完成后由执行技能复核全部初始证据，再生成 `change-0.md`、`effective-requirements.md` 并把运行置为 `completed`。

## 4. 风险、恢复与修订记录

- 当前 Windows 基线中 Task graph 7/7、Web 5/5、build 与 typecheck 已通过；Workspace CLI 包测试稳定暴露 `/private/tmp` 和 POSIX signal 退出码假设。它们是 P-002 根门禁的已知执行工作，不是产品 finding；若最小测试专用修正不足，立即暂停，不借 Task UI 阶段改变 Workspace Sync 产品行为。
- P-001 后只有 Agent Context 新模块和共享根导出，未发现 Task UI/Web/task-graph 重叠漂移。执行前若出现新的相关 diff 或多义所有权，保留用户工作并暂停。
- 浏览器发现的 core 缺陷阻塞 `pass`；修正只落在 Task UI 自有 Web/fixture 范围，并在最新点重新运行受影响自动化、浏览器路径和根门禁。
- 本阶段无 migration、数据库写入、多 writer 或不可逆操作。中断时停止 Vite、关闭验收标签页、恢复临时视口覆盖，保留已产生的相对证据和当前 diff，在 state 中记录精确恢复点；不得重写 P-001 计划、结果或 macOS 主体记录。
- 真实结果不得包含个人绝对路径、浏览器会话材料、真实项目内容或秘密。Windows 环境或证据不足时结论保持 `inconclusive`/阶段未完成，不得降级 `AC-019`。

| 修订 | 日期 | 变更 | 原因与影响 |
| --- | --- | --- | --- |
| 1 | 2026-07-26 | 首次即时创建 P-002 compact 计划 | P-001、Agent Context 主体与真实 Windows 前置均满足；当前 Task UI 无重叠漂移，Windows 自动化基线界定了可逆的共享测试门禁范围 |
