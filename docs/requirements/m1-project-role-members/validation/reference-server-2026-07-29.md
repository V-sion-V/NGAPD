# M1 补充验证记录：参考服务器 Compose 与 P95

- 记录类型：冻结 initial 之后的补充发布验证
- 执行日期：`2026-07-29`
- 运行 ID：`m1-p003-reference-20260729T0245`
- 结论：`passed`
- 关联验收：`AC-025` 适用发布栈、`AC-027` 初期目标规模、`AC-028` 参考服务器 P95
- 验证方法：[参考服务器 Compose 与 P95 验证方法](../../../validation/reference-server-compose-and-p95.md)
- 源码分支：`requirements/m1-project-role-members`
- 源码提交：`02a7121176d1d782af66a38e93e60301ae7ec100`（`m1.1`）
- 传输源码快照 SHA-256：`e3819f6e7e8d388ba625d552baf4d3cb23c71c6fa1714f8fae98a6faea1a23a2`

## 1. 证据边界

M1 的 P-001/P-002/P-003、`execution/initial/**`、`change-0.md` 和 `effective-requirements.md` 已形成不可改写的初始历史。初始运行因当时没有 Docker 和参考服务器，将 V-014 Compose 与 V-015/AC-028 P95 如实记为 `not_run`。

本记录是在用户随后提供独立 x86 Docker 服务器后追加的补充证据。它证明相同 M1 交付内容在参考环境中的发布栈和业务 P95，但不回填、不替换初始运行的历史结论，也不构成需求或产品行为变更。

## 2. 环境与隔离

| 项目 | 观察值 |
| --- | --- |
| 参考服务器 | `192.168.100.1`，iStoreOS/Linux `6.6.141`，`x86_64` |
| 资源 | 4 个逻辑 CPU；`7,878,008 KiB` 内存；无 Swap |
| 容器工具 | Docker `27.3.1`；Docker Compose `2.39.1` |
| Docker data-root | `/mnt/data/docker`，验证前约 `223 GiB` 可用 |
| 客户端路径 | Windows 开发主机，经正常局域网访问参考服务器 HTTPS 端口 |
| Compose project | `ngapd-p003-reference-20260729t0245` |
| 隔离端口 | HTTP `18080`；HTTPS `18443` |
| 远程临时根 | `/mnt/data/ngapd-validation/m1-p003-reference-20260729T0245` |
| 既有服务保护 | 现有 `deploy-home-table-1` 使用端口 `3000`；验证未复用其 project、端口、卷或镜像 |

源码包只包含 Git tracked/unignored 工作树内容，不包含 `.git`、`node_modules`、真实 `.env` 或秘密；远端接收后的 SHA-256 与客户端记录一致。数据库密码按运行生成，仅保存在权限 `0600` 的远程 `validation.env` 中，未进入记录。

## 3. Compose 发布栈

服务器本身没有 Node/pnpm，因此按现行方法的 Docker-only 路径执行与仓库 `compose:smoke` 等价的隔离验证。使用 `docker compose build --pull` 成功构建 `api`、`migrate`、`worker`、`web` 和 `gateway` 镜像；`postgres:17.10-alpine` 成功拉取，六服务按依赖启动。

| 检查 | 观察 | 结论 |
| --- | --- | --- |
| Gateway/API | HTTPS `/health/live`、`/health/ready` 返回 `status=ok` | pass |
| Web | Gateway 根页面包含 React `root` 容器 | pass |
| Worker | 容器内 live/ready 均成功 | pass |
| 迁移幂等 | 启动迁移后再次运行 migrate 正常退出 | pass |
| 运行身份 | API/Worker/Web/Gateway 均为非 root，根文件系统只读 | pass |
| 端口/网络 | API/Worker 无宿主端口，仅在 internal backend；未连接 edge | pass |
| 出站约束 | API/Worker 对 `https://example.com` 的请求在 3 秒边界内失败 | pass |
| 持久卷 | API 写入 Object Store/backup 标记，重启后内容保持 | pass |
| 秘密 | Compose 日志不包含本次 PostgreSQL 密码 | pass |
| 正式数据 | `schema_profile=m0-domain-baseline`，profile version `2` | pass |
| 正式迁移 | 共 `8` 个，最后为 `0008-m1-project-role-members` | pass |
| 系统模板 | `74` 个系统逻辑角色模板 | pass |

Compose 冒烟结论：`passed`。

空闲时一次非压力资源快照：

| 服务 | CPU | 内存 |
| --- | ---: | ---: |
| Gateway | `0.00%` | `13.98 MiB` |
| Worker | `0.79%` | `30.29 MiB` |
| API | `0.00%` | `46.39 MiB` |
| Web | `0.00%` | `11.82 MiB` |
| PostgreSQL | `0.92%` | `40.37 MiB` |

该快照只说明冒烟结束时没有异常资源占用，不是容量结论，也不改变 16 GiB 的正式建议配置。

## 4. M1 业务 P95

采样路径为：

```text
Windows LAN client -> HTTPS Gateway -> API -> PostgreSQL
```

注册合成用户和首次读取不计时；随后执行 20 次读取与 5 次写入预热。正式样本使用单客户端、顺序请求和一个 keep-alive 连接：

| 类型 | 业务操作 | 样本 | P50 | P95 | 最大值 | 门槛 | 结论 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| 常规读取 | `GET /api/v1/users/me/profile` | 100 | `7.24 ms` | `15.98 ms` | `19.38 ms` | `<500 ms` | pass |
| 普通写入 | `PATCH /api/v1/users/me/profile` | 100 | `13.52 ms` | `20.24 ms` | `26.52 ms` | `<800 ms` | pass |

两项均通过 AC-028 阈值。该结果是正常局域网下的发布栈延迟基线，不表示并发吞吐或极限容量；M1 的并发正确性仍由冻结 initial 中的 PostgreSQL 并发测试独立证明。

## 5. 清理与影响

验证结束后执行了精确的 `down --volumes --remove-orphans`，并删除本次 project 的五个构建镜像和远程临时根。只读复核结果：

| 资源 | 本次 project 剩余数量 |
| --- | ---: |
| 容器 | `0` |
| 镜像 | `0` |
| 网络 | `0` |
| 卷 | `0` |
| 远程临时目录 | 不存在 |

服务器原有 `deploy-home-table-1` 在清理后仍为 `healthy`，端口映射仍为 `3000:3000`。客户端临时归档和一次性验证脚本也已删除。

## 6. 最终判定

- M1 Compose 补充发布验证：`passed`
- AC-028 参考服务器常规读/写 P95 补充证据：`passed`
- 新发现的功能、安全、数据、兼容或运行时 finding：无
- 对冻结 initial 状态的影响：无；历史 V-014/V-015 `not_run` 保持原样
- 后续复用入口：`scripts/compose/reference-stack.sh`、`pnpm reference:p95` 和本记录引用的活动验证方法
