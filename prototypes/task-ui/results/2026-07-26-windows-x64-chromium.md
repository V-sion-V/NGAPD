# Task UI 原型：Windows Chrome 主体结果

- 结论：`pass`
- 执行日期：2026-07-26
- Git 基线：`a3044bf4ef207df597b0c37ce3b4ef8f3dba52fd`（分支 `prototype`）
- 被测实现：上述基线上的 P-002 未提交工作副本；完整文件清单由 `docs/requirements/task-ui-prototype/execution/initial/execution-state.md` 记录
- 操作系统：Windows 11 x64，25H2，build `26200.8875`
- 文件系统：工作区位于 NTFS
- 硬件摘要：AMD Ryzen 9 3900X，12 核 / 24 逻辑处理器，32 GB 内存
- 浏览器：Google Chrome `150.0.7871.186`
- 内容视口与缩放：1284×720，浏览器默认 100% 缩放
- Node / pnpm：v24.18.0 / 11.9.0
- 数据规范：schema 1，seed `20260724`，Project Key `ZERO`

## 主体路径与观察结果

### `deep-tree`

- 项目根显示 6 个任务、2 条同级依赖和可见孤立节点；页面只挂载一幅有限 DAG，没有账号、数据库或真实数据前置。
- 选择 `ZERO-D-0001` 后右侧抽屉显示有效状态、显式/有效 Owner、继承来源、逻辑角色、UTC 派生截止时间、标签、直接子任务统计和 5 行直接子任务列表；改选 `ZERO-D-0003` 时原位替换抽屉，不改变画布尺寸。
- `Escape` 收起抽屉并把焦点恢复到来源节点；`Enter` 重新打开详情，`ArrowRight` 把焦点移动到相邻节点。普通、冲刺和里程碑同时使用文字、方框/闪电/菱形图标及不同边框，不只依赖颜色。
- 通过详情抽屉中的唯一“进入子任务视图”按钮依次进入 `ZERO-D-0001`、`ZERO-D-0007`、`ZERO-D-0012`、`ZERO-D-0016`、`ZERO-D-0019` 和 `ZERO-D-0021`；每次进入后选择和抽屉均清空，最终稳定显示 `ZERO-D-0023` 与 `ZERO-D-0024`。
- 从最深层点击面包屑恢复 `ZERO-D-0007`，再连续返回到 `ZERO-D-0001` 和项目根；没有残留选择或抽屉。
- 项目搜索 `ZERO-D-0023` 定位到正确祖先作用域并打开目标详情；“返回搜索前位置”恢复项目根、原 `ZERO-D-0003` 选择和抽屉。
- 在有选择和抽屉的状态刷新后，URL 指定的 `deep-tree` 项目根恢复为 6 节点、2 条边、无选择、无抽屉。

### `wide-siblings`

- 进入 `ZERO-W-0001` 后完整显示 200 个节点和 300 条同父级无环依赖；有限画布为 2708×2518 px，视口为 1230×532 px，不使用无限画布或语义缩放。
- 连续横纵滚动从 `(0, 0)` 到 `(1100, 1000)`，再到约 `(1477.6, 1985.6)`；三个位置均保持 200 个节点、300 条边、无错误抽屉或空白画布。
- 选择“进行中”的 `ZERO-W-0006` 后改用“已完成”状态筛选，节点降为 68、可见边降为 35，并明确显示 139 条依赖连接到隐藏节点；被隐藏的选择和抽屉立即清除。
- 同时应用 Owner“林岚”、角色“程序”、状态“已完成”、有截止时间和标签“程序”五类 AND 筛选后得到 0 个匹配节点，显示明确“当前筛选没有匹配任务”状态和恢复按钮；清除后恢复 200/200 节点与 300 条边。
- 项目搜索输入、选择、筛选、进入和返回完成独立重复采样，P95 全部低于 200 ms；连续滚动和输入没有节点/边错位。

### `dense-dag`

- 项目根完整显示 36 个节点、48 条 predecessor → successor 同级无环依赖和孤立节点 `ZERO-G-0036`。
- 选择 `ZERO-G-0007` 后，摘要显示“直接前置 1 · 直接后续 2”；1 个前置节点、2 个后续节点和 3 条直接关系边获得非颜色高亮，其余 45 条边降噪。
- 选择孤立节点 `ZERO-G-0036` 后，摘要显示“直接前置 0 · 直接后续 0”，没有关系节点或高亮边，全部 48 条边降噪；孤立节点可见、可聚焦、可选择。

## 性能

Windows 上真实 Chrome 窗口在被系统判定为遮挡时会把 `requestAnimationFrame` 节流到约 1 秒。主体因此把原型诊断指标从“下一动画帧”修正为“React DOM 提交完成”，避免把窗口遮挡节流误报为产品输入延迟；功能更新和视觉观察保持不变。修正后每个样本都等待当前 DOM 提交完成再执行下一次交互。

原始样本与汇总见 [`metrics-summary.json`](2026-07-26-windows-x64-chromium/metrics-summary.json)。

| 路径 | 样本 | P95 | 最大值 | 门槛 | 结论 |
| --- | ---: | ---: | ---: | ---: | --- |
| 暖缓存首次可交互 | 1 | 151.4 ms | 151.4 ms | < 3000 ms | pass |
| 节点选择 | 15 | 88.5 ms | 88.5 ms | ≤ 200 ms | pass |
| 项目搜索输入/清除 | 10 | 100.7 ms | 100.7 ms | ≤ 200 ms | pass |
| 当前层状态筛选/清除 | 10 | 106.7 ms | 106.7 ms | ≤ 200 ms | pass |
| 进入子任务视图 | 5 | 93.5 ms | 93.5 ms | ≤ 200 ms | pass |
| 返回上一级 | 4 | 11.1 ms | 11.1 ms | ≤ 200 ms | pass |

## 网络、安全与普通入口兼容

- Task UI 入口首次加载、三 profile 切换和主体操作期间，本地服务标准错误日志保持为空；页面没有 `/api`、外部资源、Cookie、真实项目内容、身份、数据库、Task 或 Workspace 写入。
- 导航到普通根入口后才出现预期的 `/api/v1/auth/session` 代理尝试，见 [`vite.stderr.log`](2026-07-26-windows-x64-chromium/vite.stderr.log)；原“Workspace access”注册/登录 UI 完整显示，页面不挂载 Task UI。
- Chrome 控制扩展自身曾记录 `chrome-extension://` 内容脚本动态导入错误；错误来源不是应用或本地服务，主体控制、DOM、截图和所有 core 路径均保持可用，因此不登记为 Task UI 产品 finding。
- 临时 Vite 服务在证据完成后停止，5173 端口无监听；临时内容视口覆盖已复原，验收标签页已关闭。

## 自动化与修正

- P-002-T-001 已在 Windows 使用 Node 24.18.0 验证 task graph 7/7、Web 5/5、Web build/typecheck 和 Workspace CLI 16/16 适用项；10 项既有性能/Keychain 或明确 macOS/APFS 集成按平台跳过。
- 浏览器复测暴露的唯一 Task UI 修正位于 `apps/web/src/task-ui/TaskUiApp.tsx`：交互诊断指标在 React DOM 提交完成时收尾，不再受遮挡窗口的动画帧节流影响。
- 修正后重新执行 Web 5/5 测试、build、typecheck，以及 `wide-siblings` 性能、`dense-dag` 关系/孤立节点、刷新和双入口兼容路径，全部通过。
- 最终根工程门禁、范围/秘密复核和工作流封存由 P-002 phase result 记录。

## 视觉证据

- [`deep-tree` 项目根](2026-07-26-windows-x64-chromium/deep-tree-root.png)
- [`deep-tree` 详情抽屉](2026-07-26-windows-x64-chromium/deep-tree-drawer.png)
- [`deep-tree` 最深作用域](2026-07-26-windows-x64-chromium/deep-tree-depth-8.png)
- [`wide-siblings` 200 节点](2026-07-26-windows-x64-chromium/wide-siblings-200.png)
- [`wide-siblings` 中段滚动](2026-07-26-windows-x64-chromium/wide-siblings-scrolled-mid.png)
- [`wide-siblings` 末段滚动](2026-07-26-windows-x64-chromium/wide-siblings-scrolled-end.png)
- [`wide-siblings` 五类 AND 空结果](2026-07-26-windows-x64-chromium/wide-siblings-filtered.png)
- [`dense-dag` 全局方向](2026-07-26-windows-x64-chromium/dense-dag.png)
- [`dense-dag` 直接关系](2026-07-26-windows-x64-chromium/dense-dag-relations.png)
- [`dense-dag` 孤立节点](2026-07-26-windows-x64-chromium/dense-dag-isolated.png)
- [普通 Workspace access 入口](2026-07-26-windows-x64-chromium/workspace-access-root.png)

## 补充验收与结论

- `AC-020` 的大于 200 节点附加规模未执行；这是 relaxed 策略下明确可选的 supplemental 检查，不形成 finding。
- `AC-021` 的 Safari/Firefox 附加浏览器检查未执行；这是可选广泛回归，不形成 finding。
- `AC-022` 由 11 张截图、性能原始样本和本地服务日志提供诊断证据。
- 没有开放 `FND-I-*`，也没有需要调整 ADR-008、H-005 或 Task UI 产品边界的问题。Windows Chrome core、性能、安全、刷新和普通入口兼容均通过，主体结论为 `pass`。
