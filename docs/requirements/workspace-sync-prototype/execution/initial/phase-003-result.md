# Workspace Sync initial run：P-003 阶段结果

- 运行编号：`initial`
- 阶段：`P-003`
- 阶段计划：[`phase-003-plan.md`](phase-003-plan.md)
- 阶段计划修订：`1`
- 父路线图修订：`1`
- 完成日期：`2026-07-25`
- 状态：`completed`
- 交付与验证策略：`relaxed`
- 验证结论：`passed`
- 开始基线：分支 `prototype`，提交 `a75be46a624ecb3ef309cac019e597461ddfc6e9`；叠加不可变 P-001/P-002 未提交实现
- 结束基线：同一未提交工作树；P-003 文件清单如下，未提交、推送、重置或改写用户输入/P-001/P-002 结果

## 1. 阶段目标与结果

P-003 已在 P-001/P-002 冻结的真实身份、授权、租约、版本和 ObjectStore 协议上交付可实际使用的 Workspace CLI、本地同步 core、macOS 端口与主体证据：

- T-001 以 additive 契约/repository/API 关闭 CLI 认证闭环：关联秘密保护的 pairing status、稳定 pending/批准/拒绝/过期、错误关联封顶、设备凭据换取 15 分钟访问令牌和 Bearer 当前设备撤销均通过真实 PostgreSQL/OpenAPI/审计门禁。
- T-002 交付 UI/CLI 无关的路径、manifest、diff、本地状态机、同步/冲突编排、恢复 journal 和原子物化，以及受限 Node/APFS 文件、原子 registry/state、正式 HTTP 和真实 macOS Keychain adapter；纯 core 可完全由假端口运行。
- T-003 保留 help/version/status/doctor 与两个只读 MCP 工具，新增 pair、auth status/logout、connect/首次物化、workspace status、lease acquire/renew/hold/release/takeover、sync、conflict use-local/use-server；人类和 JSON 输出投影同一结构化结果。
- CLI 不接收账号密码或任何 token/credential 参数。配对关联与短期访问令牌只在进程内存，长期设备材料与活动 lease token 只经 Keychain；普通输出、日志、审计和本地控制 JSON 只含 allow-listed ID、版本、摘要、到期时间与恢复建议。
- 只有 `connect` 接收根内相对登记路径；后续命令只接收 Workspace ID/alias 并通过 root registry 解析。接管和冲突方向在 parser/runtime 双层要求明确 `--confirm`，非交互缺失时稳定 usage 拒绝。
- 前台 hold 通过注入的生命周期端口固定每 20 秒续租，收到 `SIGINT`/`SIGTERM` 后尝试正式 release 并清理本地 lease；服务端时间、资格、设备、work cycle、base 和 lease 仍在每次写请求中重新验证。
- 两个真实 CLI 进程、两个登记 APFS 根、两个一次性隔离 Keychain 和正式 HTTP/PostgreSQL/ObjectStore 连续两轮执行 `SYNC-001`–`SYNC-009`；争用、接管、旧 holder、到期、旧基线、双向显式冲突、Task work-cycle/Owner/设备失效、保护名和重启/恢复均通过。
- 真实浏览器完成账号注册、配对码输入、设备摘要与明确批准；正式 CLI 消费后 Web 显示有效设备，CLI logout 后 Web 显示已撤销。无 CLI 密码、本地 GUI 或 Agent 写工具。
- supplemental 全部达标：500 文件/100 MiB 扫描+diff `211.33 ms`，2,000 文件扫描 `411.81 ms`，两轮小文件正式同步 `278.53 ms`/`260.62 ms`；50 MiB/2 GiB 边界稳定且不损坏服务端版本。无需 `FND-I-*`。

macOS 主体证据见 [`prototypes/workspace-sync/results/p003-macos-client.md`](../../../../../prototypes/workspace-sync/results/p003-macos-client.md)。P-003 全部 core、硬门禁和 supplemental 通过；Windows 11 x64/NTFS 仍由 P-004 独立执行，因此 initial run 不最终完成。

## 2. 任务、需求与验收覆盖

| 任务 | 状态 | 需求与验收 | 完成结果 |
| --- | --- | --- | --- |
| `P-003-T-001` | completed | `FR-003`–`FR-006`、P-003 认证范围的 `AC-002`、`AC-003`、`AC-012`、`AC-013`、`AC-017` | pairing status/尝试上限、device credential exchange/current revoke、事务验证、短令牌和脱敏审计完成；真实 PostgreSQL/API 负向与兼容门禁通过 |
| `P-003-T-002` | completed | `FR-021`–`FR-030`、P-003 core 范围的 `AC-007`、`AC-009`、`AC-010`、`AC-014`、`AC-016`–`AC-019` | 纯 core、受限路径/扫描/diff、软限制、显式冲突编排、恢复 journal、APFS/Keychain/HTTP/控制状态 adapter 完成；故障注入与真实平台门禁通过 |
| `P-003-T-003` | completed | `FR-003`–`FR-006`、`FR-011`–`FR-032`、`FR-036`–`FR-038` / `AC-002`、`AC-003`、`AC-006`–`AC-014`、`AC-016`–`AC-020` | 正式 CLI/runtime、统一投影、双进程两轮 `SYNC-001`–`SYNC-009`、真实 Web/Keychain/APFS/PostgreSQL/ObjectStore、Owner/设备失效、性能、根门禁和兼容收尾全部通过 |

阶段验收结论：

- `AC-002`、`AC-003`、`AC-006`–`AC-014`、`AC-016`、`AC-017` 全部通过；P-001/P-002 已冻结 core 在最终根门禁中继续通过。
- `AC-018`、`AC-019`、`AC-020` 全部达到目标，无 supplemental finding；`AC-019` 的数据完整性硬门禁同时通过。
- `AC-015` 是 P-004 的 Windows 外部门禁，不属于 P-003 finding，也不影响 P-003 `passed`；它继续阻止 initial run 最终封存。

## 3. 文件修改

| 文件或范围 | 修改模式 | 结果 |
| --- | --- | --- |
| `packages/contracts/src/{identity,pairing,errors,index}.ts` | modify | 增加 pairing status、device token exchange/current revoke 的运行时 Schema 与稳定错误 |
| `packages/database/src/{identity-repository,index}.ts` 及集成测试 | modify | 增加事务级 pairing 关联尝试上限、设备 credential 换令牌和 current revoke |
| `apps/api/src/modules/identity/**`、Identity 集成测试 | modify | 注册正式 CLI 认证闭环并保持 Web session/设备列表兼容 |
| `packages/workspace-core/src/{types,index,errors,path-policy,manifest,diff,state-machine,materialization,sync}.ts` 及测试 | modify/add | 增加端口、路径/扫描/manifest/diff、本地状态、租约/冲突编排和原子物化/恢复 |
| `apps/workspace-cli/src/adapters/**`、`node-platform.ts` 及测试 | add/modify | 增加受限 APFS 文件、原子 registry/state、正式 HTTP、macOS Keychain 与组合入口 |
| `apps/workspace-cli/src/{commands,workspace-runtime,cli,presentation,index}.ts` 及测试 | add/modify | 增加正式命令模型、依赖注入 runtime、统一人类/JSON 投影、明确确认、20 秒 hold/renew/signal release 和错误恢复 |
| `apps/workspace-cli/src/performance.integration.test.ts` | add | 增加显式运行的真实 APFS 500/100 MiB、2,000 文件和 50 MiB 边界证据 |
| `apps/api/src/workspace-cli.integration.test.ts`、`package.json` | add/modify | 增加两个独立 CLI 进程与真实 HTTP/PostgreSQL/ObjectStore/APFS/Keychain 两轮完整场景和 Owner/work-cycle 失效测试；只增加 workspace dev link |
| `packages/test-fixtures/src/workspace-sync*` | modify | 扩展确定性场景 ID 到 `SYNC-008`/`SYNC-009` |
| `.env.example`、`pnpm-lock.yaml` | modify | 增加非秘密 CLI origin/root 配置示例和 API→CLI 测试 workspace link；无新外部运行时依赖 |
| `prototypes/workspace-sync/results/p003-macos-client.md` | add | 保存不含秘密、正文或实例 ID 的 macOS 客户端/性能/场景证据 |
| `docs/requirements/workspace-sync-prototype/execution/initial/{execution-state,phase-003-result}.md` | modify/add | 保存任务检查点、验证、恢复与不可变 P-003 结果 |

`requirements.md`、`workflow-contract.md`、路线图、P-001/P-002 计划与不可变结果保持不变；`stdio-server.ts` 与 `bin.ts` 内容未修改。

## 4. 测试与验证

| 检查 | 命令或过程 | 观察结果 | 结论 |
| --- | --- | --- | --- |
| T-001 认证闭环 | contracts/database/API build/typecheck；真实 PostgreSQL database/API 测试 | database 2 文件/9 项、API 当时 3 文件/11 项；pending/批准/拒绝/过期/错误封顶/单次消费、15 分钟刷新、current revoke、审计脱敏通过 | pass |
| T-002 core | `@ngapd/workspace-core` test/build/typecheck | 最终 5 文件/24 项；路径/manifest/diff/state、500/2,000/50 MiB/2 GiB、同步/接管基线/冲突、对象完整性、物化故障和重建恢复通过 | pass |
| T-002/T-003 CLI | 完整 `@ngapd/workspace-cli test`、build/typecheck | 最终 6 文件/24 项，显式性能文件默认跳过；parser/presentation/runtime、真实 APFS/Keychain、HTTP Schema、MCP 兼容全部通过 | pass |
| 真实双进程场景 | `workspace-cli.integration.test.ts`；正式 HTTP、两个 CLI 进程、两个 APFS 根、两个隔离 Keychain | 两轮 `SYNC-001`–`SYNC-009`、lease conflict/takeover/expiry/old holder、两种冲突、Owner/work-cycle/设备失效、保护名、秘密/审计和收尾通过 | pass |
| 真实 Web | 本地隔离 API/Web + 应用内浏览器 + 等待中的正式 CLI | 注册、输入配对码、设备摘要、明确批准、CLI 消费、有效设备、CLI logout、Web 已撤销全部通过 | pass |
| 性能/边界 | `RUN_WORKSPACE_PERF=1` 的真实 APFS 性能测试；双进程测试 wall time | 500/100 MiB `211.33 ms`；2,000 文件 `411.81 ms`；小同步 `278.53`/`260.62 ms`；50 MiB/2 GiB 边界通过 | pass |
| 根门禁 | `DATABASE_TEST_URL=<P-003 隔离目标> pnpm check` | format/lint、10 workspace build/typecheck；database 9、domain 25、ObjectStore 3、core 24、CLI 24、fixture 6、API 12 项全部通过 | pass |
| 公共兼容与范围 | OpenAPI/根测试、CLI help/status/doctor、MCP tool 列表、依赖/网络/秘密/transient/`git diff --check` 扫描 | health/system/P-001 Web+Identity/P-002 API 保持；MCP 仍只有 2 个只读工具；无本地 GUI、CLI listener、Agent 写工具、外部 API/AI/LLM、秘密或仓库内运行产物 | pass |
| 数据与环境收尾 | 隔离数据库只读汇总后标记测试 active lease；Keychain/根/ObjectStore/process/port/`pg_ctl` 检查 | 根门禁后版本表 16 行、最大版本 3、Workspace 审计 44 条；4 个测试 active lease 标为 `test_cleanup`；cluster 停止，只保留已知日志 | pass |

最终根门禁第一次尝试只在 format 起点发现性能测试文件尚未重新格式化；格式化后从起点重跑并完整通过。随后补充 Task Owner/work-cycle 客户端路径，目标测试通过并再次从根门禁起点完整通过；最终结论不依赖失败尝试。

## 5. 发现项与处置

| ID | 类别 | 严重程度 | 关联需求/验收 | 观察与证据 | 最终功能影响 | 处置 | 置信度 | 建议后续 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |

无 `FND-I-*`。验证结论为 `passed`。

## 6. 决策、计划偏差与恢复记录

- 没有新增产品决策、用户问题、范围变化或阶段边界变化；T-003 按现有计划完成，P-004 未规划、未执行。
- T-003 双实例测试暴露了一个接管后的本地冲突基线缺口：接管租约的服务端 base 可以领先本地旧 base，而原 T-002 state parser 要求二者相等，`use_local` 也错误使用本地旧 base。当前阶段将 invariant 收窄为 lease base 不得落后本地 base，保留 conflict 时的有效 lease，并让明确 `use_local` 使用接管 lease base；新增纯 core 与真实双进程回归后通过。这是阶段内 core 整合修正，不改变公共协议、需求或已完成历史结果。
- 为真实跨进程测试增加 API 对 CLI 的 workspace-only dev dependency；没有新增外部包或生产依赖。锁文件只增加该本地 link。
- macOS adapter 增加已存在隔离 Keychain 的显式 `openIsolated` 入口，仅供正式 runtime 测试配置；生产默认仍使用 login Keychain。Keychain password 只由测试进程环境提供，不进入参数、输出或普通文件。
- PostgreSQL/localhost、Keychain 和本地监听因 sandbox 限制使用获批的已知隔离目标；无生产、未知数据库、默认用户文件根或外部网络被访问。
- 浏览器验证按 Browser 技能驱动现有 Web UI；页面关闭、设备撤销、Keychain 条目删除、API/Web 服务停止后才结束验证。

## 7. 遗留风险与下一阶段进入条件

- P-003 没有开放 finding、未决问题、半应用 migration、活动服务/lease/CLI hold、恢复 journal、Keychain、ObjectStore、本地根、真实秘密或未知数据变化。
- macOS 主体已完成；Windows 11 x64/NTFS core 证据仍缺失，必须由 P-004 在 Task UI 与 Agent Context 原型主体满足路线图前置后执行。缺少 Windows 证据不是 finding，但继续阻止 initial run 完成。
- 下一 invocation 必须调用 `$plan-feature-implementation`，重新读取本不可变结果、当前 state、P-001/P-002 结果和项目 diff，只即时创建 P-004 计划；不得改写本结果。
- 本阶段完成不授权在同一 invocation 中规划或实施 P-004，也不授权创建 `change-0.md` 或 `effective-requirements.md`。

