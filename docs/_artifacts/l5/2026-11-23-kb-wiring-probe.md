# L5 真 KB 接线取证（L0 收回自办，2026-11-23 06:2x，curl 级）

登录态来源：假通道 E2E（launchctl setenv 窗口 06:05-06:08，已撤净）取得的活 token（`$T/e2e-8183-jar-keep.txt`，**本文件不记录任何 token/JWT 值**）。

## 前置断言
- `GET /auth/whoami`（带 token）＝ **200** `{"user_id":3,"tenant_id":null,"granted":false,"display":"Kevin"}`

## 读数（全部同拍亲跑）
| 探针 | 结果 | rid |
|---|---|---|
| `GET 8183 /agent-api/api/knowledge/spaces` | **403** `console.forbidden` 「当前账号未获得控制台访问授权」 | b25a76f1 |
| `GET 8183 /agent-api/api/knowledge/documents?limit=3` | **403** `console.forbidden` | c8d41890 |
| `GET 8183 /agent-api/api/knowledge/search?q=报销&limit=3`（首轮） | 502 `upstream.unreachable`（瞬态） | — |
| 同上复测（换连接） | **403** `console.forbidden`（502 未复现） | d507c213 |
| `GET 9122 直连 knowledge/documents` | **403** `console.forbidden`（与 8183 同） | f1314390 |
| `GET 127.0.0.1:7860/health`（毕升上游） | **200** `{"status":"OK"}` | — |

## 结论（curl 级定论）
1. 真 KB 检索面 **不是未接线，是被 BFF 授权门拦死**：假通道身份（Bisheng user_id=3，`granted=false`）无控制台访问授权 ⇒ 所有 `/agent-api/api/knowledge/**` 统一 403 `console.forbidden`。
2. 毕升上游本身健康（7860/200），502 为瞬态且复测未再现。
3. **`granted:false` 语义就此解开**：whoami `granted=false` ⇔ BFF 对业务端点统一 403（此前 wave-172/179 各台账中"只报读数不自判"的悬案，现以两探针同拍闭环）。
4. 连带口径：w179 复拍 readings 的 `res4xx=10`（employees/workbench/queue/runs/run-activity/tasks/summary/employee-stats/timeseries 全 agent-api 端点）＝ 同一 **403 授权面**，非 401 cookie 早衰、非新增故障面；"console 零新增面"判定按此口径成立（jsErrors=0 不受影响）。

## 真语料端到端的解除路径（二选一，均需上层拍板）
- A. **opsadmin 代登**（既有待批件）→ 授权账号下重跑本取证。
- B. 给 user_id=3（ou_ 假通道身份）授控制台权限 → **安全边界改动，须参谋/用户明文授权**，本车道不推。
