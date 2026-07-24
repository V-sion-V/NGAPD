# Agent 上下文原型结果

每次执行新增一个 `YYYY-MM-DD-<short-name>.md`，至少记录：

- 结论：`pass`、`fail` 或 `inconclusive`
- Git commit、夹具版本和预算
- 输出清单的稳定排序、来源、权限依据与截断原因
- 被排除的其他用户、无关兄弟任务和递归关注链
- 注入文本前后的工具授权对比
- 摘要来源：`agent_provided`、`user_provided` 或 `system_fallback`
- 测试报告或人工检查证据的仓库相对路径
- 是否需要调整 ADR-010、ADR-012 或 Agent 契约
