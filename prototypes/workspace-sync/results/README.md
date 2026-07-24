# 工作区同步原型结果

每次执行新增一个 `YYYY-MM-DD-<platform>-<short-name>.md`，内容至少包含：

- 结论：`pass`、`fail` 或 `inconclusive`
- Git commit、操作系统、文件系统、Node/Workspace 平台适配器/PostgreSQL 版本
- 场景编号、前置状态和可重复步骤
- 租约 ID、持有者、过期时间、基线与结果 `sync_version`
- 本地/服务端 manifest 哈希、HTTP 状态和稳定错误码
- 日志、截图或测试报告的仓库相对路径
- 是否满足退出标准，以及需要新增/修订的 ADR

禁止提交访问令牌、密码、个人绝对路径或真实项目内容。
