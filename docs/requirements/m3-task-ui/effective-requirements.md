# M3 平铺树状任务界面：当前有效需求

- 派生状态：可重新生成
- 原始需求：[`requirements.md`](requirements.md)
- 已应用至修改记录：[`change-0.md`](change-0.md)
- 生成日期：2026-07-31
- 当前交付与验证策略：`relaxed`
- 当前验证结论：`passed`

## 1. 当前目标与范围

当前有效目标是在 M1 已认证中文 Web 与 M2 权威 Task 服务之上，提供正式生产平铺树状 Task UI：任一时刻一个当前父级作用域和一幅同级 DAG、非模态详情抽屉、专用层级下降、完整面包屑/深链/History、项目级搜索、当前层筛选、活动/归档分离，以及 M2 全部人类 Session 操作、评论、附件、活动、通知、Admin Mode 和 SSE 恢复。

正式页面只消费 `/api/v1`、TypeBox/OpenAPI、服务端 `actions`、版本和影响事实。`?prototype=task-ui` 继续作为隔离原型证据。M4 本地 Workspace 物化/同步/租约写入、M5 Agent 工具与提案确认、M6 摘要/Wiki/全文搜索、语义缩放和嵌套画布不属于 M3。

## 2. 当前生效需求

| 当前编号 | 当前生效内容 | 验收要求与层级 | 来源 |
| --- | --- | --- | --- |
| `FR-001` | 正式 Task UI 位于现有认证和当前项目上下文；会话、活动 Membership 与项目读取权由服务端逐次校验，M1 页面不回归。 | AC-001 core | `requirements.md` |
| `FR-002` | 任一时刻只有一个当前父级作用域和一幅活动 DAG；项目根显示顶层 Task，普通父级只显示其活动直接子 Task。 | AC-002 core | `requirements.md` |
| `FR-003` | DAG 呈现全部已加载且符合筛选的同级节点和孤立节点；边只表达同父级 predecessor → successor。 | AC-002 core | `requirements.md` |
| `FR-004` | DAG 使用有限可滚动视口；只绘制两端可见边并提示隐藏关系，不为性能静默丢弃权威节点或边。 | AC-002、AC-007、AC-022 core | `requirements.md` |
| `FR-005` | 新作用域默认无选择且抽屉收起；选择节点只在当前布局右侧打开非模态详情。 | AC-003 core | `requirements.md` |
| `FR-006` | 抽屉展示 Task/Owner/角色/状态/完成就绪/截止时间/标签/展示类型/子项/版本/Workspace 和服务端 `actions`。 | AC-003、AC-014 core | `requirements.md` |
| `FR-007` | 同层切换不改变 scope；关闭或 Escape 清除选择、高亮和抽屉，焦点返回原节点并保留页面状态。 | AC-003、AC-009 core | `requirements.md` |
| `FR-008` | 抽屉以独立列表显示直接子 Task；列表不是第二 DAG且点击行不下降，下降只能使用明确入口。 | AC-004 core | `requirements.md` |
| `FR-009` | 进入子任务视图整体替换 DAG、清空选择且不自动选首项；无子项时入口禁用并说明原因。 | AC-004 core | `requirements.md` |
| `FR-010` | 面包屑表达从项目根到当前父级的完整祖先链；返回/祖先导航恢复每层筛选、视口和滚动且无选择。 | AC-004 core | `requirements.md` |
| `FR-011` | URL 表达项目、父级和可选选择；刷新与前进/后退恢复导航但不重放写入，并保持 `/` 与 prototype 兼容。 | AC-005 core | `requirements.md` |
| `FR-012` | 服务端提供项目内 Task Key 精确/前缀与标题不区分大小写包含搜索，并返回项目、生命周期和完整祖先事实。 | AC-006、AC-024 core | `requirements.md` |
| `FR-013` | 搜索跳转保存并可恢复完整前位置；无结果、陈旧、删除或无权目标提供不泄露跨项目信息的恢复路径。 | AC-006 core | `requirements.md` |
| `FR-014` | Owner、逻辑角色、有效状态、截止时间和标签按 AND 过滤当前层；隐藏选择会关闭抽屉，清除筛选恢复节点。 | AC-007 core | `requirements.md` |
| `FR-015` | normal/sprint/milestone 使用非纯色差异表达，但复用相同的数据、权限、导航和操作语义。 | AC-009 core | `requirements.md` |
| `FR-016` | 活动 DAG 与归档历史分离；历史 Task、依赖、评论和活动只读且不参与活动计算。 | AC-008 core | `requirements.md` |
| `FR-017` | 当前层稳定分页/增量加载并按 Task Key 排序；200 节点完整交互，超过 200 仍可经分页、搜索或筛选访问。 | AC-022、AC-023、AC-027 supplemental | `requirements.md` |
| `FR-018` | 可在项目根创建顶层 Task、在有权 Task 下创建子 Task；正确处理显式/继承 Owner、稳定幂等和不可复用 Task Key。 | AC-010、AC-019 core | `requirements.md` |
| `FR-019` | 按当前 `actions` 编辑未完成 Task 字段并携带 Task 版本；拒绝时草稿不得伪装成已提交事实。 | AC-010、AC-019 core | `requirements.md` |
| `FR-020` | Owner 变化先展示服务端完整 Task/后代/Workspace/租约/未提交状态影响；未知本地状态阻止提交，旧影响漂移失效。 | AC-011 core | `requirements.md` |
| `FR-021` | 当前层依赖增删明确表达方向和 graph version；request_required 只显示待处理请求，不显示为已生效边。 | AC-012 core | `requirements.md` |
| `FR-022` | 依赖请求可接受/拒绝并稳定显示 expired/stale 与恢复建议；不得自动重放旧确认。 | AC-012 core | `requirements.md` |
| `FR-023` | 有效 Owner/Admin Mode 可维护同项目一跳关注；先展示影响，并明确关注不扩权、不递归、不参与完成。 | AC-013 core | `requirements.md` |
| `FR-024` | 有效 Owner/Admin Mode 可添加/解决人工 blocker；界面区分人工 blocker、predecessor blocked 和基础状态。 | AC-013 core | `requirements.md` |
| `FR-025` | 基础状态和显式完成遵守 `completion_ready`、Task/Graph/Workspace 版本、租约与显式安全回答；UI 不自动完成或处理 Workspace 冲突。 | AC-014、AC-019 core | `requirements.md` |
| `FR-026` | 完成 Task 冻结呈现；评论、显式重开和顶层归档按服务端允许操作保留；重开遵守 deny/cascade 与跨 Owner Admin Mode。 | AC-014 core | `requirements.md` |
| `FR-027` | 移动先展示源/目标、依赖、后代、Owner、完成祖先和双图版本影响；拖放视觉不能替代服务端提交。 | AC-015 core | `requirements.md` |
| `FR-028` | 顶层归档和非顶层删除先展示完整影响；删除精确输入 Task Key且无回收站/撤销，成功后不得残留可编辑幽灵节点。 | AC-015 core | `requirements.md` |
| `FR-029` | 活动成员发布安全 Markdown 评论并选择已有 Workspace 文件；本人编辑/删除、完成后追加不可变和 Admin 隐藏遵守 `actions`。 | AC-016 core | `requirements.md` |
| `FR-030` | 人类 Session 可读取 Task 当前 Workspace 清单和附件内容；逐次重验权限、版本、路径、哈希与对象，不提供写入口或设备/租约秘密。 | AC-016、AC-021、AC-024 core | `requirements.md` |
| `FR-031` | 抽屉提供稳定游标 Task 活动；活动不可改写且不取代审计或业务权威。 | AC-017 core | `requirements.md` |
| `FR-032` | 用户查看跨项目通知、未读/关键状态与偏好，并仅凭当前安全 Key 深链；删除/失权后保留语义而不泄露内容。 | AC-017、AC-021 core | `requirements.md` |
| `FR-033` | 持续呈现当前项目 Admin Mode，只按 `actions` 启用写操作；管理员能力必须显式进入、项目限定且过期立即失效。 | AC-018 core | `requirements.md` |
| `FR-034` | 写入绑定适用版本、影响令牌和幂等键；同负载重试复用，成功/改负载/新意图换键，stale/conflict 保留草稿并重新确认。 | AC-019 core | `requirements.md` |
| `FR-035` | Task/图/评论/活动/通知/成员/角色/项目/Admin Mode SSE 只触发相关权威 refetch；不覆盖草稿或重放写入。 | AC-020 core | `requirements.md` |
| `FR-036` | 所有用户文本、Markdown、URL、路径和文件名按不可信输入处理；URL、日志、错误、SSE 与 UI 不泄露秘密或跨项目标识。 | AC-021 core | `requirements.md` |
| `FR-037` | 完成界面说明 M2 冻结事实与 M6 摘要/Wiki 边界；M3 不伪造摘要、不调用模型、不把缺少摘要显示为完成失败。 | AC-014、AC-025 core | `requirements.md` |
| `FR-038` | 搜索、祖先、筛选和附件读取位于 `/api/v1`，使用 TypeBox/OpenAPI 和既有 Session/项目/Task 授权，不开放 actor/admin 伪造。 | AC-021、AC-024 core | `requirements.md` |
| `FR-039` | 不新增第二份 Task/图/评论/通知/权限事实；URL/缓存只保存交互状态，索引/投影必须可重建并保留历史与版本。 | AC-019、AC-020、AC-024 core | `requirements.md` |
| `FR-040` | 精确 prototype 入口继续隔离且不访问生产 Task API；生产页面不导入原型夹具，只可复用消费正式输入的纯布局代码。 | AC-005、AC-025 core | `requirements.md` |

## 3. 当前流程

1. 用户在已认证 shell 选择有权项目并进入 Task 页面；系统从虚拟项目根读取当前 scope，初始无选择。
2. 用户选择 DAG 节点打开详情；同层切换只替换抽屉，专用“进入子任务视图”才下降，面包屑/返回恢复每层快照。
3. 搜索由服务端返回目标和完整祖先链；跳转前保存页面位置，返回时恢复原 scope、筛选、视口、选择与抽屉。
4. 普通写入按服务端 `actions` 呈现，提交携带版本和幂等键；成功后精确失效/refetch。
5. Owner、关注、完成/重开、移动、归档/删除等高影响操作先获取服务端影响，确认同一事实、版本和安全语义后提交。
6. 评论附件只引用当前有权 Workspace 清单项；打开时再次认证并经短生命周期 Blob URL 呈现。
7. SSE 只使相关 query 失效；草稿前态变化时标记冲突，旧预览失效，不自动覆盖或提交。
8. 登出、切项目、Membership 失效或 Admin Mode 过期会清除对应缓存和能力。

## 4. 当前数据、接口与状态

- 正式 Schema profile 为 version `3`，迁移 inventory 为 10，latest `0010-m3-task-ui-history-compatibility`。该迁移保留完成/重开和 Workspace transition 历史，同时允许符合 M2 规则的已重开非顶层 Task 删除。
- Task、Graph、Owner、Workspace、评论、活动、通知、审计和 Outbox 继续由 M2 服务端事实权威维护；M3 只增加可重建查询和客户端交互状态。
- 新增或扩展的公共读取包括项目 Task 搜索、单 Task 完整祖先链、Task Workspace 当前文件清单和认证附件二进制内容；全部进入 TypeBox/OpenAPI 3.1。
- 通知资源显式携带 nullable `projectKey`/`taskKey`。只有接收者仍为活动成员且目标仍存在时提供导航 Key；Web 不从历史 `resourceRefs` 推断可导航目标。
- URL/History 只保存项目、父级、选中 Task、生命周期、搜索前位置和每层交互快照；不保存 Session、Cookie、Admin Mode ID、幂等键、对象密钥或草稿正文。
- 前端 query key 至少按 user、project、scope、Task、location、search、children、comments、activity 和 notifications 分区；SSE 和写成功只失效适用前缀。

## 5. 当前异常、边界、安全与恢复

- 非认证、非成员、跨项目、已删除或无权资源统一 fail closed；错误提供稳定机器码、request ID 和恢复建议，不退化为未诊断 500。
- DAG 数据在布局前验证节点唯一性、scope/parent、边端点、自环和环；不完整数据不渲染为可信关系。
- 路径必须是清单内规范化相对路径；Workspace version/manifest/hash 在对象读取前后重验，对象哈希和大小不一致拒绝。
- Markdown 与所有用户文本以安全文本/受限呈现处理，不执行任意 HTML、脚本或危险 URL。
- 完成安全回答不得预填；未知本地未提交状态、活动写租约、版本或影响漂移阻止提交。
- 删除必须精确匹配完整 Task Key；归档不承诺恢复，删除没有回收站。生产迁移前仍需一致备份，失败后 roll forward 或恢复迁移前备份。
- 页面刷新、浏览器 History、搜索返回、SSE refetch 和并发错误均有明确恢复路径，不重放写入或旧确认。

## 6. 当前非功能要求

- Node.js 24、pnpm 11、PostgreSQL 17；format/lint/build/typecheck/test、重复迁移、OpenAPI、根 CI 和适用六服务发布门禁必须通过。
- 单项目 5,000 活动 Task、深度 20、单 scope 200 节点和超过一页的节点保持可访问；200 不是硬限制。
- 列表/详情 P95 < 500 ms，创建/更新/200 DAG P95 < 800 ms；暖缓存 TTI < 2 秒，数据返回后主要 UI 交互 P95 < 100 ms。
- 中文桌面至少 1280×720；键盘、可见焦点、屏幕阅读器关系文字、图标/文字/边框等非纯色表达和窄屏安全降级适用。
- 服务端不调用外部 API、AI 或 LLM，不把项目、Task、评论、通知或 Workspace 内容发往外部服务。
- 参考发布必须使用唯一隔离资源，验证后精确清理且不影响服务器原有服务。

## 7. 当前验收要求

| 当前编号 | 层级 | 当前生效验收 | 结果 |
| --- | --- | --- | --- |
| `AC-001` | core | 认证活动成员进入正式 Task UI；未登录/非成员/跨项目拒绝，M1 页面兼容。 | passed |
| `AC-002` | core | 项目根/普通父级只显示直接活动子 Task 的单 DAG，节点、孤立节点、scope 和边方向正确。 | passed |
| `AC-003` | core | 新 scope 无选择；抽屉选择/切换/关闭/Escape 和焦点返回正确。 | passed |
| `AC-004` | core | 直接子项非第二 DAG；专用下降、返回、面包屑在深度 20 稳定恢复每层状态。 | passed |
| `AC-005` | core | 深链刷新与前进/后退恢复导航且不重放写入，`/` 与 prototype 不回归。 | passed |
| `AC-006` | core | 5,000 Task 搜索定位深层目标并恢复搜索前位置；无权/删除/陈旧不泄露。 | passed |
| `AC-007` | core | 当前层 AND 筛选、两端可见边、隐藏关系提示和选择清理正确。 | passed |
| `AC-008` | core | 活动 DAG 与归档历史分离，历史事实只读且不参与活动计算。 | passed |
| `AC-009` | core | 展示类型、中文、键盘、焦点、关系文字和非颜色表达覆盖主要流程。 | passed |
| `AC-010` | core | 顶层/子 Task 创建、Owner、幂等/Key 和版本化字段编辑正确。 | passed |
| `AC-011` | core | Owner 完整影响、回落来源、本地安全前态和漂移保护正确。 | passed |
| `AC-012` | core | 依赖方向/图版本、直接/请求模式、接受/拒绝/过期/stale 和负向拒绝正确。 | passed |
| `AC-013` | core | 关注、人工/派生 blocker、基础状态和低层授权不可绕过。 | passed |
| `AC-014` | core | 完成/冻结/重开/Admin Mode/Workspace 安全确认与 M2 一致，M6 边界准确。 | passed |
| `AC-015` | core | 移动/归档/删除影响、双图版本、完整 Key 和无幽灵/部分删除正确。 | passed |
| `AC-016` | core | 评论、附件、作者生命周期、追加不可变和 Admin 隐藏符合 actions 且不泄密。 | passed |
| `AC-017` | core | 活动分页、通知偏好/已读/安全导航和删除/失权降级正确。 | passed |
| `AC-018` | core | 普通/Owner/Project Owner/Admin Mode 权限与显式项目限定正确。 | passed |
| `AC-019` | core | 版本、影响、幂等、stale/conflict 草稿恢复和原子前/后态正确。 | passed |
| `AC-020` | core | SSE 只 refetch、不覆盖草稿/重放写入，登出/切用户/失权清缓存。 | passed |
| `AC-021` | core | Session/项目/Task 重授权、不可信输入和秘密/租户隔离正确。 | passed |
| `AC-022` | core | 参考列表/详情/写入/200 DAG 与浏览器主要交互满足 P95。 | passed |
| `AC-023` | core | 5,000、深度 20、分页 scope 和超过 200 可访问且无硬限制。 | passed |
| `AC-024` | core | 新 `/api/v1`/OpenAPI 与 `0010` 前向、非破坏、重复安全且 M2 兼容。 | passed |
| `AC-025` | core | 生产契约/prototype 隔离，M1/M2/Worker/SSE/CLI/发布栈兼容。 | passed |
| `AC-026` | supplemental | 目标 Chromium 与窄屏安全降级提供附加兼容置信度。 | passed |
| `AC-027` | supplemental | 5,000 项目与分页范围证明超过 200 仍可访问且关系正确。 | passed |
| `AC-028` | supplemental | 自动化、可视浏览器、远端 P95、关系文字和发布诊断提供附加证据。 | passed |

## 8. 当前决策

| 决策项 | 当前结论 | 来源 |
| --- | --- | --- |
| 交付与验证策略 | `relaxed`；全部 core/hard gate 阻塞，仅独立证明无影响的 supplemental 异常可 report-only | 用户确认 / `requirements.md` |
| 操作范围 | 覆盖 M2 全部人类 Session Task、评论、活动和通知操作 | 用户确认 / `requirements.md` |
| 层级交互 | 单 scope DAG、右侧非模态详情、抽屉内专用下降；子项列表行不下降 | 用户确认 / `requirements.md` |
| 路由 | 使用浏览器 History API 与受限查询参数，不新增路由依赖 | `implementation-plan.md` |
| Markdown | 安全文本/受限呈现，不允许任意 HTML 或危险 URL | `implementation-plan.md` |
| 数据迁移 | `0010` 只解除完成历史对活动 Task 删除的外键阻断并保留不可变历史 | `implementation-plan.md` revision 3 |
| Workspace | M3 只读当前清单和附件；同步、上传、租约写入与冲突选择属于 M4 | `requirements.md` |
| 摘要/Wiki | M3 沿用 M2 完成冻结，不伪造摘要或调用模型；扩展属于 M6 | `requirements.md` |

## 9. 已替换或退役项目

当前没有因 change-0 被删除或替换的生效需求。路线图 revision 3 只修复已确认 M2 删除语义的 Schema 兼容缺口，没有退役产品行为。

## 10. 来源链

1. 原始产品权威：[`requirements.md`](requirements.md)，需求指纹 `345e209c7902568717a7f0950257a6ec095ca0bceda409a6ca6289bde9f1cb3b`。
2. 工作流合同：[`workflow-contract.md`](workflow-contract.md)，schema 3.2。
3. 初始路线图：[`implementation-plan.md`](implementation-plan.md)，revision 3。
4. P-001：[`phase-001-plan.md`](execution/initial/phase-001-plan.md) 与不可变 [`phase-001-result.md`](execution/initial/phase-001-result.md)。
5. P-002：[`phase-002-plan.md`](execution/initial/phase-002-plan.md) revision 3 与不可变 [`phase-002-result.md`](execution/initial/phase-002-result.md)。
6. 参考验证：[`validation/reference-server-2026-07-31.md`](validation/reference-server-2026-07-31.md)。
7. 首次实现记录：[`change-0.md`](change-0.md)；后续 M3 变化必须从 `change-1` 连续推进。

当前没有开放 `FND-*`、unresolved question 或 blocked gate。M3 initial 记录已冻结。
