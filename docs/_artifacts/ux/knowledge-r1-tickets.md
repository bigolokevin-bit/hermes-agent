# UX r1 缺陷工单 — knowledge（供 L0 派实现车道；UX 总审不改码）

环境：http://100.117.184.117:8183 entry `index-GXGeT7Wz.js`；账号 opsadmin（cookie 会话有效）。
每条含复现步骤与截图；文件级落点为建议，最终以实现车道核对为准。

## P0

### UX-R1-P0-1 已登录用户在"证据与引用"看到"需要登录"（误导+主任务不可达）
- 复现：登录控制台 → 侧栏显示 opsadmin → 点外层 Tab"证据与引用"→ 状态卡"需要登录：当前浏览器没有控制台会话，引用读取没有发出"。双档一致。
- 证据：`shots/knowledge-evidence2-1440-r1b.png`、`shots/knowledge-evidence2-375-r1b.png`、`shots/knowledge-landing-375-r1c.png`（侧栏 auth5 在场）
- 根因线索：`web/src/modules/knowledge/session.ts:9` 用 `window.__HERMES_SESSION_TOKEN__` 判会话；该部署由服务器注入 cookie 会话（auth5 widget 走的是另一路），token 未注入 → `EvidenceModulePage.tsx:186` 门禁短路，请求根本不发出（Network 无 evidence 请求，仅 2 个 404 是别的模块）。
- 落点建议：统一会话判定（token 缺失时回退 cookie/whoami，或由部署方保证注入并在文档写明契约）；`EvidenceModulePage.tsx:186,338-352` + `session.ts`。
- 关单标准：登录态下该 Tab 不出现"需要登录"；未登录时出现且文案与真实状态一致。

### UX-R1-P0-2【环境/接线，归 L0 处置，非 UI 码】knowledge 全部读接口 404
- 复现：登录后打开 #/knowledge，DevTools Network：`GET /agent-api/api/knowledge/spaces?limit=20` → 404；`GET /agent-api/api/documents?limit=50` → 404；证据深链时 `GET /agent-api/api/knowledge/citations?limit=20` → 404。
- 证据：`ux-capture-r1b.summary.json`/`ux-capture-r1c.summary.json` badResponses；`shots/knowledge-spaces-dom-1440-r1b.png`（"这块数据没有读到"）
- 影响：列表/详情/检索主任务全部做不成（页 A 维 1/3/4/5 被环境封顶）；r1 无法评审数据态设计。
- 处置建议：接线或换绑上游后通知 UX r2 复验（rubric：P0 阻塞 PASS）。UI 侧空态本身诚实，不另开实现单。

## P1

### UX-R1-P1-1 同一 URL 冷深链与点击进入渲染两个不同页面（"证据与引用"有两套 UI）
- 复现：a) 站内点 Tab"证据与引用"→ ev5 独立页；b) 新标签冷加载 `/knowledge?tab=evidence` → URL 被归一为 `?tab=spaces&panel=evidence`，外层 Tab 选中"知识空间"，内容为内嵌引用面板（未接入+双请求编号+骨架条）。
- 证据：`shots/knowledge-evidence2-1440-r1b.png` vs `shots/knowledge-deeplink-evidence-1440-r1b.png`；`ux-capture-r1c.summary.json` rows[2].url
- 落点建议：`web/src/modules/knowledge/manifest.ts` `normaliseKnowledgeDeepLink`（tab=evidence 应映射外层 Tab 或模块内面板二选一，全局唯一），并统一两处空态/调试信息口径。

### UX-R1-P1-2 375 闭合导航抽屉参与键盘焦点（幽灵焦点区）
- 复现：375 视口（不开抽屉）连按 Tab：第 2-6 停靠点落在屏外 `left:-240` 的"运营总览/数字员工"等链接上，焦点不可见、回车会导航。
- 证据：`ux-capture-r1.summary.json` focusProbe@375（clipped=true）；`ux-capture-r1c.summary.json` leftOut=28（aside/nav 均无 aria-hidden）
- 落点建议：shell 移动端抽屉组件（render 于 `left:-240` 的 aside/nav）：关闭时 `inert`/`aria-hidden="true"` + `visibility:hidden` 或移出 Tab 序。

### UX-R1-P1-3 搜索命中/不命中/无数据三态屏面无差异
- 复现：#/knowledge 文档搜索框分别提交"复制结果"（存在于页面文案）与"zzz不存在词zzz"→ 两屏除关键词回显外完全相同，均显示"这块数据没有读到/未接入"，无"没有找到 N 条匹配/无匹配"文案。
- 证据：`shots/knowledge-search-hit2-1440-r1b.png` vs `shots/knowledge-search-miss2-1440-r1b.png`（settleChars 865 vs 871）
- 落点建议：`KnowledgeModulePage.tsx` 搜索态区（~2989 一带）：区分"数据未加载（接口 404）"与"已加载但无匹配"；无数据时禁用或弱化搜索入口。

### UX-R1-P1-4 双层 Tab 堆叠、语义重复且术语漂移（数据源 vs 数据接入）
- 证据：`shots/knowledge-spaces-dom-1440-r1b.png`（外层 3 Tab 下嵌内层 4 Tab）；375 下内层 2×2 换行（`shots/knowledge-landing-375-r1c.png`）
- 落点建议：manifest/KnowledgeModulePage：模块内导航与 shell Tab 合并为一层，或内层改名去重；统一"数据源/数据接入"用词。

### UX-R1-P1-5 小触点 22 个 <44px（双档同现）
- 样本：`kn6-search-apply 134×16`、`BUTTON:复制 48×21`、`刷新 63×28`、`ev5-refresh 80×28`、`knw5-tab-* 69×30`
- 证据：`ux-capture-r1b.summary.json` smallTapSample（两档）
- 落点建议：共享按钮/Tab 组件的最小触控尺寸（height≥44 或 hit-area 扩展），不必逐页修。

### UX-R1-P1-6 "未接入 或 没有权限"两态混写，用户无法决定下一步
- 证据：`shots/knowledge-spaces-dom-1440-r1b.png`（"复制清单 — 当前不可复制：读口未接入或没有权限"）；码点 `KnowledgeModulePage.tsx:2712`
- 落点建议：按 HTTP 404/403 分流文案；两态确实不可分时给出各自检查动作（先看接线再看权限）。

## P2

| # | 缺陷 | 证据/落点 |
|---|---|---|
| UX-R1-P2-1 | "读口"工程黑话上屏多处 | `shots/knowledge-spaces-dom-1440-r1b.png`；KnowledgeModulePage 文案统一改"数据接口/读取" |
| UX-R1-P2-2 | 同页按钮词不一致："清除关键词"(2989) vs "清空"(1251) | 统一其一 |
| UX-R1-P2-3 | 请求编号 32hex 铺屏（375 近满宽 ×2） | RequestIdLine 组件：中段省略显示+完整值复制 |
| UX-R1-P2-4 | 1440 首个 Tab 停靠点为无名 28×28 按钮（aria 名缺失） | `ux-capture-r1.summary.json` focusProbe 停靠1；补 aria-label |
| UX-R1-P2-5 | 375 区块头副题换行、"刷新"按钮孤悬另起一行 | 页 A 头行布局（KnowledgeModulePage 头区） |

## 复核纪律备注
- 双档取更差定档；焦点环已有键盘实测数据可判（1440 全可见）。
- 375 视觉裁切按 L0 纠偏新口径为**真绿**（元素级 right 违例 0，整页截图 1460/1000/1347px 已验证），旧 document 级口径作废。
- 侧栏高亮在深链图上的疑似错位未过 DOM 复核，**未立案**，r2 顺带核。
