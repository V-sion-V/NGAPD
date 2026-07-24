# 原型准备与开发入口

文档状态：可执行基线 1.0

## 1. 结论

三个前置原型已经具备统一的验证问题、确定性夹具、退出标准和结果记录格式；工程骨架已经覆盖服务端、后台作业、Web、Workspace CLI、共享 Workspace 核心、共享契约、领域包、数据库迁移和测试夹具。下一项工作可以直接开始“工作区租约与同步原型”，不需要再补一轮泛化架构设计。

## 2. 固定技术基线

| 范围 | 当前选择 |
|---|---|
| 仓库 | pnpm workspace + TypeScript 5.9 |
| 服务端 | Fastify 模块化单体，REST/JSON，TypeBox/OpenAPI |
| 数据库 | PostgreSQL 17 + Kysely migration |
| 后台作业 | Graphile Worker，共用 PostgreSQL |
| Web | React 19 + Vite + TanStack Query |
| 本地 Workspace 能力 | Node.js CLI + MCP stdio；UI 无关能力位于 `@ngapd/workspace-core`，未来同步与 GUI 通过平台适配器扩展 |
| 部署 | 单台 Linux 服务器，Docker Compose + Caddy |
| 外部服务 | 当前阶段不调用任何外部 API、AI 或 LLM |

版本以根目录 `package.json`、`.node-version` 和 `pnpm-lock.yaml` 为准。升级主版本或替换核心组件时应记录 ADR。

## 3. 目录职责

```text
apps/
  api/          Fastify HTTP、SSE 和 OpenAPI 入口
  worker/       Graphile Worker 后台作业入口
  web/          浏览器端 React 应用
  workspace-cli/无界面人工诊断与 MCP stdio 入口
packages/
  contracts/    运行时 Schema 与跨端契约
  database/     Kysely 数据库连接与迁移
  domain/       与框架无关的领域规则
  test-fixtures/确定性任务图和跨原型测试夹具
  workspace-core/UI 无关的 Workspace 状态、诊断、类型与平台端口
prototypes/
  workspace-sync/
  task-ui/
  agent-context/
deploy/         Caddy 与镜像构建文件
```

正式业务规则只能进入 `packages/domain`、`packages/workspace-core` 或对应服务端模块，不能只存在于 Web、CLI 命令解析、未来 GUI 适配层或 Agent prompt 中。

## 4. 常用命令

```powershell
corepack enable
pnpm install
Copy-Item .env.example .env

pnpm format:check
pnpm lint
pnpm build
pnpm typecheck
pnpm test
pnpm check

pnpm dev
pnpm dev:workspace -- status
pnpm dev:workspace -- doctor --json
```

`pnpm dev` 并行启动 API、Worker 和 Web；需要可访问的 PostgreSQL 和 `DATABASE_URL`。`pnpm dev:workspace -- <args>` 单独运行 Workspace CLI，不要求数据库或网络。Agent 宿主使用构建后的 `ngapd-workspace serve --stdio`；首版仅提供只读状态和诊断。

## 5. 单机部署骨架

在安装 Docker Compose 的 Linux 环境中：

1. 将 `.env.example` 复制为 `.env`。
2. 修改数据库密码与 `NGAPD_SITE_ADDRESS`，不要提交 `.env`。
3. 执行 `docker compose config` 检查展开后的配置。
4. 执行 `docker compose up --build -d`。
5. 检查 `/health/live`、`/health/ready` 和 `/docs`。

Caddy 默认使用内部 CA 为 `https://ngapd.local` 提供 TLS；实际内网/VPN 部署需要配置可解析主机名，并把内部根证书安全地加入受控客户端信任库，或改用团队已有证书。

持久卷已为 PostgreSQL、内容对象、备份和 Caddy 状态预留。备份/恢复脚本、日志轮转和对象一致性校验属于 M0 后续实现，不应误认为当前 Compose 已经完成生产运维闭环。

## 6. 已验证与环境限制

2026-07-24 的原始 Windows 工程骨架验证包括：

- 依赖锁定与供应链构建脚本白名单。
- Prettier 格式检查和 ESLint。
- 全 workspace TypeScript 类型检查。
- API、领域规则和测试夹具单元测试。
- API、Worker、共享包、React Web 与当时的 Electron 三进程生产构建。

该 Electron 骨架已由 Workspace CLI 与共享核心取代；当前统一门禁覆盖 API、Worker、Web、共享包和 CLI。本机没有安装 Docker，因此只通过 YAML 格式解析和构建文件审查检查 Compose；容器实际启动、PostgreSQL migration、Caddy TLS 和 Linux 卷权限仍需在首个有 Docker 的环境中验证。macOS 文件系统行为也必须在真实 macOS 设备验证，不能用 Windows 模拟结果替代。

## 7. 第一个原型的实现切片

先执行 [工作区租约与同步原型](../prototypes/workspace-sync/README.md)，按以下顺序形成小而完整的证据链：

1. 在 `packages/contracts` 定义 manifest、租约、提交、冲突和稳定错误响应。
2. 在 `packages/domain` 实现纯租约状态机，先覆盖 `SYNC-001` 至 `SYNC-007`。
3. 在 `packages/database` 增加工作区、租约、同步版本、manifest 和审计迁移。
4. 在 API 实现获取/续期/释放租约、读取 manifest、幂等提交和冲突选择。
5. 在 `@ngapd/workspace-core` 定义规范化路径、受保护路径、SHA-256 扫描和原子替换端口，并在独立平台适配器实现本地文件能力；未来 GUI 只复用共享接口，不调用 CLI 文本命令。
6. 先用两个进程模拟两台设备，再在 Windows 与 macOS 实机执行同一组场景。
7. 将每次执行证据写入 `prototypes/workspace-sync/results/`；只有满足退出标准才开始正式详细模块设计。

原型不实现完整界面、增量块同步、静默合并或生产安装器。若协议失败，先修订契约/ADR，再进入正式模块设计。
