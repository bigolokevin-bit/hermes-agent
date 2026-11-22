# 375 越界三项复核：撤回我此前报告的根因判断（更正件）

- 取证脸：`PORT=9122`（只读，未重启未重建），`ENTRY=assets/index-Dm2Mt71f.js`（从 DOM `script[src]` 现读）
- 登录态：`$D/auth-127.json`（cookie domain 改写为 `127.0.0.1`，否则读口 401 为取证伪像）
- 视口 375×812，逐元素判据原文：可见元素 `boundingRect.right <= vw + 1` 且 `left >= -1`；整块推到左缘外（`right <= 1`）记 offscreenLeft 不计
- 复跑：`cd $D && node probe_375.mjs --base=http://127.0.0.1:9122 --auth=$D/auth-127.json --out=$D/ev-375-before`
- 读数原件：`$D/ev-375-before/375-readings.json`（本次新增「最近横向滚动祖先 + 该祖先能否真滚」两列，是判定的决定项）

## 一、实测读数

| 路由 | 可见元素 | 越界 | 其中在可滚壳内 | 在壳外 | 最右缘 | 文档级横向溢出 | 主犯表 | 表的滚动壳 |
|---|---|---|---|---|---|---|---|---|
| `#/overview?tab=usage` | 108 | 14 | **14** | **0** | 547 | 0 px | `min-w-[520px]` 表（2 行） | `div.overflow-x-auto`，clientW 310 / scrollW 520，canScroll=**true** |
| `#/system` | 221 | 29 | **29** | **0** | 707 | 0 px | `table#sys3-table`（min-width 680px，3 行） | `div.sys3-scroll`，clientW 310 / scrollW 680，canScroll=**true** |
| `#/system+tab=version` | 155 | 18 | **18** | **0** | 587 | 0 px | `table#ver5-table`（min-w-[560px]，3 行） | `div.min-w-0.overflow-x-auto`，clientW 310 / scrollW 560，canScroll=**true** |

另外 `#/system` 页还有第二张表 `table#sys6-table`（min-width 760px），其壳 `sys6-scroll` 当前 `canScroll=false`、宽 0 —— 该表此屏未展开，不构成越界元素（29 处全部来自 sys3）。

## 二、结论：这三项不是布局缺陷，是我的报告写错了根因

1. **三张表都已经有自己的 `overflow-x:auto` 外层壳，且壳真的能滚**（clientW 310 < scrollW 520/680/560）。
2. **文档级横向溢出 = 0 px**：页面本身不横滚，溢出被完全吃在容器里。
3. 全部 61 个「越界」元素都在能滚的壳内，**没有一个在壳外**。
4. `#/system` 的壳上方还有产品自己的提示行 `p.sys3-scrollhint`「左右滑动查看全部列」——容器内横滚是有意设计。

这与 UI-RUBRIC 扣分项的原文一致：「375 档横向滚动（**表格除外且须有容器内滚动**）」——表格允许，条件正是「须在容器内滚动」，本例三条全部满足。

## 三、误报来源（担责）

`docs/_artifacts/ui-kd/375-per-element-full-rerun-report.md`（commit `327283ecaa`，队列 #11）里我写了根因「表带固定 min-width 但外层缺 `overflow-x:auto` 壳，溢出被主区吸收（scrollOverflowCount=1）」。该轮探针**没有把「越界元素是否位于可滚壳内」这个维度读出来**，我拿 `scrollOverflowCount=1` 反向推成「缺壳」。事实是这 1 个滚动壳就是表自己的容器。git 也证明不是事后被修好的：`web/src/modules/duty/UsagePage.tsx`、`web/src/modules/health/SystemHealthSurface.tsx`、`web/src/modules/version/VersionHealthSurface.tsx` 自 11:00 起**零提交**，壳在我出报告之前就在。

⇒ 由该报告派生的自取队列三条（`#/overview?tab=usage`、`#/system`、`#/system?tab=version`）应判**非缺陷**，不需要动 `modules/duty|health|version/**` 一行代码。我此前给 overview/system 车道的「照 .k3-docs-wrap 补壳」建议一并撤回。

## 四、需要别人落地的一处判据改进（跨写域，只报告不动手）

`web/scripts/assert-375.mjs` 的逐元素判据现在会把「位于可滚容器内」的元素也算进 `viol`，因此 36 PASS / 3 FAIL 那张表里，这 3 条其实是「壳内溢出（合规）」而非「越界」。建议壳侧把 `viol` 拆成 `violInsideScrollableShell` 与 `violOutsideShell`，后者才判 FAIL（本次探针已实现该拆法，可直接抄 `probe_375.mjs` 的 `scrollAncestor()`）。该文件属 `web/scripts/**`，不在我写域，未改。

## 五、本次交付物

- 本更正件 + `$D/ev-375-before/375-readings.json` 的副本（同目录同名 `.json`）
- 代码改动：**无**（写域内无缺陷可修，越权改动才是错）
