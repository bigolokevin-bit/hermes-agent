# R-OBS-ANON-AUDIT — 匿名面 `#/audit` console error 归因（只读取证）

日期 2026-11-21 ｜ 车道 `lane/console-ui-qa` ｜ 方式 只读（不改产品码、不改协议、不重启服务）
派单：现网基址 `http://100.117.184.117:8183`（**不是** 127.0.0.1），**匿名面**（不传 auth-state / 清登录态）打开 `#/audit`，抓 `console.error` 原文与首个错误来源（请求 URL + HTTP 状态），判定三选一：ENV（401/403/404 且 URL 属 `/api/`）/ 产品（`web/src/modules/audit/**` 代码抛错）/ 上游其它。

---

## 1. 命令

```bash
# 脚本：/private/var/folders/2b/bnpsyz450pn98w375q_803yw0000gn/T/opencode/anon-audit-ce.mjs
# 关键口径：与 docs/_artifacts/tonight/shots.mjs:255 同一正则，不注入手写 Cookie、不传 storageState
#   const ENV_NOISE_RE = /\b(401|404)\s*\((Unauthorized|Not Found)\)/;
# 采样矩阵：路由 [#/audit, #/overview(对照)] × 视口 [1440x900, 375x812] × 重复 2 次
#   每个组合新建 context（全新匿名会话），goto domcontentloaded → 150ms 稳定轮询 → 尾等 2000ms
cd /private/var/folders/2b/bnpsyz450pn98w375q_803yw0000gn/T/opencode
node anon-audit-ce.mjs > anon-audit.out 2> anon-audit.err      # rc=0，stderr 空，8 行 JSON
# 追加：错误态落地取证（同脚本目录，rc=0）
node anon-error-states.mjs > anon-error-states.out 2> anon-error-states.err
```

## 2. 原始输出（逐字）

### 2.1 匿名面 `#/audit`，1440x900，rep1

```json
{"vp":"1440x900","route":"#/audit","rep":1,"http":200,"anonCookies":true,"productCE":0,"envNoiseCE":1,"totalEvents":2,
 "events":[
  {"kind":"console","msg":"Failed to load resource: the server responded with a status of 401 (Unauthorized)","url":"http://100.117.184.117:8183/auth/whoami","line":0,"col":0},
  {"kind":"console","msg":"Failed to load resource: the server responded with a status of 401 (Unauthorized)","url":"http://100.117.184.117:8183/agent-api/api/audit?limit=50&from=2026-11-13T23%3A47%3A04.855Z&to=2026-11-20T23%3A47%3A04.855Z","line":0,"col":0}],
 "envNoiseUnique":["Failed to load resource: the server responded with a status of 401 (Unauthorized)"],
 "badStatus":[{"status":401,"url":"http://100.117.184.117:8183/auth/whoami"},
              {"status":401,"url":"http://100.117.184.117:8183/agent-api/api/audit?limit=50&from=...&to=..."}],
 "failed":[],"entry":"index-6g0IMx1G.js","href":"http://100.117.184.117:8183/system?tab=events","chars":809,
 "headText":"... 审计事件 审计事件读取失败 时间为北京时间 导出 CSV 完整性校验 刷新 导出当前筛选 CSV 将导出 0 条"}
```

### 2.2 四次匿名 `#/audit` 采样汇总（两视口 × 两遍，全部同构）

| vp | rep | http | productCE | envNoiseCE | pageerror | requestfailed | 错误原文（唯一） | 首个来源 URL → 状态 |
|---|---|---|---|---|---|---|---|---|
| 1440x900 | 1 | 200 | **0** | 1 | 0 | 0 | `Failed to load resource: the server responded with a status of 401 (Unauthorized)` | `/auth/whoami` → 401 |
| 1440x900 | 2 | 200 | **0** | 1 | 0 | 0 | 同上 | `/auth/whoami` → 401；次条 `/agent-api/api/audit?limit=50&from=…&to=…` → 401 |
| 375x812 | 1 | 200 | **0** | 1 | 0 | 0 | 同上 | `/auth/whoami` → 401；次条 `/agent-api/api/audit?...` → 401 |
| 375x812 | 2 | 200 | **0** | 1 | 0 | 0 | 同上 | 同上 |

对照路由匿名 `#/overview`：两视口两遍均 `http=200 productCE=0 envNoiseCE=1`，同一句 401 原文，来源分别是 `/auth/whoami` 与 `/agent-api/api/{employee-stats, workbench/summary, workbench/timeseries, workbench/queue, run-activity, employees, runs, tasks}`（每次 11 条）。即**匿名面上 401 是全路由通用现象，不是 `#/audit` 特有**。

页面本身正常渲染（`http=200`，`chars` 809/810，无白屏），并显示会话过期横幅与「审计事件读取失败 / 将导出 0 条」。

### 2.3 顺带取证：匿名面天然露出错误态（上拍「未取证」项结案）

```json
{"route":"#/approvals","product":0,"apvError":{"gap":"8px","pad":"24px 16px","h":209,
  "text":"审批申请没能加载出来 登录状态已经失效，请刷新页面重新登录后再看。 请求编号： 8eb27a66c49a481183cc0dddc7c30f40 复制 详情 重试"},
 "anyErrorTestid":["apv-state","apr5-error","apv-state-error","apv-state-rid","apr5-error-details","apv-state-retry","apr5-detail-empty"]}
```

```json
{"route":"#/audit","product":0,
 "anyErrorTestid":["aud8-state-line","aud01-error","audF-state-list-error","aud01-error-sentence","aud01-error-request-id","aud01-error-request-id-value","aud01-error-details"],
 "bodyHas":["会话已过期:1","重新登录:3","读取失败:1","不可用:0","请求编号:1"]}
{"route":"#/knowledge","product":0,"anyErrorTestid":["knN-state-doc-search","knN-error-doc-search","knN-state-spaces","knN-error-spaces"]}
```

两条附带更正（都影响上一轮记录）：

1. approvals 错误态编排（`7272a979`）**实测已生效**：容器 `gap 8px` + `padding 24px 16px` = `--space-2 / --space-4 / --space-6` 三枚令牌全部落地，文案是操作员话术 + 请求编号 + 复制 + 详情 + 重试。上拍因登录态成功而看不到该节点，判「未取证」，本拍由匿名面补齐为**已上屏**（唯一实底按钮这一点仍未取证：探针抓到的首枚按钮是「复制」，透明底）。
2. audit 侧**没有** `audit-list-load-failed` 这个 testid（登录态与匿名态各测一遍均为 0 命中）；真实 testid 家族是 `aud01-error*` / `audF-state-list-error`。上一轮把该 testid 名当作验收锚点是错的，验收锚点应改为 `aud01-error-sentence` 与 `aud01-error-request-id`。

## 3. 结论（三选一）

**ENV** — 匿名面 `#/audit` 的 console error 全部是网关登录态拒绝：原文 `Failed to load resource: the server responded with a status of 401 (Unauthorized)`，首个来源 `GET http://100.117.184.117:8183/auth/whoami` → HTTP 401，次条 `GET /agent-api/api/audit?limit=50&from=…&to=…` → HTTP 401（`/agent-api/api/*` 属 `/api/` 前缀，符合派单对 ENV 的定义）。**产品**排除：`pageerror` 与 `requestfailed` 均为 0，`productCE=0`（按 shots.mjs 同一正则口径），四页错误态均正常渲染出降级文案而非抛错；且 401 在匿名 `#/overview` 同样成串出现，与 `web/src/modules/audit/**` 无关。**上游其它**也不成立：状态码是网关鉴权层的 401，不是上游业务错误。

**归属**：`ENV / 鉴权层（网关 401，缺登录态）`，非产品缺陷。附带的产品侧观察（不作缺陷立案，只作口径建议）：
- 匿名态页面把「读取失败」渲染成「将导出 0 条」与可点的导出按钮 —— 空数据与鉴权失败两种语义在按钮文案上不区分，操作员可能误读为「真的没有事件」。
- 匿名态 `#/audit` 的实际落地 URL 是 `/system?tab=events`（`#/audit` 会重定向），说明台账里以 `#/audit` 为键统计时，登录态路由名与真实路由名并不同一。

## 4. 与 obs=1 件（`R-OBS1-43d83d65.md`）的关系

同一口径、不同面：obs=1 是**登录态**下 `#/capabilities?tab=channels`，噪声是 4 条网关 **404**（未接入读口）；本件是**匿名面** `#/audit`，噪声是 2 条网关 **401**（缺登录态）。两者产品 console error 均为 0，同判 ENV，互不覆盖：obs=1 的「台账记 1 条 product」仍需按 R-OBS1 文档 §6 的机制解释（不含 401/404 字样的行漏过正则），本件不改变该结论。

## 5. 取证边界

- 原始输出中 `from/to` 时间戳为运行时值（每遍不同），表内以 `…` 省略，逐字全文见 `anon-audit.out`。
- 匿名面 served entry 与本拍取图代次不同（见 review-0057 §8），因此本件**只**用于错误归属与错误态存在性，不用于分数与视觉判定。
- 未做：登录态下人为制造 approvals/audit 失败态的截图（需要改门旗标或断上游，属越界）。
