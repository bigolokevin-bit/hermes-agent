# 知识检索面板 375 逐元素 boundingRect 读数（wave-134 取证产物）

- 取证对象（脸）：`6edcba4d` = `fix(shell): drop ?panel= from employee detail zone links`。取图用 `git checkout --detach`，车道分支当时未移动；本文件落在 `lane/console-design`。
- 被测改动 sha：`3c22b6db`（n1 内外层标签去重与 ?panel 对齐），其父 `3e01e190`（第四改：面题分段、请求编号不上屏、新鲜度收起态一行读数）；二者均为本脸祖先（`git merge-base --is-ancestor` 已核）。
- 构建：`cd web && node_modules/.bin/vite build` rc=0，产物 `hermes_cli/web_dist`，入口 `index-3Opmhawd.js` / `index-DLpXaUuB.css`。夹具服务 `127.0.0.1:9135`（`fixture_404.py`：知识读口一律返 404 带 `request_id`，其余代理到 9119），起服后校验 `root=200 marker=404`。现网 9122 未动、未重建。
- 判据（L0 新口径，与 `web/scripts/assert-375.mjs` 同源）：375×812 视口下，每个可见元素（width/height ≥2，且非 `display:none` / `visibility:hidden` / `opacity≤0.05`）满足 `boundingRect.right <= 视口右缘 + 1` 且 `left >= -1`；被完全推离左缘（`right ≤ 1`）不计违规。`document` 级 `scrollWidth` 读数与壳层 `overflow-x-hidden` 一律不作证据。截图在展开内部滚动壳及其整条祖先链后按加高视口取，避免只捕首屏。

## 逐态读数（?panel=retrieval 直达 + 四态共存）

| 态 | URL | 可见元素 | 越界元素 | 最右缘(px) | doc 溢出(px) | 横向滚动容器 | 取图尺寸 | PNG |
|---|---|---|---|---|---|---|---|---|
| live-unwired | `/knowledge?panel=retrieval` | 193 | **0** | 375 | 0 | 0 | 375×1518 | `w134-live-unwired-375.png` |
| loading | `/knowledge?panel=retrieval&state=loading` | 114 | **0** | 375 | 0 | 0 | 375×812 | `w134-loading-375.png` |
| empty | `/knowledge?panel=retrieval&state=empty` | 113 | **0** | 375 | 0 | 0 | 375×812 | `w134-empty-375.png` |
| error | `/knowledge?panel=retrieval&state=error` | 115 | **0** | 375 | 0 | 0 | 375×812 | `w134-error-375.png` |
| denied | `/knowledge?panel=retrieval&state=denied` | 113 | **0** | 375 | 0 | 0 | 375×812 | `w134-denied-375.png` |

越界元素清单：**空（五态皆 0 条）**。每态 `violSample` 与 `scrollOverflow` 都是空数组；逐条原始读数在同目录 `w134-readings.json`。最右缘恰好等于视口右缘 375.0（壳侧栏 nav 贴边），不是溢出。

## 点名句柄的实测矩形（live-unwired 态：知识模块真实挂载）

- 刷新按钮：left 11.3 → right 352.8（宽 342px） — 占满 342px 可用宽，未越右缘。它的满幅形态由 `web/src/shell/ConsoleButton.tsx` 与壳样式决定，属跨写域，本轮不改。
- 内层分段列 `.knw5-seg`：容器 left 11.3 → right 352.8（宽 342px），`grid-template-columns: 169.75px 169.75px` → 2×2 排布四枚：
  - `knw5-tab-spaces`「空间台账」left 12.3 → right 182（宽 170px）
  - `knw5-tab-ingest`「数据接入」left 182 → right 351.8（宽 170px）
  - `knw5-tab-retrieval`「检索」left 12.3 → right 182（宽 170px）（aria-selected=true）
  - `knw5-tab-evidence`「运行事件引用」left 182 → right 351.8（宽 170px）
- 外层导航与内层分段无同名碰撞：内层四面为 空间台账 / 数据接入 / 检索 / 运行事件引用（n1 去重后的形态，`collision=[]` 已在 wave-132/133 用 `labels.mjs` 复证）。

- 「编辑探…」：本页可见元素中 **0 处**。全 `web/src` 唯一命中是 `web/src/modules/health/SystemHealthSurface.tsx:403`「编辑探针（计划中）」，属 health/system（L2/L5 写域），不在知识检索面板上。若 n2 的越界报告点名它，取证应落在系统页而不是本页。
- 其余易越界件实测 right 值：复制类按钮 [('knG-copy', 352.8)]；黄块动作行 `.knw5-actions` [199.5, 200.5, 200.5]；请求编号行 `.knw5-req` [('本次回答没有带请求编号', 142.4), ('本次回答没有带请求编号', 143.4), ('本次回答没有带请求编号', 143.4)]；面题 `.knw5-surface-title` ['文档命中', '检索命中', '读取记录']。
- 状态位：`data-tab=retrieval`，选中内层「检索」，面题 ['文档命中', '检索命中', '读取记录']，黄块 3 个，屏上裸 hex 0 个（第四改的 `data-revealed=false` 生效）。

## 四态为什么与模块态不同形（如实记录）

- `?state=loading|empty|error|denied` 由**壳层**拦截：`web/src/shell/console.tsx:221/234/248/262`（注释 §8.1-3 pane forcing）、`shell/bridge.ts` 的 `forcedState`、`lib/usePaneData.ts:148`（强制态不发真请求）。渲染的是壳的占位 pane，所以 `[data-testid="knw5-panel"]` 与 `.knw5-seg` 都不存在（四条腿里 `data-tab=null`、seg 0 枚、可见元素 113-115）。这四条腿证明的是「壳占位页在 375 不越界」，不证明知识模块自己的 forced 分支。
- 知识模块内部也读 `?state=`（`modules/knowledge/KnowledgeModulePage.tsx:3595 readForced`，testid `knw5-forced-loading|empty|error` + `退出预览` 钮），但在本脸经壳拦截后到不了它：要在 375 复测模块自己的三态，需要一条不穿过壳 fixture 的入口（`shell/**`，L4 写域）。
- 四条壳态取图尺寸均为 375×812：脚本按 `min(max(grown, 812), 6000)` 设视口后回读 `innerHeight` 仍是 812，即展开后的 `scrollHeight ≤ 812`，内容本身不满一屏，不是首屏截断；live 态展开后取到 375×1518。

## 产物与复跑

- 原始读数：`$D/ev-w134/w134-readings.json`；五张 PNG：`$D/ev-w134/w134-{live-unwired,loading,empty,error,denied}-375.png`。`$D = /private/var/folders/2b/bnpsyz450pn98w375q_803yw0000gn/T/opencode/knw-density`（临时目录，不入库）。
- 复跑：`cd $D && KNW_PORT=9135 KNW_ROOT=<repo>/hermes_cli/web_dist nohup python3 fixture_404.py > s.log 2>&1 &`，再 `node probe_states.mjs --base=http://127.0.0.1:9135 --out=$D/ev-w134 --label=w134`（脚本 `probe_states.mjs` 记录判据与五态 URL）。
- 生成时间：2026-11-22 04:41（本机）。
