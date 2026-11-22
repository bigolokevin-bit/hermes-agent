# 知识检索面板 375 逐元素 boundingRect 自证（集成基线 2380c66991 / 验收脸 9122）

- 取证时间：2026-11-22 09:56（本地）
- 车道：`lane/console-design`，本产物父提交 = `cd6d0ecae9`（merge 集成基线 `2380c66991`，已 push）
- **端口 = 9122（`/agent-v2/` 与 `/` 两种形态同值）；entry = `assets/index-Dm2Mt71f.js`（served 与盘上 `hermes_cli/web_dist/index.html` 同名，全量测试自报 MATCH=yes）**
- 判据（逐元素 boundingRect，非文档级 scrollWidth）：可见元素 `right <= 视口宽 + 1` 且 `left >= -1`；完全推出左缘（right ≤ 1）计为 offscreenLeft，不计违规
- 视口 375×812，真实等待（domcontentloaded → networkidle → innerText 稳定轮询），每腿新 context；取图前按 assert-375 口径 force() 展开内部滚动壳并抬高视口，保证真 fullPage
- 夹具：无（直接打验收脸 9122 的真实后端，知识读口本次有数据）

| 态 | 地址参数 | 可见元素数 | 越界元素 | 最右缘(px) | 文档级溢出 | 内层选中面 | 面题 | 取图尺寸 |
|---|---|---|---|---|---|---|---|---|
| live-unwired | panel=retrieval | 163 | 0 | 375 | 0 | `检索` | 文档命中,检索命中,读取记录 | 375x1323 |
| loading | panel=retrieval&state=loading | 99 | 0 | 375 | 0 | `—` | — | 375x812 |
| empty | panel=retrieval&state=empty | 98 | 0 | 375 | 0 | `—` | — | 375x812 |
| error | panel=retrieval&state=error | 100 | 0 | 375 | 0 | `—` | — | 375x812 |
| denied | panel=retrieval&state=denied | 98 | 0 | 375 | 0 | `—` | — | 375x812 |

## 读数结论
- **越界元素清单：0 条（五态全 0）**；最右缘恰 375.0 = 壳侧栏贴右缘，未越界。
- `?panel=retrieval` 直达成立：落地 `data-tab=retrieval`，内层选中「检索」，面题 文档命中/检索命中/读取记录。
- 屏上裸 hex 0 处；`编辑探…` 0 处（唯一真身 `web/src/modules/health/SystemHealthSurface.tsx:403`，L2/L5 写域）。
- 真实后端本次返回数据，`unwiredBlocks=0`（此前夹具 404 态为 3 黄块，属数据面缺失而非布局病）。
- 四态共存腿（`?state=loading/empty/error/denied`）仍落壳占位页（`data-tab` 为 null，元素 ~98-100），模块自身 `readForced` 经壳入口不可达 —— 跨写域（`shell/**`，L4）。

## 产物与复跑
- 原始读数：`/private/var/folders/2b/bnpsyz450pn98w375q_803yw0000gn/T/opencode/knw-density/ev-r13/r13-readings.json`；PNG 同目录 `r13-<态>-375.png`（尺寸见上表，sips 实测）。
- 复跑：`cd web && node_modules/.bin/vite build && cd <D> && node probe_states.mjs --base=http://127.0.0.1:9122 --out=<D>/ev-r13 --label=r13`
- 全量门禁：`cd web && pnpm exec vitest run` → **478 files / 3529 tests 全绿，rc=0**（日志 `/private/var/folders/2b/bnpsyz450pn98w375q_803yw0000gn/T/opencode/knw-density/full_r13b.log`）
