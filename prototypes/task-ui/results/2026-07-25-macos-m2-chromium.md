# Task UI 原型：macOS Chromium 主体结果

- 结论：`pass`
- 执行日期：2026-07-25
- Git 基线：`bcae1aa1c66081c67ecbb9f6391b9613927f775a`（分支 `prototype`）
- 被测实现：上述基线上的 P-001 未提交工作副本；完整文件清单由 `docs/requirements/task-ui-prototype/execution/initial/execution-state.md` 记录
- 操作系统：macOS 26.5.2（25F84），arm64
- 硬件摘要：MacBook Air，Apple M2，8 核，16 GB
- 浏览器：Codex In-app Browser 的真实 Chromium 页面运行环境；浏览器控制接口未公开精确 engine build
- 视口与缩放：1280×720，浏览器默认 100% 缩放
- Node / pnpm：v24.18.0 / 11.9.0
- 数据规范：schema 1，seed `20260724`，Project Key `ZERO`

## 主体路径与观察结果

### `deep-tree`

- 项目根显示 6 个任务、2 条同级依赖，包含可见孤立节点。
- 通过详情抽屉的唯一“进入子任务视图”按钮依次进入 `ZERO-D-0001`、`ZERO-D-0007`、`ZERO-D-0012`、`ZERO-D-0016`、`ZERO-D-0019`、`ZERO-D-0021`，最终作用域稳定显示 `ZERO-D-0023` 和 `ZERO-D-0024`。
- 每次进入后选择清空、抽屉收起、不自动选择节点；叶任务的进入按钮禁用并说明“没有子任务可进入”。
- 从最深层通过面包屑直接恢复 `ZERO-D-0007`，再用“返回上一级”恢复 `ZERO-D-0001` 和项目根；抽屉保持收起。
- 项目搜索 `ZERO-D-0023` 恢复正确祖先链并打开目标详情，“返回搜索前位置”恢复项目根、原选择和抽屉。
- `Escape` 收起抽屉后焦点返回来源节点；方向键把焦点从 `ZERO-D-0001` 移到右侧节点，`Enter` 打开详情。

### `wide-siblings`

- `ZERO-W-0001` 作用域完整显示 200 个节点和 300 条同父级无环依赖；稳定分层布局为 2708×2518 px 的有限双向滚动内容，不使用无限画布或语义缩放。
- 连续横向滚动经过中后部列，纵向滚动最终到达孤立节点 `ZERO-W-0205`；每次观察均有节点与边，未出现空白视口、错误选择或节点/边错位。
- 按状态筛选时只保留两端可见的边并显示隐藏关联数量；筛选隐藏选中节点后选择和抽屉立即清除，清除筛选恢复 200/200 节点。
- 不存在的项目搜索显示明确无结果和“清除搜索”；“已逾期”筛选产生明确空状态和独立恢复按钮。
- 选择、搜索、筛选、层级进入和返回均完成重复采样，P95 全部低于 200 ms。

### `dense-dag`

- 项目根完整显示 36 个节点、48 条同级无环依赖和孤立节点 `ZERO-G-0036`；稳定分层布局为 1620×866 px。
- 边箭头与摘要文字明确表达 predecessor → successor。选择 `ZERO-G-0007` 后，界面显示“直接前置 1 · 直接后续 2”，3 条直接关系边高亮，其他 45 条边降噪；直接前置/后续节点使用不同轮廓而非只依赖颜色。
- 纵向滚动后 `ZERO-G-0036` 可见且可达；没有跨父级边、自环或环。

## 性能

测量从交互触发的状态更新请求开始，到下一动画帧提交为止，使用浏览器 `performance.now()`；`wide-siblings` 暖缓存环境下采样。原始汇总见 [`metrics-summary.json`](2026-07-25-macos-m2-chromium/metrics-summary.json)。

| 路径 | 样本 | P95 | 最大值 | 门槛 | 结论 |
| --- | ---: | ---: | ---: | ---: | --- |
| 暖缓存首次可交互 | 1 | 70.0 ms | 70.0 ms | < 3000 ms | pass |
| 节点选择 | 20 | 59.9 ms | 63.2 ms | ≤ 200 ms | pass |
| 项目搜索输入/清除 | 40 | 61.4 ms | 67.5 ms | ≤ 200 ms | pass |
| 当前层筛选/清除 | 40 | 63.9 ms | 82.1 ms | ≤ 200 ms | pass |
| 进入子任务视图 | 20 | 65.2 ms | 66.4 ms | ≤ 200 ms | pass |
| 返回上一级 | 20 | 13.8 ms | 14.2 ms | ≤ 200 ms | pass |

## 可访问性、非颜色状态与网络边界

- DAG 节点、搜索、筛选、面包屑、返回、抽屉关闭和进入按钮均为原生可聚焦控件；节点采用单一 Tab 入口和方向键移动，焦点轮廓可见。
- 普通、冲刺、里程碑分别使用方框、闪电、菱形文字/图标和不同边框；状态以文字显示；依赖方向同时使用箭头和 predecessor → successor 文字。
- Task UI 顶层入口不挂载账号/设备 Query。Task 主体期间 Vite 未观察到 `/api` 代理请求且浏览器控制台无 error/warning；切换正常入口后才出现预期 `/api/v1/auth/session` 代理尝试，原注册/登录 UI 保持。
- 夹具与页面只包含固定 seed 的合成内容；未读取 Cookie、真实项目正文或外部资源，没有 Task、Workspace 或身份写入。

## 自动化与负向数据

- `@ngapd/test-fixtures` 的 12 项测试覆盖规范对齐、三个 profile、稳定生成、Owner 继承、UTC 时间、子任务统计、同父级依赖、孤立节点，以及重复 ID/Key、孤儿、跨项目/跨父级、缺失端点、自环、重复边、环和无效 UTC 的稳定拒绝。
- Web 的 5 项纯测试覆盖抽屉/选择、层级快照、搜索定位与恢复、AND 筛选隐藏选择、稳定布局、方向正确性和键盘邻接。
- 最终根 `pnpm check` 的观察结果在 P-001 phase result 中记录。

## 视觉证据

- [`deep-tree` 项目根](2026-07-25-macos-m2-chromium/deep-tree-root.png)
- [`deep-tree` 最深作用域](2026-07-25-macos-m2-chromium/deep-tree-deepest.png)
- [`wide-siblings` 200 节点](2026-07-25-macos-m2-chromium/wide-siblings-200.png)
- [`wide-siblings` 滚动末端](2026-07-25-macos-m2-chromium/wide-siblings-scroll-end.png)
- [`dense-dag` 全局方向](2026-07-25-macos-m2-chromium/dense-dag.png)
- [`dense-dag` 选中前置/后续关系](2026-07-25-macos-m2-chromium/dense-dag-selected.png)
- [`dense-dag` 孤立节点](2026-07-25-macos-m2-chromium/dense-dag-isolated.png)

## 发现与结论

- 主体中发现并修正搜索输入快速清除旧值回写，以及宽/密集 DAG 单行边重叠和缺少密集孤立节点两个 core 问题；修正后重新执行受影响自动化、构建、三个 profile 主体和性能采样。
- `AC-020` 的大于 200 节点附加规模未执行；这是 relaxed 策略下明确可选的 supplemental 检查，不形成交付 finding。
- `AC-021` 的 Safari/Firefox 附加浏览器检查未执行；这是可选广泛回归，不形成交付 finding。
- `AC-022` 已由 7 张截图和性能汇总提供附加诊断；未采集额外 trace。
- 未观察到需要调整 ADR-008、H-005 或 Task UI 产品基线的问题。macOS Task UI 主体 core 全部通过，结论为 `pass`；Windows 11 x64 core 仍按需求留在 P-002，P-001 后工作流安全等待。
