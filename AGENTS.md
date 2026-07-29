# NGAPD Agent 指南

## 项目概述

NGAPD 是面向小型独立游戏团队的 AI 原生敏捷项目管理系统。核心领域把任务视为递归执行单元、单一责任边界、AI 上下文边界和可追溯知识节点；Web 与 Agent 必须复用同一套领域服务和权限规则。

仓库是 pnpm + TypeScript 单体仓库。服务端采用 Fastify 模块化单体与 PostgreSQL，Web 使用 React，后台作业使用 Graphile Worker，本地 Workspace 能力由 CLI、共享核心和平台适配器承载，部署目标是单台 Linux 服务器上的 Docker Compose。

## 当前开发阶段与目标

- 已完成基线：三个前置原型、Workspace CLI 初始工作流、M0“领域基线和工程骨架”，以及 M1“项目、角色和成员”完整初始运行；M0 `change-0`、`change-1`、严格纠正运行 `change-2` 和 M1 P-001/P-002/P-003 均为 `completed/passed`。
- 当前开发状态：M2“任务管理闭环”已按 schema-v3.2、`relaxed` 策略完成唯一 initial P-001，并由 `change-0.md` 与 `effective-requirements.md` 冻结为 `completed/passed`。正式 Schema 为 version 3/`0009-m2-task-management`；共享 Contracts/Domain、Task Query/Command/Lifecycle/Comment/Projection Repository、面向人类 Session 的完整 `/api/v1`/OpenAPI、Audit/Outbox/Graphile Worker/SSE、活动流/站内通知和 Task Workspace 原子边界均已交付。最终 Node 24/pnpm 11/PostgreSQL 17 根 `pnpm run ci` 为 288 tests passed、0 failed、9 platform-conditional skipped。
- 参考发布状态：2026-07-30 在 `192.168.100.1` 以隔离六服务 Compose 栈验证最终源码快照，Schema 3/9 migrations、重复迁移、健康/硬化/持久化/秘密扫描和 Chrome Web/Swagger 检查通过；列表/详情/创建/更新/200 节点 DAG P95 分别为 15.36/19.53/45.49/29.83/38.73 ms。隔离容器、卷、镜像、验证目录、开发数据库和 SSH 隧道已清理，服务器原有服务未受影响，无开放 finding。
- 后续路线图：M2 initial 历史已经冻结；任何 M2 需求或行为变化只能使用 `$apply-feature-change` 创建连续 change run。下一产品里程碑是 M3“平铺树状任务界面”，需先使用 `$clarify-feature-requirements` 建立独立 schema-v3 工作流，不得改写 M2 result、`change-0.md` 或 effective snapshot。
- 阶段依据：[M2 当前有效需求](docs/requirements/m2-task-management/effective-requirements.md)、[M2 初始实现记录](docs/requirements/m2-task-management/change-0.md)、[M2 P-001 结果](docs/requirements/m2-task-management/execution/initial/phase-001-result.md)、[M2 参考服务器验证](docs/requirements/m2-task-management/validation/reference-server-2026-07-30.md)、[M1 当前有效需求](docs/requirements/m1-project-role-members/effective-requirements.md)、[M1 参考服务器补充验证](docs/requirements/m1-project-role-members/validation/reference-server-2026-07-29.md)与[总体实施路线](docs/07-roadmap-and-validation.md)。活动运行或里程碑状态变化后必须立即更新本节。

## 文档索引

| 路径                                          | 含义                                                 |
| --------------------------------------------- | ---------------------------------------------------- |
| `docs/01-product-requirements.md`             | 产品定义、用户流程、功能/非功能需求与 MVP 验收       |
| `docs/02-domain-model.md`                     | 聚合、实体、任务树/DAG、状态机与并发规则             |
| `docs/03-permission-model.md`                 | 系统权限、管理员模式、Workspace 与 Agent 授权        |
| `docs/04-system-architecture.md`              | 模块化单体、组件、存储、API、关键流程与部署拓扑      |
| `docs/05-workspace-context-wiki.md`           | Workspace 生命周期、租约、同步、上下文、摘要与 Wiki  |
| `docs/06-agent-integration.md`                | Agent 会话、工具、提案确认协议与 Skill 安全边界      |
| `docs/07-roadmap-and-validation.md`           | M0–M7 路线、测试策略、端到端场景与质量门槛           |
| `docs/08-decisions-and-open-issues.md`        | 已确认决策、开放事项、假设与变更规则                 |
| `docs/09-technical-architecture-decisions.md` | 技术 ADR 与被取代关系                                |
| `docs/10-mvp-non-functional-baseline.md`      | 负载、性能、恢复、安全、兼容和发布基线               |
| `docs/11-logical-role-templates.json`         | 独立游戏团队的逻辑角色模板数据                       |
| `docs/12-prototype-preparation.md`            | 原型结论、固定技术基线、开发入口与里程碑交接         |
| `docs/validation/`                            | 跨里程碑可复用的活动验证方法与运行要求               |
| `docs/requirements/`                          | schema-v3 功能工作流的需求、计划、执行证据和变更记录 |
| `docs/requirements/agent-context-prototype/`  | Agent 上下文前置原型的封存记录                       |
| `docs/requirements/m0-domain-baseline/`       | M0 领域基线与工程骨架的封存记录                      |
| `docs/requirements/m1-project-role-members/`  | M1 项目、角色和成员的活动工作流记录                  |
| `docs/requirements/m2-task-management/`       | M2 任务管理闭环的封存 initial 工作流记录             |
| `docs/requirements/task-ui-prototype/`        | Task UI 前置原型的封存记录                           |
| `docs/requirements/workspace-cli/`            | Workspace CLI 初始实现的封存记录                     |
| `docs/requirements/workspace-sync-prototype/` | Workspace 同步前置原型的封存记录                     |

`docs/requirements/*/execution/`、`change-N.md` 和阶段结果是工作流证据；除非适用工作流明确要求，不要改写已封存记录。实现时以当前有效需求和对应工作流为直接依据，并用正式设计文档校验跨功能约束。

## 常用目录索引

| 路径                         | 职责                                                        |
| ---------------------------- | ----------------------------------------------------------- |
| `apps/api/`                  | Fastify HTTP、SSE、OpenAPI 及应用模块入口                   |
| `apps/web/`                  | React/Vite 浏览器应用和 Task UI                             |
| `apps/worker/`               | Graphile Worker 后台任务与健康检查                          |
| `apps/workspace-cli/`        | 配对、物化、租约、同步、冲突处理及只读 MCP stdio            |
| `packages/contracts/`        | TypeBox 运行时 Schema、DTO、事件与稳定错误契约              |
| `packages/database/`         | Kysely 连接、迁移、Repository、Outbox 与正式 Schema profile |
| `packages/domain/`           | 与框架无关的领域规则、状态机、授权、树和 DAG                |
| `packages/object-store/`     | 本地对象存储与一致性检查点                                  |
| `packages/test-fixtures/`    | 跨包、规模及原型使用的确定性测试夹具                        |
| `packages/workspace-core/`   | UI 无关的 Workspace 状态、物化、同步、路径策略与平台端口    |
| `prototypes/`                | 已封存的前置验证及证据；不是生产规则的权威实现              |
| `deploy/`                    | Caddy 镜像和网关/Web 配置                                   |
| `scripts/ci/`                | 工具链与数据库 CI 预检                                      |
| `scripts/compose/`           | 本机及 Docker-only 参考服务器的六服务 Compose 发布栈验证    |
| `scripts/performance/`       | 参考服务器真实业务接口延迟采样                              |
| `.github/workflows/`         | CI 与发布栈门禁                                             |
| `compose.yaml`、`Dockerfile` | 单机自托管发布栈及镜像构建                                  |

正式业务规则应落在 `packages/domain`、`packages/workspace-core` 或对应服务端模块；不能只存在于 Web、CLI 参数解析、平台适配器或 Agent prompt 中。

## 常用命令

仓库要求 `.node-version` 指定的 Node.js 24 和 `package.json` 指定的 pnpm 11。

```sh
pnpm install --frozen-lockfile  # 安装锁定依赖
pnpm check                      # format + lint + build + typecheck + test
pnpm format:check
pnpm lint
pnpm build
pnpm typecheck
pnpm test

pnpm dev                        # API + Worker + Web；需要 PostgreSQL
pnpm dev:api                    # API；需要 PostgreSQL
pnpm dev:web                    # Web
pnpm dev:workspace -- --help    # Workspace CLI 命令帮助
pnpm dev:workspace -- status
pnpm dev:workspace -- doctor --json

pnpm db:migrate                 # 需要 DATABASE_URL
pnpm run ci                     # CI 等价门禁；需要 PostgreSQL 17 和数据库环境变量
pnpm compose:smoke              # 需要可用的 Linux Docker/Compose 环境
pnpm reference:p95 -- --help    # 参考服务器 M1 业务读写 P95；仅限隔离测试栈
pnpm reference:m2:p95 -- --help # 参考服务器 M2 业务与 200 节点 DAG P95；仅限隔离测试栈
```

按包运行时使用 `pnpm --filter <workspace-name> <script>`。不要在没有明确目的和目标确认时运行数据库 reset、冲突覆盖、租约 takeover 或其他破坏性/高风险命令。

## Agent 工作要求

1. 开始前读取本文件、相关正式设计文档和当前功能的 `docs/requirements/<feature>/`；先检查工作区差异，保留用户已有改动。
2. 改动领域行为时同步检查契约、数据库、API/Worker、Workspace、权限、审计和测试夹具的跨层影响；原型只作证据，不作生产权威。
3. 测试应与风险相称：至少运行直接受影响包的测试/类型检查；可行时以 `pnpm check` 收尾。数据库或 Compose 验证缺少环境时明确说明未运行项。
4. 工作完成前必须核查本次更改是否让本文件的项目概述、阶段/目标、索引、目录职责或命令失真；若有影响，在同一次工作中立即更新。
5. 完成开发阶段、替换核心技术、增删常用目录/脚本或改变标准命令时，必须更新本文件，并检查 README 与相关正式文档是否仍正确。
