# NGAPD

NGAPD 是一款面向独立游戏团队的 AI 原生敏捷项目管理系统。它将递归任务、用户级/项目级/任务级工作区、Agent 工具调用和过程知识沉淀组织为同一个领域模型。

## 产品愿景与目标用户

NGAPD 主要服务于少于 20 人、实际活跃成员通常少于 10 人的独立游戏团队。它希望让策划、程序、美术、音乐与声音等成员围绕同一棵任务树协作，同时让 AI Agent 获得明确、最小且可审计的上下文与操作边界。

核心定义是：

> 任务 = 递归执行单元 + 单一责任边界 + AI 上下文边界 + 可追溯知识节点

## 典型使用场景

- 项目负责人建立项目、角色和任务树，将复杂目标递归拆分为责任清晰的执行单元。
- 团队成员通过同级依赖、关注、评论和状态流转协调跨专业工作。
- 成员或 Agent 在用户级、项目级或任务级工作区中处理文件，并通过租约和显式冲突选择避免静默覆盖。
- Agent 读取任务上下文、提出管理操作提案并沉淀完成摘要；涉及任务管理数据的修改由人确认。
- 团队从完成记录生成可追溯的 Wiki，并在单机自托管环境中备份和恢复项目。

仓库结构、当前里程碑、设计文档索引和开发命令速查见 [AGENTS.md](AGENTS.md)。

当前已完成 M3“平铺树状任务界面”：正式 React 页面在现有项目上下文中提供单层 DAG、深链/浏览器历史、项目级搜索与筛选、活动/归档分离、完整 M2 人类操作、评论/附件/活动/通知和显式 Admin Mode。实现、验证与收尾结论见 [M3 初始实现记录](docs/requirements/m3-task-ui/change-0.md)和[M3 工作流回顾](docs/requirements/m3-task-ui/workflow-report.md)。

当前开发入口已切换到分支 `codex/m4-workspace-sync-platform-adapter` 上的 M4“Workspace 同步平台适配器”。该分支从已合并的 `main@f032c67` 建立；M4 目前只处于需求澄清入口，尚未创建 schema-v3 功能工作流或开始产品实现。下一步必须先使用 `$clarify-feature-requirements` 明确范围、交付策略和验收，再独立规划。

## 已确认的产品边界

- 客户端支持 macOS、Windows；Web 服务端使用 Docker Compose 部署于单台 Linux 服务器，初期通过内网或 VPN 访问。
- 初期实际用户少于 10 人，项目规模较小，优先保证完整交付；不提前建设高可用集群或大规模基础设施。
- 项目规模主要面向少于 20 人的团队。
- 同一父任务下的直接子任务预计不超过 200 个，但该数值不是硬限制。
- 每个任务最多保存一个显式 Owner；显式 Owner 为空时继承最近一个显式 Owner 非空祖先的 Owner。任务级工作区只有有效 Owner 可以写入，其他项目成员只读。
- 每个项目拥有一个项目级工作区；Project Owner 和 Project Admin 可写，其他项目成员只读；Agent 写入项目级工作区前还必须由用户明确要求并确认进入管理员模式。
- 每个用户拥有一个用户级工作区；对应用户可写，其他已认证用户只读。
- 三种工作区都使用独占写入租约，同一工作区同时只能有一个可写连接；租约或同步版本冲突时不静默覆盖，由仍有写资格的用户明确选择本地版本或服务端版本成为新的唯一事实。
- 任务依赖只能建立在同一父任务的直接子任务之间，并且不能成环。
- 普通模式下，当前用户拥有两个依赖端点或两者共同的直接父任务时可以直接修改依赖；只拥有一个端点时必须由另一端点 Owner 接受。顶层任务的共同父级是虚拟项目根节点，由 Project Owner 控制该依赖作用域。
- 管理员模式扩大任务管理权限，并作为 Agent 写入项目级工作区的附加门槛；它不绕过工作区单写者权限。
- Agent 可以无需确认地读取项目内全部任务信息，并对当前用户有写权限且已取得租约的用户级或任务级工作区进行完整用户内容操作；项目级写入还受前述显式管理员模式约束。
- Agent 对任务管理数据的任何修改都需要人工确认；使用管理员权限前必须由用户显式进入管理员模式，Agent 不能自动进入但可以自动退出。
- NGAPD 服务端不调用外部 API 或 LLM，全部业务数据自托管；Agent 摘要由用户自己的模型生成并随完成提案提交，人工完成缺少摘要时使用服务端确定性基本摘要。
- Agent 不得自行读取其他用户的用户级工作区；即使底层读取权限允许，也只有在用户明确指定目标和目的后才能读取。
- 任务可以单向关注同项目的另一任务；Agent 连接关注方任务后，可以无需额外确认地渐进读取被关注任务的任务数据、摘要和其本来有权读取的任务级工作区内容，但关注不授予写权限，也不参与依赖或完成计算。
- 只有顶层任务可以归档；非顶层任务使用不可恢复删除。归档顶层任务的依赖边保留为历史结构，但不再参与阻塞、完成或调度计算。
- 已完成任务冻结任务内容、Owner、结构、依赖和任务级工作区；除评论、显式重新打开和顶层归档外不能继续修改。
- MVP 提供项目级一致备份与恢复，不提供项目永久删除、任务回收站或单任务恢复；非顶层删除必须输入完整 Task Key 确认。
- 初版使用平铺树状界面导航任务；语义缩放和嵌套任务图排期到后续版本。

## 设计原则

1. 能力角色与系统权限分离。
2. 每个任务只有一个有效责任人，不引入多人经办或审批责任模型；TaskFollow 只用于任务上下文发现，不构成责任角色。
3. 验收、复查和集成工作仍使用普通任务节点表达。
4. 服务端任务树和同级依赖是权威业务结构；文件目录不承担任务层级关系。
5. Agent 与 Web UI 调用相同的领域服务，不维护第二套业务规则。
6. Wiki 是工作过程的可追溯投影，而不是独立维护的信息孤岛。
7. 优先构建模块化单体，避免过早拆分微服务。

## 开发、测试与部署

仓库要求 `.node-version` 指定的 Node.js 24 和 `package.json` 指定的 pnpm 11。标准开发、迁移和测试命令会自动读取被 Git 忽略的 `.env`，优先验证本地 PostgreSQL 17，无法使用时再连接已配置的 fallback。完整规则与共享测试库安全边界见[持久开发数据库与自动回退](docs/validation/development-database.md)。

### 日常快速启动

已配置工作区只需在新终端执行：

```sh
node --version
pnpm --version
pnpm env:check
pnpm db:migrate
pnpm dev
```

预期工具链为 Node `v24.18.0`、pnpm `11.9.0`。`pnpm dev` 会并行启动 API、Worker 和 Web，是需要用 `Ctrl+C` 停止的常驻进程。首次克隆或依赖变化后，先单独运行一次可能较久的 `pnpm install --frozen-lockfile`；不要把依赖安装或 `pnpm dev` 当作等待完成的 Agent 命令。

默认可访问：

- Web：`http://localhost:5173`
- API 存活检查：`http://localhost:3000/health/live`
- API 就绪检查：`http://localhost:3000/health/ready`
- OpenAPI 文档：`http://localhost:3000/docs`

`.env`、`.env.*`、本地 `.data/` 和 `.tmp/` 均被 Git 忽略；不得提交 fallback 口令、数据库 URL、Cookie 或 token。

Apple Silicon 是 macOS 首要开发架构；Intel Mac 可使用相同命令，但 Homebrew 会选择对应架构的安装目录。

### macOS 首次安装

以下流程使用 [Homebrew](https://brew.sh/) 和 nvm。已经安装 nvm 或 PostgreSQL 17 时可跳过对应的 Homebrew 安装：

```zsh
brew install nvm postgresql@17
mkdir -p "$HOME/.nvm"
```

将以下内容加入 `~/.zshrc`，然后重新打开终端：

```zsh
export NVM_DIR="$HOME/.nvm"
[ -s "$(brew --prefix nvm)/nvm.sh" ] && \. "$(brew --prefix nvm)/nvm.sh"
export PATH="$(brew --prefix postgresql@17)/bin:$PATH"
```

在仓库根目录安装锁定版本的 Node.js、pnpm 和项目依赖：

```zsh
nvm install "$(cat .node-version)"
nvm use "$(cat .node-version)"
corepack enable
corepack prepare pnpm@11.9.0 --activate
pnpm install --frozen-lockfile
cp .env.example .env
```

只运行本地 Workspace CLI 的只读状态与诊断时不需要 PostgreSQL：

```zsh
pnpm dev:workspace -- status
pnpm dev:workspace -- doctor --json
```

Agent 宿主通过 `ngapd-workspace serve --stdio` 使用 MCP 标准输入输出入口。首版只暴露 `workspace_status` 和 `workspace_doctor`，不会扫描、同步或修改 Workspace、任务、文件与数据库。

API、Worker 和 Web 的全栈开发需要 PostgreSQL 17。Homebrew 默认使用当前 macOS 用户作为数据库角色：

```zsh
brew services start postgresql@17
createdb ngapd
createdb ngapd_test

MACOS_USER="$(id -un)"
sed -i '' "s|^DATABASE_LOCAL_URL=.*|DATABASE_LOCAL_URL=postgres://${MACOS_USER}@localhost:5432/ngapd|" .env
sed -i '' "s|^DATABASE_TEST_LOCAL_URL=.*|DATABASE_TEST_LOCAL_URL=postgres://${MACOS_USER}@localhost:5432/ngapd_test|" .env
sed -i '' 's|^OBJECT_STORE_PATH=.*|OBJECT_STORE_PATH=./.data/objects|' .env
sed -i '' 's|^BACKUP_PATH=.*|BACKUP_PATH=./.data/backups|' .env

pnpm env:check
pnpm db:migrate
pnpm check
pnpm dev
```

`pnpm dev` 不会启动 Workspace CLI。每次在新的终端运行全栈命令前，仍需执行 `nvm use "$(cat .node-version)"`；`.env` 由标准脚本自动读取，不再需要 `source .env`。若 `createdb` 提示数据库已经存在，可直接继续；不再需要本地数据库时可执行 `brew services stop postgresql@17`。

### 测试与构建

`pnpm check` 是日常完整质量门，会依次检查格式、Lint、生产构建、类型和测试。也可以单独运行：

```zsh
pnpm format:check
pnpm lint
pnpm build
pnpm typecheck
pnpm test
pnpm check
```

`pnpm test`、`pnpm check` 和 `pnpm run ci` 会自动选择独立测试库；测试库可能被重建，绝不能与人工开发数据所在的应用库相同。`pnpm run ci` 还会校验锁定工具链并重复执行数据库迁移。必须保留 `run`，否则 pnpm 会把 `pnpm ci` 解释为自身的 clean-install 命令。

### Linux/Docker 部署

复制并修改 `.env.example` 后，先用 `docker compose config` 检查配置，再用 `docker compose up --build -d` 启动 PostgreSQL、迁移任务、API、Worker、Web 和 Caddy 网关。该 Compose 配置面向 Linux 自托管服务器，macOS 日常开发不要求安装 Docker Desktop。

完整发布栈冒烟验证使用 `pnpm compose:smoke`，需要可用的 Linux Docker/Compose 环境。Docker-only 参考服务器的隔离栈验证、正常内网业务 P95 采样和精确清理流程见[参考服务器 Compose 与 P95 验证方法](docs/validation/reference-server-compose-and-p95.md)；M1 与 M2/M3 Task 业务 P95 客户端入口分别为 `pnpm reference:p95 -- --help` 和 `pnpm reference:m2:p95 -- --help`。M3 最终隔离发布证据见[参考服务器验证](docs/requirements/m3-task-ui/validation/reference-server-2026-07-31.md)。部署前应修改数据库密码和 `NGAPD_SITE_ADDRESS`，且不得提交 `.env`。
