# /overview 改吃 workbench 读模型（2026-11-20）

## 变动的四个读口（BFF 已上线，`a7bccdf`）
| 卡片 | 旧来源 | 新来源 |
|---|---|---|
| 今日运行（统计） | `GET /api/run-stats?from&to` | `GET /api/workbench/summary?range=1d`（KPI `runs`/`failed`/`costUsd`） |
| 近 14 天运行（趋势） | `GET /api/run-stats` 14d 窗口 | `GET /api/workbench/timeseries?range=14d&bucket=day&metric=runs` |
| 待我处理（计数 + 行） | `GET /api/approval-stats` + `GET /api/approvals` | `GET /api/workbench/queue?page_size=100`（一次取数，两张卡同源） |

未动：员工目录、员工统计、24 小时活跃热力（`/run-activity`）、成本账本（`/budget-usage`）、最近运行（`/runs`）、阻塞（`/tasks`）、能力矩阵（仍走 `/matrix` 的未接入态）。

## 口径
- `asOf` 只取响应顶层 ISO-8601（带时区）→ 北京时间到分；缺失或非法显示「—」，`title` 说明，绝不拿本机时钟顶上。
- 缺数字留 `null` → 「—」；`summary` 没有 succeeded/running，不补、不按 0 记。
- `queue` 源不可用时 BFF 返回 200 + `available:false`：计数为 `undefined`（「—」）并透传 reason，不当成空队列。
- `timeseries` 的 `point.value` 为 null 的桶被丢弃，不参与求和；`totals.value` 优先。
- 单口失败只让对应卡片进错误/GAP 态，其余卡片照常（局部可用），不整页白屏。

## 证据
- `vitest run src/modules/duty` → 3 files / 54 passed。
- 全量 `vitest run` → 147 files / 1928 passed（本刀前 1926）。
- `tsc -b . --noEmit` → 本域 0 条（全仓既存基线不变）。
- build `vite build --outDir /tmp/build-ovwb` → EXIT 0；entry `assets/index-De_nG8ln.js` sha256 `46aabeb84ac00b5bd83fcf6552d8ca5ca2e933af66c0c87661d46c31164a0bee`；entry 内 `summary?range=` 命中 0；本页 chunk `assets/DutyPage-CKqhFx4d.js`：`summary?range=`=1、`/agent-api/api/workbench`=1。
- 测试断言：`/run-stats`、`/approval-stats`、`/approvals` 不再被请求；`/workbench/queue` 恰 1 次；`ov6-asof` 显示 workbench `asOf` 的北京时间；`timeseries` 404 时趋势卡「—」而今日运行仍显示 2。

## 未测项
- 四口 200 实例体未在浏览器实测（cookie 已过期，仅按 BFF 源码形状消费；未登录裸打为 401 + rid，证明路由在线）。
- 真实 BFF 局部 `available:false` 与 `degraded` 文案上屏未走查。
- 375/1440 视觉未实机复核（沿用既有栅格与 ov6-* testid 未改）。