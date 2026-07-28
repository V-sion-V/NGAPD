# 参考服务器 Compose 与 P95 验证方法

文档状态：活动验证方法 1.0
适用范围：Linux x86_64 Docker Compose 参考服务器、正常内网或 VPN 客户端
相关基线：[MVP 非功能基线](../10-mvp-non-functional-baseline.md) · [实施路线与验收策略](../07-roadmap-and-validation.md)

## 1. 目的与结论边界

本方法验证两个相互独立的结果：

1. 六服务 Compose 发布栈可以从当前提交构建、迁移、启动、通过运行时与安全冒烟并完整清理。
2. 正常内网或 VPN 客户端经过 HTTPS Gateway、API 和 PostgreSQL 执行常规业务读写时，P95 满足当前里程碑阈值。

P95 是样本按端到端耗时升序排列后的第 95 百分位。本方法使用单客户端、顺序请求和一个 keep-alive 连接，用于发现明显的发布栈或查询延迟退化；它不是并发容量、吞吐量或极限压力测试。需要验证并发锁、规模或资源上限时，应使用对应里程碑的独立测试。

## 2. 安全与可复现要求

- 只针对一次性测试栈运行；P95 脚本会注册一个合成用户并写入个人资料，禁止指向生产库或共享开发库。
- 每次使用新的 `NGAPD_REFERENCE_PROJECT`、远程目录、数据库卷和可用端口。项目名必须以 `ngapd-reference-` 开头。
- 记录 Git commit、分支、源码快照 SHA-256、服务器架构、Docker/Compose 版本、测试端口、样本数、预热数、阈值和客户端路径。
- 环境文件权限设为 `0600`，使用每次运行新生成的数据库密码；记录和日志不得包含密码、Cookie 或合成账号密码。
- 构建、启动和验证命令应使用外层超时或保持可观察输出。路由器系统的 overlay 空间不足时，把源码和 Docker data-root 放在明确的大容量数据盘。
- 无论通过或失败，都执行 `down --volumes --remove-orphans`，再核对专用容器、网络、卷和远程目录已消失。镜像只按本次项目的精确名称删除，禁止使用全局 prune。
- 功能工作流的 initial 结果一旦冻结，后续补测只能新增独立验证记录，不得把历史 `not_run` 改写为 `passed`。

## 3. 前置条件

客户端需要仓库锁定的 Node.js 24 和 pnpm 11，以及可访问参考服务器的 SSH、SCP 和 HTTPS 网络。服务器需要：

- Linux x86_64；
- Docker Engine 27 或兼容版本；
- Docker Compose v2；
- `sh`、`curl`、`grep`、`sort`、`tar`；
- 足够的 Docker data-root 空间；
- 未被占用的 HTTP/HTTPS 测试端口。

先在客户端仓库根目录确认源码身份和工作区状态：

```sh
git status --short
git branch --show-current
git rev-parse HEAD
```

推荐只验证已提交的干净工作树。使用 `git archive` 生成可复现源码包并记录 SHA-256；若必须验证未提交内容，必须同时保存完整 diff 和独立快照哈希。

## 4. 准备隔离栈

在参考服务器的大容量数据盘创建一次性目录，将源码解压到其中。创建仅包含以下 Compose 变量、值可由 POSIX shell 安全加载且不含空白的 `validation.env`：

```dotenv
POSTGRES_DB=ngapd_reference
POSTGRES_USER=ngapd
POSTGRES_PASSWORD=<run-unique-random-secret>
NGAPD_SITE_ADDRESS=https://ngapd.local:18443
NGAPD_HTTP_PORT=18080
NGAPD_HTTPS_PORT=18443
```

随后在服务器会话中设置运行参数。示例名称必须替换为当前运行的唯一值：

```sh
export NGAPD_REFERENCE_PROJECT=ngapd-reference-20260729t0245
export NGAPD_REFERENCE_SOURCE=/mnt/data/ngapd-validation/20260729t0245/source
export NGAPD_REFERENCE_ENV_FILE=/mnt/data/ngapd-validation/20260729t0245/validation.env
```

启动前检查端口和现有容器，避免复用生产项目名、端口或卷。启动脚本会解析 Compose 配置、拉取当前基础镜像、构建所有服务，并等待六服务达到各自的预期状态：

```sh
sh scripts/compose/reference-stack.sh up
```

## 5. Compose 冒烟

在服务器运行：

```sh
sh scripts/compose/reference-stack.sh smoke
```

脚本必须全部验证：

- HTTPS Gateway 的 API live/ready 和 Web 根页面；
- Worker live/ready；
- 迁移任务可重复执行；
- API、Worker、Web、Gateway 以非 root 用户和只读根文件系统运行；
- API/Worker 不发布宿主端口、不连接 edge 网络且不能访问公网；
- Object Store 与备份卷在 API 重启后保留标记；
- 日志不包含本次 PostgreSQL 密码；
- 正式 Schema profile/version、迁移数量与最后迁移名、系统逻辑角色模板数量可读取。

正常结束标志是：

```text
REFERENCE_SMOKE_RESULT=passed
```

仓库已有的 `pnpm compose:smoke` 仍是拥有 Node/pnpm 的本机 Linux Docker 环境的完整自清理门禁；`reference-stack.sh` 用于 Docker-only 参考服务器，并把栈保留给随后从另一台内网客户端运行 P95。

## 6. M1 P95

保持参考栈运行，从正常内网或 VPN 的开发客户端执行：

```sh
pnpm reference:p95 -- \
  --host 192.168.100.1 \
  --port 18443 \
  --origin https://ngapd.local:18443 \
  --server-name ngapd.local \
  --samples 100 \
  --insecure \
  --confirm-isolated-target
```

只有使用 Compose 内部 CA 的隔离栈才允许 `--insecure`；具有受信任证书的目标应删除该参数。脚本执行：

1. 注册一个运行唯一的合成用户，取得安全 Cookie，但不输出凭据。
2. 执行默认 20 次读取和 5 次写入预热，不计入样本。
3. 对 `GET /api/v1/users/me/profile` 采集 100 个端到端读取样本。
4. 使用响应中的最新乐观版本，对 `PATCH /api/v1/users/me/profile` 采集 100 个端到端写入样本。
5. 输出 JSON 格式的 P50、P95、最大值、阈值和结论；任一 P95 未达标时以非零状态退出。

M1 默认门槛是常规读取 P95 `<500 ms`、普通写入 P95 `<800 ms`。后续里程碑应选择该里程碑的代表性读写接口；不得仅测健康检查来代替业务 P95。

## 7. 证据与清理

在清理前保存以下无秘密信息：

- Compose 冒烟输出；
- P95 JSON；
- `docker compose ps` 和一次 `docker stats --no-stream` 快照；
- Schema profile/version、迁移数量和最后迁移、系统模板数量；
- 服务器 CPU、内存、Docker data-root 与可用空间。

清理本次隔离栈：

```sh
export NGAPD_REFERENCE_REMOVE_IMAGES=1
sh scripts/compose/reference-stack.sh down
```

然后删除本次运行的远程源码目录，并分别核对本次 Compose project 标签下的容器、镜像、网络和卷数量均为零。最后确认服务器上原有容器仍保持原状态。验证记录应包含限制、异常、是否产生 finding，以及它与冻结 initial 历史之间的关系。
