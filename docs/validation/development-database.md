# 持久开发数据库与自动回退

文档状态：活动开发环境 1.0

适用范围：日常 API/Worker/Web 开发、Repository/API PostgreSQL 集成测试和根 CI 复现

## 1. 当前服务

日常开发 PostgreSQL 17 以独立 Compose project `ngapd-development-database` 持续运行在 `192.168.100.1`：

- LAN 入口：`192.168.100.1:55432`，不绑定 WAN 或全部宿主地址；
- 镜像：`postgres:17.10-alpine`；
- 重启策略：`unless-stopped`；
- 应用库：`ngapd`，保留人工 Web/API 开发数据；
- 测试库：`ngapd_test`，仅供自动化测试使用，允许测试重建 schema；
- 持久卷：`ngapd-development-database_postgres-data`；
- 服务器目录：`/mnt/data/ngapd-development-database`。

部署清单位于 [`deploy/development-postgres/`](../../deploy/development-postgres/)。数据库强口令只存在于服务器权限受限的 secret 文件和开发机被 Git 忽略的 `.env`，不得写入日志、文档、提交或命令行。

该服务是共享开发基础设施，不属于参考发布栈。服务器上的正式/既有服务、参考发布资源和开发数据库必须使用不同的 Compose project、端口、目录、数据库和卷。

## 2. 自动选择规则

仓库根目录的标准命令通过 `scripts/dev/with-database.mjs` 自动读取被忽略的 `.env`，验证目标确实为 PostgreSQL 17，并按下列顺序选择：

1. 当前进程显式提供的 `DATABASE_URL` 或 `DATABASE_TEST_URL`；
2. `.env` 中的 `DATABASE_LOCAL_URL` 或 `DATABASE_TEST_LOCAL_URL`；
3. 兼容旧配置的 `.env` `DATABASE_URL` 或 `DATABASE_TEST_URL`；
4. `.env` 中的 `DATABASE_FALLBACK_URL` 或 `DATABASE_TEST_FALLBACK_URL`。

连接日志只显示主机、端口、数据库和 PostgreSQL 版本，不显示用户名、密码或查询参数。所有候选均不可达、认证失败或版本不是 17 时命令 fail closed，不静默跳过数据库验证。

以下入口自动应用该规则：

```sh
pnpm env:check
pnpm db:migrate
pnpm dev
pnpm dev:api
pnpm test
pnpm check
pnpm run ci
```

`pnpm dev:workspace` 自动加载 `.env` 中的 Workspace 路径，但不要求数据库。直接调用内部 `*:resolved` 脚本会绕过解析器，只允许标准脚本内部使用。

应用库和测试库不得指向同一个目标。自动化测试可能清空并重建 `ngapd_test` 的 schema，禁止把 `DATABASE_TEST_*` 指向 `ngapd`、生产库或包含人工数据的数据库。

## 3. 日常流程

新终端先确认工具链和数据库：

```sh
node --version
pnpm --version
pnpm env:check
```

预期 Node 为 `v24.18.0`、pnpm 为 `11.9.0`，数据库检查应报告本地目标或服务器 fallback。随后可直接执行：

```sh
pnpm db:migrate
pnpm dev
```

`pnpm dev` 是常驻进程，应由开发者自己的终端运行并用 `Ctrl+C` 停止；Agent 不应把它作为等待完成的命令运行。

首次克隆或依赖变化后仍需由开发者运行一次：

```sh
pnpm install --frozen-lockfile
```

安装可能花费较长时间，不应作为阻塞 Agent 对话的后台命令。当前 `.env` 不提交；新工作区必须从 `.env.example` 创建，并通过安全渠道取得 fallback 凭据。

## 4. 维护与隔离例外

只读检查服务状态：

```sh
ssh 192.168.100.1 "cd /mnt/data/ngapd-development-database && docker compose ps"
ssh 192.168.100.1 "cd /mnt/data/ngapd-development-database && docker compose logs --tail=100 postgres"
```

日常开发和常规集成测试在持久 `ngapd`/`ngapd_test` 上运行，不再为每次任务创建 PostgreSQL 容器或临时数据库。以下验证仍必须使用唯一隔离资源，不得复用持久开发库：

- 六服务 Compose 发布冒烟与参考发布；
- 会写入合成账号和业务数据的 P95；
- 数据库恢复、备份恢复、破坏性迁移演练；
- 需要并行、独占或可证明空库边界的测试。

服务器不可达时，优先修复或使用 `.env` 已配置的本地 PostgreSQL 17；不得为了绕过连接失败而把测试 URL 指向应用库。停止、升级、删除卷或修改口令属于基础设施变更，执行前必须确认目标并备份需要保留的数据。
