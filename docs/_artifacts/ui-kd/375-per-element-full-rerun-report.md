# 375 逐元素复跑报告（队列#11，替换旧 scrollWidth 结论）

- 取证脸：`PORT=9122`，`ENTRY=assets/index-Dm2Mt71f.js`（curl 现读，只读未重启）；载体 `web/scripts/assert-375.mjs`（脚本原文，未改），夹具 `--auth-state=$D/auth-127.json`（cookie domain 改写为 127.0.0.1 的登录态）。
- 判据（原文）：perElement = right<=376 && left>=-1 for every visible element；scrollContainers = scrollWidth<=clientWidth for overflow-x:auto|scroll, reported separately；domScrollWidth = auxiliary only (domOverflowPx column), never greens a page；shot = fullPage:true && pngH>812 else NOT_MEASURED；matrix = required png, nonzero。
- 结论汇总：routes=51，PASS=36，FAIL=3，NOT_MEASURED=12；matrixOk=False（matrix 腿 #/employees?tab=matrix 落在 NOT_MEASURED，整页图未测得）。

## 一、越界清单（全部 3 条，逐条给元素）

| 路由 | 越界元素数 | 最右缘 | 溢出像素 | 横向滚动容器超标 | 首个越界元素 |
|---|---|---|---|---|---|
| `#/overview?tab=usage` | 14 | 547 | +171 | 1 | `table " w-full min-w-[520px] text-left text-sm " |
| `#/system` | 29 | 707 | +331 | 1 | `table " sys3-table " |
| `#/system?tab=version` | 18 | 587 | +211 | 1 | `table " w-full min-w-[560px] text-left text-sm " |

三处同一根因：**表格带固定 `min-width` 但外层没有自己的横向滚动壳**，于是整表被推到容器外，溢出改由主区承担（scrollOverflowCount=1 即主区在横滚）。按 UI-RUBRIC 扣分项「375 档横向滚动（表格除外且须容器内滚动）」，缺的是壳，不是表。

### `#/overview?tab=usage`

| tag | testid | class | left | right | 宽 | 文本 |
|---|---|---|---|---|---|---|
| table | — | w-full min-w-[520px] text-left text-sm | 27 | 547 | 520 | 员工账目条数金额（USD）状态员工 · 86A81CE883$1.25账本实测员 |
| thead | — |  | 27 | 547 | 520 | 员工账目条数金额（USD）状态 |
| tr | — | text-xs text-white/45 | 27 | 547 | 520 | 员工账目条数金额（USD）状态 |
| th | — | px-4 py-2 font-normal | 285 | 411 | 126 | 金额（USD） |
| th | — | px-4 py-2 font-normal | 411 | 547 | 136 | 状态 |
| tbody | — |  | 27 | 547 | 520 | 员工 · 86A81CE883$1.25账本实测员工 · 9F42AAE21$0 |
| tr | — | border-t border-white/10 | 27 | 547 | 520 | 员工 · 86A81CE883$1.25账本实测 |
| td | — | px-4 py-2 font-medium | 285 | 411 | 126 | $1.25 |

### `#/system`

| tag | testid | class | left | right | 宽 | 文本 |
|---|---|---|---|---|---|---|
| table | sys3-table | sys3-table | 27 | 707 | 680 | 服务名状态版本或构建标识最近检查时刻响应耗时复制控制台服务(BFF)正常—202 |
| thead | — |  | 27 | 707 | 680 | 服务名状态版本或构建标识最近检查时刻响应耗时复制 |
| tr | — |  | 27 | 707 | 680 | 服务名状态版本或构建标识最近检查时刻响应耗时复制 |
| th | — |  | 231 | 394 | 163 | 版本或构建标识 |
| th | — |  | 394 | 517 | 122 | 最近检查时刻 |
| th | — |  | 517 | 612 | 95 | 响应耗时 |
| th | — | sys-row-copy-head | 612 | 707 | 95 | 复制 |
| tbody | — |  | 27 | 707 | 680 | 控制台服务(BFF)正常—2026-11-22 12:18—复制该行Hermes |

### `#/system?tab=version`

| tag | testid | class | left | right | 宽 | 文本 |
|---|---|---|---|---|---|---|
| table | ver5-table | w-full min-w-[560px] text-left text-sm | 27 | 587 | 560 | 组件名版本构建时刻状态控制台服务(BFF)——正常Hermes 运行时——正常毕 |
| thead | — | text-xs text-white/45 | 27 | 587 | 560 | 组件名版本构建时刻状态 |
| tr | — |  | 27 | 587 | 560 | 组件名版本构建时刻状态 |
| th | — | py-2 pr-3 font-normal | 331 | 456 | 126 | 构建时刻 |
| th | — | py-2 font-normal | 456 | 587 | 131 | 状态 |
| tbody | — | divide-y divide-white/10 | 27 | 587 | 560 | 控制台服务(BFF)——正常Hermes 运行时——正常毕升知识库——正常 |
| tr | ver5-row-console |  | 27 | 587 | 560 | 控制台服务(BFF)——正常 |
| td | ver5-built | py-2 pr-3 | 331 | 456 | 126 | — |

归属：`#/overview?tab=usage` 与 `#/system`、`#/system?tab=version` 均不在 UI-KD 写域（`web/src/modules/knowledge/**`），请转派对应车道；修法与知识模块先例一致（`web/src/modules/knowledge/knowledge.css` 的 `.k3-docs-wrap{max-width:100%;overflow-x:auto}` 模式，先例提交 ui-a c091e274 / b7ad5f01）。

## 二、NOT_MEASURED 清单（12 条，属取图判据未满足，非越界判定）

这些腿整页图高度恰为 812（未超过视口），按 shot 判据记 NOT_MEASURED；其首屏逐元素读数 viol 全为 0、domOverflowPx 0、scrollOverflowCount 0。页面内容不足一屏或内部滚动壳未被撑开，需按「视口加高取图法」补测。

| 路由 | checked | viol | pngH | 备注 |
|---|---|---|---|---|
| `#/access` | 128 | 0 | 812 | 首屏无越界；整页图未撑开 |
| `#/employees?tab=matrix` | 139 | 0 | 812 | 首屏无越界；整页图未撑开 |
| `#/employees/:employeeId` | 103 | 0 | 812 | 首屏无越界；整页图未撑开 |
| `#/employees/:employeeId?zone=config` | 103 | 0 | 812 | 首屏无越界；整页图未撑开 |
| `#/employees/:employeeId?zone=evidence` | 103 | 0 | 812 | 首屏无越界；整页图未撑开 |
| `#/employees/:employeeId?zone=runs` | 103 | 0 | 812 | 首屏无越界；整页图未撑开 |
| `#/employees/:employeeId?zone=tasks` | 103 | 0 | 812 | 首屏无越界；整页图未撑开 |
| `#/identity?tab=departments` | 114 | 0 | 812 | 首屏无越界；整页图未撑开 |
| `#/identity?tab=roles` | 131 | 0 | 812 | 首屏无越界；整页图未撑开 |
| `#/metrics` | 96 | 0 | 812 | 首屏无越界；整页图未撑开 |
| `#/sessions` | 147 | 0 | 812 | 首屏无越界；整页图未撑开 |
| `#/system?tab=defaults` | 137 | 0 | 812 | 首屏无越界；整页图未撑开 |

## 三、PASS 清单（36 条，逐元素 0 越界）

| 路由 | checked | pngH |
|---|---|---|
| `#/approvals` | 331 | 1741 |
| `#/approvals?tab=history` | 815 | 5078 |
| `#/approvals?tab=mine` | 331 | 1741 |
| `#/approvals?tab=pending&view=mine` | 331 | 1741 |
| `#/approvals?tab=pending&view=release` | 331 | 1741 |
| `#/approvals?tab=policy` | 331 | 1741 |
| `#/approvals?tab=release` | 331 | 1741 |
| `#/audit` | 1893 | 10072 |
| `#/capabilities` | 157 | 937 |
| `#/capabilities?tab=channels` | 207 | 1553 |
| `#/capabilities?tab=models` | 151 | 1126 |
| `#/capabilities?tab=tools` | 177 | 874 |
| `#/employees` | 221 | 1480 |
| `#/identity` | 157 | 844 |
| `#/identity?tab=admins` | 157 | 844 |
| `#/identity?tab=binding` | 157 | 844 |
| `#/identity?tab=checks` | 157 | 844 |
| `#/identity?tab=people&view=admins` | 157 | 844 |
| `#/identity?tab=tenant` | 157 | 844 |
| `#/knowledge` | 203 | 1470 |
| `#/knowledge?tab=citations` | 192 | 1375 |
| `#/knowledge?tab=evidence` | 965 | 6707 |
| `#/knowledge?tab=ingest` | 223 | 1665 |
| `#/knowledge?tab=retrieval` | 204 | 1476 |
| `#/knowledge?tab=scope` | 203 | 1470 |
| `#/knowledge?tab=sources` | 223 | 1665 |
| `#/org` | 157 | 844 |
| `#/overview` | 389 | 3021 |
| `#/system?tab=events` | 1893 | 10072 |
| `#/system?tab=events&view=anomaly` | 1893 | 10072 |
| `#/system?tab=retention` | 1893 | 10072 |
| `#/system?tab=security` | 193 | 1930 |
| `#/work` | 160 | 3635 |
| `#/work?tab=board&view=cron` | 356 | 3635 |
| `#/work?tab=cron` | 356 | 3635 |
| `#/work?tab=runs` | 1239 | 10059 |

知识模块七条腿全数 PASS 且 0 越界：`#/knowledge`(203)、`?tab=sources`(223)、`?tab=ingest`(223)、`?tab=retrieval`(204)、`?tab=citations`(192)、`?tab=scope`(203)、`?tab=evidence`(965)。

## 四、与旧 scrollWidth 结论的关系

旧结论用 document 级 `scrollWidth == clientWidth` 判 375 通过，会把「表内溢出被主区横滚吞掉」与「内容不足一屏」两类误判为绿。本轮按逐元素 boundingRect 重跑 51 条路由后：旧口径全绿的页面里，**新增暴露 3 条真越界**（上表），并把 12 条从"通过"降级为"未测得"。故旧 scrollWidth 结论作废，以本报告为准。

## 五、复跑命令

```bash
cd /private/var/folders/2b/bnpsyz450pn98w375q_803yw0000gn/T/opencode/knw-density/assert375
node web/scripts/assert-375.mjs --base=http://127.0.0.1:9122 --auth-state=/private/var/folders/2b/bnpsyz450pn98w375q_803yw0000gn/T/opencode/knw-density/auth-127.json --out=/private/var/folders/2b/bnpsyz450pn98w375q_803yw0000gn/T/opencode/knw-density/ev-q11
```

原始读数：同目录 `375-per-element-full-rerun-report.json`（assert-375/1 schema，51 rows）。

生成时间：2026-11-22T12:19:22（表格由脚本从 json 生成，非手填）
