# M2 参考服务器发布、浏览器与 P95 验证

- 验证日期：`2026-07-30`
- 目标：`192.168.100.1`
- 运行编号：`m2-p001-reference-20260730T061233`
- Compose project：`ngapd-m2-p001-reference-20260730t061233`
- 源码快照 SHA-256：`854cc17a913fce1a30be9ccb1380bab6f273a65417636983942a5cb865c71514`
- 结论：`passed`
- 范围：P-001 V-009/V-010/V-011、AC-018/AC-019/AC-020 supplemental

## 1. 环境与隔离边界

参考服务器运行 Docker `27`、Compose `2.39.1`。验证使用专用目录 `/mnt/data/ngapd-validation/m2-p001-reference-20260730T061233`、专用 Compose project、端口 `18080/18443`、随机强数据库密码和独立 PostgreSQL/Object Store/Backup/Caddy 卷。

最终标准站点地址为 `https://ngapd.local:18443`；LAN 客户端以 `192.168.100.1` 作为 connect host，保留 TLS Host/SNI。API 与 Worker 不发布宿主端口。验证没有读取或修改服务器原有应用数据、卷、镜像配置或 `deploy-home-table-1`。

## 2. 最终源码与发布结果

本机从最终 runtime 工作树创建 461-entry 压缩快照，排除 `.git`、Agent/Codex 控制目录、`.tmp`、`node_modules`、`dist`、coverage、`.env` 和原型结果。上传后在服务器复算 SHA-256 相同，再从空 Compose 卷执行 `docker compose up --build -d`。

最终验证结果：

```text
CONFIG=passed
GATEWAY=passed
WORKER=passed
MIGRATION_REPEAT=passed
SCHEMA_VERSION=3
MIGRATIONS=9
LATEST=0009-m2-task-management
HARDENING=passed
PERSISTENCE=passed
SECRET_SCAN=passed
```

具体覆盖：

- PostgreSQL、migrate、API、Worker、Web、Caddy 六服务依赖顺序与健康状态正确；migrate 正常退出 0。
- 网关 TLS `/health/ready`、Web `/`、Swagger `/docs` 与 OpenAPI `/docs/json` 正常；`deploy/Caddyfile` 的 `/docs*` API 代理在发布拓扑生效。
- API/Worker 只在 backend 网络，无宿主端口；相关容器使用非 root 用户且无外部网络。
- 重复 migrate 为 no-op，`system_metadata` 与 migration inventory 为 profile 3、9 migrations、latest `0009-m2-task-management`。
- 对象与备份标记在 API/栈重启后保持；日志不含数据库密码、Session/lease secret 或测试凭据。

## 3. 参考 P95

客户端使用 Node `24.18.0` 与 `scripts/performance/m2-reference-p95.mjs`，明确传入 `--confirm-isolated-target`，在刚重建的隔离数据库上每项采样 20 次：

| 操作 | P50 | P95 | 最大 | 门槛 | 结果 |
| --- | ---: | ---: | ---: | ---: | --- |
| 当前层列表 | 12.23 ms | 15.36 ms | 44.81 ms | < 500 ms | passed |
| Task 详情 | 11.62 ms | 19.53 ms | 48.31 ms | < 500 ms | passed |
| 普通创建 | 31.17 ms | 45.49 ms | 46.14 ms | < 800 ms | passed |
| 普通更新 | 24.47 ms | 29.83 ms | 75.32 ms | < 800 ms | passed |
| 200 节点 DAG | 30.85 ms | 38.73 ms | 39.80 ms | < 800 ms | passed |

全部 AC-019 精确门槛通过，无性能 finding。

## 4. 浏览器补充验证

- In-app Browser 对自定义 `ngapd.local` 返回 DNS 不可解析，对直接私网 IP 应用其安全策略，因此没有把该路径作为失败证据。
- 用户 Chrome 通过 `http://192.168.100.1:18080` 的临时隔离站点配置完成只读可视验收：NGAPD 中文注册入口、登录名/密码约束和创建账号控件正常渲染。
- Chrome 打开 Swagger UI，页面标题为 `Swagger UI`，OAS 3.1 文档完成加载，识别到 27 个 Task 路由和通知表面。
- 浏览器未提交表单或发送凭据。临时 HTTP 仅用于同一隔离 LAN 可视检查；最终重建和全部发布结论均恢复到标准 TLS 地址。

## 5. 清理

验证完成后执行精确项目清理：

- `docker compose down --volumes --remove-orphans`
- 删除五个本次 project build images
- 删除专用验证目录与压缩包
- 删除 CI 专用 PostgreSQL 容器 `ngapd-m2-dev-20260730` 和卷 `ngapd-m2-dev-20260730-data`
- 停止本机 SSH tunnel PID `7732`，确认 `127.0.0.1:65432` 不再监听

最终检查无本次 project container/network/volume/image 或远端验证目录残留，服务器原有 `deploy-home-table-1` 仍运行。
