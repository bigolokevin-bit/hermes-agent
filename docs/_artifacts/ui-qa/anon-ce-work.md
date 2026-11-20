# anon console-error 归因 — `#/work` 与 `#/work?tab=cron`

- 取证时间：2026-11-21 01:02（Asia/Shanghai）
- 对象：现网 `http://100.117.184.117:8183`，**未登录态（匿名，不带任何 cookie）**
- 口径来源：wave-50 报告 `consoleErrorsObservedByShots=2`，路由 `#/work`、`#/work?tab=cron`；auth 面为 0
- 方式：只读取证（headless chromium + `console`/`pageerror`/`response`/`requestfailed` 四路挂钩；未改产品码、未重启服务）
- 原始输出：`/private/var/folders/2b/bnpsyz450pn98w375q_803yw0000gn/T/opencode/anon-ce-work.json`；脚本同目录 `anon-ce-work.cjs`

## 归类结论

**② 上游 / BFF / 网关** —— 全部 console error 是浏览器对 **HTTP 401** 响应自动记录的 `Failed to load resource`，由网关返回，不是产品代码抛出的异常，也不是 shots 脚本自身造成。

关键判据：

- `pageError`（JS 未捕获异常）**两条路由均为 0** → 产品代码没有抛错。
- 每条 console error 的文本都是 `Failed to load resource: the server responded with a status of 401 (Unauthorized)`，`location` 只有 URL、`lineNumber=0`（无脚本行）→ 这是网络层日志，不是 `web/src` 里的 `console.error()` 调用（后者会带文件与行号）。
- `requestFailed` 为 0 → 没有请求发错或脚本拼错 URL；401 是服务端**有意**返回的鉴权拒绝。
- 401 响应体是网关的标准鉴权句，非 SPA 代码：

```json
{"code": "auth.unauthenticated", "rid": "70e33abd", "message": "登录状态缺失或已过期，请重新登录"}
```

- 对照实验（同 URL 同参数，仅换鉴权）三条全部翻绿 → 401 完全由「匿名」这一条件决定：

| 请求 | anon | 带 opsadmin cookie |
|---|---|---|
| `GET /auth/whoami` | **401** | 200 |
| `GET /agent-api/api/matrix` | **401** | 200 |
| `GET /agent-api/api/tasks?status=open&limit=50` | **401** | 200 |

## 原始 error 清单（两条路由各 7 条，与 wave-50 报的 2 条不符，见「口径差异」）

`#/work` 与 `#/work?tab=cron` 返回的 401 集合**完全相同**（仅到达顺序不同），逐条为：

```
Failed to load resource: the server responded with a status of 401 (Unauthorized)
```

| # | 失败请求 URL | HTTP 状态 |
|---|---|---|
| 0 | `http://100.117.184.117:8183/auth/whoami` | 401 |
| 1 | `http://100.117.184.117:8183/agent-api/api/matrix` | 401 |
| 2 | `http://100.117.184.117:8183/agent-api/api/tasks?status=open&limit=50` | 401 |
| 3 | `http://100.117.184.117:8183/agent-api/api/tasks?status=in_progress&limit=50` | 401 |
| 4 | `http://100.117.184.117:8183/agent-api/api/tasks?status=blocked&limit=50` | 401 |
| 5 | `http://100.117.184.117:8183/agent-api/api/tasks?status=done&limit=50` | 401 |
| 6 | `http://100.117.184.117:8183/agent-api/api/tasks?status=cancelled&limit=50` | 401 |

无其它类型 console error（无 `warning`/`error` 级的应用日志、无 React 警告、无未捕获异常）。

## 取证的代次事实（必须记录）

- 本次取证时现网 served entry = **`assets/index-Cc6Mpxjk.js`**，对应磁盘产物 `/Users/kevin_studio/Projects/forks/hermes-agent/hermes_cli/web_dist/assets/index-Cc6Mpxjk.js`，`index.html` 与该 bundle 的 mtime 均为 **2026-11-21 00:56:47**。
- 派单口径给出的 `index-90TH2F6t.js`（代次 dcac5182）**现已 404**，且 01:02 起 8 次连续采样 + 6 条路径采样全部只返回 `Cc6Mpxjk` → 该代次在 00:56:47 被 hermes-agent 主叉的新构建顶掉。
- 因此：本文件的 401 归因对 **Cc6Mpxjk** 成立；由于所有 401 都来自网关鉴权层、与前端构建无关，结论对 dcac5182 同样成立（匿名态下这批请求必然 401）。
- 路由语义：`#/work` = 侧栏「任务与运行」，页面正常渲染任务看板（`任务看板 / 新建任务 / 刷新 / 状态：按看板列展示`），并显示「会话已过期，请重新登录后继续。」横幅 → 降级态表现正确。
- URL 改写事实：`#/work` 与 `#/work?tab=cron` 落地后被前端改写为 `/work?tab=board&view=cron`（hash → query，`tab=cron` 归入 `view`）。

## 口径差异（给 wave-50 obs 的一个修正点）

观测计数 `consoleErrorsObservedByShots=2` **低于实测**：两条路由各 7 条，共 14 条。可能原因是 obs 侧按文本去重（7 条文本完全相同）或只保留首条/每路由一条。**建议按 URL 计数而非按文本计数**，否则 5 个业务端点的扇出量被掩盖。

## 是否算缺陷

**不算产品缺陷**，属预期降级：未登录时后端返回 401、前端渲染过期横幅，行为正确。归到 ② 后不建议开产品缺陷单。

但有一个可改进点（属可选优化，非必须）：匿名态下前端并未先确认会话，而是直接扇出 `/api/tasks` 5 个状态分列 + `/api/matrix` + `/auth/whoami`，浏览器把这 7 条 401 全部记成 console error，污染 shots 的 error 计数。**最小改法**：在会话确认（`/auth/whoami`）返回 401 之前不发业务扇出，或对 401 走同一条「未鉴权」短路并用 `console.warn`/静默处理 —— 效果是匿名 shots 的 `consoleErrors` 归零，auth 面不受影响。该改动涉及请求时序，属产品码范围，本拍未动。
