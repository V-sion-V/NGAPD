# 原型准备、验证结果与开发入口

文档状态：可执行基线 1.0

## 1. 结论

截至 2026-07-26，工作区同步、平铺树状 Task UI 和 Agent 上下文三个前置原型均已完成并封存为 `completed/passed`，没有开放 finding。工程骨架已经覆盖服务端、后台作业、Web、Workspace CLI、共享 Workspace 核心、共享契约、领域包、数据库迁移和测试夹具；同步原型还补齐了真实身份/配对、租约、版本、ObjectStore、macOS/APFS/Keychain 与 Windows/NTFS/PasswordVault 闭环。下一项工作是 M0“领域基线和工程骨架”，不再需要补做前置原型或泛化架构设计。

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

该 Electron 骨架已由 Workspace CLI 与共享核心取代；当前统一门禁覆盖 API、Worker、Web、共享包和 CLI。2026-07-25 至 2026-07-26 的三个原型进一步完成了真实 macOS/Windows 主体：Workspace Sync 覆盖 PostgreSQL 17、ObjectStore、APFS/Keychain、NTFS/PasswordVault 和双进程冲突/恢复；Task UI 覆盖 macOS Chromium 与 Windows Chrome；Agent Context 覆盖两平台 Node 24 确定性 core 与性能。当前仍未由这些原型证明的是完整 Linux Docker Compose 启动、Caddy TLS、Linux 卷权限以及面向部署的备份/恢复闭环，这些继续由后续里程碑验证。

## 7. 原型封存与 M0 入口

三个原型的最终入口如下：

| 原型 | 最终状态 | 回顾报告 |
| --- | --- | --- |
| Workspace Sync | `completed/passed` | [工作流回顾](requirements/workspace-sync-prototype/workflow-report.md) |
| Task UI | `completed/passed` | [工作流回顾](requirements/task-ui-prototype/workflow-report.md) |
| Agent Context | `completed/passed` | [工作流回顾](requirements/agent-context-prototype/workflow-report.md) |

M0 按[实施路线](07-roadmap-and-validation.md#m0领域基线和工程骨架)推进。开始编码前应建立独立的 schema-v3 需求与实施工作流；第一批正式领域范围包括 Project/Task Key、任务树、继承式有效 Owner、同级 DAG、`graph_version`、状态机、完成冻结、重新打开及其领域/API 不变量测试。原型代码和夹具只作为已验证约束与测试输入，不能替代正式领域需求或把 UI/CLI 逻辑提升为服务端权威。
