# UX r1 评审 — knowledge 模块（知识空间 / 证据与引用）

- 审：UX 总审（lane/UX-total），r1 轮，2026-11-21
- 被测：http://100.117.184.117:8183 （served entry `assets/index-GXGeT7Wz.js`，取图前后无换代）
- 登录态：opsadmin（ui-qa auth state，有效）
- 口径：治理仓 `docs/product/UX-REVIEW-RUBRIC.md` 10 维 × 0-3；**375 判据按 L0 P0 纠偏新口径执行**（逐元素 boundingRect + 容器级 scrollWidth + 整页截图验证，旧 document 级 overflowX 绿已撤销，见 §6）
- 写域说明：rubric §4 名义路径 `docs/validation/console/ux/` 在本仓不存在，按派单写域落 `docs/_artifacts/ux/**`
- 取图：playwright 1.65.1，双档视口 375（真视口 375×800 + 整页）/1440×2600；脚本 `ux-capture-r1.mjs` / `r1b` / `r1c`，数据 `ux-capture-r1*.summary.json`

## 1. 评分

### 页 A · 知识空间 #/knowledge（列表+检索+详情路径）— **13/30，不得 PASS**

| # | 维度 | 分 | 判词（视口/截图为证） |
|---|---|---|---|
| 1 | 任务可达 | 1 | 主任务（浏览空间/文档、进详情、检索出结果）在本环境全部做不成：`/agent-api/api/knowledge/spaces?limit=20`、`/agent-api/api/documents?limit=50` 均 404（r1b badResponses；环境归因见工单 P0-2）。页面诚实空态+重试/申请出路，未到 0。knowledge-list-1440-r1.png / knowledge-spaces-dom-375-r1b.png |
| 2 | 信息层级 | 1 | 双导航堆叠：外层 shell 3 Tab 之下又嵌内层 4 Tab（knw5-tab-*），同一组对象两套入口；文档读/空间读两个同构大块纵向串联，无从先看哪个。spaces-dom-1440-r1b.png |
| 3 | 决策支持 | 1 | "未接入 或 没有权限"两态混写（KnowledgeModulePage.tsx:2712），用户无法决定重试还是申请；请求编号 32hex 直铺屏×2。 |
| 4 | 状态完整 | 1 | 搜索命中/不命中/无数据三态屏上完全相同，无"没有找到匹配"文案（search-hit2 vs search-miss2，1440 两图除关键词回显外无差异）；详情态因数据空不可达（detail2 点击 knG-row 无 URL/内容变化）。 |
| 5 | 操作经济 | 1 | 同一检索能力重复出现（文档搜+空间搜+内层"检索"Tab 第三入口）；小触点 22 个（含 kn6-search-apply 134×16）。 |
| 6 | 反馈与可恢复 | 2 | 有：URL 回显 ?q=、面包屑"检索「词」"、"清除关键词"出现即反馈、重试/申请/编号复制齐全；缺：无命中专属反馈。 |
| 7 | 密度与留白 | 2 | 375 区块头副题换行、"刷新"孤悬另起一行；1440 下半屏空。拥挤与空洞并存但无截断。 |
| 8 | 文案与术语 | 1 | "读口"工程黑话上屏多处；"清除关键词"(2989) vs "清空"(1251) 同页不一致；"数据源"(外层) vs "数据接入"(内层) 名词漂移。 |
| 9 | 一致性 | 1 | 外层/内层 Tab 语义重复且口径不一；同一 URL 冷深链与点击进入是两个不同页（见页 B P1-1）。 |
| 10 | 可访问与键盘 | 1 | 焦点环 1440 六停靠点全可见（实测 outline，好）；但 375 闭合抽屉 28 个可见幽灵元素参与 Tab 序（r1c leftOut：aside -240、nav、A:运营总览…；r1 focusProbe 375 停靠 2-6 clipped=true）；首焦点=无名 28×28 按钮无 aria 名。 |

### 页 B · 证据与引用 #/knowledge?tab=evidence（点击进入态）— **13/30，不得 PASS**

| # | 维度 | 分 | 判词 |
|---|---|---|---|
| 1 | 任务可达 | 0 | 已登录（侧栏 opsadmin、auth5-display 在场）却报"需要登录，引用读取没有发出"，主任务不可能开始且被误导。knowledge-evidence2-1440-r1b.png |
| 2 | 信息层级 | 2 | 单列：标题+说明+状态卡+页脚只读声明，干净。 |
| 3 | 决策支持 | 0 | 唯一行动"重新检查登录状态"指向错误诊断——用户本来就登录着，绕回原地。 |
| 4 | 状态完整 | 2 | 五态齐（空/错/拒绝/登录/成功，代码+实测；"denied"文案不透露记录存在性，诚实规范）；失分在 login 判定与全局态矛盾、深链态下"暂无引用"文案旁并存 3 根骨架条（deeplink-evidence-1440-r1b.png）。 |
| 5 | 操作经济 | 3 | 一屏一动作，无重复入口。 |
| 6 | 反馈与可恢复 | 2 | "本页没有发送请求，也没有改动任何数据"给了安全反馈；但发送前门禁判定错误，可信度受损。 |
| 7 | 密度与留白 | 2 | 内容约占 15% 屏高，单薄但不杂乱。 |
| 8 | 文案与术语 | 1 | "当前浏览器没有控制台会话"与屏上登录标识直接矛盾。 |
| 9 | 一致性 | 0 | 同一意图两套页：点击→ev5 独立页（无编号、登录态）；冷深链→归一 `?tab=spaces&panel=evidence` 内嵌面板（外层 Tab 仍选中"知识空间"、未接入态、双编号铺屏）。URL 相同内容不同，样式/调试信息密度与知识空间页完全分叉。 |
| 10 | 可访问与键盘 | 1 | 焦点环可见；ev5-refresh 80×28、ev5-login-retry 108×28 低于 44；375 抽屉问题与页 A 同源。 |

**r1 总判：两页均 13/30，多维 ≤1 且存在 P0 → knowledge 模块本轮不得 PASS。**

## 2. 任务路径走查（真实点击，非静态图）

| 路径 | 结果 | 证据 |
|---|---|---|
| 登录→#/knowledge 列表 | 到达；数据块诚实空态，主任务无数据可走 | r1 list-*；r1b spaces-dom-* |
| 文档名搜索（命中词/不存在词）| 表单提交成功、URL+面包屑回显，但命中与否屏面无差异，无结果列表 | r1b search-hit2/search-miss2（settleChars 865 vs 871，探针差异仅编号） |
| 点行进详情 | knG-row 点击后 URL 不变、内容不变（数据空，详情不可达） | r1b detail2（url=/knowledge 未带 ?doc=） |
| shell Tab→证据与引用 | 到达 ev5；已登录却见"需要登录" | r1b evidence2 双档 |
| 证据行点开 | 列表不存在（未发出读取），无 open 控件 | r1b evidence-open2 "no open control" |
| 冷深链 ?tab=evidence | 被归一为 tab=spaces&panel=evidence，渲染内嵌引用面板而非 ev5 | r1c deeplink URL 实测；r1b deeplink-evidence-* 图 |
| 键盘 Tab×6（1440） | 焦点环全程可见；首停靠无名按钮 | r1 focusProbe |
| 键盘 Tab×6（375） | 停靠 2-6 进入屏外闭合抽屉（clipped=true） | r1 focusProbe + r1c leftOut×28 |

## 3. 环境事实（判分前提）

- `/agent-api/api/knowledge/spaces|documents|citations` 全部 404（r1b/r1c 一致复现）→ 该部署 API 未接线；curl 直连 `/api/*` 则落 SPA fallback 返回 index.html（早期 preflight"200"为假阳性，已更正）。
- 知识空间页对 404 的呈现是诚实的（"这块数据没有读到/未接入"+重试+申请），**不判误导**；但任务可达维仍按用户体验封顶。
- 证据页"读取没有发出"是前端门禁（session.ts:9 `window.__HERMES_SESSION_TOKEN__` 未注入）而非 404，属码侧问题（P0-1）。

## 4. 缺陷清单

分级与文件级落点见 `knowledge-r1-tickets.md`。摘要：
- **P0×2**：①登录态矛盾（码侧，session.ts/EvidenceModulePage.tsx:186,342）②API 未接线（环境侧，归 L0 处置，接线后全模块需复验）。
- **P1×6**：深链双页分叉、375 幽灵抽屉可聚焦、搜索三态无差异、双 Tab 堆叠、<44px 触点×22、两态混写文案。
- **P2×5**：读口黑话、清除/清空不一致、hex 铺屏、无名焦点按钮、375 页头孤悬换行。

## 5. 复验要求（r2 唤醒时执行）

1. P0-2 接线后重跑 `ux-capture-r1b.mjs`：须见真实列表/详情/分页，重新评页 A 维 1/3/4/5。
2. P0-1 修复复验：登录态下 ev5 不得出现"需要登录"；静态预览口径若保留 token 门禁，auth5 与门禁必须同源判定。
3. 深链 `#/knowledge?tab=evidence` 冷加载与点击进入渲染同一组件才算关单。

## 6. 375 判据纠偏执行记录（L0 P0 令）

- 旧口径 `document.scrollWidth` 绿（r1/r1b overflowX=0）**撤销**——App 层 overflow-x-hidden 可掩盖裁切，不签绿。
- 新口径 `ux-capture-r1c.mjs` 实测：逐元素 `right>376` 违例 **0**；越界容器仅 `knw5-sr-only`（sw=89/cw=1，屏幕阅读器标准藏法，合规）；`leftOut=28` 全为闭合抽屉 `-240px` 内容（未设 aria-hidden/inert → 另立 P1-2，属可访问问题非视觉裁切）。
- 整页截图：四态 PNG 像素高 1460/1000/1347/1460 均 > 视口 800，`fullPageVerified=true`（方法 viewport-stretch 回退，因内部滚动 SPA fullPage 无效）。图：`shots/knowledge-{landing,evidence-click,deeplink-evidence,search-miss}-375-r1c.png`。
- **新口径下视觉裁切判定为真绿；375 无右溢出缺陷。**
