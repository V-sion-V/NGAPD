# 前置原型

本目录用于验证高风险交互与领域约束，不承载正式业务实现。原型允许使用内存数据和测试夹具，但不得弱化服务端权威、权限、版本或单写入者约束。

## 完成状态

截至 2026-07-26，三个前置原型均已完成并通过，工作流结论均为 `completed/passed`，没有开放 `FND-*`。

| 原型 | 主体验证 | 结论 | 工作流回顾 |
| --- | --- | --- | --- |
| `workspace-sync` | [Windows/NTFS 最终主体](workspace-sync/results/p004-windows-client.md)，并包含服务端与 macOS/APFS 前序结果 | `pass` | [回顾报告](../docs/requirements/workspace-sync-prototype/workflow-report.md) |
| `task-ui` | [Windows Chrome 最终主体](task-ui/results/2026-07-26-windows-x64-chromium.md)，并包含 macOS Chromium 前序结果 | `pass` | [回顾报告](../docs/requirements/task-ui-prototype/workflow-report.md) |
| `agent-context` | [Windows/Node 最终主体](agent-context/results/2026-07-26-windows-x64-node24.md)，并包含 macOS/Node 前序结果 | `pass` | [回顾报告](../docs/requirements/agent-context-prototype/workflow-report.md) |

原型结论和 schema-v3 initial history 已冻结。后续产品行为变化必须使用对应 feature 的连续 change run，不得改写 `change-0.md` 或已完成的阶段结果。项目下一阶段是[实施路线中的 M0：领域基线和工程骨架](../docs/07-roadmap-and-validation.md#m0领域基线和工程骨架)。

## 历史执行顺序

1. `workspace-sync`：先验证租约、版本冲突和跨平台路径，这是 Workspace 核心/平台适配器与服务端共同依赖的高风险边界。
2. `task-ui`：在确定任务夹具格式后验证平铺树状导航和单层 200 项体验。
3. `agent-context`：复用任务、工作区与权限夹具，验证上下文发现和预算裁剪。

每个原型均包含：

- `README.md`：假设、范围、场景、退出标准和不做事项。
- `fixtures/`：可重复执行的输入数据。
- `results/README.md`：按统一格式记录环境、步骤、观察结果、证据和结论。

原型结论只能是 `pass`、`fail` 或 `inconclusive`。若后续结果改变现有技术决策，应新增或修订 ADR，不能只在原型代码中静默改变方案。
