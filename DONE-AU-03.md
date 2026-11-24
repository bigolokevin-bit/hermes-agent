# DONE-AU-03 — 筛选与时间窗收口（车道 AU-03b）

- 分支 `task/AU-03b-filter-window`，基线现脸 `3e99506726`（merge(audit) AU-02 服务器导出前端消费面并入）。
- 写域：仅 `web/src/modules/audit/**` + 本文件。主仓 / 他模块 / 板仓 docs 零触碰。COVERAGE-MATRIX 更新转办 L0。
- 反幻象：下文每个数字都能指到本会话真实跑出的磁盘原始输出（`evidence/au03b-*`、`/tmp/au03b-*`）。

## 0. 现读现场（开工自查）

- `git status`：开工时工作树干净；`git log --oneline -6` 见 `3e99506726`（AU-02 并入）→ `3705bece79`（AU-01 收口）。
- 「已在面」核对：`git diff --stat 3705bece79 3e99506726 -- web/src/modules/audit` 显示 AU-02 只动 states/AuditEvents 导出线/serverExport/auditGates/DONE-AU-02/新测，**未触及 model.ts / window.ts / retention.ts / filterChips.ts**——本卡四处缺口全是真实剩余，无重做无回退。
- 开工基线（总控钉死，本树复跑对账）：`vitest run src/modules/audit` = **93 文件 / 729 例 / 3 failed**，红恰 `audit.time.window.parity.test.tsx` R229 三枚（预存环境红，禁修禁消）。收工见 §5。

## 1. 接口原文摘要（live 只读，opsadmin cookie @127.0.0.1:8092，值从不打印）

审计读口 `GET /api/audit`，参数 `require_any`（≥1 过滤），400 体点名七个合法过滤：`runId taskId actorId resourceId action from to`。原始采样（`evidence/au03b-samples/`）：

- `?limit=5` 仅窗口（from/to）→ **200**，keys=`events,nextCursor,limit,cursor,hasMore,total,totalSource`；`total=494`。
- `?limit=50`（零过滤）→ **400**（`console.missing_filter`）——require_any 门在盘（`evidence/au03b-samples/nofilter-400.json`）。
- `action` 逐字精确匹配：`task.created`=14 / `approval.denied`=2 / `employee.updated`=1 / `workstation.unbound`=7 / `recognition.unknown`=17 / `channel.event_ingested`=3，每枚 `all_match=true`；下划线形 `task_created`=**0**（证精确匹配）。
- `actorId=employee-api` → **total=275**（全窗，服务端收窄，`all_actor_match=true`）。
- `resourceId=<真编号>` → 命中数收窄（服务端有效，见 §4 偏差注记）。
- dead_letter 九候选参数 `kind/event_type/type/status/category/queue/topic/view/is_dead_letter` 逐个 → **200 且 total=494 不变（全被服务端忽略）**；`action=dead_letter` → **0**。原始体 `evidence/au03b-samples/dl-*.json`。

## 2. AU-03 四步判定

### ① action 枚举同源 —— 差集表

全窗实测 distinct action 码 **21 枚**（`evidence/au03b-enumeration.txt`）；前端下拉集（`model.ts LIVE_ACTION_CODES`）原为 **16 枚**。

| 类别 | 码 |
|---|---|
| 在线上、下拉缺失（本轮补入 5） | `approval.denied` `employee.updated` `workstation.unbound` `recognition.unknown` `channel.event_ingested` |
| 在下拉、线上不存在（伪控件） | **无（0 枚）** |
| 已同源（原有 16） | 其余 16 枚，逐个线上命中 `all_match=true` |

处置：`LIVE_ACTION_CODES` 补入这 5 枚 → 下拉集 == 线上集（21）。标签只给「已在词表里成词」的直接读法：`approval.denied`→驳回审批、`employee.updated`→修改数字员工配置、`workstation.unbound`→解绑工位（`workstation_bound` 绑定工位的字面反义）；`recognition.unknown`/`channel.event_ingested`/`dispatch.event` 主语 token 无批准名，**按自身拼写呈现**（§T33-2 law-3），行显示仍 其他事件。测试 `audit.filter.enum.source.test.ts` 钉：下拉集==观测集、无伪码、标签无重名（消除多枚「其他事件」无法分辨）、下划线码不入选、逐字上线。

### ② dead_letter —— 无端点 ⇒ 入口不存在 + 不造假

- web/src 全域 `grep dead_letter|死信|deadLetter` = 0 命中（界面本无入口）。
- 服务端九参数全忽略、`action=dead_letter`=0（§1）⇒ 本部署审计读口**无服务端 dead_letter 投影**。
- 处置 = 「要么给端点要么撤入口」取**入口不存在**这一支：界面不出现 dead_letter 控件、不发 dead_letter 参数、不把任何 dead_letter 数字当作 total/列表。测试 `audit.deadletter.noentry.test.ts` 钉四条：上线只发白名单七键+limit/cursor（不含九候选）、`listUrl(NO_FILTERS)` 恒 `?limit=50`（require_any 的 400 形，页面从不单发）、下拉不含 dead_letter、读模型不把 dead_letter 数字抬成 total（假 0/假列表皆禁）。截图读数 `deadLetterShown=false`。
- 主仓 domain 侧若要专列 dead_letter，须补只读投影——见 §6 需求单（§8.4 终裁归 L0）。

### ③ retention 过期窗联动 —— 查询前本地拦（N 只取真源）

- 保留读口 404 `console.unknown_route`（`retention.ts` 头注八候选探针，2026-11-19；本卡复核 window.ts/retention.ts 未被 AU-02 改动）。**故本部署取不到 N，整段按未接入处理，绝不硬编码假 7。**
- 真源形制：`expiryVerdict(range, days)`（`retention.ts`）只在 `days` 为正当正数时判定；`days=null` → `unknown`（不拦、不说数）。列表页从**自身读答**里防御式取 `auditRetentionDays`/`retention.{auditDays|days}`（`model.ts auditPageFrom` 新 `retentionDays`，缺即 null，经 `useAuditData` 透传）——这是唯一真源，从不猜。
- 界面（`AuditEventsModulePage.tsx`）：
  - 保留期联动行 `aud03-retention-link` 三态：未接入（无 N，说「不猜一个数、也不拦任何时间窗」，`title=GAP-13`）/ 在期内（报真 N）/ 整段过期（「该时间窗超出保留期（N 天）」）。
  - 点「应用」提交一个整段早于保留线的自定义区间时，**本地拦下**：不写进地址、不发请求，屏上 `aud03-retention-block` 说人话并给保留线（北京时间）。无 N 时同一步**不拦**（不凭猜想去拦）。
  - 测试 `audit.window.retention.expiry.test.ts`（纯：unknown/within/expired/零负NaN天数全记未接、绝不出现 7/30/365/180 猜测数）+ `audit.retention.expiry.page.test.tsx`（真渲染：未接入无天数、有 N 报 N、整段过期出文、有 N 时应用被拦不发请求、无 N 时应用不被拦）。
- `RetentionModulePage.tsx` 补 `ret4-window-link`：把「审计保留 N 天↔列表时间窗本地拦」的同一条真源话，在保留页与列表页两处一致陈述；读不到天数即未接入，不给列表供可编造的数。

### ④ 至少一过滤门 ↔ 前端默认窗口 一致性

- require_any 门在盘（§1：`?limit=50`→400）。
- `window.ts`：`DEFAULT_WINDOW="7d"`，`FILTER_WINDOW_CHOICES` = 24h/7d/30d/custom，**无「不限时间」**；每个快捷档 `windowBounds` 都产出 `from<to`。
- 测试 `audit.window.retention.expiry.test.ts` ④ 段钉：默认档发出必带 `from&to`（require_any 成立）、无「不限时间」、快捷档恒有界；`customBounds` 半填/倒置/空 → null（页面 `enabled=!customInvalid` 据此**不发**，不退化全表扫描）。注：工单口语「默认 24h」现脸默认是 7d（前车道把 24h 挪到 7d 以覆盖真实数据，见 OpenViking 事件记忆 2026-11-19），一致性口径按「默认恒有界带合法过滤」钉，非硬编 24h。

### 另：九筛选逐项服务端成立性

| 筛选维度 | 线上参数 | 服务端成立性 | 界面口径 |
|---|---|---|---|
| 时间窗快捷档 | from,to | 服务端整窗过滤（§1 逐档命中） | 服务端 |
| 自定义区间 | from,to | 服务端整窗过滤（400 拒倒置） | 服务端 |
| 事件类型 | action | 服务端精确匹配（21 码逐枚证） | 服务端 |
| 操作者 | actorId | 服务端整窗过滤（=275 证） | 服务端（句柄，GAP-06 目录未接） |
| 资源 | resourceId | 服务端有值（本卡实测收窄），但页面保守 | 「已按编号本地筛（只在本页已加载记录里）」——见 §4 偏差 |
| 每页条数 | limit | 服务端参数 | — |
| 游标/页码 | cursor | 服务端游标 | — |
| 排序 | — | 服务端无可用排序参 | 「仅在当前已加载 N 条内排序」（本地，已如实标） |
| 完整性校验 | from,to | 独立读口 audit-verify | — |

结论：**无「本地筛冒充服务端筛」**——本地维度（排序、资源页面再筛）均已按 AP-07 形制标「已加载行内」。

## 3. 变更文件（仅写域）

- `model.ts`：`LIVE_ACTION_CODES` 16→21、`ACTION_LABEL` 加 `workstation_unbound`、`eventTypeChoices()` 未映射码按自身拼写呈现、`auditPageFrom` 新 `retentionDays`（防御式）。
- `useAuditData.ts`：`ListState/ListApi` 透传 `retentionDays`（缺即 null，分页保持）。
- `retention.ts`：新增纯 `expiryVerdict` + 类型（unknown/within/expired，无默认 N）。
- `AuditEventsModulePage.tsx`：`RetentionLinkLine` 三态 + 应用期本地拦（仅当真有 N）。
- `RetentionModulePage.tsx`：`ret4-window-link` 时间窗↔保留天数一致陈述。
- `api.test.ts`：唯一受影响断言（下拉里 `dispatch.event` 标签由「其他事件」改为其自身拼写）。
- 新增测试：`audit.filter.enum.source.test.ts`、`audit.deadletter.noentry.test.ts`、`audit.window.retention.expiry.test.ts`、`audit.retention.expiry.page.test.tsx`（+26 例）。

## 4. 偏差清单

1. **dead_letter 入口「不存在」**（非「撤除」）：界面本无该控件，本轮以测试钉死「永不出现/不发参数/不造假列表」，非删除既有 UI。主仓补只读投影是 domain 侧事（§6）。
2. **资源 resourceId**：本卡实测服务端**能**按 resourceId 收窄（494→命中数），但页面既有「未单独实测/本地再筛」保守措辞**保持不动**（改动牵动 ~7 测试文件，越出 AU-03 剩余范围；且它是「服务端却少报」方向，不违反「本地冒充服务端」禁令）。**内联本地匹配仍在**，不算清偿为纯服务端——台账请记「服务端已生效，界面仍显保守本地口径」，收口归 L0/AU-06。
3. **默认窗口=7d 非 24h**：工单口语「默认 24h」与现脸不符；一致性按「默认恒有界带合法过滤」钉。
4. **`eventTypeChoices` 行为改**：未映射 live 码的下拉标签从共享「其他事件」改为各码自身拼写（与其函数自述「offered under its own spelling」一致，且消除多枚「其他事件」无法分辨）。仅 `api.test.ts:98` 一枚既有断言随之更新；行显示 `actionView` 未动（R31 不破）。

## 5. 门禁原始 stdout（`evidence/au03b-gates.log`）

```
[G1] vitest run src/modules/audit      : 97 文件 / 755 例 / 3 failed（R229 三枚，零新增红）
[G2] vitest run src（全量）             : 549 文件 / 4235 例 / 4 failed = R229 三枚 + e1Contract 一枚
[G3] vite build                          : exit 0（✓ built in 5.80s）— 禁 pnpm run build 遵守
[G4] node scripts/lint-fake-success.mjs : violations: [] ok: true（未接入=22 规划中=188 不会保存=1）
[G5] tsc --noEmit -p tsconfig.app.json  : 全仓 49 错（=基线），modules/audit 0 错（delta 0）
```

**e1Contract（唯一额外红，环境漂移，单列禁消解）**：`src/shell/e1Contract.test.ts` 断言 served entry ≠ disk entry —— served `assets/index-CtA6doEj.js`（部署 9122 现供包）vs disk `assets/index-Ck4Yem7y.js`（本 worktree 本拍 `vite build` 产物）。非产品红，不消解。

收工对账：基线 93/729 → 收工 97/755，**总例数只增（+26）**、红恰 R229 三枚零新增（全量额外一枚为 e1Contract 环境红，属工单唯一豁免项）。

## 6. 主仓需求单 + 转办

- **需求单（domain 只读投影，§8.4 终裁归 L0）**：`seakoi-agent-os` `services/domain/audit_query.py`（或审计读服务）若需专列 dead_letter 视图，应新增**只读**投影（如 `?kind=dead_letter` 或独立 `dead_letter` 读端点），使 `require_any` 语义下 dead_letter 成为真过滤；可粘本卡 curl 原始证据（`evidence/au03b-samples/dl-*.json`，九参数全 200/total=494 不变；`action=dead_letter`=0；零过滤=400）。**前端保持入口不存在，直至后端给出真端点。**
- **保留期真源**：审计读答（`/api/audit`）或保留读口若开始返回 `auditRetentionDays`（或接通 `/api/retention` 404→200），前端过期窗本地拦即**自动生效**，无需再改代码（防御式读取已就位）。
- **COVERAGE-MATRIX 转办 L0**：`docs/product/CONSOLE-COVERAGE-MATRIX.md` L23「dead_letter 无端点」行 → 建议更新为「前端无入口（诚实态）；后端投影 = 待 domain 需求单」，死信端点存续由 L0 定。本卡不改板仓 docs。

## 7. 截图（真渲染，禁 stub）

配方：本 worktree `vite build` 产物 + 临时 `au03b-proxy`(9427，反代 /agent-api→8092、/auth→9122) + opsadmin 真登录腿；`domcontentloaded` + settle≥2s（无 networkidle）；每图前 `whoami==200`。代理按端口 PID(95707) 精杀，token 只从文件读从不打印、无落盘 jar。

- `evidence/au03b-1440.png`（197893 B）：`?window=7d&type=workstation.unbound`。读数：whoami=200 user=opsadmin；`action=workstation.unbound` 上线→200；chip=`动作类型：workstation.unbound（服务端按 action 精确匹配）`；`aud03-retention-link` state=unwired（未接入文，无假天数）；`dead_letter/死信`=无；横向溢出=0；状态行「这个筛选条件里没有审计事件」（7d 窗内该码无记录，200 有界读，诚实空态）。
- `evidence/au03b-375.png`（90751 B）：同面 375 档，横向溢出=**0**，其余同上。
