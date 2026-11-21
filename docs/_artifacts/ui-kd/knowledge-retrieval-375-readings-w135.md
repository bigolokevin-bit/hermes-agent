# wave-135 知识检索面板 375 逐元素读数（脸 a382334c）

- 车道：`lane/console-design`（本报告以文档产物落在本车道，代码零改动）
- 脸（取证对象）：`a382334c` = `origin/lane/hermes-console` tip（`merge lane/console-ui2@947db917: matrix fixture preview door`，wave-135 第 1 件）
- 取影方式：`git checkout --detach a382334c` 后构建，车道分支未移动；`cd web && node_modules/.bin/vite build` rc=0（日志 `build_w135.log`），入口 `index-D7HvX3yl.js`，知识面 chunk `KnowledgeModulePage-DWJSTRHo.js`，样式 `KnowledgeModulePage-CJGPnxIo.css`
- 夹具：本地 `fixture_404.py` 端口 9135，知识读口全部返 404（复现 r4/r5 屏态），非知识路径反代到 9119；9122 只读未动
- 判据（新口径）：逐元素 `boundingRect.right <= 375 + 1` 且 `left >= -1`；整块被推到左侧外的（`right <= 1`）记为 offscreen 不计越界。文档级 `scrollWidth` 与壳层 `overflow-x-hidden` 不作为绿证
- 视口：375x812；每例含折叠态与展开态两轮读数，两轮一致

## 越界元素清单：0 条（五态皆 0）

| 例 | URL | 可见元素 | 越界 | 最右缘 px | 文档横向溢出 | 横向滚动容器 | 落点 data-tab | 内层选中 | 分段钮数 | 壳强制态 testid | 黄块 | 屏上裸 hex | 编辑探 | 取图尺寸 | PNG |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| live-unwired 实时读不到（夹具全 404） | http://127.0.0.1:9135/knowledge?panel=retrieval | 193 | 0 | 375 | 0 | 0 | retrieval | 检索 | 4 | None | 3 | 0 | 0 | 375x1518 | `/private/var/folders/2b/bnpsyz450pn98w375q_803yw0000gn/T/opencode/knw-density/ev-w135/w135-live-unwired-375.png` |
| loading 共存：?panel=retrieval&state=loading | http://127.0.0.1:9135/knowledge?panel=retrieval&state=loading | 114 | 0 | 375 | 0 | 0 | None | None | 0 | None | 0 | 0 | 0 | 375x812 | `/private/var/folders/2b/bnpsyz450pn98w375q_803yw0000gn/T/opencode/knw-density/ev-w135/w135-loading-375.png` |
| empty 共存：?panel=retrieval&state=empty | http://127.0.0.1:9135/knowledge?panel=retrieval&state=empty | 113 | 0 | 375 | 0 | 0 | None | None | 0 | None | 0 | 0 | 0 | 375x812 | `/private/var/folders/2b/bnpsyz450pn98w375q_803yw0000gn/T/opencode/knw-density/ev-w135/w135-empty-375.png` |
| error 共存：?panel=retrieval&state=error | http://127.0.0.1:9135/knowledge?panel=retrieval&state=error | 115 | 0 | 375 | 0 | 0 | None | None | 0 | None | 0 | 0 | 0 | 375x812 | `/private/var/folders/2b/bnpsyz450pn98w375q_803yw0000gn/T/opencode/knw-density/ev-w135/w135-error-375.png` |
| denied 共存：?panel=retrieval&state=denied | http://127.0.0.1:9135/knowledge?panel=retrieval&state=denied | 113 | 0 | 375 | 0 | 0 | None | None | 0 | None | 0 | 0 | 0 | 375x812 | `/private/var/folders/2b/bnpsyz450pn98w375q_803yw0000gn/T/opencode/knw-density/ev-w135/w135-denied-375.png` |

## 读数说明
- 实时读不到（`?panel=retrieval` 直达）：落点 `data-tab=retrieval`，内层选中面「检索」，分段列 4 钮（空间台账/数据接入/检索/运行事件引用），屏上无裸 hex，无「编辑探」字样元素，页面下方为 3 个黄块（同因未归并，本轮只分段）。
- 四态共存（`?panel=retrieval&state=loading|empty|error|denied`）：可见元素 113-115、越界 0、最右缘恰 375（壳侧栏贴边），但 `data-tab` 与 `knw5-forced-*` 均为空 —— 读数仍落在**壳层占位页**，`?state=` 由 `web/src/shell/console.tsx` 拦截，模块自身 `readForced`（`KnowledgeModulePage.tsx:3595`）在壳夹具下不可达。与 wave-134 结论一致，本轮未变。
- 「编辑探…」在知识页 0 处；全仓唯一出现是 `web/src/modules/health/SystemHealthSurface.tsx:403`（L2/L5 写域）。满幅刷新/复制钮形制在 `web/src/shell/ConsoleButton.tsx`，内层 tab 2x2 与 `?tab=retrieval -> evidence` 兼容重定向在 `web/src/shell/routes.ts`（L4 写域）。
- 六腿数字与本报告同源：原始读数 `w135-readings.json`（同目录）。重跑口令见文末。

## 与 wave-134 的差异
- 知识模块代码在 `6edcba4d` 与 `a382334c` 之间**字节相同**（`git diff --stat` 对 `web/src/modules/knowledge` 输出为空），所以本轮复读只可能变的是壳侧共存语义；实测共存腿仍走壳占位页，结论未变。
- 脸换代带来的构建指纹变化：入口 `index-3Opmhawd.js`（134）→ `index-D7HvX3yl.js`（135），知识面 chunk `KnowledgeModulePage-Dn5SQ-tB.js` 血统 → `KnowledgeModulePage-DWJSTRHo.js`。

## 重跑口令
```bash
R=/Users/kevin_studio/Projects/forks/console-design
D=/private/var/folders/2b/bnpsyz450pn98w375q_803yw0000gn/T/opencode/knw-density
cd $R && git checkout -q --detach a382334c
cd $R/web && node_modules/.bin/vite build
pkill -f fixture_404.py; cd $D && KNW_PORT=9135 KNW_ROOT=$R/hermes_cli/web_dist nohup python3 fixture_404.py > s9135w135.log 2>&1 &
mkdir -p $D/ev-w135 && cd $D && node probe_states.mjs --base=http://127.0.0.1:9135 --out=$D/ev-w135 --label=w135
```

生成时间：2026-11-22 05:51:56 +0800（本机时钟，仅记录产物落盘时刻，不参与任何屏面读数）
