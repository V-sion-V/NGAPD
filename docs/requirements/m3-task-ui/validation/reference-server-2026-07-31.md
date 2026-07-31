# M3 参考服务器验证（2026-07-31）

- 功能：M3 平铺树状任务界面
- 目标：`192.168.100.1`
- 验证结论：`passed`
- 验证策略：`relaxed`，全部 core/hard gate 与已执行 supplemental 检查通过
- 隔离 Compose project：`ngapd-reference-m3-p002-20260731t1214`
- 隔离目录：`/mnt/data/ngapd-validation/m3-p002-reference-20260731t1214`
- 隔离端口：HTTP `28080`、HTTPS `28443`
- 受控源码归档 SHA-256：`63785a39551fc38c090ba4cbbde7c64d5eb3f8e29bd5a567e210829858949a2f`
- 受控源码文件数：437

## 1. 目标确认与隔离边界

验证前通过 SSH 确认目标为 Linux 6.6.141 x86_64、Docker 27.3.1、Docker Compose 2.39.1，`/mnt/data` 可用空间约 220 GB。服务器原有 `deploy-home-table-1` 使用端口 3100 且为 healthy；本次没有复用其容器、网络、卷、镜像、目录、数据库或端口。

最终源码以受控归档上传到唯一验证目录，校验 SHA-256 后解包。运行时密码在服务器端随机生成并仅写入权限 `0600` 的隔离 env 文件；没有输出或提交秘密。发布栈保持正式六服务拓扑：PostgreSQL、migration、API、Worker、Web 和 Caddy gateway。

## 2. 发布、Schema 与硬化

`reference-stack.sh up` 在 104 秒内完成构建和启动。初次及恢复正式 HTTPS 配置后的最终 `reference-stack.sh smoke` 均通过：

| 检查 | 结果 |
| --- | --- |
| Gateway live / ready | passed |
| Web root / API / Worker health | passed |
| 六服务 inventory | passed |
| 非 root、只读根文件系统与应用无宿主端口 | passed |
| 应用容器默认出站阻断 | passed |
| PostgreSQL、对象、备份与 Caddy 持久卷 | passed |
| 正式 Schema profile | version `3` |
| 迁移 inventory | 10；latest `0010-m3-task-ui-history-compatibility` |
| 重复 migration | passed |
| 系统逻辑角色模板 | 74 |
| TLS、配置与秘密扫描 | passed |

最终正式 HTTPS 冒烟输出为 `REFERENCE_SMOKE_RESULT=passed`。迁移保持 version 3，不改写既有 M0/M1/M2 profile；`0010` 只解除完成历史对活动 Task 行的删除约束，历史快照仍由正式回归证明保留。

## 3. 真实数据库、规模与 P95

在同一隔离 PostgreSQL 17 中创建单独临时数据库执行 `apps/api/src/m3-read.integration.test.ts`，6/6 tests passed，随后由 trap 删除数据库。覆盖：

- 单项目 5,000 个活动 Task 的 Key/标题搜索、稳定游标和租户隔离；
- 深度 20 的完整祖先链与独立祖先读取；
- 匿名、非成员、跨项目和附件读取授权；
- Workspace 路径、版本、manifest/hash、对象内容和未配置对象存储的 fail-closed 行为；
- OpenAPI 公开搜索、祖先与 Session 附件读取契约。

使用 20 个有效样本采集 M2/M3 权威业务接口；单位均为毫秒：

| 场景 | P50 | P95 | Max | 门槛 | 结果 |
| --- | ---: | ---: | ---: | ---: | --- |
| Task 列表 | 13.77 | 23.73 | 50.34 | P95 < 500 | passed |
| Task 详情 | 13.91 | 24.86 | 47.89 | P95 < 500 | passed |
| 创建 Task | 31.68 | 47.47 | 49.83 | P95 < 800 | passed |
| 更新 Task | 25.07 | 32.32 | 73.69 | P95 < 800 | passed |
| 200 节点 DAG | 33.61 | 42.46 | 55.20 | P95 < 800 | passed |

采样项目为隔离数据 `PHMDKM`。所有结果显著低于当前非功能基线；200 节点 DAG 未出现关系错误、空白或持续阻塞。

## 4. 桌面浏览器与 Swagger

使用桌面 Chromium（Microsoft Edge）通过短时 SSH localhost 映射访问同一隔离 gateway。这样既不安装服务器证书，也不绕过浏览器安全警告，并使 Web Crypto 保持安全上下文。浏览器完成以下真实 Session 流程：

1. 打开中文 Web，注册隔离账号并创建项目 `MUV`。
2. 进入正式 `Production Task UI`，确认虚拟项目根、单 scope DAG、图版本、搜索/筛选、归档历史入口、Admin Mode 和依赖请求区域可见。
3. 创建父 Task `MUV-1`，从详情抽屉专用入口进入子任务视图并创建 `MUV-2`。
4. 对 `MUV-2` 明确确认最终服务端版本和无未提交 Workspace 版本后完成。
5. 获取 `deny` 策略重开完整影响并确认同一闭包后重开。
6. 预览不可恢复删除影响、输入完整 Task Key `MUV-2` 并提交；DAG 从 1 个节点变为 0，详情抽屉在权威失效刷新后关闭，应用控制台无 localhost 页面错误。
7. 打开 Swagger UI，确认 `NGAPD API 0.0.0 OAS 3.1`，并观察 Task 列表/创建/搜索/祖先/详情/更新/删除及相关操作路由。

直连私网 IP 的临时非安全 HTTP 首次尝试不具备 `crypto.randomUUID`，因此没有把该验证方式用于结论；这是浏览器验证通道限制，不是正式 HTTPS 产品缺陷。完成可视流程后恢复 `https://ngapd.local:28443`，重建 API/gateway 并再次通过完整 HTTPS smoke。

## 5. 清理与原服务保护

验证结束后执行带 `NGAPD_REFERENCE_REMOVE_IMAGES=1` 的精确 `down`：

- 本次六个容器、两个网络、五个持久卷和五个构建镜像均已删除；
- 隔离验证目录和 env/source archive 已删除；
- 单独规模数据库和旧 M3 临时 PostgreSQL 容器已删除；
- 本地数据库与浏览器 SSH 隧道、专用 known-hosts 和归档均已删除；
- 按 Compose project label 复查无残留容器、卷或网络；
- `deploy-home-table-1` 最终仍为 `Up (healthy)`，端口 3100 未变化。

本次没有执行生产数据库 reset、复用生产卷、停止原有服务或保留测试账号/数据。无开放 `FND-I-*`。
