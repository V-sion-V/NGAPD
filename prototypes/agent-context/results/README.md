# Agent 上下文原型结果

每次执行新增一个 `YYYY-MM-DD-<short-name>.md`，至少记录：

- 结论：`pass`、`fail` 或 `inconclusive`
- 主体范围、日期、操作系统/架构、Node/pnpm 版本与执行起点 Git commit
- 夹具 schema/version/scenario、预算、页大小、任务/依赖/来源规模和重复次数
- 输出清单的稳定排序、来源、权限依据与截断原因
- 被排除的其他用户、无关兄弟任务和递归关注链
- 正常预算、预算不足、分页组合、游标/来源版本失效和重新授权结果
- 注入文本前后的工具授权对比
- 摘要来源：`agent_provided`、`user_provided` 或 `system_fallback`
- manifest-only P95、每种主体规模的观察值与 `< 1s` 门禁
- 目标测试、共享包 build/typecheck/test、根门禁和无头 runner 的命令与观察结果
- 测试报告、规范化输出或工作流证据的仓库相对路径
- 是否需要调整 ADR-010、ADR-012 或 Agent 契约

结果记录只引用规范化证据，不嵌入合成正文、个人路径、凭据、令牌或真实业务数据。真实 core 失败写 `fail`；证据不足写 `inconclusive`；只有该记录声明的全部 core 与硬门禁通过时才能写 `pass`。
