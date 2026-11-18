# T02 · BFF 端点清单对账（PRD 附录 A × 盘码 @ cc6ea4b7 现查）

现查方法：`grep -o '"/api/[a-z-]*"' apps/console/server.py | sort -u`（m0-d 树 @ origin/main cc6ea4b7），
与 apps/console/BFF-ROUTE-MATRIX.md（盘上，9a0bc3f 版）逐行对照 PRD v4 附录 A 数据源列。
pytest 基线：`321 passed in 8.41s`（cd apps/console && uv run --no-project --with pytest python -m pytest tests -q，2026-11-18 夜）。

## 已满足（路由→上游，盘码在）
| PRD 数据源 | BFF | 上游 | 备注 |
|---|---|---|---|
| employees / matrix | /api/employees, /api/matrix | DOMAIN /v1/employees, /v1/matrix/employees | limit/cursor 透传 |
| run-stats / run-activity | /api/run-stats, /api/run-activity | RUNTIME /v1/runs/stats, /activity | |
| budget-usage | /api/budget-usage | DOMAIN POST→GET-only 代理 | required employeeId,period |
| approval-stats / approvals / approval | /api/approval-stats, /api/approvals, /api/approval | DOMAIN | assignee 身份注入 |
| tasks / task-detail | /api/tasks, /api/task-detail | DOMAIN | /api/tasks require_any(assignee,status)；**PRD 行25 tasks?employee= 应改用 assignee= 或 employeeId 口径由页面侧适配（现查 passthrough 无 employee）** |
| runs / run-detail / run-events | /api/runs, /api/run-detail, /api/run-events | RUNTIME | runs 透传 employeeId（PRD 行26 ?employee= 同口径差异，注明） |
| audit / audit-detail / audit-verify | /api/audit*, /api/audit-verify | DOMAIN | require_any 七选一 |
| hermes-usage / hermes-summary | /api/hermes-usage, /api/hermes-summary | RUNTIME | P0-14 |
| skills | /api/skills, /api/skills/<id> | DOMAIN | 单段校验 |
| sessions(员工详情区) | /api/console-sessions, /api/console-sessions/<id> | RUNTIME /v1/console-sessions | L2 形状；部署代次复验留 QA |
| 委托（盘上超 PRD） | /api/delegations, /api/delegations/<id>/chain + 写侧 | DOMAIN | TASK6/7 |
| 技能提案 | /api/skill-proposals(+approve/reject 写) | DOMAIN | TASK8，上游 not auto-mounted 诚实转发 |

## 缺口（PRD 引用但 BFF 盘码无路由 → 页面按 GAP 诚实降级，不得造数）
| # | PRD 行 | 需要的数据源 | 现状 | 归属/处置 |
|---|---|---|---|---|
| G1 | 9-11 identity people/departments/roles | 毕升 /api/v1/user/*、department、role/* | BFF 无毕升代理（BISHENG_BASE 变量在盘 L138，但无 PROXY 路由）| GAP-02 端点核验归 L1；核验通过后 D/L7 补代理 |
| G2 | 12-13 knowledge spaces/sources | 无 HTTP 端点 | GAP-03（契约未建） | 页面诚实空态+申请入口 |
| G3 | 16 capabilities/tools | Hermes /api/mcp/servers | BFF 无 /api/mcp（Hermes 面 9119 不在 BFF 转发拓扑） | 待 L0 裁定：BFF 加 Hermes base 代理或页面直连 /hermes/api/*（同源经 Caddy 已可达） |
| G4 | 17 capabilities/models | /api/model/options + pricing | BFF 无 | 同 G3（Hermes 面） |
| G5 | 18 capabilities/channels | Hermes /api/platforms | BFF 无 | 同 G3 |
| G6 | 20 system/defaults | /api/config schema (SET-01 投影) | BFF 无 /api/config | SET-01 归属；未落地项显式「未启用」 |
| G7 | 21 system/version | 构建注入 | 非 BFF 面 | T32 构建注入（A 车道） |
| G8 | T40 chat 宿主 | /api/sessions（create-or-find profile 语义） | **主仓 origin/main 无 /api/sessions**；该代理在未提交的在途工作（seakoi-agent-os @308a5f1b 工作区 M server.py +167，含 HERMES_BASE/_hermes_session_token/_hermes_profile_create + test_bff_sessions.py），归属交 L0 核验（R2 interim） | 在途工作合入前，chat 宿主按 GAP 降级或直连 /hermes/api/sessions（需 dashboard 登录态） |
| G9 | 26 runs?employee= / 25 tasks?employee= | 参数名口径 | BFF 透传名=employeeId（runs）/assignee（tasks） | 页面声明 URL 时用 BFF 真名，usePaneData 文档注明 |

## usePaneData 契约（T02 交付判据「任一页接入只需声明 URL」）
- `usePaneData<T>({ url, params?, retryOn? }) → { state: 'loading'|'empty'|'error'|'ready', data, error:{ message, requestId }, retry() }`
- 请求号透传：读响应头 X-Console-Request-Id，error 态上屏「人话+请求号」（DoD 2）。
- 失败重试一次：仅网络/5xx 自动重试 1 次；4xx 不重试（BFF 门序拒绝即终局）。
- 四态：loading/empty(带原因)/error(消息+请求号)/ready；?state= 强制复现由 T03(A) fixture 门配合。
- 位置：web/src/lib/usePaneData.ts（写域例外仅此一文件）。
